import React from 'react';
import { TaxLot } from '../types';

interface Props {
  lots: TaxLot[];
  loading: boolean;
}

function fmt(n: number, decimals = 2): string {
  return Number(n).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export default function TaxLotsTable({ lots, loading }: Props) {
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
                    {fmt(totalRemainingQty, 6)} remaining · Cost basis: ${fmt(totalCostBasis)}
                  </span>
                </div>
                <table className="w-full text-sm">
                  <thead className="text-xs text-brand-mid uppercase">
                    <tr>
                      <th className="px-4 py-2 text-left">Purchased</th>
                      <th className="px-4 py-2 text-right">Qty Remaining</th>
                      <th className="px-4 py-2 text-right">Cost / Unit</th>
                      <th className="px-4 py-2 text-right">Remaining Basis</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-mid/20">
                    {assetLots.map((lot) => (
                      <tr key={lot.id} className="hover:bg-brand-light transition-colors">
                        <td className="px-4 py-2 text-brand-mid">
                          {new Date(lot.buy_timestamp).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-2 text-right text-brand-dark">{fmt(lot.remaining_qty, 6)}</td>
                        <td className="px-4 py-2 text-right text-brand-dark">${fmt(lot.price_per_unit, 6)}</td>
                        <td className="px-4 py-2 text-right font-medium text-brand-dark">
                          ${fmt(lot.remaining_cost_basis)}
                        </td>
                      </tr>
                    ))}
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
