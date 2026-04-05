'use client';

import { useState } from 'react';
import { createComponent, updateComponent, deleteComponent } from './actions';
import type {
  ComponentLibraryRow,
  ComponentLibraryInsert,
  ComponentType,
  MeasurementType,
  WasteType,
  PitchType,
} from '@/app/lib/types';
import { unitForMeasurement, wasteAmountSuffix } from '@/app/lib/types';

const MEASUREMENT_LABELS: Record<MeasurementType, string> = {
  area: 'Area (m²)',
  linear: 'Linear (m)',
  quantity: 'Quantity',
  fixed: 'Fixed',
};

const WASTE_LABELS: Record<WasteType, string> = {
  none: 'None',
  percent: 'Percentage',
  fixed: 'Fixed amount',
};

const PITCH_LABELS: Record<PitchType, string> = {
  none: 'None',
  rafter: 'Rafter Pitch',
  valley_hip: 'Valley/Hip Pitch',
};

export function ComponentList({ initialComponents }: { initialComponents: ComponentLibraryRow[] }) {
  const [components, setComponents] = useState(initialComponents);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | ComponentType>('all');
  const [saving, setSaving] = useState(false);

  // Form state for dynamic fields
  const [formWasteType, setFormWasteType] = useState<WasteType>('none');
  const [formMeasurementType, setFormMeasurementType] = useState<MeasurementType>('area');
  const [formPitchEnabled, setFormPitchEnabled] = useState(false);

  const filtered = filter === 'all' ? components : components.filter((c) => c.component_type === filter);

  function startEdit(comp: ComponentLibraryRow) {
    setEditingId(comp.id);
    setFormMeasurementType(comp.measurement_type);
    setFormWasteType(comp.default_waste_type);
    setFormPitchEnabled(comp.default_pitch_type !== 'none');
  }

  function cancelEdit() {
    setEditingId(null);
    setFormWasteType('none');
    setFormMeasurementType('area');
    setFormPitchEnabled(false);
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);

    const wasteType = fd.get('default_waste_type') as WasteType;
    const wasteAmount = Number(fd.get('waste_amount')) || 0;

    const input: ComponentLibraryInsert = {
      name: fd.get('name') as string,
      component_type: fd.get('component_type') as ComponentType,
      measurement_type: fd.get('measurement_type') as MeasurementType,
      default_material_rate: Number(fd.get('default_material_rate')) || 0,
      default_labour_rate: Number(fd.get('default_labour_rate')) || 0,
      default_waste_type: wasteType,
      default_waste_percent: wasteType === 'percent' ? wasteAmount : 0,
      default_waste_fixed: wasteType === 'fixed' ? wasteAmount : 0,
      default_pitch_type: formPitchEnabled ? (fd.get('default_pitch_type') as PitchType) : 'none',
    };

    try {
      const created = await createComponent(input);
      setComponents((prev) => [...prev, created]);
      setShowForm(false);
      setFormWasteType('none');
      setFormMeasurementType('area');
      setFormPitchEnabled(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create component');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);

    const wasteType = fd.get('default_waste_type') as WasteType;
    const wasteAmount = Number(fd.get('waste_amount')) || 0;

    const input: Partial<ComponentLibraryInsert> = {
      name: fd.get('name') as string,
      default_material_rate: Number(fd.get('default_material_rate')) || 0,
      default_labour_rate: Number(fd.get('default_labour_rate')) || 0,
      default_waste_type: wasteType,
      default_waste_percent: wasteType === 'percent' ? wasteAmount : 0,
      default_waste_fixed: wasteType === 'fixed' ? wasteAmount : 0,
      default_pitch_type: formPitchEnabled ? (fd.get('default_pitch_type') as PitchType) : 'none',
    };

    try {
      const updated = await updateComponent(id, input);
      setComponents((prev) => prev.map((c) => (c.id === id ? updated : c)));
      cancelEdit();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update component');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this component from the library?')) return;
    try {
      await deleteComponent(id);
      setComponents((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete');
    }
  }

  const wasteAmountLabel = wasteAmountSuffix(formWasteType, formMeasurementType);

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {(['all', 'main', 'extra'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition ${
              filter === f
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {f === 'all' ? 'All' : f === 'main' ? 'Main Components' : 'Extras'}
          </button>
        ))}
        <button
          onClick={() => setShowForm(true)}
          className="ml-auto px-4 py-1.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700"
        >
          + Add Component
        </button>
      </div>

      {showForm && (
        <div className="mb-4 p-4 border border-slate-200 rounded-xl bg-white">
          <h3 className="font-semibold text-slate-900 mb-3">New Component</h3>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Name</label>
                <input name="name" required className="w-full px-2 py-1 text-sm border border-slate-300 rounded" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Type</label>
                <select name="component_type" required className="w-full px-2 py-1 text-sm border border-slate-300 rounded">
                  <option value="main">Main Component</option>
                  <option value="extra">Extra</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Measurement</label>
                <select
                  name="measurement_type"
                  required
                  value={formMeasurementType}
                  onChange={(e) => setFormMeasurementType(e.target.value as MeasurementType)}
                  className="w-full px-2 py-1 text-sm border border-slate-300 rounded"
                >
                  {Object.entries(MEASUREMENT_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Material Price ({unitForMeasurement(formMeasurementType)})</label>
                <input name="default_material_rate" type="number" step="0.01" defaultValue="0" className="w-full px-2 py-1 text-sm border border-slate-300 rounded" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Labour Rate ({unitForMeasurement(formMeasurementType)})</label>
                <input name="default_labour_rate" type="number" step="0.01" defaultValue="0" className="w-full px-2 py-1 text-sm border border-slate-300 rounded" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Waste Type</label>
                <select
                  name="default_waste_type"
                  value={formWasteType}
                  onChange={(e) => setFormWasteType(e.target.value as WasteType)}
                  className="w-full px-2 py-1 text-sm border border-slate-300 rounded"
                >
                  {Object.entries(WASTE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              {formWasteType !== 'none' && (
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Waste Amount {wasteAmountLabel}</label>
                  <input name="waste_amount" type="number" step="0.01" defaultValue="0" className="w-full px-2 py-1 text-sm border border-slate-300 rounded" />
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="pitch-enabled" checked={formPitchEnabled} onChange={(e) => setFormPitchEnabled(e.target.checked)} className="rounded" />
              <label htmlFor="pitch-enabled" className="text-xs text-slate-700">Apply pitch calculation</label>
            </div>
            {formPitchEnabled && (
              <div>
                <label className="block text-xs text-slate-500 mb-1">Pitch Type</label>
                <select name="default_pitch_type" className="w-full px-2 py-1 text-sm border border-slate-300 rounded">
                  <option value="rafter">Rafter Pitch</option>
                  <option value="valley_hip">Valley/Hip Pitch</option>
                </select>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button type="submit" disabled={saving} className="px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving...' : 'Create'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setFormWasteType('none'); setFormMeasurementType('area'); setFormPitchEnabled(false); }} className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 hover:bg-slate-50">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((comp) => (
          <div key={comp.id}>
            {editingId === comp.id ? (
              <div className="p-4 border border-slate-200 rounded-xl bg-white">
                <h3 className="font-semibold text-slate-900 mb-3">Edit {comp.name}</h3>
                <form onSubmit={(e) => handleUpdate(e, comp.id)} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Name</label>
                      <input name="name" required defaultValue={comp.name} className="w-full px-2 py-1 text-sm border border-slate-300 rounded" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Material Price ({unitForMeasurement(comp.measurement_type)})</label>
                      <input name="default_material_rate" type="number" step="0.01" defaultValue={comp.default_material_rate ?? 0} className="w-full px-2 py-1 text-sm border border-slate-300 rounded" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Labour Rate ({unitForMeasurement(comp.measurement_type)})</label>
                      <input name="default_labour_rate" type="number" step="0.01" defaultValue={comp.default_labour_rate ?? 0} className="w-full px-2 py-1 text-sm border border-slate-300 rounded" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Waste Type</label>
                      <select
                        name="default_waste_type"
                        value={formWasteType}
                        onChange={(e) => setFormWasteType(e.target.value as WasteType)}
                        className="w-full px-2 py-1 text-sm border border-slate-300 rounded"
                      >
                        {Object.entries(WASTE_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </div>
                    {formWasteType !== 'none' && (
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Waste Amount {wasteAmountSuffix(formWasteType, comp.measurement_type)}</label>
                        <input
                          name="waste_amount"
                          type="number"
                          step="0.01"
                          defaultValue={formWasteType === 'percent' ? comp.default_waste_percent : comp.default_waste_fixed}
                          className="w-full px-2 py-1 text-sm border border-slate-300 rounded"
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id={`pitch-${comp.id}`} checked={formPitchEnabled} onChange={(e) => setFormPitchEnabled(e.target.checked)} className="rounded" />
                    <label htmlFor={`pitch-${comp.id}`} className="text-xs text-slate-700">Apply pitch calculation</label>
                  </div>
                  {formPitchEnabled && (
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Pitch Type</label>
                      <select name="default_pitch_type" defaultValue={comp.default_pitch_type} className="w-full px-2 py-1 text-sm border border-slate-300 rounded">
                        <option value="rafter">Rafter Pitch</option>
                        <option value="valley_hip">Valley/Hip Pitch</option>
                      </select>
                    </div>
                  )}
                  <div className="flex gap-2 pt-2">
                    <button type="submit" disabled={saving} className="px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button type="button" onClick={cancelEdit} className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 hover:bg-slate-50">
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="flex items-center gap-3 px-4 py-3 border border-slate-200 rounded-xl bg-white hover:border-slate-300">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-slate-900">{comp.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${comp.component_type === 'main' ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700'}`}>
                      {comp.component_type}
                    </span>
                    <span className="text-xs text-slate-400">{MEASUREMENT_LABELS[comp.measurement_type]}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Material: ${(comp.default_material_rate ?? 0).toFixed(2)}/{unitForMeasurement(comp.measurement_type)} · Labour: ${(comp.default_labour_rate ?? 0).toFixed(2)}/{unitForMeasurement(comp.measurement_type)}
                    {comp.default_waste_type !== 'none' && (
                      <> · Waste: {comp.default_waste_type === 'percent' ? `${comp.default_waste_percent}%` : `${comp.default_waste_fixed} ${unitForMeasurement(comp.measurement_type)}`}</>
                    )}
                    {comp.default_pitch_type !== 'none' && <> · {PITCH_LABELS[comp.default_pitch_type]}</>}
                  </p>
                </div>
                <button onClick={() => startEdit(comp)} className="px-3 py-1 text-xs font-medium rounded-lg border border-slate-300 hover:bg-slate-50">
                  Edit
                </button>
                <button onClick={() => handleDelete(comp.id)} className="text-xs text-red-500 hover:text-red-700">
                  Remove
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
