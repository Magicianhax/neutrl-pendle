"use client";

import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface TimelineData {
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
}

interface GrowthRates {
  tvlDailyGrowthRate: number;
  weightedTvlDailyGrowthRate: number;
  pointsDailyGrowthRate: number;
  actualDailyRate: number; // Points emission per day
}

interface InflationChartProps {
  timeline: TimelineData[];
  growthRates?: GrowthRates;
}

type ChartMode = "absolute" | "percent";

const PROJECTION_DAYS_OPTIONS = [7, 14, 30, 60, 90];

function formatLargeNumber(num: number): string {
  if (num >= 1e12) return (num / 1e12).toFixed(1) + "T";
  if (num >= 1e9) return (num / 1e9).toFixed(1) + "B";
  if (num >= 1e6) return (num / 1e6).toFixed(1) + "M";
  if (num >= 1e3) return (num / 1e3).toFixed(1) + "K";
  return num.toFixed(0);
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateShort(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    dataKey: string;
  }>;
  label?: string;
}

interface CustomTooltipExtendedProps extends CustomTooltipProps {
  mode: ChartMode;
}

function CustomTooltip({ active, payload, label, mode }: CustomTooltipExtendedProps) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-white dark:bg-black border-2 border-black dark:border-white p-3 shadow-lg">
      <p className="text-xs font-bold text-black dark:text-white mb-2">
        {label ? formatDate(label) : ""}
      </p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2 text-xs">
          <div
            className="w-3 h-3"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-black/60 dark:text-white/60">{entry.name}:</span>
          <span className="font-bold text-black dark:text-white">
            {mode === "percent"
              ? `${entry.value >= 0 ? "+" : ""}${entry.value.toFixed(2)}%`
              : entry.dataKey === "s1RewardsIssued" || entry.dataKey === "pointsPercent"
              ? formatLargeNumber(entry.value)
              : `$${formatLargeNumber(entry.value)}`}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function InflationChart({ timeline, growthRates }: InflationChartProps) {
  const [mode, setMode] = useState<ChartMode>("percent");
  const [showProjections, setShowProjections] = useState(true);
  const [projectionDays, setProjectionDays] = useState(30);

  if (!timeline || timeline.length < 2) {
    return (
      <div className="bg-white dark:bg-black border-2 border-black dark:border-white p-6">
        <p className="text-sm text-black/60 dark:text-white/60 text-center">
          Need at least 2 data points to display chart
        </p>
      </div>
    );
  }

  // Get baseline values (first data point) and latest values
  const baseline = timeline[0];
  const latest = timeline[timeline.length - 1];

  // Generate projection data points
  const projectionData = useMemo(() => {
    if (!showProjections || !growthRates) return [];

    const projections = [];
    const latestDate = new Date(latest.capturedAt);

    // Generate daily projection points
    for (let day = 1; day <= projectionDays; day++) {
      const projDate = new Date(latestDate);
      projDate.setDate(projDate.getDate() + day);

      // Compound growth for TVL
      const tvlMultiplier = Math.pow(1 + growthRates.tvlDailyGrowthRate / 100, day);
      const weightedTvlMultiplier = Math.pow(1 + growthRates.weightedTvlDailyGrowthRate / 100, day);

      // Points: use actual daily emission rate with TVL growth adjustment
      const avgEmissionMultiplier = weightedTvlMultiplier === 1
        ? 1
        : (weightedTvlMultiplier - 1) / (Math.log(weightedTvlMultiplier) || 1);
      const projectedNewPoints = growthRates.actualDailyRate * avgEmissionMultiplier * day;

      const projectedTvl = latest.totalTvl * tvlMultiplier;
      const projectedWeightedTvl = latest.weightedTvl * weightedTvlMultiplier;
      const projectedPoints = latest.s1RewardsIssued + projectedNewPoints;

      projections.push({
        capturedAt: projDate.toISOString(),
        dateLabel: formatDate(projDate.toISOString()),
        isProjection: true,
        // Absolute values
        projectedTvl,
        projectedWeightedTvl,
        projectedPoints,
        // Percentage changes from baseline
        projectedTvlPercent: ((projectedTvl - baseline.totalTvl) / baseline.totalTvl) * 100,
        projectedWeightedTvlPercent: ((projectedWeightedTvl - baseline.weightedTvl) / baseline.weightedTvl) * 100,
        projectedPointsPercent: ((projectedPoints - baseline.s1RewardsIssued) / baseline.s1RewardsIssued) * 100,
      });
    }

    return projections;
  }, [showProjections, growthRates, latest, baseline, projectionDays]);

  // Prepare chart data with percentage changes
  const historicalData = timeline.map((item) => ({
    ...item,
    dateLabel: formatDate(item.capturedAt),
    isProjection: false,
    // Percentage changes from baseline
    tvlPercent: ((item.totalTvl - baseline.totalTvl) / baseline.totalTvl) * 100,
    weightedTvlPercent: ((item.weightedTvl - baseline.weightedTvl) / baseline.weightedTvl) * 100,
    pointsPercent: ((item.s1RewardsIssued - baseline.s1RewardsIssued) / baseline.s1RewardsIssued) * 100,
  }));

  // Combine historical and projection data
  const chartData = [...historicalData, ...projectionData];

  // Calculate domains for better scaling (including projections)
  const allTvlValues = [
    ...timeline.flatMap((t) => [t.totalTvl, t.weightedTvl]),
    ...projectionData.flatMap((p) => [p.projectedTvl, p.projectedWeightedTvl]),
  ];
  const minTvl = Math.min(...allTvlValues) * 0.95;
  const maxTvl = Math.max(...allTvlValues) * 1.05;

  const allPointsValues = [
    ...timeline.map((t) => t.s1RewardsIssued),
    ...projectionData.map((p) => p.projectedPoints),
  ];
  const minPoints = Math.min(...allPointsValues) * 0.99;
  const maxPoints = Math.max(...allPointsValues) * 1.01;

  // Calculate domains for percent mode (including projections)
  const allPercentValues = [
    ...historicalData.flatMap((t) => [t.tvlPercent, t.weightedTvlPercent, t.pointsPercent]),
    ...projectionData.flatMap((p) => [p.projectedTvlPercent, p.projectedWeightedTvlPercent, p.projectedPointsPercent]),
  ];
  const minPercent = Math.min(...allPercentValues, 0);
  const maxPercent = Math.max(...allPercentValues) * 1.1;

  return (
    <div className="bg-white dark:bg-black border-2 border-black dark:border-white p-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <h3 className="text-lg font-bold uppercase text-black dark:text-white">
          TVL & Points by Date
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          {/* Mode Toggle */}
          <button
            onClick={() => setMode("percent")}
            className={`px-3 py-1 text-xs font-bold uppercase border-2 transition-colors ${
              mode === "percent"
                ? "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white"
                : "bg-transparent text-black dark:text-white border-black dark:border-white hover:bg-black/10 dark:hover:bg-white/10"
            }`}
          >
            % Growth
          </button>
          <button
            onClick={() => setMode("absolute")}
            className={`px-3 py-1 text-xs font-bold uppercase border-2 transition-colors ${
              mode === "absolute"
                ? "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white"
                : "bg-transparent text-black dark:text-white border-black dark:border-white hover:bg-black/10 dark:hover:bg-white/10"
            }`}
          >
            Absolute
          </button>

          {/* Projection Toggle */}
          {growthRates && (
            <>
              <div className="w-px h-6 bg-black/20 dark:bg-white/20 mx-1" />
              <button
                onClick={() => setShowProjections(!showProjections)}
                className={`px-3 py-1 text-xs font-bold uppercase border-2 transition-colors ${
                  showProjections
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-transparent text-black dark:text-white border-black dark:border-white hover:bg-black/10 dark:hover:bg-white/10"
                }`}
              >
                Projections
              </button>
              {showProjections && (
                <select
                  value={projectionDays}
                  onChange={(e) => setProjectionDays(Number(e.target.value))}
                  className="px-2 py-1 text-xs font-bold uppercase border-2 border-black dark:border-white bg-white dark:bg-black text-black dark:text-white"
                >
                  {PROJECTION_DAYS_OPTIONS.map((days) => (
                    <option key={days} value={days}>
                      {days}d
                    </option>
                  ))}
                </select>
              )}
            </>
          )}
        </div>
      </div>

      <div className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 20, right: 60, left: 20, bottom: 20 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="currentColor"
              className="text-black/20 dark:text-white/20"
            />
            <XAxis
              dataKey="capturedAt"
              tickFormatter={(value) => formatDateShort(value)}
              tick={{ fill: "currentColor", fontSize: 11 }}
              className="text-black dark:text-white"
              stroke="currentColor"
            />

            {mode === "absolute" ? (
              <>
                {/* Left Y-axis for TVL */}
                <YAxis
                  yAxisId="tvl"
                  orientation="left"
                  domain={[minTvl, maxTvl]}
                  tickFormatter={(value) => `$${formatLargeNumber(value)}`}
                  tick={{ fill: "currentColor", fontSize: 11 }}
                  className="text-black dark:text-white"
                  stroke="currentColor"
                  label={{
                    value: "TVL ($)",
                    angle: -90,
                    position: "insideLeft",
                    style: { textAnchor: "middle", fill: "currentColor", fontSize: 12 },
                  }}
                />

                {/* Right Y-axis for Points */}
                <YAxis
                  yAxisId="points"
                  orientation="right"
                  domain={[minPoints, maxPoints]}
                  tickFormatter={(value) => formatLargeNumber(value)}
                  tick={{ fill: "currentColor", fontSize: 11 }}
                  className="text-black dark:text-white"
                  stroke="currentColor"
                  label={{
                    value: "Points",
                    angle: 90,
                    position: "insideRight",
                    style: { textAnchor: "middle", fill: "currentColor", fontSize: 12 },
                  }}
                />
              </>
            ) : (
              <>
                {/* Single Y-axis for percent */}
                <YAxis
                  yAxisId="percent"
                  orientation="left"
                  domain={[minPercent, maxPercent]}
                  tickFormatter={(value) => `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`}
                  tick={{ fill: "currentColor", fontSize: 11 }}
                  className="text-black dark:text-white"
                  stroke="currentColor"
                  label={{
                    value: "% Change",
                    angle: -90,
                    position: "insideLeft",
                    style: { textAnchor: "middle", fill: "currentColor", fontSize: 12 },
                  }}
                />
              </>
            )}

            <Tooltip content={<CustomTooltip mode={mode} />} />

            <Legend
              wrapperStyle={{ paddingTop: 20 }}
              formatter={(value) => (
                <span className="text-black dark:text-white text-sm font-medium">
                  {value}
                </span>
              )}
            />

            {/* Reference line at projection start */}
            {showProjections && projectionData.length > 0 && (
              <ReferenceLine
                x={latest.capturedAt}
                stroke="#3b82f6"
                strokeDasharray="3 3"
                strokeWidth={1}
              />
            )}

            {mode === "absolute" ? (
              <>
                {/* Weighted TVL line */}
                <Line
                  yAxisId="tvl"
                  type="monotone"
                  dataKey="weightedTvl"
                  name="Weighted TVL"
                  stroke="#000000"
                  strokeWidth={2}
                  dot={{ fill: "#000000", strokeWidth: 0, r: 4 }}
                  activeDot={{ r: 6, fill: "#000000" }}
                  className="dark:stroke-white dark:[&_.recharts-line-dot]:fill-white"
                  connectNulls={false}
                />

                {/* Actual TVL line */}
                <Line
                  yAxisId="tvl"
                  type="monotone"
                  dataKey="totalTvl"
                  name="Actual TVL"
                  stroke="#666666"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ fill: "#666666", strokeWidth: 0, r: 4 }}
                  activeDot={{ r: 6, fill: "#666666" }}
                  connectNulls={false}
                />

                {/* Points line */}
                <Line
                  yAxisId="points"
                  type="monotone"
                  dataKey="s1RewardsIssued"
                  name="S1 Points"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={{ fill: "#22c55e", strokeWidth: 0, r: 4 }}
                  activeDot={{ r: 6, fill: "#22c55e" }}
                  connectNulls={false}
                />

                {/* Projection lines (absolute) */}
                {showProjections && projectionData.length > 0 && (
                  <>
                    <Line
                      yAxisId="tvl"
                      type="monotone"
                      dataKey="projectedWeightedTvl"
                      name="Projected Weighted TVL"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      strokeDasharray="8 4"
                      dot={false}
                      activeDot={{ r: 4, fill: "#3b82f6" }}
                      connectNulls={false}
                    />
                    <Line
                      yAxisId="tvl"
                      type="monotone"
                      dataKey="projectedTvl"
                      name="Projected TVL"
                      stroke="#93c5fd"
                      strokeWidth={2}
                      strokeDasharray="8 4"
                      dot={false}
                      activeDot={{ r: 4, fill: "#93c5fd" }}
                      connectNulls={false}
                    />
                    <Line
                      yAxisId="points"
                      type="monotone"
                      dataKey="projectedPoints"
                      name="Projected Points"
                      stroke="#86efac"
                      strokeWidth={2}
                      strokeDasharray="8 4"
                      dot={false}
                      activeDot={{ r: 4, fill: "#86efac" }}
                      connectNulls={false}
                    />
                  </>
                )}
              </>
            ) : (
              <>
                {/* Weighted TVL % line */}
                <Line
                  yAxisId="percent"
                  type="monotone"
                  dataKey="weightedTvlPercent"
                  name="Weighted TVL %"
                  stroke="#000000"
                  strokeWidth={2}
                  dot={{ fill: "#000000", strokeWidth: 0, r: 4 }}
                  activeDot={{ r: 6, fill: "#000000" }}
                  className="dark:stroke-white dark:[&_.recharts-line-dot]:fill-white"
                  connectNulls={false}
                />

                {/* Actual TVL % line */}
                <Line
                  yAxisId="percent"
                  type="monotone"
                  dataKey="tvlPercent"
                  name="Actual TVL %"
                  stroke="#666666"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ fill: "#666666", strokeWidth: 0, r: 4 }}
                  activeDot={{ r: 6, fill: "#666666" }}
                  connectNulls={false}
                />

                {/* Points % line */}
                <Line
                  yAxisId="percent"
                  type="monotone"
                  dataKey="pointsPercent"
                  name="S1 Points %"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={{ fill: "#22c55e", strokeWidth: 0, r: 4 }}
                  activeDot={{ r: 6, fill: "#22c55e" }}
                  connectNulls={false}
                />

                {/* Projection lines (percent) */}
                {showProjections && projectionData.length > 0 && (
                  <>
                    <Line
                      yAxisId="percent"
                      type="monotone"
                      dataKey="projectedWeightedTvlPercent"
                      name="Projected Weighted TVL %"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      strokeDasharray="8 4"
                      dot={false}
                      activeDot={{ r: 4, fill: "#3b82f6" }}
                      connectNulls={false}
                    />
                    <Line
                      yAxisId="percent"
                      type="monotone"
                      dataKey="projectedTvlPercent"
                      name="Projected TVL %"
                      stroke="#93c5fd"
                      strokeWidth={2}
                      strokeDasharray="8 4"
                      dot={false}
                      activeDot={{ r: 4, fill: "#93c5fd" }}
                      connectNulls={false}
                    />
                    <Line
                      yAxisId="percent"
                      type="monotone"
                      dataKey="projectedPointsPercent"
                      name="Projected Points %"
                      stroke="#86efac"
                      strokeWidth={2}
                      strokeDasharray="8 4"
                      dot={false}
                      activeDot={{ r: 4, fill: "#86efac" }}
                      connectNulls={false}
                    />
                  </>
                )}
              </>
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Legend explanation */}
      <div className="mt-4 pt-4 border-t border-black/20 dark:border-white/20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-black/60 dark:text-white/60">
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-black dark:bg-white"></div>
            <span>
              <strong className="text-black dark:text-white">
                {mode === "percent" ? "Weighted TVL %" : "Weighted TVL"}
              </strong> - {mode === "percent" ? "% change from baseline" : "TVL with boost multipliers"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-gray-500 border-dashed border-t-2 border-gray-500"></div>
            <span>
              <strong className="text-black dark:text-white">
                {mode === "percent" ? "Actual TVL %" : "Actual TVL"}
              </strong> - {mode === "percent" ? "% change from baseline" : "Raw TVL without boosts"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-green-500"></div>
            <span>
              <strong className="text-black dark:text-white">
                {mode === "percent" ? "S1 Points %" : "S1 Points"}
              </strong> - {mode === "percent" ? "% change from baseline" : "Cumulative points issued"}
            </span>
          </div>
        </div>

        {/* Projection legend */}
        {showProjections && projectionData.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-black/60 dark:text-white/60 mt-3 pt-3 border-t border-black/10 dark:border-white/10">
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-blue-500" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #3b82f6 0, #3b82f6 8px, transparent 8px, transparent 12px)' }}></div>
              <span>
                <strong className="text-blue-500">Projected Weighted TVL</strong> - compound daily growth
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-blue-300" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #93c5fd 0, #93c5fd 8px, transparent 8px, transparent 12px)' }}></div>
              <span>
                <strong className="text-blue-300">Projected TVL</strong> - compound daily growth
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-green-300" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #86efac 0, #86efac 8px, transparent 8px, transparent 12px)' }}></div>
              <span>
                <strong className="text-green-300">Projected Points</strong> - emission with TVL growth
              </span>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-4 mt-2 text-xs text-black/40 dark:text-white/40">
          {mode === "percent" && (
            <p>Baseline: {formatDate(timeline[0].capturedAt)}</p>
          )}
          {showProjections && projectionData.length > 0 && growthRates && (
            <p>
              Projecting {projectionDays} days using observed rates:
              TVL {growthRates.tvlDailyGrowthRate >= 0 ? "+" : ""}{growthRates.tvlDailyGrowthRate.toFixed(4)}%/day,
              Points {growthRates.actualDailyRate.toLocaleString()}/day
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
