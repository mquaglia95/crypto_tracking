import React, { useEffect, useState } from 'react';
import { TaxLot } from '../types';

interface Props {
  lots: TaxLot[];
  loading: boolean;
}

function fmtUsd(n: number): string {
  const prefix = n < 0 ? '-$' : '$';
  return prefix + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtQty(n: number): string {
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}

export default function TaxLotsTable({ lots, loading }: Props) {
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [pricesLoading, setPricesLoading] = useState(false);

  useEffect(() => {
    if (lots.length === 0) return;

    const symbols = [...new Set(lots.map((l) => l.asset_symbol.toLowerCase()))];
    setPricesLoading(true);

    // CoinGecko free API: fetch top 500 coins by market cap, match by symbol
    fetch(
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=500&page=1'
    )
      .then((r) => r.json())
      .then((coins: { symbol: string; current_price: number }[]) => {
        const map: Record<string, number> = {};
        for (const coin of coins) {
          if (symbols.includes(coin.symbol.toLowerCase())) {
            map[coin.symbol.toUpperCase()] = coin.current_price;
          }
        }
        setPrices(map);
      })
      .catch(() => {/* silently fail — columns just show N/A */})
      .finally(() => setPricesLoading(false));
  }, [lots]);

  if (loading) return <div className="bg-brand-light animate-pulse rounded-xl h-48" />;

  const byAsset = lots.reduce<Record<string, TaxLot[]>>((acc, lot) => {
    if (!acc[lot.asset_symbol]) acc[lot.asset_symbol] = [];
    acc[lot.asset_symbol].push(lot);
    return acc;
  }, {});

  return (
    <div>
      <h2 className="text-base font-semibold text-brand-dark mb-3">Open Tax Lots (Unrealized Positions)</h2>

      {lots.length === 0 ? (
        <div className="text-center py-12 text-sm text-brand-mid bg-brand-light rounded-xl border border-brand-mid/40">
          No open tax lots. Upload a CSV to see your unrealized positions.
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(byAsset).map(([asset, assetLots]) => {
            const totalRemainingQty = assetLots.reduce((s, l) => s + Number(l.remaining_qty), 0);
            const totalCostBasis = assetLots.reduce((s, l) => s + Number(l.remaining_cost_basis), 0);

            return (
              <div key={asset} className="rounded-xl border border-brand-mid/40 overflow-hidden">
                <div className="bg-brand-light px-4 py-2 flex items-center justify-between">
                  <span className="font-semibold text-brand-dark">{asset}</span>
                  <span className="text-xs text-brand-mid">
                    {fmtQty(totalRemainingQty)} remaining · Cost basis: {fmtUsd(totalCostBasis)}
                    {prices[asset] != null && (() => {
                      const currentVal = assetLots.reduce((s, l) => s + Number(l.remaining_qty) * prices[asset], 0);
                      const pnl = currentVal - totalCostBasis;
                      return (
                        <span className={`ml-2 ${pnl >= 0 ? 'text-brand-green' : 'text-brand-clay'}`}>
                          · Total P&amp;L: {fmtUsd(pnl)}
                        </span>
                      );
                    })()}
                  </span>
                </div>
                <table className="w-full text-sm">
                  <thead className="text-xs text-brand-mid uppercase">
                    <tr>
                      <th className="px-4 py-2 text-left">Purchased</th>
                      <th className="px-4 py-2 text-right">Qty Remaining</th>
                      <th className="px-4 py-2 text-right">Cost / Unit</th>
                      <th className="px-4 py-2 text-right">Amount Paid</th>
                      <th className="px-4 py-2 text-right">
                        Worth Now
                        {pricesLoading && <span className="ml-1 text-brand-mid normal-case">(loading…)</span>}
                      </th>
                      <th className="px-4 py-2 text-right">Unrealized P&amp;L</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-mid/20">
                    {assetLots.map((lot) => {
                      const currentPrice = prices[asset];
                      const worthNow = currentPrice != null ? Number(lot.remaining_qty) * currentPrice : null;
                      const pnl = worthNow != null ? worthNow - Number(lot.remaining_cost_basis) : null;
                      return (
                        <tr key={lot.id} className="hover:bg-brand-light transition-colors">
                          <td className="px-4 py-2 text-brand-mid">
                            {new Date(lot.buy_timestamp).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-2 text-right text-brand-dark">{fmtQty(lot.remaining_qty)}</td>
                          <td className="px-4 py-2 text-right text-brand-dark">{fmtUsd(lot.price_per_unit)}</td>
                          <td className="px-4 py-2 text-right text-brand-dark">{fmtUsd(lot.remaining_cost_basis)}</td>
                          <td className="px-4 py-2 text-right text-brand-dark">
                            {worthNow != null ? fmtUsd(worthNow) : <span className="text-brand-mid">N/A</span>}
                          </td>
                          <td className={`px-4 py-2 text-right font-semibold ${
                            pnl == null ? '' : pnl >= 0 ? 'text-brand-green' : 'text-brand-clay'
                          }`}>
                            {pnl != null ? fmtUsd(pnl) : <span className="text-brand-mid">N/A</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
