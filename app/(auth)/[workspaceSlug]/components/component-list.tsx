'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createComponent, updateComponent, deleteComponent } from './actions';
import type {
  ComponentLibraryRow,
  ComponentLibraryInsert,
  ComponentType,
  MeasurementType,
  WasteType,
  PitchType,
  FlashingLibraryRow,
} from '@/app/lib/types';
import { unitForMeasurement, wasteAmountSuffix } from '@/app/lib/types';
import { loadFlashingLibrary } from '../flashings/actions';
import { BackButton } from '@/app/components/BackButton';

const MEASUREMENT_LABELS: Record<MeasurementType, string> = {
  area: 'Area (m²)',
  lineal: 'Linear (m)',
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

export function ComponentList({ initialComponents, workspaceSlug }: { initialComponents: ComponentLibraryRow[], workspaceSlug: string }) {
  const [components, setComponents] = useState(initialComponents);
  const [flashings, setFlashings] = useState<FlashingLibraryRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | ComponentType>('all');
  const [saving, setSaving] = useState(false);

  // Form state for dynamic fields
  const [formWasteType, setFormWasteType] = useState<WasteType>('none');
  const [formMeasurementType, setFormMeasurementType] = useState<MeasurementType>('area');
  const [formPitchEnabled, setFormPitchEnabled] = useState(false);
  const [selectedFlashingId, setSelectedFlashingId] = useState<string>('');
  const [assignedFlashings, setAssignedFlashings] = useState<string[]>([]);

  // Load flashings on mount
  useEffect(() => {
    async function fetchFlashings() {
      try {
        const data = await loadFlashingLibrary();
        setFlashings(data);
      } catch (err) {
        console.error('Failed to load flashings:', err);
      }
    }
    fetchFlashings();
  }, []);

  const filtered = filter === 'all' ? components : components.filter((c) => c.component_type === filter);

  function startEdit(comp: ComponentLibraryRow) {
    setEditingId(comp.id);
    setFormMeasurementType(comp.measurement_type);
    setFormWasteType(comp.default_waste_type);
    setFormPitchEnabled(comp.default_pitch_type !== 'none');
    setAssignedFlashings(comp.flashing_ids || []);
    setSelectedFlashingId('');
  }

  function cancelEdit() {
    setEditingId(null);
    setFormWasteType('none');
    setFormMeasurementType('area');
    setFormPitchEnabled(false);
    setAssignedFlashings([]);
    setSelectedFlashingId('');
  }

  function addFlashing() {
    if (!selectedFlashingId) return;
    if (assignedFlashings.includes(selectedFlashingId)) {
      alert('This flashing is already assigned');
      return;
    }
    setAssignedFlashings(prev => [...prev, selectedFlashingId]);
    setSelectedFlashingId('');
  }

  function removeFlashing(flashingId: string) {
    setAssignedFlashings(prev => prev.filter(id => id !== flashingId));
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
      eligible_for_orders: fd.get('eligible_for_orders') === 'on',
      flashing_ids: assignedFlashings.length > 0 ? assignedFlashings : null,
    };

    try {
      const created = await createComponent(input);
      setComponents((prev) => [...prev, created]);
      setShowForm(false);
      setFormWasteType('none');
      setFormMeasurementType('area');
      setFormPitchEnabled(false);
      setAssignedFlashings([]);
      setSelectedFlashingId('');
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
      eligible_for_orders: fd.get('eligible_for_orders') === 'on',
      flashing_ids: assignedFlashings.length > 0 ? assignedFlashings : null,
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
      {/* Back Button */}
      <BackButton />
      
      {/* Header with title */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Component Library
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Master list of reusable components and extras for your templates and quotes.
        </p>
      </div>
      
      {/* Filter tabs + Action Buttons (same row, like Quotes page) */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          {(['all', 'main', 'extra'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-sm rounded-full font-medium transition ${
                filter === f
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f === 'all' ? 'All' : f === 'main' ? 'Main Components' : 'Extras'}
            </button>
          ))}
        </div>
        
        {/* Action Buttons on the right */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center rounded-full bg-black px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
          >
            + Add Component
          </button>
          <Link
            href={`/${workspaceSlug}/flashings`}
            className="inline-flex items-center rounded-full bg-black px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
          >
            + Create Flashing
          </Link>
        </div>
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
                <select 
                  name="component_type" 
                  required 
                  defaultValue={filter === 'extra' ? 'extra' : 'main'}
                  className="w-full px-2 py-1 text-sm border border-slate-300 rounded"
                >
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
            <div className="border-t border-slate-200 pt-3 mt-3">
              <h4 className="text-xs font-semibold text-slate-700 mb-2">Material Orders</h4>
              <div className="flex items-center gap-2 mb-2">
                <input type="checkbox" id="eligible-orders" name="eligible_for_orders" defaultChecked className="rounded" />
                <label htmlFor="eligible-orders" className="text-xs text-slate-700">Include in material orders</label>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Assign Flashings (Optional)</label>
                <div className="flex gap-2">
                  <select 
                    value={selectedFlashingId} 
                    onChange={(e) => setSelectedFlashingId(e.target.value)}
                    className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded"
                  >
                    <option value="">Select a flashing...</option>
                    {flashings.map(flashing => (
                      <option key={flashing.id} value={flashing.id}>
                        {flashing.name} {flashing.description && `- ${flashing.description}`}
                      </option>
                    ))}
                  </select>
                  <button 
                    type="button" 
                    onClick={addFlashing}
                    disabled={!selectedFlashingId}
                    className="px-3 py-1 text-sm font-medium rounded-full bg-[#FF6B35] text-white hover:bg-orange-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    Add
                  </button>
                </div>
                {assignedFlashings.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {assignedFlashings.map(flashingId => {
                      const flashing = flashings.find(f => f.id === flashingId);
                      return (
                        <div key={flashingId} className="flex items-center justify-between px-2 py-1 bg-slate-50 rounded border border-slate-200">
                          <span className="text-xs text-slate-700">
                            {flashing?.name || 'Unknown'} {flashing?.description && `- ${flashing.description}`}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeFlashing(flashingId)}
                            className="text-red-600 hover:text-red-700 text-xs font-medium"
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <p className="text-xs text-slate-400 mt-1">Add flashing drawings to use in material order forms</p>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button type="submit" disabled={saving} className="px-3 py-1.5 text-sm font-medium rounded-full bg-black text-white hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)] disabled:opacity-50">
                {saving ? 'Saving...' : 'Create'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setFormWasteType('none'); setFormMeasurementType('area'); setFormPitchEnabled(false); }} className="px-3 py-1.5 text-sm rounded-full border border-slate-300 hover:bg-slate-50">
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
                  <div className="border-t border-slate-200 pt-3 mt-3">
                    <h4 className="text-xs font-semibold text-slate-700 mb-2">Material Orders</h4>
                    <div className="flex items-center gap-2 mb-2">
                      <input type="checkbox" id={`eligible-orders-${comp.id}`} name="eligible_for_orders" defaultChecked={comp.eligible_for_orders ?? true} className="rounded" />
                      <label htmlFor={`eligible-orders-${comp.id}`} className="text-xs text-slate-700">Include in material orders</label>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Assign Flashings (Optional)</label>
                      <div className="flex gap-2">
                        <select 
                          value={selectedFlashingId} 
                          onChange={(e) => setSelectedFlashingId(e.target.value)}
                          className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded"
                        >
                          <option value="">Select a flashing...</option>
                          {flashings.map(flashing => (
                            <option key={flashing.id} value={flashing.id}>
                              {flashing.name} {flashing.description && `- ${flashing.description}`}
                            </option>
                          ))}
                        </select>
                        <button 
                          type="button" 
                          onClick={addFlashing}
                          disabled={!selectedFlashingId}
                          className="px-3 py-1 text-sm font-medium rounded-full bg-[#FF6B35] text-white hover:bg-orange-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                          Add
                        </button>
                      </div>
                      {assignedFlashings.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {assignedFlashings.map(flashingId => {
                            const flashing = flashings.find(f => f.id === flashingId);
                            return (
                              <div key={flashingId} className="flex items-center justify-between px-2 py-1 bg-slate-50 rounded border border-slate-200">
                                <span className="text-xs text-slate-700">
                                  {flashing?.name || 'Unknown'} {flashing?.description && `- ${flashing.description}`}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removeFlashing(flashingId)}
                                  className="text-red-600 hover:text-red-700 text-xs font-medium"
                                >
                                  Remove
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <p className="text-xs text-slate-400 mt-1">Add flashing drawings to use in material order forms</p>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button type="submit" disabled={saving} className="px-3 py-1.5 text-sm font-medium rounded-full bg-black text-white hover:bg-slate-800 disabled:opacity-50">
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button type="button" onClick={cancelEdit} className="px-3 py-1.5 text-sm rounded-full border border-slate-300 hover:bg-slate-50">
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
                <button onClick={() => startEdit(comp)} className="px-3 py-1 text-xs font-medium rounded-full border border-slate-300 hover:bg-slate-50">
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
