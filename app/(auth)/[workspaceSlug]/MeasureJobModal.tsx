'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createQuoteWithDetails } from './quotes/new/actions';
import { FileUploader } from '@/app/components/FileUploader';
import { usePdfPagePicker } from '@/app/components/PdfPagePicker';
import { createClient } from '@/app/lib/supabase/client';
import { saveFileMetadata } from '@/app/lib/files/storage-actions';
import { mintQuoteDocumentUploadUrl } from '@/app/lib/files/signed-upload';
import { UpgradeModal } from '@/app/components/UpgradeModal';

type MeasurementChoice = 'metric' | 'imperial_ft' | 'imperial_rs';

interface Props {
  workspaceSlug: string;
  companyId: string;
  defaultMeasurementSystem: MeasurementChoice;
  digitalTakeoffAvailable: boolean;
  monthlyQuoteAtCap: boolean;
  monthlyQuoteUsed: number;
  monthlyQuoteLimit: number;
  effectivePlanCode: string;
  defaultTrade?: string;
  componentCollections?: Array<{ id: string; name: string; is_bootstrap: boolean }>;
  isOverStorage?: boolean;
}

const MEASUREMENT_OPTIONS: Array<{ value: MeasurementChoice; title: string; subtitle: string }> = [
  { value: 'metric', title: 'Metric', subtitle: 'meters & m²' },
  { value: 'imperial_ft', title: 'Imperial - ft²', subtitle: 'feet & square feet' },
  { value: 'imperial_rs', title: 'Imperial - Roofing Squares', subtitle: 'feet & Roofing Squares (RS)' },
];

/**
 * Measure a job - measure-first dashboard entry (spec: docs/MEASURE_A_JOB_SPEC.md).
 *
 * Renders the prominent dashboard button + the creation modal. Under the hood
 * this is exactly the new-quote digital flow: createQuoteWithDetails with
 * entryMode='digital', plan attached, then redirect to the takeoff canvas.
 * The only difference is framing - the user's intent is "measure", not
 * "create a quote", so the modal skips the entry-mode pills entirely.
 */
export function MeasureJobButton(props: Props) {
  const [open, setOpen] = useState(false);

  // Feature gate first: a plan without digital_takeoff never opens the modal.
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  return (
    <>
      <div className="rounded-xl border border-orange-200 bg-gradient-to-r from-orange-50 to-white p-4 md:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 md:gap-4">
            <div className="p-2.5 md:p-3 rounded-full bg-[#FF6B35] flex-shrink-0">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m4 10V11m4 6V9M5 21h14" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-slate-900 text-sm md:text-base">Measure a job</h3>
              <p className="text-xs md:text-sm text-slate-500 mt-0.5">
                Measure any type of job using our digital canvas. Upload your own plan or image and
                measure over the top of it to get quantities and pricing.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!props.digitalTakeoffAvailable) {
                setUpgradeOpen(true);
                return;
              }
              setOpen(true);
            }}
            className="inline-flex flex-shrink-0 items-center justify-center gap-1.5 rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)] min-h-[44px]"
          >
            Start measuring
          </button>
        </div>
      </div>

      {open && <MeasureJobModal {...props} onClose={() => setOpen(false)} />}

      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        title="Digital takeoff requires a higher plan"
        description="To measure jobs on the digital canvas please upgrade your account."
        recommendedPlan="growth"
      />
    </>
  );
}

function MeasureJobModal({
  workspaceSlug,
  companyId,
  defaultMeasurementSystem,
  monthlyQuoteAtCap,
  monthlyQuoteUsed,
  monthlyQuoteLimit,
  effectivePlanCode,
  defaultTrade = 'roofing',
  componentCollections = [],
  isOverStorage,
  onClose,
}: Props & { onClose: () => void }) {
  const router = useRouter();
  const pdfPicker = usePdfPagePicker();
  const [jobName, setJobName] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [measurementSystem, setMeasurementSystem] = useState<MeasurementChoice>(defaultMeasurementSystem);
  const [pendingSystemSwitch, setPendingSystemSwitch] = useState<MeasurementChoice | null>(null);
  const [planUploaded, setPlanUploaded] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<{ message: string; showUpgrade: boolean } | null>(null);
  const [capUpgradeOpen, setCapUpgradeOpen] = useState(false);

  const genericTradesEnabled =
    (process.env.NEXT_PUBLIC_GENERIC_TRADES_V1 ?? '').toLowerCase() === 'true';
  const [selectedTrade, setSelectedTrade] = useState<string>(defaultTrade);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>(
    componentCollections.find(c => c.is_bootstrap)?.id ?? componentCollections[0]?.id ?? ''
  );

  // Pending plan file: uploaded to a pending scope via signed URL before the
  // quote exists, then moved into the quote prefix after creation. Mirrors
  // the digital path in QuoteDetailsForm exactly.
  const [pendingPlan, setPendingPlan] = useState<{
    fileName: string;
    fileSize: number;
    mimeType: string;
    bucket: string;
    tempPath: string;
  } | null>(null);

  async function handlePlanUpload(rawFile: File) {
    setCreateError(null);
    const file = await pdfPicker.convertIfNeeded(rawFile);
    if (!file) return; // user cancelled the page picker
    const mint = await mintQuoteDocumentUploadUrl({
      scope: { kind: 'pending' },
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
      claimedSize: file.size,
    });
    if (!mint.ok) {
      if (mint.code === 'storage_quota_exceeded') {
        setCreateError({ message: 'Storage quota exceeded. Please upgrade your plan.', showUpgrade: true });
      } else {
        setCreateError({ message: mint.message, showUpgrade: false });
      }
      return;
    }
    const supabase = createClient();
    const { error: uploadError } = await supabase.storage
      .from(mint.bucket)
      .uploadToSignedUrl(mint.storagePath, mint.token, file, {
        contentType: file.type || undefined,
      });
    if (uploadError) {
      setCreateError({ message: uploadError.message, showUpgrade: false });
      return;
    }
    setPendingPlan({
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      bucket: mint.bucket,
      tempPath: mint.storagePath,
    });
    setPlanUploaded(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (monthlyQuoteAtCap) {
      setCapUpgradeOpen(true);
      return;
    }
    if (!jobName.trim()) {
      setCreateError({ message: 'Please enter a name for this job.', showUpgrade: false });
      return;
    }
    if (!planUploaded || !pendingPlan) {
      setCreateError({ message: 'Please upload a plan or image to measure.', showUpgrade: false });
      return;
    }

    setCreating(true);
    try {
      const result = await createQuoteWithDetails({
        // Measure-first: customer is optional here. Fall back to the job name
        // so the quote always has a displayable customer label.
        customerName: customerName.trim() || jobName.trim(),
        jobName: jobName.trim(),
        templateId: null,
        entryMode: 'digital',
        measurementSystem,
        ...(genericTradesEnabled && selectedTrade ? { trade: selectedTrade as 'roofing' | 'cladding' | 'generic' | 'electrical' | 'plumbing' | 'landscaping' | 'flooring' | 'tiling' | 'foundations' | 'insulation' | 'painting' | 'fencing' | 'concrete' | 'construction' } : {}),
        ...(genericTradesEnabled && selectedCollectionId ? { componentCollectionId: selectedCollectionId } : {}),
      });

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
      if (!quoteId) return;

      // Move the pending upload into the quote prefix and save metadata -
      // same post-creation steps as the digital path in QuoteDetailsForm.
      const supabase = createClient();
      const finalPath = `${companyId}/${quoteId}/${pendingPlan.fileName}`;
      const { error: moveError } = await supabase.storage
        .from(pendingPlan.bucket)
        .move(pendingPlan.tempPath, finalPath);
      if (moveError) {
        setCreateError({ message: `Failed to attach plan: ${moveError.message}`, showUpgrade: false });
        setCreating(false);
        return;
      }
      await saveFileMetadata({
        companyId,
        quoteId,
        fileType: 'plan',
        fileName: pendingPlan.fileName,
        fileSize: pendingPlan.fileSize,
        mimeType: pendingPlan.mimeType,
        storagePath: finalPath,
      });

      router.push(`/${workspaceSlug}/quotes/${quoteId}/takeoff`);
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Failed to create job';
      const isBilling = /quote_limit_reached|feature_gated|subscription_inactive|storage_quota_exceeded|monthly quote limit|requires "/i.test(raw);
      setCreateError({ message: raw, showUpgrade: isBilling });
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40 p-4 overflow-y-auto">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-5 my-8"
      >
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Measure a job</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Upload your plan or image and start measuring - quantities and pricing follow automatically.
          </p>
        </div>

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

        {/* Job Name (required - this is a measure-first entry) */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Job Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={jobName}
            onChange={(e) => setJobName(e.target.value)}
            placeholder="e.g., 123 Main St re-roof"
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:border-orange-500"
            autoFocus
          />
        </div>

        {/* Customer Name (optional - can be added later on the quote) */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Customer Name <span className="text-slate-400">(optional)</span>
          </label>
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="e.g., John Smith"
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:border-orange-500"
          />
        </div>

        {/* Measurement System - locked once created, same options as new-quote */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Measurement System <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-slate-500 mb-3">
            Pick now - this <strong>cannot be changed later</strong>. Default comes from your company settings.
          </p>
          <div className="grid grid-cols-1 gap-2">
            {MEASUREMENT_OPTIONS.map((opt) => {
              const isActive = measurementSystem === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    if (opt.value === defaultMeasurementSystem) {
                      setMeasurementSystem(opt.value);
                      setPendingSystemSwitch(null);
                    } else {
                      setPendingSystemSwitch(opt.value);
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

        {/* Phase 8 (Generic Trades): trade + collection pickers, flag-gated */}
        {genericTradesEnabled && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
            <h4 className="text-sm font-semibold text-slate-800">Industry &amp; Component Collection</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Industry</label>
                <select
                  value={selectedTrade}
                  onChange={e => setSelectedTrade(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-orange-500"
                >
                  <option value="generic">Generic</option>
                  <option value="roofing">Roofing</option>
                  <option value="cladding">Cladding</option>
                  <option value="electrical">Electrical</option>
                  <option value="landscaping">Landscaping</option>
                  <option value="concrete">Concrete</option>
                  <option value="plumbing">Plumbing</option>
                  <option value="flooring">Flooring</option>
                  <option value="tiling">Tiling</option>
                  <option value="foundations">Foundations</option>
                  <option value="insulation">Insulation</option>
                  <option value="painting">Painting</option>
                  <option value="fencing">Fencing</option>
                  <option value="construction">Construction</option>
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
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-orange-500"
                  >
                    <option value="">All Components</option>
                    {componentCollections.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}{c.is_bootstrap ? ' (default)' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Plan upload - required, same signed-upload path as the digital flow */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
          <div>
            <h4 className="text-sm font-semibold text-slate-900 mb-1">Upload Plan / Image <span className="text-red-500">*</span></h4>
            <p className="text-xs text-slate-600 mb-3">
              PDF or image. Max 10 MB (PDF up to 50 MB).
            </p>
          </div>

          {planUploaded ? (
            <div className="flex items-center justify-between gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 min-w-0">
                <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm text-green-900 font-medium truncate">{pendingPlan?.fileName}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPlanUploaded(false);
                  setPendingPlan(null);
                }}
                className="text-xs font-medium text-slate-500 hover:text-slate-800 flex-shrink-0"
              >
                Replace
              </button>
            </div>
          ) : (
            <FileUploader
              accept="image/*,application/pdf"
              maxSize={10485760}
              pdfMaxSize={52428800}
              onUpload={handlePlanUpload}
              currentFileUrl={null}
              label="Upload Plan / Image"
              description="PDF up to 50 MB or image (max 10 MB)"
              isOverStorage={isOverStorage}
            />
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={creating || !jobName.trim() || !planUploaded}
            className="px-6 py-3 bg-black text-white font-medium rounded-full hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
          >
            {creating ? 'Starting...' : 'Start measuring'}
          </button>
        </div>

        {/* Confirm: switching away from the company default */}
        {pendingSystemSwitch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
              <h4 className="text-lg font-semibold text-slate-900">Switch measurement system?</h4>
              <p className="text-sm text-slate-600">
                You&apos;re about to use <strong>
                  {MEASUREMENT_OPTIONS.find((o) => o.value === pendingSystemSwitch)?.title}
                </strong> instead of your company default.
              </p>
              <p className="text-sm text-slate-600">
                This <strong>cannot be changed</strong> after the job is created. Are you sure?
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

        <UpgradeModal
          open={capUpgradeOpen}
          onClose={() => setCapUpgradeOpen(false)}
          title={`Monthly quote limit reached (${monthlyQuoteUsed}/${monthlyQuoteLimit})`}
          description={`To measure more jobs this month you need to upgrade your account tier, or wait until your limit resets next month. (${effectivePlanCode} plan)`}
          recommendedPlan="growth"
        />

        {/* PDF page picker modal (client-side pdfjs) */}
        {pdfPicker.modal}
      </form>
    </div>
  );
}
