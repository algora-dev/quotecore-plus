'use client';

import { useState, useRef } from 'react';
import Papa from 'papaparse';
import { type CatalogRow } from './actions';

interface Props {
  catalog: CatalogRow;
  workspaceSlug: string;
  onClose: () => void;
  onReplaced: () => void;
}

function parsePrice(raw: string): number {
  const cleaned = String(raw ?? '').replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return 0;
  return Math.round(parsed * 100) / 100;
}

export function ReplaceCatalogModal({ catalog, workspaceSlug, onClose, onReplaced }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ headers: string[]; rowCount: number; firstRows: Record<string, string>[] } | null>(null);
  const [parsedData, setParsedData] = useState<{ headers: string[]; rows: Record<string, string>[] } | null>(null);

  function handleFile(file: File) {
    setParsing(true);
    setError(null);
    setPreview(null);
    setParsedData(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as Record<string, string>[];
        if (!data || data.length === 0) {
          setError('CSV appears to be empty or could not be parsed.');
          setParsing(false);
          return;
        }

        const headers = Object.keys(data[0]);
        setParsedData({ headers, rows: data });
        setPreview({
          headers,
          rowCount: data.length,
          firstRows: data.slice(0, 5),
        });
        setParsing(false);
      },
      error: (err) => {
        setError(err.message);
        setParsing(false);
      },
    });
  }

  async function handleReplace() {
    if (!parsedData) return;
    setReplacing(true);
    setError(null);
    setUploadProgress(0);

    try {
      const CHUNK_SIZE = 2000;
      const allRows = parsedData.rows.map((raw, i) => ({ rowIndex: i, raw }));
      const totalChunks = Math.ceil(allRows.length / CHUNK_SIZE);

      // 1. Start replace (set status to importing via API, NOT server action)
      const startRes = await fetch(`/${workspaceSlug}/catalogs/import-rows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          catalogId: catalog.id,
          rows: [],
          isFirstBatch: true,
          isLastBatch: false,
          startReplace: true,
        }),
      });
      if (!startRes.ok) {
        const errBody = await startRes.json().catch(() => ({}));
        throw new Error(errBody.message || `Failed to start replace (HTTP ${startRes.status})`);
      }

      // 2. Batch insert via /import-rows API
      for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
        const start = chunkIdx * CHUNK_SIZE;
        const chunkRows = allRows.slice(start, start + CHUNK_SIZE);

        const res = await fetch(`/${workspaceSlug}/catalogs/import-rows`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            catalogId: catalog.id,
            rows: chunkRows.map(r => ({ rowIndex: r.rowIndex, raw: r.raw })),
            isFirstBatch: chunkIdx === 0,
            isLastBatch: chunkIdx === totalChunks - 1,
          }),
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.message || `Upload failed at batch ${chunkIdx + 1} (HTTP ${res.status})`);
        }

        setUploadProgress(Math.round(((chunkIdx + 1) / totalChunks) * 100));
      }

      // 3. Finish replace (update metadata via API, NOT server action)
      let dataBytes = 0;
      try {
        dataBytes = new TextEncoder().encode(JSON.stringify(parsedData.rows)).length;
      } catch { dataBytes = parsedData.rows.length * 200; }

      const finishRes = await fetch(`/${workspaceSlug}/catalogs/import-rows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          catalogId: catalog.id,
          rows: [],
          isFirstBatch: false,
          isLastBatch: true,
          finishReplace: true,
          headers_data: parsedData.headers,
          columnMapping: catalog.column_mapping,
          originalFilename: fileRef.current?.files?.[0]?.name ?? catalog.original_filename ?? 'replacement.csv',
          rowCount: allRows.length,
          dataBytes,
        }),
      });
      if (!finishRes.ok) {
        const errBody = await finishRes.json().catch(() => ({}));
        throw new Error(errBody.message || `Failed to finish replace (HTTP ${finishRes.status})`);
      }

      onReplaced();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to replace');
    } finally {
      setReplacing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-slate-900">Upload New Version</h3>
        <p className="text-sm text-slate-400 mb-4">
          Replace the data in <strong className="text-slate-600">{catalog.name}</strong> with a new CSV file.
          The column mapping will be preserved.
        </p>

        {error && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
        )}

        {!preview && (
          <div
            onClick={() => fileRef.current?.click()}
            className="cursor-pointer rounded-xl border-2 border-dashed border-slate-300 hover:border-orange-400 px-6 py-10 text-center transition"
          >
            <svg className="w-8 h-8 text-slate-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm font-medium text-slate-600">
              {parsing ? 'Parsing...' : 'Click to select a CSV file'}
            </p>
            <p className="text-xs text-slate-400 mt-1">All existing rows will be replaced</p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </div>
        )}

        {preview && (
          <div className="space-y-3">
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700">
              {preview.rowCount} rows detected, {preview.headers.length} columns
            </div>

            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500 border-b border-slate-200">
                Preview (first 5 rows)
              </div>
              <div className="overflow-x-auto max-h-48">
                <table className="w-full text-xs">
                  <thead className="bg-white sticky top-0">
                    <tr>
                      {preview.headers.map(h => (
                        <th key={h} className="px-2 py-1 text-left font-medium text-slate-600 border-b border-slate-100 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.firstRows.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        {preview.headers.map(h => (
                          <td key={h} className="px-2 py-1 text-slate-500 border-b border-slate-50 whitespace-nowrap">{row[h]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {replacing && uploadProgress > 0 && (
              <div className="w-full">
                <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-[#FF6B35] transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                </div>
                <p className="text-xs text-slate-400 text-center mt-1">Uploading {uploadProgress}%</p>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button onClick={handleReplace} disabled={replacing}
                className="cursor-pointer px-4 py-2 text-sm font-semibold rounded-full bg-[#FF6B35] text-white hover:bg-[#e55a2b] transition disabled:opacity-40">
                {replacing ? `Replacing... ${uploadProgress}%` : `Replace ${preview.rowCount} rows`}
              </button>
              <button onClick={() => { setPreview(null); setParsedData(null); }}
                disabled={replacing}
                className="cursor-pointer px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50 disabled:opacity-40">
                Choose different file
              </button>
              <button onClick={onClose}
                className="cursor-pointer px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
