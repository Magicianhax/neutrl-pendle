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
const path = require('path');
const fs = require('fs');

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

// Calculation functions (same logic as capture-tvl-data.js)

// TVL Categories definition (same as capture-tvl-data.js)
const TVL_CATEGORIES = [
  {
    id: "feb-2026",
    title: "FEBRUARY 26, 2026 MARKET [ACTIVE]",
    rows: [
      { id: "yt-nusd-feb26", name: "YT NUSD Feb 26 (Gross)", type: "row", status: "display", boost: 50 },
      { id: "pendle-fee-nusd", name: "Pendle Fee (5%)", type: "subrow", status: "active", boost: 50 },
      { id: "yt-nusd-feb26-net", name: "YT NUSD Feb 26 NET", type: "subrow", status: "active", boost: 50 },
      { id: "lp-nusd-feb26", name: "LP NUSD Feb 26 (SY Portion)", type: "row", status: "display", boost: 50 },
      { id: "lp-excluded-nusd", name: "Excluded (20%)", type: "subrow", status: "display", boost: 0 },
      { id: "lp-nusd-feb26-net", name: "LP NUSD Feb 26 (80%)", type: "subrow", status: "active", boost: 50 },
      { id: "pt-nusd-feb26", name: "PT NUSD Feb 26", type: "row", status: "excluded" },
    ],
  },
  {
    id: "mar-2026",
    title: "MARCH 5, 2026 MARKET [ACTIVE]",
    rows: [
      { id: "yt-snusd-mar26", name: "YT sNUSD Mar 5 (Gross)", type: "row", status: "display", boost: 25 },
      { id: "pendle-fee-snusd", name: "Pendle Fee (5%)", type: "subrow", status: "active", boost: 25 },
      { id: "yt-snusd-mar26-net", name: "YT sNUSD Mar 5 NET", type: "subrow", status: "active", boost: 25 },
      { id: "lp-snusd-mar26", name: "LP sNUSD Mar 5 (SY Portion)", type: "row", status: "display", boost: 25 },
      { id: "lp-excluded-snusd", name: "Excluded (20%)", type: "subrow", status: "display", boost: 0 },
      { id: "lp-snusd-mar26-net", name: "LP sNUSD Mar 5 (80%)", type: "subrow", status: "active", boost: 25 },
      { id: "pt-snusd-mar26", name: "PT sNUSD Mar 5", type: "row", status: "excluded" },
    ],
  },
  {
    id: "hold",
    title: "HOLD",
    rows: [
      { id: "hold-nusd", name: "Hold NUSD (unlocked)", type: "row", status: "active", boost: 5 },
      { id: "lock-nusd-3mo", name: "Lock NUSD (3 mo)", type: "subrow", status: "locked", boost: 6, baseBoost: 5 },
      { id: "lock-nusd-6mo", name: "Lock NUSD (6 mo)", type: "subrow", status: "locked", boost: 15, baseBoost: 5 },
      { id: "lock-nusd-9mo", name: "Lock NUSD (9 mo)", type: "subrow", status: "locked", boost: 25, baseBoost: 5 },
      { id: "lock-nusd-12mo", name: "Lock NUSD (12 mo)", type: "subrow", status: "locked", boost: 30, baseBoost: 5 },
      { id: "hold-snusd", name: "Hold sNUSD (unlocked)", type: "row", status: "active", boost: 1 },
      { id: "lock-snusd-3mo", name: "Lock sNUSD (3 mo)", type: "subrow", status: "locked", boost: 8, baseBoost: 1 },
      { id: "lock-snusd-6mo", name: "Lock sNUSD (6 mo)", type: "subrow", status: "locked", boost: 20, baseBoost: 1 },
      { id: "lock-snusd-9mo", name: "Lock sNUSD (9 mo)", type: "subrow", status: "locked", boost: 30, baseBoost: 1 },
      { id: "lock-snusd-12mo", name: "Lock sNUSD (12 mo)", type: "subrow", status: "locked", boost: 40, baseBoost: 1 },
      { id: "hold-curve-lp", name: "Curve LP (unlocked)", type: "row", status: "active", boost: 5 },
      { id: "curve-nusd-breakdown", name: "NUSD in pool", type: "subrow", status: "display", boost: 5 },
      { id: "curve-usdc-breakdown", name: "USDC in pool", type: "subrow", status: "display", boost: 5 },
      { id: "lock-curve-3mo", name: "Lock Curve LP (3 mo)", type: "subrow", status: "locked", boost: 4, baseBoost: 5 },
      { id: "lock-curve-6mo", name: "Lock Curve LP (5-6 mo Max)", type: "subrow", status: "locked", boost: 10, baseBoost: 5 },
      { id: "hold-upnusd", name: "Hold upNUSD", type: "row", status: "active", boost: 28 },
    ],
  },
];

function formatNumber(value, decimals = 2) {
  if (value >= 1_000_000_000) {
    return (value / 1_000_000_000).toFixed(decimals) + "B";
  }
  if (value >= 1_000_000) {
    return (value / 1_000_000).toFixed(decimals) + "M";
  }
  if (value >= 1_000) {
    return (value / 1_000).toFixed(decimals) + "K";
  }
  return value.toFixed(decimals);
}

function calculateRowData(tvlData) {
  const rowData = {};

  // Initialize all rows
  TVL_CATEGORIES.forEach(cat => {
    cat.rows.forEach(row => {
      rowData[row.id] = {
        id: row.id,
        name: row.name,
        tvlAmount: 0,
        boost: row.boost || 0,
        baseBoost: row.baseBoost || 1,
        status: row.status,
        type: row.type,
        weightedTvl: 0,
        dailyPoints: 0,
        share: 0,
      };
    });
  });

  // NUSD Market Data
  if (tvlData.nusd) {
    const nusdData = tvlData.nusd;
    const ytNusdTvl = nusdData.ytTotalSupply * nusdData.underlyingPrice;
    rowData["yt-nusd-feb26"].tvlAmount = ytNusdTvl;
    rowData["pendle-fee-nusd"].tvlAmount = ytNusdTvl * 0.05;
    rowData["yt-nusd-feb26-net"].tvlAmount = ytNusdTvl * 0.95;
    rowData["lp-nusd-feb26"].tvlAmount = nusdData.lpSyTvl;
    rowData["lp-excluded-nusd"].tvlAmount = nusdData.lpSyTvl * 0.2;
    rowData["lp-nusd-feb26-net"].tvlAmount = nusdData.lpSyTvl * 0.8;
    const ptNusdTvl = nusdData.ptTotalSupply * nusdData.ptPrice;
    rowData["pt-nusd-feb26"].tvlAmount = ptNusdTvl;
    rowData["hold-nusd"].tvlAmount = nusdData.holdTvl;
  }

  // sNUSD Market Data
  if (tvlData.snusd) {
    const snusdData = tvlData.snusd;
    const ytSnusdTvl = snusdData.ytTotalSupply * snusdData.underlyingPrice;
    rowData["yt-snusd-mar26"].tvlAmount = ytSnusdTvl;
    rowData["pendle-fee-snusd"].tvlAmount = ytSnusdTvl * 0.05;
    rowData["yt-snusd-mar26-net"].tvlAmount = ytSnusdTvl * 0.95;
    rowData["lp-snusd-mar26"].tvlAmount = snusdData.lpSyTvl;
    rowData["lp-excluded-snusd"].tvlAmount = snusdData.lpSyTvl * 0.2;
    rowData["lp-snusd-mar26-net"].tvlAmount = snusdData.lpSyTvl * 0.8;
    const ptSnusdTvl = snusdData.ptTotalSupply * snusdData.ptPrice;
    rowData["pt-snusd-mar26"].tvlAmount = ptSnusdTvl;
    rowData["hold-snusd"].tvlAmount = snusdData.holdTvl;
  }

  // upNUSD
  if (tvlData.upnusd) {
    rowData["hold-upnusd"].tvlAmount = tvlData.upnusd.tvl;
  }

  // Curve LP
  if (tvlData.curve) {
    rowData["hold-curve-lp"].tvlAmount = tvlData.curve.unlockedTvl;
    rowData["curve-nusd-breakdown"].tvlAmount = tvlData.curve.nusdTvl;
    rowData["curve-usdc-breakdown"].tvlAmount = tvlData.curve.usdcTvl;
  }

  // Lock contract data
  if (tvlData.locks) {
    rowData["lock-nusd-3mo"].tvlAmount = tvlData.locks.nusd.buckets["3mo"].tvl;
    rowData["lock-nusd-6mo"].tvlAmount = tvlData.locks.nusd.buckets["6mo"].tvl;
    rowData["lock-nusd-9mo"].tvlAmount = tvlData.locks.nusd.buckets["9mo"].tvl;
    rowData["lock-nusd-12mo"].tvlAmount = tvlData.locks.nusd.buckets["12mo"].tvl;
    rowData["lock-snusd-3mo"].tvlAmount = tvlData.locks.snusd.buckets["3mo"].tvl;
    rowData["lock-snusd-6mo"].tvlAmount = tvlData.locks.snusd.buckets["6mo"].tvl;
    rowData["lock-snusd-9mo"].tvlAmount = tvlData.locks.snusd.buckets["9mo"].tvl;
    rowData["lock-snusd-12mo"].tvlAmount = tvlData.locks.snusd.buckets["12mo"].tvl;
    rowData["lock-curve-3mo"].tvlAmount = tvlData.locks.curveLp.buckets["3mo"].tvl;
    rowData["lock-curve-6mo"].tvlAmount = tvlData.locks.curveLp.buckets["6mo"].tvl;
  }

  // Calculate weighted TVL and daily points
  let totalWeightedTvl = 0;
  Object.values(rowData).forEach(row => {
    if (row.status === "excluded") {
      row.weightedTvl = 0;
      row.dailyPoints = 0;
    } else {
      const effectiveBoost = row.baseBoost ? row.baseBoost * row.boost : row.boost;
      row.weightedTvl = row.tvlAmount * effectiveBoost;
      row.dailyPoints = row.weightedTvl;
    }
    if (row.status === "active" || row.status === "locked") {
      totalWeightedTvl += row.weightedTvl;
    }
  });

  // Calculate share percentages
  Object.values(rowData).forEach(row => {
    if (totalWeightedTvl > 0 && (row.status === "active" || row.status === "locked")) {
      row.share = (row.weightedTvl / totalWeightedTvl) * 100;
    } else {
      row.share = 0;
    }
  });

  return rowData;
}

function calculateSummary(rowData, pointsData) {
  let totalRawTvl = 0;
  let totalWeightedTvl = 0;

  Object.values(rowData).forEach(row => {
    if (row.status === "active" || row.status === "locked") {
      totalRawTvl += row.tvlAmount;
      totalWeightedTvl += row.weightedTvl;
    }
  });

  return {
    s1RewardsIssued: pointsData?.totalPoints || 0,
    s1RewardsIssuedFormatted: pointsData?.totalPointsFormatted || "N/A",
    participantCount: pointsData?.participantCount || 0,
    totalTvl: totalRawTvl,
    totalTvlFormatted: formatNumber(totalRawTvl),
    weightedTvl: totalWeightedTvl,
    weightedTvlFormatted: formatNumber(totalWeightedTvl),
    estDailyPoints: totalWeightedTvl,
    estDailyPointsFormatted: formatNumber(totalWeightedTvl),
    estWeeklyPoints: totalWeightedTvl * 7,
    estWeeklyPointsFormatted: formatNumber(totalWeightedTvl * 7),
    estMonthlyPoints: totalWeightedTvl * 30,
    estMonthlyPointsFormatted: formatNumber(totalWeightedTvl * 30),
  };
}

function formatTableData(rowData) {
  const table = [];
  TVL_CATEGORIES.forEach(cat => {
    table.push({
      category: cat.title,
      rows: cat.rows.map(row => {
        const data = rowData[row.id];
        return {
          id: data.id,
          tvlAmount: data.tvlAmount,
          weightedTvl: data.weightedTvl,
          dailyPoints: data.dailyPoints,
          share: data.share,
        };
      }),
    });
  });
  return table;
}

async function main() {
  console.log('='.repeat(60));
  console.log(`[${new Date().toISOString()}] Starting TVL Snapshot Capture`);
  console.log('='.repeat(60));

  try {
    // Fetch TVL data (required)
    const tvlData = await fetchTvlData();

    // Fetch points data (optional - continue if it fails)
    let pointsData = null;
    try {
      pointsData = await fetchPointsData();
    } catch (pointsError) {
      console.warn(`[${new Date().toISOString()}] Warning: Failed to fetch points data:`, pointsError.message);
      console.warn(`[${new Date().toISOString()}] Continuing with snapshot using null points data...`);
    }

    // Calculate row data using the same logic as capture-tvl-data.js
    const rowData = calculateRowData(tvlData);
    
    // Calculate summary
    const summary = calculateSummary(rowData, pointsData);
    
    // Format table data
    const tableData = formatTableData(rowData);

    // Build the snapshot (matching tvl-history.json structure)
    const now = new Date();
    const snapshot = {
      capturedAt: now.toISOString(),
      capturedAtUnix: Math.floor(now.getTime() / 1000),
      summary: summary,
      tableCondensed: tableData,
    };

    console.log(`[${new Date().toISOString()}] Snapshot built:`);
    console.log(`  - Total TVL: $${summary.totalTvlFormatted}`);
    console.log(`  - Weighted TVL: $${summary.weightedTvlFormatted}`);
    console.log(`  - S1 Rewards: ${summary.s1RewardsIssuedFormatted}`);
    console.log(`  - Participants: ${summary.participantCount}`);
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
