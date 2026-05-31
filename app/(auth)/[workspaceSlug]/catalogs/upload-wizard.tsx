'use client';

import { useState, useRef, useCallback } from 'react';
import Papa from 'papaparse';
import { createCatalogMeta, markCatalogError } from './actions';
import type { CatalogRow } from './actions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
  warnings: string[];
}

interface ColumnMapping {
  description: string | null;
  quantity: string | null;
  price: string | null;
}

interface UploadWizardProps {
  workspaceSlug: string;
  onComplete: (catalog: Partial<CatalogRow>) => void;
  onClose: () => void;
}

const MAX_ROWS = 20_000;
const CHUNK_SIZE = 2_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function estimateDataBytes(rows: Record<string, string>[]): number {
  try {
    return new TextEncoder().encode(JSON.stringify(rows)).length;
  } catch {
    return rows.length * 200; // rough fallback
  }
}

function parsePrice(raw: string): number {
  // Strip currency symbols, spaces, thousands separators, keep decimal point
  const cleaned = raw.replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return 0;
  return Math.round(parsed * 100) / 100; // round to 2dp half-up
}

async function parseCsvFile(file: File): Promise<ParsedCsv> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h: string, i: number) => h.trim() || `Column ${String.fromCharCode(65 + i)}`,
      complete: (results) => {
        const warnings: string[] = [];
        let rows = results.data as Record<string, string>[];
        const headers = results.meta.fields ?? [];

        if (rows.length > MAX_ROWS) {
          warnings.push(`File has ${rows.length.toLocaleString()} rows — only the first ${MAX_ROWS.toLocaleString()} will be imported.`);
          rows = rows.slice(0, MAX_ROWS);
        }

        if (results.errors.length > 0) {
          warnings.push(`${results.errors.length} parsing error(s) detected — affected rows may be skipped.`);
        }

        resolve({ headers, rows, warnings });
      },
      error: (err: Error) => reject(err),
    });
  });
}

// ---------------------------------------------------------------------------
// Step components
// ---------------------------------------------------------------------------

function StepIndicator({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5 mb-6">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1.5 flex-1 rounded-full transition-colors ${
            i < step ? 'bg-black' : i === step ? 'bg-slate-400' : 'bg-slate-200'
          }`}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main wizard
// ---------------------------------------------------------------------------

export function UploadWizard({ workspaceSlug, onComplete, onClose }: UploadWizardProps) {
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [catalogName, setCatalogName] = useState('');
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({ description: null, quantity: null, price: null });
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      setParseError('Please select a CSV file.');
      return;
    }
    setFile(selectedFile);
    setParsing(true);
    setParseError(null);
    try {
      const result = await parseCsvFile(selectedFile);
      setParsed(result);
      // Auto-set catalog name from filename (strip extension)
      if (!catalogName) {
        setCatalogName(selectedFile.name.replace(/\.csv$/i, '').replace(/[_-]/g, ' '));
      }
      // Auto-detect column mapping by header name heuristic
      const lc = result.headers.map((h) => h.toLowerCase());
      setColumnMapping({
        description: result.headers[lc.findIndex((h) => /desc|name|item|product|material/i.test(h))] ?? result.headers[0] ?? null,
        quantity: result.headers[lc.findIndex((h) => /qty|quantity|amount|count/i.test(h))] ?? null,
        price: result.headers[lc.findIndex((h) => /price|cost|rate|unit/i.test(h))] ?? null,
      });
      setStep(1);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Failed to parse CSV.');
    } finally {
      setParsing(false);
    }
  }, [catalogName]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  }, [handleFileSelect]);

  const handleUpload = useCallback(async () => {
    if (!parsed || !catalogName.trim()) return;

    setUploading(true);
    setUploadError(null);
    setUploadProgress(0);

    const dataBytes = estimateDataBytes(parsed.rows);
    const rows = parsed.rows;
    const totalChunks = Math.ceil(rows.length / CHUNK_SIZE);

    // 1. Create catalog meta row (status = importing)
    const metaResult = await createCatalogMeta({
      name: catalogName.trim(),
      headers: parsed.headers,
      columnMapping: {
        description: columnMapping.description,
        quantity: columnMapping.quantity,
        price: columnMapping.price,
      },
      originalFilename: file?.name ?? '',
      rowCount: rows.length,
      dataBytes,
    });

    if (!metaResult.ok) {
      setUploadError(metaResult.message);
      setUploading(false);
      return;
    }

    const { catalogId } = metaResult.data;

    // 2. Batch upload rows
    try {
      for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
        const start = chunkIdx * CHUNK_SIZE;
        const chunkRows = rows.slice(start, start + CHUNK_SIZE);
        const isFirstBatch = chunkIdx === 0;
        const isLastBatch = chunkIdx === totalChunks - 1;

        const payload = {
          catalogId,
          rows: chunkRows.map((raw, i) => ({ rowIndex: start + i, raw })),
          isFirstBatch,
          isLastBatch,
        };

        const res = await fetch(`/${workspaceSlug}/catalogs/import-rows`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const json = await res.json() as { ok: boolean; message?: string; totalCount?: number };
        if (!json.ok) {
          throw new Error(json.message ?? 'Import failed.');
        }

        setUploadProgress(Math.round(((chunkIdx + 1) / totalChunks) * 100));
      }

      // 3. Done
      onComplete({
        id: catalogId,
        name: catalogName.trim(),
        row_count: rows.length,
        status: 'ready',
        column_mapping: {
          description: columnMapping.description,
          quantity: columnMapping.quantity,
          price: columnMapping.price,
        },
        headers: parsed.headers,
        data_bytes: dataBytes,
      });
    } catch (err) {
      // Mark catalog as error so it doesn't show as importing forever
      await markCatalogError(catalogId);
      setUploadError(err instanceof Error ? err.message : 'Upload failed.');
      setUploading(false);
    }
  }, [parsed, catalogName, columnMapping, file, workspaceSlug, onComplete]);

  // ---------------------------------------------------------------------------
  // Steps
  // ---------------------------------------------------------------------------

  const TOTAL_STEPS = 5;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="relative w-full max-w-xl rounded-2xl bg-white shadow-xl p-6 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
          aria-label="Close"
        >
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>

        <h2 className="text-lg font-semibold text-slate-900 mb-1">
          {step === 0 && 'Upload CSV'}
          {step === 1 && 'Name your catalog'}
          {step === 2 && 'Preview data'}
          {step === 3 && 'Map columns'}
          {step === 4 && 'Save catalog'}
        </h2>
        <p className="text-sm text-slate-500 mb-4">
          {step === 0 && 'Choose a CSV file to import as a searchable catalog.'}
          {step === 1 && 'Give this catalog a name so you can find it later.'}
          {step === 2 && 'Check your data looks right before saving.'}
          {step === 3 && 'Tell us which columns hold description, quantity, and price.'}
          {step === 4 && 'Review and save your catalog.'}
        </p>

        <StepIndicator step={step} total={TOTAL_STEPS} />

        {/* ----------------------------------------------------------------- */}
        {/* Step 0: Upload CSV                                                */}
        {/* ----------------------------------------------------------------- */}
        {step === 0 && (
          <div>
            <div
              ref={dropZoneRef}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 rounded-xl p-10 text-center cursor-pointer hover:border-slate-400 hover:bg-slate-50 transition-colors"
            >
              <svg className="h-10 w-10 mx-auto text-slate-300 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <p className="text-sm font-medium text-slate-700 mb-1">
                {parsing ? 'Parsing...' : 'Drop CSV here or click to browse'}
              </p>
              <p className="text-xs text-slate-400">Up to 20,000 rows · CSV format</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileSelect(f);
              }}
            />
            {parseError && (
              <p className="mt-3 text-sm text-red-600">{parseError}</p>
            )}
            <div className="mt-4 text-xs text-slate-400 space-y-1">
              <p>Tips for best results:</p>
              <ul className="list-disc list-inside space-y-0.5 ml-1">
                <li>Use clear column headers (e.g. Description, Price, Qty)</li>
                <li>One item per row</li>
                <li>Price columns: simple numbers preferred (symbols ok)</li>
                <li>Max 20,000 rows per catalog</li>
              </ul>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* Step 1: Name catalog                                              */}
        {/* ----------------------------------------------------------------- */}
        {step === 1 && parsed && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Catalog name
            </label>
            <input
              type="text"
              value={catalogName}
              onChange={(e) => setCatalogName(e.target.value)}
              placeholder="e.g. Supplier Price List 2026"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-black focus:ring-1 focus:ring-black"
              autoFocus
              maxLength={120}
            />
            <p className="mt-1.5 text-xs text-slate-400">
              {parsed.rows.length.toLocaleString()} rows · {parsed.headers.length} columns · {file?.name}
            </p>
            {parsed.warnings.length > 0 && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-medium text-amber-800 mb-1">Import warnings</p>
                {parsed.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-amber-700">{w}</p>
                ))}
              </div>
            )}
            <div className="mt-6 flex gap-3 justify-end">
              <button onClick={() => setStep(0)} className="px-4 py-2 text-sm text-slate-600 rounded-lg border border-slate-200 hover:bg-slate-50">
                Back
              </button>
              <button
                onClick={() => setStep(2)}
                disabled={!catalogName.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-black rounded-lg disabled:opacity-40 hover:bg-slate-800 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* Step 2: Preview                                                   */}
        {/* ----------------------------------------------------------------- */}
        {step === 2 && parsed && (
          <div>
            <p className="text-xs text-slate-500 mb-3">Showing first {Math.min(5, parsed.rows.length)} of {parsed.rows.length.toLocaleString()} rows</p>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    {parsed.headers.map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-medium text-slate-600 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsed.rows.slice(0, 5).map((row, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      {parsed.headers.map((h) => (
                        <td key={h} className="px-3 py-2 text-slate-700 whitespace-nowrap max-w-[150px] truncate">{row[h] ?? ''}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-6 flex gap-3 justify-end">
              <button onClick={() => setStep(1)} className="px-4 py-2 text-sm text-slate-600 rounded-lg border border-slate-200 hover:bg-slate-50">
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="px-4 py-2 text-sm font-medium text-white bg-black rounded-lg hover:bg-slate-800 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* Step 3: Map columns                                               */}
        {/* ----------------------------------------------------------------- */}
        {step === 3 && parsed && (
          <div>
            <p className="text-xs text-slate-500 mb-4">
              Tell us which columns map to each field. Each is optional — unmapped fields are simply excluded when inserting a quote line.
            </p>
            {(['description', 'quantity', 'price'] as const).map((field) => (
              <div key={field} className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1 capitalize">{field}</label>
                <select
                  value={columnMapping[field] ?? ''}
                  onChange={(e) => setColumnMapping((m) => ({ ...m, [field]: e.target.value || null }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-black focus:ring-1 focus:ring-black"
                >
                  <option value="">— Skip —</option>
                  {parsed.headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
                {field === 'price' && columnMapping.price && (
                  <p className="mt-1 text-xs text-slate-400">
                    Price preview: {parsed.rows[0]?.[columnMapping.price] ?? '—'}{' '}
                    → {parsePrice(parsed.rows[0]?.[columnMapping.price] ?? '').toFixed(2)}
                  </p>
                )}
              </div>
            ))}
            <div className="mt-6 flex gap-3 justify-end">
              <button onClick={() => setStep(2)} className="px-4 py-2 text-sm text-slate-600 rounded-lg border border-slate-200 hover:bg-slate-50">
                Back
              </button>
              <button
                onClick={() => setStep(4)}
                className="px-4 py-2 text-sm font-medium text-white bg-black rounded-lg hover:bg-slate-800 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* Step 4: Save                                                      */}
        {/* ----------------------------------------------------------------- */}
        {step === 4 && parsed && (
          <div>
            {!uploading && !uploadError && (
              <>
                <div className="rounded-lg border border-slate-200 p-4 mb-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Catalog name</span>
                    <span className="font-medium text-slate-800">{catalogName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Rows</span>
                    <span className="font-medium text-slate-800">{parsed.rows.length.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Description column</span>
                    <span className="font-medium text-slate-800">{columnMapping.description ?? 'Not mapped'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Price column</span>
                    <span className="font-medium text-slate-800">{columnMapping.price ?? 'Not mapped'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Quantity column</span>
                    <span className="font-medium text-slate-800">{columnMapping.quantity ?? 'Not mapped'}</span>
                  </div>
                </div>
                <div className="flex gap-3 justify-end">
                  <button onClick={() => setStep(3)} className="px-4 py-2 text-sm text-slate-600 rounded-lg border border-slate-200 hover:bg-slate-50">
                    Back
                  </button>
                  <button
                    onClick={handleUpload}
                    className="px-4 py-2 text-sm font-medium text-white bg-black rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    Save catalog
                  </button>
                </div>
              </>
            )}

            {uploading && (
              <div className="py-4">
                <p className="text-sm text-slate-700 mb-3">
                  Importing {parsed.rows.length.toLocaleString()} rows...
                </p>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="bg-black h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-400 text-right">{uploadProgress}%</p>
              </div>
            )}

            {uploadError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-medium text-red-800 mb-1">Import failed</p>
                <p className="text-xs text-red-700">{uploadError}</p>
                <button
                  onClick={() => {
                    setUploadError(null);
                  }}
                  className="mt-3 text-xs text-red-600 underline"
                >
                  Try again
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
