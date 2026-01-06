"use client";

import { useState } from "react";
import { POINTS_INCENTIVES, PointsIncentive } from "@/lib/pointsData";
import { formatNumber } from "@/lib/calculations";

interface IncentiveWithTvl extends PointsIncentive {
  tvlInput: string;
}

export default function PointsTable() {
  const [incentives, setIncentives] = useState<IncentiveWithTvl[]>(
    POINTS_INCENTIVES.map((inc) => ({ ...inc, tvlInput: "" }))
  );

  const handleTvlChange = (id: string, value: string) => {
    setIncentives((prev) =>
      prev.map((inc) =>
        inc.id === id ? { ...inc, tvlInput: value } : inc
      )
    );
  };

  // Calculate totals
  const calculateDailyPoints = (inc: IncentiveWithTvl): number => {
    const tvl = parseFloat(inc.tvlInput) || 0;
    return tvl * inc.pointsPerUnit;
  };

  const totalDailyPoints = incentives.reduce(
    (sum, inc) => sum + calculateDailyPoints(inc),
    0
  );

  const totalTvl = incentives.reduce(
    (sum, inc) => sum + (parseFloat(inc.tvlInput) || 0),
    0
  );

  return (
    <div className="w-full max-w-4xl mx-auto mt-12">
      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-neutral-100">
          <h2 className="text-xl font-bold text-neutral-900">
            Points Calculator
          </h2>
          <p className="text-sm text-neutral-500 mt-1">
            Enter your holdings to calculate daily Neutral points
          </p>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-neutral-100">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  Incentive
                </th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  Protocol
                </th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  Pts/Unit/Day
                </th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  Your Holdings
                </th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  Daily Points
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {incentives.map((inc) => {
                const dailyPoints = calculateDailyPoints(inc);
                return (
                  <tr key={inc.id} className="group">
                    <td className="px-6 py-4">
                      <span className="font-medium text-neutral-900">
                        {inc.name}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <a
                        href={inc.protocolUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-neutral-500"
                      >
                        {inc.protocol} ↗
                      </a>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm text-neutral-700">
                        {inc.isVariable && "Up to "}
                        {inc.pointsPerUnit}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <input
                        type="number"
                        value={inc.tvlInput}
                        onChange={(e) => handleTvlChange(inc.id, e.target.value)}
                        placeholder="0"
                        className="w-28 px-3 py-1.5 text-right text-sm border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-400"
                      />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span
                        className={`text-sm font-semibold ${
                          dailyPoints > 0 ? "text-emerald-600" : "text-neutral-400"
                        }`}
                      >
                        {dailyPoints > 0 ? formatNumber(dailyPoints) : "—"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="p-6 bg-neutral-50 border-t border-neutral-100">
          <div className="flex justify-between items-center">
            <div>
              <span className="text-sm text-neutral-500">Total Holdings</span>
              <p className="text-lg font-semibold text-neutral-900">
                {formatNumber(totalTvl)} units
              </p>
            </div>
            <div className="text-right">
              <span className="text-sm text-neutral-500">Total Daily Points</span>
              <p className="text-2xl font-bold text-emerald-600">
                {formatNumber(totalDailyPoints)}
              </p>
            </div>
          </div>

          {/* Points Projections */}
          {totalDailyPoints > 0 && (
            <div className="mt-4 pt-4 border-t border-neutral-200">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <span className="text-xs text-neutral-500 block">Weekly</span>
                  <span className="font-semibold text-neutral-900">
                    {formatNumber(totalDailyPoints * 7)}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-neutral-500 block">Monthly</span>
                  <span className="font-semibold text-neutral-900">
                    {formatNumber(totalDailyPoints * 30)}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-neutral-500 block">Yearly</span>
                  <span className="font-semibold text-neutral-900">
                    {formatNumber(totalDailyPoints * 365)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}










