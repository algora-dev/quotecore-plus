'use client';

import { useState, useRef, useCallback } from 'react';
import { StorageBlockedModal } from '@/app/components/billing/StorageBlockedModal';
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
  /** True when headers were synthesised (Column A/B/C...) rather than read from row 1. */
  synthesised: boolean;
}

interface ColumnMapping {
  description: string | null; // "Item / Description"
  quantity: string | null;    // "Description / Quantity"
  price: string | null;       // "Price"
}

interface UploadWizardProps {
  workspaceSlug: string;
  onComplete: (catalog: Partial<CatalogRow>) => void;
  onClose: () => void;
  /** When true the company is over storage — block CSV uploads. */
  isOverStorage?: boolean;
}

const MAX_ROWS = 35_000;
const CHUNK_SIZE = 2_000;

const MAPPING_FIELDS: { key: keyof ColumnMapping; label: string; hint: string }[] = [
  { key: 'description', label: 'Item / Description', hint: 'Primary text shown on the quote line (e.g. product name or full description).' },
  { key: 'quantity', label: 'Description / Quantity', hint: 'Optional second part appended after the primary text (e.g. pack size, a longer description, or quantity).' },
  { key: 'price', label: 'Price', hint: 'The amount inserted on the quote line. Currency symbols and separators are stripped automatically.' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function columnLetter(index: number): string {
  // 0 -> A, 25 -> Z, 26 -> AA ...
  let n = index;
  let s = '';
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

function estimateDataBytes(rows: Record<string, string>[]): number {
  try {
    return new TextEncoder().encode(JSON.stringify(rows)).length;
  } catch {
    return rows.length * 200;
  }
}

function parsePrice(raw: string): number {
  const cleaned = String(raw ?? '').replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return 0;
  return Math.round(parsed * 100) / 100;
}

/**
 * Parse CSV. When `firstRowIsHeader` is false (or headers come back blank),
 * synthesise Column A/B/C... names and treat every row as data.
 */
async function parseCsvFile(file: File, firstRowIsHeader: boolean): Promise<ParsedCsv> {
  return new Promise((resolve, reject) => {
    Papa.parse<string[]>(file, {
      header: false, // parse as arrays so we control header logic ourselves
      skipEmptyLines: 'greedy',
      complete: (results) => {
        const warnings: string[] = [];
        const matrix = results.data as string[][];

        if (matrix.length === 0) {
          resolve({ headers: [], rows: [], warnings: ['File appears to be empty.'], synthesised: false });
          return;
        }

        const colCount = Math.max(...matrix.map((r) => r.length));
        let headers: string[];
        let dataRows: string[][];
        let synthesised = false;

        // Decide header source
        const firstRow = matrix[0].map((c) => (c ?? '').trim());
        const firstRowLooksBlank = firstRow.every((c) => c === '');

        if (firstRowIsHeader && !firstRowLooksBlank) {
          headers = Array.from({ length: colCount }, (_, i) => {
            const h = (firstRow[i] ?? '').trim();
            return h || `Column ${columnLetter(i)}`;
          });
          if (firstRow.some((c) => c === '')) {
            warnings.push('Some columns had blank headers — labelled Column A/B/C automatically.');
          }
          dataRows = matrix.slice(1);
        } else {
          // No headers: synthesise Column A/B/C... and treat row 1 as data
          headers = Array.from({ length: colCount }, (_, i) => `Column ${columnLetter(i)}`);
          dataRows = matrix;
          synthesised = true;
          if (firstRowIsHeader && firstRowLooksBlank) {
            warnings.push('First row was blank — treated all rows as data with Column A/B/C labels.');
          }
        }

        if (dataRows.length > MAX_ROWS) {
          warnings.push(`File has ${dataRows.length.toLocaleString()} data rows — only the first ${MAX_ROWS.toLocaleString()} will be imported.`);
          dataRows = dataRows.slice(0, MAX_ROWS);
        }

        if (results.errors.length > 0) {
          warnings.push(`${results.errors.length} parsing issue(s) detected — affected rows may be skipped.`);
        }

        // Convert to row objects keyed by header
        const rows: Record<string, string>[] = dataRows
          .filter((r) => r.some((c) => (c ?? '').trim() !== ''))
          .map((r) => {
            const obj: Record<string, string> = {};
            headers.forEach((h, i) => {
              obj[h] = (r[i] ?? '').toString();
            });
            return obj;
          });

        resolve({ headers, rows, warnings, synthesised });
      },
      error: (err: Error) => reject(err),
    });
  });
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

function StepIndicator({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5 mb-5">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1.5 flex-1 rounded-full transition-colors ${
            i < step ? 'bg-orange-500' : i === step ? 'bg-slate-400' : 'bg-slate-200'
          }`}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main wizard
// ---------------------------------------------------------------------------

export function UploadWizard({ workspaceSlug, onComplete, onClose, isOverStorage }: UploadWizardProps) {
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [firstRowIsHeader, setFirstRowIsHeader] = useState(true);
  const [catalogName, setCatalogName] = useState('');
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({ description: null, quantity: null, price: null });
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [storageBlocked, setStorageBlocked] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const runParse = useCallback(async (f: File, asHeader: boolean) => {
    setParsing(true);
    setParseError(null);
    try {
      const result = await parseCsvFile(f, asHeader);
      setParsed(result);
      if (!catalogName) {
        setCatalogName(f.name.replace(/\.csv$/i, '').replace(/[_-]/g, ' '));
      }
      // Auto-detect mapping by header-name heuristic (only useful with real headers)
      const lc = result.headers.map((h) => h.toLowerCase());
      const findHeader = (re: RegExp) => {
        const idx = lc.findIndex((h) => re.test(h));
        return idx >= 0 ? result.headers[idx] : null;
      };
      setColumnMapping({
        description: findHeader(/desc|name|item|product|material/) ?? result.headers[0] ?? null,
        quantity: findHeader(/qty|quantity|pack|size|unit(?!\s*price)/) ?? null,
        price: findHeader(/price|cost|rate|amount|total/) ?? null,
      });
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Failed to parse CSV.');
    } finally {
      setParsing(false);
    }
  }, [catalogName]);

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      setParseError('Please select a CSV file.');
      return;
    }
    setFile(selectedFile);
    await runParse(selectedFile, firstRowIsHeader);
    setStep(1);
  }, [runParse, firstRowIsHeader]);

  // Re-parse when the user flips the header toggle on the preview step
  const toggleHeaderMode = useCallback(async (asHeader: boolean) => {
    setFirstRowIsHeader(asHeader);
    if (file) await runParse(file, asHeader);
  }, [file, runParse]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (isOverStorage) { setStorageBlocked(true); return; }
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) void handleFileSelect(droppedFile);
  }, [handleFileSelect, isOverStorage]);

  const handleUpload = useCallback(async () => {
    if (!parsed || !catalogName.trim()) return;

    setUploading(true);
    setUploadError(null);
    setUploadProgress(0);

    const dataBytes = estimateDataBytes(parsed.rows);
    const rows = parsed.rows;
    const totalChunks = Math.ceil(rows.length / CHUNK_SIZE);

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

    try {
      for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
        const start = chunkIdx * CHUNK_SIZE;
        const chunkRows = rows.slice(start, start + CHUNK_SIZE);
        const payload = {
          catalogId,
          rows: chunkRows.map((raw, i) => ({ rowIndex: start + i, raw })),
          isFirstBatch: chunkIdx === 0,
          isLastBatch: chunkIdx === totalChunks - 1,
        };
        const res = await fetch(`/${workspaceSlug}/catalogs/import-rows`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = (await res.json()) as { ok: boolean; message?: string };
        if (!json.ok) throw new Error(json.message ?? 'Import failed.');
        setUploadProgress(Math.round(((chunkIdx + 1) / totalChunks) * 100));
      }

      onComplete({
        id: catalogId,
        name: catalogName.trim(),
        row_count: rows.length,
        status: 'ready',
        column_mapping: { description: columnMapping.description, quantity: columnMapping.quantity, price: columnMapping.price },
        headers: parsed.headers,
        data_bytes: dataBytes,
      });
    } catch (err) {
      await markCatalogError(catalogId);
      setUploadError(err instanceof Error ? err.message : 'Upload failed.');
      setUploading(false);
    }
  }, [parsed, catalogName, columnMapping, file, workspaceSlug, onComplete]);

  const TOTAL_STEPS = 4;

  // Which mapping slot (if any) a header is assigned to — drives the column
  // highlight in the combined preview/map step.
  const slotForHeader = (h: string): { label: string; color: string } | null => {
    if (columnMapping.description === h) return { label: 'Item / Description', color: 'bg-orange-100 text-orange-700 border-orange-300' };
    if (columnMapping.quantity === h) return { label: 'Description / Quantity', color: 'bg-blue-100 text-blue-700 border-blue-300' };
    if (columnMapping.price === h) return { label: 'Price', color: 'bg-emerald-100 text-emerald-700 border-emerald-300' };
    return null;
  };

  const inputCls = 'w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none';
  const primaryBtn = 'px-4 py-2 text-sm font-medium bg-black text-white rounded-full hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)] disabled:opacity-40 disabled:cursor-not-allowed';
  const ghostBtn = 'px-4 py-2 text-sm font-medium border border-slate-300 rounded-full hover:bg-slate-50';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl max-w-xl w-full mx-4 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              {step === 0 && 'Upload CSV'}
              {step === 1 && 'Name your catalog'}
              {step === 2 && 'Preview & map columns'}
              {step === 3 && 'Save catalog'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {step === 0 && 'Choose a CSV file to import as a searchable catalog.'}
              {step === 1 && 'Give this catalog a name so you can find it later.'}
              {step === 2 && 'Check your data and choose which columns map to each field.'}
              {step === 3 && 'Review and save your catalog.'}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <StepIndicator step={step} total={TOTAL_STEPS} />

          {/* Step 0: Upload */}
          {step === 0 && (
            <div>
              <StorageBlockedModal open={storageBlocked} onClose={() => setStorageBlocked(false)} />
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => { if (isOverStorage) { setStorageBlocked(true); return; } fileInputRef.current?.click(); }}
                className="border-2 border-dashed border-slate-300 rounded-xl p-10 text-center cursor-pointer hover:border-orange-300 hover:bg-orange-50/40 transition-colors"
              >
                <svg className="h-10 w-10 mx-auto text-slate-300 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                <p className="text-sm font-medium text-slate-700 mb-1">{parsing ? 'Parsing...' : 'Drop CSV here or click to browse'}</p>
                <p className="text-xs text-slate-400">Up to 20,000 rows · CSV format</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFileSelect(f);
                }}
              />
              {parseError && <p className="mt-3 text-sm text-red-600">{parseError}</p>}
              <div className="mt-4 text-xs text-slate-400 space-y-1">
                <p className="font-medium text-slate-500">Tips for best results:</p>
                <ul className="list-disc list-inside space-y-0.5 ml-1">
                  <li>Clear column headers help (e.g. Description, Price, Pack Size)</li>
                  <li>No headers? No problem — we&apos;ll label columns A, B, C…</li>
                  <li>One item per row</li>
                  <li>Max 20,000 rows per catalog</li>
                </ul>
              </div>
            </div>
          )}

          {/* Step 1: Name */}
          {step === 1 && parsed && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Catalog name</label>
              <input
                type="text"
                value={catalogName}
                onChange={(e) => setCatalogName(e.target.value)}
                placeholder="e.g. Supplier Price List 2026"
                className={inputCls}
                autoFocus
                maxLength={120}
              />
              <p className="mt-2 text-xs text-slate-400">
                {parsed.rows.length.toLocaleString()} rows · {parsed.headers.length} columns · {file?.name}
              </p>
              {parsed.warnings.length > 0 && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-medium text-amber-800 mb-1">Heads up</p>
                  {parsed.warnings.map((w, i) => (
                    <p key={i} className="text-xs text-amber-700">{w}</p>
                  ))}
                </div>
              )}
              <div className="mt-6 flex gap-3 justify-end">
                <button onClick={() => setStep(0)} className={ghostBtn}>Back</button>
                <button onClick={() => setStep(2)} disabled={!catalogName.trim()} className={primaryBtn}>Next</button>
              </div>
            </div>
          )}

          {/* Step 2: Preview + Map (combined) */}
          {step === 2 && parsed && (
            <div>
              {/* Preview table */}
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-slate-500">
                  Showing first {Math.min(5, parsed.rows.length)} of {parsed.rows.length.toLocaleString()} rows
                </p>
                <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={firstRowIsHeader}
                    onChange={(e) => void toggleHeaderMode(e.target.checked)}
                    className="w-4 h-4 text-orange-600 rounded border-slate-300 focus:ring-orange-500"
                  />
                  First row contains column titles
                </label>
              </div>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      {parsed.headers.map((h) => {
                        const slot = slotForHeader(h);
                        return (
                          <th key={h} className="px-3 py-2 text-left font-medium text-slate-600 whitespace-nowrap align-top">
                            <span className="block">{h}</span>
                            {slot && (
                              <span className={`mt-1 inline-block rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${slot.color}`}>
                                {slot.label}
                              </span>
                            )}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.rows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        {parsed.headers.map((h) => (
                          <td key={h} className={`px-3 py-2 whitespace-nowrap max-w-[150px] truncate ${slotForHeader(h) ? 'text-slate-900 bg-slate-50/60' : 'text-slate-700'}`}>{row[h] ?? ''}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsed.synthesised && (
                <p className="mt-2 text-xs text-slate-400">No headers detected — columns labelled A, B, C…</p>
              )}

              {/* Mapping */}
              <div className="mt-5 border-t border-slate-100 pt-4">
                <p className="text-xs text-slate-500 mb-3">
                  Choose which columns map to each field. All optional — unmapped fields are skipped. Item and Description combine into the quote line text.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {MAPPING_FIELDS.map((field) => (
                    <div key={field.key}>
                      <label className="block text-sm font-medium text-slate-700 mb-1">{field.label}</label>
                      <select
                        value={columnMapping[field.key] ?? ''}
                        onChange={(e) => setColumnMapping((m) => ({ ...m, [field.key]: e.target.value || null }))}
                        className={inputCls + ' bg-white'}
                      >
                        <option value="">— Skip —</option>
                        {parsed.headers.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
                {columnMapping.price && (
                  <p className="mt-2 text-xs text-slate-500">
                    Price preview: {parsed.rows[0]?.[columnMapping.price] ?? '—'} → {parsePrice(parsed.rows[0]?.[columnMapping.price] ?? '').toFixed(2)}
                  </p>
                )}
              </div>

              <div className="mt-6 flex gap-3 justify-end">
                <button onClick={() => setStep(1)} className={ghostBtn}>Back</button>
                <button onClick={() => setStep(3)} className={primaryBtn}>Next</button>
              </div>
            </div>
          )}

          {/* Step 3: Save */}
          {step === 3 && parsed && (
            <div>
              {!uploading && !uploadError && (
                <>
                  <div className="rounded-lg border border-slate-200 p-4 mb-4 space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-slate-500">Catalog name</span><span className="font-medium text-slate-800">{catalogName}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Rows</span><span className="font-medium text-slate-800">{parsed.rows.length.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Item / Description</span><span className="font-medium text-slate-800">{columnMapping.description ?? 'Not mapped'}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Description / Quantity</span><span className="font-medium text-slate-800">{columnMapping.quantity ?? 'Not mapped'}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Price</span><span className="font-medium text-slate-800">{columnMapping.price ?? 'Not mapped'}</span></div>
                  </div>
                  <div className="flex gap-3 justify-end">
                    <button onClick={() => setStep(2)} className={ghostBtn}>Back</button>
                    <button onClick={handleUpload} className={primaryBtn}>Save catalog</button>
                  </div>
                </>
              )}

              {uploading && (
                <div className="py-4">
                  <p className="text-sm text-slate-700 mb-3">Importing {parsed.rows.length.toLocaleString()} rows...</p>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div className="bg-orange-500 h-2 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                  </div>
                  <p className="mt-2 text-xs text-slate-400 text-right">{uploadProgress}%</p>
                </div>
              )}

              {uploadError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                  <p className="text-sm font-medium text-red-800 mb-1">Import failed</p>
                  <p className="text-xs text-red-700">{uploadError}</p>
                  <button onClick={() => setUploadError(null)} className="mt-3 text-xs text-red-600 underline">Try again</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
