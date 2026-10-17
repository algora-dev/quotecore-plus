'use client';

import { useEffect, useId, useMemo, useState, type ComponentProps } from 'react';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { QcInput } from '@/app/components/ui/v2/QcField';
import { QcMoneySummary } from '@/app/components/ui/v2/QcMoneySummary';
import { QcStatusBadge } from '@/app/components/ui/v2/QcSurface';
import { formatCurrency } from '@/app/lib/currency/currencies';
import { formatArea } from '@/app/lib/measurements/displayHelpers';
import type {
  ComponentLibraryRow,
  InputMode,
  QuoteComponentEntryRow,
  QuoteComponentRow,
  QuoteRoofAreaEntryRow,
  QuoteRoofAreaRow,
  QuoteRow,
} from '@/app/lib/types';
import { RoofAreaCard } from './RoofAreaCard';
import { ExpandableComponent } from './ExpandableComponent';
import { AddFromLibrary } from './AddFromLibrary';

type RoofAreaUpdateHandler = ComponentProps<typeof RoofAreaCard>['onUpdate'];

interface Props {
  quote: QuoteRow;
  roofAreas: QuoteRoofAreaRow[];
  roofAreaEntries: Record<string, QuoteRoofAreaEntryRow[]>;
  components: QuoteComponentRow[];
  entries: Record<string, QuoteComponentEntryRow[]>;
  libraryComponents: ComponentLibraryRow[];
  collections?: { id: string; name: string; is_bootstrap?: boolean }[];
  /** Quote's default library: pre-selects the AddFromLibrary picker. */
  defaultCollectionId?: string | null;
  /** Batch add (owner 2026-10-17): all selected components in one round trip. */
  onAddFromLibraryBatch?: (libIds: string[], areaId: string | null, type: 'main' | 'extra') => Promise<QuoteComponentRow[]>;
  currency: string;
  totals: { totalMaterials: number; totalLabour: number; grandTotal: number };
  onCreateArea: (label: string) => Promise<QuoteRoofAreaRow | null>;
  onUpdateArea: RoofAreaUpdateHandler;
  onToggleAreaLock: (id: string, locked: boolean) => Promise<void>;
  onAddAreaEntry: (areaId: string, width: number, length: number) => Promise<void>;
  onRemoveAreaEntry: (entryId: string, areaId: string) => Promise<void>;
  onRemoveArea: (id: string) => void;
  onAddFromLibrary: (libraryId: string, areaId: string | null, type: 'main' | 'extra') => Promise<QuoteComponentRow | null>;
  onCreateComponent: (areaId: string | null, type: 'main' | 'extra') => void;
  onAddEntry: (compId: string, rawValue: number, options?: { bypassHeightMultiplier?: boolean; bypassDepthMultiplier?: boolean; convertAs?: 'area' | 'linear' | 'volume' | 'none'; entryHeightM?: number | null; entryDepthM?: number | null }) => Promise<void>;
  onUseRoofArea: (compId: string, roofAreaSqm: number) => Promise<void>;
  onRemoveEntry: (entryId: string, compId: string) => Promise<void>;
  onRemoveComponent: (id: string) => Promise<void>;
  onUpdateComponent: (compId: string, updates: {
    input_mode?: InputMode;
    quote_roof_area_id?: string | null;
    use_custom_pitch?: boolean;
    custom_pitch_degrees?: number | null;
  }) => Promise<void>;
  onCombineEntries?: (compId: string) => Promise<void>;
  onSplitEntries?: (compId: string) => Promise<void>;
  onContinue: () => void;
}

function componentCost(component: QuoteComponentRow) {
  return Number(component.material_cost ?? 0) + Number(component.labour_cost ?? 0);
}

export function GuidedQuoteSetup({
  quote,
  roofAreas,
  roofAreaEntries,
  components,
  entries,
  libraryComponents,
  collections = [],
  defaultCollectionId,
  onAddFromLibraryBatch,
  currency,
  totals,
  onCreateArea,
  onUpdateArea,
  onToggleAreaLock,
  onAddAreaEntry,
  onRemoveAreaEntry,
  onRemoveArea,
  onAddFromLibrary,
  onCreateComponent,
  onAddEntry,
  onUseRoofArea,
  onRemoveEntry,
  onRemoveComponent,
  onUpdateComponent,
  onCombineEntries,
  onSplitEntries,
  onContinue,
}: Props) {
  const areaNameId = useId();
  const [activeAreaId, setActiveAreaId] = useState<string | null>(() => {
    const unfinished = roofAreas.find(area => !area.is_locked);
    return unfinished?.id ?? roofAreas[0]?.id ?? null;
  });
  const [creatingArea, setCreatingArea] = useState(roofAreas.length === 0);
  const [ungroupedMode, setUngroupedMode] = useState(
    roofAreas.length === 0 && components.some(component => !component.quote_roof_area_id && component.component_type === 'main'),
  );
  const [newAreaName, setNewAreaName] = useState('');
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [newComponentFocus, setNewComponentFocus] = useState<{ id: string; request: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const mainComponents = useMemo(
    () => components.filter(component => component.component_type === 'main'),
    [components],
  );
  const ungroupedComponents = mainComponents.filter(component => !component.quote_roof_area_id);
  const activeArea = roofAreas.find(area => area.id === activeAreaId) ?? null;
  const activeComponents = activeArea
    ? mainComponents.filter(component => component.quote_roof_area_id === activeArea.id)
    : [];

  useEffect(() => {
    if (creatingArea || ungroupedMode) return;
    // If the final work area is removed, return to the useful first-step state
    // instead of leaving an empty editor column. Existing whole-job components
    // remain available through their own route and should not force area creation.
    if (roofAreas.length === 0 && ungroupedComponents.length === 0) {
      setActiveAreaId(null);
      setCreatingArea(true);
      return;
    }
    if (activeAreaId && roofAreas.some(area => area.id === activeAreaId)) return;
    const unfinished = roofAreas.find(area => !area.is_locked);
    setActiveAreaId(unfinished?.id ?? roofAreas[0]?.id ?? null);
  }, [roofAreas, activeAreaId, creatingArea, ungroupedMode, ungroupedComponents.length]);

  async function createArea() {
    const label = newAreaName.trim();
    if (!label || busy) return;
    setBusy(true);
    try {
      const created = await onCreateArea(label);
      if (!created) return;
      setNewAreaName('');
      setCreatingArea(false);
      setUngroupedMode(false);
      setActiveAreaId(created.id);
    } finally {
      setBusy(false);
    }
  }

  async function saveRename() {
    if (!activeArea || !renameValue.trim() || busy) return;
    setBusy(true);
    try {
      await onUpdateArea(activeArea.id, { label: renameValue.trim() });
      setRenameOpen(false);
    } finally {
      setBusy(false);
    }
  }

  async function addComponent(libraryId: string, areaId: string | null) {
    if (busy) return;
    setBusy(true);
    try {
      if (areaId) {
        const area = roofAreas.find(item => item.id === areaId);
        if (area?.is_locked) await onToggleAreaLock(areaId, false);
      }
      const created = await onAddFromLibrary(libraryId, areaId, 'main');
      if (created) {
        setNewComponentFocus(previous => ({ id: created.id, request: (previous?.request ?? 0) + 1 }));
      }
    } finally {
      setBusy(false);
    }
  }

  async function addComponentsBatch(libraryIds: string[], areaId: string | null) {
    if (!libraryIds.length) return;
    setBusy(true);
    try {
      if (areaId) {
        const area = roofAreas.find(item => item.id === areaId);
        if (area?.is_locked) await onToggleAreaLock(areaId, false);
      }
      if (onAddFromLibraryBatch) {
        const created = await onAddFromLibraryBatch(libraryIds, areaId, 'main');
        if (created.length) {
          setNewComponentFocus(previous => ({ id: created[created.length - 1].id, request: (previous?.request ?? 0) + 1 }));
        }
      } else {
        for (const id of libraryIds) await addComponent(id, areaId);
      }
    } finally {
      setBusy(false);
    }
  }

  async function finishArea() {
    if (!activeArea || activeComponents.length === 0 || busy) return;
    setBusy(true);
    try {
      await onToggleAreaLock(activeArea.id, true);
    } finally {
      setBusy(false);
    }
  }

  function startNewArea() {
    setCreatingArea(true);
    setUngroupedMode(false);
    setActiveAreaId(null);
    setRenameOpen(false);
  }

  function openArea(areaId: string) {
    setCreatingArea(false);
    setUngroupedMode(false);
    setActiveAreaId(areaId);
    setRenameOpen(false);
  }

  function openUngrouped() {
    setCreatingArea(false);
    setUngroupedMode(true);
    setActiveAreaId(null);
    setRenameOpen(false);
  }

  const completedAreas = roofAreas.filter(area => area.is_locked).length;
  const unfinishedAreas = roofAreas.filter(area => !area.is_locked);
  const nextUnfinishedArea = unfinishedAreas.find(area => area.id !== activeArea?.id) ?? null;
  const currentAreaCost = activeComponents.reduce((sum, component) => sum + componentCost(component), 0);

  return (
    <div className="qb-guided-shell" data-qc-guided="true">
      <div className="qb-guided-intro">
        <div>
          <p className="qb-eyebrow">Guided setup</p>
          <h2>Build the quote one work area at a time</h2>
          <p>
            A work area keeps related parts of the job together. Create one or more areas, then add the components,
            products or services that belong to each. Area measurements are optional, and you can return to any area to edit it.
          </p>
        </div>
        <div className="qb-guided-example-strip" aria-label="Work area examples">
          <span>Main building</span><span>Garage</span><span>Room</span><span>Exterior wall</span><span>Upper floor</span>
        </div>
      </div>

      <div className="qb-guided-layout">
        <aside className="qb-guided-outline" aria-label="Work areas">
          <div className="qb-guided-outline-head">
            <div>
              <span className="qb-guided-kicker">Job structure</span>
              <h3>Work areas</h3>
            </div>
            <QcButton size="sm" variant="ghost" onClick={startNewArea}>+ Add</QcButton>
          </div>

          <div className="qb-guided-area-list">
            {roofAreas.map((area, index) => {
              const areaComponents = mainComponents.filter(component => component.quote_roof_area_id === area.id);
              const areaCost = areaComponents.reduce((sum, component) => sum + componentCost(component), 0);
              const selected = !creatingArea && !ungroupedMode && area.id === activeAreaId;
              return (
                <button
                  type="button"
                  key={area.id}
                  className="qb-guided-area-nav"
                  data-selected={selected || undefined}
                  onClick={() => openArea(area.id)}
                >
                  <span className="qb-guided-area-index">{area.is_locked ? '✓' : index + 1}</span>
                  <span className="qb-guided-area-copy">
                    <strong>{area.label}</strong>
                    <small>
                      {areaComponents.length} {areaComponents.length === 1 ? 'component' : 'components'}
                      {Number(area.computed_sqm ?? 0) > 0 ? ` · ${formatArea(Number(area.computed_sqm), quote.measurement_system)}` : ''}
                    </small>
                  </span>
                  <span className="qb-guided-area-cost">{formatCurrency(areaCost, currency)}</span>
                </button>
              );
            })}

            {(ungroupedComponents.length > 0 || ungroupedMode) && (
              <button
                type="button"
                className="qb-guided-area-nav"
                data-selected={ungroupedMode || undefined}
                onClick={openUngrouped}
              >
                <span className="qb-guided-area-index">•</span>
                <span className="qb-guided-area-copy">
                  <strong>Whole job</strong>
                  <small>{ungroupedComponents.length} ungrouped {ungroupedComponents.length === 1 ? 'component' : 'components'}</small>
                </span>
              </button>
            )}
          </div>

          {roofAreas.length === 0 && !ungroupedMode && (
            <p className="qb-guided-outline-empty">Start by naming the first part of the job you want to price.</p>
          )}

          <div className="qb-guided-outline-note">
            <strong>Multiple areas are normal.</strong>
            <span>For example, a main building and garage can use different components but still finish on the same quote.</span>
          </div>
        </aside>

        <main className="qb-guided-editor">
          {creatingArea ? (
            <section className="qb-guided-create qc-surface">
              <div className="qb-guided-step-heading">
                <span className="qb-guided-step-number">1</span>
                <div>
                  <p className="qb-guided-kicker">Create a work area</p>
                  <h3>{roofAreas.length === 0 ? 'What part of the job are you pricing first?' : 'Add another work area'}</h3>
                  <p>
                    Use a name you will recognise later. Complete this area first, then add another if the job has separate parts or different materials.
                  </p>
                </div>
              </div>

              <div className="qb-guided-name-form">
                <label htmlFor={areaNameId} className="qc-label">Work area name</label>
                <div className="qb-inline-form">
                  <QcInput
                    id={areaNameId}
                    value={newAreaName}
                    onChange={event => setNewAreaName(event.target.value)}
                    placeholder="e.g. Main building, Garage, Kitchen, North wall"
                    className="qb-grow"
                    autoFocus
                    onKeyDown={event => { if (event.key === 'Enter') void createArea(); }}
                  />
                  <QcButton variant="primary" pending={busy} disabled={!newAreaName.trim()} onClick={() => void createArea()}>
                    Create work area →
                  </QcButton>
                </div>
              </div>

              <div className="qb-guided-concept">
                <div><strong>Main building</strong><span>Roofing · Gutters · Insulation</span></div>
                <div><strong>Garage</strong><span>Roofing · Flashings</span></div>
                <div><strong>Room</strong><span>Paint · Trim · Labour</span></div>
              </div>

              <div className="qb-guided-skip-area">
                <div>
                  <strong>Don't need work areas?</strong>
                  <span>You can add measurements and components directly to the whole quote instead.</span>
                </div>
                <QcButton variant="ghost" onClick={openUngrouped}>Price the whole job without areas</QcButton>
              </div>
            </section>
          ) : ungroupedMode ? (
            <section className="qb-guided-work-card qc-surface">
              <div className="qb-guided-work-head">
                <div>
                  <p className="qb-guided-kicker">Whole job</p>
                  <h3>Components without work areas</h3>
                  <p>Use this when the job does not need separate groups. You can still create work areas later.</p>
                </div>
                <QcButton size="sm" variant="ghost" onClick={startNewArea}>+ Create a work area</QcButton>
              </div>

              <section className="qb-guided-section">
                <div className="qb-guided-step-heading qb-guided-step-heading--compact">
                  <span className="qb-guided-step-number">1</span>
                  <div>
                    <h4>Add components, products or services</h4>
                    <p>Choose a saved Smart Component, then enter the measurement you already have.</p>
                  </div>
                </div>

      <AddFromLibrary
        library={libraryComponents.filter(component => component.component_type === 'main')}
        collections={collections}
        defaultCollectionId={defaultCollectionId}
        onAdd={libraryId => addComponent(libraryId, null)}
        onAddBatch={libraryIds => addComponentsBatch(libraryIds, null)}
                  onCreateNew={() => onCreateComponent(null, 'main')}
                  measurementSystem={quote.measurement_system}
                  label="Add to this quote"
                  placeholder="Choose a component, product or service..."
                  appearance="guided"
                />

                <div className="qb-guided-component-list">
                  {ungroupedComponents.length === 0 && <p className="qb-guided-empty-line">No components added yet.</p>}
                  {ungroupedComponents.map(component => (
                    <ExpandableComponent
                      key={component.id}
                      comp={component}
                      entries={entries[component.id] ?? []}
                      roofAreas={roofAreas}
                      quote={quote}
                      currency={currency}
                      onAddEntry={onAddEntry}
                      onRemoveEntry={onRemoveEntry}
                      onRemove={onRemoveComponent}
                      onUpdateSettings={onUpdateComponent}
                      onCombineEntries={onCombineEntries}
                      onSplitEntries={onSplitEntries}
                      assistantFocusRequest={newComponentFocus?.id === component.id ? newComponentFocus.request : 0}
                      appearance="guided"
                    />
                  ))}
                </div>
              </section>

              <div className="qb-guided-finish-row">
                <div><strong>Ready for the next step?</strong><span>You can come back and edit these measurements at any time.</span></div>
                <QcButton variant="primary" disabled={ungroupedComponents.length === 0} onClick={onContinue}>Continue to Extras →</QcButton>
              </div>
            </section>
          ) : activeArea ? (
            <section className="qb-guided-work-card qc-surface">
              <div className="qb-guided-work-head">
                <div className="min-w-0">
                  <div className="qb-guided-area-title-row">
                    <span className="qb-guided-kicker">Current work area</span>
                    {activeArea.is_locked && <QcStatusBadge tone="success">Area ready</QcStatusBadge>}
                  </div>
                  {renameOpen ? (
                    <div className="qb-guided-rename">
                      <QcInput
                        value={renameValue}
                        onChange={event => setRenameValue(event.target.value)}
                        onKeyDown={event => { if (event.key === 'Enter') void saveRename(); if (event.key === 'Escape') setRenameOpen(false); }}
                        autoFocus
                      />
                      <QcButton size="sm" variant="primary" pending={busy} onClick={() => void saveRename()}>Save</QcButton>
                      <QcButton size="sm" variant="ghost" onClick={() => setRenameOpen(false)}>Cancel</QcButton>
                    </div>
                  ) : (
                    <div className="qb-guided-title-actions">
                      <h3>{activeArea.label}</h3>
                      <QcButton size="sm" variant="ghost" onClick={() => { setRenameValue(activeArea.label); setRenameOpen(true); }}>Rename</QcButton>
                      <QcButton size="sm" variant="ghost" className="qc-icon-danger" onClick={() => onRemoveArea(activeArea.id)}>Remove</QcButton>
                    </div>
                  )}
                  <p>Keep the measurements and components for this part of the job together. You can edit anything here later.</p>
                </div>
                <div className="qb-guided-current-total">
                  <span>Area cost</span>
                  <strong>{formatCurrency(currentAreaCost, currency)}</strong>
                </div>
              </div>

              <section className="qb-guided-section">
                <div className="qb-guided-step-heading qb-guided-step-heading--compact">
                  <span className="qb-guided-step-number">1</span>
                  <div>
                    <h4>Area measurement <span className="qb-guided-optional">Optional</span></h4>
                    <p>Add a total area or calculate one from dimensions if it is useful. Leave this blank when each component has its own measurement.</p>
                  </div>
                </div>

                {activeArea.is_locked ? (
                  <div className="qb-guided-area-summary">
                    <div>
                      <span className="qb-guided-kicker">Saved area details</span>
                      <strong>{Number(activeArea.computed_sqm ?? 0) > 0 ? formatArea(Number(activeArea.computed_sqm), quote.measurement_system) : 'No area measurement'}</strong>
                      {activeArea.calc_pitch_degrees ? <small>Pitch / slope: {activeArea.calc_pitch_degrees}°</small> : null}
                    </div>
                    <QcButton size="sm" variant="ghost" onClick={() => void onToggleAreaLock(activeArea.id, false)}>Edit area details</QcButton>
                  </div>
                ) : (
                  <RoofAreaCard
                    area={activeArea}
                    entries={roofAreaEntries[activeArea.id] ?? []}
                    quote={quote}
                    onUpdate={onUpdateArea}
                    onToggleLock={onToggleAreaLock}
                    onAddEntry={onAddAreaEntry}
                    onRemoveEntry={onRemoveAreaEntry}
                    onRemove={onRemoveArea}
                    appearance="guided"
                    showHeading={false}
                    showCompletionAction={false}
                  />
                )}
              </section>

              <section className="qb-guided-section qb-guided-components-section">
                <div className="qb-guided-step-heading qb-guided-step-heading--compact">
                  <span className="qb-guided-step-number">2</span>
                  <div>
                    <h4>What belongs in {activeArea.label}?</h4>
                    <p>Add the components, products or services for this area, then enter the measurements you already have.</p>
                  </div>
                </div>

      <AddFromLibrary
        library={libraryComponents.filter(component => component.component_type === 'main')}
        collections={collections}
        defaultCollectionId={defaultCollectionId}
        onAdd={libraryId => addComponent(libraryId, activeArea.id)}
        onAddBatch={libraryIds => addComponentsBatch(libraryIds, activeArea.id)}
                  onCreateNew={() => { if (activeArea.is_locked) void onToggleAreaLock(activeArea.id, false); onCreateComponent(activeArea.id, 'main'); }}
                  measurementSystem={quote.measurement_system}
                  label={`Add to ${activeArea.label}`}
                  placeholder="Choose a component, product or service..."
                  appearance="guided"
                />

                <div className="qb-guided-component-list">
                  {activeComponents.length === 0 && (
                    <div className="qb-guided-empty-components">
                      <strong>No components here yet.</strong>
                      <span>Examples could be materials, labour, equipment, fixings or a service that belongs to this part of the job.</span>
                    </div>
                  )}
                  {activeComponents.map(component => (
                    <ExpandableComponent
                      key={component.id}
                      comp={component}
                      entries={entries[component.id] ?? []}
                      roofAreas={roofAreas}
                      roofArea={activeArea}
                      quote={quote}
                      currency={currency}
                      onAddEntry={onAddEntry}
                      onUseRoofArea={onUseRoofArea}
                      onRemoveEntry={onRemoveEntry}
                      onRemove={onRemoveComponent}
                      onUpdateSettings={onUpdateComponent}
                      onCombineEntries={onCombineEntries}
                      onSplitEntries={onSplitEntries}
                      assistantFocusRequest={newComponentFocus?.id === component.id ? newComponentFocus.request : 0}
                      appearance="guided"
                    />
                  ))}
                </div>
              </section>

              <div className="qb-guided-finish-row" data-ready={activeArea.is_locked || undefined}>
                {activeArea.is_locked ? (
                  <>
                    <div>
                      <strong>{activeArea.label} is ready.</strong>
                      <span>
                        {nextUnfinishedArea
                          ? `${nextUnfinishedArea.label} still needs finishing. Complete each work area before moving on.`
                          : 'Add another work area, continue to Extras, or choose any area on the left to edit it.'}
                      </span>
                    </div>
                    <div className="qb-guided-finish-actions">
                      {nextUnfinishedArea ? (
                        <QcButton variant="primary" onClick={() => openArea(nextUnfinishedArea.id)}>
                          Continue to {nextUnfinishedArea.label} →
                        </QcButton>
                      ) : (
                        <>
                          <QcButton variant="ghost" onClick={startNewArea}>+ Add another work area</QcButton>
                          <QcButton variant="primary" onClick={onContinue}>Continue to Extras →</QcButton>
                        </>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <strong>Finished with {activeArea.label}?</strong>
                      <span>{activeComponents.length === 0 ? 'Add at least one component first.' : 'Mark it ready. You can still return and edit it later.'}</span>
                    </div>
                    <QcButton variant="primary" pending={busy} disabled={activeComponents.length === 0} onClick={() => void finishArea()}>
                      Finish this work area →
                    </QcButton>
                  </>
                )}
              </div>
            </section>
          ) : null}
        </main>

        <aside className="qb-guided-summary">
          <QcMoneySummary
            audience="internal"
            title="Quote so far"
            rows={[
              { id: 'areas', label: 'Work areas', value: String(roofAreas.length) },
              { id: 'materials', label: 'Item cost', value: formatCurrency(totals.totalMaterials, currency) },
              { id: 'labour', label: 'Labour', value: formatCurrency(totals.totalLabour, currency) },
            ]}
            totalLabel="Quote total"
            total={formatCurrency(totals.grandTotal, currency)}
            note="Current pricing using the quote's saved margins. Final margins are checked in Review."
          />

          <div className="qb-guided-progress-card">
            <span className="qb-guided-kicker">Job progress</span>
            <strong>{completedAreas} of {roofAreas.length} work areas ready</strong>
            <div className="qb-guided-progress-track" aria-hidden="true">
              <span style={{ width: roofAreas.length ? `${Math.round((completedAreas / roofAreas.length) * 100)}%` : '0%' }} />
            </div>
            <p>You can return to any work area at any time. Nothing is locked permanently.</p>
          </div>

          <div className="qb-guided-how-card">
            <span className="qb-guided-kicker">How this works</span>
            <ol>
              <li><span>1</span><p><strong>Create a work area.</strong> This is a group such as a building, room, wall or section.</p></li>
              <li><span>2</span><p><strong>Add what belongs there.</strong> Attach components and enter their measurements.</p></li>
              <li><span>3</span><p><strong>Repeat if needed.</strong> Different areas can use completely different components on the same quote.</p></li>
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}
