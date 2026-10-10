'use client';
import { useEffect, useId, useRef, useState } from 'react';
import type { MeasurementSystem } from '@/app/lib/types';
import { QcDialog } from '@/app/components/ui/v2/QcDialog';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { QcIcon } from '@/app/components/ui/v2/QcIcon';
import { ComponentIdentityStep, type ComponentIdentityStepProps } from './ComponentIdentityStep';
import { GuidedIdentityIntroduction } from './GuidedIdentityIntroduction';
import { MeasurementIntroduction } from './MeasurementIntroduction';
import { ComponentMeasurementStep } from './ComponentMeasurementStep';
import { needsProductCode } from './identity-state';
import { measurementOption, requiresHeight, requiresDepth, type MeasurementFields, type NewMeasurementType } from './measurement-state';
import './guided-identity.css';
import './guided-measurement.css';
import { MaterialIntroduction } from './MaterialIntroduction';
import { ComponentMaterialStep } from './ComponentMaterialStep';
import { materialModes, type MaterialDraft } from './material-state';
import './guided-material.css';
import { LabourIntroduction } from './LabourIntroduction';
import { ComponentLabourStep } from './ComponentLabourStep';
import type { LabourDraft } from './labour-state';
import './guided-labour.css';
import { RulesIntroduction } from './RulesIntroduction';
import { ComponentRulesStep } from './ComponentRulesStep';
import type { RulesDraft } from './rules-state';
import type { ComponentEditorSettings } from '../SmartComponentEditor';
import './guided-rules.css';
import { TestIntroduction } from './TestIntroduction';
import { ComponentTestPanel } from '../ComponentTestPanel';
import type { ComponentTestDraft } from '../componentTest';
import './guided-test.css';
import { ReviewIntroduction } from './ReviewIntroduction';
import { ComponentFinalReview } from './ComponentFinalReview';
import './guided-review.css';

type Screen = 'identity-learn' | 'identity-input' | 'measurement-learn' | 'measurement-input' | 'material-learn' | 'material-input' | 'labour-learn' | 'labour-input' | 'rules-learn' | 'rules-input' | 'test-learn' | 'test-input' | 'review-learn' | 'review-input';
type Props = Omit<ComponentIdentityStepProps, 'onContinue' | 'onBack' | 'supplierSkuRequired' | 'onPendingChange' | 'onLibraryFormChange'> & {
  isSupplier?: boolean;
  measurement: MeasurementFields;
  onMeasurementChange: (patch: Partial<MeasurementFields>) => void;
  measurementSystem: MeasurementSystem;
  genericTradesEnabled: boolean;
  material: MaterialDraft;
  labour: LabourDraft;
  onLabourChange: (patch: Partial<LabourDraft>) => void;
  onMaterialChange: (patch: Partial<MaterialDraft>) => void;
  currency: string;
  settings: ComponentEditorSettings;
  onSettingsChange: (patch: Partial<ComponentEditorSettings>) => void;
  rules: RulesDraft;
  onRulesChange: (patch: Partial<RulesDraft>) => void;
  /** Direct save (production path): called by the final review step. */
  onGuidedSave: () => void | Promise<void>;
  guidedSaving?: boolean;
  guidedSaveError?: string | null;
  componentTypeLabel?: string;
  pitchVisible: boolean;
  pitchHidesValleyHip: boolean;
  pitchRafterLabel: string;
  pitchCheckboxLabel: string;
  onRequestClose: () => void;
  onUseQuickEditor: () => void;
};

/** Steps 1 and 2 share the existing editor draft. This dialog does not save a component. */
export function GuidedIdentityDialog({ onRequestClose, onUseQuickEditor, onGuidedSave, guidedSaving = false, guidedSaveError = null, componentTypeLabel = 'main', isSupplier = false, measurement, onMeasurementChange,
  measurementSystem, genericTradesEnabled, material, onMaterialChange, labour, onLabourChange, currency, settings, onSettingsChange, rules, onRulesChange, pitchVisible, pitchHidesValleyHip, pitchRafterLabel, pitchCheckboxLabel, ...identity }: Props) {
  const id = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [screen, setScreen] = useState<Screen>('identity-learn');
  const [measurementChosen, setMeasurementChosen] = useState(false);
  const [pending, setPending] = useState(false);
  const [libraryFormOpen, setLibraryFormOpen] = useState(false);
  const step = screen.startsWith('identity') ? 1 : screen.startsWith('measurement') ? 2 : screen.startsWith('material') ? 3 : screen.startsWith('labour') ? 4 : screen.startsWith('rules') ? 5 : screen.startsWith('review') ? 7 : 6;
  const isStep2 = step === 2;
  const title = screen === 'identity-learn' ? 'Start with what you know.' : screen === 'identity-input' ? 'What are you pricing?'
    : screen === 'measurement-learn' ? 'What do you measure on a job?' : screen === 'measurement-input' ? 'How do you measure this item?' : screen === 'material-learn' ? 'What do your materials cost?' : screen === 'material-input' ? 'Enter your material cost.' : screen === 'labour-learn' ? 'What does the labour cost?' : screen === 'labour-input' ? 'Enter your labour cost.' : screen === 'rules-learn' ? 'Do you need waste or pitch rules?' : screen === 'rules-input' ? 'Choose your pricing rules.' : screen === 'test-learn' ? 'Test your Smart Component™.' : screen === 'test-input' ? 'Try a measurement.' : screen === 'review-learn' ? 'Ready to save your component?' : 'Review your Smart Component™.';
  const description = screen === 'identity-learn' ? 'A quick explanation before you enter anything.' : screen === 'identity-input' ? 'Name your item, then choose a library.'
    : screen === 'measurement-learn' ? 'A measurement type tells Smart Components™ what amount to use when calculating your price.'
    : screen === 'measurement-input' ? 'Choose the amount you measure. You’ll add your prices next.' : screen === 'material-learn' ? 'You know your costs. Smart Components™ remember them.' : screen === 'material-input' ? 'Enter your material cost, or choose a roll or pack where supported.' : screen === 'labour-learn' ? 'Your time has a cost too.' : screen === 'labour-input' ? 'Enter your labour cost per measured unit.' : screen === 'rules-learn' ? 'Only use the adjustments your work needs.' : screen === 'rules-input' ? 'Choose your waste allowance and pitch settings, if needed.' : screen === 'test-learn' ? 'See how your own costs work on a real measurement.' : screen === 'test-input' ? 'Enter a measurement and check the calculated cost.' : screen === 'review-learn' ? 'One final check before you save.' : 'Check the details and add a note if you need one.';
  useEffect(() => {
    headingRef.current?.closest('dialog')?.scrollTo({ top: 0, behavior: 'auto' });
    headingRef.current?.focus({ preventScroll: true });
  }, [screen]);
  useEffect(() => { if (screen === 'material-input' && !materialModes(measurement.measurementType, genericTradesEnabled).includes(material.pricingStrategy)) onMaterialChange({ pricingStrategy: 'per_unit' }); }, [screen, measurement.measurementType, genericTradesEnabled, material.pricingStrategy]);
  const selectedLibrary = identity.libraries.find(library => library.id === identity.libraryId);
  const canSwitch = screen !== 'identity-learn';
  const [testCalculated, setTestCalculated] = useState(false);
  const testDraft: ComponentTestDraft = { name: identity.value.name, measurementType: measurement.measurementType,
    materialRate: material.materialRate, labourRate: labour.labourRate, wasteType: settings.wasteType,
    wasteAmount: rules.wasteAmount, pitchType: settings.pitchEnabled ? rules.pitchType : 'none',
    strategy: material.pricingStrategy, packPrice: material.packPrice, packSize: material.packSize,
    packCoverage: settings.packCoverage, heightMm: measurement.heightMm, depthMm: measurement.depthMm,
    timeUnit: measurement.hoursUnit, soldBy: settings.soldBy, coverWidthMm: settings.coverWidthMm };
  const selected = screen === 'review-input' ? measurementOption(measurement.measurementType as NewMeasurementType, measurementSystem, measurement.hoursUnit) : null;
  return <QcDialog open size="lg" labelledBy={`${id}-title`} initialFocusRef={headingRef}
    className="qc-identity-dialog" pending={pending} onRequestClose={onRequestClose}>
    <div className="qc-guided-identity" data-guided-screen={screen}>
      <div className="qc-identity-topbar"><div className="qc-identity-topbar-label"><span className="qc-identity-topbar-icon"><QcIcon name="assistant" /></span>
        <div><span className="qc-identity-eyebrow">GUIDED SETUP</span><strong>Smart Component<sup>™</sup></strong></div></div>
        <div className="qc-identity-progress" aria-label={`Step ${step} of 7`}><span><b>{String(step).padStart(2,'0')}</b> / 07</span>
          <div aria-hidden="true">{Array.from({ length: 7 }, (_, index) => <i key={index} data-current={index === step - 1 || undefined} data-complete={index < step - 1 || undefined} />)}</div>
        </div>
        <QcButton className="qc-identity-close" disabled={pending || guidedSaving} aria-label="Close guided setup" onClick={onRequestClose}><QcIcon name="close" /></QcButton>
      </div>
      <header className="qc-identity-header"><div><p className="qc-identity-eyebrow">{step === 1 ? 'STEP 1 · NAME & LIBRARY' : step === 2 ? 'STEP 2 · MEASUREMENT TYPE' : step === 3 ? 'STEP 3 · MATERIAL COST' : step === 4 ? 'STEP 4 · LABOUR COST' : step === 5 ? 'STEP 5 · WASTE & PITCH' : screen.startsWith('review') ? 'STEP 7 · REVIEW & SAVE' : 'STEP 6 · TEST YOUR COMPONENT'}</p>
        <h2 ref={headingRef} tabIndex={-1} id={`${id}-title`}>{title}</h2>
        <p>{description}</p></div>
        {canSwitch && screen !== 'review-input' && <button type="button" disabled={pending || libraryFormOpen} title={libraryFormOpen ? 'Finish or cancel the new library first.' : undefined}
          className="qc-guided-text-link qc-identity-quick-link" onClick={onUseQuickEditor}>Use quick editor</button>}
      </header>
      {screen === 'identity-learn' && <GuidedIdentityIntroduction onBack={onRequestClose} onNext={() => setScreen('identity-input')} />}
      {screen === 'identity-input' && <ComponentIdentityStep {...identity} onPendingChange={setPending} onLibraryFormChange={setLibraryFormOpen}
        supplierSkuRequired={needsProductCode(isSupplier, identity.libraries, identity.libraryId)} onBack={() => setScreen('identity-learn')}
        onContinue={value => { identity.onChange(value); setScreen('measurement-learn'); }} />}
      {screen === 'measurement-learn' && <MeasurementIntroduction system={measurementSystem} onBack={() => setScreen('identity-input')} onNext={() => setScreen('measurement-input')} />}
      {screen === 'measurement-input' && <ComponentMeasurementStep value={measurement} chosen={measurementChosen} componentName={identity.value.name}
        measurementSystem={measurementSystem} genericTradesEnabled={genericTradesEnabled} onChange={onMeasurementChange}
        onChoose={() => setMeasurementChosen(true)} onBack={() => setScreen('measurement-learn')} onContinue={() => setScreen('material-learn')} />}
      {screen === 'material-learn' && <MaterialIntroduction onBack={() => setScreen('measurement-input')} onNext={() => setScreen('material-input')} />}
      {screen === 'material-input' && <ComponentMaterialStep value={material} onChange={onMaterialChange}
        measurementType={measurement.measurementType} unit={measurementOption(measurement.measurementType as NewMeasurementType, measurementSystem, measurement.hoursUnit).unit}
        currency={currency} genericTradesEnabled={genericTradesEnabled} onBack={() => setScreen('material-learn')} onContinue={() => setScreen('labour-learn')} />}
      {screen === 'labour-learn' && <LabourIntroduction onBack={() => setScreen('material-input')} onNext={() => setScreen('labour-input')} />}
      {screen === 'labour-input' && <ComponentLabourStep value={labour} onChange={onLabourChange}
        unit={measurementOption(measurement.measurementType as NewMeasurementType, measurementSystem, measurement.hoursUnit).unit}
        currency={currency} onBack={() => setScreen('labour-learn')} onContinue={() => setScreen('rules-learn')} />}
      {screen === 'rules-learn' && <RulesIntroduction pitchVisible={pitchVisible} onBack={() => setScreen('labour-input')} onNext={() => setScreen('rules-input')} />}
      {screen === 'rules-input' && <ComponentRulesStep settings={settings} onSettingsChange={onSettingsChange} value={rules} onChange={onRulesChange}
        unit={measurementOption(measurement.measurementType as NewMeasurementType, measurementSystem, measurement.hoursUnit).unit}
        pitchVisible={pitchVisible} pitchHidesValleyHip={pitchHidesValleyHip} pitchRafterLabel={pitchRafterLabel} pitchCheckboxLabel={pitchCheckboxLabel}
        onBack={() => setScreen('rules-learn')} onContinue={() => { setTestCalculated(false); setScreen('test-learn'); }} />}
      {screen === 'test-learn' && <TestIntroduction onBack={() => setScreen('rules-input')} onNext={() => setScreen('test-input')} />}
      {screen === 'test-input' && <div className="qc-guided-test-stage">
        <ComponentTestPanel draft={testDraft} measurementSystem={measurementSystem} currency={currency} onCalculated={() => setTestCalculated(true)} />
        <footer className="qc-identity-footer"><QcButton onClick={() => setScreen('test-learn')}><QcIcon name="back" />Back</QcButton>
          <QcButton variant="primary" className="qc-identity-glint" disabled={!testCalculated} onClick={() => setScreen('review-learn')}>Continue<QcIcon name="arrow" /></QcButton>
        </footer><p className="qc-material-hint">Calculate at least once to continue. This is a test only.</p></div>}
      {screen === 'review-learn' && <ReviewIntroduction onBack={() => setScreen('test-input')} onNext={() => setScreen('review-input')} />}
      {screen === 'review-input' && selected && <ComponentFinalReview
        name={identity.value.name} notes={settings.notes ?? ''} onNotesChange={notes => onSettingsChange({notes})}
        saving={guidedSaving} error={guidedSaveError} componentTypeLabel={componentTypeLabel}
        rows={[
          {label:'Library',value:selectedLibrary?.name || 'My Components'},
          ...(identity.value.sku ? [{label:'Product code',value:identity.value.sku}] : []),
          {label:'Measurement',value:selected.editorLabel},
          {label:'Material cost',value:material.pricingStrategy === 'per_unit' ? `${currency}${material.materialRate} per ${selected.unit}` : `${currency}${material.packPrice} per pack (${material.packSize} units)`},
          {label:'Labour cost',value:`${currency}${labour.labourRate} per ${selected.unit}`},
          {label:'Waste',value:settings.wasteType === 'none' ? 'None' : `${rules.wasteAmount}${settings.wasteType === 'percent' ? '%' : ` ${selected.unit}`}`},
          {label:'Pitch',value:settings.pitchEnabled ? (rules.pitchType === 'valley_hip' ? 'Valley / hip pitch' : pitchRafterLabel) : 'None'},
          ...(requiresHeight(measurement.measurementType) ? [{label:'Set height',value:`${measurement.heightMm} mm`}] : []),
          ...(requiresDepth(measurement.measurementType) ? [{label:'Set depth',value:`${measurement.depthMm} mm`}] : []),
        ]}
        onBack={() => setScreen('review-learn')} onSave={onGuidedSave} />}
    </div>
  </QcDialog>;
}
