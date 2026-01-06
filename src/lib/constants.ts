export const MARKETS = {
  NUSD: {
    address: "0x6d520a943a4da0784917a2e71defe95248a1daa1",
    name: "NUSD",
    symbol: "NUSD",
    pointsMultiplier: 50,
    hasUnderlyingYield: false,
    description: "50X YT Neutral Points",
    pendleUrl: "https://app.pendle.finance/trade/markets/0x6d520a943a4da0784917a2e71defe95248a1daa1/swap?view=yt&chain=ethereum",
  },
  sNUSD: {
    address: "0x6d8c4de7071d5aee27fc3a810764e62a4a00ceb9",
    name: "sNUSD",
    symbol: "sNUSD",
    pointsMultiplier: 25,
    hasUnderlyingYield: true,
    description: "25X YT Neutral Points + Underlying Yield",
    pendleUrl: "https://app.pendle.finance/trade/markets/0x6d8c4de7071d5aee27fc3a810764e62a4a00ceb9/swap?view=yt&chain=ethereum",
  },
} as const;

export type MarketKey = keyof typeof MARKETS;

export const CHAIN_ID = 1; // Ethereum Mainnet

export const PENDLE_API_BASE = "https://api-v2.pendle.finance";

export const DECIMALS = 18;

