import { NextResponse } from "next/server";

const API_URL =
  "https://app.neutrl.fi/api/sentio?hash=e449740b504a998538eabad36695f9fc8f0cc9d8c0552cfeb66939978d2547ff&variables=%7B%22userId%22%3A%22ethereum-1-undefined%22%2C%22seasonProgramIds%22%3A%5B%22ethereum-1-seasonProgram-Season_Neutrl_Origin%22%2C%22plasma-9745-seasonProgram-Season_Neutrl_Origin%22%5D%7D";

const ETHEREUM_SEASON_ID = "ethereum-1-seasonProgram-Season_Neutrl_Origin";

// Cache TTL in milliseconds (1 hour)
const CACHE_TTL = 60 * 60 * 1000;

// Retry configuration for 429 errors
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 2000; // 2 seconds

interface CachedData {
  timestamp: string;
  totalPoints: number;
  totalPointsFormatted: string;
  participantCount: number;
  upNusdMultiplier: number;
}

interface Cache {
  data: CachedData | null;
  expires: number;
}

// In-memory cache
let cache: Cache = { data: null, expires: 0 };

// Fetch lock to prevent concurrent requests
let fetchInProgress: Promise<CachedData> | null = null;

interface SeasonProgramState {
  __typename: string;
  id: string;
  participantCount: string;
  totalPoints: string;
  upNusdMultiplier: string;
}

interface SeasonProgram {
  __typename: string;
  endBlock: string;
  id: string;
  startBlock: string;
  state: SeasonProgramState;
}

interface NeutrlAPIResponse {
  data?: {
    seasonPrograms?: SeasonProgram[];
  };
}

function formatLargeNumber(num: number): string {
  if (num >= 1e12) return (num / 1e12).toFixed(2) + "T";
  if (num >= 1e9) return (num / 1e9).toFixed(2) + "B";
  if (num >= 1e6) return (num / 1e6).toFixed(2) + "M";
  if (num >= 1e3) return (num / 1e3).toFixed(2) + "K";
  return num.toFixed(2);
}

// Helper function to delay execution
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithPuppeteer(retryCount = 0): Promise<CachedData> {
  // Dynamic import puppeteer only when needed
  const puppeteer = await import("puppeteer");
  const { execSync } = await import("child_process");

  // Determine executable path - check environment variable first
  let executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;

  // If not set, try to find chromium in PATH (for Railway/Nix)
  if (!executablePath) {
    try {
      // Try to find chromium using which command
      const chromiumPath = execSync("which chromium", { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      if (chromiumPath) {
        executablePath = chromiumPath;
      }
    } catch (error) {
      // If which fails, try chromium-browser
      try {
        const chromiumPath = execSync("which chromium-browser", { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
        if (chromiumPath) {
          executablePath = chromiumPath;
        }
      } catch (e) {
        // Let Puppeteer auto-detect if we can't find it
        console.log("Chromium not found in PATH, using Puppeteer auto-detection");
      }
    }
  }

  const launchOptions: any = {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  };

  // Only set executablePath if we found one
  if (executablePath) {
    launchOptions.executablePath = executablePath;
    console.log(`Using Chromium at: ${executablePath}`);
  }

  const browser = await puppeteer.default.launch(launchOptions);

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    const response = await page.goto(API_URL, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    const status = response?.status();

    // Handle 404 - upstream API endpoint may have changed
    if (status === 404) {
      await browser.close();
      throw new Error(`Upstream API returned 404 - endpoint may have changed or been removed`);
    }

    // Handle 429 rate limit with retry
    if (status === 429) {
      await browser.close();

      if (retryCount < MAX_RETRIES) {
        const retryDelay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
        console.log(`Rate limited (429). Retrying in ${retryDelay}ms... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        await delay(retryDelay);
        return fetchWithPuppeteer(retryCount + 1);
      }

      throw new Error(`HTTP error! Status: 429 (Rate limited after ${MAX_RETRIES} retries)`);
    }

    if (!response || !response.ok()) {
      throw new Error(`HTTP error! Status: ${status}`);
    }

    const data: NeutrlAPIResponse = await response.json();

    // Find Ethereum season program
    const ethereumProgram = data.data?.seasonPrograms?.find(
      (p) => p.id === ETHEREUM_SEASON_ID
    );

    if (!ethereumProgram) {
      throw new Error("Ethereum season program not found");
    }

    const totalPoints = parseFloat(ethereumProgram.state.totalPoints);
    const participantCount = parseInt(ethereumProgram.state.participantCount);
    const upNusdMultiplier = parseInt(ethereumProgram.state.upNusdMultiplier);

    return {
      timestamp: new Date().toISOString(),
      totalPoints,
      totalPointsFormatted: formatLargeNumber(totalPoints),
      participantCount,
      upNusdMultiplier,
    };
  } finally {
    await browser.close();
  }
}

export async function GET() {
  try {
    // Check if we have valid cached data
    if (cache.data && Date.now() < cache.expires) {
      console.log("Returning cached data (expires in", Math.round((cache.expires - Date.now()) / 1000), "seconds)");
      return NextResponse.json({
        ...cache.data,
        isCached: true,
        cacheExpiresIn: Math.round((cache.expires - Date.now()) / 1000),
      });
    }

    // Use fetch lock to prevent concurrent requests
    // If a fetch is already in progress, wait for it instead of making a new request
    if (fetchInProgress) {
      console.log("Fetch already in progress, waiting for result...");
      try {
        const freshData = await fetchInProgress;
        return NextResponse.json({
          ...freshData,
          isCached: true,
          cacheExpiresIn: Math.round((cache.expires - Date.now()) / 1000),
        });
      } catch (error) {
        // If the in-progress fetch failed, fall through to error handling
        console.error("In-progress fetch failed:", error);
        if (cache.data) {
          return NextResponse.json({
            ...cache.data,
            isCached: true,
            isStale: true,
            error: "Failed to refresh, returning stale data",
          });
        }
        throw error;
      }
    }

    console.log("Fetching fresh data from Neutrl API...");

    // Set the fetch lock
    fetchInProgress = fetchWithPuppeteer();

    try {
      const freshData = await fetchInProgress;

      // Update cache
      cache = {
        data: freshData,
        expires: Date.now() + CACHE_TTL,
      };

      return NextResponse.json({
        ...freshData,
        isCached: false,
        cacheExpiresIn: Math.round(CACHE_TTL / 1000),
      });
    } finally {
      // Always clear the fetch lock
      fetchInProgress = null;
    }
  } catch (error) {
    console.error("Error fetching from Neutrl:", error);

    // If we have stale cache, return it with a warning
    if (cache.data) {
      return NextResponse.json({
        ...cache.data,
        isCached: true,
        isStale: true,
        error: "Failed to refresh, returning stale data",
      });
    }

    // Return error response
    return NextResponse.json(
      {
        error: "Failed to fetch data from Neutrl",
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
