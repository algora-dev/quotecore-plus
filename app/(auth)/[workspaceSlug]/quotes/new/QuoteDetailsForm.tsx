'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createQuoteWithDetails } from './actions';
import { FileUploader } from '@/app/components/FileUploader';
import { createClient } from '@/app/lib/supabase/client';
import { checkStorageQuota, saveFileMetadata } from '@/app/lib/files/storage-actions';
import { mintQuoteDocumentUploadUrl } from '@/app/lib/files/signed-upload';
import { UpgradeModal } from '@/app/components/UpgradeModal';

interface Template {
  id: string;
  name: string;
  description: string | null;
}

type MeasurementChoice = 'metric' | 'imperial_ft' | 'imperial_rs';

interface Props {
  workspaceSlug: string;
  templates: Template[];
  companyId: string;
  /** Company default measurement system; pre-selects the radio when the form mounts. */
  defaultMeasurementSystem: MeasurementChoice;
  /** Whether the digital takeoff feature is available on the company's plan. */
  digitalTakeoffAvailable: boolean;
  /** True if the company has hit their monthly quote limit. Blocks submission. */
  monthlyQuoteAtCap: boolean;
  monthlyQuoteUsed: number;
  monthlyQuoteLimit: number;
  effectivePlanCode: string;
  /** Phase 8 (Generic Trades): pre-seeded from company.default_trade. */
  defaultTrade?: string;
  /** Phase 8 (Generic Trades): collections the user can pick from. */
  componentCollections?: Array<{ id: string; name: string; is_bootstrap: boolean }>;
}

const MEASUREMENT_OPTIONS: Array<{ value: MeasurementChoice; title: string; subtitle: string }> = [
  { value: 'metric', title: 'Metric', subtitle: 'meters & m²' },
  { value: 'imperial_ft', title: 'Imperial — ft²', subtitle: 'feet & square feet' },
  { value: 'imperial_rs', title: 'Imperial — Roofing Squares', subtitle: 'feet & Roofing Squares (RS)' },
];

export function QuoteDetailsForm({
  workspaceSlug,
  templates,
  companyId,
  defaultMeasurementSystem,
  digitalTakeoffAvailable,
  monthlyQuoteAtCap,
  monthlyQuoteUsed,
  monthlyQuoteLimit,
  effectivePlanCode,
  defaultTrade = 'roofing',
  componentCollections = [],
}: Props) {
  // Phase 8 (Generic Trades): trade + collection pickers.
  // Only rendered when NEXT_PUBLIC_GENERIC_TRADES_V1 is on.
  const genericTradesEnabled =
    (process.env.NEXT_PUBLIC_GENERIC_TRADES_V1 ?? '').toLowerCase() === 'true';
  const [selectedTrade, setSelectedTrade] = useState<string>(defaultTrade);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>(
    componentCollections.find(c => c.is_bootstrap)?.id ?? componentCollections[0]?.id ?? ''
  );
  const router = useRouter();
  const searchParams = useSearchParams();
  const [customerName, setCustomerName] = useState('');
  const [jobName, setJobName] = useState('');
  const [templateId, setTemplateId] = useState('');
  // Entry mode: manual (traditional builder), digital (takeoff canvas), or
  // blank (skip the builder and go straight to the customer quote editor as
  // the master source). Null until the user clicks one of the three pills.
  const [entryMode, setEntryMode] = useState<'manual' | 'digital' | 'blank' | null>(null);
  const [planUploaded, setPlanUploaded] = useState(false);
  const [uploadedPlanPath, setUploadedPlanPath] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  // Inline error surface for the new-quote flow. Billing errors flag
  // showUpgrade so we render a CTA to /account?tab=billing rather than a
  // dead alert(). See catch block below.
  const [createError, setCreateError] = useState<
    { message: string; showUpgrade: boolean } | null
  >(null);
  // Measurement system for the quote-to-be. Locked once the quote is created.
  const [measurementSystem, setMeasurementSystem] = useState<MeasurementChoice>(defaultMeasurementSystem);
  const [pendingSystemSwitch, setPendingSystemSwitch] = useState<MeasurementChoice | null>(null);

  // Upgrade modal state. Two trigger paths:
  //   1. User clicks the greyed-out Digital Mode button on a plan without
  //      the digital_takeoff feature.
  //   2. User submits the form with monthlyQuoteAtCap=true.
  // Both share the same modal component but with different copy / target plan.
  const [digitalUpgradeOpen, setDigitalUpgradeOpen] = useState(false);
  const [quoteCapUpgradeOpen, setQuoteCapUpgradeOpen] = useState(false);

  // Pre-select template from URL param. setState inside effect is
  // intentional: the URL is external state we mirror. React 19's stricter
  // rule flags it; the guard above prevents loops.
  useEffect(() => {
    const urlTemplateId = searchParams.get('template');
    if (urlTemplateId && templates.find(t => t.id === urlTemplateId)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTemplateId(urlTemplateId);
    }
  }, [searchParams, templates]);

  async function handlePlanUpload(file: File) {
    // Gerald audit H-05: the client no longer has direct INSERT on the
    // private bucket. Ask the server to mint a signed upload URL after
    // it has verified company context + tier + storage quota.
    const mint = await mintQuoteDocumentUploadUrl({
      scope: { kind: 'pending' },
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
      claimedSize: file.size,
    });
    if (!mint.ok) {
      // Surface a billing-style message that the existing storage_quota
      // UI banner already handles.
      if (mint.code === 'storage_quota_exceeded') {
        throw new Error('Storage quota exceeded. Please upgrade your plan.');
      }
      throw new Error(mint.message);
    }

    const supabase = createClient();
    const { error: uploadError } = await supabase.storage
      .from(mint.bucket)
      .uploadToSignedUrl(mint.storagePath, mint.token, file, {
        contentType: file.type || undefined,
      });
    if (uploadError) {
      throw new Error(uploadError.message);
    }

    // Store file info in state - will save metadata after quote creation
    setUploadedPlanPath(mint.storagePath);
    setPlanUploaded(true);

    // Store file details for later metadata save. fileName is just for
    // display + filetype detection; the canonical path is mint.storagePath.
    const displayName = file.name;
    (window as { __pendingPlanFile?: unknown }).__pendingPlanFile = {
      fileName: displayName,
      fileSize: file.size,
      mimeType: file.type,
      tempPath: mint.storagePath,
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Last-line client guard before we hit the server. The server's
    // create_quote_atomic also enforces this so a bypass attempt still
    // fails with quote_limit_reached.
    if (monthlyQuoteAtCap) {
      setQuoteCapUpgradeOpen(true);
      return;
    }

    if (!customerName.trim()) {
      alert('Customer name is required');
      return;
    }

    if (!entryMode) {
      alert('Please select an entry mode (Manual, Digital, or Blank Quote)');
      return;
    }

    if (entryMode === 'digital' && !planUploaded) {
      alert('Please upload a roof plan for digital takeoff');
      return;
    }

    setCreating(true);
    try {
      const result = await createQuoteWithDetails({
        customerName: customerName.trim(),
        jobName: jobName.trim() || null,
        templateId: templateId || null,
        entryMode,
        measurementSystem,
        // Phase 8 (Generic Trades): pass through when the flag is on.
        ...(genericTradesEnabled && selectedTrade ? { trade: selectedTrade as 'roofing' | 'cladding' | 'generic' } : {}),
        ...(genericTradesEnabled && selectedCollectionId ? { componentCollectionId: selectedCollectionId } : {}),
      });

      // Structured failure path: server caught a billing error and returned
      // it as data so we can render the typed banner instead of crashing
      // through Next's masked-error pipeline. `code` is stable and matches
      // the BillingError subclasses on the server.
      if (!result.ok) {
        const isBilling =
          result.code === 'quote_limit_reached' ||
          result.code === 'subscription_inactive' ||
          result.code === 'feature_gated' ||
          result.code === 'storage_quota_exceeded';
        setCreateError({ message: result.message, showUpgrade: isBilling });
        setCreating(false);
        return;
      }

      const quoteId = result.quoteId;

      // If template mode, redirect happens inside createQuoteWithDetails
      // and quoteId is undefined (the server function never returns).
      if (!quoteId) return;

      // If digital mode with uploaded plan, move file and save metadata
      if (entryMode === 'digital' && uploadedPlanPath) {
        const pendingFile = (window as any).__pendingPlanFile;
        if (pendingFile) {
          const supabase = createClient();
          
          // Move file from temp to final location
          const finalPath = `${companyId}/${quoteId}/${pendingFile.fileName}`;
          await supabase.storage.from('QUOTE-DOCUMENTS').move(pendingFile.tempPath, finalPath);
          
          // Save metadata now that quote exists
          await saveFileMetadata({
            companyId,
            quoteId,
            fileType: 'plan',
            fileName: pendingFile.fileName,
            fileSize: pendingFile.fileSize,
            mimeType: pendingFile.mimeType,
            storagePath: finalPath,
          });
          
          delete (window as any).__pendingPlanFile;
        }
        
        router.push(`/${workspaceSlug}/quotes/${quoteId}/takeoff`);
      } else if (entryMode === 'blank') {
        // Blank quote skips the traditional Areas/Components/Extras builder
        // entirely. We route to the dedicated /blank-build screen which is
        // the master source of line items for blank quotes. The customer
        // quote editor remains accessible from the summary if the user
        // wants to further customise what the customer sees vs the master.
        router.push(`/${workspaceSlug}/quotes/${quoteId}/blank-build`);
      } else {
        // Manual mode goes to the traditional quote builder.
        router.push(`/${workspaceSlug}/quotes/${quoteId}`);
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Failed to create quote';
      // Billing errors from create_quote_atomic / requireFeature surface
      // with stable phrases. Show an inline banner with an Upgrade CTA
      // instead of a dead alert(). The exhaustive code lookup happens on
      // the server; here we just sniff the message.
      const isBilling = /quote_limit_reached|feature_gated|subscription_inactive|storage_quota_exceeded|monthly quote limit|requires "/i.test(raw);
      setCreateError({ message: raw, showUpgrade: isBilling });
      setCreating(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-8 space-y-6">
      {createError && (
        <div
          className={`rounded-lg border p-4 ${
            createError.showUpgrade
              ? 'border-amber-300 bg-amber-50 text-amber-900'
              : 'border-red-300 bg-red-50 text-red-900'
          }`}
        >
          <p className="text-sm font-medium">{createError.message}</p>
          {createError.showUpgrade && (
            <Link
              href={`/${workspaceSlug}/account?tab=billing`}
              prefetch={false}
              className="mt-2 inline-block text-sm font-semibold text-amber-900 underline"
            >
              View plans →
            </Link>
          )}
        </div>
      )}
      {/* Phase 8 (Generic Trades): trade + collection pickers. Only when flag on. */}
      {genericTradesEnabled && (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
          <h3 className="text-sm font-semibold text-slate-800">Trade &amp; Component Collection</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Trade</label>
              <select
                value={selectedTrade}
                onChange={e => setSelectedTrade(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="roofing">Roofing</option>
                <option value="cladding">Cladding</option>
                <option value="generic">Generic</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Component Collection</label>
              {componentCollections.length === 0 ? (
                <p className="text-xs text-slate-500 py-2">No collections found. Go to Components to create one.</p>
              ) : (
                <select
                  value={selectedCollectionId}
                  onChange={e => setSelectedCollectionId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                >
                  {componentCollections.map(c => (
                    <option key={c.id} value={c.id}>{c.name}{c.is_bootstrap ? '' : ''}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Customer Name */}
      <div data-copilot="quote-customer">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Customer Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder="e.g., John Smith"
          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          required
          autoFocus
        />
      </div>

      {/* Job Name */}
      <div data-copilot="quote-job">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Job Name <span className="text-slate-400">(optional)</span>
        </label>
        <input
          type="text"
          value={jobName}
          onChange={(e) => setJobName(e.target.value)}
          placeholder="e.g., Residential Re-roof, 123 Main St"
          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
        />
      </div>

      {/* Measurement System (locked once the quote is created) */}
      <div data-copilot="quote-measurement">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Measurement System <span className="text-red-500">*</span>
        </label>
        <p className="text-xs text-slate-500 mb-3">
          Pick now — this <strong>cannot be changed later</strong> for this quote. Default comes from your company settings.
        </p>
        <div className="grid grid-cols-1 gap-2">
          {MEASUREMENT_OPTIONS.map((opt) => {
            const isActive = measurementSystem === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  if (opt.value === measurementSystem) return;
                  // If the user switches AWAY from their company default,
                  // confirm so they don't do it by accident on a tiny radio.
                  if (opt.value !== defaultMeasurementSystem) {
                    setPendingSystemSwitch(opt.value);
                  } else {
                    setMeasurementSystem(opt.value);
                  }
                }}
                className={`relative p-3 rounded-lg border-2 transition text-left ${
                  isActive
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className={`inline-block w-3 h-3 rounded-full border-2 ${
                      isActive ? 'border-orange-500 bg-orange-500' : 'border-slate-300'
                    }`}
                  />
                  <div>
                    <div className="font-medium text-sm text-slate-900">{opt.title}</div>
                    <div className="text-xs text-slate-500">{opt.subtitle}</div>
                  </div>
                  {opt.value === defaultMeasurementSystem && (
                    <span className="ml-auto text-[11px] uppercase tracking-wide text-slate-400">
                      Company default
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Confirm modal: switching away from the company default */}
      {pendingSystemSwitch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">Switch measurement system?</h3>
            <p className="text-sm text-slate-600">
              You&apos;re about to use <strong>
                {MEASUREMENT_OPTIONS.find((o) => o.value === pendingSystemSwitch)?.title}
              </strong> for this quote instead of your company default.
            </p>
            <p className="text-sm text-slate-600">
              This <strong>cannot be changed</strong> after the quote is created. Are you sure?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setPendingSystemSwitch(null)}
                className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setMeasurementSystem(pendingSystemSwitch);
                  setPendingSystemSwitch(null);
                }}
                className="px-4 py-2 text-sm font-semibold rounded-full bg-black text-white hover:bg-slate-800"
              >
                Yes, use this
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Selection */}
      <div data-copilot="quote-template">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Quote Template <span className="text-slate-400">(optional)</span>
        </label>
        <select
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          // Templates pre-load roof areas/components, neither of which exists
          // in digital mode (added in-process) or blank mode (skipped entirely).
          disabled={entryMode === 'digital' || entryMode === 'blank'}
          className={`w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${
            entryMode === 'digital' || entryMode === 'blank' ? 'opacity-50 cursor-not-allowed bg-slate-100' : ''
          }`}
        >
          <option value="">Start from scratch</option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
              {template.description ? ` — ${template.description}` : ''}
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-500 mt-1">
          {entryMode === 'digital'
            ? 'Templates are not available in digital mode (components added in process)'
            : entryMode === 'blank'
            ? 'Templates do not apply to blank quotes (no areas or components)'
            : 'Templates pre-load roof areas and components'}
        </p>
      </div>

      {/* Entry Mode Selection */}
      <div data-copilot="quote-entry">
        <label className="block text-sm font-medium text-slate-700 mb-3">
          Entry Mode <span className="text-red-500">*</span>
        </label>
        {/* Three-up mode pills. Manual builds via Areas/Components, Digital
            adds the takeoff canvas step first, Blank skips the builder and
            uses the customer quote editor as the master source. */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Manual Mode Button */}
          <button
            type="button"
            onClick={() => {
              setEntryMode('manual');
              setPlanUploaded(false);
              setUploadedPlanPath(null);
            }}
            className={`relative p-4 rounded-full border-2 transition-all ${
              entryMode === 'manual'
                ? 'border-orange-500 bg-blue-50'
                : 'border-slate-300 hover:border-slate-400'
            }`}
            title="Transfer already sourced measurements directly into Roof Areas and Components"
          >
            <div className="flex items-center justify-center mb-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="text-sm font-medium text-slate-900">Manual Mode</div>
            <div className="text-xs text-slate-500 mt-1">Traditional quote builder</div>
          </button>

          {/* Digital Mode Button - locked when plan lacks the feature */}
          <button
            type="button"
            onClick={() => {
              if (!digitalTakeoffAvailable) {
                setDigitalUpgradeOpen(true);
                return;
              }
              setEntryMode('digital');
              setTemplateId(''); // Auto-switch to "Start from scratch"
            }}
            className={`relative p-4 rounded-full border-2 transition-all ${
              !digitalTakeoffAvailable
                ? 'border-slate-200 bg-slate-100 opacity-60 cursor-pointer'
                : entryMode === 'digital'
                ? 'border-orange-500 bg-blue-50'
                : 'border-slate-300 hover:border-slate-400'
            }`}
            title={!digitalTakeoffAvailable
              ? 'To access digital takeoff mode please upgrade your account'
              : 'Upload your roof plan, measure and assign roof areas, roof component items (Faster)'}
          >
            {!digitalTakeoffAvailable && (
              <span className="absolute top-2 right-2">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </span>
            )}
            <div className="flex items-center justify-center mb-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
              </svg>
            </div>
            <div className="text-sm font-medium text-slate-900">Digital Mode</div>
            <div className="text-xs text-slate-500 mt-1">Digital takeoff canvas</div>
          </button>

          {/* Blank Quote Button */}
          <button
            type="button"
            onClick={() => {
              setEntryMode('blank');
              setTemplateId('');           // Templates do not apply.
              setPlanUploaded(false);
              setUploadedPlanPath(null);
            }}
            className={`relative p-4 rounded-full border-2 transition-all ${
              entryMode === 'blank'
                ? 'border-orange-500 bg-blue-50'
                : 'border-slate-300 hover:border-slate-400'
            }`}
            title="For fully custom quotes without using components or areas"
          >
            <div className="flex items-center justify-center mb-2">
              {/* Document-with-pencil icon — reads as "freeform write". */}
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-3M16.5 3.5a2.121 2.121 0 113 3L12 14l-4 1 1-4 7.5-7.5z" />
              </svg>
            </div>
            <div className="text-sm font-medium text-slate-900">Blank Quote</div>
            <div className="text-xs text-slate-500 mt-1">No components or areas</div>
          </button>
        </div>
      </div>

      {/* Roof Plan Upload (Digital Mode Only) */}
      {entryMode === 'digital' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-1">Upload Roof Plan</h3>
            <p className="text-xs text-slate-600 mb-3">
              Upload roof plan (PDF or image) for digital takeoff. Max 10 MB.
            </p>
          </div>
          
          {planUploaded ? (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-green-900 font-medium">Roof plan uploaded successfully!</span>
            </div>
          ) : (
            <FileUploader
              accept="image/*,application/pdf"
              maxSize={10485760}
              onUpload={handlePlanUpload}
              currentFileUrl={null}
              label="Upload Roof Plan"
              description="PDF or image (max 10 MB)"
            />
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-200">
        <Link
          href={`/${workspaceSlug}/quotes`}
          className="text-sm text-slate-600 hover:text-slate-900"
        >
          ← Cancel
        </Link>
        <button
          type="submit"
          data-copilot="quote-create"
          disabled={creating || !customerName.trim() || !entryMode || (entryMode === 'digital' && !planUploaded)}
          className="px-6 py-3 bg-black text-white font-medium rounded-full hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
        >
          {creating
            ? 'Creating...'
            : entryMode === 'digital'
            ? 'Start Digital Takeoff'
            : entryMode === 'blank'
            ? 'Start Blank Quote'
            : 'Create Quote'}
        </button>
      </div>

      <UpgradeModal
        open={digitalUpgradeOpen}
        onClose={() => setDigitalUpgradeOpen(false)}
        title="Digital takeoff requires a higher plan"
        description="To access digital takeoff mode please upgrade your account."
        recommendedPlan="growth"
      />

      <UpgradeModal
        open={quoteCapUpgradeOpen}
        onClose={() => setQuoteCapUpgradeOpen(false)}
        title={`Monthly quote limit reached (${monthlyQuoteUsed}/${monthlyQuoteLimit})`}
        description={`To create more quotes this month you need to upgrade your account tier, or wait until your quote limit resets next month. (${effectivePlanCode} plan)`}
        recommendedPlan={effectivePlanCode === 'trial' ? 'growth' : 'pro'}
      />
    </form>
  );
}
