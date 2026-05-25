import React, { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { API_BASE } from '../api';

type Range = '1D' | '1W' | '1M' | '1Q' | '1Y' | 'ALL';
type YMode = 'USD' | 'QTY';

interface PortfolioEvent {
  asset_symbol: string;
  timestamp: string;
  qty: string;
  event_type: 'buy' | 'sell';
}

interface ChartPoint {
  label: string;
  ts: number;
  [asset: string]: number | string | null;
}

const COLORS = [
  '#3C6D36', '#2563EB', '#DC2626', '#D97706', '#7C3AED',
  '#0891B2', '#DB2777', '#059669', '#EA580C', '#4F46E5',
  '#BE185D', '#047857', '#B45309', '#1D4ED8', '#7E22CE',
];

const DAY_MS = 24 * 60 * 60 * 1000;

function getStartDate(range: Range, firstPurchase: Date): Date {
  const now = Date.now();
  switch (range) {
    case '1D':  return new Date(now - DAY_MS);
    case '1W':  return new Date(now - 7 * DAY_MS);
    case '1M':  return new Date(now - 30 * DAY_MS);
    case '1Q':  return new Date(now - 90 * DAY_MS);
    case '1Y':  return new Date(now - 365 * DAY_MS);
    case 'ALL': return firstPurchase;
  }
}

function generatePoints(start: Date, range: Range): Date[] {
  const now = new Date();
  const stepMs = range === '1D' ? 60 * 60 * 1000 : DAY_MS;
  const cur = new Date(start);
  if (range !== '1D') cur.setHours(0, 0, 0, 0);
  else cur.setMinutes(0, 0, 0);
  const pts: Date[] = [];
  while (cur <= now) {
    pts.push(new Date(cur));
    cur.setTime(cur.getTime() + stepMs);
  }
  return pts;
}

function closestPrice(prices: [number, number][], ts: number): number | null {
  if (!prices.length) return null;
  // Don't extrapolate before the coin existed or after the last known price
  if (ts < prices[0][0] - DAY_MS || ts > prices[prices.length - 1][0] + DAY_MS) return null;
  let lo = 0, hi = prices.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (prices[mid][0] < ts) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs(prices[lo - 1][0] - ts) < Math.abs(prices[lo][0] - ts)) lo--;
  return prices[lo][1];
}

function fmtAxisDate(label: string, range: Range): string {
  const d = new Date(label);
  if (range === '1D') return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (range === '1W' || range === '1M') return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return d.toLocaleDateString([], { month: 'short', year: '2-digit' });
}

function fmtAxisY(v: number, mode: YMode): string {
  if (mode === 'USD') {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}k`;
    return `$${v.toFixed(2)}`;
  }
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(2)}k`;
  return v.toLocaleString('en-US', { maximumFractionDigits: 6 });
}

interface TooltipProps {
  active?: boolean;
  payload?: { name: string; value: number | null; color: string }[];
  label?: string;
  yMode: YMode;
  range: Range;
}

function SortedTooltip({ active, payload, label, yMode, range }: TooltipProps) {
  if (!active || !payload?.length) return null;

  const items = [...payload]
    .filter(p => p.value !== null && p.value !== undefined)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  const d = new Date(String(label));
  const dateLabel = range === '1D'
    ? d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="bg-white border border-brand-mid/30 rounded-lg shadow-md p-3 text-xs min-w-[160px]">
      <p className="font-medium text-brand-dark mb-2">{dateLabel}</p>
      {items.map(({ name, value, color }) => (
        <div key={name} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
            <span className="text-brand-dark">{name}</span>
          </span>
          <span className="font-medium text-brand-dark tabular-nums">
            {yMode === 'USD'
              ? `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 5, maximumFractionDigits: 8 })}`
              : Number(value).toLocaleString('en-US', { minimumFractionDigits: 5, maximumFractionDigits: 8 })}
          </span>
        </div>
      ))}
    </div>
  );
}

// CoinGecko coin IDs for common coins
const CG_IDS: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', BNB: 'binancecoin',
  XRP: 'ripple', DOGE: 'dogecoin', SHIB: 'shiba-inu', PEPE: 'pepe',
  LINK: 'chainlink', DOT: 'polkadot', USDC: 'usd-coin', USDT: 'tether',
  MATIC: 'matic-network', AVAX: 'avalanche-2', UNI: 'uniswap',
  LTC: 'litecoin', ADA: 'cardano', ATOM: 'cosmos', ZEC: 'zcash',
  MORPHO: 'morpho', ONDO: 'ondo-finance', HYPE: 'hyperliquid',
  PENGU: 'pudgy-penguins', PNUT: 'peanut-the-squirrel',
  XYO: 'xyo-network',
};

// CoinCap coin IDs — used as fallback when CoinGecko fails
const COINCAP_IDS: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', BNB: 'binance-coin',
  XRP: 'xrp', DOGE: 'dogecoin', SHIB: 'shiba-inu', PEPE: 'pepe',
  LINK: 'chainlink', DOT: 'polkadot', USDC: 'usd-coin', USDT: 'tether',
  MATIC: 'matic-network', AVAX: 'avalanche-2', UNI: 'uniswap',
  LTC: 'litecoin', ADA: 'cardano', ATOM: 'cosmos', ZEC: 'zcash',
  MORPHO: 'morpho', ONDO: 'ondo',
  XYO: 'xyo-network',
};

function coincapInterval(days: number): string {
  if (days <= 1) return 'm5';
  if (days <= 7) return 'h1';
  return 'd1';
}

async function fetchCoinGecko(cgId: string, days: number): Promise<[number, number][] | null> {
  try {
    const r = await fetch(
      `https://api.coingecko.com/api/v3/coins/${cgId}/market_chart?vs_currency=usd&days=${days}`
    );
    const data = await r.json();
    if (Array.isArray(data.prices)) return data.prices;
  } catch { /* fall through */ }
  return null;
}

async function fetchCoinCap(capId: string, days: number): Promise<[number, number][] | null> {
  try {
    const now = Date.now();
    const start = now - days * 24 * 60 * 60 * 1000;
    const interval = coincapInterval(days);
    const r = await fetch(
      `https://api.coincap.io/v2/assets/${capId}/history?interval=${interval}&start=${start}&end=${now}`
    );
    const json = await r.json();
    if (Array.isArray(json.data)) {
      return json.data.map((p: { time: number; priceUsd: string }) => [p.time, parseFloat(p.priceUsd)] as [number, number]);
    }
  } catch { /* fall through */ }
  return null;
}

const MARKETS_CACHE_KEY = 'cg_markets_symbolToId';
const MARKETS_CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function getSymbolToId(): Promise<Record<string, string>> {
  const result: Record<string, string> = { ...CG_IDS };
  try {
    const raw = sessionStorage.getItem(MARKETS_CACHE_KEY);
    if (raw) {
      const { ts, data } = JSON.parse(raw);
      if (Date.now() - ts < MARKETS_CACHE_TTL) return { ...result, ...data };
    }
  } catch { /* ignore */ }
  try {
    const r = await fetch(
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=500&page=1'
    );
    const markets: { symbol: string; id: string }[] = await r.json();
    if (Array.isArray(markets)) {
      const fetched: Record<string, string> = {};
      for (const c of markets) fetched[c.symbol.toUpperCase()] = c.id;
      try { sessionStorage.setItem(MARKETS_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: fetched })); } catch { /* ignore */ }
      return { ...result, ...fetched };
    }
  } catch { /* fall back to hardcoded */ }
  return result;
}

function rangeToDays(range: Range, firstPurchase: Date): number {
  switch (range) {
    case '1D':  return 1;
    case '1W':  return 7;
    case '1M':  return 30;
    case '1Q':  return 90;
    case '1Y':  return 365;
    case 'ALL': return Math.max(1, Math.ceil((Date.now() - firstPurchase.getTime()) / DAY_MS) + 2);
  }
}

export default function PortfolioChart() {
  const [events, setEvents] = useState<PortfolioEvent[]>([]);
  const [assets, setAssets] = useState<string[]>([]);
  const [hiddenAssets, setHiddenAssets] = useState<Set<string>>(new Set());
  const [range, setRange] = useState<Range>('1M');
  const [yMode, setYMode] = useState<YMode>('QTY');
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [pricesLoading, setPricesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch buy/sell events once on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/portfolio-events`)
      .then(r => r.json())
      .then((data: PortfolioEvent[]) => {
        if (!Array.isArray(data)) return;
        setEvents(data);
        // Unique assets in chronological order of first purchase
        const seen = new Set<string>();
        const ordered: string[] = [];
        for (const e of data) {
          if (!seen.has(e.asset_symbol)) {
            seen.add(e.asset_symbol);
            ordered.push(e.asset_symbol);
          }
        }
        setAssets(ordered);
      })
      .catch(() => setError('Failed to load portfolio data'))
      .finally(() => setEventsLoading(false));
  }, []);

  // Rebuild chart data when events / range / yMode change
  useEffect(() => {
    if (!events.length) return;

    const firstTs = events.reduce((min, e) => {
      const t = new Date(e.timestamp).getTime();
      return t < min ? t : min;
    }, Infinity);
    const firstPurchase = new Date(firstTs);

    const start = getStartDate(range, firstPurchase);
    const points = generatePoints(start, range);

    // Compute qty held per asset at each time point
    const qtyAtPoint = points.map(pt => {
      const row: Record<string, number> = {};
      for (const asset of assets) {
        let qty = 0;
        for (const ev of events) {
          if (ev.asset_symbol !== asset) continue;
          if (new Date(ev.timestamp) > pt) break;
          qty += ev.event_type === 'buy' ? Number(ev.qty) : -Number(ev.qty);
        }
        row[asset] = Math.max(0, qty);
      }
      return row;
    });

    if (yMode === 'QTY') {
      setChartData(points.map((pt, i) => ({
        label: pt.toISOString(),
        ts: pt.getTime(),
        ...qtyAtPoint[i],
      })));
      return;
    }

    // USD mode: fetch historical prices from CoinGecko sequentially to avoid rate limits
    setPricesLoading(true);
    const days = rangeToDays(range, firstPurchase);

    (async () => {
      try {
        // Step 1: get symbol → CoinGecko id mapping (hardcoded + API + cache)
        const symbolToId = await getSymbolToId();

        // Step 2: fetch price history — try CoinGecko first, fall back to CoinCap
        const priceArrays: Record<string, [number, number][]> = {};

        for (const asset of assets) {
          const cgId = symbolToId[asset];
          let prices: [number, number][] | null = null;

          if (cgId) {
            prices = await fetchCoinGecko(cgId, days);
            await new Promise(res => setTimeout(res, 400));
          }

          if (!prices) {
            const capId = COINCAP_IDS[asset];
            if (capId) {
              prices = await fetchCoinCap(capId, days);
              await new Promise(res => setTimeout(res, 300));
            }
          }

          if (prices && prices.length > 0) priceArrays[asset] = prices;
        }

        // Step 3: build chart data — use null for coins with no price data
        setChartData(points.map((pt, i) => {
          const row: ChartPoint = { label: pt.toISOString(), ts: pt.getTime() };
          for (const asset of assets) {
            const qty = qtyAtPoint[i][asset];
            const priceData = priceArrays[asset];
            const price = priceData ? closestPrice(priceData, pt.getTime()) : null;
            row[asset] = price !== null ? qty * price : null;
          }
          return row;
        }));
      } finally {
        setPricesLoading(false);
      }
    })();
  }, [events, assets, range, yMode]);

  const toggleAsset = (asset: string) => {
    setHiddenAssets(prev => {
      const next = new Set(prev);
      next.has(asset) ? next.delete(asset) : next.add(asset);
      return next;
    });
  };

  const RANGES: Range[] = ['1D', '1W', '1M', '1Q', '1Y', 'ALL'];

  if (eventsLoading) return <div className="bg-brand-light animate-pulse rounded-xl h-96" />;
  if (error) return <div className="text-brand-clay text-sm p-4 rounded-xl border border-brand-clay/30">{error}</div>;
  if (!events.length) {
    return (
      <div className="text-center py-12 text-sm text-brand-mid bg-brand-light rounded-xl border border-brand-mid/40">
        No portfolio data. Upload a CSV to see your chart.
      </div>
    );
  }

  return (
    <div>
      {/* Header row: title + controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-base font-semibold text-brand-dark">Portfolio Performance</h2>
        <div className="flex items-center gap-2">
          {/* Y-axis mode toggle */}
          <div className="flex rounded-lg border border-brand-mid/40 overflow-hidden text-xs font-medium">
            {(['USD', 'QTY'] as YMode[]).map(m => (
              <button
                key={m}
                onClick={() => setYMode(m)}
                className={`px-3 py-1.5 transition-colors ${
                  yMode === m
                    ? 'bg-brand-dark text-white'
                    : 'bg-white text-brand-mid hover:bg-brand-light'
                }`}
              >
                {m === 'USD' ? '$ Value' : '# Coins'}
              </button>
            ))}
          </div>
          {/* Range selector */}
          <div className="flex rounded-lg border border-brand-mid/40 overflow-hidden text-xs font-medium">
            {RANGES.map(r => (
              <button
                key={r}
                onClick={() => { setRange(r); setYMode('QTY'); }}
                className={`px-3 py-1.5 transition-colors ${
                  range === r
                    ? 'bg-brand-dark text-white'
                    : 'bg-white text-brand-mid hover:bg-brand-light'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Coin filter chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {assets.map((asset, i) => {
          const hidden = hiddenAssets.has(asset);
          return (
            <button
              key={asset}
              onClick={() => toggleAsset(asset)}
              style={hidden ? undefined : { backgroundColor: COLORS[i % COLORS.length], borderColor: COLORS[i % COLORS.length] }}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                hidden
                  ? 'bg-white text-brand-mid border-brand-mid/40'
                  : 'text-white'
              }`}
            >
              {asset}
            </button>
          );
        })}
      </div>

      {/* Chart */}
      <div className="relative bg-white rounded-xl border border-brand-mid/40 p-4">
        {pricesLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-xl bg-white/80 backdrop-blur-sm gap-3">
            <svg className="animate-spin h-8 w-8 text-brand-dark" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-xs text-brand-mid">Loading price history…</p>
          </div>
        )}
        <ResponsiveContainer width="100%" height={440}>
          <LineChart data={chartData} margin={{ top: 5, right: 24, left: 8, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#9CA3AF' }}
              tickFormatter={v => fmtAxisDate(v, range)}
              interval="preserveStartEnd"
              minTickGap={60}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#9CA3AF' }}
              tickFormatter={v => fmtAxisY(Number(v), yMode)}
              width={72}
            />
            <Tooltip content={<SortedTooltip yMode={yMode} range={range} />} />
            {assets.map((asset, i) => (
              <Line
                key={asset}
                type="monotone"
                dataKey={asset}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={2}
                dot={false}
                hide={hiddenAssets.has(asset)}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {yMode === 'QTY' && assets.filter(a => !hiddenAssets.has(a)).length > 1 && (
        <p className="text-xs text-brand-mid mt-2">
          Tip: coins with very different quantities (e.g. BTC vs SHIB) are hard to compare on the same scale — filter to one coin at a time for a clearer view.
        </p>
      )}
    </div>
  );
}
