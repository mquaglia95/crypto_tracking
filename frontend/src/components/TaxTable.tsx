import React, { useState } from 'react';
import { TaxRecord } from '../types';

interface Props {
  records: TaxRecord[];
  loading: boolean;
}

function fmt(n: number): string {
  const prefix = n < 0 ? '-$' : '$';
  return prefix + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function TaxTable({ records, loading }: Props) {
  const [filter, setFilter] = useState<'ALL' | 'SHORT' | 'LONG'>('ALL');

  const visible = filter === 'ALL' ? records : records.filter((r) => r.classification === filter);

  if (loading) {
    return <div className="bg-gray-100 animate-pulse rounded-xl h-48" />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-gray-800">Form 8949 — Capital Gains &amp; Losses</h2>
        <div className="flex gap-2">
          {(['ALL', 'SHORT', 'LONG'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors
                ${filter === f
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="text-center py-12 text-sm text-gray-400 bg-gray-50 rounded-xl border border-gray-200">
          No records to display. Upload a CSV to populate this table.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Asset</th>
                <th className="px-4 py-3 text-left">Acquired</th>
                <th className="px-4 py-3 text-left">Sold</th>
                <th className="px-4 py-3 text-right">Proceeds</th>
                <th className="px-4 py-3 text-right">Cost Basis</th>
                <th className="px-4 py-3 text-right">Gain / Loss</th>
                <th className="px-4 py-3 text-center">Term</th>
                <th className="px-4 py-3 text-right">Running Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visible.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <div>{r.description_of_property}</div>
                    <div className="text-xs text-gray-400">{r.quantity_and_token}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{r.date_acquired}</td>
                  <td className="px-4 py-3 text-gray-600">{r.date_sold}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{fmt(r.gross_proceeds)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{fmt(r.total_cost_basis)}</td>
                  <td className={`px-4 py-3 text-right font-semibold
                    ${r.capital_gain_or_loss > 0 ? 'text-green-600' : r.capital_gain_or_loss < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                    {fmt(r.capital_gain_or_loss)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium
                      ${r.classification === 'SHORT' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                      {r.classification}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-right text-xs
                    ${r.running_net_gain_loss > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {fmt(r.running_net_gain_loss)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
