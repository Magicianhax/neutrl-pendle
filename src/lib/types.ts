export interface MarketData {
  id: string;
  address: string;
  expiry: string;
  pt: {
    price: { usd: number };
    symbol: string;
  };
  yt: {
    price: { usd: number };
    symbol: string;
    address: string;
  };
  sy: {
    price: { usd: number };
    symbol: string;
  };
  underlyingApy: number;
  impliedApy: number;
  underlyingInterestApy: number;
  liquidity: { usd: number };
  proIcon: string;
  protocol: string;
  ytRoi: number;
  ptRoi: number;
  ytFloatingApy: number;
}

export interface SwapQuoteRequest {
  chainId: number;
  market: string;
  netFromTaker: string;
  type: number;
  cappedAmountToMarket: string;
}

export interface SwapQuoteResponse {
  normalOrders: unknown[];
  flashOrders: unknown[];
  limitOrderTrade: {
    netFromTaker: string;
    netToTaker: string;
    fee: string;
  };
  marketTrade: {
    netFromTaker: string;
    netToTaker: string;
    fee: string;
  };
  totalTrade: {
    netFromTaker: string;
    netToTaker: string;
    fee: string;
  };
}

export interface CalculationResult {
  ytReceived: number;
  pointsEarned: number;
  effectiveLeverage: number;
  estimatedYield: number;
  daysToExpiry: number;
  totalValue: number;
}

