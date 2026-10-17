'use client';
import { useState, useId } from 'react';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { QcSelect } from '@/app/components/ui/v2/QcField';
import type { ComponentLibraryRow, MeasurementSystem } from '@/app/lib/types';
import { measurementTypeLabel } from '@/app/lib/types';

const CREATE_NEW_COMPONENT_ID = '__create_new_component__';

export function AddFromLibrary({
  library,
  onAdd,
  onCreateNew,
  copilotId,
  measurementSystem,
  label = 'Add from your pricing library',
  placeholder = 'Choose a Smart Component...',
  addButtonLabel = 'Add component',
  appearance = 'default',
}: {
  library: ComponentLibraryRow[];
  onAdd: (id: string) => Promise<unknown>;
  onCreateNew?: () => void;
  copilotId?: string;
  measurementSystem: MeasurementSystem;
  label?: string;
  placeholder?: string;
  addButtonLabel?: string;
  appearance?: 'default' | 'guided';
}) {
  const [sel, setSel] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const selectId = useId();

  async function addSelected() {
    if (!sel || adding) return;
    const selectedId = sel;
    setAdding(true);
    setAddError('');
    try {
      await onAdd(selectedId);
      setSel('');
    } catch {
      // Keep the selection in place so a transient/server validation failure
      // is visible and immediately retryable instead of looking like a dead click.
      setAddError('Could not add this item. Please try again.');
    } finally {
      setAdding(false);
    }
  }
  return (
    <div className={`qb-library ${appearance === 'guided' ? 'qb-library--guided' : ''}`} {...(copilotId ? { 'data-copilot': copilotId } : {})}>
      <label htmlFor={selectId} className="qc-label">{label}</label>
      <div className="qb-inline-form">
      <QcSelect
        id={selectId}
        value={sel}
        disabled={adding}
        onChange={e => {
          setAddError('');
          const val = e.target.value;
          if (val === CREATE_NEW_COMPONENT_ID) {
            setSel('');
            onCreateNew?.();
          } else {
            setSel(val);
          }
        }}
        className="qb-grow"
      >
        <option value="">{placeholder}</option>
        {onCreateNew && (
          <option value={CREATE_NEW_COMPONENT_ID}>+ Create new Smart Component™</option>
        )}
        {library.map(c => (
          <option key={c.id} value={c.id}>
            {c.name} ({measurementTypeLabel(c.measurement_type as any, measurementSystem)})
          </option>
        ))}
      </QcSelect>
      <QcButton
        onClick={() => void addSelected()}
        disabled={!sel || adding}
        pending={adding}
        data-copilot={copilotId ? `${copilotId}-add-btn` : undefined}
        variant="ghost"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path strokeLinecap="round" d="M12 5v14M5 12h14" /></svg>
        {addButtonLabel}
      </QcButton>
      </div>
      {addError && <p className="qc-help qb-library-error" role="alert">{addError}</p>}
      {library.length === 0 && <p className="qc-help">No saved components in this list.{onCreateNew ? ' Choose Create new Smart Component in the menu to add one.' : ''}</p>}
    </div>
  );
}
