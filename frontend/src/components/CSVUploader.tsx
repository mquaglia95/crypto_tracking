import React, { useCallback, useState } from 'react';

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
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
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
          ${dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <div className="text-center pointer-events-none">
          <p className="text-2xl mb-2">📂</p>
          {uploading ? (
            <p className="text-sm text-gray-500">Processing CSV and running HIFO engine...</p>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-700">Drop your Coinbase CSV here</p>
              <p className="text-xs text-gray-400 mt-1">or click to browse</p>
            </>
          )}
        </div>
        <input type="file" accept=".csv" className="hidden" onChange={onInputChange} />
      </label>

      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {summary && (
        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
          <p className="font-semibold mb-1">Ingestion complete</p>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div><span className="font-bold">{summary.lots}</span><br />Buy lots</div>
            <div><span className="font-bold">{summary.sales}</span><br />Sales</div>
            <div><span className="font-bold">{summary.income}</span><br />Income events</div>
            <div><span className="font-bold text-yellow-700">{summary.unmatched}</span><br />Flagged</div>
          </div>
        </div>
      )}
    </div>
  );
}
