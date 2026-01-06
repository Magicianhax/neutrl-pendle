/**
 * Fetches S1 Rewards data from Neutrl using Puppeteer and caches to JSON file
 *
 * Run manually: node scripts/fetch-points.js
 * Or set up a cron job to run periodically
 */

const fs = require('fs');
const path = require('path');

const API_URL = 'https://app.neutrl.fi/api/sentio?hash=e449740b504a998538eabad36695f9fc8f0cc9d8c0552cfeb66939978d2547ff&variables=%7B%22userId%22%3A%22ethereum-1-undefined%22%2C%22seasonProgramIds%22%3A%5B%22ethereum-1-seasonProgram-Season_Neutrl_Origin%22%2C%22plasma-9745-seasonProgram-Season_Neutrl_Origin%22%5D%7D';

const CACHE_FILE = path.join(__dirname, '..', 'src', 'data', 'points-cache.json');
const ETHEREUM_SEASON_ID = 'ethereum-1-seasonProgram-Season_Neutrl_Origin';

async function fetchPoints() {
  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch (e) {
    console.error('Puppeteer not installed. Run: npm install puppeteer');
    process.exit(1);
  }

  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    console.log('Fetching data from Neutrl...');
    const response = await page.goto(API_URL, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    if (!response.ok()) {
      throw new Error(`HTTP error! Status: ${response.status()}`);
    }

    const data = await response.json();

    // Find Ethereum season program
    const ethereumProgram = data.data?.seasonPrograms?.find(
      (p) => p.id === ETHEREUM_SEASON_ID
    );

    if (!ethereumProgram) {
      throw new Error('Ethereum season program not found');
    }

    const totalPoints = parseFloat(ethereumProgram.state.totalPoints);
    const participantCount = parseInt(ethereumProgram.state.participantCount);
    const upNusdMultiplier = parseInt(ethereumProgram.state.upNusdMultiplier);

    const cacheData = {
      timestamp: new Date().toISOString(),
      totalPoints,
      totalPointsFormatted: formatLargeNumber(totalPoints),
      participantCount,
      upNusdMultiplier,
      raw: ethereumProgram,
    };

    // Ensure directory exists
    const dir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write cache file
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cacheData, null, 2));

    console.log('\nData cached successfully!');
    console.log('Total Points:', cacheData.totalPointsFormatted);
    console.log('Participants:', cacheData.participantCount);
    console.log('Cache file:', CACHE_FILE);

    return cacheData;
  } finally {
    await browser.close();
  }
}

function formatLargeNumber(num) {
  if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  return num.toFixed(2);
}

fetchPoints()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error.message);
    process.exit(1);
  });
