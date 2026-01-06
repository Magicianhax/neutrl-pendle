"use client";

import { useState, useMemo } from "react";

interface GrowthData {
  // Historical rates (% per day)
  tvlDailyGrowthRate: number;
  pointsDailyGrowthRate: number;
  weightedTvlDailyGrowthRate: number;
  // Current values
  currentPoints: number;
  currentTvl: number;
  currentWeightedTvl: number;
  // Observed emission
  actualDailyRate: number;
  // Date context
  dataFromDate: string;
  dataToDate: string;
}

interface PointsPredictorProps {
  growthData: GrowthData;
}

type TvlMode = "same" | "custom" | "auto";

function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateInput(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

export default function PointsPredictor({ growthData }: PointsPredictorProps) {
  const [targetDate, setTargetDate] = useState<string>(() => {
    // Default to Jan 31, 2025 (common points snapshot date)
    return "2025-01-31";
  });

  const [tvlMode, setTvlMode] = useState<TvlMode>("auto");
  const [customTotalGrowth, setCustomTotalGrowth] = useState<string>("0"); // % total growth

  const predictions = useMemo(() => {
    const currentDate = new Date(growthData.dataToDate);
    const target = new Date(targetDate);

    // Calculate days between current data date and target date
    const daysBetween = Math.floor((target.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysBetween <= 0) {
      return {
        targetDate: formatDateInput(targetDate),
        currentDate: formatDateShort(growthData.dataToDate),
        daysBetween: 0,
        isValid: false,
        predictedPoints: growthData.currentPoints,
        predictedTvl: growthData.currentTvl,
        predictedWeightedTvl: growthData.currentWeightedTvl,
        pointsGrowth: 0,
        pointsGrowthPercent: 0,
        tvlGrowth: 0,
        tvlGrowthPercent: 0,
        tvlGrowthRateUsed: 0,
      };
    }

    // Determine TVL growth multiplier based on mode
    let tvlMultiplier: number;
    const customTotalGrowthValue = parseFloat(customTotalGrowth) || 0;

    switch (tvlMode) {
      case "same":
        tvlMultiplier = 1; // No growth
        break;
      case "custom":
        // Direct total growth percentage
        tvlMultiplier = 1 + customTotalGrowthValue / 100;
        break;
      case "auto":
      default:
        // Use observed daily rate compounded
        tvlMultiplier = Math.pow(1 + growthData.tvlDailyGrowthRate / 100, daysBetween);
        break;
    }

    // Calculate equivalent daily rate for display
    const dailyTvlGrowthRate = daysBetween > 0
      ? (Math.pow(tvlMultiplier, 1 / daysBetween) - 1) * 100
      : 0;

    // Project TVL using the multiplier
    const predictedTvl = growthData.currentTvl * tvlMultiplier;
    const predictedWeightedTvl = growthData.currentWeightedTvl * tvlMultiplier;

    // For points projection, account for changing TVL affecting emission
    let predictedPoints = growthData.currentPoints;

    if (tvlMultiplier === 1) {
      // Simple case: TVL constant, linear emission
      predictedPoints += growthData.actualDailyRate * daysBetween;
    } else {
      // TVL grows, so emission grows with it
      // Use integral approximation for better accuracy
      const avgEmissionMultiplier = (tvlMultiplier - 1) / (Math.log(tvlMultiplier) || 1);
      predictedPoints += growthData.actualDailyRate * avgEmissionMultiplier * daysBetween;
    }

    const pointsGrowth = predictedPoints - growthData.currentPoints;
    const pointsGrowthPercent = (pointsGrowth / growthData.currentPoints) * 100;
    const tvlGrowth = predictedTvl - growthData.currentTvl;
    const tvlGrowthPercent = (tvlGrowth / growthData.currentTvl) * 100;

    return {
      targetDate: formatDateInput(targetDate),
      currentDate: formatDateShort(growthData.dataToDate),
      daysBetween,
      isValid: true,
      predictedPoints,
      predictedTvl,
      predictedWeightedTvl,
      pointsGrowth,
      pointsGrowthPercent,
      tvlGrowth,
      tvlGrowthPercent,
      tvlGrowthRateUsed: dailyTvlGrowthRate,
    };
  }, [targetDate, tvlMode, customTotalGrowth, growthData]);

  const formatNumber = (num: number): string => {
    if (num >= 1e12) return (num / 1e12).toFixed(2) + "T";
    if (num >= 1e9) return (num / 1e9).toFixed(2) + "B";
    if (num >= 1e6) return (num / 1e6).toFixed(2) + "M";
    if (num >= 1e3) return (num / 1e3).toFixed(2) + "K";
    return num.toFixed(0);
  };

  // Calculate min date (day after latest data)
  const minDate = useMemo(() => {
    const nextDay = new Date(growthData.dataToDate);
    nextDay.setDate(nextDay.getDate() + 1);
    return nextDay.toISOString().split("T")[0];
  }, [growthData.dataToDate]);

  // Calculate max date (1 year from now)
  const maxDate = useMemo(() => {
    const oneYear = new Date();
    oneYear.setFullYear(oneYear.getFullYear() + 1);
    return oneYear.toISOString().split("T")[0];
  }, []);

  // Observed daily growth rate for display
  const observedDailyGrowth = growthData.tvlDailyGrowthRate;

  return (
    <div className="bg-white dark:bg-black border-2 border-black dark:border-white p-6">
      <h2 className="text-lg font-bold uppercase text-black dark:text-white mb-2">
        Points Predictor
      </h2>
      <p className="text-xs text-black/50 dark:text-white/50 mb-6">
        Data from <strong className="text-black dark:text-white">{formatDateShort(growthData.dataFromDate)}</strong> to{" "}
        <strong className="text-black dark:text-white">{formatDateShort(growthData.dataToDate)}</strong>
      </p>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Date Picker */}
        <div>
          <label className="block text-xs font-bold uppercase text-black/60 dark:text-white/60 mb-2">
            Predict Points On
          </label>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            min={minDate}
            max={maxDate}
            className="w-full px-4 py-3 bg-white dark:bg-black border-2 border-black dark:border-white text-black dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
          />
          {predictions.isValid ? (
            <p className="text-xs text-black/40 dark:text-white/40 mt-1">
              {predictions.targetDate}
            </p>
          ) : (
            <p className="text-xs text-red-500 mt-1">
              Select a date after {formatDateShort(growthData.dataToDate)}
            </p>
          )}
        </div>

        {/* TVL Assumption */}
        <div>
          <label className="block text-xs font-bold uppercase text-black/60 dark:text-white/60 mb-2">
            TVL Growth Assumption
          </label>
          <div className="space-y-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="tvlMode"
                value="same"
                checked={tvlMode === "same"}
                onChange={() => setTvlMode("same")}
                className="w-4 h-4 accent-black dark:accent-white"
              />
              <span className="text-sm text-black dark:text-white">TVL stays the same (0% growth)</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="tvlMode"
                value="auto"
                checked={tvlMode === "auto"}
                onChange={() => setTvlMode("auto")}
                className="w-4 h-4 accent-black dark:accent-white"
              />
              <span className="text-sm text-black dark:text-white">
                Use observed rate ({observedDailyGrowth.toFixed(4)}%/day)
              </span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="tvlMode"
                value="custom"
                checked={tvlMode === "custom"}
                onChange={() => setTvlMode("custom")}
                className="w-4 h-4 accent-black dark:accent-white"
              />
              <span className="text-sm text-black dark:text-white">Custom total growth</span>
            </label>

            {tvlMode === "custom" && (
              <div className="ml-7">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={customTotalGrowth}
                    onChange={(e) => setCustomTotalGrowth(e.target.value)}
                    step="1"
                    className="w-24 px-2 py-1 bg-white dark:bg-black border-2 border-black dark:border-white text-black dark:text-white font-bold text-center focus:outline-none"
                  />
                  <span className="text-sm text-black/60 dark:text-white/60">% total</span>
                </div>
                {predictions.isValid && parseFloat(customTotalGrowth) !== 0 && (
                  <p className="text-xs text-black/40 dark:text-white/40 mt-1">
                    ≈ {predictions.tvlGrowthRateUsed >= 0 ? "+" : ""}{predictions.tvlGrowthRateUsed.toFixed(4)}% per day over {predictions.daysBetween} days
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Predictions */}
      {predictions.isValid && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-black dark:bg-white p-4">
              <p className="text-xs text-white/50 dark:text-black/50 uppercase mb-1">
                Points on {formatDateShort(targetDate)}
              </p>
              <p className="text-2xl font-bold text-white dark:text-black">
                {formatNumber(predictions.predictedPoints)}
              </p>
              <p className="text-xs text-green-400 dark:text-green-600 font-bold">
                +{formatNumber(predictions.pointsGrowth)} ({predictions.pointsGrowthPercent.toFixed(1)}%)
              </p>
            </div>

            <div className="bg-black/5 dark:bg-white/5 border-2 border-black dark:border-white p-4">
              <p className="text-xs text-black/50 dark:text-white/50 uppercase mb-1">
                TVL on {formatDateShort(targetDate)}
              </p>
              <p className="text-2xl font-bold text-black dark:text-white">
                ${formatNumber(predictions.predictedTvl)}
              </p>
              <p className={`text-xs font-bold ${predictions.tvlGrowthPercent >= 0 ? "text-green-600" : "text-red-600"}`}>
                {predictions.tvlGrowthPercent >= 0 ? "+" : ""}{predictions.tvlGrowthPercent.toFixed(1)}%
              </p>
            </div>

            <div className="bg-black/5 dark:bg-white/5 border-2 border-black dark:border-white p-4">
              <p className="text-xs text-black/50 dark:text-white/50 uppercase mb-1">
                Weighted TVL on {formatDateShort(targetDate)}
              </p>
              <p className="text-2xl font-bold text-black dark:text-white">
                ${formatNumber(predictions.predictedWeightedTvl)}
              </p>
              <p className={`text-xs font-bold ${predictions.tvlGrowthPercent >= 0 ? "text-green-600" : "text-red-600"}`}>
                {predictions.tvlGrowthPercent >= 0 ? "+" : ""}{predictions.tvlGrowthPercent.toFixed(1)}%
              </p>
            </div>

            <div className="bg-black/5 dark:bg-white/5 border-2 border-black dark:border-white p-4">
              <p className="text-xs text-black/50 dark:text-white/50 uppercase mb-1">Growth Rate Used</p>
              <p className="text-2xl font-bold text-black dark:text-white">
                {predictions.tvlGrowthRateUsed.toFixed(4)}%
              </p>
              <p className="text-xs text-black/40 dark:text-white/40">per day (compound)</p>
            </div>
          </div>

          {/* Calculation Breakdown */}
          <div className="bg-black/5 dark:bg-white/5 border-2 border-black dark:border-white p-4">
            <h3 className="text-sm font-bold uppercase text-black dark:text-white mb-3">Current Values (as of {formatDateShort(growthData.dataToDate)})</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <p className="text-black/50 dark:text-white/50 uppercase">S1 Points</p>
                <p className="font-bold text-black dark:text-white">{formatNumber(growthData.currentPoints)}</p>
              </div>
              <div>
                <p className="text-black/50 dark:text-white/50 uppercase">Total TVL</p>
                <p className="font-bold text-black dark:text-white">${formatNumber(growthData.currentTvl)}</p>
              </div>
              <div>
                <p className="text-black/50 dark:text-white/50 uppercase">Weighted TVL</p>
                <p className="font-bold text-black dark:text-white">${formatNumber(growthData.currentWeightedTvl)}</p>
              </div>
              <div>
                <p className="text-black/50 dark:text-white/50 uppercase">Observed Emission</p>
                <p className="font-bold text-black dark:text-white">{formatNumber(growthData.actualDailyRate)}/day</p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Disclaimer */}
      <p className="text-xs text-black/40 dark:text-white/40 mt-4">
        Predictions are estimates based on observed growth rates between {formatDateShort(growthData.dataFromDate)} and {formatDateShort(growthData.dataToDate)}.
        Actual results may vary based on protocol changes and market conditions.
      </p>
    </div>
  );
}
