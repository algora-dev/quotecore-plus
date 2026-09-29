"use client";
import { useState, useRef, useEffect, useId } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { QcJourney } from '@/app/components/ui/v2/QcJourney';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { QcInput, QcSelect } from '@/app/components/ui/v2/QcField';
import { QcDialog } from '@/app/components/ui/v2/QcDialog';
import { QcHostedDialogScope } from '@/app/components/ui/v2/QcHostedDialog';
import { MeasurementChoiceCards } from '@/app/components/quote-entry/MeasurementChoiceCards';
import { entryModeFromHint, quoteJourneyDestination, type QuoteEntryMode } from '@/app/components/quote-entry/quoteJourney';
import { createQuoteWithDetails } from './actions';
import { FileUploader } from '@/app/components/FileUploader';
import { usePdfPagePicker } from '@/app/components/PdfPagePicker';
import { createClient } from '@/app/lib/supabase/client';
import { saveFileMetadata } from '@/app/lib/files/storage-actions';
import { mintQuoteDocumentUploadUrl } from '@/app/lib/files/signed-upload';
import { UpgradeModal } from '@/app/components/UpgradeModal';
import '@/app/components/quote-entry/quote-entry.css';

type MeasurementChoice = 'metric' | 'imperial_ft' | 'imperial_rs';
type CreateParams = Parameters<typeof createQuoteWithDetails>[0];
interface Template { id: string; name: string; description: string | null }
interface PendingPlan {
  fileName: string; fileSize: number; mimeType: string; bucket: string; tempPath: string;
}
export interface QuoteDetailsFormProps {
  workspaceSlug: string; templates: Template[]; templatesLoadError?: boolean; companyId: string;
  defaultMeasurementSystem: MeasurementChoice; digitalTakeoffAvailable: boolean;
  monthlyQuoteAtCap: boolean; monthlyQuoteUsed: number; monthlyQuoteLimit: number;
  effectivePlanCode: string; defaultTrade?: string;
  componentCollections?: Array<{ id: string; name: string; is_bootstrap: boolean }>;
  isOverStorage?: boolean;
  /** Existing measure-first contract: job required, customer optional/falls back to job. */
  context?: 'quote' | 'measure';
  onCancel?: () => void;
  /** Host must stay mounted while working or while a nested dialog owns Escape. */
  onPendingChange?: (pending: boolean) => void;
}
const MEASUREMENT_OPTIONS: Array<{ value: MeasurementChoice; title: string; subtitle: string }> = [
  { value: 'metric', title: 'Metric', subtitle: 'Metres & m²' },
  { value: 'imperial_ft', title: 'Imperial', subtitle: 'Feet & ft²' },
  { value: 'imperial_rs', title: 'Roofing squares', subtitle: 'Feet & RS' },
];
// Preserve the complete existing Generic Trades option set. No defaulting logic
// moves here: the existing creation action is still the final authority.
const TRADES = ['generic', 'roofing', 'cladding', 'electrical', 'landscaping', 'concrete', 'plumbing', 'flooring', 'tiling', 'foundations', 'insulation', 'painting', 'fencing', 'construction', 'solar'];
const isBillingMessage = (message: string) => /quote_limit_reached|feature_gated|subscription_inactive|storage_quota_exceeded|monthly quote limit|requires "/i.test(message);

/** One entry controller used by New Quote and the existing measure-first shortcut.
 * Same creation/upload/actions; no quote written until the explicit primary action.
 * Acquisition is separate from future assistance. No new persisted fields.
 */
export function QuoteDetailsForm({ workspaceSlug, templates, templatesLoadError = false, companyId,
  defaultMeasurementSystem, digitalTakeoffAvailable, monthlyQuoteAtCap, monthlyQuoteUsed,
  monthlyQuoteLimit, effectivePlanCode, defaultTrade = 'roofing', componentCollections = [],
  isOverStorage, context = 'quote', onCancel, onPendingChange }: QuoteDetailsFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pdfPicker = usePdfPagePicker();
  const id = useId();
  const measureFirst = context === 'measure';
  const genericTradesEnabled = (process.env.NEXT_PUBLIC_GENERIC_TRADES_V1 ?? '').toLowerCase() === 'true';
  const validTemplate = templates.find(t => t.id === searchParams.get('template'))?.id ?? '';
  const [templateId, setTemplateId] = useState(measureFirst ? '' : validTemplate);
  const [entryMode, setEntryMode] = useState<QuoteEntryMode | null>(() => {
    if (measureFirst) return 'digital';
    if (validTemplate) return 'manual';
    const hint = entryModeFromHint(searchParams.get('measurements'));
    return hint === 'digital' && !digitalTakeoffAvailable ? null : hint;
  });
  const [choosing, setChoosing] = useState(() => !measureFirst && !validTemplate && !(entryModeFromHint(searchParams.get('measurements')) === 'manual' || (entryModeFromHint(searchParams.get('measurements')) === 'digital' && digitalTakeoffAvailable)));
  const choiceSummaryRef = useRef<HTMLHeadingElement>(null);
  const choiceChanged = useRef(false);
  const [customerName, setCustomerName] = useState('');
  const [jobName, setJobName] = useState('');
  const [customerTouched, setCustomerTouched] = useState(false);
  const [jobTouched, setJobTouched] = useState(false);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [measurementSystem, setMeasurementSystem] = useState<MeasurementChoice>(defaultMeasurementSystem);
  const [pendingSystemSwitch, setPendingSystemSwitch] = useState<MeasurementChoice | null>(null);
  const [selectedTrade, setSelectedTrade] = useState(defaultTrade);
  const [selectedCollectionId, setSelectedCollectionId] = useState(componentCollections.find(c => c.is_bootstrap)?.id ?? componentCollections[0]?.id ?? '');
  const [pendingPlan, setPendingPlan] = useState<PendingPlan | null>(null);
  const [replacingPlan, setReplacingPlan] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [progress, setProgress] = useState('');
  const [createError, setCreateError] = useState<{ message: string; showUpgrade: boolean } | null>(null);
  const [digitalUpgradeOpen, setDigitalUpgradeOpen] = useState(false);
  const [quoteCapUpgradeOpen, setQuoteCapUpgradeOpen] = useState(false);
  const [createdRecord, setCreatedRecord] = useState<{ id: string; entryMode: QuoteEntryMode } | null>(null);
  const [creationUncertain, setCreationUncertain] = useState(false);
  const customerRef = useRef<HTMLInputElement>(null);
  const jobRef = useRef<HTMLInputElement>(null);
  const modeRef = useRef<HTMLDivElement>(null);
  const planRef = useRef<HTMLElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const submitLock = useRef(false);
  const uploadLock = useRef(false);
  // Same-tick double click and post-create attachment failure cannot create a
  // second quote. This guard is local only; server atomic quota checks remain.
  const createdRef = useRef<{ id: string; entryMode: QuoteEntryMode } | null>(null);
  const busy = creating || uploading;
  const locked = busy || !!createdRecord || creationUncertain;
  useEffect(() => {
    // Native child cancel can bubble through a parent dialog. Keep the host
    // pending for that event, without changing shared QcDialog behaviour.
    onPendingChange?.(busy || !!pendingSystemSwitch || digitalUpgradeOpen || quoteCapUpgradeOpen);
  }, [busy, pendingSystemSwitch, digitalUpgradeOpen, quoteCapUpgradeOpen, onPendingChange]);
  useEffect(() => { if (createError) errorRef.current?.focus(); }, [createError]);

  useEffect(() => {
    if (!choosing && choiceChanged.current) {
      choiceSummaryRef.current?.focus({ preventScroll: true });
      choiceChanged.current = false;
    }
  }, [choosing]);

  function selectMode(mode: QuoteEntryMode) {
    if (locked) return;
    if (mode === 'digital' && !digitalTakeoffAvailable) { setDigitalUpgradeOpen(true); return; }
    setEntryMode(mode);
    choiceChanged.current = true;
    setChoosing(false);
    setCreateError(null);
    // Keep the local file/template draft when exploring the two paths. Only
    // the selected mode is submitted; unsupported fields never reach actions.
  }

  async function handlePlanUpload(rawFile: File) {
    if (uploadLock.current || submitLock.current || createdRef.current || creationUncertain) return;
    uploadLock.current = true;
    setUploading(true);
    try {
      const file = await pdfPicker.convertIfNeeded(rawFile);
      if (!file) return; // Cancellation keeps an existing uploaded selection.
      const mint = await mintQuoteDocumentUploadUrl({ scope: { kind: 'pending' }, filename: file.name,
        contentType: file.type || 'application/octet-stream', claimedSize: file.size });
      if (!mint.ok) throw new Error(mint.code === 'storage_quota_exceeded'
        ? 'Storage quota exceeded. Please upgrade your plan.' : mint.message);
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage.from(mint.bucket)
        .uploadToSignedUrl(mint.storagePath, mint.token, file, { contentType: file.type || undefined });
      if (uploadError) throw new Error(uploadError.message);
      // Instance-local metadata replaces the former window.__pendingPlanFile.
      // There is no cross-dialog/file contamination and no new storage schema.
      setPendingPlan({ fileName: file.name, fileSize: file.size, mimeType: file.type,
        bucket: mint.bucket, tempPath: mint.storagePath });
      setReplacingPlan(false);
    } finally {
      uploadLock.current = false;
      setUploading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLock.current || uploadLock.current || createdRef.current || creationUncertain) return;
    if (monthlyQuoteAtCap) { setQuoteCapUpgradeOpen(true); return; }
    setValidationAttempted(true);
    if (!entryMode) { modeRef.current?.focus(); return; }
    if (entryMode === 'digital' && !digitalTakeoffAvailable) { setDigitalUpgradeOpen(true); return; }
    if (measureFirst ? !jobName.trim() : !customerName.trim()) {
      if (measureFirst) { setJobTouched(true); jobRef.current?.focus(); }
      else { setCustomerTouched(true); customerRef.current?.focus(); }
      return;
    }
    if (entryMode === 'digital' && !pendingPlan) { planRef.current?.focus(); return; }
    submitLock.current = true;
    setCreating(true);
    setCreateError(null);
    setProgress('Creating your quote…');
    let navigating = false;
    try {
      const selectedTemplate = !measureFirst && entryMode === 'manual' ? templateId : '';
      const result = await createQuoteWithDetails({
        customerName: measureFirst ? customerName.trim() || jobName.trim() : customerName.trim(),
        jobName: jobName.trim() || null,
        templateId: selectedTemplate || null,
        entryMode,
        measurementSystem,
        ...(genericTradesEnabled && selectedTrade ? { trade: selectedTrade as CreateParams['trade'] } : {}),
        ...(genericTradesEnabled && selectedCollectionId ? { componentCollectionId: selectedCollectionId } : {}),
      });
      // Template creation performs its own server redirect. Preserve it instead
      // of manufacturing a quote ID, navigating twice or overriding its route.
      if (!result && selectedTemplate) { navigating = true; return; }
      if (!result?.ok) {
        const message = result && !result.ok ? result.message : 'Quote creation returned no result. Check Quotes before trying again.';
        const code = result && !result.ok ? result.code : 'unknown';
        if (!result) setCreationUncertain(true);
        setCreateError({ message, showUpgrade: ['quote_limit_reached','subscription_inactive','feature_gated','storage_quota_exceeded'].includes(code) });
        return;
      }
      if (!result.quoteId) {
        if (selectedTemplate) { navigating = true; return; }
        setCreationUncertain(true);
        setCreateError({ message: 'The request completed without a quote reference. Check your Quotes list before creating another.', showUpgrade: false });
        return;
      }
      const record = { id: result.quoteId, entryMode };
      createdRef.current = record;
      setCreatedRecord(record);
      if (entryMode === 'digital' && pendingPlan) {
        setProgress('Attaching your plan…');
        const supabase = createClient();
        const finalPath = `${companyId}/${record.id}/${pendingPlan.fileName}`;
        const { error: moveError } = await supabase.storage.from(pendingPlan.bucket).move(pendingPlan.tempPath, finalPath);
        if (moveError) throw new Error(`Could not attach the plan: ${moveError.message}`);
        await saveFileMetadata({ companyId, quoteId: record.id, fileType: 'plan',
          fileName: pendingPlan.fileName, fileSize: pendingPlan.fileSize,
          mimeType: pendingPlan.mimeType, storagePath: finalPath });
      }
      setProgress(entryMode === 'digital' ? 'Opening Digital Takeoff…' : 'Opening your workspace…');
      router.push(quoteJourneyDestination({ workspaceSlug, quoteId: record.id, entryMode }));
      navigating = true;
    } catch (error) {
      // Do not turn Next's intentional template redirect into a creation error.
      // No Next internals/API imported; the existing action owns navigation.
      if (typeof error === 'object' && error !== null && 'digest' in error
        && typeof error.digest === 'string' && error.digest.startsWith('NEXT_REDIRECT;')) {
        navigating = true;
        return;
      }
      const message = error instanceof Error ? error.message : 'Could not start the quote. Please try again.';
      setCreateError({ message, showUpgrade: isBillingMessage(message) });
    } finally {
      if (!navigating) { submitLock.current = false; setCreating(false); setProgress(''); }
    }
  }

  const requiredMissing = measureFirst ? !jobName.trim() : !customerName.trim();
  const customerInvalid = !measureFirst && (customerTouched || validationAttempted) && !customerName.trim();
  const jobInvalid = measureFirst && (jobTouched || validationAttempted) && !jobName.trim();
  const selectedTemplateName = templates.find(t => t.id === templateId)?.name;
  const selectedCollectionName = componentCollections.find(c => c.id === selectedCollectionId)?.name ?? 'All components';
  const helper = !entryMode ? 'Choose where your measurements will come from.'
    : requiredMissing ? `Enter ${measureFirst ? 'a job' : 'the customer'} name to continue.`
    : entryMode === 'digital' && !pendingPlan ? 'Upload a plan or image to start measuring.'
    : entryMode === 'digital' ? 'Next: calibrate and measure in Digital Takeoff.'
    : entryMode === 'blank' ? 'Next: write your line-by-line quote.'
    : 'Next: enter measurements in the Advanced workspace.';
  const recoveryUrl = createdRecord ? quoteJourneyDestination({ workspaceSlug, quoteId: createdRecord.id,
    entryMode: createdRecord.entryMode, stage: 'pricing' }) : `/${workspaceSlug}/quotes`;

  const customerField = (<div className="qce-field" data-copilot="quote-customer">
              <label htmlFor={`${id}-customer`}>Customer name {measureFirst ? <span>(optional)</span> : <span>(required)</span>}</label>
              <QcInput ref={customerRef} id={`${id}-customer`} value={customerName} type="text" autoComplete="name"
                onChange={e => setCustomerName(e.target.value)} onBlur={() => setCustomerTouched(true)} required={!measureFirst}
                aria-invalid={customerInvalid || undefined} aria-describedby={customerInvalid ? `${id}-customer-error` : undefined} placeholder="e.g. Alex Smith" />
              {customerInvalid && <p id={`${id}-customer-error`} className="qce-error">Enter the customer name to continue.</p>}
            </div>);
  const jobField = (<div className="qce-field" data-copilot="quote-job">
              <label htmlFor={`${id}-job`}>Job name {measureFirst ? <span>(required)</span> : <span>(optional)</span>}</label>
              <QcInput ref={jobRef} id={`${id}-job`} value={jobName} type="text" onChange={e => setJobName(e.target.value)}
                onBlur={() => setJobTouched(true)} required={measureFirst} aria-invalid={jobInvalid || undefined}
                aria-describedby={jobInvalid ? `${id}-job-error` : undefined} placeholder="e.g. 18 Workshop Lane" />
              {jobInvalid && <p id={`${id}-job-error`} className="qce-error">Enter a job name to continue.</p>}
            </div>);

  return <QcJourney className="qc-quote-entry"><QcHostedDialogScope enabled>
    <form onSubmit={handleSubmit} noValidate className="qce-form" data-quote-entry-context={context}>
      {createError && <div ref={errorRef} tabIndex={-1} className="qce-message" role="alert" data-warning={createError.showUpgrade || undefined}>
        {createdRecord && <p><strong>Your quote was created.</strong> The next step did not finish. Open that quote to continue; do not create another one.</p>}
        <p>{createError.message}</p>
        {createError.showUpgrade && <Link href={`/${workspaceSlug}/account?tab=billing`} prefetch={false}>View plans →</Link>}
        {(createdRecord || creationUncertain) && <Link href={recoveryUrl}>Open {createdRecord ? 'the created quote' : 'Quotes'} →</Link>}
      </div>}
      <fieldset className="qce-section-disabled" disabled={locked}>
        <section className="qce-section" aria-labelledby={`${id}-question`}>
          {choosing || !entryMode ? <>
            <h2 id={`${id}-question`}>Do you already have the measurements?</h2>
            <p className="qce-subtitle">Two ways to start. The same pricing workspace afterwards.</p>
            <MeasurementChoiceCards ref={modeRef} value={entryMode} onSelect={selectMode}
              digitalAvailable={digitalTakeoffAvailable} disabled={locked} describedBy={validationAttempted && !entryMode ? `${id}-mode-error` : undefined} />
            {validationAttempted && !entryMode && <p id={`${id}-mode-error`} className="qce-error">Choose how to get your measurements.</p>}
            <div className="qce-other"><span>Not using measurements?</span>
              <QcButton size="sm" aria-pressed={entryMode === 'blank'} onClick={() => selectMode('blank')}>Write a line-by-line quote</QcButton>
              {entryMode && <QcButton size="sm" onClick={() => { choiceChanged.current = true; setChoosing(false); }}>Keep current choice</QcButton>}
            </div>
          </> : <div className="qce-chosen">
            <div><p className="qce-help">{entryMode === 'blank' ? 'Standard quote' : 'Measurements'}</p>
              <h2 id={`${id}-question`} ref={choiceSummaryRef} tabIndex={-1}>{entryMode === 'manual' ? 'I have measurements' : entryMode === 'digital' ? 'I need to measure' : 'Line-by-line quote'}</h2>
            </div>
            <QcButton size="sm" onClick={() => setChoosing(true)} aria-label="Change measurement path">Change</QcButton>
          </div>}
          {entryMode && <div className="qce-next"><span aria-hidden="true">→</span><div>
            <strong>{entryMode === 'manual' ? 'Enter measurements → Price → Customer quote'
              : entryMode === 'digital' ? 'Measure → Price → Customer quote' : 'Write → Review → Send'}</strong>
            <p>{entryMode === 'manual' ? 'Use measurements from any source with your Smart Components in the Advanced workspace.'
              : entryMode === 'digital' ? 'Calibrate your plan, measure, then price the job.'
              : 'Create a Standard Quote without components or measurements. This opens the existing line editor.'}</p>
            {entryMode === 'manual' && <details><summary>Are your measurements plan or actual?</summary>
              <p>Plan measurements are viewed from above. Actual measurements already follow the surface or slope. You will choose the appropriate basis on each component when entering measurements; this screen does not apply pitch.</p>
              <p>For work without pitch, use the measurements you have. Waste and purchasing rules still come from the component.</p>
            </details>}
          </div></div>}
        </section>
        {entryMode && <>
        <section className="qce-section" aria-labelledby={`${id}-job-heading`}>
          <h2 id={`${id}-job-heading`}>{measureFirst ? 'Name the job' : 'Who is this quote for?'}</h2>
          <p className="qce-help">{measureFirst ? 'Customer details can be added later. For now, use a name you will recognise.' : 'A name is enough to start. Add the rest of the customer details later.'}</p>
          <div className="qce-fields">
            {measureFirst ? <>{jobField}{customerField}</> : <>{customerField}{jobField}</>}
          </div>
          <fieldset className="qce-units" data-copilot="quote-measurement">
            <legend>Units for this quote</legend>
            <details className="qce-unit-choice">
              <summary><span><strong>{MEASUREMENT_OPTIONS.find(o => o.value === measurementSystem)?.title}</strong> · {MEASUREMENT_OPTIONS.find(o => o.value === measurementSystem)?.subtitle}</span><span className="qce-unit-change">Change units</span></summary>
            <div className="qce-unit-options" role="group" aria-label="Units for this quote">
              {MEASUREMENT_OPTIONS.map(option => <QcButton key={option.value} aria-pressed={measurementSystem === option.value}
                aria-label={`${option.title}: ${option.subtitle}${option.value === defaultMeasurementSystem ? ', company default' : ''}`}
                onClick={() => { if (option.value === measurementSystem) return;
                  if (option.value !== defaultMeasurementSystem) setPendingSystemSwitch(option.value);
                  else setMeasurementSystem(option.value); }}>
                <span>{option.title}</span><small>{option.subtitle}</small>
              </QcButton>)}
            </div>
            </details>
            <p className="qce-help">{measurementSystem === defaultMeasurementSystem ? 'Your company default. ' : ''}<strong>Units cannot change after creation.</strong></p>
          </fieldset>
        </section>
        {entryMode === 'digital' && <section ref={planRef} tabIndex={-1} className="qce-section" aria-labelledby={`${id}-plan-heading`}>
          <h2 id={`${id}-plan-heading`}>Add your plan or image</h2>
          <p className="qce-subtitle">Use a PDF or an image, including a satellite image you already have. You will need a known distance to calibrate it.</p>
          {validationAttempted && !pendingPlan && <p className="qce-error">Upload a plan or image before starting.</p>}
          {pendingPlan && <div className="qce-plan-file" role="status"><div><strong>{pendingPlan.fileName}</strong>
            <p className="qce-help">Uploaded and ready to attach to this quote.</p></div>
            <QcButton size="sm" onClick={() => setReplacingPlan(v => !v)}>{replacingPlan ? 'Keep this plan' : 'Change plan'}</QcButton>
          </div>}
          {(!pendingPlan || replacingPlan) && <FileUploader appearance="v2" accept="image/*,application/pdf"
            maxSize={10485760} pdfMaxSize={52428800} onUpload={handlePlanUpload} currentFileUrl={null}
            label={pendingPlan ? 'Choose a different plan' : 'Choose a plan or image'}
            description="PDF up to 50 MB · image up to 10 MB" isOverStorage={isOverStorage} />}
          <p className="qce-help" style={{ marginTop: 12 }}>PDFs open the existing page picker. There is no satellite lookup on this screen.</p>
        </section>}
        {(genericTradesEnabled || !measureFirst) && <details className="qce-options">
          <summary><strong>Quote setup</strong><span>{genericTradesEnabled ? `${selectedTrade.charAt(0).toUpperCase() + selectedTrade.slice(1)} · ${selectedCollectionName}` : 'Company defaults'}{entryMode === 'manual' && selectedTemplateName ? ` · Template: ${selectedTemplateName}` : ''}</span></summary>
          <div className="qce-options-body">
            {genericTradesEnabled && <div className="qce-fields">
              <div className="qce-field"><label htmlFor={`${id}-trade`}>Industry</label>
                <QcSelect id={`${id}-trade`} value={selectedTrade} onChange={e => setSelectedTrade(e.target.value)}>
                  {TRADES.map(trade => <option key={trade} value={trade}>{trade.charAt(0).toUpperCase() + trade.slice(1)}</option>)}
                </QcSelect>
              </div>
              <div className="qce-field"><label htmlFor={`${id}-collection`}>Component collection</label>
                <QcSelect id={`${id}-collection`} value={selectedCollectionId} onChange={e => setSelectedCollectionId(e.target.value)}>
                  <option value="">All Components</option>
                  {componentCollections.map(c => <option key={c.id} value={c.id}>{c.name}{c.is_bootstrap ? ' (default)' : ''}</option>)}
                </QcSelect>
                {componentCollections.length === 0 && <p className="qce-help">No collections yet. You can create one in Pricing Library.</p>}
              </div>
            </div>}
            {!measureFirst && <div className="qce-field qce-template" data-copilot="quote-template">
              <label htmlFor={`${id}-template`}>Use a quote template <span>(optional)</span></label>
              <QcSelect id={`${id}-template`} value={entryMode === 'manual' || entryMode === null ? templateId : ''}
                disabled={entryMode === 'digital' || entryMode === 'blank'} onChange={e => { setTemplateId(e.target.value); if (!entryMode && e.target.value) { setEntryMode('manual'); setChoosing(false); } }}>
                <option value="">Start without a template</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </QcSelect>
              <p className="qce-help">{entryMode === 'digital' ? 'Takeoff creates the measured areas and components. Quote templates apply to the “I have measurements” path.'
                : entryMode === 'blank' ? 'The line-by-line editor starts without an area/component template.'
                : 'Bring saved areas and components into this job, then enter or check their measurements.'}</p>
            </div>}
          </div>
        </details>}
        </>}
      </fieldset>
      {templatesLoadError && !measureFirst && <div className="qce-message" data-warning="true" role="alert">Saved quote templates could not be loaded. You can start without one. <QcButton size="sm" onClick={() => router.refresh()} disabled={locked}>Retry templates</QcButton></div>}
      {entryMode && <div className="qce-footer">
        {onCancel ? <QcButton onClick={onCancel} disabled={busy}>Cancel</QcButton>
          : <Link className="qce-back" href={`/${workspaceSlug}/quotes`} aria-disabled={busy || undefined}
              onClick={e => { if (busy) e.preventDefault(); }}>← Quotes</Link>}
        <div className="qce-footer-end">
          <p id={`${id}-next`} className="qce-help" role="status">{progress || (uploading ? 'Preparing your plan…' : helper)}</p>
          {!createdRecord && !creationUncertain && <QcButton type="submit" variant="primary" size="lg" data-copilot="quote-create"
            pending={creating} disabled={uploading || requiredMissing || !entryMode || (entryMode === 'digital' && !pendingPlan)} aria-describedby={`${id}-next`}>
            {creating ? 'Starting…' : entryMode === 'digital' ? 'Start measuring →' : entryMode === 'blank' ? 'Open line editor →' : 'Enter measurements →'}
          </QcButton>}
        </div>
      </div>}
      {!entryMode && onCancel && <QcButton onClick={onCancel}>Cancel</QcButton>}
    </form>
    <QcDialog open={!!pendingSystemSwitch} onRequestClose={() => setPendingSystemSwitch(null)} title="Use different units?"
      footer={<><QcButton onClick={() => setPendingSystemSwitch(null)}>Keep current units</QcButton>
        <QcButton variant="primary" onClick={() => { if (pendingSystemSwitch) setMeasurementSystem(pendingSystemSwitch); setPendingSystemSwitch(null); }}>Use these units</QcButton></>}>
      <p>You are selecting <strong>{MEASUREMENT_OPTIONS.find(o => o.value === pendingSystemSwitch)?.title}</strong> instead of your company default.</p>
      <p>Units cannot be changed after this quote is created.</p>
    </QcDialog>
    <UpgradeModal open={digitalUpgradeOpen} onClose={() => setDigitalUpgradeOpen(false)} title="Digital takeoff requires a higher plan"
      description="To access digital takeoff mode please upgrade your account." recommendedPlan="growth" />
    <UpgradeModal open={quoteCapUpgradeOpen} onClose={() => setQuoteCapUpgradeOpen(false)} title={`Monthly quote limit reached (${monthlyQuoteUsed}/${monthlyQuoteLimit})`}
      description={`To create more quotes this month you need to upgrade your account tier, or wait until your quote limit resets next month. (${effectivePlanCode} plan)`} recommendedPlan="pro" />
    {pdfPicker.modal}
  </QcHostedDialogScope></QcJourney>;
}
