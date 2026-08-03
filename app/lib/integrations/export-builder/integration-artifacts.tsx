'use client';

import { createClient } from '@/app/lib/supabase/client';
import { mintQuoteDocumentUploadUrl } from '@/app/lib/files/signed-upload';
import { saveFileMetadata } from '@/app/lib/files/storage-actions';
import { renderComponentToPdfBuffer } from '@/app/lib/pdf/renderComponentToPdf';
import { loadQuoteBundleData } from '@/app/(auth)/[workspaceSlug]/quotes/actions-bulk';
import {
  renderCustomerQuotePdfBuffer,
  renderLabourSheetPdfBuffer,
  sanitizeFilename,
} from '@/app/(auth)/[workspaceSlug]/quotes/lib/quote-bundle';
import { loadIntegrationArtifactData } from '@/app/(auth)/[workspaceSlug]/account/integrations/actions';
import type { QuoteExportV1 } from '../contracts/envelope-v1';

type GeneratedFileType =
  | 'customer_quote_pdf'
  | 'takeoff_report_pdf'
  | 'takeoff_data_json'
  | 'labour_sheet_pdf';

interface ExistingGeneratedArtifact {
  id: string;
  fileType: string;
  fileName: string;
}

interface PrepareOptions {
  quoteId: string;
  companyId: string;
  includeCustomerQuote: boolean;
  includeTakeoff: boolean;
  includeLabourSheet: boolean;
  existingArtifacts: ExistingGeneratedArtifact[];
}

interface GeneratedArtifactSpec {
  fileType: GeneratedFileType;
  fileName: string;
  mimeType: string;
  content: BlobPart;
}

function revisionTag(updatedAt: string): string {
  const milliseconds = new Date(updatedAt).getTime();
  return Number.isFinite(milliseconds) ? milliseconds.toString(36) : 'current';
}

function buildTakeoffJson(data: QuoteExportV1): string {
  return JSON.stringify({
    schemaVersion: '1.0',
    generatedAt: new Date().toISOString(),
    source: data.source,
    customer: { name: data.customer.name },
    site: data.site,
    job: {
      name: data.job.name,
      trade: data.job.trade,
      measurementSystem: data.job.measurementSystem,
    },
    roofAreas: data.roofAreas,
    components: data.components.map((component) => ({
      id: component.id,
      name: component.name,
      measurementType: component.measurementType,
      inputMode: component.inputMode,
      quantity: component.quantity,
      pricedQuantity: component.pricedQuantity,
      pricingUnit: component.pricingUnit,
      wastePercent: component.wastePercent,
      pitchDegrees: component.pitchDegrees,
      packSize: component.packSize,
      entries: component.entries,
    })),
  }, null, 2);
}

function TakeoffReport({ data }: { data: QuoteExportV1 }) {
  return (
    <div className="bg-white p-8 text-slate-900">
      <header className="border-b border-slate-200 pb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">QuoteCore+ Takeoff Report</p>
        <h1 className="mt-1 text-2xl font-semibold">Quote {data.source.quoteNumber ?? 'Draft'}</h1>
        <p className="mt-1 text-sm text-slate-500">{data.customer.name}{data.site.name ? ` ? ${data.site.name}` : ''}</p>
        <p className="mt-1 text-xs text-slate-400">Measurement system: {data.job.measurementSystem}</p>
      </header>

      <section className="mt-6" data-pdf-block>
        <h2 className="text-base font-semibold">Roof areas</h2>
        <div className="mt-2 overflow-hidden rounded-xl border border-slate-200">
          {data.roofAreas.map((area) => (
            <div key={area.id} className="grid grid-cols-[1fr_auto] gap-4 border-b border-slate-100 px-4 py-3 last:border-b-0">
              <div>
                <p className="text-sm font-medium">{area.label || 'Roof area'}</p>
                <p className="text-xs text-slate-500">Pitch: {area.pitchDegrees ?? '?'}?</p>
              </div>
              <p className="text-sm font-semibold">{area.finalArea ?? area.computedArea ?? area.planArea ?? '?'} m?</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-base font-semibold">Measured components</h2>
        <div className="mt-2 space-y-3">
          {data.components.map((component) => (
            <article key={component.id} className="rounded-xl border border-slate-200 px-4 py-3" data-pdf-block>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold">{component.name}</h3>
                  <p className="text-xs text-slate-500">
                    {component.measurementType ?? 'Measurement'} ? Waste {component.wastePercent ?? '0'}% ? Pitch {component.pitchDegrees ?? '?'}?
                  </p>
                </div>
                <p className="text-sm font-semibold">
                  {component.quantity ?? component.pricedQuantity ?? '?'} {component.pricingUnit ?? ''}
                </p>
              </div>
              {component.entries.length > 0 ? (
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-slate-100 pt-2 text-xs text-slate-600">
                  {component.entries.map((entry, index) => (
                    <div key={entry.id} className="flex justify-between gap-2">
                      <span>Entry {index + 1}</span>
                      <span>{entry.wasteAdjustedValue ?? entry.rawValue ?? '?'}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

async function uploadArtifact(
  quoteId: string,
  companyId: string,
  spec: GeneratedArtifactSpec,
): Promise<string> {
  const file = new File([spec.content], spec.fileName, { type: spec.mimeType });
  const mint = await mintQuoteDocumentUploadUrl({
    scope: { kind: 'quote', quoteId },
    filename: spec.fileName,
    contentType: spec.mimeType,
    claimedSize: file.size,
  });
  if (!mint.ok) throw new Error(mint.message);

  const supabase = createClient();
  const { error } = await supabase.storage
    .from(mint.bucket)
    .uploadToSignedUrl(mint.storagePath, mint.token, file, { contentType: spec.mimeType });
  if (error) throw new Error(error.message);

  const saved = await saveFileMetadata({
    companyId,
    quoteId,
    fileType: spec.fileType,
    fileName: spec.fileName,
    fileSize: file.size,
    mimeType: spec.mimeType,
    storagePath: mint.storagePath,
  });
  return saved.id;
}

export async function prepareIntegrationArtifacts(options: PrepareOptions): Promise<string[]> {
  if (!options.includeCustomerQuote && !options.includeTakeoff && !options.includeLabourSheet) return [];

  const [bundle, exportData] = await Promise.all([
    loadQuoteBundleData(options.quoteId),
    loadIntegrationArtifactData(options.companyId, options.quoteId),
  ]);
  if (!bundle || !exportData) throw new Error('Quote data could not be prepared for export');

  const quoteNumber = exportData.source.quoteNumber ?? 'DRAFT';
  const customer = sanitizeFilename(exportData.customer.name || 'Customer');
  const revision = revisionTag(bundle.quote.updatedAt);
  const prefix = `Quote-${quoteNumber}-${customer}`;
  const specs: GeneratedArtifactSpec[] = [];

  if (options.includeCustomerQuote) {
    specs.push({
      fileType: 'customer_quote_pdf',
      fileName: `${prefix}-Customer-Quote-r${revision}.pdf`,
      mimeType: 'application/pdf',
      content: await renderCustomerQuotePdfBuffer(bundle),
    });
  }
  if (options.includeTakeoff) {
    specs.push({
      fileType: 'takeoff_report_pdf',
      fileName: `${prefix}-Takeoff-Report-r${revision}.pdf`,
      mimeType: 'application/pdf',
      content: await renderComponentToPdfBuffer(<TakeoffReport data={exportData} />),
    });
    specs.push({
      fileType: 'takeoff_data_json',
      fileName: `${prefix}-Takeoff-Data-r${revision}.json`,
      mimeType: 'application/json',
      content: buildTakeoffJson(exportData),
    });
  }
  if (options.includeLabourSheet) {
    const labourSheet = await renderLabourSheetPdfBuffer(bundle);
    if (labourSheet) {
      specs.push({
        fileType: 'labour_sheet_pdf',
        fileName: `${prefix}-Labour-Sheet-r${revision}.pdf`,
        mimeType: 'application/pdf',
        content: labourSheet,
      });
    }
  }

  const artifactIds: string[] = [];
  for (const spec of specs) {
    const existing = options.existingArtifacts.find(
      (artifact) => artifact.fileType === spec.fileType && artifact.fileName === spec.fileName,
    );
    artifactIds.push(existing?.id ?? await uploadArtifact(options.quoteId, options.companyId, spec));
  }
  return artifactIds;
}
