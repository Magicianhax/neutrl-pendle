/**
 * TVL Data Capture Script
 * Run with: node capture-tvl-data.js
 * 
 * Saves data to data/tvl-history.json with timestamps
 */

const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const DATA_DIR = path.join(__dirname, 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'tvl-history.json');

// TVL Categories definition (same as tvlData.ts)
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
      { id: "hold-upnusd", name: "Hold upNUSD", type: "row", status: "active", boost: 18 },
    ],
  },
];

// Helper function to format large numbers
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

// Calculate row data from TVL API response (same logic as TvlTable.tsx)
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

    // YT NUSD - 1 YT = 1 underlying token for points
    const ytNusdTvl = nusdData.ytTotalSupply * nusdData.underlyingPrice;
    rowData["yt-nusd-feb26"].tvlAmount = ytNusdTvl;

    // Pendle Fee (5% of YT)
    const feeNusd = ytNusdTvl * 0.05;
    rowData["pendle-fee-nusd"].tvlAmount = feeNusd;

    // YT NUSD NET (95% of YT)
    const netNusd = ytNusdTvl * 0.95;
    rowData["yt-nusd-feb26-net"].tvlAmount = netNusd;

    // LP NUSD - Full SY TVL (display only)
    rowData["lp-nusd-feb26"].tvlAmount = nusdData.lpSyTvl;

    // LP Excluded (20% of SY) - doesn't earn points
    rowData["lp-excluded-nusd"].tvlAmount = nusdData.lpSyTvl * 0.2;

    // LP NET (80% of SY) - THIS earns points
    rowData["lp-nusd-feb26-net"].tvlAmount = nusdData.lpSyTvl * 0.8;

    // PT NUSD - use PT total supply × PT price for TVL
    const ptNusdTvl = nusdData.ptTotalSupply * nusdData.ptPrice;
    rowData["pt-nusd-feb26"].tvlAmount = ptNusdTvl;

    // Hold NUSD - circulating supply (outside Pendle) × price
    rowData["hold-nusd"].tvlAmount = nusdData.holdTvl;
  }

  // sNUSD Market Data
  if (tvlData.snusd) {
    const snusdData = tvlData.snusd;

    // YT sNUSD
    const ytSnusdTvl = snusdData.ytTotalSupply * snusdData.underlyingPrice;
    rowData["yt-snusd-mar26"].tvlAmount = ytSnusdTvl;

    // Pendle Fee (5% of YT)
    const feeSnusd = ytSnusdTvl * 0.05;
    rowData["pendle-fee-snusd"].tvlAmount = feeSnusd;

    // YT sNUSD NET (95% of YT)
    const netSnusd = ytSnusdTvl * 0.95;
    rowData["yt-snusd-mar26-net"].tvlAmount = netSnusd;

    // LP sNUSD - Full SY TVL (display only)
    rowData["lp-snusd-mar26"].tvlAmount = snusdData.lpSyTvl;

    // LP Excluded (20% of SY) - doesn't earn points
    rowData["lp-excluded-snusd"].tvlAmount = snusdData.lpSyTvl * 0.2;

    // LP NET (80% of SY) - THIS earns points
    rowData["lp-snusd-mar26-net"].tvlAmount = snusdData.lpSyTvl * 0.8;

    // PT sNUSD
    const ptSnusdTvl = snusdData.ptTotalSupply * snusdData.ptPrice;
    rowData["pt-snusd-mar26"].tvlAmount = ptSnusdTvl;

    // Hold sNUSD
    rowData["hold-snusd"].tvlAmount = snusdData.holdTvl;
  }

  // upNUSD (K3 protocol)
  if (tvlData.upnusd) {
    rowData["hold-upnusd"].tvlAmount = tvlData.upnusd.tvl;
  }

  // Curve NUSD-USDC LP
  if (tvlData.curve) {
    rowData["hold-curve-lp"].tvlAmount = tvlData.curve.unlockedTvl;
    rowData["curve-nusd-breakdown"].tvlAmount = tvlData.curve.nusdTvl;
    rowData["curve-usdc-breakdown"].tvlAmount = tvlData.curve.usdcTvl;
  }

  // Lock contract data
  if (tvlData.locks) {
    // NUSD locks
    rowData["lock-nusd-3mo"].tvlAmount = tvlData.locks.nusd.buckets["3mo"].tvl;
    rowData["lock-nusd-6mo"].tvlAmount = tvlData.locks.nusd.buckets["6mo"].tvl;
    rowData["lock-nusd-9mo"].tvlAmount = tvlData.locks.nusd.buckets["9mo"].tvl;
    rowData["lock-nusd-12mo"].tvlAmount = tvlData.locks.nusd.buckets["12mo"].tvl;

    // sNUSD locks
    rowData["lock-snusd-3mo"].tvlAmount = tvlData.locks.snusd.buckets["3mo"].tvl;
    rowData["lock-snusd-6mo"].tvlAmount = tvlData.locks.snusd.buckets["6mo"].tvl;
    rowData["lock-snusd-9mo"].tvlAmount = tvlData.locks.snusd.buckets["9mo"].tvl;
    rowData["lock-snusd-12mo"].tvlAmount = tvlData.locks.snusd.buckets["12mo"].tvl;

    // Curve LP locks
    rowData["lock-curve-3mo"].tvlAmount = tvlData.locks.curveLp.buckets["3mo"].tvl;
    rowData["lock-curve-6mo"].tvlAmount = tvlData.locks.curveLp.buckets["6mo"].tvl;
  }

  // Calculate weighted TVL and daily points for each row
  let totalWeightedTvl = 0;

  Object.values(rowData).forEach(row => {
    if (row.status === "excluded") {
      row.weightedTvl = 0;
      row.dailyPoints = 0;
    } else {
      const effectiveBoost = row.baseBoost ? row.baseBoost * row.boost : row.boost;
      row.weightedTvl = row.tvlAmount * effectiveBoost;
      row.dailyPoints = row.weightedTvl; // 1 weighted TVL = 1 daily point
    }

    // Only count active and locked in totals
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

// Calculate summary data
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

// Format table data for easy viewing
function formatTableData(rowData) {
  const table = [];

  TVL_CATEGORIES.forEach(cat => {
    // Add category header
    table.push({
      category: cat.title,
      rows: cat.rows.map(row => {
        const data = rowData[row.id];
        return {
          id: row.id,
          name: data.name,
          tvlAmount: data.tvlAmount,
          tvlAmountFormatted: "$" + formatNumber(data.tvlAmount),
          boost: data.baseBoost ? `${data.baseBoost}x × ${data.boost}x = ${data.baseBoost * data.boost}x` : `${data.boost}x`,
          weightedTvl: data.weightedTvl,
          weightedTvlFormatted: "$" + formatNumber(data.weightedTvl),
          dailyPoints: data.dailyPoints,
          dailyPointsFormatted: formatNumber(data.dailyPoints),
          share: data.share,
          shareFormatted: data.share.toFixed(2) + "%",
          status: data.status,
        };
      }),
    });
  });

  return table;
}

// Main capture function
async function captureData() {
  console.log("🚀 Starting TVL data capture...");
  console.log("📅 Time:", new Date().toISOString());
  console.log("🔗 Base URL:", BASE_URL);
  console.log("");

  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log("📁 Created data directory:", DATA_DIR);
  }

  try {
    // Fetch TVL data
    console.log("📊 Fetching TVL data...");
    const tvlResponse = await fetch(`${BASE_URL}/api/tvl`);
    if (!tvlResponse.ok) {
      throw new Error(`TVL API error: ${tvlResponse.status}`);
    }
    const tvlData = await tvlResponse.json();
    console.log("✅ TVL data fetched");

    // Fetch points data
    console.log("📊 Fetching points data...");
    let pointsData = null;
    try {
      const pointsResponse = await fetch(`${BASE_URL}/api/points`);
      if (pointsResponse.ok) {
        pointsData = await pointsResponse.json();
        console.log("✅ Points data fetched");
      } else {
        console.warn("⚠️ Points API returned error:", pointsResponse.status);
      }
    } catch (err) {
      console.warn("⚠️ Could not fetch points data:", err.message);
    }

    // Calculate row data
    const rowData = calculateRowData(tvlData);

    // Calculate summary
    const summary = calculateSummary(rowData, pointsData);

    // Format table data
    const tableData = formatTableData(rowData);

    // Build snapshot object
    const snapshot = {
      capturedAt: new Date().toISOString(),
      capturedAtUnix: Math.floor(Date.now() / 1000),
      summary: summary,
      table: tableData,
      rawData: {
        tvl: tvlData,
        points: pointsData,
      },
    };

    // Append to history file
    let history = [];
    if (fs.existsSync(HISTORY_FILE)) {
      try {
        history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
      } catch (err) {
        console.warn("⚠️ Could not parse history file, starting fresh");
        history = [];
      }
    }

    // Add this snapshot to history (without rawData to save space)
    history.push({
      capturedAt: snapshot.capturedAt,
      capturedAtUnix: snapshot.capturedAtUnix,
      summary: snapshot.summary,
      // Include condensed table data
      tableCondensed: tableData.map(cat => ({
        category: cat.category,
        rows: cat.rows.map(row => ({
          id: row.id,
          tvlAmount: row.tvlAmount,
          weightedTvl: row.weightedTvl,
          dailyPoints: row.dailyPoints,
          share: row.share,
        })),
      })),
    });

    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
    console.log("📜 Appended to history file:", HISTORY_FILE);
    console.log("📈 History now has", history.length, "snapshots");

    // Print summary
    console.log("");
    console.log("═══════════════════════════════════════════════════════════");
    console.log("                    CAPTURE SUMMARY                        ");
    console.log("═══════════════════════════════════════════════════════════");
    console.log("");
    console.log("  S1 Rewards Issued:", summary.s1RewardsIssuedFormatted);
    console.log("  Total TVL:        $" + summary.totalTvlFormatted);
    console.log("  Weighted TVL:     $" + summary.weightedTvlFormatted);
    console.log("  Est. Daily Points:", summary.estDailyPointsFormatted);
    console.log("  Est. Weekly Points:", summary.estWeeklyPointsFormatted);
    console.log("  Est. Monthly Points:", summary.estMonthlyPointsFormatted);
    console.log("");
    console.log("═══════════════════════════════════════════════════════════");
    console.log("");
    console.log("✅ Data capture completed successfully!");

    return snapshot;

  } catch (error) {
    console.error("❌ Error capturing data:", error.message);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  captureData()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error("Fatal error:", error);
      process.exit(1);
    });
}

module.exports = { captureData };

