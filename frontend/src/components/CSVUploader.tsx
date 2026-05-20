import React, { useCallback, useState } from 'react';
import { API_BASE } from '../api';

interface Props {
  onUploadComplete: () => void;
}

interface IngestionSummary {
  lots: number;
  sales: number;
  income: number;
  unmatched: number;
}

export default function CSVUploader({ onUploadComplete }: Props) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [summary, setSummary] = useState<IngestionSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.endsWith('.csv')) {
        setError('Please upload a .csv file from Coinbase.');
        return;
      }

      setUploading(true);
      setError(null);
      setSummary(null);

      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await fetch(`${API_BASE}/api/upload`, { method: 'POST', body: formData });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Upload failed');

        setSummary(data.summary);
        onUploadComplete();
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setUploading(false);
      }
    },
    [onUploadComplete]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      e.target.value = '';
    },
    [handleFile]
  );

  return (
    <div className="mb-8">
      <label
        className={`flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-xl cursor-pointer transition-colors
          ${dragging
            ? 'border-brand-green bg-brand-green/10'
            : 'border-brand-mid/50 bg-brand-light hover:bg-brand-mid/10'}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <div className="text-center pointer-events-none">
          <p className="text-2xl mb-2">📂</p>
          {uploading ? (
            <p className="text-sm text-brand-mid">Processing CSV and running HIFO engine...</p>
          ) : (
            <>
              <p className="text-sm font-medium text-brand-dark">Drop your Coinbase CSV here</p>
              <p className="text-xs text-brand-mid mt-1">or click to browse</p>
            </>
          )}
        </div>
        <input type="file" accept=".csv" className="hidden" onChange={onInputChange} />
      </label>

      {error && (
        <div className="mt-3 p-3 bg-brand-clay/10 border border-brand-clay/30 rounded-lg text-sm text-brand-clay">
          {error}
        </div>
      )}

      {summary && (
        <div className="mt-3 p-3 bg-brand-green/20 border border-brand-green rounded-lg text-sm text-brand-dark">
          <p className="font-semibold mb-1">Ingestion complete</p>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div><span className="font-bold">{summary.lots}</span><br />Buy lots</div>
            <div><span className="font-bold">{summary.sales}</span><br />Sales</div>
            <div><span className="font-bold">{summary.income}</span><br />Income events</div>
            <div><span className="font-bold text-brand-clay">{summary.unmatched}</span><br />Flagged</div>
          </div>
        </div>
      )}
    </div>
  );
}
