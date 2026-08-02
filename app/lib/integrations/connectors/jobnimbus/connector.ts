/**
 * JobNimbus Connector
 *
 * Uses the JobNimbus legacy API (app.jobnimbus.com/api1/) for contacts and jobs,
 * which is the same API their Zapier integration uses.
 *
 * Authentication: API key (Bearer token) generated in JobNimbus > Settings > API Keys.
 *
 * Flow:
 * 1. User pastes API key in integrations settings
 * 2. We validate by calling GET /api1/contacts?limit=1
 * 3. On export: create contact, create job, upload files as attachments
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

const JOBNIMBUS_BASE = 'https://app.jobnimbus.com/api1';

const CAPABILITIES: ConnectorCapabilities = {
  supportsContacts: true,
  supportsSites: false,
  supportsJobs: true,
  supportsQuotes: false,
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

export class JobNimbusConnector implements Connector {
  readonly provider = 'jobnimbus';
  readonly capabilities = CAPABILITIES;
  readonly supportedEvents = SUPPORTED_EVENTS;

  async validateConfig(config: IntegrationConfig): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // API key is stored as a credential, not in config, so we just validate config shape
    if (!config.config) {
      warnings.push('No additional config required for JobNimbus');
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
      warnings.push('Customer name is empty - contact creation may fail');
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

    // Step 1: Create contact
    if (scopes.customerDetails && data.customer?.name) {
      steps.push({
        type: 'upsert_contact',
        description: `Create contact for ${data.customer.name}`,
        optional: false,
      });
    }

    // Step 2: Create job
    steps.push({
      type: 'upsert_job',
      description: `Create job for quote ${data.source.quoteNumber}`,
      optional: false,
    });

    // Step 3: Upload files
    if (scopes.filesAndPlans && data.files && data.files.length > 0) {
      steps.push({
        type: 'upload_supporting_file',
        description: `Upload ${data.files.length} file(s) to job`,
        optional: true,
      });
    }

    // Step 4: Add activity note
    steps.push({
      type: 'add_activity_note',
      description: 'Log quote export activity',
      optional: true,
    });

    return {
      steps,
      willCreate: true,
      willUpdate: false,
      summary: 'Create contact and job in JobNimbus',
    };
  }

  async execute(
    plan: IntegrationPlan,
    envelope: IntegrationEnvelopeV1,
    config: IntegrationConfig,
    context: ExecutionContext
  ): Promise<ConnectorExecutionResult> {
    const apiKey = await context.getCredential('apiKey');
    if (!apiKey) {
      return {
        status: 'failed',
        steps: [],
        externalRecords: [],
        errorSummary: 'Missing API key credential',
      };
    }

    const data = envelope.data;
    const scopes = config.dataScopes;
    const steps: StepResult[] = [];
    const externalRecords: CreatedExternalRecord[] = [];
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    let contactId: string | null = null;
    let jobId: string | null = null;

    // Check for existing mappings
    const existingContact = context.existingMappings.find((m) => m.externalType === 'contact');
    const existingJob = context.existingMappings.find((m) => m.externalType === 'job');

    // Step 1: Create contact
    if (scopes.customerDetails && data.customer?.name) {
      if (existingContact) {
        contactId = existingContact.externalId;
        steps.push({
          type: 'upsert_contact',
          status: 'skipped',
          externalId: contactId || undefined,
        });
      } else {
        try {
          const contactBody = {
            name: data.customer.name,
            email: data.customer.email || undefined,
            phone: data.customer.phone || undefined,
            address: data.customer.billingAddress ? {
              street: data.customer.billingAddress.line1 || undefined,
              city: data.customer.billingAddress.city || undefined,
              state: data.customer.billingAddress.region || undefined,
              zip: data.customer.billingAddress.postalCode || undefined,
              country: data.customer.billingAddress.country || undefined,
            } : undefined,
          };

          const res = await fetch(`${JOBNIMBUS_BASE}/contacts`, {
            method: 'POST',
            headers,
            body: JSON.stringify(contactBody),
            signal: AbortSignal.timeout(30000),
          });

          if (res.ok) {
            const result = await res.json();
            contactId = result.jnid || result.id || result.record_id;
            steps.push({
              type: 'upsert_contact',
              status: 'succeeded',
              externalId: contactId || undefined,
              externalUrl: `https://app.jobnimbus.com/#!contact&jid=${contactId}`,
            });
            await context.logStep('upsert_contact', { responseSummary: { contactId, name: data.customer.name } });
          } else {
            const errText = await res.text().catch(() => 'Unknown error');
            steps.push({
              type: 'upsert_contact',
              status: 'failed',
              errorSummary: `Failed to create contact: ${res.status} ${errText.slice(0, 200)}`,
            });
            return {
              status: 'failed',
              steps,
              externalRecords,
              errorSummary: `Failed to create contact: ${res.status}`,
            };
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          steps.push({ type: 'upsert_contact', status: 'failed', errorSummary: msg });
          return { status: 'failed', steps, externalRecords, errorSummary: msg };
        }
      }
    }

    // Step 2: Create job
    if (existingJob) {
      jobId = existingJob.externalId;
      steps.push({
        type: 'upsert_job',
        status: 'skipped',
        externalId: jobId || undefined,
      });
    } else {
      try {
        const jobBody = {
          name: data.job.name || `Quote ${data.source.quoteNumber}`,
          contact_id: contactId || undefined,
          description: buildJobDescription(envelope, scopes),
          job_number: data.source.quoteNumber,
          amount: data.totals?.customerTotals?.totalIncludingTax ? parseFloat(data.totals.customerTotals.totalIncludingTax) : undefined,
        };

        const res = await fetch(`${JOBNIMBUS_BASE}/jobs`, {
          method: 'POST',
          headers,
          body: JSON.stringify(jobBody),
          signal: AbortSignal.timeout(30000),
        });

        if (res.ok) {
          const result = await res.json();
          jobId = result.jnid || result.id || result.record_id;
          steps.push({
            type: 'upsert_job',
            status: 'succeeded',
            externalId: jobId || undefined,
            externalUrl: `https://app.jobnimbus.com/#!job&jid=${jobId}`,
          });
          await context.logStep('upsert_job', { responseSummary: { jobId, name: jobBody.name } });
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

    // Step 3: Upload files
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

          const uploadRes = await fetch(`${JOBNIMBUS_BASE}/jobs/${jobId}/attachments`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}` },
            body: fileBuffer,
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
      await context.logStep('upload_files', { responseSummary: { uploaded, failed, total: data.files.length } });
    }

    // Step 4: Activity note
    try {
      const activityBody = {
        type: 'note',
        title: 'Quote exported from Quote Core+',
        notes: `Quote ${data.source.quoteNumber} exported to JobNimbus on ${new Date().toISOString()}`,
        related_to: { job_id: jobId },
      };

      await fetch(`${JOBNIMBUS_BASE}/activities`, {
        method: 'POST',
        headers,
        body: JSON.stringify(activityBody),
        signal: AbortSignal.timeout(15000),
      });

      steps.push({ type: 'add_activity_note', status: 'succeeded' });
    } catch {
      steps.push({ type: 'add_activity_note', status: 'failed', errorSummary: 'Failed to log activity' });
    }

    // Store external mappings
    if (contactId) {
      externalRecords.push({
        externalType: 'contact',
        externalId: contactId,
        externalUrl: `https://app.jobnimbus.com/#!contact&jid=${contactId}`,
      });
    }
    if (jobId) {
      externalRecords.push({
        externalType: 'job',
        externalId: jobId,
        externalUrl: `https://app.jobnimbus.com/#!job&jid=${jobId}`,
      });
    }

    const hasFailures = steps.some((s) => s.status === 'failed');
    const allFailed = steps.some((s) => (s.type === 'upsert_job' || s.type === 'upsert_contact') && s.status === 'failed');

    return {
      status: allFailed ? 'failed' : (hasFailures ? 'partially_completed' : 'succeeded'),
      steps,
      externalRecords,
      errorSummary: hasFailures ? 'Some steps failed - see step details' : undefined,
    };
  }
}

/**
 * Build a text description of the quote for the JobNimbus job record.
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

  if (scopes.customerFacingQuote && data.customerLines && data.customerLines.length > 0) {
    lines.push('--- Customer Quote ---');
    for (const line of data.customerLines) {
      const qty = line.quantity ? ` x${line.quantity}` : '';
      const price = line.unitPrice ? ` @ ${line.unitPrice}` : '';
      const total = line.lineTotal ? ` = ${line.lineTotal}` : '';
      lines.push(`  ${line.description}${qty}${price}${total}`);
    }
    lines.push('');
  }

  if (scopes.measurementsAndTakeoff && data.components && data.components.length > 0) {
    lines.push('--- Components ---');
    for (const comp of data.components) {
      lines.push(`  ${comp.name}: ${comp.quantity ?? 'N/A'} ${comp.pricingUnit || ''}`);
    }
    lines.push('');
  }

  if (scopes.labourBreakdown && data.labourLines && data.labourLines.length > 0) {
    lines.push('--- Labour ---');
    for (const labour of data.labourLines) {
      const price = labour.amount != null ? ` = ${labour.amount}` : '';
      lines.push(`  ${labour.description}${price}`);
    }
    lines.push('');
  }

  if (data.totals) {
    lines.push('--- Totals ---');
    if (data.totals.customerTotals?.subtotalExcludingTax) lines.push(`  Subtotal: ${data.totals.customerTotals.subtotalExcludingTax}`);
    if (data.totals.customerTotals?.taxTotal) lines.push(`  Tax: ${data.totals.customerTotals.taxTotal}`);
    if (data.totals.customerTotals?.totalIncludingTax) lines.push(`  Grand Total: ${data.totals.customerTotals.totalIncludingTax}`);
  }

  if (scopes.internalCosts && data.totals?.costTotals) {
    lines.push('');
    lines.push('--- Internal Costs ---');
    if (data.totals.costTotals.materialCost) lines.push(`  Material: ${data.totals.costTotals.materialCost}`);
    if (data.totals.costTotals.labourCost) lines.push(`  Labour: ${data.totals.costTotals.labourCost}`);
    if (scopes.marginInformation && data.totals.marginTotals?.grossProfit) {
      lines.push(`  Gross Profit: ${data.totals.marginTotals.grossProfit}`);
    }
  }

  lines.push('');
  lines.push(`Exported from Quote Core+ on ${new Date().toISOString()}`);

  return lines.join('\n');
}

// Singleton instance
let _instance: JobNimbusConnector | null = null;
export function getJobNimbusConnector(): JobNimbusConnector {
  if (!_instance) _instance = new JobNimbusConnector();
  return _instance;
}
