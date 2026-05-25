import React, { useState, useEffect, useCallback } from 'react';
import CSVUploader from './components/CSVUploader';
import CoinbaseSync from './components/CoinbaseSync';
import DashboardStats from './components/DashboardStats';
import TaxTable from './components/TaxTable';
import TaxLotsTable from './components/TaxLotsTable';
import IncomeTable from './components/IncomeTable';
import PortfolioChart from './components/PortfolioChart';
import { TaxRecord, TaxSummary, TaxLot, IncomeEvent } from './types';
import { API_BASE } from './api';

type Tab = 'report' | 'lots' | 'income' | 'portfolio';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('portfolio');
  const [records, setRecords] = useState<TaxRecord[]>([]);
  const [summary, setSummary] = useState<TaxSummary | null>(null);
  const [lots, setLots] = useState<TaxLot[]>([]);
  const [income, setIncome] = useState<IncomeEvent[]>([]);
  const [loadingReport, setLoadingReport] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingLots, setLoadingLots] = useState(false);
  const [loadingIncome, setLoadingIncome] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoadingReport(true);
    setLoadingSummary(true);
    setLoadingLots(true);
    setLoadingIncome(true);

    const [reportRes, summaryRes, lotsRes, incomeRes] = await Promise.allSettled([
      fetch(`${API_BASE}/api/report`).then((r) => r.json()),
      fetch(`${API_BASE}/api/summary`).then((r) => r.json()),
      fetch(`${API_BASE}/api/lots`).then((r) => r.json()),
      fetch(`${API_BASE}/api/income`).then((r) => r.json()),
    ]);

    if (reportRes.status === 'fulfilled' && Array.isArray(reportRes.value)) setRecords(reportRes.value);
    if (summaryRes.status === 'fulfilled' && !summaryRes.value?.error) setSummary(summaryRes.value);
    if (lotsRes.status === 'fulfilled' && Array.isArray(lotsRes.value)) setLots(lotsRes.value);
    if (incomeRes.status === 'fulfilled' && Array.isArray(incomeRes.value)) setIncome(incomeRes.value);

    setLoadingReport(false);
    setLoadingSummary(false);
    setLoadingLots(false);
    setLoadingIncome(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'portfolio', label: 'Portfolio' },
    { id: 'report', label: 'Tax Report (Form 8949)' },
    { id: 'lots', label: 'Open Lots' },
    { id: 'income', label: 'Income' },
  ];

  const [resetting, setResetting] = useState(false);

  const handleReset = useCallback(async () => {
    if (!window.confirm('This will permanently delete all uploaded data and reset the dashboard. Are you sure?')) return;
    setResetting(true);
    try {
      await fetch(`${API_BASE}/api/reset`, { method: 'DELETE' });
      setRecords([]);
      setSummary(null);
      setLots([]);
      setIncome([]);
    } finally {
      setResetting(false);
    }
  }, []);

  return (
    <div className="min-h-screen bg-brand-light">
      <header className="bg-white border-b border-brand-mid/40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📊</span>
              <div>
                <h1 className="text-lg font-bold text-brand-dark">Crypto HIFO Tax Tracker</h1>
                <p className="text-xs text-brand-mid">
                  HIFO cost basis · IRS Form 8949 · Mid-year check anytime
                </p>
              </div>
            </div>
            <button
              onClick={handleReset}
              disabled={resetting}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-brand-clay/40 text-brand-clay hover:bg-brand-clay/10 disabled:opacity-50 transition-colors"
            >
              {resetting ? 'Clearing…' : 'Clear all data'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <CoinbaseSync onSyncComplete={fetchAll} />
        <CSVUploader onUploadComplete={fetchAll} />
        <DashboardStats summary={summary} loading={loadingSummary} />

        <div className="border-b border-brand-mid/40 mb-6">
          <nav className="flex gap-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors
                  ${activeTab === tab.id
                    ? 'border-brand-green-dark text-brand-green-dark'
                    : 'border-transparent text-brand-dark hover:text-brand-dark'}`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {activeTab === 'report'    && <TaxTable records={records} loading={loadingReport} />}
        {activeTab === 'lots'      && <TaxLotsTable lots={lots} loading={loadingLots} />}
        {activeTab === 'income'    && <IncomeTable events={income} loading={loadingIncome} />}
        {activeTab === 'portfolio' && <PortfolioChart />}
      </main>
    </div>
  );
}
