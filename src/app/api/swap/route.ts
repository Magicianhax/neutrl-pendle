import { NextRequest, NextResponse } from "next/server";
import { PENDLE_API_BASE, CHAIN_ID } from "@/lib/constants";
import { SwapQuoteRequest, SwapQuoteResponse } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { market, netFromTaker } = body;

    if (!market || !netFromTaker) {
      return NextResponse.json(
        { error: "Market address and amount are required" },
        { status: 400 }
      );
    }

    const swapRequest: SwapQuoteRequest = {
      chainId: CHAIN_ID,
      market,
      netFromTaker,
      type: 2, // YT type
      cappedAmountToMarket: "9999999999999999999999999",
    };

    const response = await fetch(
      `${PENDLE_API_BASE}/limit-order/v2/limit-order/market-order`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(swapRequest),
      }
    );

    if (!response.ok) {
      throw new Error(`Pendle API error: ${response.status}`);
    }

    const data: SwapQuoteResponse = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching swap quote:", error);
    return NextResponse.json(
      { error: "Failed to fetch swap quote" },
      { status: 500 }
    );
  }
}

