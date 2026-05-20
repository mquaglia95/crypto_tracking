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
    <div className="bg-white rounded-xl border border-brand-mid/40 p-5 flex flex-col gap-1 shadow-sm">
      <p className="text-xs font-medium text-brand-mid uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold ${color ?? 'text-brand-dark'}`}>{value}</p>
      {sub && <p className="text-xs text-brand-mid">{sub}</p>}
    </div>
  );
}

function fmt(n: number): string {
  const prefix = n < 0 ? '-$' : '$';
  return prefix + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function gainColor(n: number): string {
  if (n > 0) return 'text-brand-green';
  if (n < 0) return 'text-brand-clay';
  return 'text-brand-dark';
}

export default function DashboardStats({ summary, loading }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-brand-light animate-pulse rounded-xl h-24" />
        ))}
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="bg-brand-light border border-brand-mid/40 rounded-xl p-6 text-center text-sm text-brand-mid mb-8">
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
      />
      <StatCard
        label="Net Long-Term Gains"
        value={fmt(summary.net_long_term)}
        sub="0% / 15% / 20% rates"
      />
      <StatCard
        label="Total Net Gain/Loss"
        value={fmt(summary.net_total)}
        sub={`${summary.winning_trades}W / ${summary.losing_trades}L across ${summary.total_trades} trades`}
      />
      <StatCard
        label="Staking Income"
        value={fmt(summary.total_staking_income)}
        sub="Ordinary income"
      />
    </div>
  );
}
