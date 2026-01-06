"use client";

import { useState, useEffect, useCallback } from "react";

const POINTS_CACHE_KEY = "points_data_cache";
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface PointsData {
  timestamp: string;
  totalPoints: number;
  totalPointsFormatted: string;
  participantCount: number;
  isCached: boolean;
}

interface CachedData<T> {
  data: T;
  timestamp: number;
}

function formatLargeNumber(num: number): string {
  if (num >= 1e12) return (num / 1e12).toFixed(2) + "T";
  if (num >= 1e9) return (num / 1e9).toFixed(2) + "B";
  if (num >= 1e6) return (num / 1e6).toFixed(2) + "M";
  if (num >= 1e3) return (num / 1e3).toFixed(2) + "K";
  return num.toFixed(2);
}

function getCachedData(): PointsData | null {
  if (typeof window === "undefined") return null;
  try {
    const cached = localStorage.getItem(POINTS_CACHE_KEY);
    if (!cached) return null;

    const { data, timestamp }: CachedData<PointsData> = JSON.parse(cached);
    const isExpired = Date.now() - timestamp > CACHE_TTL_MS;

    if (isExpired) {
      localStorage.removeItem(POINTS_CACHE_KEY);
      return null;
    }

    return data;
  } catch {
    localStorage.removeItem(POINTS_CACHE_KEY);
    return null;
  }
}

function setCachedData(data: PointsData): void {
  if (typeof window === "undefined") return;
  try {
    const cacheEntry: CachedData<PointsData> = {
      data,
      timestamp: Date.now(),
    };
    localStorage.setItem(POINTS_CACHE_KEY, JSON.stringify(cacheEntry));
  } catch {
    // localStorage might be full or disabled
  }
}

export function usePointsData() {
  const [data, setData] = useState<PointsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isClientCached, setIsClientCached] = useState(false);

  const fetchData = useCallback(async (skipCache = false) => {
    // Check client-side cache first (unless skipCache is true)
    if (!skipCache) {
      const cached = getCachedData();
      if (cached) {
        setData(cached);
        setIsClientCached(true);
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    setError(null);
    setIsClientCached(false);

    try {
      // Fetch from our API route which handles server-side caching
      const response = await fetch("/api/points");

      if (!response.ok) {
        throw new Error("Failed to fetch points data");
      }

      const result = await response.json();
      setData(result);
      setCachedData(result);
    } catch (err) {
      console.error("Error fetching points data:", err);
      setError("Failed to load points data");
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

  return { data, loading, error, isClientCached, refetch: () => fetchData(true) };
}
