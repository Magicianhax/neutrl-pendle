#!/usr/bin/env node
/**
 * Scheduled Snapshot Capture Script
 *
 * This script fetches TVL data from the app's API and saves it to Supabase.
 * Can be run via:
 * - Railway Cron Jobs
 * - GitHub Actions
 * - Any cron scheduler
 *
 * Environment variables required:
 * - NEXT_PUBLIC_SUPABASE_URL: Supabase project URL
 * - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key (for writes)
 * - BASE_URL: The deployed app URL (e.g., https://your-app.railway.app)
 * - CRON_SECRET: Secret key for authenticating snapshot saves
 * - ETHERSCAN_API_KEY: For fetching on-chain data (if running TVL fetch locally)
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

// Validate required environment variables
if (!BASE_URL || BASE_URL === 'http://localhost:3000') {
  console.error('ERROR: BASE_URL environment variable is not set!');
  console.error('Please set BASE_URL to your Railway deployment URL (e.g., https://your-app.railway.app)');
  process.exit(1);
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('ERROR: Supabase configuration missing!');
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

if (!CRON_SECRET) {
  console.warn('WARNING: CRON_SECRET not set. Snapshot saves via API will be unauthenticated.');
}

// Initialize Supabase client
const supabase = SUPABASE_URL && SUPABASE_SERVICE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  : null;

async function fetchTvlData() {
  console.log(`[${new Date().toISOString()}] Fetching TVL data from ${BASE_URL}/api/tvl...`);

  const response = await fetch(`${BASE_URL}/api/tvl`, {
    headers: {
      'Content-Type': 'application/json',
    },
    // Add timeout
    signal: AbortSignal.timeout(120000), // 2 minute timeout
  });

  if (!response.ok) {
    throw new Error(`TVL API returned ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

async function fetchPointsData() {
  console.log(`[${new Date().toISOString()}] Fetching points data from ${BASE_URL}/api/points...`);

  const response = await fetch(`${BASE_URL}/api/points`, {
    headers: {
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(120000), // 2 minute timeout (puppeteer can be slow)
  });

  if (!response.ok) {
    throw new Error(`Points API returned ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

async function saveToSupabase(snapshot) {
  if (!supabase) {
    throw new Error('Supabase not configured. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  }

  console.log(`[${new Date().toISOString()}] Saving snapshot to Supabase...`);

  const { error } = await supabase
    .from('tvl_snapshots')
    .insert({
      captured_at: snapshot.capturedAt,
      captured_at_unix: snapshot.capturedAtUnix,
      summary: snapshot.summary,
      table_condensed: snapshot.tableCondensed,
    });

  if (error) {
    throw new Error(`Supabase insert failed: ${error.message}`);
  }

  console.log(`[${new Date().toISOString()}] Snapshot saved successfully!`);
}

async function saveViaApi(snapshot) {
  console.log(`[${new Date().toISOString()}] Saving snapshot via API...`);

  const response = await fetch(`${BASE_URL}/api/snapshots`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CRON_SECRET}`,
    },
    body: JSON.stringify(snapshot),
  });

  if (!response.ok) {
    throw new Error(`Snapshot API returned ${response.status}: ${await response.text()}`);
  }

  console.log(`[${new Date().toISOString()}] Snapshot saved via API successfully!`);
}

async function main() {
  console.log('='.repeat(60));
  console.log(`[${new Date().toISOString()}] Starting TVL Snapshot Capture`);
  console.log('='.repeat(60));

  try {
    // Fetch data from both APIs in parallel
    const [tvlData, pointsData] = await Promise.all([
      fetchTvlData(),
      fetchPointsData(),
    ]);

    // Build the snapshot
    const now = new Date();
    const snapshot = {
      capturedAt: now.toISOString(),
      capturedAtUnix: Math.floor(now.getTime() / 1000),
      summary: {
        s1RewardsIssued: pointsData.s1RewardsIssued || 0,
        participantCount: pointsData.participantCount || 0,
        totalTvl: tvlData.summary?.totalTvl || 0,
        weightedTvl: tvlData.summary?.weightedTvl || 0,
        estDailyPoints: tvlData.summary?.estDailyPoints || 0,
        estWeeklyPoints: tvlData.summary?.estWeeklyPoints || 0,
        estMonthlyPoints: tvlData.summary?.estMonthlyPoints || 0,
      },
      tableCondensed: tvlData.table?.map(row => ({
        category: row.category,
        tvl: row.tvl,
        boost: row.boost,
        weightedTvl: row.weightedTvl,
        estDailyPoints: row.estDailyPoints,
        estWeeklyPoints: row.estWeeklyPoints,
        estMonthlyPoints: row.estMonthlyPoints,
        shareOfWeightedTvl: row.shareOfWeightedTvl,
      })) || [],
    };

    console.log(`[${new Date().toISOString()}] Snapshot built:`);
    console.log(`  - Total TVL: $${(snapshot.summary.totalTvl / 1e6).toFixed(2)}M`);
    console.log(`  - Weighted TVL: ${(snapshot.summary.weightedTvl / 1e9).toFixed(2)}B`);
    console.log(`  - S1 Rewards: ${(snapshot.summary.s1RewardsIssued / 1e9).toFixed(2)}B`);
    console.log(`  - Participants: ${snapshot.summary.participantCount}`);
    console.log(`  - Categories: ${snapshot.tableCondensed.length}`);

    // Save to Supabase (prefer direct connection, fallback to API)
    if (supabase) {
      await saveToSupabase(snapshot);
    } else if (CRON_SECRET) {
      await saveViaApi(snapshot);
    } else {
      console.error('Error: No save method available. Set SUPABASE_SERVICE_ROLE_KEY or CRON_SECRET');
      process.exit(1);
    }

    console.log('='.repeat(60));
    console.log(`[${new Date().toISOString()}] Snapshot capture completed successfully!`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error capturing snapshot:`, error.message);
    process.exit(1);
  }
}

// Run the script
main();
