# Crypto HIFO Tax Tracking Engine

A full-stack tool for calculating crypto capital gains using **HIFO (Highest-In, First-Out)** cost basis — the IRS-allowed accounting method that minimizes your taxable gains by matching your sales to your highest-cost buy lots first.

Feed it your transaction history two ways:
- **Coinbase API sync** — pulls exchange buy/sell history directly; no file needed
- **CSV upload** — drop in a Coinbase export for full history, including DEX trades

Check your real-time Form 8949 exposure, open tax lots, and staking income at any point in the year.

---

## Stack

- **Database**: PostgreSQL (local or [Supabase](https://supabase.com))
- **Backend**: Node.js + TypeScript + Express
- **Frontend**: React + Vite + TypeScript + Tailwind CSS

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later — `node --version` to check
- [npm](https://www.npmjs.com/) v9 or later — `npm --version` to check
- A running **PostgreSQL** database (see Step 1 below)

---

## Step 1 — Set Up the Database

### Option A: Supabase (recommended — no local install needed)

1. Go to [supabase.com](https://supabase.com) and create a free account.
2. Click **New Project**, give it a name (e.g. `crypto-tax`), and set a database password.
3. Go to **Project Settings → Database** and copy the **Connection string (URI)**:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxx.supabase.co:5432/postgres
   ```
4. Open the **SQL Editor** tab in the left sidebar.
5. Paste the full contents of [`db/schema.sql`](db/schema.sql) and click **Run**.
6. Paste the full contents of [`db/hifo_engine.sql`](db/hifo_engine.sql) and click **Run**.

### Option B: Local PostgreSQL

```bash
brew install postgresql@16
brew services start postgresql@16
createdb crypto_tax
psql postgresql://localhost/crypto_tax -f db/schema.sql
psql postgresql://localhost/crypto_tax -f db/hifo_engine.sql
```

Your connection string: `postgresql://localhost/crypto_tax`

---

## Step 2 — Configure and Start the Backend

```bash
cd backend
npm install
cp .env.example .env
```

Open `.env` and fill in your database URL:
```
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxx.supabase.co:5432/postgres
PORT=3001
```

Start the server:
```bash
npm run dev
# Backend running at http://localhost:3001
```

Leave this terminal running.

---

## Step 3 — Start the Frontend

Open a new terminal:

```bash
cd frontend
npm install
npm run dev
# ➜  Local: http://localhost:5173/
```

---

## Step 4 — Use the Dashboard

Open **http://localhost:5173** in your browser.

The dashboard has two ways to load your transaction data. Use one or both — each full sync clears and rebuilds from scratch.

---

### Option A: Sync from the Coinbase API

Best for a quick, up-to-date view of your exchange buy/sell history without downloading anything.

**Get your API key:**
1. Log in to Coinbase and go to **Settings → API → New API Key**.
2. Enable only these two permissions: `wallet:accounts:read` and `wallet:transactions:read`.
3. Copy the **API Key** and **API Secret** shown on the confirmation screen (the secret is only shown once).

**In the dashboard:**
1. Click **Sync directly from Coinbase API** to expand the panel.
2. Paste your API Key and API Secret into the fields.
3. Click **Sync Now**.

The backend signs the request, fetches all accounts and transactions, runs the HIFO engine, and refreshes the dashboard. Your credentials are used in memory for a single request and are never stored.

> **DEX trades are not included.** The Coinbase API only returns exchange transactions (regular buys and sells on coinbase.com). On-chain DEX trades made through Coinbase Wallet do not appear via the API. Use the CSV upload below if you need those included.

---

### Option B: Upload a Coinbase CSV

Best for full history, including DEX trades.

**Export from Coinbase:**
1. Log in to [Coinbase](https://coinbase.com).
2. Go to **Profile → Statements** (or **Taxes → Documents**).
3. Under **Transaction History**, select a custom date range (e.g., Jan 1 – today) and download as CSV.

**In the dashboard:**
- Drag and drop the `.csv` file onto the upload zone, or click to browse.
- The backend parses all transactions, runs the HIFO engine, and refreshes the dashboard.

---

### Reading the Dashboard

**Stat cards (top row):**

| Card | What it means |
|------|--------------|
| Net Short-Term Gains | Gains/losses held ≤1 year — taxed at ordinary income rates (10–37%) |
| Net Long-Term Gains | Gains/losses held >1 year — taxed at preferential rates (0%, 15%, 20%) |
| Total Net Gain/Loss | Combined realized position across all trades |
| Staking Income | Total ordinary income from staking rewards and interest |

**Tabs:**

| Tab | What you'll see |
|-----|----------------|
| **Tax Report (Form 8949)** | Every matched trade: proceeds, cost basis, gain/loss, and SHORT/LONG classification. Filterable. Includes a running net total column. |
| **Open Lots** | Unrealized positions grouped by asset — remaining quantity and remaining cost basis for each lot. |
| **Income** | Staking rewards and other income events with USD value at time of receipt. |

### Mid-Year Check

You can upload a fresh CSV or re-sync the API at any time during the year. Each sync rebuilds from scratch, so your numbers always reflect the latest state of your account.

---

## Deployment (Always-Accessible Dashboard)

To access the dashboard from any browser without running local servers, deploy the frontend to Netlify (free) and the backend to Render (free tier). Both config files are already in the repo (`netlify.toml`, `render.yaml`).

**Prerequisite**: your database must be on Supabase (Option A above).

### Deploy the Backend to Render

> **Free tier caveat**: Render's free tier spins the server down after 15 minutes of inactivity, causing a ~30-second cold start on the next request. The paid tier ($7/month) keeps it always on.

1. Go to [render.com](https://render.com) and sign up.
2. Click **New → Web Service** and connect your GitHub account.
3. Select the `crypto_tracking` repository. Render detects `render.yaml` automatically.
4. Confirm: **Root Directory** = `backend`, **Build** = `npm install && npm run build`, **Start** = `npm start`.
5. Add environment variable: `DATABASE_URL` → your Supabase connection string.
6. Click **Create Web Service**. Copy the URL when it finishes (e.g. `https://crypto-hifo-backend.onrender.com`).

### Deploy the Frontend to Netlify

1. Go to [netlify.com](https://netlify.com) and sign up.
2. Click **Add new site → Import an existing project** and connect GitHub.
3. Select `crypto_tracking`. Netlify detects `netlify.toml` automatically.
4. Add environment variable: `VITE_API_URL` → your Render backend URL (no trailing slash).
5. Click **Deploy site**. Your dashboard will be live at `https://your-site-name.netlify.app`.

---

## API Endpoints

The backend runs at `http://localhost:3001` locally (or your Render URL when deployed).

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/sync` | Sync from Coinbase API — body: `{ "apiKey": "...", "apiSecret": "..." }` |
| `POST` | `/api/upload` | Upload a Coinbase CSV — multipart form, field name `file` |
| `GET` | `/api/report` | Form 8949-structured matched trades |
| `GET` | `/api/summary` | Aggregate dashboard stats |
| `GET` | `/api/lots` | Open (unrealized) tax lots |
| `GET` | `/api/income` | Staking and other income events |
| `GET` | `/api/unmatched` | Transactions flagged for manual review |

---

## Supported Transaction Types

### Via CSV Upload

| Coinbase Type | How It's Handled |
|---------------|-----------------|
| Buy / Dex Buy (named token) | Creates a new tax lot at `total_cost ÷ quantity` |
| Sell / Dex Sell (named token) | Records a sale; HIFO engine matches it to the highest-cost lot |
| Buy / Sell (USDC/USDT) | Recorded at $1.00/unit |
| Convert | Notes field parsed — source asset is sold, destination asset gets a new lot |
| Staking Income | Logged as ordinary income at market value when received |
| Send / Receive / Transfer | Skipped — non-taxable wallet movements |
| DEX trade with no asset name | Flagged in `unmatched_transactions` for manual review |

### Via Coinbase API Sync

| API Type | How It's Handled |
|----------|-----------------|
| `buy` | Creates a new tax lot (uses `buy.total` for cost basis including fees) |
| `sell` | Records a sale (uses `sell.total` for net proceeds) |
| `staking_reward` / `interest` / `rewards_income` | Logged as ordinary income |
| `send` / `receive` / `pro_withdrawal` / `pro_deposit` / `exchange_withdrawal` / `exchange_deposit` | Skipped — non-taxable transfers |
| Anything else | Flagged in `unmatched_transactions` for manual review |

---

## Project Structure

```
crypto_tracking/
├── netlify.toml                    # Netlify one-click frontend deploy config
├── render.yaml                     # Render one-click backend deploy config
├── db/
│   ├── schema.sql                  # Table definitions (run first)
│   └── hifo_engine.sql             # HIFO stored procedure + reporting views
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── database.ts         # PostgreSQL connection pool
│   │   ├── services/
│   │   │   ├── parser.ts           # CSV ingestion and transaction classification
│   │   │   └── coinbaseApiService.ts # Coinbase API sync (HMAC auth + pagination)
│   │   ├── routes/
│   │   │   └── taxRoutes.ts        # All Express API routes
│   │   └── index.ts                # Server entry point
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
└── frontend/
    ├── src/
    │   ├── api.ts                  # API base URL (env-aware for local vs deployed)
    │   ├── types.ts                # Shared TypeScript interfaces
    │   ├── App.tsx                 # Root component, data fetching, tab layout
    │   ├── main.tsx
    │   └── components/
    │       ├── CoinbaseSync.tsx    # Collapsible Coinbase API key/secret form
    │       ├── CSVUploader.tsx     # Drag-and-drop CSV upload zone
    │       ├── DashboardStats.tsx  # Four summary stat cards
    │       ├── TaxTable.tsx        # Form 8949 table with SHORT/LONG filter
    │       ├── TaxLotsTable.tsx    # Open lots grouped by asset
    │       └── IncomeTable.tsx     # Staking and income events
    ├── .env.example
    ├── index.html
    ├── package.json
    ├── tailwind.config.js
    ├── postcss.config.js
    └── vite.config.ts
```
