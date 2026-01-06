"use client";

import { useState, useEffect, useCallback } from "react";

const TVL_CACHE_KEY = "tvl_data_cache";
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface CachedData<T> {
  data: T;
  timestamp: number;
}

export interface YtTokenData {
  contract: string;
  totalSupply: number;
  totalSupplyRaw: string;
}

export interface LpTokenData {
  market: string;
  totalLp: number;
  totalPt: number;
  totalSy: number;
  liquidity: number;
  lpPrice: number;
}

export interface MarketData {
  market: string;
  // Token supplies
  ytTotalSupply: number;
  ptTotalSupply: number;
  lpTotalSupply: number;
  // SY underlying balance (total locked in Pendle)
  syUnderlyingBalance: number;
  // Total supply and circulating (outside Pendle)
  totalSupply: number;
  circulatingSupply: number;
  // Prices
  underlyingPrice: number;
  ytPrice: number;
  ptPrice: number;
  lpPrice: number;
  // TVL calculations
  syTvl: number;
  lpTvl: number;
  lpSyTvl: number; // Only SY portion of LP earns points
  holdTvl: number;
  // APY data
  impliedApy: number;
  underlyingApy: number;
}

export interface UpnusdData {
  contract: string;
  totalSupply: number;
  tvl: number;
}

export interface CurveData {
  pool: string;
  nusdBalance: number;
  usdcBalance: number;
  nusdTvl: number;
  usdcTvl: number;
  totalTvl: number;
  unlockedTvl: number;
}

export interface LockBucketData {
  count: number;
  amount: number;
  tvl: number;
}

export interface AssetLockData {
  totalLocked: number;
  totalLockedTvl: number;
  buckets: {
    "3mo": LockBucketData;
    "6mo": LockBucketData;
    "9mo": LockBucketData;
    "12mo": LockBucketData;
  };
}

export interface CurveLpLockData {
  totalLocked: number;
  totalLockedTvl: number;
  lpPrice: number;
  buckets: {
    "3mo": LockBucketData;
    "6mo": LockBucketData;
  };
}

export interface LocksData {
  nusd: AssetLockData;
  snusd: AssetLockData;
  curveLp: CurveLpLockData;
}

export interface TvlApiResponse {
  timestamp: string;
  // New comprehensive format
  nusd: MarketData;
  snusd: MarketData;
  // Legacy format for backward compatibility
  ytTokens: {
    snusd: YtTokenData | null;
    nusd: YtTokenData | null;
  };
  lpTokens: {
    nusd: LpTokenData | null;
    snusd: LpTokenData | null;
  };
  // upNUSD (K3 protocol)
  upnusd: UpnusdData;
  // Curve NUSD-USDC pool
  curve: CurveData;
  // Lock contract data
  locks: LocksData | null;
}

function getCachedData(): TvlApiResponse | null {
  if (typeof window === "undefined") return null;
  try {
    const cached = localStorage.getItem(TVL_CACHE_KEY);
    if (!cached) return null;

    const { data, timestamp }: CachedData<TvlApiResponse> = JSON.parse(cached);
    const isExpired = Date.now() - timestamp > CACHE_TTL_MS;

    if (isExpired) {
      localStorage.removeItem(TVL_CACHE_KEY);
      return null;
    }

    return data;
  } catch {
    localStorage.removeItem(TVL_CACHE_KEY);
    return null;
  }
}

function setCachedData(data: TvlApiResponse): void {
  if (typeof window === "undefined") return;
  try {
    const cacheEntry: CachedData<TvlApiResponse> = {
      data,
      timestamp: Date.now(),
    };
    localStorage.setItem(TVL_CACHE_KEY, JSON.stringify(cacheEntry));
  } catch {
    // localStorage might be full or disabled
  }
}

export function useTvlData() {
  const [data, setData] = useState<TvlApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCached, setIsCached] = useState(false);

  const fetchTvlData = useCallback(async (skipCache = false) => {
    // Check cache first (unless skipCache is true)
    if (!skipCache) {
      const cached = getCachedData();
      if (cached) {
        setData(cached);
        setIsCached(true);
        setLoading(false);
        return;
      }
    }

    try {
      setLoading(true);
      setError(null);
      setIsCached(false);

      const response = await fetch("/api/tvl");
      if (!response.ok) {
        throw new Error("Failed to fetch TVL data");
      }

      const result = await response.json();
      setData(result);
      setCachedData(result);
    } catch (err) {
      console.error("Error fetching TVL data:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-fetch on mount
  useEffect(() => {
    fetchTvlData();
  }, [fetchTvlData]);

  // Auto-refresh every 10 minutes
  useEffect(() => {
    const interval = setInterval(() => fetchTvlData(true), CACHE_TTL_MS);
    return () => clearInterval(interval);
  }, [fetchTvlData]);

  return { data, loading, error, isCached, refetch: () => fetchTvlData(true) };
}
