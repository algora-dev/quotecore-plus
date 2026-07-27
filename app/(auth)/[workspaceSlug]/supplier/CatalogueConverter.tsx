'use client';

import { useState } from 'react';
import type { UserCollection } from '../supplier-directory/actions';

type ParsedRow = {
  sku: string;
  name: string;
  price: number;
  product_type: string;
  notes: string;
};

type ImportState = 'idle' | 'parsing' | 'preview' | 'importing' | 'success' | 'error';

export function CatalogueConverter({
  workspaceSlug,
  collections,
}: {
  workspaceSlug: string;
  collections: UserCollection[];
}) {
  const [csvText, setCsvText] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [targetCollection, setTargetCollection] = useState<string>(
    collections.find(c => c.is_bootstrap)?.id ?? collections[0]?.id ?? ''
  );
  const [importState, setImportState] = useState<ImportState>('idle');
  const [importResult, setImportResult] = useState<{ created: number; message: string } | null>(null);

  function handleParse() {
    setImportState('parsing');
    setParseErrors([]);
    setImportResult(null);

    // Client-side parse (the server action also parses, but we want a preview)
    const lines = csvText.trim().split(/\r?\n/);
    if (lines.length < 2) {
      setParseErrors(['Need at least a header row and one data row.']);
      setImportState('idle');
      return;
    }

    const header = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
    const colMap: Record<string, number> = {};
    header.forEach((h, i) => {
      if (h === 'sku' || h === 'code') colMap.sku = i;
      else if (h === 'name' || h === 'product' || h === 'product name') colMap.name = i;
      else if (h === 'price' || h === 'cost' || h === 'rate') colMap.price = i;
      else if (h === 'product type' || h === 'type' || h === 'category' || h === 'takeoff_slot' || h === 'slot') colMap.product_type = i;
      else if (h === 'notes' || h === 'description') colMap.notes = i;
    });

    if (colMap.name === undefined) {
      setParseErrors(['Missing required column: Name (or "Product", "Product Name").']);
      setImportState('idle');
      return;
    }
    if (colMap.price === undefined) {
      setParseErrors(['Missing required column: Price (or "Cost", "Rate").']);
      setImportState('idle');
      return;
    }

    const rows: ParsedRow[] = [];
    const errors: string[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cols = parseCSVLine(line);
      const row: ParsedRow = {
        sku: colMap.sku !== undefined ? (cols[colMap.sku] ?? '').trim() : '',
        name: (cols[colMap.name] ?? '').trim(),
        price: parseFloat((cols[colMap.price] ?? '0').replace(/[^0-9.\-]/g, '')) || 0,
        product_type: colMap.product_type !== undefined ? (cols[colMap.product_type] ?? '').trim() : '',
        notes: colMap.notes !== undefined ? (cols[colMap.notes] ?? '').trim() : '',
      };
      if (!row.name) {
        errors.push(`Row ${i + 1}: Missing name, skipped.`);
        continue;
      }
      rows.push(row);
    }

    setParsedRows(rows);
    setParseErrors(errors);
    setImportState(rows.length > 0 ? 'preview' : 'idle');
  }

  async function handleImport() {
    if (!parsedRows.length || !targetCollection) return;
    setImportState('importing');

    try {
      const res = await fetch('/api/supplier-catalogue-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetCollectionId: targetCollection,
          rows: parsedRows,
        }),
      });
      const data = await res.json();

      if (data.ok) {
        setImportState('success');
        setImportResult({
          created: data.created,
          message: `Created ${data.created} component${data.created !== 1 ? 's' : ''} from catalogue.`,
        });
        setCsvText('');
        setParsedRows([]);
      } else {
        setImportState('error');
        setImportResult({ created: 0, message: data.errors?.[0] ?? 'Import failed' });
      }
    } catch {
      setImportState('error');
      setImportResult({ created: 0, message: 'Network error. Please try again.' });
    }
  }

  function handleReset() {
    setCsvText('');
    setParsedRows([]);
    setParseErrors([]);
    setImportState('idle');
    setImportResult(null);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Catalogue Converter</h3>
          <p className="text-xs text-slate-400 mt-0.5">Bulk-create components from CSV (SKU, Name, Price, Product Type, Notes)</p>
        </div>
        {importState === 'preview' && (
          <button
            onClick={handleReset}
            className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Success banner */}
      {importState === 'success' && importResult && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium text-emerald-800">{importResult.message}</span>
          </div>
          <button
            onClick={handleReset}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 rounded-full border border-emerald-300 px-3 py-1"
          >
            Import More
          </button>
        </div>
      )}

      {/* Error banner */}
      {importState === 'error' && importResult && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 mb-3 flex items-center gap-2">
          <svg className="w-5 h-5 text-red-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="text-sm font-medium text-red-800">{importResult.message}</span>
        </div>
      )}

      {/* Parse errors */}
      {parseErrors.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 mb-3">
          <p className="text-xs font-medium text-amber-700 mb-1">Warnings:</p>
          {parseErrors.map((e, i) => (
            <p key={i} className="text-xs text-amber-600">{e}</p>
          ))}
        </div>
      )}

      {/* Input / Preview */}
      {importState !== 'preview' && importState !== 'importing' && importState !== 'success' && (
        <>
          <textarea
            value={csvText}
            onChange={e => setCsvText(e.target.value)}
            rows={6}
            placeholder={'SKU,Name,Price,Product Type,Notes\nRG-100,Ridge Cap 1m,12.50,ridge,Pre-painted ridge cap\nVP-200,Valley Tray 3m,28.00,valley,Galvanised valley tray'}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-orange-500 focus:outline-none"
          />
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={handleParse}
              disabled={!csvText.trim()}
              className="cursor-pointer rounded-full bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Preview
            </button>
            <span className="text-xs text-slate-400">
              Columns: SKU, Name, Price, Product Type, Notes (order-independent)
            </span>
          </div>
        </>
      )}

      {/* Preview table */}
      {(importState === 'preview' || importState === 'importing') && (
        <div>
          <div className="rounded-lg border border-slate-200 overflow-hidden mb-3">
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-slate-50">
              <span className="text-xs font-semibold text-slate-700">
                {parsedRows.length} component{parsedRows.length !== 1 ? 's' : ''} ready
              </span>
            </div>
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr className="text-left text-slate-500">
                    <th className="px-3 py-1.5 font-medium">SKU</th>
                    <th className="px-3 py-1.5 font-medium">Name</th>
                    <th className="px-3 py-1.5 font-medium text-right">Price</th>
                    <th className="px-3 py-1.5 font-medium">Type</th>
                    <th className="px-3 py-1.5 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedRows.map((row, i) => (
                    <tr key={i} className="hover:bg-orange-50/30">
                      <td className="px-3 py-1.5 font-mono text-slate-600">{row.sku || '-'}</td>
                      <td className="px-3 py-1.5 font-medium text-slate-900">{row.name}</td>
                      <td className="px-3 py-1.5 text-right text-slate-600">${row.price.toFixed(2)}</td>
                      <td className="px-3 py-1.5 text-slate-600">{row.product_type || '-'}</td>
                      <td className="px-3 py-1.5 text-slate-400 truncate max-w-[150px]">{row.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Import bar */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium text-slate-600 mb-1 block">Import to library</label>
              <select
                value={targetCollection}
                onChange={e => setTargetCollection(e.target.value)}
                disabled={importState === 'importing'}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none disabled:bg-slate-50"
              >
                {collections.map(col => (
                  <option key={col.id} value={col.id}>
                    {col.name} ({col.component_count} components){col.is_bootstrap ? ' - Default' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={handleImport}
                disabled={importState === 'importing' || !targetCollection}
                className="cursor-pointer rounded-full bg-[#FF6B35] px-5 py-2 text-sm font-semibold text-white hover:bg-[#e55a2b] transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importState === 'importing' ? 'Creating...' : `Create ${parsedRows.length} Component${parsedRows.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}
