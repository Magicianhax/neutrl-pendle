import { NextRequest, NextResponse } from "next/server";
import { PENDLE_API_BASE, CHAIN_ID } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get("address");

  if (!address) {
    return NextResponse.json(
      { error: "Market address is required" },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(
      `${PENDLE_API_BASE}/core/v1/${CHAIN_ID}/markets/${address}`,
      {
        headers: {
          "Content-Type": "application/json",
        },
        next: { revalidate: 10 }, // Cache for 10 seconds
      }
    );

    if (!response.ok) {
      throw new Error(`Pendle API error: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching market data:", error);
    return NextResponse.json(
      { error: "Failed to fetch market data" },
      { status: 500 }
    );
  }
}

