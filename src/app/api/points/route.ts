import { NextResponse } from "next/server";

const API_URL =
  "https://app.neutrl.fi/api/sentio?hash=e449740b504a998538eabad36695f9fc8f0cc9d8c0552cfeb66939978d2547ff&variables=%7B%22userId%22%3A%22ethereum-1-undefined%22%2C%22seasonProgramIds%22%3A%5B%22ethereum-1-seasonProgram-Season_Neutrl_Origin%22%2C%22plasma-9745-seasonProgram-Season_Neutrl_Origin%22%5D%7D";

const ETHEREUM_SEASON_ID = "ethereum-1-seasonProgram-Season_Neutrl_Origin";

// Cache TTL in milliseconds (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;

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

async function fetchWithPuppeteer(): Promise<CachedData> {
  // Dynamic import puppeteer only when needed
  const puppeteer = await import("puppeteer");

  const browser = await puppeteer.default.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

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

    if (!response || !response.ok()) {
      throw new Error(`HTTP error! Status: ${response?.status()}`);
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

    console.log("Fetching fresh data from Neutrl API...");
    const freshData = await fetchWithPuppeteer();

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
