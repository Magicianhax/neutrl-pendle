"use client";

import React, { useState, useEffect } from "react";
import { TVL_CATEGORIES, TvlRow } from "@/lib/tvlData";
import { formatNumber } from "@/lib/calculations";
import { useTvlData } from "@/hooks/useTvlData";
import { usePointsData } from "@/hooks/usePointsData";

interface RowData {
  tvlAmount: string;
  boost: number;
}

// Map row IDs to their live data source type
type LiveDataSource =
  | "yt-nusd"
  | "yt-snusd"
  | "yt-nusd-fee"
  | "yt-snusd-fee"
  | "yt-nusd-net"
  | "yt-snusd-net"
  | "lp-nusd"
  | "lp-snusd"
  | "lp-nusd-excluded"
  | "lp-snusd-excluded"
  | "lp-nusd-net"
  | "lp-snusd-net"
  | "pt-nusd"
  | "pt-snusd"
  | "hold-nusd"
  | "hold-snusd"
  | "hold-upnusd"
  | "hold-curve-lp"
  | "curve-nusd"
  | "curve-usdc"
  | "lock-nusd-3mo"
  | "lock-nusd-6mo"
  | "lock-nusd-9mo"
  | "lock-nusd-12mo"
  | "lock-snusd-3mo"
  | "lock-snusd-6mo"
  | "lock-snusd-9mo"
  | "lock-snusd-12mo"
  | "lock-curve-3mo"
  | "lock-curve-6mo";

const LIVE_DATA_MAP: Record<string, LiveDataSource> = {
  // February 2026 Market
  "yt-nusd-feb26": "yt-nusd",
  "pendle-fee-nusd": "yt-nusd-fee",
  "yt-nusd-feb26-net": "yt-nusd-net",
  "lp-nusd-feb26": "lp-nusd",
  "lp-excluded-nusd": "lp-nusd-excluded",
  "lp-nusd-feb26-net": "lp-nusd-net",
  "pt-nusd-feb26": "pt-nusd",
  // March 2026 Market
  "yt-snusd-mar26": "yt-snusd",
  "pendle-fee-snusd": "yt-snusd-fee",
  "yt-snusd-mar26-net": "yt-snusd-net",
  "lp-snusd-mar26": "lp-snusd",
  "lp-excluded-snusd": "lp-snusd-excluded",
  "lp-snusd-mar26-net": "lp-snusd-net",
  "pt-snusd-mar26": "pt-snusd",
  // Hold section
  "hold-nusd": "hold-nusd",
  "hold-snusd": "hold-snusd",
  "hold-upnusd": "hold-upnusd",
  "hold-curve-lp": "hold-curve-lp",
  "curve-nusd-breakdown": "curve-nusd",
  "curve-usdc-breakdown": "curve-usdc",
  // Lock contract data - NUSD (3mo, 6mo, 9mo, 12mo)
  "lock-nusd-3mo": "lock-nusd-3mo",
  "lock-nusd-6mo": "lock-nusd-6mo",
  "lock-nusd-9mo": "lock-nusd-9mo",
  "lock-nusd-12mo": "lock-nusd-12mo",
  // Lock contract data - sNUSD (3mo, 6mo, 9mo, 12mo)
  "lock-snusd-3mo": "lock-snusd-3mo",
  "lock-snusd-6mo": "lock-snusd-6mo",
  "lock-snusd-9mo": "lock-snusd-9mo",
  "lock-snusd-12mo": "lock-snusd-12mo",
  // Lock contract data - Curve LP (3mo, 6mo max)
  "lock-curve-3mo": "lock-curve-3mo",
  "lock-curve-6mo": "lock-curve-6mo",
};

export default function TvlTable() {
  const { data: tvlData, loading: tvlLoading } = useTvlData();
  const { data: pointsData, loading: pointsLoading } = usePointsData();

  const [rowData, setRowData] = useState<Record<string, RowData>>(() => {
    const initial: Record<string, RowData> = {};
    TVL_CATEGORIES.forEach((cat) => {
      cat.rows.forEach((row) => {
        initial[row.id] = {
          tvlAmount: "",
          boost: row.boost || 0,
        };
      });
    });
    return initial;
  });

  // Auto-populate all live data from API
  useEffect(() => {
    if (tvlData) {
      setRowData((prev) => {
        const updated = { ...prev };

        // NUSD Market Data
        if (tvlData.nusd) {
          const nusdData = tvlData.nusd;

          // YT NUSD - 1 YT = 1 underlying token for points, use underlying price
          const ytNusdTvl = nusdData.ytTotalSupply * nusdData.underlyingPrice;
          if (updated["yt-nusd-feb26"]) {
            updated["yt-nusd-feb26"] = { ...updated["yt-nusd-feb26"], tvlAmount: ytNusdTvl.toString() };
          }

          // Pendle Fee (5% of YT)
          const feeNusd = ytNusdTvl * 0.05;
          if (updated["pendle-fee-nusd"]) {
            updated["pendle-fee-nusd"] = { ...updated["pendle-fee-nusd"], tvlAmount: feeNusd.toString() };
          }

          // YT NUSD NET (95% of YT)
          const netNusd = ytNusdTvl * 0.95;
          if (updated["yt-nusd-feb26-net"]) {
            updated["yt-nusd-feb26-net"] = { ...updated["yt-nusd-feb26-net"], tvlAmount: netNusd.toString() };
          }

          // LP NUSD - Full SY TVL (display only)
          if (updated["lp-nusd-feb26"]) {
            updated["lp-nusd-feb26"] = { ...updated["lp-nusd-feb26"], tvlAmount: nusdData.lpSyTvl.toString() };
          }

          // LP Excluded (20% of SY) - display only, doesn't earn points
          const lpExcludedNusd = nusdData.lpSyTvl * 0.2;
          if (updated["lp-excluded-nusd"]) {
            updated["lp-excluded-nusd"] = { ...updated["lp-excluded-nusd"], tvlAmount: lpExcludedNusd.toString() };
          }

          // LP NET (80% of SY) - THIS earns points
          const lpNetNusd = nusdData.lpSyTvl * 0.8;
          if (updated["lp-nusd-feb26-net"]) {
            updated["lp-nusd-feb26-net"] = { ...updated["lp-nusd-feb26-net"], tvlAmount: lpNetNusd.toString() };
          }

          // PT NUSD - use PT total supply × PT price for TVL (display only, excluded from points)
          const ptNusdTvl = nusdData.ptTotalSupply * nusdData.ptPrice;
          if (updated["pt-nusd-feb26"]) {
            updated["pt-nusd-feb26"] = { ...updated["pt-nusd-feb26"], tvlAmount: ptNusdTvl.toString() };
          }

          // Hold NUSD - circulating supply (outside Pendle) × price
          if (updated["hold-nusd"]) {
            updated["hold-nusd"] = { ...updated["hold-nusd"], tvlAmount: nusdData.holdTvl.toString() };
          }
        }

        // sNUSD Market Data
        if (tvlData.snusd) {
          const snusdData = tvlData.snusd;

          // YT sNUSD - 1 YT = 1 underlying token for points, use underlying price
          const ytSnusdTvl = snusdData.ytTotalSupply * snusdData.underlyingPrice;
          if (updated["yt-snusd-mar26"]) {
            updated["yt-snusd-mar26"] = { ...updated["yt-snusd-mar26"], tvlAmount: ytSnusdTvl.toString() };
          }

          // Pendle Fee (5% of YT)
          const feeSnusd = ytSnusdTvl * 0.05;
          if (updated["pendle-fee-snusd"]) {
            updated["pendle-fee-snusd"] = { ...updated["pendle-fee-snusd"], tvlAmount: feeSnusd.toString() };
          }

          // YT sNUSD NET (95% of YT)
          const netSnusd = ytSnusdTvl * 0.95;
          if (updated["yt-snusd-mar26-net"]) {
            updated["yt-snusd-mar26-net"] = { ...updated["yt-snusd-mar26-net"], tvlAmount: netSnusd.toString() };
          }

          // LP sNUSD - Full SY TVL (display only)
          if (updated["lp-snusd-mar26"]) {
            updated["lp-snusd-mar26"] = { ...updated["lp-snusd-mar26"], tvlAmount: snusdData.lpSyTvl.toString() };
          }

          // LP Excluded (20% of SY) - display only, doesn't earn points
          const lpExcludedSnusd = snusdData.lpSyTvl * 0.2;
          if (updated["lp-excluded-snusd"]) {
            updated["lp-excluded-snusd"] = { ...updated["lp-excluded-snusd"], tvlAmount: lpExcludedSnusd.toString() };
          }

          // LP NET (80% of SY) - THIS earns points
          const lpNetSnusd = snusdData.lpSyTvl * 0.8;
          if (updated["lp-snusd-mar26-net"]) {
            updated["lp-snusd-mar26-net"] = { ...updated["lp-snusd-mar26-net"], tvlAmount: lpNetSnusd.toString() };
          }

          // PT sNUSD - use PT total supply × PT price for TVL (display only, excluded from points)
          const ptSnusdTvl = snusdData.ptTotalSupply * snusdData.ptPrice;
          if (updated["pt-snusd-mar26"]) {
            updated["pt-snusd-mar26"] = { ...updated["pt-snusd-mar26"], tvlAmount: ptSnusdTvl.toString() };
          }

          // Hold sNUSD - circulating supply (outside Pendle) × price
          if (updated["hold-snusd"]) {
            updated["hold-snusd"] = { ...updated["hold-snusd"], tvlAmount: snusdData.holdTvl.toString() };
          }
        }

        // upNUSD (K3 protocol)
        if (tvlData.upnusd) {
          if (updated["hold-upnusd"]) {
            updated["hold-upnusd"] = { ...updated["hold-upnusd"], tvlAmount: tvlData.upnusd.tvl.toString() };
          }
        }

        // Curve NUSD-USDC LP (unlocked portion only)
        if (tvlData.curve) {
          // Unlocked Curve LP TVL (total - locked)
          if (updated["hold-curve-lp"]) {
            updated["hold-curve-lp"] = { ...updated["hold-curve-lp"], tvlAmount: tvlData.curve.unlockedTvl.toString() };
          }
          // NUSD breakdown (display only)
          if (updated["curve-nusd-breakdown"]) {
            updated["curve-nusd-breakdown"] = { ...updated["curve-nusd-breakdown"], tvlAmount: tvlData.curve.nusdTvl.toString() };
          }
          // USDC breakdown (display only)
          if (updated["curve-usdc-breakdown"]) {
            updated["curve-usdc-breakdown"] = { ...updated["curve-usdc-breakdown"], tvlAmount: tvlData.curve.usdcTvl.toString() };
          }
        }

        // Lock contract data
        if (tvlData.locks) {
          // NUSD locks by duration (3mo, 6mo, 9mo, 12mo)
          if (updated["lock-nusd-3mo"]) {
            updated["lock-nusd-3mo"] = { ...updated["lock-nusd-3mo"], tvlAmount: tvlData.locks.nusd.buckets["3mo"].tvl.toString() };
          }
          if (updated["lock-nusd-6mo"]) {
            updated["lock-nusd-6mo"] = { ...updated["lock-nusd-6mo"], tvlAmount: tvlData.locks.nusd.buckets["6mo"].tvl.toString() };
          }
          if (updated["lock-nusd-9mo"]) {
            updated["lock-nusd-9mo"] = { ...updated["lock-nusd-9mo"], tvlAmount: tvlData.locks.nusd.buckets["9mo"].tvl.toString() };
          }
          if (updated["lock-nusd-12mo"]) {
            updated["lock-nusd-12mo"] = { ...updated["lock-nusd-12mo"], tvlAmount: tvlData.locks.nusd.buckets["12mo"].tvl.toString() };
          }

          // sNUSD locks by duration (3mo, 6mo, 9mo, 12mo)
          if (updated["lock-snusd-3mo"]) {
            updated["lock-snusd-3mo"] = { ...updated["lock-snusd-3mo"], tvlAmount: tvlData.locks.snusd.buckets["3mo"].tvl.toString() };
          }
          if (updated["lock-snusd-6mo"]) {
            updated["lock-snusd-6mo"] = { ...updated["lock-snusd-6mo"], tvlAmount: tvlData.locks.snusd.buckets["6mo"].tvl.toString() };
          }
          if (updated["lock-snusd-9mo"]) {
            updated["lock-snusd-9mo"] = { ...updated["lock-snusd-9mo"], tvlAmount: tvlData.locks.snusd.buckets["9mo"].tvl.toString() };
          }
          if (updated["lock-snusd-12mo"]) {
            updated["lock-snusd-12mo"] = { ...updated["lock-snusd-12mo"], tvlAmount: tvlData.locks.snusd.buckets["12mo"].tvl.toString() };
          }

          // Curve LP locks by duration (3mo, 6mo max)
          if (updated["lock-curve-3mo"]) {
            updated["lock-curve-3mo"] = { ...updated["lock-curve-3mo"], tvlAmount: tvlData.locks.curveLp.buckets["3mo"].tvl.toString() };
          }
          if (updated["lock-curve-6mo"]) {
            updated["lock-curve-6mo"] = { ...updated["lock-curve-6mo"], tvlAmount: tvlData.locks.curveLp.buckets["6mo"].tvl.toString() };
          }
        }

        return updated;
      });
    }
  }, [tvlData]);

  const handleTvlChange = (id: string, value: string) => {
    setRowData((prev) => ({
      ...prev,
      [id]: { ...prev[id], tvlAmount: value },
    }));
  };

  // Check if a row has live data
  const hasLiveData = (rowId: string): boolean => {
    return rowId in LIVE_DATA_MAP;
  };

  // Calculate weighted TVL for a row
  const getWeightedTvl = (row: TvlRow): number => {
    const data = rowData[row.id];
    const tvl = parseFloat(data?.tvlAmount) || 0;
    const boost = row.boost || 0;
    const baseBoost = row.baseBoost || 1;
    if (row.status === "excluded") return 0;
    return row.baseBoost ? tvl * baseBoost * boost : tvl * boost;
  };

  // Check if row should be counted in total (active and locked count, excluded and display don't)
  const shouldCountInTotal = (row: TvlRow): boolean => {
    return row.status === "active" || row.status === "locked";
  };

  // Get the effective multiplier for display
  const getEffectiveMultiplier = (row: TvlRow): number => {
    const boost = row.boost || 0;
    const baseBoost = row.baseBoost || 1;
    return row.baseBoost ? baseBoost * boost : boost;
  };

  // Calculate total weighted TVL
  const totalWeightedTvl = TVL_CATEGORIES.reduce((sum, cat) => {
    return (
      sum +
      cat.rows.reduce((catSum, row) => {
        if (row.type !== "total" && shouldCountInTotal(row)) {
          return catSum + getWeightedTvl(row);
        }
        return catSum;
      }, 0)
    );
  }, 0);

  // Calculate total raw TVL
  const totalRawTvl = TVL_CATEGORIES.reduce((sum, cat) => {
    return (
      sum +
      cat.rows.reduce((catSum, row) => {
        if (row.type !== "total" && shouldCountInTotal(row)) {
          return catSum + (parseFloat(rowData[row.id]?.tvlAmount) || 0);
        }
        return catSum;
      }, 0)
    );
  }, 0);

  // Calculate share percentage
  const getSharePercent = (row: TvlRow): number => {
    if (totalWeightedTvl === 0) return 0;
    return (getWeightedTvl(row) / totalWeightedTvl) * 100;
  };

  // Get status badge
  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "excluded":
        return (
          <span className="px-1.5 py-0.5 text-[10px] font-bold bg-black/20 text-black/60 dark:bg-white/20 dark:text-white/60 uppercase">
            Excluded
          </span>
        );
      case "locked":
        return (
          <span className="px-1.5 py-0.5 text-[10px] font-bold bg-black text-white dark:bg-white dark:text-black uppercase">
            Locked
          </span>
        );
      default:
        return null;
    }
  };

  const renderRow = (row: TvlRow, _catId: string, isLast: boolean) => {
    const data = rowData[row.id];
    const weightedTvl = getWeightedTvl(row);
    const sharePercent = getSharePercent(row);
    const isExcluded = row.status === "excluded";
    const isDisplay = row.status === "display";
    const isSubrow = row.type === "subrow";
    const isTotal = row.type === "total";
    const isLive = hasLiveData(row.id);

    if (isTotal) return null;

    return (
      <tr
        key={row.id}
        className={`
          bg-white dark:bg-black
          ${isExcluded ? "opacity-60" : ""}
          ${!isLast ? "border-b border-black dark:border-white" : ""}
          hover:bg-black/5 dark:hover:bg-white/5
        `}
      >
        <td className={`px-4 py-3 ${isSubrow ? "pl-8" : ""}`}>
          <div className="flex items-center gap-2">
            {isSubrow && (
              <span className="text-black/40 dark:text-white/40">└</span>
            )}
            <span className={`text-sm font-medium ${isExcluded ? "text-black/40 dark:text-white/40" : isDisplay ? "text-black/60 dark:text-white/60" : "text-black dark:text-white"}`}>
              {row.name}
            </span>
            {getStatusBadge(row.status)}
          </div>
        </td>
        <td className="px-4 py-3 text-right">
          {isLive ? (
            <div className="flex items-center justify-end gap-2">
              {tvlLoading ? (
                <div className="w-20 h-7 bg-black/10 dark:bg-white/10 animate-pulse" />
              ) : (
                <span className="text-sm font-bold text-black dark:text-white">
                  {formatNumber(parseFloat(data?.tvlAmount) || 0, 2)}
                </span>
              )}
            </div>
          ) : (
            <input
              type="number"
              value={data?.tvlAmount || ""}
              onChange={(e) => handleTvlChange(row.id, e.target.value)}
              placeholder="0"
              disabled={isExcluded}
              className={`
                w-28 px-3 py-1.5 text-right text-sm font-medium
                ${isExcluded
                  ? "bg-white dark:bg-black border-black/30 dark:border-white/30 text-black/40 dark:text-white/40"
                  : "bg-white dark:bg-black border-black dark:border-white text-black dark:text-white"
                }
                border-2 focus:outline-none focus:border-black/50 dark:focus:border-white/50
              `}
            />
          )}
        </td>
        <td className="px-4 py-3 text-center">
          {row.boost ? (
            <div className="flex flex-col items-center gap-0.5">
              {row.baseBoost ? (
                <>
                  <span className="inline-flex items-center justify-center min-w-[40px] px-2 py-0.5 text-xs font-bold bg-black text-white dark:bg-white dark:text-black">
                    {getEffectiveMultiplier(row)}x
                  </span>
                  <span className="text-[10px] text-black/50 dark:text-white/50">
                    {row.baseBoost}x × {row.boost}x
                  </span>
                </>
              ) : row.boost < 0 ? (
                <span className="inline-flex items-center justify-center min-w-[40px] px-2 py-0.5 text-xs font-bold bg-black/50 text-white dark:bg-white/50 dark:text-black">
                  {row.boost}x
                </span>
              ) : (
                <span className={`inline-flex items-center justify-center min-w-[40px] px-2 py-0.5 text-xs font-bold ${
                  row.boost > 1
                    ? "bg-black text-white dark:bg-white dark:text-black"
                    : "bg-black/20 text-black/70 dark:bg-white/20 dark:text-white/70"
                }`}>
                  {row.boost}x
                </span>
              )}
            </div>
          ) : (
            <span className="text-black/40 dark:text-white/40">—</span>
          )}
        </td>
        <td className="px-4 py-3 text-right">
          <span className={`text-sm font-medium ${
            isExcluded ? "text-black/40 dark:text-white/40"
            : isDisplay ? "text-black/60 dark:text-white/60"
            : "text-black dark:text-white"
          }`}>
            {isExcluded ? "$0" : `$${formatNumber(weightedTvl)}`}
          </span>
        </td>
        <td className="px-4 py-3 text-right">
          <span className={`text-sm font-bold ${
            isExcluded ? "text-black/40 dark:text-white/40"
            : isDisplay ? "text-black/60 dark:text-white/60"
            : weightedTvl > 0 ? "text-black dark:text-white" : "text-black/40 dark:text-white/40"
          }`}>
            {isExcluded ? "—" : weightedTvl > 0 ? formatNumber(weightedTvl) : "0"}
          </span>
        </td>
        <td className="px-4 py-3 text-right">
          <span className={`text-sm ${
            isExcluded ? "text-black/40 dark:text-white/40"
            : isDisplay ? "text-black/60 dark:text-white/60"
            : "text-black dark:text-white"
          }`}>
            {isExcluded ? "0%" : isDisplay ? "(info)" : sharePercent !== 0 ? `${sharePercent.toFixed(2)}%` : "0%"}
          </span>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
        <h2 className="text-xl font-bold text-black dark:text-white uppercase tracking-wide">TVL & Points Distribution</h2>
        <p className="text-sm text-black/60 dark:text-white/60">
          Calculate your share of daily points based on TVL and boost multipliers
          {tvlData && (
            <span className="ml-2 text-black dark:text-white font-medium">
              • Updated {new Date(tvlData.timestamp).toLocaleTimeString()}
            </span>
          )}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white dark:bg-black border-2 border-black dark:border-white p-4">
          <p className="text-xs text-black/50 dark:text-white/50 uppercase tracking-wide mb-1">S1 Rewards Issued</p>
          {pointsLoading ? (
            <div className="h-8 flex items-center">
              <div className="w-4 h-4 border-2 border-black/30 dark:border-white/30 border-t-black dark:border-t-white animate-spin" />
            </div>
          ) : (
            <p className="text-2xl font-bold text-black dark:text-white">
              {pointsData?.totalPointsFormatted || "—"}
            </p>
          )}
        </div>
        <div className="bg-white dark:bg-black border-2 border-black dark:border-white p-4">
          <p className="text-xs text-black/50 dark:text-white/50 uppercase tracking-wide mb-1">Total TVL</p>
          <p className="text-2xl font-bold text-black dark:text-white">${formatNumber(totalRawTvl)}</p>
        </div>
        <div className="bg-white dark:bg-black border-2 border-black dark:border-white p-4">
          <p className="text-xs text-black/50 dark:text-white/50 uppercase tracking-wide mb-1">Weighted TVL</p>
          <p className="text-2xl font-bold text-black dark:text-white">${formatNumber(totalWeightedTvl)}</p>
        </div>
        <div className="bg-black dark:bg-white border-2 border-black dark:border-white p-4">
          <p className="text-xs text-white/50 dark:text-black/50 uppercase tracking-wide mb-1">Est. Daily Points</p>
          <p className="text-2xl font-bold text-white dark:text-black">{formatNumber(totalWeightedTvl)}</p>
        </div>
        <div className="bg-black dark:bg-white border-2 border-black dark:border-white p-4">
          <p className="text-xs text-white/50 dark:text-black/50 uppercase tracking-wide mb-1">Est. Weekly Points</p>
          <p className="text-2xl font-bold text-white dark:text-black">{formatNumber(totalWeightedTvl * 7)}</p>
        </div>
        <div className="bg-black dark:bg-white border-2 border-black dark:border-white p-4">
          <p className="text-xs text-white/50 dark:text-black/50 uppercase tracking-wide mb-1">Est. Monthly Points</p>
          <p className="text-2xl font-bold text-white dark:text-black">{formatNumber(totalWeightedTvl * 30)}</p>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white dark:bg-black border-2 border-black dark:border-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-black dark:bg-white text-white dark:text-black">
                <th className="text-left px-4 py-3 font-bold text-xs uppercase tracking-wider">
                  TVL Type
                </th>
                <th className="text-right px-4 py-3 font-bold text-xs uppercase tracking-wider">
                  Amount ($)
                </th>
                <th className="text-center px-4 py-3 font-bold text-xs uppercase tracking-wider">
                  Boost
                </th>
                <th className="text-right px-4 py-3 font-bold text-xs uppercase tracking-wider">
                  Weighted TVL
                </th>
                <th className="text-right px-4 py-3 font-bold text-xs uppercase tracking-wider">
                  Daily Points
                </th>
                <th className="text-right px-4 py-3 font-bold text-xs uppercase tracking-wider">
                  Share
                </th>
              </tr>
            </thead>
            <tbody>
              {TVL_CATEGORIES.map((category) => {
                const categoryRows = category.rows.filter(r => r.type !== "total");
                return (
                  <React.Fragment key={category.id}>
                    {/* Category Header */}
                    <tr className="bg-black/5 dark:bg-white/5 border-y-2 border-black dark:border-white">
                      <td colSpan={6} className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-4 bg-black dark:bg-white"></div>
                          <span className="font-bold text-black dark:text-white uppercase tracking-wide">{category.title}</span>
                        </div>
                        {category.warning && (
                          <p className="text-xs text-black/50 dark:text-white/50 mt-0.5 ml-3">{category.warning}</p>
                        )}
                      </td>
                    </tr>
                    {/* Category Rows */}
                    {categoryRows.map((row, idx) =>
                      renderRow(row, category.id, idx === categoryRows.length - 1)
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-black dark:bg-white text-white dark:text-black">
                <td className="px-4 py-4 font-bold uppercase">Total</td>
                <td className="px-4 py-4 text-right font-bold">${formatNumber(totalRawTvl)}</td>
                <td className="px-4 py-4 text-center">—</td>
                <td className="px-4 py-4 text-right font-bold">${formatNumber(totalWeightedTvl)}</td>
                <td className="px-4 py-4 text-right font-bold">{formatNumber(totalWeightedTvl)}</td>
                <td className="px-4 py-4 text-right font-bold">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
