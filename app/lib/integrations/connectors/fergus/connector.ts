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
import type { IntegrationEnvelopeV1 } from '../../contracts/envelope-v1';

const FERGUS_BASE = 'https://api.fergus.com';

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
    let jobId: number | null = null;
    let quoteId: number | null = null;

    // Check for existing mappings
    const existingCustomer = context.existingMappings.find((m) => m.externalType === 'contact');
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
          // Build mainContact - Fergus requires firstName, contact details go in contactItems array
          const contactItems: Array<{ contactType: string; contactValue: string }> = [];
          if (data.customer.email) contactItems.push({ contactType: 'email', contactValue: data.customer.email });
          if (data.customer.phone) contactItems.push({ contactType: 'phone', contactValue: data.customer.phone });

          // Split customer name into first/last for Fergus
          const nameParts = (data.customer.name || 'Unknown').trim().split(' ');
          const firstName = nameParts[0] || 'Unknown';
          const lastName = nameParts.slice(1).join(' ') || '';

          const customerBody: Record<string, unknown> = {
            customerFullName: data.customer.name,
            mainContact: {
              firstName,
              ...(lastName ? { lastName } : {}),
              ...(contactItems.length > 0 ? { contactItems } : {}),
            },
          };

          if (data.customer.billingAddress) {
            const addr = data.customer.billingAddress;
            const physicalAddress: Record<string, string> = {};
            if (addr.line1) physicalAddress.address1 = addr.line1;
            if (addr.city) physicalAddress.addressCity = addr.city;
            if (addr.postalCode) physicalAddress.addressPostcode = addr.postalCode;
            if (addr.country) physicalAddress.addressCountry = addr.country;
            if (Object.keys(physicalAddress).length > 0) {
              customerBody.physicalAddress = physicalAddress;
            }
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

    // Step 2: Create job (draft first, then we could finalise later)
    // Fergus non-draft jobs require a siteId, so we create as draft
    if (existingJob) {
      jobId = Number(existingJob.externalId);
      steps.push({
        type: 'upsert_job',
        status: 'skipped',
        externalId: String(jobId),
      });
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

        // Create a site for the job (required for non-draft jobs)
        let siteId: number | null = null;
        if (customerId) {
          try {
            const siteBody: Record<string, unknown> = {
              customerId,
              siteName: data.customer?.name || 'Site',
            };
            if (data.customer?.billingAddress) {
              const addr = data.customer.billingAddress;
              const siteAddress: Record<string, string> = {};
              if (addr.line1) siteAddress.address1 = addr.line1;
              if (addr.city) siteAddress.addressCity = addr.city;
              if (addr.postalCode) siteAddress.addressPostcode = addr.postalCode;
              if (addr.country) siteAddress.addressCountry = addr.country;
              if (Object.keys(siteAddress).length > 0) {
                siteBody.siteAddress = siteAddress;
              }
            }
            const siteRes = await fetch(`${FERGUS_BASE}/sites`, {
              method: 'POST',
              headers,
              body: JSON.stringify(siteBody),
              signal: AbortSignal.timeout(30000),
            });
            if (siteRes.ok) {
              const siteResult = await siteRes.json();
              siteId = siteResult.data?.id ?? siteResult.id;
            }
          } catch {
            // Site creation failed - will try draft job instead
          }
        }

        if (siteId) {
          jobBody.siteId = siteId;
        } else {
          // No site - create as draft instead
          jobBody.isDraft = true;
          delete (jobBody as Record<string, unknown>).siteId;
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
    if (scopes.customerFacingQuote && data.customerLines && data.customerLines.length > 0 && jobId) {
      try {
        const sections = buildQuoteSections(envelope, scopes);
        const quoteBody = {
          title: `Quote ${data.source.quoteNumber}`,
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
    if (scopes.filesAndPlans && data.files && data.files.length > 0 && jobId) {
      let uploaded = 0;
      let failed = 0;

      for (const file of data.files) {
        try {
          const signedUrl = await context.getSignedUrl(file.sourcePath, 300);
          if (!signedUrl) { failed++; continue; }
          const fileRes = await fetch(signedUrl, { signal: AbortSignal.timeout(30000) });
          if (!fileRes.ok) {
            failed++;
            continue;
          }

          const fileBuffer = await fileRes.arrayBuffer();
          const fileName = file.sourcePath.split('/').pop() || 'attachment';

          const formData = new FormData();
          formData.append('file', new Blob([fileBuffer]), fileName);
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
          } else {
            failed++;
          }
        } catch {
          failed++;
        }
      }

      steps.push({
        type: 'upload_supporting_file',
        status: failed === 0 ? 'succeeded' : (uploaded > 0 ? 'succeeded' : 'failed'),
        errorSummary: failed > 0 ? `${failed}/${data.files.length} files failed to upload` : undefined,
      });
      await context.logStep('upload_files', { responseSummary: { uploaded, failed, total: data.files.length }, errorSummary: failed > 0 ? `${failed}/${data.files.length} files failed` : undefined });
    }

    // Step 5: Add note
    try {
      const noteBody = {
        text: `Quote ${data.source.quoteNumber} exported from QuoteCore+ on ${new Date().toISOString()}`,
        entityName: 'job',
        entityId: jobId,
      };

      await fetch(`${FERGUS_BASE}/notes`, {
        method: 'POST',
        headers,
        body: JSON.stringify(noteBody),
        signal: AbortSignal.timeout(15000),
      });

      steps.push({ type: 'add_activity_note', status: 'succeeded' });
    } catch {
      steps.push({ type: 'add_activity_note', status: 'failed', errorSummary: 'Failed to add note' });
    }

    // Store external mappings
    if (customerId) {
      externalRecords.push({
        externalType: 'contact',
        externalId: String(customerId),
        externalUrl: `https://app.fergus.com/customers/${customerId}`,
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
    lines.push('--- Components ---');
    for (const comp of data.components) {
      lines.push(`  ${comp.name}: ${comp.quantity ?? 'N/A'} ${comp.pricingUnit || ''}`);
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
    sortOrder: number;
  }>;
}> {
  const data = envelope.data;
  const sections: Array<{ name: string; lineItems: Array<{ itemName: string; itemQuantity: number; itemPrice: number; itemCost: number; sortOrder: number }> }> = [];

  // Main quote lines
  if (data.customerLines && data.customerLines.length > 0) {
    const lineItems = data.customerLines.map((line, i) => ({
      itemName: line.description || 'Item',
      itemQuantity: line.quantity ? Number(line.quantity) : 1,
      itemPrice: line.lineTotal ? Number(line.lineTotal) : (line.unitPrice ? Number(line.unitPrice) : 0),
      itemCost: 0,
      sortOrder: i,
    }));
    sections.push({ name: 'Quote Items', lineItems });
  }

  // Labour lines as separate section
  if (scopes.labourBreakdown && data.labourLines && data.labourLines.length > 0) {
    const labourItems = data.labourLines.map((line, i) => ({
      itemName: line.description || 'Labour',
      itemQuantity: 1,
      itemPrice: line.amount != null ? Number(line.amount) : 0,
      itemCost: 0,
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

// Singleton instance
let _instance: FergusConnector | null = null;
export function getFergusConnector(): FergusConnector {
  if (!_instance) _instance = new FergusConnector();
  return _instance;
}
