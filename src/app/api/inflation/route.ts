import { NextResponse } from "next/server";
import { getAllSnapshots, TvlSnapshot } from "@/lib/supabase";
import fs from "fs";
import path from "path";

interface HistorySnapshot {
  capturedAt: string;
  capturedAtUnix: number;
  summary: {
    s1RewardsIssued: number;
    s1RewardsIssuedFormatted?: string;
    participantCount: number;
    totalTvl: number;
    totalTvlFormatted?: string;
    weightedTvl: number;
    weightedTvlFormatted?: string;
    estDailyPoints: number;
    estDailyPointsFormatted?: string;
    estWeeklyPoints: number;
    estWeeklyPointsFormatted?: string;
    estMonthlyPoints: number;
    estMonthlyPointsFormatted?: string;
  };
}

function formatLargeNumber(num: number): string {
  if (num >= 1e12) return (num / 1e12).toFixed(2) + "T";
  if (num >= 1e9) return (num / 1e9).toFixed(2) + "B";
  if (num >= 1e6) return (num / 1e6).toFixed(2) + "M";
  if (num >= 1e3) return (num / 1e3).toFixed(2) + "K";
  return num.toFixed(2);
}

// Get calendar date (YYYY-MM-DD) from ISO string
function getCalendarDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toISOString().split("T")[0];
}

// Calculate calendar days between two dates
function getCalendarDaysDiff(fromDate: string, toDate: string): number {
  const from = new Date(getCalendarDate(fromDate));
  const to = new Date(getCalendarDate(toDate));
  const diffTime = to.getTime() - from.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

// Convert Supabase snapshot to HistorySnapshot format
function convertSnapshot(snapshot: TvlSnapshot): HistorySnapshot {
  return {
    capturedAt: snapshot.captured_at,
    capturedAtUnix: snapshot.captured_at_unix,
    summary: {
      s1RewardsIssued: snapshot.summary.s1RewardsIssued,
      s1RewardsIssuedFormatted: formatLargeNumber(snapshot.summary.s1RewardsIssued),
      participantCount: snapshot.summary.participantCount,
      totalTvl: snapshot.summary.totalTvl,
      totalTvlFormatted: formatLargeNumber(snapshot.summary.totalTvl),
      weightedTvl: snapshot.summary.weightedTvl,
      weightedTvlFormatted: formatLargeNumber(snapshot.summary.weightedTvl),
      estDailyPoints: snapshot.summary.estDailyPoints,
      estDailyPointsFormatted: formatLargeNumber(snapshot.summary.estDailyPoints),
      estWeeklyPoints: snapshot.summary.estWeeklyPoints,
      estWeeklyPointsFormatted: formatLargeNumber(snapshot.summary.estWeeklyPoints),
      estMonthlyPoints: snapshot.summary.estMonthlyPoints,
      estMonthlyPointsFormatted: formatLargeNumber(snapshot.summary.estMonthlyPoints),
    },
  };
}

// Fallback: Load from local JSON file
function loadFromLocalFile(): HistorySnapshot[] | null {
  try {
    const historyPath = path.join(process.cwd(), "data", "tvl-history.json");
    if (fs.existsSync(historyPath)) {
      return JSON.parse(fs.readFileSync(historyPath, "utf8"));
    }
  } catch (error) {
    console.error("Error loading local file:", error);
  }
  return null;
}

export async function GET() {
  try {
    let historyData: HistorySnapshot[] = [];

    // Try to fetch from Supabase first
    const supabaseSnapshots = await getAllSnapshots(500);

    if (supabaseSnapshots.length > 0) {
      // Convert Supabase format to HistorySnapshot format
      historyData = supabaseSnapshots.map(convertSnapshot);
    } else {
      // Fallback to local JSON file
      const localData = loadFromLocalFile();
      if (localData) {
        historyData = localData;
      }
    }

    if (historyData.length < 2) {
      return NextResponse.json({
        error: "Need at least 2 snapshots to calculate inflation",
        snapshotCount: historyData.length
      }, { status: 400 });
    }

    // Sort by timestamp (oldest first)
    historyData.sort((a, b) => a.capturedAtUnix - b.capturedAtUnix);

    const oldest = historyData[0];
    const latest = historyData[historyData.length - 1];

    // Calculate calendar days (not time-based)
    const totalDays = getCalendarDaysDiff(oldest.capturedAt, latest.capturedAt);
    // Use at least 1 day for calculations to avoid division by zero
    const daysForCalc = Math.max(totalDays, 1);

    // Points inflation
    const pointsIssued = latest.summary.s1RewardsIssued - oldest.summary.s1RewardsIssued;
    const actualDailyRate = pointsIssued / daysForCalc;

    // Estimated vs actual comparison
    const avgEstDailyPoints = (oldest.summary.estDailyPoints + latest.summary.estDailyPoints) / 2;
    const efficiencyRate = (actualDailyRate / avgEstDailyPoints) * 100;

    // TVL changes
    const tvlChange = latest.summary.totalTvl - oldest.summary.totalTvl;
    const tvlChangePercent = (tvlChange / oldest.summary.totalTvl) * 100;

    const weightedTvlChange = latest.summary.weightedTvl - oldest.summary.weightedTvl;
    const weightedTvlChangePercent = (weightedTvlChange / oldest.summary.weightedTvl) * 100;

    // Participant changes
    const participantChange = latest.summary.participantCount - oldest.summary.participantCount;

    // Projections based on actual rate
    const projectedDailyInflation = actualDailyRate;
    const projectedWeeklyInflation = actualDailyRate * 7;
    const projectedMonthlyInflation = actualDailyRate * 30;

    // Future projections
    const currentTotal = latest.summary.s1RewardsIssued;
    const projectedIn7Days = currentTotal + (actualDailyRate * 7);
    const projectedIn30Days = currentTotal + (actualDailyRate * 30);
    const projectedIn90Days = currentTotal + (actualDailyRate * 90);

    // Inflation percentages (relative to current total)
    const dailyInflationPercent = (actualDailyRate / currentTotal) * 100;
    const weeklyInflationPercent = (projectedWeeklyInflation / currentTotal) * 100;
    const monthlyInflationPercent = (projectedMonthlyInflation / currentTotal) * 100;
    const annualizedInflationPercent = dailyInflationPercent * 365;
    const annualizedInflation = projectedDailyInflation * 365;

    // Calculate daily growth rates (% per day) based on calendar days
    const tvlDailyGrowthRate = daysForCalc > 0
      ? (Math.pow(latest.summary.totalTvl / oldest.summary.totalTvl, 1 / daysForCalc) - 1) * 100
      : 0;
    const weightedTvlDailyGrowthRate = daysForCalc > 0
      ? (Math.pow(latest.summary.weightedTvl / oldest.summary.weightedTvl, 1 / daysForCalc) - 1) * 100
      : 0;
    const pointsDailyGrowthRate = daysForCalc > 0
      ? (Math.pow(latest.summary.s1RewardsIssued / oldest.summary.s1RewardsIssued, 1 / daysForCalc) - 1) * 100
      : 0;

    // Build timeline data for chart (grouped by calendar date)
    const timeline = historyData.map((snapshot, index) => {
      const prev = index > 0 ? historyData[index - 1] : null;
      const pointsChange = prev ? snapshot.summary.s1RewardsIssued - prev.summary.s1RewardsIssued : 0;

      return {
        capturedAt: snapshot.capturedAt,
        date: getCalendarDate(snapshot.capturedAt),
        s1RewardsIssued: snapshot.summary.s1RewardsIssued,
        s1RewardsIssuedFormatted: snapshot.summary.s1RewardsIssuedFormatted || formatLargeNumber(snapshot.summary.s1RewardsIssued),
        totalTvl: snapshot.summary.totalTvl,
        totalTvlFormatted: snapshot.summary.totalTvlFormatted || formatLargeNumber(snapshot.summary.totalTvl),
        weightedTvl: snapshot.summary.weightedTvl,
        weightedTvlFormatted: snapshot.summary.weightedTvlFormatted || formatLargeNumber(snapshot.summary.weightedTvl),
        estDailyPoints: snapshot.summary.estDailyPoints,
        participantCount: snapshot.summary.participantCount,
        pointsChange,
        pointsChangeFormatted: formatLargeNumber(pointsChange),
      };
    });

    const result = {
      timestamp: new Date().toISOString(),
      dataSource: supabaseSnapshots.length > 0 ? "supabase" : "local",
      dataRange: {
        from: oldest.capturedAt,
        to: latest.capturedAt,
        fromDate: getCalendarDate(oldest.capturedAt),
        toDate: getCalendarDate(latest.capturedAt),
        totalDays,
        snapshotCount: historyData.length,
      },
      currentState: {
        s1RewardsIssued: latest.summary.s1RewardsIssued,
        s1RewardsIssuedFormatted: latest.summary.s1RewardsIssuedFormatted || formatLargeNumber(latest.summary.s1RewardsIssued),
        totalTvl: latest.summary.totalTvl,
        totalTvlFormatted: latest.summary.totalTvlFormatted || formatLargeNumber(latest.summary.totalTvl),
        weightedTvl: latest.summary.weightedTvl,
        weightedTvlFormatted: latest.summary.weightedTvlFormatted || formatLargeNumber(latest.summary.weightedTvl),
        participantCount: latest.summary.participantCount,
        estDailyPoints: latest.summary.estDailyPoints,
        estDailyPointsFormatted: latest.summary.estDailyPointsFormatted || formatLargeNumber(latest.summary.estDailyPoints),
      },
      inflation: {
        pointsIssuedInPeriod: pointsIssued,
        pointsIssuedInPeriodFormatted: formatLargeNumber(pointsIssued),
        actualDailyRate,
        actualDailyRateFormatted: formatLargeNumber(actualDailyRate),
        avgEstDailyPoints,
        avgEstDailyPointsFormatted: formatLargeNumber(avgEstDailyPoints),
        efficiencyRate, // actual vs estimated %
      },
      tvlChanges: {
        totalTvlChange: tvlChange,
        totalTvlChangeFormatted: formatLargeNumber(Math.abs(tvlChange)),
        totalTvlChangePercent: tvlChangePercent,
        weightedTvlChange,
        weightedTvlChangeFormatted: formatLargeNumber(Math.abs(weightedTvlChange)),
        weightedTvlChangePercent: weightedTvlChangePercent,
        participantChange,
      },
      projections: {
        dailyInflation: projectedDailyInflation,
        dailyInflationFormatted: formatLargeNumber(projectedDailyInflation),
        dailyInflationPercent,
        weeklyInflation: projectedWeeklyInflation,
        weeklyInflationFormatted: formatLargeNumber(projectedWeeklyInflation),
        weeklyInflationPercent,
        monthlyInflation: projectedMonthlyInflation,
        monthlyInflationFormatted: formatLargeNumber(projectedMonthlyInflation),
        monthlyInflationPercent,
        annualizedInflation,
        annualizedInflationFormatted: formatLargeNumber(annualizedInflation),
        annualizedInflationPercent,
        projectedIn7Days,
        projectedIn7DaysFormatted: formatLargeNumber(projectedIn7Days),
        projectedIn30Days,
        projectedIn30DaysFormatted: formatLargeNumber(projectedIn30Days),
        projectedIn90Days,
        projectedIn90DaysFormatted: formatLargeNumber(projectedIn90Days),
      },
      growthRates: {
        tvlDailyGrowthRate,
        tvlWeeklyGrowthRate: tvlDailyGrowthRate * 7,
        weightedTvlDailyGrowthRate,
        weightedTvlWeeklyGrowthRate: weightedTvlDailyGrowthRate * 7,
        pointsDailyGrowthRate,
        pointsWeeklyGrowthRate: pointsDailyGrowthRate * 7,
      },
      timeline,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error analyzing inflation:", error);
    return NextResponse.json({ error: "Failed to analyze inflation data" }, { status: 500 });
  }
}
