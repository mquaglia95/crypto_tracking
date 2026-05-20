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
  if (loading) return <div className="bg-gray-100 animate-pulse rounded-xl h-48" />;

  // Group by asset
  const byAsset = lots.reduce<Record<string, TaxLot[]>>((acc, lot) => {
    if (!acc[lot.asset_symbol]) acc[lot.asset_symbol] = [];
    acc[lot.asset_symbol].push(lot);
    return acc;
  }, {});

  return (
    <div>
      <h2 className="text-base font-semibold text-gray-800 mb-3">Open Tax Lots (Unrealized Positions)</h2>

      {lots.length === 0 ? (
        <div className="text-center py-12 text-sm text-gray-400 bg-gray-50 rounded-xl border border-gray-200">
          No open tax lots. Upload a CSV to see your unrealized positions.
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(byAsset).map(([asset, assetLots]) => {
            const totalRemainingQty = assetLots.reduce((s, l) => s + Number(l.remaining_qty), 0);
            const totalCostBasis = assetLots.reduce((s, l) => s + Number(l.remaining_cost_basis), 0);

            return (
              <div key={asset} className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 flex items-center justify-between">
                  <span className="font-semibold text-gray-800">{asset}</span>
                  <span className="text-xs text-gray-500">
                    {fmt(totalRemainingQty, 6)} remaining · Cost basis: ${fmt(totalCostBasis)}
                  </span>
                </div>
                <table className="w-full text-sm">
                  <thead className="text-xs text-gray-400 uppercase">
                    <tr>
                      <th className="px-4 py-2 text-left">Purchased</th>
                      <th className="px-4 py-2 text-right">Qty Remaining</th>
                      <th className="px-4 py-2 text-right">Cost / Unit</th>
                      <th className="px-4 py-2 text-right">Remaining Basis</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {assetLots.map((lot) => (
                      <tr key={lot.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-600">
                          {new Date(lot.buy_timestamp).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-700">{fmt(lot.remaining_qty, 6)}</td>
                        <td className="px-4 py-2 text-right text-gray-700">${fmt(lot.price_per_unit, 6)}</td>
                        <td className="px-4 py-2 text-right font-medium text-gray-800">
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
