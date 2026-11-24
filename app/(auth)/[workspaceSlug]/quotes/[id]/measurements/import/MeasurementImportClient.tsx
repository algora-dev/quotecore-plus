'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { QcInput, QcSelect } from '@/app/components/ui/v2/QcField';
import { FileUploader } from '@/app/components/FileUploader';
import { CreateSmartComponentModal } from '@/app/components/CreateSmartComponentModal';
import { measurementTypeLabel, type ComponentLibraryRow, type MeasurementSystem } from '@/app/lib/types';
import { formatCurrency } from '@/app/lib/currency/currencies';
import type { MeasurementImportLineRow, MeasurementImportRow } from '@/app/lib/measurements-import/domain';
import { toCanonicalLength, toCanonicalArea, kindFromUnit } from '@/app/lib/measurements-import/domain';
import type { MatchComponent } from '@/app/lib/measurements-import/auto-match';
import {
  loadImportReview, updateMeasurementLine, setMeasurementLineStatus,
  updateMeasurementImportBasis, rematchMeasurementImport, confirmMeasurementImport, deleteMeasurementImportAction,
  swapMeasurementSplit,
} from './actions';

type Review = { session: MeasurementImportRow; lines: MeasurementImportLineRow[]; components: MatchComponent[] };
type Collection = { id: string; name: string; isBootstrap: boolean; count: number };
type ActiveImport = { id: string; sourceName: string; remaining: number };

const KIND_LABEL: Record<string, string> = { area: 'Area', lineal: 'Length', quantity: 'Count' };
const LINEAL_FAMILY = new Set(['lineal', 'linear', 'multi_lineal', 'curved_line', 'quantity_by_spacing']);

export function MeasurementImportClient({ workspaceSlug, quoteId, quoteLabel, collections, initialCurrent, activeImports, measurementSystem, currency, defaultTrade, componentCap }: {
  workspaceSlug: string; quoteId: string; quoteLabel: string; collections: Collection[];
  initialCurrent: Review | null; activeImports: ActiveImport[];
  measurementSystem: string; currency: string; defaultTrade: string;
  componentCap?: { atCap: boolean; used: number; limit: number };
}) {
  const router = useRouter();
  const [current, setCurrent] = useState<Review | null>(initialCurrent);
  const [file, setFile] = useState<File | null>(null);
  const [libraryId, setLibraryId] = useState(() => initialCurrent?.session.library_id
    ?? (collections.find(c => c.isBootstrap && c.count > 0) ?? collections.find(c => c.count > 0) ?? collections.find(c => c.isBootstrap) ?? collections[0])?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [addedNotice, setAddedNotice] = useState('');
  const [failures, setFailures] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [creatingFor, setCreatingFor] = useState<MeasurementImportLineRow | null>(null);
  const [leaveWarn, setLeaveWarn] = useState<number | null>(null);

  const quoteHref = `/${workspaceSlug}/quotes/${quoteId}`;
  const pending = (current?.lines ?? []).filter(l => l.status !== 'imported' && l.status !== 'skipped');
  const selected = pending.filter(l => l.status === 'selected');
  const importedCount = (current?.lines ?? []).filter(l => l.status === 'imported').length;

  // Owner 2026-11-16: the added-to-quote confirmation is transient – show it, then clear it on its own.
  useEffect(() => {
    if (!addedNotice) return;
    const t = setTimeout(() => setAddedNotice(''), 5000);
    return () => clearTimeout(t);
  }, [addedNotice]);

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
      if (file) form.set('file', file); else throw Error('Choose a file or photo to extract from.');
      form.set('quoteId', quoteId); form.set('libraryId', libraryId);
      const response = await fetch('/api/measurements-import/import', { method: 'POST', body: form });
      const result = await response.json();
      if (!response.ok || !result.ok) throw Error(result.error || 'Could not read the measurements.');
      await reload(result.importId);
      setFile(null);
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

  /** Owner 2026-11-24: one-tap swap of an ambiguous quantity/measurement split. */
  async function swapSplit(line: MeasurementImportLineRow) {
    if (!current) return;
    const result = await swapMeasurementSplit(current.session.id, line.id);
    if (!result.ok) { setError(result.message); return; }
    await reload(current.session.id);
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

  /** Owner 2026-11-16: the user can ALWAYS continue – selected lines are added,
   * anything failing or skipped is simply left out and stays in the import.
   * Owner 2026-11-22: but never silently – leaving with unprocessed candidate
   * lines needs one explicit acknowledgement first. */
  async function confirm() {
    if (!current) return;
    const unprocessed = pending.filter(l => l.status === 'candidate').length;
    if (unprocessed > 0 && leaveWarn !== unprocessed) { setLeaveWarn(unprocessed); return; }
    setLeaveWarn(null);
    setBusy(true); setError(''); setFailures([]);
    try {
      if (selected.length === 0) { router.push(quoteHref); return; }
      const result = await confirmMeasurementImport(current.session.id);
      if ('message' in result) throw Error(result.message);
      if (result.imported > 0) setAddedNotice(`${result.imported} line${result.imported === 1 ? '' : 's'} added to the quote.`);
      if (result.failures.length === 0) {
        router.push(quoteHref);
        return;
      }
      await reload(current.session.id);
      setFailures(result.failures);
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

  /** Owner 2026-11-16: extracted item with no library match – create the
   *  component on the spot (same modal as the quote builder), then assign it
   *  to the line that asked for it. */
  function handleComponentCreated(comp: ComponentLibraryRow) {
    const forLine = creatingFor;
    if (current) {
      const extras = comp as ComponentLibraryRow & { waste_unit?: string | null; pricing_strategy?: string | null; pack_price?: number | null; pack_size?: number | null };
      const matchComp: MatchComponent = {
        id: comp.id, name: comp.name, sku: comp.sku ?? null, measurement_type: comp.measurement_type,
        default_material_rate: comp.default_material_rate, default_labour_rate: comp.default_labour_rate,
        default_waste_type: comp.default_waste_type, default_waste_percent: comp.default_waste_percent,
        default_waste_fixed: comp.default_waste_fixed, waste_unit: extras.waste_unit ?? null,
        pricing_strategy: extras.pricing_strategy ?? null, pack_price: extras.pack_price ?? null, pack_size: extras.pack_size ?? null,
      };
      setCurrent(cur => cur ? { ...cur, components: [...cur.components.filter(c => c.id !== comp.id), matchComp] } : cur);
    }
    setCreatingFor(null);
    if (forLine) {
      void saveLine(forLine, { matchedComponentId: comp.id });
      setNotice(`\u201c${comp.name}\u201d created in your library and matched to \u201c${forLine.line_data.label}\u201d.`);
    }
  }

  if (!current) {
    return (
      <section className="pa-panel pa-capture" aria-labelledby="mi-title">
        <div className="pa-top"><Link href={quoteHref}>← Back to {quoteLabel}</Link><span>Measurements import</span></div>
        <h1 id="mi-title" className="pa-section-heading" style={{ display: 'block' }}>Upload measurements for {quoteLabel}</h1>
        <p className="pa-panel-p">Photo of handwritten notes, PDF or spreadsheet. We read the measurement and quantity lines, match them to your pricing library, then you check everything before it is added.</p>
        {activeImports.length > 0 && <div className="pa-resume-list" style={{ marginBottom: 16 }}>
          {activeImports.map(s => <Link key={s.id} href={`${quoteHref}/measurements/import?import=${s.id}`}>{s.sourceName} <small>({s.remaining} lines)</small></Link>)}
        </div>}
        <FileUploader appearance="v2" accept=".csv,.xlsx,.txt,.pdf,.png,.jpg,.jpeg,.webp" maxSize={8388608}
          onUpload={async f => { setFile(f); }} currentFileUrl={null}
          label="Choose a file or photo" description="CSV, XLSX, TXT, PDF, PNG, JPEG or WebP · up to 8 MB" />
        {file && <div className="pa-file-chip"><span>{file.name}</span><small>{Math.max(1, Math.round(file.size / 1024))} KB</small><QcButton size="sm" variant="ghost" onClick={() => setFile(null)}>Remove</QcButton></div>}
        <div className="mi-capture-controls">
          <label htmlFor="mi-library">Pricing library to apply</label>
          <QcSelect id="mi-library" value={libraryId} onChange={e => setLibraryId(e.target.value)}>
            {collections.length === 0 && <option value="">No libraries yet – add components in Pricing first</option>}
            {collections.map(c => <option key={c.id} value={c.id}>{c.name}{c.isBootstrap ? ' (default)' : ''}{c.count === 0 ? ' – empty' : ''}</option>)}
          </QcSelect>
          <QcButton variant="primary" pending={busy} disabled={busy || !file || !libraryId} onClick={extract}>
            {busy && <span className="mi-spin animate-spin" aria-hidden="true" />}
            {busy ? 'Reading your measurements…' : 'Extract measurements'}
          </QcButton>
          <p className="mi-extract-hint">Reading a photo or document can take up to a minute on longer jobs.</p>
          <p className="mi-extract-hint">Tip: write lengths with a decimal (4.5 or 4.0) and quantities as whole numbers – a unit next to a number (4.5m) is always kept.</p>
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
          <button type="button" aria-pressed={session.default_basis === 'plan'} data-qc-tip="Plan measurements are a top-down view. Pitch calculation is added when the component uses pitch."
            onClick={() => switchBasis('plan')}>Plan (top-down)</button>
          <button type="button" aria-pressed={session.default_basis === 'actual'} data-qc-tip="Actual is the final measurement as taken on the surface – the finished length or area. No pitch is added."
            onClick={() => switchBasis('actual')}>Actual (final)</button>
        </div>
        <div className="mi-library-row">
          <label htmlFor="mi-library-review">Library</label>
          <QcSelect id="mi-library-review" value={libraryId} onChange={e => setLibraryId(e.target.value)}>
            {collections.map(c => <option key={c.id} value={c.id}>{c.name}{c.isBootstrap ? ' (default)' : ''}{c.count === 0 ? ' – empty' : ''}</option>)}
          </QcSelect>
          <QcButton size="sm" variant="ghost" disabled={busy || libraryId === session.library_id} onClick={rematch}>Re-match lines</QcButton>
        </div>
      </div>
      <p className="mi-master-help">Applies to every line unless a line sets its own basis. Per-line override is in each line.</p>

      <div className="pa-legend"><span><i className="pa-swatch pa-swatch-found" />Confident match</span><span><i className="pa-swatch pa-swatch-missing" />Needs your input</span></div>

      {componentCap?.atCap && <div className="pa-alert mi-cap-banner" role="alert">
        <span>Your plan's component limit is reached ({componentCap.used}/{componentCap.limit}). Existing components can still be matched; creating new ones needs an upgrade.</span>
        <Link href={`/${workspaceSlug}/account?tab=billing`}>View plans →</Link>
      </div>}

      <div className="mi-toolbar">
        <button type="button" className="pa-text-link" onClick={() => pending.forEach(l => toggleStatus(l, l.status === 'selected' ? 'candidate' : 'selected'))}>
          {pending.length > 0 && selected.length === pending.length ? 'Clear selection' : 'Select all'}
        </button>
        <strong>{selected.length} selected</strong>
        {addedNotice && <span className="pa-success mi-added-notice" role="status">{addedNotice}</span>}
      </div>

      <div className="mi-lines">
        {lines.map(line => <LineRow key={line.id} line={line} components={components} masterBasis={session.default_basis}
          drafts={drafts} onDraft={setEntry} onCommitEntry={commitEntry} onField={setField} onCommitField={commitField} onSave={saveLine} onToggle={toggleStatus}
          onSwap={swapSplit}
          currency={currency} measurementSystem={measurementSystem} onCreateComponent={setCreatingFor} disableCreate={componentCap?.atCap ?? false} />)}
      </div>

      {failures.length > 0 && <div className="pa-alert mi-failures" role="alert"><strong>Some lines need attention:</strong>{'\n'}{failures.slice(0, 8).join('\n')}</div>}
      {error && <div className="pa-alert mi-failures" role="alert">{error}</div>}
      {notice && <div className="pa-success mi-failures" role="status">{notice}</div>}

      {leaveWarn !== null && leaveWarn > 0 && (
        <div className="pa-alert mi-leave-warn" role="alert">
          <strong>{leaveWarn} line{leaveWarn === 1 ? '' : 's'} still not added</strong>
          <span> – each needs a component, unit or tick. They stay saved in this import until you add or skip them, so nothing is lost.</span>
          <div className="mi-leave-warn-actions">
            <QcButton size="sm" variant="ghost" onClick={() => setLeaveWarn(null)}>Keep reviewing</QcButton>
            <QcButton size="sm" variant="primary" pending={busy} disabled={busy} onClick={confirm}>Continue to quote anyway →</QcButton>
          </div>
        </div>
      )}

      <div className="pa-actions">
        <div className="pa-save-actions">
          <strong>{selected.length} selected</strong>
        </div>
        <QcButton variant="primary" pending={busy} disabled={busy} onClick={confirm}>
          {busy ? 'Adding…' : selected.length > 0 ? `Add ${selected.length} line${selected.length === 1 ? '' : 's'} to quote →` : 'Continue to quote →'}
        </QcButton>
      </div>

      {creatingFor && <CreateSmartComponentModal
        appearance="v2"
        measurementSystem={measurementSystem as MeasurementSystem}
        defaultTrade={defaultTrade}
        defaultComponentType="main"
        collections={collections.map(c => ({ id: c.id, name: c.name, is_bootstrap: c.isBootstrap }))}
        defaultCollectionId={libraryId || undefined}
        submitLabel="Save & match to line"
        subtitle="Saved to your library and matched to this line."
        onCreated={handleComponentCreated}
        onClose={() => setCreatingFor(null)}
      />}
    </section>
  );
}

function LineRow({ line, components, masterBasis, drafts, onDraft, onCommitEntry, onField, onCommitField, onSave, onToggle, onSwap, currency, measurementSystem, onCreateComponent, disableCreate }: {
  line: MeasurementImportLineRow; components: MatchComponent[]; masterBasis: 'plan' | 'actual';
  drafts: Record<string, string>;
  onDraft: (line: MeasurementImportLineRow, index: number, raw: string) => void;
  onCommitEntry: (line: MeasurementImportLineRow, index: number) => Promise<void>;
  onField: (line: MeasurementImportLineRow, field: 'label' | 'unit', raw: string) => void;
  onCommitField: (line: MeasurementImportLineRow, field: 'label' | 'unit') => Promise<void>;
  onSave: (line: MeasurementImportLineRow, patch: Partial<MeasurementImportLineRow['line_data']>) => Promise<void>;
  onToggle: (line: MeasurementImportLineRow, status: 'selected' | 'skipped' | 'candidate') => Promise<void>;
  onSwap: (line: MeasurementImportLineRow) => Promise<void>;
  currency: string; measurementSystem: string;
  onCreateComponent: (line: MeasurementImportLineRow) => void;
  disableCreate?: boolean;
}) {
  const data = line.line_data;
  const component = components.find(c => c.id === data.matchedComponentId);
  const quickUnits = data.kind === 'area' ? ['m²', 'ft²', 'sq'] : data.kind === 'lineal' ? ['m', 'ft'] : data.kind === 'quantity' ? ['ea'] : [];
  const canCombine = !!component && LINEAL_FAMILY.has(component.measurement_type) && data.entries.length >= 2;
  const tone = data.matchedComponentId && (data.matchConfidence === 'high' || data.matchConfidence === 'medium' || data.matchOrigin === 'user') ? 'pa-in-found' : 'pa-in-missing';
  // Owner 2026-11-24: row-level reading confidence, mirroring the pricing
  // extractor's convention – pale green = confident, light orange = check me.
  const unitRecognised = !data.unit || kindFromUnit(data.unit) !== null;
  const needsCheck = !!data.split?.ambiguous || !unitRecognised || tone === 'pa-in-missing';
  // Owner 2026-11-16: preview the line exactly like a quote-builder component
  // card – numbered entries with waste-adjusted values, quantity total and
  // item+labour cost from the matched component's rules.
  const unitFactor = data.kind === 'lineal' ? toCanonicalLength(1, data.unit)
    : data.kind === 'area' ? toCanonicalArea(1, data.unit) : data.kind === 'quantity' ? 1 : null;
  const wasteType = component?.default_waste_type ?? 'none';
  const wastePct = Number(component?.default_waste_percent ?? 0) || 0;
  const wasteFixed = Number(component?.default_waste_fixed ?? 0) || 0;
  const perEntryWaste = wasteType === 'percent' ? wastePct / 100
    : wasteType === 'fixed_per_segment' && unitFactor ? wasteFixed / unitFactor : 0;
  const hasWaste = wasteType === 'none' ? false : wasteType === 'fixed' ? wasteFixed > 0 : perEntryWaste > 0;
  const adjusted = (v: number) => wasteType === 'percent' ? v * (1 + perEntryWaste)
    : wasteType === 'fixed_per_segment' ? v + perEntryWaste : v;
  const sumRaw = data.entries.reduce((s, e) => s + e.value, 0);
  const sumAdj = data.entries.reduce((s, e) => s + adjusted(e.value), 0)
    + (wasteType === 'fixed' && unitFactor ? wasteFixed / unitFactor : 0);
  const totalDisplay = `${sumAdj.toFixed(2)}${data.unit ? ` ${data.unit}` : ''}`;
  const totalChanged = hasWaste && Math.abs(sumAdj - sumRaw) > 1e-6;
  let costDisplay: string | null = null;
  if (component && unitFactor) {
    const totalCanon = sumAdj * unitFactor;
    const mat = Number(component.default_material_rate ?? 0) || 0;
    const lab = Number(component.default_labour_rate ?? 0) || 0;
    const strategy = component.pricing_strategy ?? 'per_unit';
    const packPrice = Number(component.pack_price ?? 0) || 0;
    const packSize = Number(component.pack_size ?? 0) || 0;
    if (strategy.startsWith('per_pack') && packPrice > 0 && packSize > 0) {
      costDisplay = formatCurrency(Math.ceil(totalCanon / packSize) * packPrice, currency);
    } else if (mat + lab > 0) {
      costDisplay = formatCurrency(totalCanon * (mat + lab), currency);
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const typeMeta = component ? `${measurementTypeLabel(component.measurement_type as any, measurementSystem as any)} · ${data.entries.length} ${data.entries.length === 1 ? 'entry' : 'entries'}` : null;
  // Owner 2026-11-16: clicking anywhere on a line selects it; interactive
  // controls keep their own handling.
  function rowClick(e: React.MouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('input, select, button, a, textarea, label')) return;
    onToggle(line, line.status === 'selected' ? 'candidate' : 'selected');
  }
  if (line.status === 'imported') {
    return <div className="mi-line mi-line-imported"><span className="mi-added-check" aria-hidden="true">✓</span>
      <div className="mi-line-main"><strong>{data.label}</strong>
        <span>{data.entries.map(e => e.value).join(' + ')} {data.unit} → {component?.name ?? data.matchedName} · added to the quote</span></div></div>;
  }
  if (line.status === 'skipped') {
    return <div className="mi-line mi-line-skipped"><span className="mi-skip-mark" aria-hidden="true">–</span>
      <div className="mi-line-main"><strong>{data.label}</strong><span>skipped – not added to the quote</span></div>
      <QcButton size="sm" variant="ghost" onClick={() => onToggle(line, 'candidate')}>Restore</QcButton></div>;
  }
  return (
    <div className={`mi-line mi-line--selectable${line.status === 'selected' ? ' mi-line--selected' : ''}${needsCheck ? ' mi-line--check' : ' mi-line--ok'}`} onClick={rowClick} role="button" tabIndex={0}
      aria-pressed={line.status === 'selected'} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(line, line.status === 'selected' ? 'candidate' : 'selected'); } }}>
      <input type="checkbox" checked={line.status === 'selected'} onChange={e => onToggle(line, e.target.checked ? 'selected' : 'candidate')} aria-label={`Select ${data.label}`} />
      <div className="mi-line-main">
        <div className="mi-line-head">
          <QcInput className={tone} value={drafts[`${line.id}:label`] ?? data.label} aria-label="Label"
            onChange={e => onField(line, 'label', e.target.value)}
            onBlur={() => onCommitField(line, 'label')} />
          <QcInput className={`mi-unit ${tone}${data.unitGuessed ? ' mi-unit--assumed' : ''}`} value={drafts[`${line.id}:unit`] ?? data.unit} aria-label="Unit" placeholder="unit"
            onChange={e => onField(line, 'unit', e.target.value)}
            onBlur={() => onCommitField(line, 'unit')} />
          {data.unitGuessed && <span className="mi-kind mi-kind--assumed" data-qc-tip="The source had no unit – this is a guess from the reading. Change it if wrong.">assumed</span>}
          {data.kind && <span className="mi-kind">{KIND_LABEL[data.kind] ?? data.kind}</span>}
          {data.split?.ambiguous && (
            <button type="button" className="mi-swap" onClick={() => onSwap(line)}
              data-qc-tip="Swap which number is the quantity and which is the measurement.">⇄ swap qty × length</button>
          )}
          {(data.unitGuessed || !data.unit) && quickUnits.length > 0 && (
            <div className="mi-unit-quick" role="group" aria-label="Set the unit">
              {quickUnits.map(u => (
                <button key={u} type="button" className={data.unit === u ? 'is-active' : ''}
                  onClick={() => onSave(line, { unit: u, unitGuessed: false })}>{u}</button>
              ))}
            </div>
          )}
          {component && <span className="mi-figure"><span className="mi-mini-label">Quantity</span><strong>{totalDisplay}</strong></span>}
          {component && costDisplay && <span className="mi-figure"><span className="mi-mini-label">Item + labour</span><strong>{costDisplay}</strong></span>}
        </div>
        {typeMeta && <span className="mi-type-meta">{typeMeta}{totalChanged ? ' · incl waste' : ''}</span>}
        <div className="mi-entries">
          {data.entries.map((entry, i) => <span key={i} className="mi-entry">
            <span className="mi-entry-number" aria-hidden="true">#{i + 1}</span>
            <QcInput className={tone} inputMode="decimal" aria-label={`Entry ${i + 1}`}
              value={drafts[`${line.id}:${i}`] ?? String(entry.value)}
              onChange={e => onDraft(line, i, e.target.value)}
              onBlur={() => onCommitEntry(line, i)} />
            <span className="mi-entry-unit">{data.unit || '–'}</span>
            {hasWaste && Math.abs(adjusted(entry.value) - entry.value) > 1e-6
              && <span className="mi-entry-detail">→ {adjusted(entry.value).toFixed(2)} – incl waste</span>}
            {data.entries.length > 1 && <button type="button" className="pa-text-link" aria-label={`Remove entry ${i + 1}`}
              onClick={() => onSave(line, { entries: data.entries.filter((_, j) => j !== i) })}>×</button>}
          </span>)}
          <div className="mi-entry-tools">
            <button type="button" className="pa-text-link" onClick={() => onSave(line, { entries: [...data.entries, { value: data.entries[data.entries.length - 1]?.value ?? 1 }] })}>+ entry</button>
            {canCombine && <label className="mi-combine"><input type="checkbox" checked={data.combineEntries} onChange={e => onSave(line, { combineEntries: e.target.checked })} />Combine into total length + waste</label>}
          </div>
        </div>
        <div className="mi-line-controls">
          <div className="mi-component-picker">
            <QcSelect className={tone} value={data.matchedComponentId ?? ''} aria-label="Component"
              onChange={e => onSave(line, { matchedComponentId: e.target.value || null })}>
              <option value="">– choose a component –</option>
              {components.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </QcSelect>
            <QcButton size="sm" variant="ghost" disabled={disableCreate}
              data-qc-tip={disableCreate ? 'Plan limit reached. Upgrade from Account → Billing & Pricing to add more components.' : undefined}
              onClick={() => onCreateComponent(line)}>+ New component</QcButton>
          </div>
          <QcSelect value={data.basisOverride ?? ''} aria-label="Measurement basis"
            onChange={e => onSave(line, { basisOverride: (e.target.value || null) as 'plan' | 'actual' | null })}>
            <option value="">Basis: follow master ({masterBasis === 'plan' ? 'Plan' : 'Actual'})</option>
            <option value="plan">Plan (top-down)</option>
            <option value="actual">Actual (final)</option>
          </QcSelect>
          <QcButton size="sm" variant="ghost" onClick={() => onToggle(line, 'skipped')}>Skip</QcButton>
        </div>
        {data.warnings.length > 0 && <p className="mi-warnings">{data.warnings.join(' ')}</p>}
      </div>
    </div>
  );
}
