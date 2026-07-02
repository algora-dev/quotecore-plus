import { useState } from 'react';
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
  return (
    <div className="flex gap-2" {...(copilotId ? { 'data-copilot': copilotId } : {})}>
      <select
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
        className="flex-1 px-2 py-1 text-xs border border-slate-300 rounded"
      >
        <option value="">Add from library...</option>
        {onCreateNew && (
          <option value={CREATE_NEW_COMPONENT_ID} style={{ color: '#FF6B35', fontWeight: 600 }}>+ Create new Smart Component™</option>
        )}
        {library.map(c => (
          <option key={c.id} value={c.id}>
            {c.name} ({measurementTypeLabel(c.measurement_type as any, measurementSystem)})
          </option>
        ))}
      </select>
      <button
        onClick={() => {
          if (sel) {
            onAdd(sel);
            setSel('');
          }
        }}
        disabled={!sel}
        data-copilot={copilotId ? `${copilotId}-add-btn` : undefined}
        className="px-3 py-1 text-xs rounded-full bg-orange-500 text-white disabled:opacity-50 hover:bg-orange-600 transition-all hover:shadow-[0_0_10px_rgba(255,107,53,0.5)] disabled:hover:bg-orange-500 disabled:hover:shadow-none"
      >
        +
      </button>
    </div>
  );
}
