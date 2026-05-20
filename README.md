# Crypto HIFO Tax Tracking Engine

A full-stack tool for calculating crypto capital gains using **HIFO (Highest-In, First-Out)** cost basis — the IRS-allowed accounting method that minimizes your taxable gains by matching your sales to your highest-cost buy lots first.

Upload a Coinbase CSV at any point during the year to see your real-time Form 8949 exposure, open tax lots, and staking income.

---

## Stack

- **Database**: PostgreSQL (local or [Supabase](https://supabase.com))
- **Backend**: Node.js + TypeScript + Express
- **Frontend**: React + Vite + TypeScript + Tailwind CSS

---

## Prerequisites

Make sure you have the following installed before starting:

- [Node.js](https://nodejs.org/) v18 or later — `node --version` to check
- [npm](https://www.npmjs.com/) v9 or later — `npm --version` to check
- A running **PostgreSQL** database (see Step 1 below for options)

---

## Step 1 — Set Up the Database

You need a PostgreSQL instance to store your tax lots and matched trades. Pick one of the two options below.

### Option A: Supabase (recommended — no local install needed)

1. Go to [supabase.com](https://supabase.com) and create a free account.
2. Click **New Project**, give it a name (e.g. `crypto-tax`), and set a database password.
3. Once the project is ready, go to **Project Settings → Database** and copy the **Connection string (URI)**. It looks like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxx.supabase.co:5432/postgres
   ```
4. Open the **SQL Editor** tab in Supabase (left sidebar).
5. Paste the full contents of [`db/schema.sql`](db/schema.sql) into the editor and click **Run**.
6. Then paste the full contents of [`db/hifo_engine.sql`](db/hifo_engine.sql) and click **Run**.

### Option B: Local PostgreSQL

1. Install PostgreSQL from [postgresql.org](https://www.postgresql.org/download/) or via Homebrew:
   ```bash
   brew install postgresql@16
   brew services start postgresql@16
   ```
2. Create a database:
   ```bash
   createdb crypto_tax
   ```
3. Run the migration files:
   ```bash
   psql postgresql://localhost/crypto_tax -f db/schema.sql
   psql postgresql://localhost/crypto_tax -f db/hifo_engine.sql
   ```
   Your connection string will be: `postgresql://localhost/crypto_tax`

---

## Step 2 — Configure and Start the Backend

```bash
cd backend
```

**Install dependencies:**
```bash
npm install
```

**Create your environment file:**
```bash
cp .env.example .env
```

**Open `.env` and fill in your database URL** (from Step 1):
```
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxx.supabase.co:5432/postgres
PORT=3001
```

**Start the backend server:**
```bash
npm run dev
```

You should see:
```
Backend running at http://localhost:3001
```

Leave this terminal running.

---

## Step 3 — Start the Frontend

Open a **new terminal window** and run:

```bash
cd frontend
npm install
npm run dev
```

You should see:
```
  VITE v5.x.x  ready in Xms

  ➜  Local:   http://localhost:5173/
```

---

## Step 4 — Use the Dashboard

Open your browser and go to **http://localhost:5173**

### Uploading your Coinbase CSV

1. Log in to [Coinbase](https://coinbase.com).
2. Go to **Profile → Statements** (or navigate to **Taxes → Documents**).
3. Under **Transaction History**, select a custom date range (e.g., Jan 1 – today) and download as CSV.
4. Drag and drop the downloaded `.csv` file onto the upload zone in the dashboard, or click to browse for it.
5. The backend will parse all transactions, run the HIFO engine, and refresh the dashboard automatically.

### Reading the Dashboard

| Tab | What you'll see |
|-----|----------------|
| **Tax Report (Form 8949)** | Every matched trade with proceeds, cost basis, gain/loss, and short vs. long-term classification. Filter by SHORT or LONG term. A running net total column shows your cumulative position as you scroll. |
| **Open Lots** | All buy lots that haven't been fully sold yet, grouped by asset. Shows your remaining quantity and remaining cost basis. |
| **Income** | Staking rewards and other income events, with the USD value at the time they were received. |

The four stat cards at the top show:
- **Net Short-Term Gains** — taxed at ordinary income rates (10–37%)
- **Net Long-Term Gains** — taxed at preferential rates (0%, 15%, or 20%)
- **Total Net Gain/Loss** — your combined realized position
- **Staking Income** — total ordinary income from rewards

### Mid-Year Check

You don't have to wait until December. Download a fresh CSV from Coinbase any time and re-upload it — the engine clears and rebuilds from scratch on every upload, so your numbers always reflect the current state of your transaction history.

---

## Deployment (Always-Accessible Dashboard)

If you want the dashboard available in a browser any time without running local servers, deploy the frontend to Netlify (free) and the backend to Render (free tier). Both config files are already in this repo.

**Prerequisites**: Your database must be on Supabase (Setup Option A above). If you used a local PostgreSQL, migrate to Supabase first by running `db/schema.sql` and `db/hifo_engine.sql` in the Supabase SQL editor.

### Deploy the Backend to Render (free)

> **Note on the free tier**: Render's free tier spins the server down after 15 minutes of inactivity. The first upload after idle time will have a ~30-second cold start. If that bothers you, Render's paid tier ($7/month) keeps it always on — let me know and I can set that up.

1. Go to [render.com](https://render.com) and sign up (free).
2. Click **New → Web Service**.
3. Connect your GitHub account and select the `crypto_tracking` repository.
4. Render will detect `render.yaml` automatically. Confirm the settings:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
5. Under **Environment Variables**, add:
   - `DATABASE_URL` → paste your Supabase connection string
6. Click **Create Web Service**. Render will build and deploy in ~2 minutes.
7. Copy the URL Render gives you — it looks like `https://crypto-hifo-backend.onrender.com`.

### Deploy the Frontend to Netlify (free)

1. Go to [netlify.com](https://netlify.com) and sign up (free).
2. Click **Add new site → Import an existing project**.
3. Connect GitHub and select `crypto_tracking`.
4. Netlify will detect `netlify.toml` automatically. Confirm:
   - **Base directory**: `frontend`
   - **Build command**: `npm run build`
   - **Publish directory**: `frontend/dist`
5. Under **Site configuration → Environment variables**, add:
   - `VITE_API_URL` → your Render backend URL (e.g. `https://crypto-hifo-backend.onrender.com`)
6. Click **Deploy site**. Netlify builds in ~1 minute.
7. Your dashboard is now live at a URL like `https://your-site-name.netlify.app`.

### After Deploying

- Open the Netlify URL in any browser — no local servers needed.
- Upload a Coinbase CSV the same way as locally. The backend on Render processes it and stores results in Supabase.
- Your data persists between visits since it lives in the cloud database.

---

## API Endpoints

The backend runs at `http://localhost:3001`. You can query it directly if needed.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/upload` | Upload a Coinbase CSV (multipart form, field name `file`) |
| `POST` | `/api/sync` | Pull history directly from Coinbase API (`{ apiKey, apiSecret }` JSON body) |
| `GET` | `/api/report` | Form 8949-structured matched trades |
| `GET` | `/api/summary` | Aggregate dashboard stats |
| `GET` | `/api/lots` | Open (unrealized) tax lots |
| `GET` | `/api/income` | Staking and other income events |
| `GET` | `/api/unmatched` | Transactions flagged for manual review |

---

## Supported Transaction Types

| Coinbase Type | How It's Handled |
|---------------|-----------------|
| Buy / Dex Buy (token) | Creates a new tax lot at total cost ÷ quantity |
| Sell / Dex Sell (token) | Records a sale; HIFO engine matches it to the highest-cost lot |
| Buy / Sell (USDC/USDT) | Recorded at $1.00/unit since stablecoins are pegged |
| Convert | Notes field is parsed — source asset is sold, destination asset gets a new lot |
| Staking Income | Logged as ordinary income at the market value when received |
| Send / Receive / Transfer | Skipped — wallet transfers are not taxable events |

> **Unnamed token rows**: Some DEX trades in Coinbase exports have a blank Asset field. These are flagged in the `unmatched_transactions` table and excluded from HIFO matching. You can query `GET /api/unmatched` to review them and add them manually if needed.

---

## Project Structure

```
crypto_tracking/
├── db/
│   ├── schema.sql          # Table definitions (run this first)
│   └── hifo_engine.sql     # HIFO stored procedure + reporting views
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── database.ts # PostgreSQL connection pool
│   │   ├── services/
│   │   │   └── parser.ts   # CSV ingestion and transaction classification
│   │   ├── routes/
│   │   │   └── taxRoutes.ts # Express API routes
│   │   └── index.ts        # Server entry point
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── CSVUploader.tsx    # Drag-and-drop file upload
    │   │   ├── DashboardStats.tsx # Summary stat cards
    │   │   ├── TaxTable.tsx       # Form 8949 table
    │   │   ├── TaxLotsTable.tsx   # Open lots grouped by asset
    │   │   └── IncomeTable.tsx    # Staking income events
    │   ├── App.tsx
    │   ├── types.ts
    │   └── main.tsx
    ├── package.json
    └── vite.config.ts
```
