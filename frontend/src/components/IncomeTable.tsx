import React from 'react';
import { IncomeEvent } from '../types';

interface Props {
  events: IncomeEvent[];
  loading: boolean;
}

export default function IncomeTable({ events, loading }: Props) {
  if (loading) return <div className="bg-gray-100 animate-pulse rounded-xl h-48" />;

  const totalIncome = events.reduce((s, e) => s + Number(e.value_usd), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-gray-800">Staking &amp; Other Income</h2>
        {events.length > 0 && (
          <span className="text-sm font-medium text-purple-600">
            Total: ${totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        )}
      </div>

      {events.length === 0 ? (
        <div className="text-center py-12 text-sm text-gray-400 bg-gray-50 rounded-xl border border-gray-200">
          No income events found. Staking rewards and airdrops will appear here.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Asset</th>
                <th className="px-4 py-3 text-right">Quantity</th>
                <th className="px-4 py-3 text-right">Value (USD)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {events.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(e.event_timestamp).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                      {e.income_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800">{e.asset_symbol}</td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {Number(e.qty).toLocaleString('en-US', { maximumFractionDigits: 8 })}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-purple-600">
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
