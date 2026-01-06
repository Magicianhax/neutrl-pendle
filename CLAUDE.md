# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js 16 application for the Neutral Finance Pendle YT (Yield Token) calculator. It helps users estimate returns, points, and ROI when investing in NUSD/sNUSD markets on Pendle Finance.

## Commands

```bash
npm run dev      # Start development server (http://localhost:3000)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Environment Setup

Copy `.env.example` to `.env.local` and set `ETHERSCAN_API_KEY` for TVL data fetching.

## Architecture

### Core Flow
1. **Calculator Component** (`src/components/Calculator.tsx`): Main UI for selecting markets (NUSD/sNUSD), entering investment amounts, and displaying calculated returns
2. **API Routes** proxy Pendle Finance API:
   - `/api/markets` - Fetches market data (prices, APY, expiry)
   - `/api/swap` - Gets swap quotes for YT purchases
   - `/api/tvl` - Aggregates TVL data from Etherscan (token supplies, lock contract data, Curve pool balances)

### Key Data Types
- `MarketData` (`src/lib/types.ts`): Pendle market info including PT/YT prices, APY rates
- `SwapQuoteResponse`: Swap quote structure from Pendle limit order API
- `TvlCategory`/`TvlRow` (`src/lib/tvlData.ts`): Define the TVL breakdown table structure with boost multipliers

### Constants (`src/lib/constants.ts`)
- `MARKETS`: NUSD (50x points) and sNUSD (25x points + yield) market configs with contract addresses
- `CHAIN_ID`: Ethereum mainnet (1)
- `PENDLE_API_BASE`: https://api-v2.pendle.finance

### Calculations (`src/lib/calculations.ts`)
- `parseUnits`/`formatUnits`: 18 decimal conversion for blockchain values
- `calculatePoints`: YT amount * market multiplier
- `calculateDaysToExpiry`: Time until market maturity

### TVL Table (`src/components/TvlTable.tsx`)
Displays points distribution across:
- Pendle markets (YT, LP, PT)
- Hold positions (NUSD, sNUSD, upNUSD, Curve LP)
- Lock contract positions by duration (3mo/6mo/9mo/12mo)

Uses `useTvlData` hook to fetch live data from `/api/tvl`.

### TVL API (`src/app/api/tvl/route.ts`)
Complex endpoint that aggregates on-chain data:
- Fetches token supplies and balances via Etherscan API v2
- Parses `AssetLocked` events from lock contract (0x99161BA892ECae335616624c84FAA418F64FF9A6)
- Calculates locked/unlocked TVL for NUSD, sNUSD, and Curve LP by duration buckets
- Rate-limited to avoid Etherscan free tier limits (300ms delay between calls)

## Path Aliases

`@/*` maps to `./src/*` (configured in tsconfig.json)

## Styling

Uses Tailwind CSS v4 with dark mode support via ThemeProvider context.
