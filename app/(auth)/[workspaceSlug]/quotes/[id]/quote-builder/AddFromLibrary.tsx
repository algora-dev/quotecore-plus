'use client';
import { useState, useId, useEffect, useMemo, useRef } from 'react';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { QcSelect } from '@/app/components/ui/v2/QcField';
import type { ComponentLibraryRow, MeasurementSystem } from '@/app/lib/types';
import { measurementTypeLabel } from '@/app/lib/types';

const ALL_LIBRARIES = '__all__';

/**
 * Add-from-library picker (owner 2026-10-17): compact multi-select dropdown.
 * Row click = instant single add (the fast path users already know); the
 * obvious tick box on the right builds a batch added in ONE server round
 * trip via onAddBatch. The panel scrolls internally so long lists never
 * stretch the page.
 */
export function AddFromLibrary({
  library,
  onAdd,
  onAddBatch,
  onCreateNew,
  copilotId,
  measurementSystem,
  label = 'Add from your pricing library',
  placeholder = 'Choose Smart Components...',
  appearance = 'default',
  collections,
  defaultCollectionId,
}: {
  library: ComponentLibraryRow[];
  onAdd: (id: string) => Promise<unknown>;
  /** Batch add: all selected components in one server round trip. Falls back to sequential onAdd when omitted. */
  onAddBatch?: (ids: string[]) => Promise<unknown>;
  onCreateNew?: () => void;
  copilotId?: string;
  measurementSystem: MeasurementSystem;
  label?: string;
  placeholder?: string;
  appearance?: 'default' | 'guided';
  /** Named component libraries shown in the library selector. */
  collections?: { id: string; name: string }[];
  /** Quote's default library: pre-selects the selector. Non-restrictive. */
  defaultCollectionId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState('');
  const [batchBusy, setBatchBusy] = useState(false);
  const [addError, setAddError] = useState('');
  const selectId = useId();
  const libSelectId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const showLibPicker = !!collections && collections.length > 0;
  const [libSel, setLibSel] = useState<string>(() =>
    defaultCollectionId && collections?.some(c => c.id === defaultCollectionId)
      ? defaultCollectionId
      : ALL_LIBRARIES,
  );
  // Switching library only filters this picker; components already added to
  // the quote stay, so lines from multiple libraries can coexist.
  const visibleLibrary = useMemo(() => (
    libSel === ALL_LIBRARIES
      ? library
      : library.filter(c => (c.collection_id ?? null) === libSel)
  ), [library, libSel]);
  const collectionName = useMemo(
    () => new Map((collections ?? []).map(c => [c.id, c.name] as const)),
    [collections],
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? visibleLibrary.filter(c => c.name.toLowerCase().includes(q)) : visibleLibrary;
  }, [visibleLibrary, query]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function toggleChecked(id: string) {
    setAddError('');
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function addOne(id: string) {
    if (busyId || batchBusy) return;
    setBusyId(id);
    setAddError('');
    try {
      await onAdd(id);
      setChecked(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch {
      setAddError('Could not add this item. Please try again.');
    } finally {
      setBusyId('');
    }
  }

  async function addChecked() {
    if (!checked.size || batchBusy) return;
    setBatchBusy(true);
    setAddError('');
    try {
      if (onAddBatch) {
        await onAddBatch([...checked]);
      } else {
        for (const id of [...checked]) await onAdd(id);
      }
      setChecked(new Set());
      setOpen(false);
    } catch {
      setAddError('Could not add the selected components. Please try again.');
    } finally {
      setBatchBusy(false);
    }
  }

  return (
    <div className={`qb-library ${appearance === 'guided' ? 'qb-library--guided' : ''}`} {...(copilotId ? { 'data-copilot': copilotId } : {})}>
      <label id={`${selectId}-label`} className="qc-label">{label}</label>
      {showLibPicker && (
        <div className="qb-lib-picker">
          <label htmlFor={libSelectId} className="qc-label">Smart Component library</label>
          <QcSelect
            id={libSelectId}
            value={libSel}
            onChange={e => { setLibSel(e.target.value || ALL_LIBRARIES); setChecked(new Set()); }}
          >
            <option value={ALL_LIBRARIES}>All libraries</option>
            {collections?.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </QcSelect>
        </div>
      )}
      <div className="qb-ms-wrap" ref={wrapRef}>
        <button
          type="button"
          id={selectId}
          aria-labelledby={`${selectId}-label`}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="qb-ms-trigger"
          disabled={batchBusy}
          onClick={() => { setOpen(o => !o); setQuery(''); }}
        >
          <span className="qb-ms-trigger-text">{placeholder}</span>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`qb-ms-chevron ${open ? 'qb-ms-chevron--open' : ''}`}><path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" /></svg>
        </button>
        {open && (
          <div className="qb-ms-panel" role="listbox" aria-multiselectable="true" aria-labelledby={`${selectId}-label`}>
            <div className="qb-ms-searchrow">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="qb-ms-searchicon"><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z" /></svg>
              <input
                className="qb-ms-search"
                type="text"
                placeholder="Search components..."
                value={query}
                autoFocus
                onChange={e => setQuery(e.target.value)}
              />
            </div>
            <div className="qb-ms-list">
              {onCreateNew && (
                <button type="button" className="qb-ms-create" onClick={() => { setOpen(false); onCreateNew?.(); }}>
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path strokeLinecap="round" d="M12 5v14M5 12h14" /></svg>
                  Create new Smart Component™
                </button>
              )}
              {filtered.map(c => (
                <div key={c.id} className={`qb-ms-row ${checked.has(c.id) ? 'qb-ms-row--checked' : ''}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={checked.has(c.id)}
                    className="qb-ms-main"
                    disabled={busyId === c.id || batchBusy}
                    onClick={() => void addOne(c.id)}
                    title="Add this component now"
                  >
                    <span className="qb-ms-name">{busyId === c.id ? `Adding ${c.name}...` : c.name}</span>
                    <span className="qb-ms-badge">{measurementTypeLabel(c.measurement_type as any, measurementSystem)}</span>
                    {libSel === ALL_LIBRARIES && c.collection_id && (
                      <span className="qb-ms-lib">{collectionName.get(c.collection_id) ?? ''}</span>
                    )}
                  </button>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={checked.has(c.id)}
                    aria-label={`Select ${c.name} for batch add`}
                    className="qb-ms-check"
                    onClick={() => toggleChecked(c.id)}
                  >
                    <span className="qb-ms-box">
                      {checked.has(c.id) && (
                        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2"><path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" /></svg>
                      )}
                    </span>
                  </button>
                </div>
              ))}
              {filtered.length === 0 && (
                <p className="qb-ms-empty">
                  {query ? 'No components match your search.' : (libSel === ALL_LIBRARIES ? 'No saved components in this list.' : 'No saved components in this library.')}
                </p>
              )}
            </div>
            {checked.size > 0 && (
              <div className="qb-ms-footer">
                <span className="qb-ms-count">{checked.size} selected</span>
                <div className="qb-ms-footeractions">
                  <button type="button" className="qb-ms-clear" onClick={() => setChecked(new Set())} disabled={batchBusy}>Clear</button>
                  <QcButton
                    onClick={() => void addChecked()}
                    disabled={batchBusy}
                    pending={batchBusy}
                    data-copilot={copilotId ? `${copilotId}-add-btn` : undefined}
                    variant="primary"
                  >
                    Add {checked.size} {checked.size === 1 ? 'component' : 'components'}
                  </QcButton>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {addError && <p className="qc-help qb-library-error" role="alert">{addError}</p>}
      {library.length === 0 && <p className="qc-help">No saved components in this list.{onCreateNew ? ' Choose Create new Smart Component in the menu to add one.' : ''}</p>}
    </div>
  );
}
