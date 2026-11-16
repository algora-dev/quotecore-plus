'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { QcInput, QcSelect } from '@/app/components/ui/v2/QcField';
import { FileUploader } from '@/app/components/FileUploader';
import type { MeasurementImportLineRow, MeasurementImportRow } from '@/app/lib/measurements-import/domain';
import type { MatchComponent } from '@/app/lib/measurements-import/auto-match';
import {
  loadImportReview, updateMeasurementLine, setMeasurementLineStatus,
  updateMeasurementImportBasis, rematchMeasurementImport, confirmMeasurementImport, deleteMeasurementImportAction,
} from './actions';

type Review = { session: MeasurementImportRow; lines: MeasurementImportLineRow[]; components: MatchComponent[] };
type Collection = { id: string; name: string; isBootstrap: boolean };
type ActiveImport = { id: string; sourceName: string; remaining: number };

const KIND_LABEL: Record<string, string> = { area: 'Area', lineal: 'Length', quantity: 'Count' };
const LINEAL_FAMILY = new Set(['lineal', 'linear', 'multi_lineal', 'curved_line', 'quantity_by_spacing']);

export function MeasurementImportClient({ workspaceSlug, quoteId, quoteLabel, collections, initialCurrent, activeImports }: {
  workspaceSlug: string; quoteId: string; quoteLabel: string; collections: Collection[];
  initialCurrent: Review | null; activeImports: ActiveImport[];
}) {
  const router = useRouter();
  const [current, setCurrent] = useState<Review | null>(initialCurrent);
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [libraryId, setLibraryId] = useState(() => initialCurrent?.session.library_id ?? collections.find(c => c.isBootstrap)?.id ?? collections[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [failures, setFailures] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  const quoteHref = `/${workspaceSlug}/quotes/${quoteId}`;
  const pending = (current?.lines ?? []).filter(l => l.status !== 'imported' && l.status !== 'skipped');
  const selected = pending.filter(l => l.status === 'selected');
  const importedCount = (current?.lines ?? []).filter(l => l.status === 'imported').length;

  async function reload(importId: string) {
    const next = await loadImportReview(importId);
    setCurrent(next);
    if (next.session.library_id) setLibraryId(next.session.library_id);
    return next;
  }

  async function extract() {
    if (!libraryId) { setError('Choose a pricing library first.'); return; }
    setBusy(true); setError(''); setNotice(''); setFailures([]);
    try {
      const form = new FormData();
      if (file) form.set('file', file); else form.set('text', text.trim());
      form.set('quoteId', quoteId); form.set('libraryId', libraryId);
      const response = await fetch('/api/measurements-import/import', { method: 'POST', body: form });
      const result = await response.json();
      if (!response.ok || !result.ok) throw Error(result.error || 'Could not read the measurements.');
      await reload(result.importId);
      setFile(null); setText('');
      setNotice(`${result.count} lines extracted and matched against your library. Review them below.`);
      router.replace(`${quoteHref}/measurements/import?import=${result.importId}`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Import failed.'); } finally { setBusy(false); }
  }

  async function switchBasis(basis: 'plan' | 'actual') {
    if (!current || current.session.default_basis === basis) return;
    const prev = current; setCurrent({ ...current, session: { ...current.session, default_basis: basis } });
    const result = await updateMeasurementImportBasis(current.session.id, basis);
    if (!result.ok) { setCurrent(prev); setError(result.message); }
  }

  async function rematch() {
    if (!current || !libraryId) return;
    setBusy(true); setError('');
    try {
      const result = await rematchMeasurementImport(current.session.id, libraryId);
      if (!result.ok) throw Error(result.message);
      await reload(current.session.id);
      setNotice(`Re-matched against the new library (${result.matched} lines matched). Your manual picks were kept.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not switch the library.'); } finally { setBusy(false); }
  }

  function patchLine(lineId: string, patch: Partial<MeasurementImportLineRow['line_data']>) {
    setCurrent(cur => cur ? { ...cur, lines: cur.lines.map(l => l.id === lineId ? { ...l, line_data: { ...l.line_data, ...patch } } : l) } : cur);
  }

  async function saveLine(line: MeasurementImportLineRow, patch: Partial<MeasurementImportLineRow['line_data']>) {
    patchLine(line.id, patch);
    const merged = { ...line.line_data, ...patch };
    const result = await updateMeasurementLine(current!.session.id, line.id, {
      label: merged.label, unit: merged.unit, kind: merged.kind, entries: merged.entries,
      matchedComponentId: merged.matchedComponentId, basisOverride: merged.basisOverride, combineEntries: merged.combineEntries,
    });
    if (!result.ok) { setError(result.message); await reload(current!.session.id); }
  }

  async function toggleStatus(line: MeasurementImportLineRow, status: 'selected' | 'skipped' | 'candidate') {
    setCurrent(cur => cur ? { ...cur, lines: cur.lines.map(l => l.id === line.id ? { ...l, status } : l) } : cur);
    const result = await setMeasurementLineStatus(current!.session.id, line.id, status);
    if (!result.ok) { setError(result.message); await reload(current!.session.id); }
  }

  function setEntry(line: MeasurementImportLineRow, index: number, raw: string) {
    setDrafts(d => ({ ...d, [`${line.id}:${index}`]: raw }));
  }
  function setField(line: MeasurementImportLineRow, field: 'label' | 'unit', raw: string) {
    setDrafts(d => ({ ...d, [`${line.id}:${field}`]: raw }));
  }
  async function commitField(line: MeasurementImportLineRow, field: 'label' | 'unit') {
    const key = `${line.id}:${field}`;
    const raw = (drafts[key] ?? '').trim();
    if (field === 'label' && raw && raw !== line.line_data.label) await saveLine(line, { label: raw.slice(0, 180) });
    if (field === 'unit' && raw !== line.line_data.unit) await saveLine(line, { unit: raw.slice(0, 30) });
    setDrafts(d => { const n = { ...d }; delete n[key]; return n; });
  }
  async function commitEntry(line: MeasurementImportLineRow, index: number) {
    const key = `${line.id}:${index}`;
    const raw = (drafts[key] ?? String(line.line_data.entries[index]?.value ?? '')).trim();
    const parsed = Number(raw);
    if (raw !== '' && Number.isFinite(parsed) && parsed > 0) {
      const entries = line.line_data.entries.map((e, i) => i === index ? { ...e, value: parsed } : e);
      await saveLine(line, { entries });
    }
    setDrafts(d => { const n = { ...d }; delete n[key]; return n; });
  }

  async function confirm() {
    if (!current) return;
    setBusy(true); setError(''); setFailures([]);
    try {
      const result = await confirmMeasurementImport(current.session.id);
      if ('message' in result) throw Error(result.message);
      if (result.imported > 0 && result.failures.length === 0) {
        router.push(quoteHref);
        return;
      }
      await reload(current.session.id);
      setFailures(result.failures);
      setNotice(result.imported > 0 ? `${result.imported} line${result.imported === 1 ? '' : 's'} added to the quote.` : '');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not add the lines.'); } finally { setBusy(false); }
  }

  async function removeImport() {
    if (!current) return;
    setBusy(true); setError('');
    try {
      const result = await deleteMeasurementImportAction(current.session.id);
      if (!result.ok) throw Error(result.message);
      router.replace(`${quoteHref}/measurements/import`);
      setCurrent(null); setConfirmDelete(false); setNotice('Import deleted. No quote lines were changed.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to delete this import.'); } finally { setBusy(false); }
  }

  if (!current) {
    return (
      <section className="pa-panel pa-capture" aria-labelledby="mi-title">
        <div className="pa-top"><Link href={quoteHref}>← Back to {quoteLabel}</Link><span>Measurements import</span></div>
        <h1 id="mi-title" className="pa-section-heading" style={{ display: 'block' }}>Upload measurements for {quoteLabel}</h1>
        <p className="pa-panel-p">Photo of handwritten notes, PDF, spreadsheet or typed text. We read the measurement and quantity lines, match them to your pricing library, then you check everything before it is added.</p>
        {activeImports.length > 0 && <div className="pa-resume-list" style={{ marginBottom: 16 }}>
          {activeImports.map(s => <Link key={s.id} href={`${quoteHref}/measurements/import?import=${s.id}`}>{s.sourceName} <small>({s.remaining} lines)</small></Link>)}
        </div>}
        <FileUploader appearance="v2" accept=".csv,.xlsx,.txt,.pdf,.png,.jpg,.jpeg,.webp" maxSize={8388608}
          onUpload={async f => { setFile(f); setText(''); }} currentFileUrl={null}
          label="Choose a file or photo" description="CSV, XLSX, TXT, PDF, PNG, JPEG or WebP · up to 8 MB" />
        {file && <div className="pa-file-chip"><span>{file.name}</span><small>{Math.max(1, Math.round(file.size / 1024))} KB</small><QcButton size="sm" variant="ghost" onClick={() => setFile(null)}>Remove</QcButton></div>}
        <div className="pa-or" aria-hidden="true">or type / paste them</div>
        <textarea className="pa-textarea qc-input" placeholder={'e.g.\nHips 12.4 m\nRidge 8 m, 6.5 m\nRoof area 96 m²\nScrews 250 ea'} value={text} onChange={e => { setText(e.target.value); setFile(null); }} />
        <div className="mi-capture-controls">
          <label htmlFor="mi-library">Pricing library to apply</label>
          <QcSelect id="mi-library" value={libraryId} onChange={e => setLibraryId(e.target.value)}>
            {collections.length === 0 && <option value="">No libraries yet — add components in Pricing first</option>}
            {collections.map(c => <option key={c.id} value={c.id}>{c.name}{c.isBootstrap ? ' (default)' : ''}</option>)}
          </QcSelect>
          <QcButton variant="primary" pending={busy} disabled={busy || (!file && !text.trim()) || !libraryId} onClick={extract}>Extract measurements</QcButton>
        </div>
        {error && <div className="pa-alert" role="alert">{error}</div>}
        {notice && <div className="pa-success" role="status">{notice}</div>}
      </section>
    );
  }

  const { session, lines, components } = current;
  return (
    <section className="pa-panel" aria-label="Review extracted measurements">
      <div className="pa-top"><Link href={quoteHref}>← Back to {quoteLabel}</Link>
        <div className="pa-delete-import">{confirmDelete
          ? <div><span>Delete this import? Lines already added stay on the quote.</span>
              <QcButton size="sm" variant="danger" disabled={busy} onClick={removeImport}>Delete</QcButton>
              <QcButton size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Keep</QcButton></div>
          : <QcButton size="sm" variant="ghost" disabled={busy} onClick={() => setConfirmDelete(true)}>Delete import</QcButton>}
        </div>
      </div>
      <div className="pa-section-heading">
        <h2>{session.source_name}</h2>
        <span>{lines.length} lines · {importedCount} added</span>
      </div>

      <div className="mi-master">
        <div className="mi-segmented" role="group" aria-label="Measurement basis for this import">
          <button type="button" aria-pressed={session.default_basis === 'plan'} data-tip="Plan measurements are a top-down view. Pitch calculation is added when the component uses pitch."
            onClick={() => switchBasis('plan')}>Plan (top-down)</button>
          <button type="button" aria-pressed={session.default_basis === 'actual'} data-tip="Actual measurements are the final length or area as taken on the surface. No pitch is added."
            onClick={() => switchBasis('actual')}>Actual (surface)</button>
        </div>
        <div className="mi-library-row">
          <label htmlFor="mi-library-review">Library</label>
          <QcSelect id="mi-library-review" value={libraryId} onChange={e => setLibraryId(e.target.value)}>
            {collections.map(c => <option key={c.id} value={c.id}>{c.name}{c.isBootstrap ? ' (default)' : ''}</option>)}
          </QcSelect>
          <QcButton size="sm" variant="ghost" disabled={busy || libraryId === session.library_id} onClick={rematch}>Re-match lines</QcButton>
        </div>
      </div>
      <p className="mi-master-help">Applies to every line unless a line sets its own basis. Per-line override is in each line.</p>

      <div className="pa-legend"><span><i className="pa-swatch pa-swatch-found" />Confident match</span><span><i className="pa-swatch pa-swatch-missing" />Needs your input</span></div>

      <div className="mi-lines">
        {lines.map(line => <LineRow key={line.id} line={line} components={components} masterBasis={session.default_basis}
          drafts={drafts} onDraft={setEntry} onCommitEntry={commitEntry} onField={setField} onCommitField={commitField} onSave={saveLine} onToggle={toggleStatus} />)}
      </div>

      <div className="pa-actions">
        <div className="pa-save-actions">
          <button type="button" className="pa-text-link" onClick={() => pending.forEach(l => toggleStatus(l, l.status === 'selected' ? 'candidate' : 'selected'))}>
            {selected.length === pending.length && pending.length > 0 ? 'Clear selection' : 'Select all'}
          </button>
          <strong>{selected.length} selected</strong>
        </div>
        <QcButton variant="primary" pending={busy} disabled={busy || selected.length === 0} onClick={confirm}>
          Add {selected.length} line{selected.length === 1 ? '' : 's'} to quote →
        </QcButton>
      </div>
      {failures.length > 0 && <div className="pa-alert" role="alert"><strong>Some lines need attention:</strong>{'\n'}{failures.slice(0, 8).join('\n')}</div>}
      {error && <div className="pa-alert" role="alert">{error}</div>}
      {notice && <div className="pa-success" role="status">{notice}</div>}
    </section>
  );
}

function LineRow({ line, components, masterBasis, drafts, onDraft, onCommitEntry, onField, onCommitField, onSave, onToggle }: {
  line: MeasurementImportLineRow; components: MatchComponent[]; masterBasis: 'plan' | 'actual';
  drafts: Record<string, string>;
  onDraft: (line: MeasurementImportLineRow, index: number, raw: string) => void;
  onCommitEntry: (line: MeasurementImportLineRow, index: number) => Promise<void>;
  onField: (line: MeasurementImportLineRow, field: 'label' | 'unit', raw: string) => void;
  onCommitField: (line: MeasurementImportLineRow, field: 'label' | 'unit') => Promise<void>;
  onSave: (line: MeasurementImportLineRow, patch: Partial<MeasurementImportLineRow['line_data']>) => Promise<void>;
  onToggle: (line: MeasurementImportLineRow, status: 'selected' | 'skipped' | 'candidate') => Promise<void>;
}) {
  const data = line.line_data;
  const component = components.find(c => c.id === data.matchedComponentId);
  const canCombine = !!component && LINEAL_FAMILY.has(component.measurement_type) && data.entries.length >= 2;
  const tone = data.matchedComponentId && (data.matchConfidence === 'high' || data.matchConfidence === 'medium' || data.matchOrigin === 'user') ? 'pa-in-found' : 'pa-in-missing';
  if (line.status === 'imported') {
    return <div className="mi-line mi-line-imported"><input type="checkbox" checked disabled aria-label="Added" />
      <div className="mi-line-main"><strong>{data.label}</strong>
        <span>{data.entries.map(e => e.value).join(' + ')} {data.unit} → {component?.name ?? data.matchedName} · added to the quote</span></div></div>;
  }
  if (line.status === 'skipped') {
    return <div className="mi-line mi-line-skipped"><input type="checkbox" checked disabled aria-label="Skipped" />
      <div className="mi-line-main"><strong>{data.label}</strong><span>skipped</span></div>
      <QcButton size="sm" variant="ghost" onClick={() => onToggle(line, 'candidate')}>Restore</QcButton></div>;
  }
  return (
    <div className="mi-line">
      <input type="checkbox" checked={line.status === 'selected'} onChange={e => onToggle(line, e.target.checked ? 'selected' : 'candidate')} aria-label={`Select ${data.label}`} />
      <div className="mi-line-main">
        <div className="mi-line-head">
          <QcInput className={tone} value={drafts[`${line.id}:label`] ?? data.label} aria-label="Label"
            onChange={e => onField(line, 'label', e.target.value)}
            onBlur={() => onCommitField(line, 'label')} />
          <QcInput className={`mi-unit ${tone}`} value={drafts[`${line.id}:unit`] ?? data.unit} aria-label="Unit" placeholder="unit"
            onChange={e => onField(line, 'unit', e.target.value)}
            onBlur={() => onCommitField(line, 'unit')} />
          {data.kind && <span className="mi-kind">{KIND_LABEL[data.kind] ?? data.kind}</span>}
        </div>
        <div className="mi-entries">
          {data.entries.map((entry, i) => <span key={i} className="mi-entry">
            <QcInput className={tone} inputMode="decimal" aria-label={`Entry ${i + 1}`}
              value={drafts[`${line.id}:${i}`] ?? String(entry.value)}
              onChange={e => onDraft(line, i, e.target.value)}
              onBlur={() => onCommitEntry(line, i)} />
            <span className="mi-entry-unit">{data.unit || '–'}</span>
            {data.entries.length > 1 && <button type="button" className="pa-text-link" aria-label={`Remove entry ${i + 1}`}
              onClick={() => onSave(line, { entries: data.entries.filter((_, j) => j !== i) })}>×</button>}
          </span>)}
          <button type="button" className="pa-text-link" onClick={() => onSave(line, { entries: [...data.entries, { value: data.entries[data.entries.length - 1]?.value ?? 1 }] })}>+ entry</button>
          {canCombine && <label className="mi-combine"><input type="checkbox" checked={data.combineEntries} onChange={e => onSave(line, { combineEntries: e.target.checked })} />combine into one</label>}
        </div>
        <div className="mi-line-controls">
          <QcSelect className={tone} value={data.matchedComponentId ?? ''} aria-label="Component"
            onChange={e => onSave(line, { matchedComponentId: e.target.value || null })}>
            <option value="">— choose a component —</option>
            {components.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </QcSelect>
          <QcSelect value={data.basisOverride ?? ''} aria-label="Measurement basis"
            onChange={e => onSave(line, { basisOverride: (e.target.value || null) as 'plan' | 'actual' | null })}>
            <option value="">Basis: follow master ({masterBasis === 'plan' ? 'Plan' : 'Actual'})</option>
            <option value="plan">Plan (top-down)</option>
            <option value="actual">Actual (surface)</option>
          </QcSelect>
          <QcButton size="sm" variant="ghost" onClick={() => onToggle(line, 'skipped')}>Skip</QcButton>
        </div>
        {data.warnings.length > 0 && <p className="mi-warnings">{data.warnings.join(' ')}</p>}
      </div>
    </div>
  );
}
