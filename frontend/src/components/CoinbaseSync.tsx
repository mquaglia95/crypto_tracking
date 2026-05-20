import React, { useState } from 'react';
import { API_BASE } from '../api';

interface Props {
  onSyncComplete: () => void;
}

interface SyncSummary {
  lots: number;
  sales: number;
  income: number;
  skipped: number;
  accounts_scanned: number;
}

export default function CoinbaseSync({ onSyncComplete }: Props) {
  const [open, setOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [summary, setSummary] = useState<SyncSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSync = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim() || !apiSecret.trim()) return;

    setSyncing(true);
    setError(null);
    setSummary(null);

    try {
      const res = await fetch(`${API_BASE}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim(), apiSecret: apiSecret.trim() }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Sync failed');

      setSummary(data.summary);
      setApiKey('');
      setApiSecret('');
      onSyncComplete();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="mb-4 rounded-xl border border-brand-mid/40 bg-white overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-sm font-medium text-brand-dark hover:bg-brand-light transition-colors"
      >
        <span className="flex items-center gap-2">
          <span>🔗</span>
          Sync directly from Coinbase API
        </span>
        <span className="text-brand-mid text-xs">{open ? '▲ collapse' : '▼ expand'}</span>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-brand-mid/30">
          <p className="text-xs text-brand-mid mt-3 mb-4">
            Your API key and secret are sent directly to the backend for a single request and are
            never stored. Generate a read-only key at{' '}
            <strong className="text-brand-dark">coinbase.com → Settings → API → New API Key</strong>.
            Only "wallet:transactions:read" and "wallet:accounts:read" permissions are needed.
            <br />
            <span className="text-brand-clay font-medium">
              Note: DEX trades are not included — the Coinbase API only returns exchange transactions.
              Use the CSV upload above for full history including DEX.
            </span>
          </p>

          <form onSubmit={handleSync} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-brand-mid mb-1">API Key</label>
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="organizations/..."
                className="w-full px-3 py-2 text-sm border border-brand-mid/50 rounded-lg text-brand-dark placeholder-brand-mid/60 focus:outline-none focus:ring-2 focus:ring-brand-clay/40"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-brand-mid mb-1">API Secret</label>
              <input
                type="password"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                placeholder="-----BEGIN EC PRIVATE KEY-----"
                className="w-full px-3 py-2 text-sm border border-brand-mid/50 rounded-lg text-brand-dark placeholder-brand-mid/60 focus:outline-none focus:ring-2 focus:ring-brand-clay/40"
                required
              />
            </div>

            <button
              type="submit"
              disabled={syncing || !apiKey || !apiSecret}
              className="w-full py-2 px-4 bg-brand-dark text-white text-sm font-medium rounded-lg
                hover:bg-brand-dark/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {syncing ? 'Syncing from Coinbase...' : 'Sync Now'}
            </button>
          </form>

          {error && (
            <div className="mt-3 p-3 bg-brand-clay/10 border border-brand-clay/30 rounded-lg text-sm text-brand-clay">
              {error}
            </div>
          )}

          {summary && (
            <div className="mt-3 p-3 bg-brand-green/20 border border-brand-green rounded-lg text-sm text-brand-dark">
              <p className="font-semibold mb-1">
                Sync complete — {summary.accounts_scanned} accounts scanned
              </p>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div><span className="font-bold">{summary.lots}</span><br />Buy lots</div>
                <div><span className="font-bold">{summary.sales}</span><br />Sales</div>
                <div><span className="font-bold">{summary.income}</span><br />Income events</div>
                <div><span className="font-bold text-brand-clay">{summary.skipped}</span><br />Skipped</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
