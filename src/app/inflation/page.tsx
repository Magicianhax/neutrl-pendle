"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import InflationChart from "@/components/InflationChart";
import PointsPredictor from "@/components/PointsPredictor";

interface InflationData {
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
  tvlChanges: {
    totalTvlChange: number;
    totalTvlChangeFormatted: string;
    totalTvlChangePercent: number;
    weightedTvlChange: number;
    weightedTvlChangeFormatted: string;
    weightedTvlChangePercent: number;
    participantChange: number;
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
  timeline: Array<{
    capturedAt: string;
    date: string;
    s1RewardsIssued: number;
    s1RewardsIssuedFormatted: string;
    totalTvl: number;
    totalTvlFormatted: string;
    weightedTvl: number;
    weightedTvlFormatted: string;
    estDailyPoints: number;
    participantCount: number;
    pointsChange: number;
    pointsChangeFormatted: string;
  }>;
}

export default function InflationPage() {
  const [data, setData] = useState<InflationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("/api/inflation");
        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || "Failed to fetch");
        }
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleString();
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      {/* Header */}
      <header className="bg-white dark:bg-black border-b-2 border-black dark:border-white">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center gap-3">
                <div className="w-8 h-8 bg-black dark:bg-white flex items-center justify-center">
                  <span className="text-white dark:text-black font-bold text-sm">N</span>
                </div>
                <div>
                  <h1 className="text-lg font-bold uppercase text-black dark:text-white">
                    Points Inflation
                  </h1>
                  <p className="text-xs text-black/60 dark:text-white/60 uppercase tracking-wide">
                    Track S1 Rewards Emission & TVL Growth
                  </p>
                </div>
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="px-4 py-2 bg-black dark:bg-white text-white dark:text-black text-sm font-bold uppercase border-2 border-black dark:border-white hover:bg-transparent hover:text-black dark:hover:bg-transparent dark:hover:text-white transition-colors"
              >
                Calculator
              </Link>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="py-8">
        <div className="max-w-6xl mx-auto px-6 space-y-8">
          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-black dark:border-white border-t-transparent animate-spin" />
            </div>
          )}

          {error && (
            <div className="bg-white dark:bg-black border-2 border-black dark:border-white p-6">
              <h2 className="text-lg font-bold text-black dark:text-white uppercase mb-2">Error</h2>
              <p className="text-black/60 dark:text-white/60">{error}</p>
              <p className="text-sm text-black/40 dark:text-white/40 mt-4">
                Run <code className="bg-black/10 dark:bg-white/10 px-2 py-1">node capture-tvl-data.js</code> at least twice to collect data.
              </p>
            </div>
          )}

          {data && (
            <>
              {/* Note */}
              <div className="bg-black/5 dark:bg-white/5 border-2 border-black dark:border-white p-4">
                <p className="text-sm text-black/60 dark:text-white/60">
                  <strong className="text-black dark:text-white">Note:</strong> Projections are based on the average emission rate observed during the data collection period. 
                  Actual inflation may vary based on TVL changes, participant activity, and protocol updates.
                </p>
              </div>

              {/* Data Range Info */}
              <div className="bg-black/5 dark:bg-white/5 border-2 border-black dark:border-white p-4">
                <p className="text-sm text-black/60 dark:text-white/60">
                  Analyzing <strong className="text-black dark:text-white">{data.dataRange.snapshotCount} snapshots</strong> from{" "}
                  <strong className="text-black dark:text-white">{new Date(data.dataRange.from).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</strong> to{" "}
                  <strong className="text-black dark:text-white">{new Date(data.dataRange.to).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</strong>{" "}
                  ({data.dataRange.totalDays} {data.dataRange.totalDays === 1 ? "day" : "days"})
                </p>
              </div>

              {/* Points Inflation Chart */}
              <InflationChart
                timeline={data.timeline}
                growthRates={{
                  tvlDailyGrowthRate: data.growthRates.tvlDailyGrowthRate,
                  weightedTvlDailyGrowthRate: data.growthRates.weightedTvlDailyGrowthRate,
                  pointsDailyGrowthRate: data.growthRates.pointsDailyGrowthRate,
                  actualDailyRate: data.inflation.actualDailyRate,
                }}
              />

              {/* Points Predictor */}
              <PointsPredictor
                growthData={{
                  tvlDailyGrowthRate: data.growthRates.tvlDailyGrowthRate,
                  pointsDailyGrowthRate: data.growthRates.pointsDailyGrowthRate,
                  weightedTvlDailyGrowthRate: data.growthRates.weightedTvlDailyGrowthRate,
                  currentPoints: data.currentState.s1RewardsIssued,
                  currentTvl: data.currentState.totalTvl,
                  currentWeightedTvl: data.currentState.weightedTvl,
                  actualDailyRate: data.inflation.actualDailyRate,
                  dataFromDate: data.dataRange.from,
                  dataToDate: data.dataRange.to,
                }}
              />

              {/* Growth Rates (% Based) */}
              <div>
                <h2 className="text-lg font-bold uppercase text-black dark:text-white mb-2">Observed Growth Rates</h2>
                <p className="text-xs text-black/50 dark:text-white/50 mb-4">
                  Based on data from {formatDate(data.dataRange.from)} to {formatDate(data.dataRange.to)}
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="bg-black dark:bg-white border-2 border-black dark:border-white p-4">
                    <p className="text-xs text-white/50 dark:text-black/50 uppercase mb-1">TVL Growth</p>
                    <p className="text-2xl font-bold text-white dark:text-black">
                      {data.growthRates.tvlDailyGrowthRate >= 0 ? "+" : ""}{data.growthRates.tvlDailyGrowthRate.toFixed(4)}%
                    </p>
                    <p className="text-xs text-white/40 dark:text-black/40">per day (compound)</p>
                  </div>
                  <div className="bg-black dark:bg-white border-2 border-black dark:border-white p-4">
                    <p className="text-xs text-white/50 dark:text-black/50 uppercase mb-1">Weighted TVL Growth</p>
                    <p className="text-2xl font-bold text-white dark:text-black">
                      {data.growthRates.weightedTvlDailyGrowthRate >= 0 ? "+" : ""}{data.growthRates.weightedTvlDailyGrowthRate.toFixed(4)}%
                    </p>
                    <p className="text-xs text-white/40 dark:text-black/40">per day (compound)</p>
                  </div>
                  <div className="bg-black dark:bg-white border-2 border-black dark:border-white p-4">
                    <p className="text-xs text-white/50 dark:text-black/50 uppercase mb-1">Points Emission</p>
                    <p className="text-2xl font-bold text-green-400 dark:text-green-600">
                      {data.growthRates.pointsDailyGrowthRate >= 0 ? "+" : ""}{data.growthRates.pointsDailyGrowthRate.toFixed(4)}%
                    </p>
                    <p className="text-xs text-white/40 dark:text-black/40">per day (compound)</p>
                  </div>
                </div>
              </div>

              {/* Current State */}
              <div>
                <h2 className="text-lg font-bold uppercase text-black dark:text-white mb-4">Current State</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white dark:bg-black border-2 border-black dark:border-white p-4">
                    <p className="text-xs text-black/50 dark:text-white/50 uppercase mb-1">S1 Rewards Issued</p>
                    <p className="text-2xl font-bold text-black dark:text-white">{data.currentState.s1RewardsIssuedFormatted}</p>
                  </div>
                  <div className="bg-white dark:bg-black border-2 border-black dark:border-white p-4">
                    <p className="text-xs text-black/50 dark:text-white/50 uppercase mb-1">Total TVL</p>
                    <p className="text-2xl font-bold text-black dark:text-white">${data.currentState.totalTvlFormatted}</p>
                  </div>
                  <div className="bg-white dark:bg-black border-2 border-black dark:border-white p-4">
                    <p className="text-xs text-black/50 dark:text-white/50 uppercase mb-1">Weighted TVL</p>
                    <p className="text-2xl font-bold text-black dark:text-white">${data.currentState.weightedTvlFormatted}</p>
                  </div>
                  <div className="bg-white dark:bg-black border-2 border-black dark:border-white p-4">
                    <p className="text-xs text-black/50 dark:text-white/50 uppercase mb-1">Participants</p>
                    <p className="text-2xl font-bold text-black dark:text-white">{data.currentState.participantCount.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Estimated vs Actual */}
              <div>
                <h2 className="text-lg font-bold uppercase text-black dark:text-white mb-4">Estimated vs Actual</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white dark:bg-black border-2 border-black dark:border-white p-4">
                    <p className="text-xs text-black/50 dark:text-white/50 uppercase mb-1">Est. Daily (from TVL)</p>
                    <p className="text-2xl font-bold text-black dark:text-white">{data.inflation.avgEstDailyPointsFormatted}</p>
                  </div>
                  <div className="bg-white dark:bg-black border-2 border-black dark:border-white p-4">
                    <p className="text-xs text-black/50 dark:text-white/50 uppercase mb-1">Actual Daily</p>
                    <p className="text-2xl font-bold text-black dark:text-white">{data.inflation.actualDailyRateFormatted}</p>
                  </div>
                  <div className="bg-white dark:bg-black border-2 border-black dark:border-white p-4">
                    <p className="text-xs text-black/50 dark:text-white/50 uppercase mb-1">Efficiency Rate</p>
                    <p className="text-2xl font-bold text-black dark:text-white">{data.inflation.efficiencyRate.toFixed(1)}%</p>
                    <p className="text-xs text-black/40 dark:text-white/40 mt-1">
                      {data.inflation.efficiencyRate < 100 ? "Below capacity" : "Above capacity"}
                    </p>
                  </div>
                </div>
              </div>

              {/* TVL Changes */}
              <div>
                <h2 className="text-lg font-bold uppercase text-black dark:text-white mb-4">Changes Over Period</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white dark:bg-black border-2 border-black dark:border-white p-4">
                    <p className="text-xs text-black/50 dark:text-white/50 uppercase mb-1">TVL Change</p>
                    <p className={`text-2xl font-bold ${data.tvlChanges.totalTvlChange >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {data.tvlChanges.totalTvlChange >= 0 ? "+" : "-"}${data.tvlChanges.totalTvlChangeFormatted}
                    </p>
                    <p className="text-xs text-black/40 dark:text-white/40">
                      {data.tvlChanges.totalTvlChangePercent >= 0 ? "+" : ""}{data.tvlChanges.totalTvlChangePercent.toFixed(2)}%
                    </p>
                  </div>
                  <div className="bg-white dark:bg-black border-2 border-black dark:border-white p-4">
                    <p className="text-xs text-black/50 dark:text-white/50 uppercase mb-1">Weighted TVL Change</p>
                    <p className={`text-2xl font-bold ${data.tvlChanges.weightedTvlChange >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {data.tvlChanges.weightedTvlChange >= 0 ? "+" : "-"}${data.tvlChanges.weightedTvlChangeFormatted}
                    </p>
                    <p className="text-xs text-black/40 dark:text-white/40">
                      {data.tvlChanges.weightedTvlChangePercent >= 0 ? "+" : ""}{data.tvlChanges.weightedTvlChangePercent.toFixed(2)}%
                    </p>
                  </div>
                  <div className="bg-white dark:bg-black border-2 border-black dark:border-white p-4">
                    <p className="text-xs text-black/50 dark:text-white/50 uppercase mb-1">New Participants</p>
                    <p className={`text-2xl font-bold ${data.tvlChanges.participantChange >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {data.tvlChanges.participantChange >= 0 ? "+" : ""}{data.tvlChanges.participantChange}
                    </p>
                  </div>
                </div>
              </div>

              {/* Inflation Rates */}
              <div>
                <h2 className="text-lg font-bold uppercase text-black dark:text-white mb-4">Inflation Rates (Points & %)</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white dark:bg-black border-2 border-black dark:border-white p-4">
                    <p className="text-xs text-black/50 dark:text-white/50 uppercase mb-1">Daily</p>
                    <p className="text-xl font-bold text-black dark:text-white">{data.projections.dailyInflationFormatted}</p>
                    <p className="text-sm text-green-600 font-bold">+{data.projections.dailyInflationPercent.toFixed(4)}%</p>
                  </div>
                  <div className="bg-white dark:bg-black border-2 border-black dark:border-white p-4">
                    <p className="text-xs text-black/50 dark:text-white/50 uppercase mb-1">Weekly</p>
                    <p className="text-xl font-bold text-black dark:text-white">{data.projections.weeklyInflationFormatted}</p>
                    <p className="text-sm text-green-600 font-bold">+{data.projections.weeklyInflationPercent.toFixed(3)}%</p>
                  </div>
                  <div className="bg-white dark:bg-black border-2 border-black dark:border-white p-4">
                    <p className="text-xs text-black/50 dark:text-white/50 uppercase mb-1">Monthly</p>
                    <p className="text-xl font-bold text-black dark:text-white">{data.projections.monthlyInflationFormatted}</p>
                    <p className="text-sm text-green-600 font-bold">+{data.projections.monthlyInflationPercent.toFixed(2)}%</p>
                  </div>
                  <div className="bg-black dark:bg-white border-2 border-black dark:border-white p-4">
                    <p className="text-xs text-white/50 dark:text-black/50 uppercase mb-1">Annualized</p>
                    <p className="text-xl font-bold text-white dark:text-black">{data.projections.annualizedInflationFormatted}</p>
                    <p className="text-sm text-green-400 dark:text-green-600 font-bold">+{data.projections.annualizedInflationPercent.toFixed(1)}%</p>
                  </div>
                </div>
              </div>

              {/* Future Projections */}
              <div>
                <h2 className="text-lg font-bold uppercase text-black dark:text-white mb-4">Projected Total Rewards</h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-black/5 dark:bg-white/5 border-2 border-black dark:border-white p-4">
                    <p className="text-xs text-black/50 dark:text-white/50 uppercase mb-1">Total in 7 Days</p>
                    <p className="text-xl font-bold text-black dark:text-white">{data.projections.projectedIn7DaysFormatted}</p>
                  </div>
                  <div className="bg-black/5 dark:bg-white/5 border-2 border-black dark:border-white p-4">
                    <p className="text-xs text-black/50 dark:text-white/50 uppercase mb-1">Total in 30 Days</p>
                    <p className="text-xl font-bold text-black dark:text-white">{data.projections.projectedIn30DaysFormatted}</p>
                  </div>
                  <div className="bg-black/5 dark:bg-white/5 border-2 border-black dark:border-white p-4">
                    <p className="text-xs text-black/50 dark:text-white/50 uppercase mb-1">Total in 90 Days</p>
                    <p className="text-xl font-bold text-black dark:text-white">{data.projections.projectedIn90DaysFormatted}</p>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div>
                <h2 className="text-lg font-bold uppercase text-black dark:text-white mb-4">Snapshot History</h2>
                <div className="bg-white dark:bg-black border-2 border-black dark:border-white overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-black dark:bg-white text-white dark:text-black">
                          <th className="text-left px-4 py-3 font-bold text-xs uppercase">Date</th>
                          <th className="text-right px-4 py-3 font-bold text-xs uppercase">S1 Rewards</th>
                          <th className="text-right px-4 py-3 font-bold text-xs uppercase">Points Change</th>
                          <th className="text-right px-4 py-3 font-bold text-xs uppercase">TVL</th>
                          <th className="text-right px-4 py-3 font-bold text-xs uppercase">Weighted TVL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.timeline.map((snapshot, index) => (
                          <tr
                            key={index}
                            className="border-b border-black/20 dark:border-white/20 last:border-b-0"
                          >
                            <td className="px-4 py-3 text-black dark:text-white">
                              {new Date(snapshot.capturedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-black dark:text-white">
                              {snapshot.s1RewardsIssuedFormatted}
                            </td>
                            <td className="px-4 py-3 text-right text-green-600">
                              {index === 0 ? "—" : `+${snapshot.pointsChangeFormatted}`}
                            </td>
                            <td className="px-4 py-3 text-right text-black dark:text-white">
                              ${snapshot.totalTvlFormatted}
                            </td>
                            <td className="px-4 py-3 text-right text-black/60 dark:text-white/60">
                              ${(snapshot.weightedTvl / 1e6).toFixed(2)}M
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

