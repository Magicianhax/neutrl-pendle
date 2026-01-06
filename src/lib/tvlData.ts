export interface TvlRow {
  id: string;
  name: string;
  type: "header" | "row" | "subrow" | "total";
  status?: "active" | "matured" | "excluded" | "locked" | "display";
  boost?: number;
  baseBoost?: number; // For subrows: the parent's base boost to multiply with
  category?: string;
}

export interface TvlCategory {
  id: string;
  title: string;
  warning?: string;
  rows: TvlRow[];
}

export const TVL_CATEGORIES: TvlCategory[] = [
  {
    id: "feb-2026",
    title: "FEBRUARY 26, 2026 MARKET [ACTIVE]",
    rows: [
      // YT parent row shows gross TVL - display only, not counted in total
      { id: "yt-nusd-feb26", name: "YT NUSD Feb 26 (Gross)", type: "row", status: "display", boost: 50, category: "pendle" },
      // Fee shows what Pendle takes - earns points (goes to Pendle)
      { id: "pendle-fee-nusd", name: "Pendle Fee (5%)", type: "subrow", status: "active", boost: 50 },
      // NET shows final amount after fee - THIS earns points and counts in total
      { id: "yt-nusd-feb26-net", name: "YT NUSD Feb 26 NET", type: "subrow", status: "active", boost: 50 },
      // LP parent row shows full SY TVL - display only, not counted in total
      { id: "lp-nusd-feb26", name: "LP NUSD Feb 26 (SY Portion)", type: "row", status: "display", boost: 50, category: "pendle" },
      // 20% excluded from points - display only
      { id: "lp-excluded-nusd", name: "Excluded (20%)", type: "subrow", status: "display", boost: 0 },
      // 80% earns points
      { id: "lp-nusd-feb26-net", name: "LP NUSD Feb 26 (80%)", type: "subrow", status: "active", boost: 50 },
      { id: "pt-nusd-feb26", name: "PT NUSD Feb 26", type: "row", status: "excluded", category: "pendle" },
    ],
  },
  {
    id: "mar-2026",
    title: "MARCH 5, 2026 MARKET [ACTIVE]",
    rows: [
      // YT parent row shows gross TVL - display only, not counted in total
      { id: "yt-snusd-mar26", name: "YT sNUSD Mar 5 (Gross)", type: "row", status: "display", boost: 25, category: "pendle" },
      // Fee shows what Pendle takes - earns points (goes to Pendle)
      { id: "pendle-fee-snusd", name: "Pendle Fee (5%)", type: "subrow", status: "active", boost: 25 },
      // NET shows final amount after fee - THIS earns points and counts in total
      { id: "yt-snusd-mar26-net", name: "YT sNUSD Mar 5 NET", type: "subrow", status: "active", boost: 25 },
      // LP parent row shows full SY TVL - display only, not counted in total
      { id: "lp-snusd-mar26", name: "LP sNUSD Mar 5 (SY Portion)", type: "row", status: "display", boost: 25, category: "pendle" },
      // 20% excluded from points - display only
      { id: "lp-excluded-snusd", name: "Excluded (20%)", type: "subrow", status: "display", boost: 0 },
      // 80% earns points
      { id: "lp-snusd-mar26-net", name: "LP sNUSD Mar 5 (80%)", type: "subrow", status: "active", boost: 25 },
      { id: "pt-snusd-mar26", name: "PT sNUSD Mar 5", type: "row", status: "excluded", category: "pendle" },
    ],
  },
  {
    id: "hold",
    title: "HOLD",
    rows: [
      // NUSD (unstaked) - Base: 5x, shows unlocked amount
      { id: "hold-nusd", name: "Hold NUSD (unlocked)", type: "row", status: "active", boost: 5, category: "neutrl" },
      // NUSD Locked - by duration bucket (base 5x × lock boost)
      { id: "lock-nusd-3mo", name: "Lock NUSD (3 mo)", type: "subrow", status: "locked", boost: 6, baseBoost: 5, category: "neutrl" },
      { id: "lock-nusd-6mo", name: "Lock NUSD (6 mo)", type: "subrow", status: "locked", boost: 15, baseBoost: 5, category: "neutrl" },
      { id: "lock-nusd-9mo", name: "Lock NUSD (9 mo)", type: "subrow", status: "locked", boost: 25, baseBoost: 5, category: "neutrl" },
      { id: "lock-nusd-12mo", name: "Lock NUSD (12 mo)", type: "subrow", status: "locked", boost: 30, baseBoost: 5, category: "neutrl" },
      // sNUSD (staked) - Base: 1x, shows unlocked amount
      { id: "hold-snusd", name: "Hold sNUSD (unlocked)", type: "row", status: "active", boost: 1, category: "neutrl" },
      // sNUSD Locked - by duration bucket (base 1x × lock boost)
      { id: "lock-snusd-3mo", name: "Lock sNUSD (3 mo)", type: "subrow", status: "locked", boost: 8, baseBoost: 1, category: "neutrl" },
      { id: "lock-snusd-6mo", name: "Lock sNUSD (6 mo)", type: "subrow", status: "locked", boost: 20, baseBoost: 1, category: "neutrl" },
      { id: "lock-snusd-9mo", name: "Lock sNUSD (9 mo)", type: "subrow", status: "locked", boost: 30, baseBoost: 1, category: "neutrl" },
      { id: "lock-snusd-12mo", name: "Lock sNUSD (12 mo)", type: "subrow", status: "locked", boost: 40, baseBoost: 1, category: "neutrl" },
      // Curve LP - Base: 5x, shows unlocked amount
      { id: "hold-curve-lp", name: "Curve LP (unlocked)", type: "row", status: "active", boost: 5, category: "curve" },
      { id: "curve-nusd-breakdown", name: "NUSD in pool", type: "subrow", status: "display", boost: 5, category: "curve" },
      { id: "curve-usdc-breakdown", name: "USDC in pool", type: "subrow", status: "display", boost: 5, category: "curve" },
      // Curve LP Locked - by duration bucket (base 5x × lock boost)
      { id: "lock-curve-3mo", name: "Lock Curve LP (3 mo)", type: "subrow", status: "locked", boost: 4, baseBoost: 5, category: "curve" },
      { id: "lock-curve-6mo", name: "Lock Curve LP (5-6 mo Max)", type: "subrow", status: "locked", boost: 10, baseBoost: 5, category: "curve" },
      // upNUSD - 28 points per token
      { id: "hold-upnusd", name: "Hold upNUSD", type: "row", status: "active", boost: 28, category: "k3" },
    ],
  },
];

export interface TvlInputData {
  [key: string]: {
    tvlAmount: number;
    isLocked?: boolean;
  };
}

