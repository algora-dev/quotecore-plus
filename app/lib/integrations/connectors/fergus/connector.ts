/**
 * Fergus Connector
 *
 * Uses the Fergus Open API (api.fergus.com) for customers, jobs, and quotes.
 * https://api.fergus.com/docs/json
 *
 * Authentication: Personal Access Token (PAT) as Bearer token.
 * Generated in Fergus > Settings > Personal Access Tokens.
 *
 * Flow:
 * 1. User pastes PAT in integrations settings
 * 2. We validate by calling GET /users/me
 * 3. On export: create customer, create job, create quote with line items, upload attachments
 * 4. Store external IDs for idempotency
 */

import type {
  Connector,
  ConnectorCapabilities,
  ExportEvent,
  IntegrationConfig,
  ValidationResult,
  ConnectorContext,
  IntegrationPlan,
  ConnectorExecutionResult,
  PlanStep,
  StepResult,
  CreatedExternalRecord,
  ExecutionContext,
} from '../../contracts/connector';
import type {
  Address,
  DocumentManifestItem,
  FileManifestItem,
  IntegrationEnvelopeV1,
} from '../../contracts/envelope-v1';

const FERGUS_BASE = 'https://api.fergus.com';
const FERGUS_MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

const CAPABILITIES: ConnectorCapabilities = {
  supportsContacts: true,
  supportsSites: true,
  supportsJobs: true,
  supportsQuotes: true,
  supportsLineItems: true,
  supportsAttachments: true,
  supportsCreate: true,
  supportsUpdate: true,
  supportsWebhooks: false,
  supportsAutomaticSync: false,
};

const SUPPORTED_EVENTS: ExportEvent[] = [
  'quote_confirmed',
  'quote_sent',
  'quote_accepted',
  'manual_export',
];

export class FergusConnector implements Connector {
  readonly provider = 'fergus';
  readonly capabilities = CAPABILITIES;
  readonly supportedEvents = SUPPORTED_EVENTS;

  async validateConfig(config: IntegrationConfig): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config.config) {
      warnings.push('No additional config required for Fergus');
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  async validateExport(
    envelope: IntegrationEnvelopeV1,
    _config: IntegrationConfig
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!envelope.data.customer?.name) {
      warnings.push('Customer name is empty - customer creation may fail');
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  async plan(
    envelope: IntegrationEnvelopeV1,
    config: IntegrationConfig,
    _context: ConnectorContext
  ): Promise<IntegrationPlan> {
    const steps: PlanStep[] = [];
    const scopes = config.dataScopes;
    const data = envelope.data;

    // Step 1: Create customer
    if (scopes.customerDetails && data.customer?.name) {
      steps.push({
        type: 'upsert_contact',
        description: `Create customer for ${data.customer.name}`,
        optional: false,
      });
    }

    if (scopes.siteDetails && (data.site.address || data.customer?.billingAddress)) {
      steps.push({
        type: 'upsert_site',
        description: `Create site for ${data.site.name || data.job.name || data.customer?.name || 'job'}`,
        optional: false,
      });
    }

    // Step 2: Create job
    steps.push({
      type: 'upsert_job',
      description: `Create job for quote ${data.source.quoteNumber}`,
      optional: false,
    });

    // Step 3: Create quote with line items
    if (scopes.customerFacingQuote && data.customerLines && data.customerLines.length > 0) {
      steps.push({
        type: 'create_or_update_quote',
        description: `Create quote with ${data.customerLines.length} line item(s)`,
        optional: false,
      });
    }

    // Step 4: Upload files
    if (scopes.filesAndPlans && data.files && data.files.length > 0) {
      steps.push({
        type: 'upload_supporting_file',
        description: `Upload ${data.files.length} file(s) to job`,
        optional: true,
      });
    }

    // Step 5: Add note
    steps.push({
      type: 'add_activity_note',
      description: 'Log quote export note',
      optional: true,
    });

    return {
      steps,
      willCreate: true,
      willUpdate: false,
      summary: 'Create customer, job, and quote in Fergus',
    };
  }

  async execute(
    plan: IntegrationPlan,
    envelope: IntegrationEnvelopeV1,
    config: IntegrationConfig,
    context: ExecutionContext
  ): Promise<ConnectorExecutionResult> {
    const pat = await context.getCredential('apiKey');
    if (!pat) {
      return {
        status: 'failed',
        steps: [],
        externalRecords: [],
        errorSummary: 'Missing PAT credential',
      };
    }

    const data = envelope.data;
    const scopes = config.dataScopes;
    const steps: StepResult[] = [];
    const externalRecords: CreatedExternalRecord[] = [];
    const headers: Record<string, string> = {
      Authorization: `Bearer ${pat}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    let customerId: number | null = null;
    let siteId: number | null = null;
    let jobId: number | null = null;
    let quoteId: number | null = null;

    // Check for existing mappings
    const existingCustomer = context.existingMappings.find((m) => m.externalType === 'contact');
    const existingSite = context.existingMappings.find((m) => m.externalType === 'site');
    const existingJob = context.existingMappings.find((m) => m.externalType === 'job');

    // Step 1: Create customer
    if (scopes.customerDetails && data.customer?.name) {
      if (existingCustomer) {
        customerId = Number(existingCustomer.externalId);
        steps.push({
          type: 'upsert_contact',
          status: 'skipped',
          externalId: String(customerId),
        });
      } else {
        try {
          const customerBody: Record<string, unknown> = {
            customerFullName: data.customer.name,
            mainContact: buildPersonPayload(data.customer.name, data.customer.email, data.customer.phone),
          };

          const physicalAddress = buildAddressPayload(data.customer.billingAddress);
          if (physicalAddress) {
            customerBody.physicalAddress = physicalAddress;
          }

          const res = await fetch(`${FERGUS_BASE}/customers`, {
            method: 'POST',
            headers,
            body: JSON.stringify(customerBody),
            signal: AbortSignal.timeout(30000),
          });

          if (res.ok) {
            const result = await res.json();
            customerId = result.data?.id ?? result.id;
            steps.push({
              type: 'upsert_contact',
              status: 'succeeded',
              externalId: String(customerId),
              externalUrl: `https://app.fergus.com/customers/${customerId}`,
            });
            await context.logStep('upsert_contact', { responseSummary: { customerId, name: data.customer.name } });
          } else {
            const errText = await res.text().catch(() => 'Unknown error');
            steps.push({
              type: 'upsert_contact',
              status: 'failed',
              errorSummary: `Failed to create customer: ${res.status} ${errText.slice(0, 200)}`,
            });
            return {
              status: 'failed',
              steps,
              externalRecords,
              errorSummary: `Failed to create customer: ${res.status}`,
            };
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          steps.push({ type: 'upsert_contact', status: 'failed', errorSummary: msg });
          return { status: 'failed', steps, externalRecords, errorSummary: msg };
        }
      }
    }

    // Step 2: Create or repair the job.
    if (existingJob) {
      jobId = Number(existingJob.externalId);
      try {
        const existingResponse = await fetch(`${FERGUS_BASE}/jobs/${jobId}`, {
          headers,
          signal: AbortSignal.timeout(30000),
        });
        if (!existingResponse.ok) {
          throw new Error(`Failed to load mapped job: ${existingResponse.status}`);
        }

        const existingPayload = await existingResponse.json();
        const isDraftJob = !existingPayload.data?.jobNumber;
        if (!isDraftJob) {
          steps.push({ type: 'upsert_job', status: 'skipped', externalId: String(jobId) });
        } else {
          if (existingSite) {
            siteId = Number(existingSite.externalId);
            steps.push({ type: 'upsert_site', status: 'skipped', externalId: String(siteId) });
          } else {
            const siteResult = await createFergusSite(envelope, headers, context);
            siteId = siteResult.siteId;
            steps.push(siteResult.step);
          }

          // If we don't have both customer and site, we can't finalise the draft.
          // Still update what we can and continue with quote/files/notes on the draft job.
          if (customerId) {
            const updates: Array<Record<string, unknown>> = [
              { title: data.job.name || `Quote ${data.source.quoteNumber || ''}` },
              { description: buildJobDescription(envelope, scopes) },
              { customerId },
              { customerReference: String(data.source.quoteNumber ?? '') },
            ];
            if (siteId) {
              updates.push({ siteId });
            }
            for (const update of updates) {
              const updateResponse = await fetch(`${FERGUS_BASE}/jobs/${jobId}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(update),
                signal: AbortSignal.timeout(30000),
              });
              if (!updateResponse.ok) {
                const errorText = await updateResponse.text().catch(() => 'Unknown error');
                await context.logStep('repair_draft_job', {
                  errorSummary: `PUT failed: ${updateResponse.status} ${errorText.slice(0, 300)}`,
                });
              }
            }
          }

          // Try to finalise if we have both customer and site
          if (customerId && siteId) {
            const finaliseResponse = await fetch(`${FERGUS_BASE}/jobs/${jobId}/finalise`, {
              method: 'PUT',
              headers,
              signal: AbortSignal.timeout(30000),
            });
            if (!finaliseResponse.ok) {
              const errorText = await finaliseResponse.text().catch(() => 'Unknown error');
              await context.logStep('repair_draft_job', {
                errorSummary: `Finalise failed: ${finaliseResponse.status} ${errorText.slice(0, 300)}`,
              });
              // Don't fail - continue with quote/files/notes on the draft job
            } else {
              await context.logStep('repair_draft_job', {
                responseStatus: finaliseResponse.status,
                responseSummary: { jobId, siteId, finalised: true },
              });
            }
          } else {
            // Can't finalise without site - log but continue
            await context.logStep('repair_draft_job', {
              errorSummary: 'Cannot finalise draft job - no site address available. Continuing with draft job.',
            });
          }

          steps.push({ type: 'upsert_job', status: 'succeeded', externalId: String(jobId) });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to repair mapped job';
        steps.push({ type: 'upsert_job', status: 'failed', errorSummary: message });
        await context.logStep('repair_draft_job', { errorSummary: message });
        // Don't return failed - continue with quote/files/notes if we have a jobId
      }
    } else {
      try {
        const jobBody: Record<string, unknown> = {
          jobType: 'Quote',
          isDraft: false,
          title: data.job.name || `Quote ${data.source.quoteNumber}`,
          description: buildJobDescription(envelope, scopes),
          customerReference: data.source.quoteNumber,
        };

        if (customerId) {
          jobBody.customerId = customerId;
        }

        // Create a site for the job (required for non-draft jobs).
        if (existingSite) {
          siteId = Number(existingSite.externalId);
          steps.push({ type: 'upsert_site', status: 'skipped', externalId: String(siteId) });
        }
        if (!siteId) {
          const siteResult = await createFergusSite(envelope, headers, context);
          siteId = siteResult.siteId;
          steps.push(siteResult.step);
        }

        if (siteId) {
          jobBody.siteId = siteId;
        } else {
          // Without a valid site Fergus only permits a draft job. Marking the
          // site step failed prevents this degraded export being shown as success.
          jobBody.isDraft = true;
          delete (jobBody as Record<string, unknown>).siteId;
          if (!steps.some((step) => step.type === 'upsert_site' && step.status === 'failed')) {
            steps.push({
              type: 'upsert_site',
              status: 'failed',
              errorSummary: 'A site address is required to create an active Fergus job',
            });
          }
        }

        const res = await fetch(`${FERGUS_BASE}/jobs`, {
          method: 'POST',
          headers,
          body: JSON.stringify(jobBody),
          signal: AbortSignal.timeout(30000),
        });

        if (res.ok) {
          const result = await res.json();
          jobId = result.data?.id ?? result.id;
          steps.push({
            type: 'upsert_job',
            status: 'succeeded',
            externalId: String(jobId),
            externalUrl: `https://app.fergus.com/jobs/${jobId}`,
          });
          await context.logStep('upsert_job', { responseSummary: { jobId, title: jobBody.title } });
        } else {
          const errText = await res.text().catch(() => 'Unknown error');
          steps.push({
            type: 'upsert_job',
            status: 'failed',
            errorSummary: `Failed to create job: ${res.status} ${errText.slice(0, 200)}`,
          });
          return {
            status: 'failed',
            steps,
            externalRecords,
            errorSummary: `Failed to create job: ${res.status}`,
          };
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        steps.push({ type: 'upsert_job', status: 'failed', errorSummary: msg });
        return { status: 'failed', steps, externalRecords, errorSummary: msg };
      }
    }

    // Step 3: Create quote with line items
    // Always create a quote if we have a job - even with no line items,
    // an empty quote section is valid and gives the job a quote record.
    if (scopes.customerFacingQuote && jobId) {
      try {
        const sections = buildQuoteSections(envelope, scopes);
        const quoteBody = {
          title: `Quote ${data.source.quoteNumber || ''}`.trim(),
          description: buildJobDescription(envelope, scopes),
          dueDays: 30,
          sections,
        };

        const res = await fetch(`${FERGUS_BASE}/jobs/${jobId}/quotes`, {
          method: 'POST',
          headers,
          body: JSON.stringify(quoteBody),
          signal: AbortSignal.timeout(30000),
        });

        if (res.ok) {
          const result = await res.json();
          quoteId = result.data?.id ?? result.id;
          steps.push({
            type: 'create_or_update_quote',
            status: 'succeeded',
            externalId: String(quoteId),
            externalUrl: `https://app.fergus.com/jobs/${jobId}/quotes/${quoteId}`,
          });
          await context.logStep('create_or_update_quote', { responseSummary: { quoteId, sections: sections.length } });
        } else {
          const errText = await res.text().catch(() => 'Unknown error');
          steps.push({
            type: 'create_or_update_quote',
            status: 'failed',
            errorSummary: `Failed to create quote: ${res.status} ${errText.slice(0, 200)}`,
          });
          await context.logStep('create_or_update_quote', { errorSummary: `Failed: ${res.status} ${errText.slice(0, 500)}`, requestSummary: { quoteBody } });
          // Don't return failed - job was created, quote is secondary
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        steps.push({ type: 'create_or_update_quote', status: 'failed', errorSummary: msg });
        await context.logStep('create_or_update_quote', { errorSummary: msg });
      }
    }

    // Step 4: Upload files
    const filesToUpload = data.artifacts?.length
      ? data.artifacts.map((artifact) => ({
          fileName: artifact.fileName,
          mimeType: artifact.mimeType,
          sizeBytes: artifact.sizeBytes,
          sourcePath: artifact.sourcePath,
        }))
      : getFilesToUpload(data.files, data.documents);
    if (scopes.filesAndPlans && filesToUpload.length > 0 && jobId) {
      let uploaded = 0;
      let failed = 0;

      for (const file of filesToUpload) {
        const fileName = file.fileName || file.sourcePath.split('/').pop() || 'attachment';
        try {
          if (file.sizeBytes != null && file.sizeBytes > FERGUS_MAX_ATTACHMENT_BYTES) {
            failed++;
            await context.logStep('upload_file_failed', {
              errorClass: 'file_too_large',
              errorSummary: `${fileName}: exceeds Fergus's 20 MB attachment limit`,
              requestSummary: { fileName, sizeBytes: file.sizeBytes },
            });
            continue;
          }

          const signedUrl = await context.getSignedUrl(file.sourcePath, 300);
          if (!signedUrl) {
            failed++;
            await context.logStep('upload_file_failed', {
              errorClass: 'signed_url_failed',
              errorSummary: `${fileName}: could not create a signed download URL`,
              requestSummary: { fileName },
            });
            continue;
          }
          const fileRes = await fetch(signedUrl, { signal: AbortSignal.timeout(30000) });
          if (!fileRes.ok) {
            failed++;
            await context.logStep('upload_file_failed', {
              responseStatus: fileRes.status,
              errorClass: 'source_download_failed',
              errorSummary: `${fileName}: source download returned ${fileRes.status}`,
              requestSummary: { fileName },
            });
            continue;
          }

          const fileBuffer = await fileRes.arrayBuffer();
          if (fileBuffer.byteLength > FERGUS_MAX_ATTACHMENT_BYTES) {
            failed++;
            await context.logStep('upload_file_failed', {
              errorClass: 'file_too_large',
              errorSummary: `${fileName}: exceeds Fergus's 20 MB attachment limit`,
              requestSummary: { fileName, sizeBytes: fileBuffer.byteLength },
            });
            continue;
          }

          const formData = new FormData();
          formData.append(
            'file',
            new Blob([fileBuffer], { type: file.mimeType || 'application/octet-stream' }),
            fileName
          );
          formData.append('entityType', 'job');
          formData.append('entityId', String(jobId));

          const uploadRes = await fetch(`${FERGUS_BASE}/attachments`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${pat}` },
            body: formData,
            signal: AbortSignal.timeout(60000),
          });

          if (uploadRes.ok) {
            uploaded++;
            await context.logStep('upload_file_succeeded', {
              responseStatus: uploadRes.status,
              responseSummary: { fileName, sizeBytes: fileBuffer.byteLength },
            });
          } else {
            failed++;
            const errorText = await uploadRes.text().catch(() => 'Unknown error');
            await context.logStep('upload_file_failed', {
              responseStatus: uploadRes.status,
              errorSummary: `${fileName}: ${uploadRes.status} ${errorText.slice(0, 300)}`,
            });
          }
        } catch (error) {
          failed++;
          await context.logStep('upload_file_failed', {
            errorSummary: `${file.fileName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          });
        }
      }

      steps.push({
        type: 'upload_supporting_file',
        status: failed === 0 ? 'succeeded' : (uploaded > 0 ? 'succeeded' : 'failed'),
        errorSummary: failed > 0 ? `${failed}/${filesToUpload.length} files failed to upload` : undefined,
      });
      await context.logStep('upload_files', {
        responseSummary: { uploaded, failed, total: filesToUpload.length },
        errorSummary: failed > 0 ? `${failed}/${filesToUpload.length} files failed` : undefined,
      });
    }

    // Step 5: Add note (only if we have a job)
    if (jobId) {
    try {
      const noteBody = {
        text: buildJobDescription(envelope, scopes),
        entityName: 'job' as const,
        entityId: jobId,
      };

      const noteResponse = await fetch(`${FERGUS_BASE}/notes`, {
        method: 'POST',
        headers,
        body: JSON.stringify(noteBody),
        signal: AbortSignal.timeout(15000),
      });

      if (!noteResponse.ok) {
        const errorText = await noteResponse.text().catch(() => 'Unknown error');
        throw new Error(`${noteResponse.status} ${errorText.slice(0, 300)}`);
      }

      steps.push({ type: 'add_activity_note', status: 'succeeded' });
      await context.logStep('add_activity_note', { responseStatus: noteResponse.status });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add note';
      steps.push({ type: 'add_activity_note', status: 'failed', errorSummary: message });
      await context.logStep('add_activity_note', { errorSummary: message });
    }
    } // end if (jobId) for notes

    // Store external mappings
    if (customerId) {
      externalRecords.push({
        externalType: 'contact',
        externalId: String(customerId),
        externalUrl: `https://app.fergus.com/customers/${customerId}`,
      });
    }
    if (siteId) {
      externalRecords.push({
        externalType: 'site',
        externalId: String(siteId),
        externalUrl: `https://app.fergus.com/sites/${siteId}`,
      });
    }
    if (jobId) {
      externalRecords.push({
        externalType: 'job',
        externalId: String(jobId),
        externalUrl: `https://app.fergus.com/jobs/${jobId}`,
      });
    }
    if (quoteId) {
      externalRecords.push({
        externalType: 'quote',
        externalId: String(quoteId),
        externalUrl: `https://app.fergus.com/jobs/${jobId}/quotes/${quoteId}`,
      });
    }

    const hasFailures = steps.some((s) => s.status === 'failed');
    const criticalFailed = steps.some((s) => (s.type === 'upsert_job' || s.type === 'upsert_contact') && s.status === 'failed');

    return {
      status: criticalFailed ? 'failed' : (hasFailures ? 'partially_completed' : 'succeeded'),
      steps,
      externalRecords,
      errorSummary: hasFailures ? 'Some steps failed - see step details' : undefined,
    };
  }
}

/**
 * Build a text description of the quote for the Fergus job record.
 */
function buildJobDescription(
  envelope: IntegrationEnvelopeV1,
  scopes: { customerFacingQuote?: boolean; measurementsAndTakeoff?: boolean; labourBreakdown?: boolean; internalCosts?: boolean; marginInformation?: boolean }
): string {
  const data = envelope.data;
  const lines: string[] = [];

  lines.push(`Quote: ${data.source.quoteNumber}`);
  if (data.job.name) lines.push(`Job: ${data.job.name}`);
  if (data.customer?.name) lines.push(`Customer: ${data.customer.name}`);
  lines.push(`Status: ${data.job.status}`);
  lines.push(`Currency: ${data.quote.currency}`);
  lines.push('');

  if (scopes.measurementsAndTakeoff && data.components && data.components.length > 0) {
    lines.push('--- Measurements & Takeoff ---');
    for (const comp of data.components) {
      lines.push(`  ${comp.name}: ${comp.quantity ?? comp.pricedQuantity ?? 'N/A'} ${comp.pricingUnit || ''}`.trimEnd());
      for (const entry of comp.entries || []) {
        const measuredValue = entry.wasteAdjustedValue || entry.rawValue || 'N/A';
        const pitch = entry.pitchDegrees != null ? ` at ${entry.pitchDegrees}°` : '';
        lines.push(`    - ${measuredValue}${pitch}`);
      }
    }
    for (const area of data.roofAreas || []) {
      const areaValue = area.finalArea ?? area.computedArea ?? area.planArea ?? 'N/A';
      lines.push(`  ${area.label || 'Roof area'}: ${areaValue} m²`);
    }
    lines.push('');
  }

  if (data.totals) {
    lines.push('--- Totals ---');
    if (data.totals.customerTotals?.subtotalExcludingTax) lines.push(`  Subtotal: ${data.totals.customerTotals.subtotalExcludingTax}`);
    if (data.totals.customerTotals?.taxTotal) lines.push(`  Tax: ${data.totals.customerTotals.taxTotal}`);
    if (data.totals.customerTotals?.totalIncludingTax) lines.push(`  Grand Total: ${data.totals.customerTotals.totalIncludingTax}`);
  }

  lines.push('');
  lines.push(`Exported from QuoteCore+ on ${new Date().toISOString()}`);

  return lines.join('\n');
}

/**
 * Build Fergus quote sections from the envelope's customer-facing lines.
 */
function buildQuoteSections(
  envelope: IntegrationEnvelopeV1,
  scopes: { customerFacingQuote?: boolean; labourBreakdown?: boolean }
): Array<{
  name: string;
  lineItems: Array<{
    itemName: string;
    itemQuantity: number;
    itemPrice: number;
    itemCost: number;
    isLabour: boolean;
    sortOrder: number;
  }>;
}> {
  const data = envelope.data;
  const sections: Array<{ name: string; lineItems: Array<{ itemName: string; itemQuantity: number; itemPrice: number; itemCost: number; isLabour: boolean; sortOrder: number }> }> = [];

  // Main quote lines (materials/services)
  if (data.customerLines && data.customerLines.length > 0) {
    const lineItems = data.customerLines.map((line, i) => {
      const itemQuantity = toFiniteNumber(line.quantity, 1);
      const lineTotal = toFiniteNumber(line.lineTotal, 0);
      const itemPrice = line.unitPrice != null
        ? toFiniteNumber(line.unitPrice, 0)
        : itemQuantity !== 0 ? lineTotal / itemQuantity : lineTotal;

      return {
        itemName: line.description || 'Item',
        itemQuantity,
        itemPrice,
        itemCost: 0,
        // Fergus API requires each line item to have either isLabour OR salesAccountId.
        // We don't have Fergus sales account IDs configured, so use isLabour for all items.
        isLabour: true,
        sortOrder: i,
      };
    });
    sections.push({ name: 'Quote Items', lineItems });
  }

  // Labour lines as separate section
  if (scopes.labourBreakdown && data.labourLines && data.labourLines.length > 0) {
    const labourItems = data.labourLines.map((line, i) => ({
      itemName: line.description || 'Labour',
      itemQuantity: 1,
      itemPrice: line.amount != null ? Number(line.amount) : 0,
      itemCost: 0,
      isLabour: true,
      sortOrder: i,
    }));
    sections.push({ name: 'Labour', lineItems: labourItems });
  }

  // If no sections, create an empty one (Fergus requires at least one section)
  if (sections.length === 0) {
    sections.push({ name: 'Quote Items', lineItems: [] });
  }

  return sections;
}

function buildPersonPayload(name: string, email: string | null, phone: string | null) {
  const nameParts = name.trim().split(/\s+/);
  const firstName = nameParts.shift() || 'Unknown';
  const lastName = nameParts.join(' ');
  const contactItems: Array<{ contactType: 'email' | 'phone'; contactValue: string }> = [];
  if (email) contactItems.push({ contactType: 'email', contactValue: email });
  if (phone) contactItems.push({ contactType: 'phone', contactValue: phone });

  return {
    firstName,
    ...(lastName ? { lastName } : {}),
    ...(contactItems.length > 0 ? { contactItems } : {}),
  };
}

async function createFergusSite(
  envelope: IntegrationEnvelopeV1,
  headers: Record<string, string>,
  context: ExecutionContext
): Promise<{ siteId: number | null; step: StepResult }> {
  const data = envelope.data;
  // Try site address, then customer billing address, then fall back to the
  // job/site name as address1 (common when users put the address in the job name)
  const siteAddress = buildAddressPayload(data.site.address || data.customer?.billingAddress || null);
  if (!siteAddress) {
    // Last resort: use the site/job name as address1 so we can still create
    // a non-draft job in Fergus. Better than creating a draft job that hides data.
    const fallbackAddress = data.site.name || data.job.name;
    if (!fallbackAddress) {
      return {
        siteId: null,
        step: {
          type: 'upsert_site',
          status: 'failed',
          errorSummary: 'A site address is required to create an active Fergus job',
        },
      };
    }
    const fallbackSiteAddress = buildAddressPayload({
      line1: fallbackAddress,
      line2: null,
      city: null,
      region: null,
      postalCode: null,
      country: null,
      fullAddress: fallbackAddress,
    });
    if (!fallbackSiteAddress) {
      return {
        siteId: null,
        step: {
          type: 'upsert_site',
          status: 'failed',
          errorSummary: 'A site address is required to create an active Fergus job',
        },
      };
    }
    // Use the fallback address
    const siteBody: Record<string, unknown> = {
      name: data.site.name || data.job.name || data.customer?.name || 'Site',
      defaultContact: buildPersonPayload(
        data.customer?.name || 'Site contact',
        data.customer?.email || null,
        data.customer?.phone || null
      ),
      siteAddress: fallbackSiteAddress,
    };
    try {
      const response = await fetch(`${FERGUS_BASE}/sites`, {
        method: 'POST',
        headers,
        body: JSON.stringify(siteBody),
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        await context.logStep('upsert_site', {
          responseStatus: response.status,
          errorSummary: `Failed: ${response.status} ${errorText.slice(0, 500)}`,
          requestSummary: { siteBody },
        });
        return {
          siteId: null,
          step: {
            type: 'upsert_site',
            status: 'failed',
            errorSummary: `Failed to create site: ${response.status}`,
          },
        };
      }
      const result = await response.json();
      const siteId = Number(result.data?.id ?? result.id);
      await context.logStep('upsert_site', {
        responseStatus: response.status,
        responseSummary: { siteId, fallbackAddress: true },
      });
      return {
        siteId,
        step: { type: 'upsert_site', status: 'succeeded', externalId: String(siteId) },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown site error';
      await context.logStep('upsert_site', { errorSummary: message });
      return {
        siteId: null,
        step: { type: 'upsert_site', status: 'failed', errorSummary: message },
      };
    }
  }

  // We have a real site address - use it
  const siteBody: Record<string, unknown> = {
    name: data.site.name || data.job.name || data.customer?.name || 'Site',
    defaultContact: buildPersonPayload(
      data.customer?.name || 'Site contact',
      data.customer?.email || null,
      data.customer?.phone || null
    ),
    siteAddress,
  };

  try {
    const response = await fetch(`${FERGUS_BASE}/sites`, {
      method: 'POST',
      headers,
      body: JSON.stringify(siteBody),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      await context.logStep('upsert_site', {
        responseStatus: response.status,
        errorSummary: `Failed: ${response.status} ${errorText.slice(0, 500)}`,
        requestSummary: { siteBody },
      });
      return {
        siteId: null,
        step: {
          type: 'upsert_site',
          status: 'failed',
          errorSummary: `Failed to create site: ${response.status}`,
        },
      };
    }

    const result = await response.json();
    const siteId = Number(result.data?.id ?? result.id);
    await context.logStep('upsert_site', {
      responseStatus: response.status,
      responseSummary: { siteId },
    });
    return {
      siteId,
      step: { type: 'upsert_site', status: 'succeeded', externalId: String(siteId) },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown site error';
    await context.logStep('upsert_site', { errorSummary: message });
    return {
      siteId: null,
      step: { type: 'upsert_site', status: 'failed', errorSummary: message },
    };
  }
}

function buildAddressPayload(address: Address | null): Record<string, string> | null {
  if (!address) return null;
  const address1 = address.line1 || address.fullAddress;
  if (!address1) return null;

  return {
    address1,
    ...(address.line2 ? { address2: address.line2 } : {}),
    ...(address.city ? { addressCity: address.city } : {}),
    ...(address.region ? { addressRegion: address.region } : {}),
    ...(address.postalCode ? { addressPostcode: address.postalCode } : {}),
    ...(address.country ? { addressCountry: address.country } : {}),
  };
}

function getFilesToUpload(
  files: FileManifestItem[],
  documents: DocumentManifestItem[]
): Array<{ fileName: string; mimeType: string | null; sizeBytes: number | null; sourcePath: string }> {
  const uniqueFiles = new Map<string, { fileName: string; mimeType: string | null; sizeBytes: number | null; sourcePath: string }>();
  for (const file of [...files, ...documents]) {
    if (!file.sourcePath || uniqueFiles.has(file.sourcePath)) continue;
    uniqueFiles.set(file.sourcePath, {
      fileName: file.fileName,
      mimeType: file.mimeType,
      sizeBytes: 'sizeBytes' in file ? file.sizeBytes : null,
      sourcePath: file.sourcePath,
    });
  }
  return [...uniqueFiles.values()];
}

function toFiniteNumber(value: string | number | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

// Singleton instance
let _instance: FergusConnector | null = null;
export function getFergusConnector(): FergusConnector {
  if (!_instance) _instance = new FergusConnector();
  return _instance;
}
