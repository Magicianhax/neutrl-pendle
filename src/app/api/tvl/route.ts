import { NextResponse } from "next/server";

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;
const ETHERSCAN_API_BASE = "https://api.etherscan.io/v2/api";
const PENDLE_API_BASE = "https://api-v2.pendle.finance";
const CHAIN_ID = 1;

// Lock contract
const LOCK_CONTRACT = "0x99161BA892ECae335616624c84FAA418F64FF9A6";

// Known event topic hash for AssetLocked
const ASSET_LOCKED_TOPIC = "0x268464d6ecafe069c26e10a65fd45bb8ab70b43c6d40afb2423a6b47af771a55";

// Contract addresses for NUSD market
const NUSD_CONTRACTS = {
  market: "0x6d520a943a4da0784917a2e71defe95248a1daa1",
  sy: "0x29ac34026c369d21fe3b2c7735ec986e2880b347",      // SY-NUSD
  pt: "0x215a6a2a0d1c563d0cb55ebd8d126f3bc0b92cf2",      // PT-NUSD-26FEB2026
  yt: "0x38fdf2dbaae0e1e42499a4c6dfecae3b5cb35c59",      // YT-NUSD-26FEB2026
  underlying: "0xe556aba6fe6036275ec1f87eda296be72c811bce", // NUSD
};

// Contract addresses for sNUSD market
const SNUSD_CONTRACTS = {
  market: "0x6d8c4de7071d5aee27fc3a810764e62a4a00ceb9",
  sy: "0x10c5e7711eaddc1b6b64e40ef1976fc462666409",      // SY-sNUSD
  pt: "0x54bf2659b5cdfd86b75920e93c0844c0364f5166",      // PT-sNUSD-5MAR2026
  yt: "0x08903411e7a3eb500e30aac3bdd44775055b8c00",      // YT-sNUSD-5MAR2026
  underlying: "0x08efcc2f3e61185d0ea7f8830b3fec9bfa2ee313", // sNUSD
};

// upNUSD contract (K3 protocol)
const UPNUSD_CONTRACT = "0xd852a101B7C6e0C647C8418A763394A37Dd72bCa";

// Curve NUSD-USDC pool
const CURVE_POOL = "0x7E19F0253A564e026C63eeAA9338d6DBddeF3b09";
const USDC_CONTRACT = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

// Helper function to add delay between requests
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Fetch token total supply from Etherscan
async function getTokenTotalSupply(contractAddress: string, decimals: number = 18): Promise<number | null> {
  try {
    const url = `${ETHERSCAN_API_BASE}?chainid=1&module=stats&action=tokensupply&contractaddress=${contractAddress}&apikey=${ETHERSCAN_API_KEY}`;
    const response = await fetch(url, { cache: "no-store" });
    const data = await response.json();

    if (data.status === "1" && data.result) {
      return parseFloat(data.result) / Math.pow(10, decimals);
    }
    console.error(`Error fetching token supply for ${contractAddress}:`, data.message);
    return null;
  } catch (error) {
    console.error(`Error fetching token supply for ${contractAddress}:`, error);
    return null;
  }
}

// Fetch token balance at a specific address from Etherscan
async function getTokenBalance(tokenAddress: string, holderAddress: string, decimals: number = 18): Promise<number | null> {
  try {
    const url = `${ETHERSCAN_API_BASE}?chainid=1&module=account&action=tokenbalance&contractaddress=${tokenAddress}&address=${holderAddress}&tag=latest&apikey=${ETHERSCAN_API_KEY}`;
    const response = await fetch(url, { cache: "no-store" });
    const data = await response.json();

    if (data.status === "1" && data.result) {
      return parseFloat(data.result) / Math.pow(10, decimals);
    }
    console.error(`Error fetching token balance:`, data.message);
    return null;
  } catch (error) {
    console.error(`Error fetching token balance:`, error);
    return null;
  }
}

// Fetch Pendle market data
async function getPendleMarketData(marketAddress: string) {
  try {
    const response = await fetch(
      `${PENDLE_API_BASE}/core/v1/${CHAIN_ID}/markets/${marketAddress}`,
      {
        headers: { "Content-Type": "application/json" },
        next: { revalidate: 60 },
      }
    );

    if (!response.ok) {
      throw new Error(`Pendle API error: ${response.status}`);
    }

    const data = await response.json();

    return {
      totalLp: data.totalLp || 0,
      totalPt: data.totalPt || 0,
      totalSy: data.totalSy || 0,
      totalActiveSupply: data.totalActiveSupply || 0,
      liquidity: data.liquidity?.usd || 0,
      lpPrice: data.lp?.price?.usd || 0,
      ptPrice: data.pt?.price?.usd || 0,
      ytPrice: data.yt?.price?.usd || 0,
      syPrice: data.sy?.price?.usd || 0,
      underlyingPrice: data.underlyingAsset?.price?.usd || 1,
      impliedApy: data.impliedApy || 0,
      underlyingApy: data.underlyingApy || 0,
    };
  } catch (error) {
    console.error(`Error fetching Pendle market data for ${marketAddress}:`, error);
    return null;
  }
}

// Lock duration buckets interface
interface LockBucket {
  count: number;
  amount: number;
}

interface AssetLockData {
  totalLocked: number;
  buckets: {
    "3mo": LockBucket;       // 90-179 days
    "6mo": LockBucket;       // 180-269 days
    "9mo": LockBucket;       // 270-364 days
    "12mo": LockBucket;      // 365+ days
  };
}

// Curve LP has different buckets (max 6 months)
interface CurveLpLockData {
  totalLocked: number;
  buckets: {
    "3mo": LockBucket;       // 90-149 days
    "6mo": LockBucket;       // 150+ days (max)
  };
}

// Fetch lock events from the lock contract
async function getLockData(): Promise<{
  nusd: AssetLockData;
  snusd: AssetLockData;
  curveLp: CurveLpLockData;
} | null> {
  try {
    const url = `${ETHERSCAN_API_BASE}?chainid=1&module=logs&action=getLogs&address=${LOCK_CONTRACT}&topic0=${ASSET_LOCKED_TOPIC}&fromBlock=0&toBlock=latest&page=1&offset=1000&apikey=${ETHERSCAN_API_KEY}`;
    const response = await fetch(url, { cache: "no-store" });
    const data = await response.json();

    if (data.status !== "1" || !data.result) {
      console.error("Error fetching lock events:", data.message);
      return null;
    }

    const now = Math.floor(Date.now() / 1000);

    // Initialize data structures for NUSD/sNUSD (4 buckets)
    const createEmptyAssetData = (): AssetLockData => ({
      totalLocked: 0,
      buckets: {
        "3mo": { count: 0, amount: 0 },   // 90-179 days
        "6mo": { count: 0, amount: 0 },   // 180-269 days
        "9mo": { count: 0, amount: 0 },   // 270-364 days
        "12mo": { count: 0, amount: 0 },  // 365+ days
      },
    });

    // Initialize data structures for Curve LP (2 buckets, max 6 months)
    const createEmptyCurveLpData = (): CurveLpLockData => ({
      totalLocked: 0,
      buckets: {
        "3mo": { count: 0, amount: 0 },   // 90-149 days
        "6mo": { count: 0, amount: 0 },   // 150+ days (max)
      },
    });

    const nusdData = createEmptyAssetData();
    const snusdData = createEmptyAssetData();
    const curveLpData = createEmptyCurveLpData();

    // Asset topic hashes (lowercase, padded to 64 chars)
    const nusdTopic = "0x" + NUSD_CONTRACTS.underlying.replace("0x", "").toLowerCase().padStart(64, "0");
    const snusdTopic = "0x" + SNUSD_CONTRACTS.underlying.replace("0x", "").toLowerCase().padStart(64, "0");
    const curveLpTopic = "0x" + CURVE_POOL.replace("0x", "").toLowerCase().padStart(64, "0");

    // Process each event
    for (const log of data.result) {
      // Get asset from topic2
      const assetTopic = log.topics[2]?.toLowerCase();
      if (!assetTopic) continue;

      // Decode amount and unlock time from data
      const amount = Number(BigInt("0x" + log.data.slice(2, 66))) / 1e18;
      const unlockTime = Number(BigInt("0x" + log.data.slice(66, 130)));
      const blockTime = Number(log.timeStamp);
      const lockDurationDays = Math.round((unlockTime - blockTime) / 86400);

      // Skip expired locks
      if (unlockTime <= now) continue;

      // Process NUSD locks
      if (assetTopic === nusdTopic) {
        nusdData.totalLocked += amount;
        if (lockDurationDays >= 90 && lockDurationDays < 180) {
          nusdData.buckets["3mo"].count++;
          nusdData.buckets["3mo"].amount += amount;
        } else if (lockDurationDays >= 180 && lockDurationDays < 270) {
          nusdData.buckets["6mo"].count++;
          nusdData.buckets["6mo"].amount += amount;
        } else if (lockDurationDays >= 270 && lockDurationDays < 365) {
          nusdData.buckets["9mo"].count++;
          nusdData.buckets["9mo"].amount += amount;
        } else if (lockDurationDays >= 365) {
          nusdData.buckets["12mo"].count++;
          nusdData.buckets["12mo"].amount += amount;
        }
      }
      // Process sNUSD locks
      else if (assetTopic === snusdTopic) {
        snusdData.totalLocked += amount;
        if (lockDurationDays >= 90 && lockDurationDays < 180) {
          snusdData.buckets["3mo"].count++;
          snusdData.buckets["3mo"].amount += amount;
        } else if (lockDurationDays >= 180 && lockDurationDays < 270) {
          snusdData.buckets["6mo"].count++;
          snusdData.buckets["6mo"].amount += amount;
        } else if (lockDurationDays >= 270 && lockDurationDays < 365) {
          snusdData.buckets["9mo"].count++;
          snusdData.buckets["9mo"].amount += amount;
        } else if (lockDurationDays >= 365) {
          snusdData.buckets["12mo"].count++;
          snusdData.buckets["12mo"].amount += amount;
        }
      }
      // Process Curve LP locks (max 6 months, 150+ days = max boost)
      else if (assetTopic === curveLpTopic) {
        curveLpData.totalLocked += amount;
        if (lockDurationDays >= 90 && lockDurationDays < 150) {
          curveLpData.buckets["3mo"].count++;
          curveLpData.buckets["3mo"].amount += amount;
        } else if (lockDurationDays >= 150) {
          curveLpData.buckets["6mo"].count++;
          curveLpData.buckets["6mo"].amount += amount;
        }
      }
    }

    console.log(`📊 Lock data: NUSD=${nusdData.totalLocked.toFixed(0)}, sNUSD=${snusdData.totalLocked.toFixed(0)}, CurveLP=${curveLpData.totalLocked.toFixed(0)}`);

    return {
      nusd: nusdData,
      snusd: snusdData,
      curveLp: curveLpData,
    };
  } catch (error) {
    console.error("Error fetching lock data:", error);
    return null;
  }
}

export async function GET() {
  if (!ETHERSCAN_API_KEY) {
    return NextResponse.json(
      { error: "Etherscan API key not configured" },
      { status: 500 }
    );
  }

  try {
    console.log("🚀 Fetching TVL data...");

    // Fetch Pendle market data first (no rate limiting concerns)
    const [nusdMarket, snusdMarket] = await Promise.all([
      getPendleMarketData(NUSD_CONTRACTS.market),
      getPendleMarketData(SNUSD_CONTRACTS.market),
    ]);

    // Fetch all Etherscan data with delays to avoid rate limiting (free tier: 5 calls/sec)
    const RATE_LIMIT_DELAY = 300; // 300ms between calls = ~3.3 calls/sec

    // Fetch YT total supplies from Etherscan
    console.log("🔍 Fetching YT supplies...");
    const ytNusdSupply = await getTokenTotalSupply(NUSD_CONTRACTS.yt, 18);
    await delay(RATE_LIMIT_DELAY);

    const ytSnusdSupply = await getTokenTotalSupply(SNUSD_CONTRACTS.yt, 18);
    await delay(RATE_LIMIT_DELAY);

    // Fetch SY balances (underlying locked in Pendle) - this is the key metric
    console.log("🔍 Fetching SY underlying balances...");
    const syNusdBalance = await getTokenBalance(NUSD_CONTRACTS.underlying, NUSD_CONTRACTS.sy, 18);
    await delay(RATE_LIMIT_DELAY);

    const sySnusdBalance = await getTokenBalance(SNUSD_CONTRACTS.underlying, SNUSD_CONTRACTS.sy, 18);
    await delay(RATE_LIMIT_DELAY);

    // Fetch PT total supplies
    console.log("🔍 Fetching PT supplies...");
    const ptNusdSupply = await getTokenTotalSupply(NUSD_CONTRACTS.pt, 18);
    await delay(RATE_LIMIT_DELAY);

    const ptSnusdSupply = await getTokenTotalSupply(SNUSD_CONTRACTS.pt, 18);
    await delay(RATE_LIMIT_DELAY);

    // Fetch underlying token total supplies (for Hold calculations)
    console.log("🔍 Fetching underlying token total supplies...");
    const nusdTotalSupply = await getTokenTotalSupply(NUSD_CONTRACTS.underlying, 18);
    await delay(RATE_LIMIT_DELAY);

    const snusdTotalSupply = await getTokenTotalSupply(SNUSD_CONTRACTS.underlying, 18);
    await delay(RATE_LIMIT_DELAY);

    // Fetch upNUSD total supply
    console.log("🔍 Fetching upNUSD total supply...");
    const upnusdTotalSupply = await getTokenTotalSupply(UPNUSD_CONTRACT, 18);
    await delay(RATE_LIMIT_DELAY);

    // Fetch Curve pool balances (NUSD and USDC)
    console.log("🔍 Fetching Curve pool balances...");
    const curveNusdBalance = await getTokenBalance(NUSD_CONTRACTS.underlying, CURVE_POOL, 18);
    console.log("📊 Curve NUSD balance:", curveNusdBalance);
    await delay(RATE_LIMIT_DELAY);
    const curveUsdcBalance = await getTokenBalance(USDC_CONTRACT, CURVE_POOL, 6); // USDC has 6 decimals
    console.log("📊 Curve USDC balance:", curveUsdcBalance);
    await delay(RATE_LIMIT_DELAY);

    // Fetch Curve LP token total supply to calculate LP price
    console.log("🔍 Fetching Curve LP total supply...");
    const curveLpTotalSupply = await getTokenTotalSupply(CURVE_POOL, 18);
    console.log("📊 Curve LP total supply:", curveLpTotalSupply);
    await delay(RATE_LIMIT_DELAY);

    // Fetch lock contract data
    console.log("🔍 Fetching lock contract data...");
    const lockData = await getLockData();

    // Calculate TVL values
    const nusdPrice = nusdMarket?.underlyingPrice || 1;
    const snusdPrice = snusdMarket?.underlyingPrice || 1;

    // Curve pool TVL (both NUSD and USDC earn points)
    const curveNusd = curveNusdBalance || 0;
    const curveUsdc = curveUsdcBalance || 0;
    const curveTotalTvl = (curveNusd * nusdPrice) + (curveUsdc * 1); // USDC = $1
    console.log("📊 Curve TVL breakdown - NUSD:", curveNusd, "USDC:", curveUsdc, "Total:", curveTotalTvl);

    // Calculate LP token price and locked/unlocked TVL
    const curveLpSupply = curveLpTotalSupply || 1; // Avoid division by zero
    const curveLpPrice = curveTotalTvl / curveLpSupply;
    console.log("📊 Curve LP price:", curveLpPrice);

    // Calculate circulating supply (total supply - locked in Pendle - locked in Curve - locked in lock contract)
    const nusdLockedInContract = lockData?.nusd.totalLocked || 0;
    const snusdLockedInContract = lockData?.snusd.totalLocked || 0;
    const curveLpLockedInContract = lockData?.curveLp.totalLocked || 0;
    const curveLpLockedTvl = curveLpLockedInContract * curveLpPrice;
    const curveLpUnlockedTvl = curveTotalTvl - curveLpLockedTvl;
    console.log("📊 Curve LP locked:", curveLpLockedInContract, "tokens = $" + curveLpLockedTvl.toFixed(0), "Unlocked TVL: $" + curveLpUnlockedTvl.toFixed(0));

    const nusdCirculating = (nusdTotalSupply || 0) - (syNusdBalance || 0) - curveNusd - nusdLockedInContract;
    const snusdCirculating = (snusdTotalSupply || 0) - (sySnusdBalance || 0) - snusdLockedInContract;

    const result = {
      timestamp: new Date().toISOString(),

      // NUSD Market Data
      nusd: {
        market: NUSD_CONTRACTS.market,
        // Token supplies
        ytTotalSupply: ytNusdSupply || 0,
        ptTotalSupply: ptNusdSupply || nusdMarket?.totalPt || 0,
        lpTotalSupply: nusdMarket?.totalLp || 0,
        // SY balance = underlying locked in Pendle (PT + YT backing)
        syUnderlyingBalance: syNusdBalance || 0,
        // Total supply and circulating (outside Pendle)
        totalSupply: nusdTotalSupply || 0,
        circulatingSupply: nusdCirculating > 0 ? nusdCirculating : 0,
        // Prices
        underlyingPrice: nusdPrice,
        ytPrice: nusdMarket?.ytPrice || 0,
        ptPrice: nusdMarket?.ptPrice || 0,
        lpPrice: nusdMarket?.lpPrice || 0,
        // TVL calculations
        syTvl: (syNusdBalance || 0) * nusdPrice,
        lpTvl: nusdMarket?.liquidity || 0,
        lpSyTvl: (nusdMarket?.totalSy || 0) * nusdPrice, // Only SY portion of LP earns points
        holdTvl: (nusdCirculating > 0 ? nusdCirculating : 0) * nusdPrice,
        // APY data
        impliedApy: nusdMarket?.impliedApy || 0,
        underlyingApy: nusdMarket?.underlyingApy || 0,
      },

      // sNUSD Market Data
      snusd: {
        market: SNUSD_CONTRACTS.market,
        // Token supplies
        ytTotalSupply: ytSnusdSupply || 0,
        ptTotalSupply: ptSnusdSupply || snusdMarket?.totalPt || 0,
        lpTotalSupply: snusdMarket?.totalLp || 0,
        // SY balance = underlying locked in Pendle (PT + YT backing)
        syUnderlyingBalance: sySnusdBalance || 0,
        // Total supply and circulating (outside Pendle)
        totalSupply: snusdTotalSupply || 0,
        circulatingSupply: snusdCirculating > 0 ? snusdCirculating : 0,
        // Prices
        underlyingPrice: snusdPrice,
        ytPrice: snusdMarket?.ytPrice || 0,
        ptPrice: snusdMarket?.ptPrice || 0,
        lpPrice: snusdMarket?.lpPrice || 0,
        // TVL calculations
        syTvl: (sySnusdBalance || 0) * snusdPrice,
        lpTvl: snusdMarket?.liquidity || 0,
        lpSyTvl: (snusdMarket?.totalSy || 0) * snusdPrice, // Only SY portion of LP earns points
        holdTvl: (snusdCirculating > 0 ? snusdCirculating : 0) * snusdPrice,
        // APY data
        impliedApy: snusdMarket?.impliedApy || 0,
        underlyingApy: snusdMarket?.underlyingApy || 0,
      },

      // Legacy format for backward compatibility
      ytTokens: {
        nusd: ytNusdSupply !== null ? {
          contract: NUSD_CONTRACTS.yt,
          totalSupply: ytNusdSupply,
          totalSupplyRaw: (ytNusdSupply * 1e18).toString(),
        } : null,
        snusd: ytSnusdSupply !== null ? {
          contract: SNUSD_CONTRACTS.yt,
          totalSupply: ytSnusdSupply,
          totalSupplyRaw: (ytSnusdSupply * 1e18).toString(),
        } : null,
      },

      lpTokens: {
        nusd: nusdMarket ? {
          market: NUSD_CONTRACTS.market,
          totalLp: nusdMarket.totalLp,
          totalPt: nusdMarket.totalPt,
          totalSy: nusdMarket.totalSy,
          liquidity: nusdMarket.liquidity,
          lpPrice: nusdMarket.lpPrice,
        } : null,
        snusd: snusdMarket ? {
          market: SNUSD_CONTRACTS.market,
          totalLp: snusdMarket.totalLp,
          totalPt: snusdMarket.totalPt,
          totalSy: snusdMarket.totalSy,
          liquidity: snusdMarket.liquidity,
          lpPrice: snusdMarket.lpPrice,
        } : null,
      },

      // upNUSD (K3 protocol) - 18 points per token
      upnusd: {
        contract: UPNUSD_CONTRACT,
        totalSupply: upnusdTotalSupply || 0,
        // Assume $1 price for stablecoin derivative
        tvl: (upnusdTotalSupply || 0) * 1,
      },

      // Curve NUSD-USDC pool
      curve: {
        pool: CURVE_POOL,
        nusdBalance: curveNusd,
        usdcBalance: curveUsdc,
        nusdTvl: curveNusd * nusdPrice,
        usdcTvl: curveUsdc * 1, // USDC = $1
        totalTvl: curveTotalTvl,
        lpTotalSupply: curveLpSupply,
        lpPrice: curveLpPrice,
        lockedLpTokens: curveLpLockedInContract,
        lockedTvl: curveLpLockedTvl,
        // Unlocked curve LP (not in lock contract)
        unlockedTvl: curveLpUnlockedTvl,
      },

      // Lock contract data
      locks: lockData ? {
        nusd: {
          totalLocked: lockData.nusd.totalLocked,
          totalLockedTvl: lockData.nusd.totalLocked * nusdPrice,
          buckets: {
            "3mo": {
              count: lockData.nusd.buckets["3mo"].count,
              amount: lockData.nusd.buckets["3mo"].amount,
              tvl: lockData.nusd.buckets["3mo"].amount * nusdPrice,
              boost: 6,
            },
            "6mo": {
              count: lockData.nusd.buckets["6mo"].count,
              amount: lockData.nusd.buckets["6mo"].amount,
              tvl: lockData.nusd.buckets["6mo"].amount * nusdPrice,
              boost: 15,
            },
            "9mo": {
              count: lockData.nusd.buckets["9mo"].count,
              amount: lockData.nusd.buckets["9mo"].amount,
              tvl: lockData.nusd.buckets["9mo"].amount * nusdPrice,
              boost: 25,
            },
            "12mo": {
              count: lockData.nusd.buckets["12mo"].count,
              amount: lockData.nusd.buckets["12mo"].amount,
              tvl: lockData.nusd.buckets["12mo"].amount * nusdPrice,
              boost: 30,
            },
          },
        },
        snusd: {
          totalLocked: lockData.snusd.totalLocked,
          totalLockedTvl: lockData.snusd.totalLocked * snusdPrice,
          buckets: {
            "3mo": {
              count: lockData.snusd.buckets["3mo"].count,
              amount: lockData.snusd.buckets["3mo"].amount,
              tvl: lockData.snusd.buckets["3mo"].amount * snusdPrice,
              boost: 8,
            },
            "6mo": {
              count: lockData.snusd.buckets["6mo"].count,
              amount: lockData.snusd.buckets["6mo"].amount,
              tvl: lockData.snusd.buckets["6mo"].amount * snusdPrice,
              boost: 20,
            },
            "9mo": {
              count: lockData.snusd.buckets["9mo"].count,
              amount: lockData.snusd.buckets["9mo"].amount,
              tvl: lockData.snusd.buckets["9mo"].amount * snusdPrice,
              boost: 30,
            },
            "12mo": {
              count: lockData.snusd.buckets["12mo"].count,
              amount: lockData.snusd.buckets["12mo"].amount,
              tvl: lockData.snusd.buckets["12mo"].amount * snusdPrice,
              boost: 40,
            },
          },
        },
        curveLp: {
          totalLocked: lockData.curveLp.totalLocked,
          totalLockedTvl: lockData.curveLp.totalLocked * curveLpPrice,
          lpPrice: curveLpPrice,
          buckets: {
            "3mo": {
              count: lockData.curveLp.buckets["3mo"].count,
              amount: lockData.curveLp.buckets["3mo"].amount,
              tvl: lockData.curveLp.buckets["3mo"].amount * curveLpPrice,
              boost: 4,
            },
            "6mo": {
              count: lockData.curveLp.buckets["6mo"].count,
              amount: lockData.curveLp.buckets["6mo"].amount,
              tvl: lockData.curveLp.buckets["6mo"].amount * curveLpPrice,
              boost: 10,
            },
          },
        },
      } : null,
    };

    console.log("✅ TVL data fetched successfully");
    return NextResponse.json(result);

  } catch (error) {
    console.error("❌ Error fetching TVL data:", error);
    return NextResponse.json(
      { error: "Failed to fetch TVL data" },
      { status: 500 }
    );
  }
}
