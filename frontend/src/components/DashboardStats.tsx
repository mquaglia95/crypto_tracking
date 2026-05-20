import React from 'react';
import { TaxSummary } from '../types';

interface Props {
  summary: TaxSummary | null;
  loading: boolean;
}

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-1 shadow-sm">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold ${color ?? 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

function fmt(n: number): string {
  const prefix = n < 0 ? '-$' : '$';
  return prefix + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function gainColor(n: number): string {
  if (n > 0) return 'text-green-600';
  if (n < 0) return 'text-red-600';
  return 'text-gray-900';
}

export default function DashboardStats({ summary, loading }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-gray-100 animate-pulse rounded-xl h-24" />
        ))}
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center text-sm text-gray-400 mb-8">
        Upload a CSV to see your tax summary.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      <StatCard
        label="Net Short-Term Gains"
        value={fmt(summary.net_short_term)}
        sub="Taxed as ordinary income"
        color={gainColor(summary.net_short_term)}
      />
      <StatCard
        label="Net Long-Term Gains"
        value={fmt(summary.net_long_term)}
        sub="0% / 15% / 20% rates"
        color={gainColor(summary.net_long_term)}
      />
      <StatCard
        label="Total Net Gain/Loss"
        value={fmt(summary.net_total)}
        sub={`${summary.winning_trades}W / ${summary.losing_trades}L across ${summary.total_trades} trades`}
        color={gainColor(summary.net_total)}
      />
      <StatCard
        label="Staking Income"
        value={fmt(summary.total_staking_income)}
        sub="Ordinary income"
        color="text-purple-600"
      />
    </div>
  );
}
