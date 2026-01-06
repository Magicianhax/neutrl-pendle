// Test script for Browserless.io
// Uses fetch() from within browser context after passing security check

require("dotenv").config({ path: ".env.local" });
const puppeteer = require("puppeteer-core");

const API_URL =
  "https://app.neutrl.fi/api/sentio?hash=e449740b504a998538eabad36695f9fc8f0cc9d8c0552cfeb66939978d2547ff&variables=%7B%22userId%22%3A%22ethereum-1-undefined%22%2C%22seasonProgramIds%22%3A%5B%22ethereum-1-seasonProgram-Season_Neutrl_Origin%22%2C%22plasma-9745-seasonProgram-Season_Neutrl_Origin%22%5D%7D";

const ETHEREUM_SEASON_ID = "ethereum-1-seasonProgram-Season_Neutrl_Origin";

async function testBrowserless() {
  const apiKey = process.env.BROWSERLESS_API_KEY;

  if (!apiKey) {
    console.error("Error: BROWSERLESS_API_KEY environment variable not set");
    process.exit(1);
  }

  console.log("Connecting to Browserless...");
  const startTime = Date.now();

  const browser = await puppeteer.connect({
    browserWSEndpoint: `wss://chrome.browserless.io?token=${apiKey}`,
  });

  try {
    console.log("Connected! Opening page...");
    const page = await browser.newPage();

    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
    );

    // First visit the main site to pass Vercel security check
    console.log("Step 1: Loading main site to pass security check...");
    await page.goto("https://app.neutrl.fi", {
      waitUntil: "networkidle2",
      timeout: 60000,
    });
    console.log("✓ Main site loaded");

    // Wait for security check to complete
    await new Promise(r => setTimeout(r, 2000));

    // Now use fetch() from within the browser context
    console.log("Step 2: Fetching API using browser's fetch()...");
    const apiData = await page.evaluate(async (url) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json();
    }, API_URL);

    console.log("✓ API response received");

    // Find Ethereum season program
    const ethereumProgram = apiData.data?.seasonPrograms?.find(
      (p) => p.id === ETHEREUM_SEASON_ID
    );

    if (!ethereumProgram) {
      console.error("Ethereum season program not found");
      console.log("Raw response:", JSON.stringify(apiData, null, 2));
      return;
    }

    const totalPoints = parseFloat(ethereumProgram.state.totalPoints);
    const participantCount = parseInt(ethereumProgram.state.participantCount);
    const upNusdMultiplier = parseInt(ethereumProgram.state.upNusdMultiplier);

    const elapsed = Date.now() - startTime;

    console.log("\n✅ SUCCESS! Browserless works.\n");
    console.log("Results:");
    console.log(`  Total Points: ${totalPoints.toLocaleString()}`);
    console.log(`  Participants: ${participantCount.toLocaleString()}`);
    console.log(`  upNUSD Multiplier: ${upNusdMultiplier}`);
    console.log(`  Time elapsed: ${elapsed}ms`);
    console.log("\nYou can now implement this in production!");

  } finally {
    await browser.close();
  }
}

testBrowserless().catch(console.error);
