# Crypto HIFO Tax Tracker

A personal dashboard for tracking crypto capital gains, open positions, staking income, and portfolio performance. It uses **HIFO (Highest-In, First-Out)** cost basis — the IRS-allowed accounting method that minimizes taxable gains by matching your sales against your most expensive buy lots first.

You feed it your transaction history by uploading a CSV exported from Coinbase. It parses every buy, sell, conversion, and staking reward, runs the HIFO matching engine, and presents everything in a clean dashboard.

---

## How to Load Your Data

**Export from Coinbase:**
1. Log in to [Coinbase](https://coinbase.com).
2. Go to **Profile → Statements** (or **Taxes → Documents**).
3. Under **Transaction History**, select a custom date range (e.g., Jan 1 – today) and download as CSV.

**Upload:**
- Drag and drop the `.csv` file onto the upload zone at the top of the dashboard, or click to browse.
- You can upload multiple CSVs at once (e.g., one per year). Duplicate transactions are automatically skipped.
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
- **$ Value** — the USD market value of each holding at each point in time. Prices are pulled live from CoinGecko.
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

---

### Open Lots Tab

Shows your **unrealized** positions — coins you currently hold that have not been sold yet. Each row is one buy lot.

| Column | What it means |
|--------|--------------|
| **Asset** | The coin |
| **Acquired** | When you bought it |
| **Remaining Qty** | How much of this lot you still hold (may be less than what you originally bought if a partial sale was matched against it) |
| **Cost Basis / Unit** | What you paid per coin for this specific lot |
| **Remaining Cost** | Total cost of the remaining quantity |
| **Current Price** | Live market price (if available) |
| **Unrealized Gain/Loss** | What you'd gain or lose if you sold right now |

These lots are what the HIFO engine draws from when you record a future sale. The highest-cost lots are consumed first.

---

### Income Tab

A log of all staking rewards, interest payments, and other income events. These are not capital gains — they are ordinary income taxed at your regular rate in the year received.

| Column | What it means |
|--------|--------------|
| **Asset** | The coin received as income |
| **Date** | When it was received |
| **Quantity** | How many coins were received |
| **Value (USD)** | The USD market value at the moment of receipt — this is the amount the IRS considers taxable income |
| **Type** | The income category (e.g., Staking Income, Reward Income) |

Note: when you eventually sell coins received as staking income, the cost basis for that sale is the USD value at the time you received them (shown in this table).

---

### Clear All Data

The **Clear all data** button in the top-right corner wipes everything from the database and resets the dashboard to a blank state. Use this if you want to start fresh with a new set of CSV files.

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
| Buy / Dex Buy | Creates a new tax lot at total cost ÷ quantity |
| Sell / Dex Sell | Records a sale; HIFO engine matches it to the highest-cost lot |
| Convert | The source asset is treated as a sale; the destination asset gets a new lot |
| Staking Income / Rewards | Logged as ordinary income at market value when received |
| Send / Receive / Transfer | Skipped — non-taxable wallet movements |
| DEX trade with no asset name | Flagged for manual review |

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

> **Free tier note:** Render's free tier spins down after 15 minutes of inactivity, causing a ~30-second delay on the next request. The $7/month paid tier keeps it always on.

### Frontend — Netlify

Netlify hosts the React app as a static site. The config is in [`netlify.toml`](netlify.toml).

1. Sign up at [netlify.com](https://netlify.com).
2. Click **Add new site → Import an existing project**, connect GitHub, and select this repo.
3. Add one environment variable: `VITE_API_URL` → your Render backend URL (no trailing slash).
4. Deploy. Your dashboard will be live at `https://your-site-name.netlify.app`.

### Continuous Deployment

Both Render and Netlify watch the `main` branch. Any push to `main` automatically triggers a rebuild and redeploy of the respective service — no manual steps needed.
