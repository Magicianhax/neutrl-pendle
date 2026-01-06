import { MARKETS, MarketKey, DECIMALS } from "./constants";

export function parseUnits(value: number): string {
  return (BigInt(Math.floor(value * 10 ** DECIMALS))).toString();
}

export function formatUnits(value: string): number {
  return Number(BigInt(value)) / 10 ** DECIMALS;
}

export function calculateDaysToExpiry(expiryDate: string): number {
  const expiry = new Date(expiryDate);
  const now = new Date();
  const diffTime = expiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

export function calculateDailyPoints(
  ytReceived: number,
  marketKey: MarketKey
): number {
  // Points per day = YT amount × market multiplier
  const multiplier = MARKETS[marketKey].pointsMultiplier;
  return ytReceived * multiplier;
}

export function calculateTotalPoints(
  ytReceived: number,
  marketKey: MarketKey,
  daysToExpiry: number
): number {
  // Total points = daily points × days to expiry
  return calculateDailyPoints(ytReceived, marketKey) * daysToExpiry;
}

export function calculateEstimatedYield(
  ytAmount: number,
  underlyingApy: number,
  daysToExpiry: number
): number {
  // Yield = YT amount * APY * (days / 365)
  return ytAmount * underlyingApy * (daysToExpiry / 365);
}

export function calculateEffectiveLeverage(
  inputAmount: number,
  ytReceived: number
): number {
  if (inputAmount === 0) return 0;
  return ytReceived / inputAmount;
}

export function formatNumber(value: number, decimals: number = 2): string {
  if (value >= 1_000_000) {
    return (value / 1_000_000).toFixed(decimals) + "M";
  }
  if (value >= 1_000) {
    return (value / 1_000).toFixed(decimals) + "K";
  }
  return value.toFixed(decimals);
}

export function formatPercent(value: number): string {
  return (value * 100).toFixed(2) + "%";
}

