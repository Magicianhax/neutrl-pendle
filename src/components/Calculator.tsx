"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { MARKETS, MarketKey } from "@/lib/constants";
import { MarketData, SwapQuoteResponse } from "@/lib/types";
import {
  parseUnits,
  formatUnits,
  calculateDaysToExpiry,
  calculateDailyPoints,
  calculateTotalPoints,
  calculateEffectiveLeverage,
  formatNumber,
  formatPercent,
} from "@/lib/calculations";
import { usePointsData } from "@/hooks/usePointsData";
import { useInflationData } from "@/hooks/useInflationData";

// FDV scenarios in millions
const FDV_SCENARIOS = [50, 100, 150, 200, 250, 300, 400, 500];

// Default TGE date: sNUSD market expiry (March 5, 2026)
const DEFAULT_TGE_DATE = "2026-03-05";

// Tokenomics constants
const TOKEN_SUPPLY = 1_000_000_000; // 1 billion tokens
const DEFAULT_AIRDROP_PERCENT = 5; // 5% allocated to airdrop

function formatLargeNumber(num: number): string {
  if (num >= 1e12) return (num / 1e12).toFixed(2) + "T";
  if (num >= 1e9) return (num / 1e9).toFixed(2) + "B";
  if (num >= 1e6) return (num / 1e6).toFixed(2) + "M";
  if (num >= 1e3) return (num / 1e3).toFixed(2) + "K";
  return num.toFixed(2);
}

interface MarketInfo {
  data: MarketData | null;
  loading: boolean;
}

export default function Calculator() {
  const [selectedMarket, setSelectedMarket] = useState<MarketKey>("NUSD");
  const [inputAmount, setInputAmount] = useState<string>("1000");
  const [marketsInfo, setMarketsInfo] = useState<Record<MarketKey, MarketInfo>>({
    NUSD: { data: null, loading: true },
    sNUSD: { data: null, loading: true },
  });
  const [swapQuote, setSwapQuote] = useState<SwapQuoteResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasCalculated, setHasCalculated] = useState(false);
  const [tgeDate, setTgeDate] = useState<string>(DEFAULT_TGE_DATE);
  const [projectionMethod, setProjectionMethod] = useState<"points" | "weightedTvl">("points");
  const [airdropPercent, setAirdropPercent] = useState<string>(DEFAULT_AIRDROP_PERCENT.toString());

  // Fetch total points from Neutrl API
  const { data: pointsData, loading: pointsLoading } = usePointsData();

  // Fetch inflation data for projections
  const { data: inflationData, projectPointsAtDate } = useInflationData();

  const market = MARKETS[selectedMarket];
  const marketData = marketsInfo[selectedMarket].data;

  // Fetch market data for both markets on mount
  useEffect(() => {
    const fetchAllMarkets = async () => {
      const keys: MarketKey[] = ["NUSD", "sNUSD"];

      for (const key of keys) {
        try {
          const response = await fetch(`/api/markets?address=${MARKETS[key].address}&t=${Date.now()}`);
          if (!response.ok) throw new Error("Failed to fetch market data");
          const data = await response.json();
          setMarketsInfo(prev => ({
            ...prev,
            [key]: { data, loading: false }
          }));
        } catch (err) {
          console.error(`Error fetching ${key} market data:`, err);
          setMarketsInfo(prev => ({
            ...prev,
            [key]: { data: null, loading: false }
          }));
        }
      }
    };

    fetchAllMarkets();
  }, []);

  // Calculate button handler
  const handleCalculate = async () => {
    const amount = parseFloat(inputAmount);
    if (isNaN(amount) || amount <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    setLoading(true);
    setError(null);
    setHasCalculated(false);

    try {
      const response = await fetch("/api/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          market: market.address,
          netFromTaker: parseUnits(amount),
        }),
      });

      if (!response.ok) throw new Error("Failed to fetch swap quote");
      const data = await response.json();
      setSwapQuote(data);
      setHasCalculated(true);
    } catch (err) {
      console.error("Error fetching swap quote:", err);
      setError("Failed to get swap quote");
    } finally {
      setLoading(false);
    }
  };

  // Reset when market changes
  const handleMarketChange = (key: MarketKey) => {
    setSelectedMarket(key);
    setSwapQuote(null);
    setHasCalculated(false);
    setError(null);
  };

  // Calculate results
  const amount = parseFloat(inputAmount) || 0;
  const ytReceived = swapQuote
    ? formatUnits(swapQuote.totalTrade.netToTaker)
    : 0;
  const swapFee = swapQuote
    ? formatUnits(swapQuote.totalTrade.fee)
    : 0;
  const daysToExpiry = marketData
    ? calculateDaysToExpiry(marketData.expiry)
    : 0;
  const dailyPointsEarned = calculateDailyPoints(ytReceived, selectedMarket);
  const totalPointsEarned = calculateTotalPoints(ytReceived, selectedMarket, daysToExpiry);
  const effectiveLeverage = calculateEffectiveLeverage(amount, ytReceived);

  // Get token prices for accurate USD calculations
  const underlyingPrice = marketData?.sy?.price?.usd || 1;

  // Input value in USD
  const inputValueUsd = amount * underlyingPrice;

  // Expected return based on ytRoi from Pendle API
  // This is Pendle's calculation of expected profit if underlying APY stays constant
  const ytRoi = marketData?.ytRoi || 0;
  const expectedValueAtExpiry = inputValueUsd * (1 + ytRoi);
  const expectedPnL = expectedValueAtExpiry - inputValueUsd;

  // Calculate actual underlying yield earned from YT (Revenue)
  const underlyingApy = marketData?.underlyingApy || 0;
  const yearsToExpiry = daysToExpiry / 365;
  const underlyingYieldEarned = ytReceived * underlyingPrice * underlyingApy * yearsToExpiry;



  // Calculate projected points at TGE using data-driven methods
  const currentPoints = pointsData?.totalPoints || 0;
  const daysToTge = Math.max(
    0,
    Math.ceil((new Date(tgeDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  );

  // Get growth rates from historical data
  const pointsDailyGrowthRate = inflationData?.growthRates.pointsDailyGrowthRate || 0;
  const weightedTvlDailyGrowthRate = inflationData?.growthRates.weightedTvlDailyGrowthRate || 0;
  const dailyEmissionRate = inflationData?.inflation.actualDailyRate || 0;
  const currentWeightedTvl = inflationData?.currentState.weightedTvl || 0;

  // Select growth rate based on projection method
  const selectedGrowthRate = projectionMethod === "points"
    ? pointsDailyGrowthRate
    : weightedTvlDailyGrowthRate;

  // Calculate projected points using compound growth
  // Method 1 (Points Growth): Project total points directly using compound growth
  // Method 2 (Weighted TVL): Project weighted TVL growth, then calculate emissions
  let projectedPointsAtTge: number;

  if (projectionMethod === "points") {
    // Direct compound growth of points: P_future = P_current * (1 + rate)^days
    projectedPointsAtTge = currentPoints * Math.pow(1 + pointsDailyGrowthRate / 100, daysToTge);
  } else {
    // Weighted TVL method: emissions scale with weighted TVL
    // Calculate total growth multiplier for weighted TVL
    const totalGrowthMultiplier = Math.pow(1 + weightedTvlDailyGrowthRate / 100, daysToTge);

    // Use integral approximation for variable emission rate
    // Average emission multiplier = (growth - 1) / ln(growth)
    const avgEmissionMultiplier = totalGrowthMultiplier === 1
      ? 1
      : (totalGrowthMultiplier - 1) / (Math.log(totalGrowthMultiplier) || 1);

    // Daily emission = weighted TVL (1 point per weighted TVL per day)
    const projectedNewPoints = currentWeightedTvl * avgEmissionMultiplier * daysToTge;
    projectedPointsAtTge = currentPoints + projectedNewPoints;
  }

  // Calculate total growth for display
  const totalGrowthMultiplier = Math.pow(1 + selectedGrowthRate / 100, daysToTge);
  const projectedNewPoints = projectedPointsAtTge - currentPoints;

  // Calculate FDV-based ROI scenarios
  // Use projected points at TGE for more accurate point value calculation
  const totalSeasonPoints = projectedPointsAtTge > 0 ? projectedPointsAtTge : currentPoints;
  const airdropAllocation = parseFloat(airdropPercent) || DEFAULT_AIRDROP_PERCENT;
  const fdvScenarios = FDV_SCENARIOS.map((fdvMillion) => {
    const fdv = fdvMillion * 1_000_000;
    // Point value = (FDV × Airdrop %) / Total Season Points
    const airdropValue = fdv * (airdropAllocation / 100);
    const pointValue = totalSeasonPoints > 0 ? airdropValue / totalSeasonPoints : 0;
    const userPointsValue = totalPointsEarned * pointValue;
    // Yield Value = Gross Revenue (Cost + P&L)
    const yieldValue = inputValueUsd + expectedPnL;
    // Total = Gross Yield Revenue + Points Value
    const totalValue = yieldValue + userPointsValue;
    // ROI = (Total Value - Cost) / Cost
    const totalRoi = inputValueUsd > 0 ? (totalValue - inputValueUsd) / inputValueUsd : 0;

    // Days to Breakeven
    // Cost = (Daily Yield + Daily Points Value) * Days
    const dailyYield = daysToExpiry > 0 ? yieldValue / daysToExpiry : 0;
    const dailyPointsValue = daysToExpiry > 0 ? userPointsValue / daysToExpiry : 0;
    const dailyTotalValue = dailyYield + dailyPointsValue;
    const daysToBreakeven = dailyTotalValue > 0 ? inputValueUsd / dailyTotalValue : Infinity;

    return {
      fdv: fdvMillion,
      pointValue,
      userPointsValue,
      yieldValue,
      totalValue,
      totalRoi,
      daysToBreakeven,
    };
  });

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
        <h2 className="text-lg font-bold uppercase text-black dark:text-white">YT Calculator</h2>
        <p className="text-sm text-black/60 dark:text-white/60 uppercase tracking-wide">Select a market and enter amount to estimate returns</p>
      </div>

      {/* Market Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(Object.keys(MARKETS) as MarketKey[]).map((key) => {
          const m = MARKETS[key];
          const info = marketsInfo[key];
          const isSelected = selectedMarket === key;

          return (
            <button
              key={key}
              onClick={() => handleMarketChange(key)}
              className={`text-left p-5 border-2 transition-all ${isSelected
                ? "border-black dark:border-white bg-white dark:bg-black text-black dark:text-white border-4"
                : "border-black dark:border-white bg-white dark:bg-black text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/5"
                }`}
            >
              {info.loading ? (
                <div className="flex items-center justify-center py-6">
                  <div className="w-5 h-5 border-2 border-current border-t-transparent animate-spin" />
                </div>
              ) : info.data ? (
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <img
                        src={info.data.proIcon}
                        alt={m.name}
                        className="w-10 h-10"
                      />
                      <div>
                        <h3 className="font-bold uppercase">{m.name}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs uppercase tracking-wide text-black/60 dark:text-white/60">
                            {m.pointsMultiplier}x Points
                          </span>
                          {m.hasUnderlyingYield && (
                            <span className="text-xs uppercase font-bold text-black dark:text-white">+ Yield</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <a
                      href={m.pendleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white"
                      title="Open on Pendle"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>

                  {/* Stats Row 1 */}
                  <div className="grid grid-cols-3 gap-4 pt-3 border-t-2 border-black/20 dark:border-white/20">
                    <div>
                      <span className="text-xs uppercase tracking-wide block text-black/50 dark:text-white/50">{m.symbol} Price</span>
                      <span className="text-sm font-bold">
                        ${info.data.sy.price.usd.toFixed(4)}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs uppercase tracking-wide block text-black/50 dark:text-white/50">YT Price</span>
                      <span className="text-sm font-bold">
                        ${info.data.yt.price.usd.toFixed(4)}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs uppercase tracking-wide block text-black/50 dark:text-white/50">Leverage</span>
                      <span className="text-sm font-bold">
                        {(1 / info.data.yt.price.usd).toFixed(1)}x
                      </span>
                    </div>
                  </div>

                  {/* Stats Row 2 */}
                  <div className="grid grid-cols-3 gap-4 pt-3 border-t-2 border-black/20 dark:border-white/20">
                    <div>
                      <span className="text-xs uppercase tracking-wide block text-black/50 dark:text-white/50">Underlying APY</span>
                      <span className="text-sm font-bold">
                        {info.data.underlyingApy > 0
                          ? formatPercent(info.data.underlyingApy)
                          : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs uppercase tracking-wide block text-black/50 dark:text-white/50">Implied APY</span>
                      <span className="text-sm font-bold">
                        {formatPercent(info.data.impliedApy)}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs uppercase tracking-wide block text-black/50 dark:text-white/50">Days Left</span>
                      <span className="text-sm font-bold">
                        {calculateDaysToExpiry(info.data.expiry)}
                      </span>
                    </div>
                  </div>

                  {/* ROI Badge */}
                  <div className="flex items-center justify-between pt-3 border-t-2 border-black/20 dark:border-white/20">
                    <span className="text-xs uppercase tracking-wide text-black/50 dark:text-white/50">Expected YT ROI</span>
                    <span className={`text-sm font-bold ${info.data.ytRoi >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {info.data.ytRoi >= 0 ? '+' : ''}{formatPercent(info.data.ytRoi)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-sm opacity-50 uppercase">
                  Failed to load
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Input Section */}
      <div className="bg-white dark:bg-black border-2 border-black dark:border-white p-6">
        <label className="block text-sm font-bold uppercase text-black dark:text-white mb-3">
          Investment Amount
        </label>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <input
              type="number"
              value={inputAmount}
              onChange={(e) => {
                setInputAmount(e.target.value);
                setHasCalculated(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCalculate();
              }}
              placeholder="1000"
              className="w-full px-4 py-3 text-lg font-bold border-2 border-black dark:border-white focus:outline-none focus:ring-0 bg-white dark:bg-black text-black dark:text-white"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-black/50 dark:text-white/50 uppercase">
              {market.symbol}
            </span>
          </div>
          <button
            onClick={handleCalculate}
            disabled={loading}
            className="px-6 py-3 bg-black dark:bg-white text-white dark:text-black font-bold uppercase border-2 border-black dark:border-white hover:bg-black/80 dark:hover:bg-white/80 disabled:opacity-50 disabled:cursor-not-allowed min-w-[120px]"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-current border-t-transparent animate-spin mx-auto" />
            ) : (
              "CALCULATE"
            )}
          </button>
        </div>
        {marketData && amount > 0 && (
          <p className="mt-2 text-sm text-black/50 dark:text-white/50 text-right">
            ≈ ${formatNumber(inputValueUsd, 2)} USD
          </p>
        )}
      </div>

      {/* Points Program End Date */}
      <div className="bg-white dark:bg-black border-2 border-black dark:border-white p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <label className="block text-sm font-bold uppercase text-black dark:text-white mb-1">
              Points Program Ends
            </label>
            <p className="text-xs text-black/50 dark:text-white/50 uppercase">
              Estimate when S1 rewards stop to project total points
            </p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={tgeDate}
              onChange={(e) => setTgeDate(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              className="px-4 py-2 text-sm font-bold border-2 border-black dark:border-white focus:outline-none focus:ring-0 bg-white dark:bg-black text-black dark:text-white"
            />
            <button
              onClick={() => setTgeDate(DEFAULT_TGE_DATE)}
              className="px-3 py-2 text-xs font-bold uppercase border-2 border-black/30 dark:border-white/30 text-black/60 dark:text-white/60 hover:border-black dark:hover:border-white hover:text-black dark:hover:text-white transition-colors"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Tokenomics / Airdrop Allocation */}
        <div className="mt-4 pt-4 border-t-2 border-black/10 dark:border-white/10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <label className="block text-sm font-bold uppercase text-black dark:text-white mb-1">
                Airdrop Allocation
              </label>
              <p className="text-xs text-black/50 dark:text-white/50 uppercase">
                % of {(TOKEN_SUPPLY / 1e9).toFixed(0)}B token supply allocated to points holders
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={airdropPercent}
                  onChange={(e) => setAirdropPercent(e.target.value)}
                  min="0.1"
                  max="100"
                  step="0.5"
                  className="w-20 px-3 py-2 text-sm font-bold border-2 border-black dark:border-white focus:outline-none focus:ring-0 bg-white dark:bg-black text-black dark:text-white text-center"
                />
                <span className="text-sm font-bold text-black/60 dark:text-white/60">%</span>
              </div>
              <button
                onClick={() => setAirdropPercent(DEFAULT_AIRDROP_PERCENT.toString())}
                className="px-3 py-2 text-xs font-bold uppercase border-2 border-black/30 dark:border-white/30 text-black/60 dark:text-white/60 hover:border-black dark:hover:border-white hover:text-black dark:hover:text-white transition-colors"
              >
                Reset
              </button>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
            {[3, 5, 7, 10].map((percent) => (
              <button
                key={percent}
                onClick={() => setAirdropPercent(percent.toString())}
                className={`px-3 py-2 text-xs font-bold uppercase border-2 transition-colors ${
                  parseFloat(airdropPercent) === percent
                    ? "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white"
                    : "bg-transparent text-black/60 dark:text-white/60 border-black/30 dark:border-white/30 hover:border-black dark:hover:border-white hover:text-black dark:hover:text-white"
                }`}
              >
                {percent}% ({((TOKEN_SUPPLY * percent / 100) / 1e6).toFixed(0)}M tokens)
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-black/40 dark:text-white/40">
            At {airdropAllocation}% allocation: {((TOKEN_SUPPLY * airdropAllocation / 100) / 1e6).toFixed(1)}M tokens for airdrop
          </p>
        </div>

        {inflationData && (
          <>
            {/* Projection Method */}
            <div className="mt-4 pt-4 border-t-2 border-black/10 dark:border-white/10">
              <p className="text-xs text-black/50 dark:text-white/50 uppercase mb-3">Projection Method</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  onClick={() => setProjectionMethod("points")}
                  className={`p-4 text-left border-2 transition-colors ${
                    projectionMethod === "points"
                      ? "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white"
                      : "bg-transparent text-black dark:text-white border-black/30 dark:border-white/30 hover:border-black dark:hover:border-white"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase">Points Growth</span>
                    <span className={`text-xs font-bold ${projectionMethod === "points" ? "" : "text-green-600 dark:text-green-400"}`}>
                      {pointsDailyGrowthRate >= 0 ? "+" : ""}{pointsDailyGrowthRate.toFixed(4)}%/day
                    </span>
                  </div>
                  <p className={`text-xs ${projectionMethod === "points" ? "text-white/70 dark:text-black/70" : "text-black/50 dark:text-white/50"}`}>
                    Uses actual historical points compound growth rate
                  </p>
                </button>
                <button
                  onClick={() => setProjectionMethod("weightedTvl")}
                  className={`p-4 text-left border-2 transition-colors ${
                    projectionMethod === "weightedTvl"
                      ? "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white"
                      : "bg-transparent text-black dark:text-white border-black/30 dark:border-white/30 hover:border-black dark:hover:border-white"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase">Weighted TVL</span>
                    <span className={`text-xs font-bold ${projectionMethod === "weightedTvl" ? "" : weightedTvlDailyGrowthRate >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                      {weightedTvlDailyGrowthRate >= 0 ? "+" : ""}{weightedTvlDailyGrowthRate.toFixed(4)}%/day
                    </span>
                  </div>
                  <p className={`text-xs ${projectionMethod === "weightedTvl" ? "text-white/70 dark:text-black/70" : "text-black/50 dark:text-white/50"}`}>
                    1 point/day per weighted TVL unit
                  </p>
                </button>
              </div>
              <p className="mt-3 text-xs text-black/40 dark:text-white/40">
                Selected: {selectedGrowthRate >= 0 ? "+" : ""}{selectedGrowthRate.toFixed(4)}%/day → {((totalGrowthMultiplier - 1) * 100).toFixed(1)}% total over {daysToTge} days
              </p>
            </div>

            {/* Current State */}
            <div className="mt-4 pt-4 border-t-2 border-black/10 dark:border-white/10 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-xs text-black/50 dark:text-white/50 uppercase">Current Points</p>
                <p className="text-sm font-bold text-black dark:text-white">{formatLargeNumber(currentPoints)}</p>
              </div>
              <div>
                <p className="text-xs text-black/50 dark:text-white/50 uppercase">Weighted TVL</p>
                <p className="text-sm font-bold text-black dark:text-white">{formatLargeNumber(currentWeightedTvl)}</p>
                <p className="text-xs text-black/40 dark:text-white/40">= daily emission</p>
              </div>
              <div>
                <p className="text-xs text-black/50 dark:text-white/50 uppercase">+{daysToTge} Days</p>
                <p className="text-sm font-bold text-blue-600 dark:text-blue-400">+{formatLargeNumber(projectedNewPoints)}</p>
              </div>
              <div>
                <p className="text-xs text-black/50 dark:text-white/50 uppercase">Projected Total</p>
                <p className="text-sm font-bold text-green-600 dark:text-green-400">{formatLargeNumber(projectedPointsAtTge)}</p>
              </div>
            </div>

            {/* Inflation Rates Table */}
            <div className="mt-4 pt-4 border-t-2 border-black/10 dark:border-white/10">
              <p className="text-xs text-black/50 dark:text-white/50 uppercase mb-3">Inflation Rates (Points & %)</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-black/5 dark:bg-white/5 p-3 text-center">
                  <p className="text-xs text-black/50 dark:text-white/50 uppercase mb-1">Daily</p>
                  <p className="text-sm font-bold text-black dark:text-white">{inflationData.projections.dailyInflationFormatted}</p>
                  <p className="text-xs text-green-600 dark:text-green-400">+{inflationData.projections.dailyInflationPercent.toFixed(4)}%</p>
                </div>
                <div className="bg-black/5 dark:bg-white/5 p-3 text-center">
                  <p className="text-xs text-black/50 dark:text-white/50 uppercase mb-1">Weekly</p>
                  <p className="text-sm font-bold text-black dark:text-white">{inflationData.projections.weeklyInflationFormatted}</p>
                  <p className="text-xs text-green-600 dark:text-green-400">+{inflationData.projections.weeklyInflationPercent.toFixed(3)}%</p>
                </div>
                <div className="bg-black/5 dark:bg-white/5 p-3 text-center">
                  <p className="text-xs text-black/50 dark:text-white/50 uppercase mb-1">Monthly</p>
                  <p className="text-sm font-bold text-black dark:text-white">{inflationData.projections.monthlyInflationFormatted}</p>
                  <p className="text-xs text-green-600 dark:text-green-400">+{inflationData.projections.monthlyInflationPercent.toFixed(2)}%</p>
                </div>
                <div className="bg-black/5 dark:bg-white/5 p-3 text-center">
                  <p className="text-xs text-black/50 dark:text-white/50 uppercase mb-1">Annualized</p>
                  <p className="text-sm font-bold text-black dark:text-white">{inflationData.projections.annualizedInflationFormatted}</p>
                  <p className="text-xs text-green-600 dark:text-green-400">+{inflationData.projections.annualizedInflationPercent.toFixed(1)}%</p>
                </div>
              </div>
            </div>

            {/* TVL Stats */}
            <div className="mt-4 pt-4 border-t-2 border-black/10 dark:border-white/10 grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-xs text-black/50 dark:text-white/50 uppercase">Total TVL</p>
                <p className="text-sm font-bold text-black dark:text-white">{inflationData.currentState.totalTvlFormatted}</p>
              </div>
              <div>
                <p className="text-xs text-black/50 dark:text-white/50 uppercase">Weighted TVL</p>
                <p className="text-sm font-bold text-black dark:text-white">{inflationData.currentState.weightedTvlFormatted}</p>
              </div>
            </div>

            {/* See More Inflation Link */}
            <div className="mt-4 pt-4 border-t-2 border-black/10 dark:border-white/10 flex items-center justify-center">
              <Link
                href="/inflation"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-black dark:bg-white text-white dark:text-black text-sm font-bold uppercase border-2 border-black dark:border-white hover:bg-transparent hover:text-black dark:hover:bg-transparent dark:hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                View Full Inflation Analysis
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>
          </>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-500 text-white px-6 py-4 border-2 border-black dark:border-white font-bold uppercase text-sm">
          {error}
        </div>
      )}

      {/* Results Section */}
      {hasCalculated && !error && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">

          {/* Main Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 border-2 border-black dark:border-white bg-white dark:bg-black">
              <p className="text-xs text-black/60 dark:text-white/60 uppercase mb-1">YT Received</p>
              <p className="text-xl font-bold font-mono text-black dark:text-white">{formatNumber(ytReceived)} YT</p>
            </div>
            <div className="p-4 border-2 border-black dark:border-white bg-white dark:bg-black">
              <p className="text-xs text-black/60 dark:text-white/60 uppercase mb-1">Leverage</p>
              <p className="text-xl font-bold font-mono text-black dark:text-white">{effectiveLeverage.toFixed(1)}x</p>
            </div>
          </div>

          {/* Detailed Breakdown */}
          <div className="border-2 border-black dark:border-white bg-white dark:bg-black">
            <div className="divide-y-2 divide-black/10 dark:divide-white/10">

              {/* Swap Fee */}
              <div className="px-6 py-4 flex justify-between items-center">
                <span className="text-black/60 dark:text-white/60 uppercase text-sm">Swap Fee</span>
                <span className="text-black/50 dark:text-white/50">
                  {formatNumber(swapFee, 4)} {market.symbol}
                </span>
              </div>

              {/* Points */}
              <div className="px-6 py-4 flex justify-between items-center">
                <div>
                  <span className="text-black/60 dark:text-white/60 uppercase text-sm">Daily Points</span>
                  <span className="text-xs text-black/40 dark:text-white/40 ml-2 uppercase">
                    {market.pointsMultiplier}x
                  </span>
                </div>
                <span className="text-lg font-bold text-black dark:text-white">
                  {formatNumber(dailyPointsEarned)}/day
                </span>
              </div>

              {/* Total Points */}
              <div className="px-6 py-4 flex justify-between items-center">
                <span className="text-black/60 dark:text-white/60 uppercase text-sm">Total Points to Maturity</span>
                <span className="text-lg font-bold text-black dark:text-white">
                  {formatNumber(totalPointsEarned)}
                </span>
              </div>

              {/* Cost of Position */}
              <div className="px-6 py-4 flex justify-between items-center bg-black/5 dark:bg-white/5">
                <span className="text-black/60 dark:text-white/60 uppercase text-sm">Cost of Position</span>
                <span className="text-lg font-bold text-black dark:text-white">
                  ${inputValueUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* Estimated Gross Yield (Revenue) */}
              {marketData && (
                <div className="px-6 py-4 flex justify-between items-center">
                  <div>
                    <span className="text-black/60 dark:text-white/60 uppercase text-sm">Gross Yield Revenue</span>
                    <span className="text-xs text-black/40 dark:text-white/40 ml-2 uppercase">
                      {formatPercent(underlyingApy)} APY (before cost)
                    </span>
                  </div>
                  <span className={`text-lg font-bold ${expectedPnL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    ${(inputValueUsd + expectedPnL).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {/* Expected P&L */}
              {marketData && (
                <div className="px-6 py-4 flex justify-between items-center bg-black/5 dark:bg-white/5">
                  <div>
                    <span className="text-black dark:text-white font-bold uppercase text-sm">Expected P&L</span>
                    <span className="text-xs text-black/40 dark:text-white/40 ml-2 uppercase">
                      if APY stays at {formatPercent(marketData.underlyingApy)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-black dark:text-white">
                      {expectedPnL >= 0 ? '+' : '-'}${formatNumber(Math.abs(expectedPnL), 2)}
                    </span>
                    <span className="text-xs text-black/40 dark:text-white/40 block uppercase">
                      {ytRoi >= 0 ? '+' : ''}{formatPercent(ytRoi)} ROI
                    </span>
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="px-6 py-4 bg-black/5 dark:bg-white/5">
                <p className="text-sm text-black/70 dark:text-white/70">
                  Investing <strong className="text-black dark:text-white">{formatNumber(amount)} {market.symbol}</strong> gets you{" "}
                  <strong className="text-black dark:text-white">{formatNumber(ytReceived)} YT</strong> at{" "}
                  <strong className="text-black dark:text-white">{effectiveLeverage.toFixed(1)}x</strong> leverage, earning{" "}
                  <strong className="text-black dark:text-white">{formatNumber(totalPointsEarned)}</strong> points
                  over <strong className="text-black dark:text-white">{daysToExpiry} days</strong> ({formatNumber(dailyPointsEarned)}/day).
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Combined ROI Breakdown Table */}
      {hasCalculated && !error && pointsData && (
        <div className="bg-white dark:bg-black border-2 border-black dark:border-white overflow-hidden">
          {/* Header with Inflation Stats */}
          <div className="bg-black dark:bg-white">
            <div className="px-6 py-4 border-b border-white/10 dark:border-black/10">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h3 className="font-bold uppercase text-white dark:text-black text-lg">ROI Breakdown</h3>
                  <p className="text-xs text-white/50 dark:text-black/50 uppercase mt-0.5">
                    {airdropAllocation}% airdrop allocation ({((TOKEN_SUPPLY * airdropAllocation / 100) / 1e6).toFixed(0)}M tokens) · 1B supply
                  </p>
                </div>
                {inflationData && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/50 dark:text-black/50 uppercase">Daily Inflation:</span>
                    <span className="text-sm font-bold text-green-400 dark:text-green-600">
                      +{inflationData.projections.dailyInflationPercent.toFixed(3)}%
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Points Projection Bar */}
            {inflationData && (
              <div className="px-6 py-3 flex flex-wrap items-center justify-between gap-4 text-sm">
                <div className="flex items-center gap-6">
                  <div>
                    <span className="text-white/40 dark:text-black/40 uppercase text-xs">Your Points</span>
                    <p className="font-bold text-white dark:text-black">{formatNumber(totalPointsEarned)}</p>
                  </div>
                  <div className="text-white/30 dark:text-black/30">→</div>
                  <div>
                    <span className="text-white/40 dark:text-black/40 uppercase text-xs">Current Total</span>
                    <p className="font-bold text-white dark:text-black">{formatLargeNumber(currentPoints)}</p>
                  </div>
                  <div className="text-white/30 dark:text-black/30">→</div>
                  <div>
                    <span className="text-white/40 dark:text-black/40 uppercase text-xs">+{daysToTge} Days</span>
                    <p className="font-bold text-white/60 dark:text-black/60">+{formatLargeNumber(dailyEmissionRate * daysToTge)}</p>
                  </div>
                  <div className="text-white/30 dark:text-black/30">=</div>
                  <div>
                    <span className="text-white/40 dark:text-black/40 uppercase text-xs">Projected Total</span>
                    <p className="font-bold text-green-400 dark:text-green-600">{formatLargeNumber(totalSeasonPoints)}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {pointsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-current border-t-transparent animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-black/5 dark:bg-white/5 text-left text-xs uppercase text-black/40 dark:text-white/40 border-b border-black/10 dark:border-white/10">
                    <th className="py-3 px-6">FDV</th>
                    <th className="py-3 px-6">Point Value</th>
                    <th className="py-3 px-6">Points $</th>
                    <th className="py-3 px-6">Yield $</th>
                    <th className="py-3 px-6">Total $</th>
                    <th className="py-3 px-6 text-right">Total ROI</th>
                    <th className="py-3 px-6 text-right">Breakeven</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/20 dark:divide-white/20">
                  {fdvScenarios.map((scenario) => (
                    <tr key={scenario.fdv} className={`border-b border-black/10 dark:border-white/10 last:border-0 hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${scenario.totalRoi >= 0 ? 'bg-green-50/50 dark:bg-green-900/10' : ''}`}>
                      <td className="py-3 px-6 font-bold text-black dark:text-white">${scenario.fdv}M</td>
                      <td className="py-3 px-6 text-black/60 dark:text-white/60">${scenario.pointValue.toFixed(8)}</td>
                      <td className="py-3 px-6 font-bold text-black dark:text-white">
                        +${scenario.userPointsValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-6 font-bold text-green-600 dark:text-green-400">
                        +${scenario.yieldValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-6 font-bold text-black dark:text-white">
                        +${scenario.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className={`py-3 px-6 font-bold text-right ${scenario.totalRoi >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                        {scenario.totalRoi >= 0 ? '+' : ''}{formatPercent(scenario.totalRoi)}
                      </td>
                      <td className="py-3 px-6 font-bold text-right text-black/60 dark:text-white/60">
                        {scenario.daysToBreakeven <= daysToExpiry
                          ? `${Math.ceil(scenario.daysToBreakeven)} days`
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
