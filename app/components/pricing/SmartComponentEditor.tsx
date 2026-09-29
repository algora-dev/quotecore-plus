'use client';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type { ComponentType, MeasurementSystem, MeasurementType, PitchType, PricingStrategy, WasteType, WasteUnit, FlashingLibraryRow } from '@/app/lib/types';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { QcField, QcInput, QcSelect } from '@/app/components/ui/v2/QcField';
import { QcIcon } from '@/app/components/ui/v2/QcIcon';
import { canonicalUnit, type ComponentTestDraft } from './componentTest';
import { ComponentTestPanel } from './ComponentTestPanel';
import { buildMeasurementLabels, allowedStrategiesFor, ROOFING_DEFAULT_TYPES } from '@/app/(auth)/[workspaceSlug]/components/parts/helpers';
import './pricing-activation.css';

export interface ComponentEditorSettings {
  measurementType: MeasurementType; wasteType: WasteType; pitchEnabled: boolean;
  pricingStrategy: PricingStrategy; packPrice: string; packSize: string; packCoverage: string;
  heightMm: string; depthMm: string; hoursUnit: 'hr' | 'day'; wasteUnit: WasteUnit; notes: string;
}
export interface ComponentEditorInitial {
  name: string; sku: string; componentType: ComponentType; materialRate: string; labourRate: string;
  wasteAmount: string; pitchType: PitchType; eligibleForOrders: boolean;
  /** Stored values needed when generic-trades controls are gated off. */
  storedStrategy?: PricingStrategy; storedPackPrice?: string; storedPackSize?: string; storedPackCoverage?: string;
  storedHeightMm?: string; storedDepthMm?: string;
}
interface Props {
  mode: 'create' | 'edit'; initial: ComponentEditorInitial; settings: ComponentEditorSettings;
  onSettingsChange: (patch: Partial<ComponentEditorSettings>) => void;
  measurementSystem: MeasurementSystem; currency: string; genericTradesEnabled: boolean;
  pitchVisible: boolean; pitchHidesValleyHip: boolean; pitchRafterLabel: string; pitchCheckboxLabel: string;
  collections: { id: string; name: string; is_bootstrap: boolean }[]; selectedCollectionId: string;
  onCollectionChange: (value: string) => void;
  flashings: FlashingLibraryRow[]; assignedFlashings: string[]; selectedFlashingId: string;
  onFlashingSelection: (id: string) => void; onAddFlashing: () => void; onRemoveFlashing: (id: string) => void;
  imageHelperText: string; supplierSkuRequired: boolean; saving: boolean; error: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>; onCancel: () => void;
  onDirty: () => void; onCalculated?: () => void; onCopy?: (initial: ComponentEditorInitial) => void;
  openTestInitially?: boolean; testRequest?: number; learning?: boolean;
}
export function SmartComponentEditor(props: Props) {
  const { initial, settings: s, onSettingsChange: set, mode, saving, genericTradesEnabled } = props;
  const id = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const testButtonRef = useRef<HTMLButtonElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const [name, setName] = useState(initial.name);
  const [sku, setSku] = useState(initial.sku);
  const [componentType, setComponentType] = useState(initial.componentType);
  const [materialRate, setMaterialRate] = useState(initial.materialRate);
  const [labourRate, setLabourRate] = useState(initial.labourRate);
  const [wasteAmount, setWasteAmount] = useState(initial.wasteAmount);
  const [pitchType, setPitchType] = useState<PitchType>(initial.pitchType === 'none' ? 'rafter' : initial.pitchType);
  const [eligible, setEligible] = useState(initial.eligibleForOrders);
  const [testOpen, setTestOpen] = useState(!!props.openTestInitially);
  const [testRequested, setTestRequested] = useState(false);
  const [testOpened, setTestOpened] = useState(!!props.openTestInitially);
  const [mobileView, setMobileView] = useState<'settings' | 'test'>(props.openTestInitially ? 'test' : 'settings');
  function showTest() { setTestOpened(true); setTestOpen(true); setTestRequested(true); setMobileView('test'); }
  useEffect(() => {
    // The parent may request opening the tester after the editor has mounted.
    // This is an intentional synchronization from an external request prop.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (props.testRequest) { setTestOpened(true); setTestOpen(true); setTestRequested(true); setMobileView('test'); }
  }, [props.testRequest]);
  function closeTest() {
    setTestOpen(false); setMobileView('settings');
    requestAnimationFrame(() => {
      const target = testButtonRef.current?.offsetParent ? testButtonRef.current : settingsButtonRef.current;
      target?.focus({ preventScroll: true });
    });
  }
  function showSettings() {
    setMobileView('settings');
    requestAnimationFrame(() => settingsButtonRef.current?.scrollIntoView({ block: 'nearest', behavior: 'auto' }));
  }
  const labels = buildMeasurementLabels(props.measurementSystem);
  const unit = canonicalUnit(s.measurementType, s.hoursUnit);
  const strategy = genericTradesEnabled ? s.pricingStrategy : initial.storedStrategy ?? 'per_unit';
  const packPricing = strategy !== 'per_unit';
  const gatedPack = !genericTradesEnabled && packPricing;
  const purchaseUnit = strategy === 'per_pack_length' ? 'm' : strategy === 'per_pack_volume' ? 'm³' : 'm²';
  const draft: ComponentTestDraft = { name, measurementType: s.measurementType, materialRate, labourRate,
    wasteType: s.wasteType, wasteAmount, pitchType: s.pitchEnabled ? pitchType : 'none', strategy,
    packPrice: genericTradesEnabled ? s.packPrice : initial.storedPackPrice ?? '',
    packSize: genericTradesEnabled ? s.packSize : initial.storedPackSize ?? '',
    packCoverage: genericTradesEnabled ? s.packCoverage : initial.storedPackCoverage ?? '',
    heightMm: genericTradesEnabled ? s.heightMm : initial.storedHeightMm ?? '',
    depthMm: genericTradesEnabled ? s.depthMm : initial.storedDepthMm ?? '', timeUnit: s.hoursUnit };
  useEffect(() => { headingRef.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => { if (props.error) headingRef.current?.scrollIntoView({ block: 'nearest' }); }, [props.error]);
  const numberField = (key: string, label: string, value: string, update: (value: string) => void, options?: { name?: string; help?: string; step?: string }) => (
    <QcField htmlFor={`${id}-${key}`} label={label} help={options?.help} helpId={options?.help ? `${id}-${key}-help` : undefined}>
      <QcInput id={`${id}-${key}`} name={options?.name} type="number" inputMode="decimal" step={options?.step ?? '0.01'} value={value}
        placeholder="0" aria-describedby={options?.help ? `${id}-${key}-help` : undefined} onChange={e => update(e.target.value)} />
    </QcField>
  );
  const copyInitial = (): ComponentEditorInitial => ({ ...initial, name: `${name || 'Component'} (copy)`, sku: '', componentType,
    materialRate, labourRate, wasteAmount, pitchType: s.pitchEnabled ? pitchType : 'none', eligibleForOrders: eligible });
  return <section className="qc-component-editor" data-mobile-view={mobileView} data-qc-ui="v2" data-qc-component="C69" aria-labelledby={`${id}-title`}>
    <header className="qc-pricing-editor-header"><div><p className="qc-eyebrow">Your reusable pricing</p>
      <h2 id={`${id}-title`} ref={headingRef} tabIndex={-1}>{mode === 'create' ? 'Create a Smart Component' : name || 'Edit Smart Component'}</h2>
      <p>Define it once. Add a measurement to use it on a job.</p></div>
      <QcButton ref={testButtonRef} className="qc-pricing-desktop-test-toggle" variant={testOpen ? 'ghost' : 'secondary'} disabled={saving} aria-expanded={testOpen} aria-controls={`${id}-test`} onClick={() => { if (testOpen) closeTest(); else showTest(); }}>
        <QcIcon name="pricing" />{testOpen ? 'Hide test' : 'Test component'}
      </QcButton>
    </header>
    <div className="qc-pricing-mobile-tabs" role="group" aria-label="Component workspace">
      <QcButton ref={settingsButtonRef} aria-pressed={mobileView === 'settings'} aria-controls={`${id}-settings`} disabled={saving} onClick={showSettings}>Settings</QcButton>
      <QcButton aria-pressed={mobileView === 'test'} aria-controls={`${id}-test`} disabled={saving} onClick={showTest}>Test component</QcButton>
    </div>
    {props.error && <div className="qc-pricing-error" role="alert">{props.error}</div>}
    {props.learning && <div className="qc-pricing-callout"><strong>Learn with an example, then use your own costs.</strong> Starter prices and settings are examples, not recommendations. Replace the costs and check the rules before using them in a real quote.</div>}
    <form aria-busy={saving || undefined} onSubmit={props.onSubmit} onChange={event => {
      if (!(event.target as HTMLElement).closest('[data-qc-component="C70"]')) props.onDirty();
    }}>
      <fieldset disabled={saving} className="qc-pricing-fieldset">
      <div className="qc-pricing-editor-grid" data-test-open={testOpen}>
        <div id={`${id}-settings`} className="qc-pricing-fields">
          <section className="qc-pricing-section" aria-labelledby={`${id}-identity`}>
            <header><span>1</span><div><h3 id={`${id}-identity`}>What are you pricing?</h3><p>A product, service or charge you can recognise later.</p></div></header>
            <div className="qc-pricing-fields-grid">
              <div data-copilot="component-name"><QcField htmlFor={`${id}-name`} label="Component name" help="What you will see in the app and pricing outputs" helpId={`${id}-name-help`}><QcInput id={`${id}-name`} name="name" required value={name} placeholder="e.g. Roofing underlay" aria-describedby={`${id}-name-help`} onChange={e => setName(e.target.value)} /></QcField></div>
              <div data-copilot="component-sku"><QcField htmlFor={`${id}-sku`} label={`Product code / SKU${props.supplierSkuRequired ? ' (required for publishing)' : ' (optional)'}`} help={mode === 'edit' && initial.sku ? 'An existing product code cannot be changed.' : undefined}>
                <QcInput id={`${id}-sku`} name="sku" value={sku} readOnly={mode === 'edit' && !!initial.sku} onChange={e => setSku(e.target.value)} placeholder="Your reference code" />
              </QcField></div>
              {mode === 'create' && <div data-copilot="component-type"><QcField htmlFor={`${id}-type`} label="Used as" help="Main items form the job. Extras cover additional work or charges."><QcSelect id={`${id}-type`} name="component_type" value={componentType} onChange={e => setComponentType(e.target.value as ComponentType)}>
                <option value="main">Main component</option><option value="extra">Extra</option></QcSelect></QcField></div>}
              <div data-copilot="component-measurement"><QcField htmlFor={`${id}-measurement`} label="How do you measure it?" help="Choose what you enter on a job. Purchasing is set separately below.">
                <QcSelect id={`${id}-measurement`} name="measurement_type" value={s.measurementType} onChange={e => set({ measurementType: e.target.value as MeasurementType })}>
                  {(Object.entries(labels) as [MeasurementType, string][]).filter(([key]) => key === s.measurementType ||
                    (!['linear', 'count', 'curved_line', 'irregular_area'].includes(key) && (genericTradesEnabled || ROOFING_DEFAULT_TYPES.has(key))))
                    .map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </QcSelect>
              </QcField></div>
              {genericTradesEnabled && ['length_x_height', 'multi_lineal_lxh'].includes(s.measurementType) && numberField('height', 'Preset height (mm)', s.heightMm, value => set({ heightMm: value }), { step: '1', help: 'Measured length × this height gives the priced area.' })}
              {genericTradesEnabled && s.measurementType === 'volume' && numberField('depth', 'Preset depth (mm)', s.depthMm, value => set({ depthMm: value }), { step: '1', help: 'Measured area × this depth gives the priced volume.' })}
              {genericTradesEnabled && s.measurementType === 'hours_days' && <QcField htmlFor={`${id}-time`} label="Time unit for this test" help="Keep your quoted time and rate on the same basis. This display choice does not convert rates."><QcSelect id={`${id}-time`} value={s.hoursUnit} onChange={e => set({ hoursUnit: e.target.value as 'hr' | 'day' })}><option value="hr">Hours</option><option value="day">Days</option></QcSelect></QcField>}
            </div>
          </section>
          <section className="qc-pricing-section" aria-labelledby={`${id}-costs`}>
            <header><span>2</span><div><h3 id={`${id}-costs`}>What does it cost you?</h3><p>Enter your business costs in {props.currency}. Quote margins and tax are added later.</p></div></header>
            {/* Existing storage is canonical metric. Never relabel raw rates as imperial. */}
            {props.measurementSystem !== 'metric' && <p className="qc-pricing-callout">Pricing settings use {unit}. You can enter your test measurement in your preferred units; QuoteCore converts that measurement before calculating.</p>}
            <div className="qc-pricing-fields-grid">
              {genericTradesEnabled && <QcField htmlFor={`${id}-strategy`} label="How do you buy the material?">
                <QcSelect id={`${id}-strategy`} value={s.pricingStrategy} onChange={e => set({ pricingStrategy: e.target.value as PricingStrategy })}>
                  {[...allowedStrategiesFor(s.measurementType), ...(s.pricingStrategy === 'per_pack_coverage' ? ['per_pack_coverage' as PricingStrategy] : [])].map(value => <option key={value} value={value}>{value === 'per_unit' ? `Per ${unit}` : value === 'per_pack_coverage' ? 'By coverage per pack (existing)' : 'Whole rolls, packs or fixed quantities'}</option>)}
                </QcSelect>
              </QcField>}
              {(!genericTradesEnabled || !packPricing) && <div data-copilot="component-rates">{numberField('material', `Material cost per ${unit} (${props.currency})`, materialRate, setMaterialRate, { name: 'default_material_rate', help: gatedPack ? 'This saved component uses its pack price below, not this unit rate.' : 'Enter 0 for a labour-only component.' })}</div>}
              {genericTradesEnabled && packPricing && <>
                <input type="hidden" name="default_material_rate" value="0" />
                {numberField('pack-price', `Price per roll / pack (${props.currency})`, s.packPrice, value => set({ packPrice: value }))}
                {numberField('pack-size', `Amount in one roll / pack (${strategy === 'per_pack_coverage' ? 'pack units' : purchaseUnit})`, s.packSize, value => set({ packSize: value }), { help: strategy === 'per_pack_length' ? 'For example, 20 for a 20 m roll. Purchases round up to whole rolls.' : strategy === 'per_pack_volume' ? 'For example, 5 for a 5 m³ load. Purchases round up to whole units.' : strategy === 'per_pack_coverage' ? 'Keep the saved pack size. Coverage below determines the amount purchased.' : 'For example, 50 for a roll that covers 50 m². Purchases round up to whole packs.' })}
                {strategy === 'per_pack_coverage' && numberField('coverage', 'Coverage per pack (m²)', s.packCoverage, value => set({ packCoverage: value }))}
              </>}
              <div data-copilot="component-labour">{numberField('labour', `Labour cost per ${unit} (${props.currency})`, labourRate, setLabourRate, { name: 'default_labour_rate', help: 'Enter 0 when no labour applies. Labour uses the quantity after allowances.' })}</div>
            </div>
            {gatedPack && <p className="qc-pricing-callout">Saved pack settings are used in the test: {initial.storedPackSize} {purchaseUnit} per pack, {initial.storedPackPrice} {props.currency}. Pack editing is disabled by this workspace configuration.</p>}
          </section>
          <section className="qc-pricing-section" aria-labelledby={`${id}-rules`}>
            <header><span>3</span><div><h3 id={`${id}-rules`}>What allowances apply?</h3><p>Leave these off when they do not apply.</p></div></header>
            <div className="qc-pricing-fields-grid">
              <div data-copilot="component-waste"><QcField htmlFor={`${id}-waste`} label="Waste allowance"><QcSelect id={`${id}-waste`} name="default_waste_type" value={s.wasteType} onChange={e => set({ wasteType: e.target.value as WasteType })}>
                <option value="none">No waste</option><option value="percent">Percentage of measurement</option><option value="fixed">Fixed amount per entry</option><option value="fixed_per_segment">Fixed amount per segment</option>
              </QcSelect></QcField></div>
              {s.wasteType !== 'none' && <div data-copilot="component-waste-amount">{numberField('waste-amount', `Allowance (${s.wasteType === 'percent' ? '%' : unit})`, wasteAmount, setWasteAmount, { name: 'waste_amount', help: s.wasteType === 'percent' ? 'For example, 10 adds 10% to the measurement.' : 'The test shows the allowance added to each manual entry.' })}</div>}
            </div>
            {(props.pitchVisible || s.pitchEnabled) && <div className="qc-pricing-pitch" data-copilot="component-pitch">
              <label className="qc-pricing-check"><input id={`${id}-pitch-enabled`} type="checkbox" checked={s.pitchEnabled} onChange={e => set({ pitchEnabled: e.target.checked })} />{props.pitchCheckboxLabel}</label>
              {s.pitchEnabled && <div data-copilot="component-pitch-type"><QcField htmlFor={`${id}-pitch-type`} label="Pitch rule" help="In the test, choose a plan measurement to apply this rule, or an already-measured surface to skip it."><QcSelect id={`${id}-pitch-type`} name="default_pitch_type" value={pitchType} onChange={e => setPitchType(e.target.value as PitchType)}>
                <option value="rafter">{props.pitchRafterLabel}</option>{(!props.pitchHidesValleyHip || pitchType === 'valley_hip') && <option value="valley_hip">Valley / hip pitch</option>}
              </QcSelect></QcField></div>}
            </div>}
          </section>
          <details className="qc-pricing-details"><summary>Notes, images & material orders <span>{props.assignedFlashings.length ? `${props.assignedFlashings.length} image(s)` : 'Optional'}</span></summary><div>
            <div data-copilot="component-flashings"><label className="qc-pricing-check"><input name="eligible_for_orders" type="checkbox" checked={eligible} onChange={e => setEligible(e.target.checked)} /> Include in material orders</label>
              <p className="qc-pricing-muted">{props.imageHelperText}</p>
              <QcField htmlFor={`${id}-image`} label="Attach an existing image"><div className="qc-pricing-inline">
                <QcSelect id={`${id}-image`} value={props.selectedFlashingId} onChange={e => props.onFlashingSelection(e.target.value)}><option value="">Select an image</option>{props.flashings.map(image => <option key={image.id} value={image.id}>{image.name}{image.description ? ` - ${image.description}` : ''}</option>)}</QcSelect>
                <QcButton disabled={!props.selectedFlashingId} onClick={() => { props.onDirty(); props.onAddFlashing(); }}>Add</QcButton>
              </div></QcField>
              {props.assignedFlashings.map(imageId => <div className="qc-pricing-attached" key={imageId}><span>{props.flashings.find(image => image.id === imageId)?.name || 'Assigned image'}</span><QcButton size="sm" onClick={() => { props.onDirty(); props.onRemoveFlashing(imageId); }} aria-label={`Remove ${props.flashings.find(image => image.id === imageId)?.name || 'assigned image'}`}>Remove</QcButton></div>)}
            </div>
            <QcField htmlFor={`${id}-notes`} label="Notes (optional)" help="Usage tips for your team. Up to 500 characters."><textarea id={`${id}-notes`} className="qc-input" value={s.notes} maxLength={500} rows={3} onChange={e => set({ notes: e.target.value })} /></QcField>
          </div></details>
          {props.collections.length > 0 && <QcField htmlFor={`${id}-library`} label="Save to library" help="Add to an existing library or create a new library" helpId={`${id}-library-help`}><QcSelect id={`${id}-library`} value={props.selectedCollectionId} aria-describedby={`${id}-library-help`} onChange={e => props.onCollectionChange(e.target.value)}>
            {props.collections.map(collection => <option key={collection.id} value={collection.id}>{collection.name}{collection.is_bootstrap ? ' (default)' : ''}</option>)}<option value="__create_new__">+ Create new library</option>
          </QcSelect></QcField>}
        </div>
        {testOpened && <div id={`${id}-test`} className="qc-pricing-test-column" hidden={!testOpen}><ComponentTestPanel key={s.measurementType} draft={draft} measurementSystem={props.measurementSystem} currency={props.currency}
          focusOnMount={testRequested && testOpen} onCalculated={props.onCalculated} onClose={closeTest} /></div>}
      </div>
      <div className="qc-pricing-mobile-test-footer"><QcButton variant="secondary" onClick={showSettings}>Adjust component settings</QcButton><p>Return to settings to save. Your test stays here while you make changes.</p></div>
      <footer className="qc-pricing-editor-footer" data-copilot="component-save"><div><QcButton variant="primary" type="submit" pending={saving}>{saving ? 'Saving...' : 'Save component'}</QcButton><QcButton disabled={saving} onClick={props.onCancel}>Cancel</QcButton></div>
        {mode === 'edit' && props.onCopy && !gatedPack && <QcButton disabled={saving} onClick={() => props.onCopy?.(copyInitial())}>Use these settings for a new component</QcButton>}
        <p>Testing does not save. Save explicitly when your settings are ready.</p>
      </footer>
      </fieldset>
    </form>
  </section>;
}
