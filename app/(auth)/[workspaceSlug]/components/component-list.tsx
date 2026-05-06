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
  const [measurementFilter, setMeasurementFilter] = useState<'all' | MeasurementType | 'rafter' | 'valley_hip'>('all');
  const [searchQuery, setSearchQuery] = useState('');
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

  let filtered = filter === 'all' ? components : components.filter((c) => c.component_type === filter);
  
  // Measurement/pitch filter
  if (measurementFilter === 'rafter') {
    filtered = filtered.filter(c => c.default_pitch_type === 'rafter');
  } else if (measurementFilter === 'valley_hip') {
    filtered = filtered.filter(c => c.default_pitch_type === 'valley_hip');
  } else if (measurementFilter !== 'all') {
    filtered = filtered.filter(c => c.measurement_type === measurementFilter);
  }

  // Search
  if (searchQuery) {
    const s = searchQuery.toLowerCase();
    filtered = filtered.filter(c => c.name.toLowerCase().includes(s));
  }

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
    const wasteAmountRaw = fd.get('waste_amount') as string || '0';
    const wasteAmount = Number(wasteAmountRaw) || 0;

    if (wasteType === 'fixed' && wasteAmountRaw.includes('.')) {
      const decimals = wasteAmountRaw.split('.')[1];
      if (decimals && decimals.length > 2) {
        alert('Reduce your decimal places to two or less (e.g. 0.25)');
        setSaving(false);
        return;
      }
    }

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
    const wasteAmountRaw = fd.get('waste_amount') as string || '0';
    const wasteAmount = Number(wasteAmountRaw) || 0;

    if (wasteType === 'fixed' && wasteAmountRaw.includes('.')) {
      const decimals = wasteAmountRaw.split('.')[1];
      if (decimals && decimals.length > 2) {
        alert('Reduce your decimal places to two or less (e.g. 0.25)');
        setSaving(false);
        return;
      }
    }

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

  const [deleteCompId, setDeleteCompId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function confirmDeleteComp() {
    if (!deleteCompId) return;
    setDeleteLoading(true);
    try {
      await deleteComponent(deleteCompId);
      setComponents((prev) => prev.filter((c) => c.id !== deleteCompId));
      setDeleteCompId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleteLoading(false);
    }
  }

  const wasteAmountLabel = wasteAmountSuffix(formWasteType, formMeasurementType);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Components</h1>
        <p className="text-sm text-slate-500 mt-1">Manage reusable components and extras for quotes.</p>
      </div>
      
      {/* Filter tabs + Action Buttons */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 p-1 bg-slate-100 rounded-full w-fit">
          {(['all', 'main', 'extra'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 text-sm rounded-full font-medium transition ${
                filter === f
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {f === 'all' ? 'All' : f === 'main' ? 'Main' : 'Extras'}
            </button>
          ))}
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => setShowForm(true)}
            data-copilot="add-component"
            className="inline-flex items-center rounded-full bg-black px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
          >
            + Add Component
          </button>
          <Link
            href={`/${workspaceSlug}/flashings`}
            className="inline-flex items-center rounded-full bg-[#FF6B35] px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-[#ff5722] hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
          >
            Flashings
          </Link>
        </div>
      </div>

      {/* Measurement type filters */}
      <div className="flex gap-1 flex-wrap">
        {[
          { key: 'all', label: 'All Types' },
          { key: 'area', label: 'Area' },
          { key: 'lineal', label: 'Linear' },
          { key: 'rafter', label: 'Rafter Pitch' },
          { key: 'valley_hip', label: 'Hip/Valley Pitch' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setMeasurementFilter(f.key as any)}
            className={`px-3 py-1 text-xs font-medium rounded-full border transition ${
              measurementFilter === f.key
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search components..."
          className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
        />
        <svg className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">✕</button>
        )}
      </div>

      {showForm && (
        <div className="mb-4 p-4 border border-slate-200 rounded-xl bg-white">
          <h3 className="font-semibold text-slate-900 mb-3">New Component</h3>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div data-copilot="component-name">
                <label className="block text-xs text-slate-500 mb-1">Name</label>
                <input name="name" required className="w-full px-2 py-1 text-sm border border-slate-300 rounded-lg" />
              </div>
              <div data-copilot="component-type">
                <label className="block text-xs text-slate-500 mb-1">Type</label>
                <select 
                  name="component_type" 
                  required 
                  defaultValue={filter === 'extra' ? 'extra' : 'main'}
                  className="w-full px-2 py-1 text-sm border border-slate-300 rounded-lg"
                >
                  <option value="main">Main Component</option>
                  <option value="extra">Extra</option>
                </select>
              </div>
              <div data-copilot="component-measurement">
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
              <div data-copilot="component-rates">
                <label className="block text-xs text-slate-500 mb-1">Material Price ({unitForMeasurement(formMeasurementType)})</label>
                <input name="default_material_rate" type="number" step="0.01" placeholder="0" className="w-full px-2 py-1 text-sm border border-slate-300 rounded-lg" />
              </div>
              <div data-copilot="component-labour">
                <label className="block text-xs text-slate-500 mb-1">Labour Rate ({unitForMeasurement(formMeasurementType)})</label>
                <input name="default_labour_rate" type="number" step="0.01" placeholder="0" className="w-full px-2 py-1 text-sm border border-slate-300 rounded-lg" />
              </div>
              <div data-copilot="component-waste">
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
                <div data-copilot="component-waste-amount">
                  <label className="block text-xs text-slate-500 mb-1">Waste Amount {wasteAmountLabel}</label>
                  <input name="waste_amount" type="number" step="0.01" placeholder={formWasteType === 'percent' ? '% e.g. 10' : 'e.g. 0.25(m)'} className="w-full px-2 py-1 text-sm border border-slate-300 rounded-lg" />
                </div>
              )}
            </div>
            <div className="flex items-center gap-2" data-copilot="component-pitch">
              <input type="checkbox" id="pitch-enabled" checked={formPitchEnabled} onChange={(e) => setFormPitchEnabled(e.target.checked)} className="rounded" />
              <label htmlFor="pitch-enabled" className="text-xs text-slate-700">Apply pitch calculation</label>
            </div>
            {formPitchEnabled && (
              <div data-copilot="component-pitch-type">
                <label className="block text-xs text-slate-500 mb-1">Pitch Type</label>
                <select name="default_pitch_type" className="w-full px-2 py-1 text-sm border border-slate-300 rounded-lg">
                  <option value="rafter">Rafter Pitch</option>
                  <option value="valley_hip">Valley/Hip Pitch</option>
                </select>
              </div>
            )}
            <div className="border-t border-slate-200 pt-3 mt-3" data-copilot="component-flashings">
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
            <div className="flex gap-2 pt-2" data-copilot="component-save">
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
              <div 
                onClick={() => startEdit(comp)}
                title="Click to view component"
                className="flex items-center gap-3 px-4 py-3 border border-slate-200 rounded-xl bg-white cursor-pointer hover:bg-orange-50/40 hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] transition group"
              >
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
                <button
                  onClick={(e) => { e.stopPropagation(); startEdit(comp); }}
                  title="Click to edit"
                  className="p-1.5 rounded-full text-slate-400 hover:text-orange-600 hover:bg-orange-50 hover:shadow-[0_0_10px_rgba(255,107,53,0.35)] transition opacity-0 group-hover:opacity-100"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); setDeleteCompId(comp.id); }} 
                  title="Click to delete"
                  className="p-1.5 rounded-full text-slate-300 hover:text-red-500 hover:bg-red-50 hover:shadow-[0_0_10px_rgba(255,107,53,0.35)] transition opacity-0 group-hover:opacity-100"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Delete Modal */}
      {deleteCompId && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Delete Component</h3>
            <p className="text-sm text-slate-500 mt-2">This action cannot be undone. The component will be removed from your library.</p>
            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => setDeleteCompId(null)} className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50" disabled={deleteLoading}>Cancel</button>
              <button onClick={confirmDeleteComp} className="px-4 py-2 text-sm font-medium rounded-full bg-red-600 text-white hover:bg-red-700 disabled:opacity-50" disabled={deleteLoading}>{deleteLoading ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
