# Crypto HIFO Tax Tracking Engine

A full-stack tool for calculating crypto capital gains using **HIFO (Highest-In, First-Out)** cost basis — the IRS-allowed accounting method that minimizes your taxable gains.

## How It Works

1. Export your transaction history from Coinbase as a CSV
2. Upload it via the dashboard
3. The engine matches your sales to your highest-cost buy lots
4. View your real-time Form 8949 data and tax exposure at any point in the year

## Stack

- **Backend**: Node.js + TypeScript + Express
- **Database**: PostgreSQL (Supabase or local)
- **Frontend**: React + Vite + TypeScript + Tailwind CSS

## Setup

### 1. Database

Run the SQL files in your PostgreSQL instance (Supabase SQL editor or `psql`):

```bash
psql $DATABASE_URL -f db/schema.sql
psql $DATABASE_URL -f db/hifo_engine.sql
```

### 2. Backend

```bash
cd backend
cp .env.example .env
# Fill in your DATABASE_URL
npm install
npm run dev
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

## Supported Transaction Types

| Type | Treatment |
|------|-----------|
| Buy / Dex Buy | Creates a new tax lot |
| Sell / Dex Sell | Triggers HIFO matching |
| Convert | Treated as sell of source asset + buy of destination asset |
| Staking Income | Logged as ordinary income at market value |

> **Note**: DEX transactions where the asset name is missing from the Coinbase export are flagged in an `unmatched_transactions` table for manual review.

## Mid-Year Check

Upload a fresh Coinbase CSV export at any time to see your current realized gains, remaining open lots, and staking income — no year-end required.

## Tax Output

The `/api/report` endpoint and the **Tax Report** tab produce output structured to match IRS Form 8949 columns:
- Description of Property
- Date Acquired
- Date Sold
- Gross Proceeds
- Cost Basis
- Gain/Loss
- Short-Term vs. Long-Term Classification
