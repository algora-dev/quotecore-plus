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
}: {
  library: ComponentLibraryRow[];
  onAdd: (id: string) => Promise<void>;
  onCreateNew?: () => void;
  copilotId?: string;
  measurementSystem: MeasurementSystem;
}) {
  const [sel, setSel] = useState('');
  const selectId = useId();
  return (
    <div className="qb-library" {...(copilotId ? { 'data-copilot': copilotId } : {})}>
      <label htmlFor={selectId} className="qc-label">Add from your pricing library</label>
      <div className="qb-inline-form">
      <QcSelect
        id={selectId}
        value={sel}
        onChange={e => {
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
        <option value="">Choose a Smart Component...</option>
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
        onClick={() => {
          if (sel) {
            onAdd(sel);
            setSel('');
          }
        }}
        disabled={!sel}
        data-copilot={copilotId ? `${copilotId}-add-btn` : undefined}
        variant="ghost"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path strokeLinecap="round" d="M12 5v14M5 12h14" /></svg>
        Add component
      </QcButton>
      </div>
      {library.length === 0 && <p className="qc-help">No saved components in this list.{onCreateNew ? ' Choose Create new Smart Component in the menu to add one.' : ''}</p>}
    </div>
  );
}
