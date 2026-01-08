export interface PointsIncentive {
  id: string;
  name: string;
  protocol: string;
  protocolUrl: string;
  pointsPerUnit: number;
  isVariable: boolean; // "Up to X" vs fixed
  maxPoints?: number;
  unit: string; // "day", "week", etc.
  tvl?: number; // Will be filled in
  userInput?: boolean; // If user needs to input TVL manually
}

export const POINTS_INCENTIVES: PointsIncentive[] = [
  {
    id: "pendle-snusd",
    name: "Hold Pendle sNUSD",
    protocol: "Pendle",
    protocolUrl: "https://app.pendle.finance/trade/markets/0x6d8c4de7071d5aee27fc3a810764e62a4a00ceb9/swap?view=yt&chain=ethereum",
    pointsPerUnit: 25,
    isVariable: false,
    unit: "day",
  },
  {
    id: "hold-snusd",
    name: "Hold sNUSD",
    protocol: "Neutrl",
    protocolUrl: "https://app.neutrl.fi",
    pointsPerUnit: 1,
    isVariable: false,
    unit: "day",
  },
  {
    id: "hold-nusd",
    name: "Hold NUSD",
    protocol: "Neutrl",
    protocolUrl: "https://app.neutrl.fi",
    pointsPerUnit: 5,
    isVariable: false,
    unit: "day",
  },
  {
    id: "lock-nusd",
    name: "Lock NUSD",
    protocol: "Neutrl",
    protocolUrl: "https://app.neutrl.fi",
    pointsPerUnit: 150,
    isVariable: true,
    maxPoints: 150,
    unit: "day",
  },
  {
    id: "lock-snusd",
    name: "Lock sNUSD",
    protocol: "Neutrl",
    protocolUrl: "https://app.neutrl.fi",
    pointsPerUnit: 40,
    isVariable: true,
    maxPoints: 40,
    unit: "day",
  },
  {
    id: "curve-lp-hold",
    name: "Hold Curve LP NUSD/USDC",
    protocol: "Curve",
    protocolUrl: "https://curve.fi",
    pointsPerUnit: 5,
    isVariable: false,
    unit: "day",
  },
  {
    id: "curve-lp-lock",
    name: "Lock Curve LP NUSD/USDC",
    protocol: "Curve",
    protocolUrl: "https://curve.fi",
    pointsPerUnit: 50,
    isVariable: true,
    maxPoints: 50,
    unit: "day",
  },
  {
    id: "pendle-nusd",
    name: "Hold Pendle NUSD",
    protocol: "Pendle",
    protocolUrl: "https://app.pendle.finance/trade/markets/0x6d520a943a4da0784917a2e71defe95248a1daa1/swap?view=yt&chain=ethereum",
    pointsPerUnit: 50,
    isVariable: false,
    unit: "day",
  },
  {
    id: "hold-upnusd",
    name: "Hold upNUSD",
    protocol: "K3 Capital",
    protocolUrl: "https://k3.capital",
    pointsPerUnit: 18,
    isVariable: false,
    unit: "day",
  },
];

