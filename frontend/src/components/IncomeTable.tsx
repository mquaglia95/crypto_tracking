import React from 'react';
import { IncomeEvent } from '../types';

interface Props {
  events: IncomeEvent[];
  loading: boolean;
}

export default function IncomeTable({ events, loading }: Props) {
  if (loading) return <div className="bg-brand-light animate-pulse rounded-xl h-48" />;

  const totalIncome = events.reduce((s, e) => s + Number(e.value_usd), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-brand-dark">Staking &amp; Other Income</h2>
        {events.length > 0 && (
          <span className="text-sm font-medium text-brand-clay">
            Total: ${totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        )}
      </div>

      {events.length === 0 ? (
        <div className="text-center py-12 text-sm text-brand-mid bg-brand-light rounded-xl border border-brand-mid/40">
          No income events found. Staking rewards and airdrops will appear here.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-brand-mid/40">
          <table className="w-full text-sm">
            <thead className="bg-brand-light text-xs text-brand-mid uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Asset</th>
                <th className="px-4 py-3 text-right">Quantity</th>
                <th className="px-4 py-3 text-right">Value (USD)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-mid/20">
              {events.map((e) => (
                <tr key={e.id} className="hover:bg-brand-light transition-colors">
                  <td className="px-4 py-3 text-brand-mid">
                    {new Date(e.event_timestamp).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-brand-clay/15 text-brand-clay">
                      {e.income_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-brand-dark">{e.asset_symbol}</td>
                  <td className="px-4 py-3 text-right text-brand-dark">
                    {Number(e.qty).toLocaleString('en-US', { maximumFractionDigits: 8 })}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-brand-clay">
                    ${Number(e.value_usd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
