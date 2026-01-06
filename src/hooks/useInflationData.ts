"use client";

import { useState, useEffect, useCallback } from "react";

const INFLATION_CACHE_KEY = "inflation_data_cache";
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export interface InflationData {
  timestamp: string;
  dataRange: {
    from: string;
    to: string;
    fromDate: string;
    toDate: string;
    totalDays: number;
    snapshotCount: number;
  };
  currentState: {
    s1RewardsIssued: number;
    s1RewardsIssuedFormatted: string;
    totalTvl: number;
    totalTvlFormatted: string;
    weightedTvl: number;
    weightedTvlFormatted: string;
    participantCount: number;
    estDailyPoints: number;
    estDailyPointsFormatted: string;
  };
  inflation: {
    pointsIssuedInPeriod: number;
    pointsIssuedInPeriodFormatted: string;
    actualDailyRate: number;
    actualDailyRateFormatted: string;
    avgEstDailyPoints: number;
    avgEstDailyPointsFormatted: string;
    efficiencyRate: number;
  };
  projections: {
    dailyInflation: number;
    dailyInflationFormatted: string;
    dailyInflationPercent: number;
    weeklyInflation: number;
    weeklyInflationFormatted: string;
    weeklyInflationPercent: number;
    monthlyInflation: number;
    monthlyInflationFormatted: string;
    monthlyInflationPercent: number;
    annualizedInflation: number;
    annualizedInflationFormatted: string;
    annualizedInflationPercent: number;
    projectedIn7Days: number;
    projectedIn7DaysFormatted: string;
    projectedIn30Days: number;
    projectedIn30DaysFormatted: string;
    projectedIn90Days: number;
    projectedIn90DaysFormatted: string;
  };
  growthRates: {
    tvlDailyGrowthRate: number;
    tvlWeeklyGrowthRate: number;
    weightedTvlDailyGrowthRate: number;
    weightedTvlWeeklyGrowthRate: number;
    pointsDailyGrowthRate: number;
    pointsWeeklyGrowthRate: number;
  };
}

interface CachedData<T> {
  data: T;
  timestamp: number;
}

function getCachedData(): InflationData | null {
  if (typeof window === "undefined") return null;
  try {
    const cached = localStorage.getItem(INFLATION_CACHE_KEY);
    if (!cached) return null;

    const { data, timestamp }: CachedData<InflationData> = JSON.parse(cached);
    const isExpired = Date.now() - timestamp > CACHE_TTL_MS;

    if (isExpired) {
      localStorage.removeItem(INFLATION_CACHE_KEY);
      return null;
    }

    return data;
  } catch {
    localStorage.removeItem(INFLATION_CACHE_KEY);
    return null;
  }
}

function setCachedData(data: InflationData): void {
  if (typeof window === "undefined") return;
  try {
    const cacheEntry: CachedData<InflationData> = {
      data,
      timestamp: Date.now(),
    };
    localStorage.setItem(INFLATION_CACHE_KEY, JSON.stringify(cacheEntry));
  } catch {
    // localStorage might be full or disabled
  }
}

export function useInflationData() {
  const [data, setData] = useState<InflationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCached, setIsCached] = useState(false);

  const fetchData = useCallback(async (skipCache = false) => {
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

    setLoading(true);
    setError(null);
    setIsCached(false);

    try {
      const response = await fetch("/api/inflation");

      if (!response.ok) {
        throw new Error("Failed to fetch inflation data");
      }

      const result = await response.json();
      setData(result);
      setCachedData(result);
    } catch (err) {
      console.error("Error fetching inflation data:", err);
      setError("Failed to load inflation data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 10 minutes
  useEffect(() => {
    const interval = setInterval(() => fetchData(true), CACHE_TTL_MS);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Helper: Project points at a future date
  const projectPointsAtDate = useCallback(
    (targetDate: Date): number => {
      if (!data) return 0;

      const today = new Date();
      const daysToTarget = Math.max(
        0,
        Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      );

      const currentPoints = data.currentState.s1RewardsIssued;
      const dailyRate = data.inflation.actualDailyRate;

      return currentPoints + dailyRate * daysToTarget;
    },
    [data]
  );

  return {
    data,
    loading,
    error,
    isCached,
    refetch: () => fetchData(true),
    projectPointsAtDate,
  };
}
