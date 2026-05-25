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

  const visible = (filter === 'ALL' ? records : records.filter((r) => r.classification === filter))
    .slice()
    .sort((a, b) => (a.date_acquired < b.date_acquired ? 1 : -1));

  if (loading) {
    return <div className="bg-brand-light animate-pulse rounded-xl h-48" />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-brand-dark">Form 8949 — Capital Gains &amp; Losses</h2>
        <div className="flex gap-2">
          {(['ALL', 'SHORT', 'LONG'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors
                ${filter === f
                  ? 'bg-brand-dark text-white border-brand-dark'
                  : 'bg-white text-brand-mid border-brand-mid/40 hover:border-brand-clay'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="text-center py-12 text-sm text-brand-mid bg-brand-light rounded-xl border border-brand-mid/40">
          No records to display. Upload a CSV to populate this table.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-brand-mid/40">
          <table className="w-full text-sm">
            <thead className="bg-brand-light text-xs text-brand-mid uppercase tracking-wide">
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
            <tbody className="divide-y divide-brand-mid/20">
              {visible.map((r) => (
                <tr key={r.id} className="hover:bg-brand-light transition-colors">
                  <td className="px-4 py-3 font-medium text-brand-dark">
                    <div>{r.description_of_property}</div>
                    <div className="text-xs text-brand-mid">{r.quantity_and_token}</div>
                  </td>
                  <td className="px-4 py-3 text-brand-mid">{r.date_acquired}</td>
                  <td className="px-4 py-3 text-brand-mid">{r.date_sold}</td>
                  <td className="px-4 py-3 text-right text-brand-dark">{fmt(r.gross_proceeds)}</td>
                  <td className="px-4 py-3 text-right text-brand-dark">{fmt(r.total_cost_basis)}</td>
                  <td className={`px-4 py-3 text-right font-semibold
                    ${r.capital_gain_or_loss > 0 ? 'text-brand-green' : r.capital_gain_or_loss < 0 ? 'text-brand-clay' : 'text-brand-mid'}`}>
                    {fmt(r.capital_gain_or_loss)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium
                      ${r.classification === 'SHORT'
                        ? 'bg-brand-clay/15 text-brand-clay'
                        : 'bg-brand-green/30 text-brand-dark'}`}>
                      {r.classification}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-right text-xs font-medium
                    ${r.running_net_gain_loss > 0 ? 'text-brand-green' : 'text-brand-clay'}`}>
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
