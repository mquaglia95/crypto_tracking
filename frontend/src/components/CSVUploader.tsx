import React, { useCallback, useState } from 'react';
import { API_BASE } from '../api';

interface Props {
  onUploadComplete: () => void;
}

interface FileSummary {
  name: string;
  lots: number;
  sales: number;
  income: number;
  unmatched: number;
  skipped: number;
}

interface UploadResult {
  totals: FileSummary;
  files: FileSummary[];
}

export default function CSVUploader({ onUploadComplete }: Props) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList).filter(f => f.name.endsWith('.csv'));
      if (!files.length) {
        setError('Please upload .csv files exported from Coinbase.');
        return;
      }

      setUploading(true);
      setError(null);
      setResult(null);

      const formData = new FormData();
      for (const file of files) {
        formData.append('files', file);
      }

      try {
        const res = await fetch(`${API_BASE}/api/upload`, { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');
        setResult(data);
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
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) handleFiles(e.target.files);
      e.target.value = '';
    },
    [handleFiles]
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
            <p className="text-sm text-brand-mid">Processing CSVs and running HIFO engine…</p>
          ) : (
            <>
              <p className="text-sm font-medium text-brand-dark">Drop your Coinbase CSV files here</p>
              <p className="text-xs text-brand-mid mt-1">or click to browse — you can select multiple files at once</p>
            </>
          )}
        </div>
        <input type="file" accept=".csv" multiple className="hidden" onChange={onInputChange} />
      </label>

      {error && (
        <div className="mt-3 p-3 bg-brand-clay/10 border border-brand-clay/30 rounded-lg text-sm text-brand-clay">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-3 space-y-2">
          {/* Per-file breakdown (only shown when more than one file) */}
          {result.files.length > 1 && result.files.map((f) => (
            <div key={f.name} className="p-3 bg-white border border-brand-mid/30 rounded-lg text-xs text-brand-mid">
              <p className="font-medium text-brand-dark mb-1 truncate">{f.name}</p>
              <div className="flex gap-4">
                <span><strong className="text-brand-dark">{f.lots}</strong> lots</span>
                <span><strong className="text-brand-dark">{f.sales}</strong> sales</span>
                <span><strong className="text-brand-dark">{f.income}</strong> income</span>
                {f.skipped > 0 && <span className="text-brand-mid">{f.skipped} skipped (already uploaded)</span>}
                {f.unmatched > 0 && <span className="text-brand-clay">{f.unmatched} flagged</span>}
              </div>
            </div>
          ))}

          {/* Totals */}
          <div className="p-3 bg-brand-green/20 border border-brand-green rounded-lg text-sm text-brand-dark">
            <p className="font-semibold mb-2">
              {result.files.length === 1 ? 'Ingestion complete' : `${result.files.length} files ingested`}
            </p>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div><span className="font-bold">{result.totals.lots}</span><br />Buy lots</div>
              <div><span className="font-bold">{result.totals.sales}</span><br />Sales</div>
              <div><span className="font-bold">{result.totals.income}</span><br />Income events</div>
              <div>
                <span className="font-bold text-brand-clay">{result.totals.unmatched}</span><br />Flagged
              </div>
            </div>
            {result.totals.skipped > 0 && (
              <p className="text-xs text-brand-mid mt-2 text-center">
                {result.totals.skipped} duplicate transactions skipped
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
