# Crypto HIFO Tax Tracker

[autotrackcrypto.netlify.app](https://autotrackcrypto.netlify.app/) — a personal dashboard for tracking crypto capital gains, open positions, staking income, and portfolio performance, hosted on Netlify (frontend) + Render (backend API) + Supabase (database). See [Deployment](#deployment) below for the full architecture.

A personal dashboard for tracking crypto capital gains, open positions, staking income, and portfolio performance. It uses **HIFO (Highest-In, First-Out)** cost basis — the IRS-allowed accounting method that minimizes taxable gains by matching your sales against your most expensive buy lots first.

Feed it your transaction history by uploading a CSV exported from Coinbase. It parses every buy, sell, conversion, and staking reward, runs the HIFO matching engine, and presents everything in a clean dashboard.

Data input is CSV upload only. Direct connection to Coinbase is still in development.

---

## How to Load Your Data

**Export from Coinbase:**
1. Log in to [Coinbase](https://coinbase.com).
2. Go to **Profile → Statements** (or **Taxes → Documents**).
3. Under **Transaction History**, select a custom date range (e.g., Jan 1 – today) and download as CSV.

**Upload:**
- Drag and drop the `.csv` file onto the upload zone at the top of the dashboard, or click to browse.
- You can upload multiple CSVs at once (e.g., one per year). Duplicate transactions (matched by Coinbase's transaction ID) are automatically skipped, so overlapping date ranges across files are safe.
- After upload, all tabs update immediately with the latest data.

---

## Dashboard Overview

### Summary Cards

Four numbers shown at the top of the page. These are the headline tax figures for everything you've uploaded so far.

| Card | What it means |
|------|--------------|
| **Net Short-Term Gains** | Total profit or loss on coins held for **1 year or less** before selling. The IRS taxes these at your ordinary income rate (same bracket as your salary). A negative number here is a loss you can use to offset other gains. |
| **Net Long-Term Gains** | Total profit or loss on coins held for **more than 1 year** before selling. These are taxed at the lower long-term capital gains rates (0%, 15%, or 20% depending on your income). |
| **Total Net Gain/Loss** | The combined short + long-term number — your overall realized position for the period. Shows the trade count breakdown (e.g., "14W / 6L across 20 trades"). |
| **Staking Income** | Total USD value of staking rewards and interest earned, at the price they were received. The IRS treats this as ordinary income in the year received, separate from capital gains. |

---

### Portfolio Tab

A line chart showing how your holdings have changed over time. This is the first thing you see when you open the dashboard.

**Time range buttons** (top right): Filter the chart to the last 1 day, 1 week, 1 month, 1 quarter, 1 year, or your full history.

**$ Value / # Coins toggle**: Switch the Y-axis between:
- **$ Value** — the USD market value of each holding at each point in time. Prices are fetched live from CoinGecko, with CoinCap used as a fallback if CoinGecko is unavailable or rate-limited. Switching to a new time range resets this toggle back to # Coins (to avoid firing a burst of price requests); re-select $ Value after picking your range if you want it.
- **# Coins** — the raw quantity held of each asset. Useful if you want to see how your position size has changed without price movement affecting the view.

**Coin filter chips** (colored buttons below the controls): Click any coin to hide or show its line on the chart. Helpful when one large holding (like BTC or ETH) dwarfs others and makes the smaller lines hard to read.

---

### Tax Report Tab (Form 8949)

A row-by-row breakdown of every completed sale, formatted to match IRS Form 8949 — the form you (or your accountant) fill out to report capital gains.

Each row represents one sale event and shows:

| Column | What it means |
|--------|--------------|
| **Asset** | The coin that was sold |
| **Date Acquired** | When you originally bought the specific lot that was matched to this sale |
| **Date Sold** | When you sold it |
| **Proceeds** | How much you received from the sale (in USD) |
| **Cost Basis** | How much you originally paid for that specific lot (in USD), using HIFO matching |
| **Gain / Loss** | Proceeds minus cost basis. Positive = taxable gain. Negative = deductible loss. |
| **Term** | **SHORT** = held ≤ 1 year. **LONG** = held > 1 year. |
| **Running Net** | A running total of all gains and losses up to that row, so you can see your cumulative position as you scroll. |

You can filter the table to show only SHORT or LONG trades using the buttons above the table.

Note: buying/selling crypto directly with a stablecoin (USDC/USDT) also produces a stablecoin "sale" row here at $1/unit, since the engine treats stablecoins as cash. These almost always net to ~$0 gain/loss but will show up as separate rows.

---

### Open Lots Tab

Shows your **unrealized** positions — coins you currently hold that have not been sold yet. Each row is one buy lot.

| Column | What it means |
|--------|--------------|
| **Asset** | The coin |
| **Purchased** | When you bought it |
| **Qty Remaining** | How much of this lot you still hold (may be less than what you originally bought if a partial sale was matched against it) |
| **Cost / Unit** | What you paid per coin for this specific lot |
| **Amount Paid** | Total cost of the remaining quantity |
| **Worth Now** | Live market price from CoinGecko × quantity remaining. Shows N/A if CoinGecko can't be reached or the coin isn't in its top-500-by-market-cap list |
| **Unrealized P&L** | What you'd gain or lose if you sold right now. Also N/A when the price is unavailable |

These lots are what the HIFO engine draws from when you record a future sale. The highest-cost lots are consumed first (ties broken by earliest purchase date).

---

### Income Tab

A log of all staking rewards, interest payments, and other income events. These are not capital gains — they are ordinary income taxed at your regular rate in the year received.

| Column | What it means |
|--------|--------------|
| **Asset** | The coin received as income |
| **Date** | When it was received |
| **Quantity** | How many coins were received |
| **Value (USD)** | The USD market value at the moment of receipt — this is the amount the IRS considers taxable income |
| **Type** | The income category (e.g., Staking Income, Learning Reward, Rewards Income) |

Note: when you eventually sell coins received as staking income, the cost basis for that sale is the USD value at the time you received them (shown in this table).

---

### Clear All Data

The **Clear all data** button in the top-right corner asks for confirmation, then wipes everything from the database and resets the dashboard to a blank state. Use this if you want to start fresh with a new set of CSV files. This cannot be undone.

---

## How HIFO Works

When you sell a coin, the IRS requires you to identify which specific "lot" (purchase) you're selling from. HIFO says: always sell from the lot you paid the most for first.

**Example:** You bought 1 BTC at $30,000, then another at $60,000. You later sell 1 BTC for $70,000.
- Under HIFO, the sale is matched to the $60,000 lot → gain of $10,000.
- Under FIFO (first-in, first-out), it would match the $30,000 lot → gain of $40,000.

HIFO is legal under IRS rules (specific identification method) and is the most tax-efficient approach when you have multiple lots at different prices.

---

## Supported Transaction Types

| Coinbase Type | How It's Handled |
|---------------|-----------------|
| Buy / Dex Buy | Creates a new tax lot at total cost ÷ quantity. If the asset is USDC or USDT (i.e. you spent a stablecoin), it's instead recorded as a $1/unit stablecoin sale, since the crypto side of the trade already gets its own lot from the same row. |
| Sell / Dex Sell | Records a sale; HIFO engine matches it to the highest-cost lot. If the asset is USDC or USDT, it's instead recorded as a $1/unit stablecoin buy lot. |
| Convert | The source asset is treated as a sale; the destination asset (parsed from the transaction's Notes field) gets a new lot. |
| Staking Income / Learning Reward / Rewards Income | Logged as ordinary income at market value when received. |
| Send / Receive / Transfer | Skipped — non-taxable wallet movements. |
| Transaction with no asset name, or any unrecognized type | Flagged for manual review — stored in the database and counted in the post-upload summary ("N flagged"). Browsing flagged rows individually in the dashboard is a planned improvement. |

---

## Tech Stack

- **Frontend:** React 18 + TypeScript, Vite, Tailwind CSS, Recharts — deployed to Netlify as a static site.
- **Backend:** Node.js + Express + TypeScript, `multer` (CSV upload), `csv-parser` — deployed to Render as a web service.
- **Database:** PostgreSQL (hosted on Supabase), with the HIFO matching engine implemented as a stored procedure (`db/hifo_engine.sql`) so matching runs inside the database itself.
- **Price data:** CoinGecko public API (primary), CoinCap (fallback for portfolio chart pricing only).

---

## Deployment

The app runs as three separate services that talk to each other:

```
Browser (Netlify) → Backend API (Render) → Database (Supabase)
```

### Database — Supabase

Supabase hosts a PostgreSQL database that stores all your tax lots, sales, income events, and matched trades.

1. Create a free account at [supabase.com](https://supabase.com).
2. Create a new project and note your database password.
3. Open the **SQL Editor** and run the contents of [`db/schema.sql`](db/schema.sql), then [`db/hifo_engine.sql`](db/hifo_engine.sql).
4. Copy your connection string from **Project Settings → Database**.

### Backend — Render

Render hosts the Node.js/Express API that parses CSVs, runs the HIFO engine, and serves data to the frontend. The config is in [`render.yaml`](render.yaml).

1. Sign up at [render.com](https://render.com).
2. Click **New → Web Service**, connect your GitHub account, and select this repo.
3. Add one environment variable: `DATABASE_URL` → your Supabase connection string.
4. Deploy. Copy the URL Render gives you (e.g. `https://your-service.onrender.com`).

> **Free tier note:** Render's free tier spins down after 15 minutes of inactivity, causing a delay on the next request while it spins back up. A paid tier keeps it always on — check Render's current pricing.

### Frontend — Netlify

Netlify hosts the React app as a static site. The config is in [`netlify.toml`](netlify.toml).

1. Sign up at [netlify.com](https://netlify.com).
2. Click **Add new site → Import an existing project**, connect GitHub, and select this repo.
3. Add one environment variable: `VITE_API_URL` → your Render backend URL (no trailing slash).
4. Deploy. Your dashboard will be live at `https://your-site-name.netlify.app`.

### Continuous Deployment

Both Render and Netlify watch the `main` branch. Any push to `main` automatically triggers a rebuild and redeploy of the respective service — no manual steps needed.
