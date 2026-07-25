'use client';

import { useState, useEffect, useTransition } from 'react';
import {
  getRoofComponents,
  createRoofComponent,
  updateRoofComponent,
  toggleRoofComponent,
  deleteRoofComponent,
  type RoofComponent,
  type ComponentKind,
} from './actions';

const KIND_LABELS: Record<string, string> = {
  roof_area: 'Roof Area',
  ridge: 'Ridges',
  hip: 'Hip',
  valley: 'Valley',
  barge: 'Barge',
  spouting: 'Spouting',
};

const KIND_COLOURS: Record<string, string> = {
  roof_area: '#3B82F6',
  ridge: '#22C55E',
  hip: '#EF4444',
  valley: '#EAB308',
  barge: '#A855F7',
  spouting: '#64748B',
};

const KIND_ORDER: ComponentKind[] = ['roof_area', 'ridge', 'hip', 'valley', 'barge', 'spouting'];

const PITCH_TYPES = [
  { value: 'rafter', label: 'Rafter Pitch' },
  { value: 'hip_valley', label: 'Hip/Valley Pitch' },
  { value: 'none', label: 'No Pitch' },
];

const PRICING_STRATEGIES = [
  { value: 'per_unit', label: 'Per Unit' },
  { value: 'per_pack_length', label: 'Per Pack (length)' },
  { value: 'per_pack_area', label: 'Per Pack (area)' },
];

const LABOUR_UNITS = [
  { value: 'fixed', label: 'Fixed' },
  { value: 'per_unit', label: 'Per Unit' },
  { value: 'hourly', label: 'Hourly' },
];

export function RoofComponentsPanel() {
  const [components, setComponents] = useState<RoofComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    loadComponents();
  }, []);

  async function loadComponents() {
    setLoading(true);
    setError(null);
    try {
      const data = await getRoofComponents();
      setComponents(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  function groupedByKind(): Record<string, RoofComponent[]> {
    const groups: Record<string, RoofComponent[]> = {};
    for (const kind of KIND_ORDER) {
      groups[kind] = components.filter(c => c.component_kind === kind);
    }
    return groups;
  }

  const groups = groupedByKind();

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
          <button onClick={loadComponents} className="ml-3 underline">Retry</button>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-slate-400 py-8 text-center">Loading components...</div>
      ) : (
        <>
          {/* Add button */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">{components.length} component{components.length !== 1 ? 's' : ''} total</p>
            <button
              onClick={() => { setShowAddForm(true); setEditingId(null); }}
              className="inline-flex items-center gap-1.5 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Component
            </button>
          </div>

          {/* Add/Edit form */}
          {showAddForm && (
            <ComponentForm
              onSubmit={(formData) => {
                startTransition(async () => {
                  try {
                    if (editingId) {
                      await updateRoofComponent(editingId, formData);
                    } else {
                      await createRoofComponent(formData);
                    }
                    setShowAddForm(false);
                    setEditingId(null);
                    await loadComponents();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : 'Failed to save');
                  }
                });
              }}
              onCancel={() => { setShowAddForm(false); setEditingId(null); }}
              editing={!!editingId}
              initialData={editingId ? components.find(c => c.id === editingId) : undefined}
            />
          )}

          {/* Component groups */}
          {KIND_ORDER.map(kind => {
            const items = groups[kind] || [];
            if (items.length === 0) return null;
            return (
              <div key={kind}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: KIND_COLOURS[kind] }} />
                  <h3 className="text-sm font-semibold text-slate-700">{KIND_LABELS[kind]}</h3>
                  <span className="text-xs text-slate-400">({items.length})</span>
                </div>
                <div className="space-y-2">
                  {items.map(comp => (
                    <ComponentRow
                      key={comp.id}
                      component={comp}
                      onEdit={() => { setEditingId(comp.id); setShowAddForm(true); }}
                      onToggle={(active) => {
                        startTransition(async () => {
                          try {
                            await toggleRoofComponent(comp.id, active);
                            await loadComponents();
                          } catch (e) {
                            setError(e instanceof Error ? e.message : 'Failed to toggle');
                          }
                        });
                      }}
                      onDelete={() => {
                        if (confirm(`Delete "${comp.name}"? This cannot be undone.`)) {
                          startTransition(async () => {
                            try {
                              await deleteRoofComponent(comp.id);
                              await loadComponents();
                            } catch (e) {
                              setError(e instanceof Error ? e.message : 'Failed to delete');
                            }
                          });
                        }
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

// ─── Component Row ───────────────────────────────────

function ComponentRow({
  component,
  onEdit,
  onToggle,
  onDelete,
}: {
  component: RoofComponent;
  onEdit: () => void;
  onToggle: (active: boolean) => void;
  onDelete: () => void;
}) {
  return (
    <div className={`rounded-xl border bg-white px-4 py-3 transition ${component.is_active ? 'border-slate-200 hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)]' : 'border-slate-100 opacity-60'}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-900 truncate">{component.name}</span>
            {!component.is_active && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-400">Inactive</span>
            )}
          </div>
          {component.description && (
            <p className="mt-0.5 text-xs text-slate-400 truncate">{component.description}</p>
          )}
          <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
            <span>£{component.price_per_unit.toFixed(2)}/{component.unit}</span>
            {component.labour_rate > 0 && (
              <span>Labour: £{component.labour_rate.toFixed(2)} ({component.labour_unit})</span>
            )}
            <span>Waste: {component.suggested_waste_percent}%</span>
            <span className="capitalize">{component.pricing_strategy.replace(/_/g, ' ')}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={onEdit}
            className="p-2 text-slate-400 hover:text-[#FF6B35] transition rounded-full hover:bg-orange-50"
            aria-label="Edit"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
            </svg>
          </button>
          <button
            onClick={() => onToggle(!component.is_active)}
            className="p-2 text-slate-400 hover:text-slate-700 transition rounded-full hover:bg-slate-50"
            aria-label={component.is_active ? 'Deactivate' : 'Activate'}
          >
            {component.is_active ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6 6l12 12M6 6l-.5.5M6 6L4 4m12 12l.5-.5M18 18l2 2M6 18L18 6" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-slate-400 hover:text-red-500 transition rounded-full hover:bg-red-50"
            aria-label="Delete"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Component Form (Add/Edit) ───────────────────────

function ComponentForm({
  onSubmit,
  onCancel,
  editing,
  initialData,
}: {
  onSubmit: (formData: FormData) => void;
  onCancel: () => void;
  editing: boolean;
  initialData?: RoofComponent;
}) {
  return (
    <form
      action={onSubmit}
      className="rounded-xl border border-slate-200 bg-slate-50/50 p-5 space-y-4"
    >
      <h3 className="text-sm font-semibold text-slate-900">
        {editing ? 'Edit Component' : 'Add New Component'}
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Kind */}
        <FormField label="Component Type" required>
          <select
            name="component_kind"
            defaultValue={initialData?.component_kind || 'ridge'}
            disabled={editing}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none disabled:bg-slate-100"
          >
            {KIND_ORDER.map(k => (
              <option key={k} value={k}>{KIND_LABELS[k]}</option>
            ))}
          </select>
        </FormField>

        {/* Name */}
        <FormField label="Name" required>
          <input
            type="text"
            name="name"
            defaultValue={initialData?.name || ''}
            required
            placeholder="e.g. Concrete Ridge Tile"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
          />
        </FormField>

        {/* Description */}
        <FormField label="Description" full>
          <input
            type="text"
            name="description"
            defaultValue={initialData?.description || ''}
            placeholder="Optional description shown to users"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
          />
        </FormField>

        {/* Unit */}
        <FormField label="Unit">
          <select
            name="unit"
            defaultValue={initialData?.unit || 'm'}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
          >
            <option value="m">metres (m)</option>
            <option value="m²">square metres (m²)</option>
            <option value="each">each</option>
            <option value="pack">pack</option>
          </select>
        </FormField>

        {/* Price */}
        <FormField label="Price per unit (£)">
          <input
            type="number"
            name="price_per_unit"
            defaultValue={initialData?.price_per_unit?.toString() || '0'}
            min={0}
            step={0.01}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
          />
        </FormField>

        {/* Pricing strategy */}
        <FormField label="Pricing strategy">
          <select
            name="pricing_strategy"
            defaultValue={initialData?.pricing_strategy || 'per_unit'}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
          >
            {PRICING_STRATEGIES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </FormField>

        {/* Pack size */}
        <FormField label="Pack size (if pack-based)">
          <input
            type="number"
            name="pack_size"
            defaultValue={initialData?.pack_size?.toString() || ''}
            min={0}
            step={0.1}
            placeholder="e.g. 20"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
          />
        </FormField>

        {/* Pack price */}
        <FormField label="Pack price (£)">
          <input
            type="number"
            name="pack_price"
            defaultValue={initialData?.pack_price?.toString() || ''}
            min={0}
            step={0.01}
            placeholder="e.g. 45.00"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
          />
        </FormField>

        {/* Labour rate */}
        <FormField label="Labour rate (£)">
          <input
            type="number"
            name="labour_rate"
            defaultValue={initialData?.labour_rate?.toString() || '0'}
            min={0}
            step={0.01}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
          />
        </FormField>

        {/* Labour unit */}
        <FormField label="Labour unit">
          <select
            name="labour_unit"
            defaultValue={initialData?.labour_unit || 'fixed'}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
          >
            {LABOUR_UNITS.map(u => (
              <option key={u.value} value={u.value}>{u.label}</option>
            ))}
          </select>
        </FormField>

        {/* Waste */}
        <FormField label="Suggested waste (%)">
          <input
            type="number"
            name="suggested_waste_percent"
            defaultValue={initialData?.suggested_waste_percent?.toString() || '10'}
            min={0}
            max={100}
            step={1}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
          />
        </FormField>

        {/* Pitch type */}
        <FormField label="Pitch type">
          <select
            name="pitch_type"
            defaultValue={initialData?.pitch_type || 'none'}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
          >
            {PITCH_TYPES.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </FormField>

        {/* Sort order */}
        <FormField label="Sort order">
          <input
            type="number"
            name="sort_order"
            defaultValue={initialData?.sort_order?.toString() || '0'}
            min={0}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
          />
        </FormField>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50 transition"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-full bg-black px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition"
        >
          {editing ? 'Save Changes' : 'Add Component'}
        </button>
      </div>
    </form>
  );
}

function FormField({ label, required, full, children }: { label: string; required?: boolean; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={full ? 'md:col-span-2' : ''}>
      <label className="text-xs font-medium text-slate-600">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
