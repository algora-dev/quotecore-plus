/**
 * Zapier Connector - Phase 1B
 *
 * Sends a simplified payload to a user-provided Zapier webhook URL.
 * Uses "delivered_to_zapier" status (not "destination_success")
 * because a 200 from Zapier only means Zapier accepted the webhook,
 * not that the downstream action completed.
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
import { toZapierPayload } from '../../export-builder/projections';

const CAPABILITIES: ConnectorCapabilities = {
  supportsContacts: false, // Zapier handles this downstream
  supportsSites: false,
  supportsJobs: false,
  supportsQuotes: false,
  supportsLineItems: false,
  supportsAttachments: false,
  supportsCreate: true,
  supportsUpdate: false,
  supportsWebhooks: true,
  supportsAutomaticSync: false,
};

const SUPPORTED_EVENTS: ExportEvent[] = [
  'quote_confirmed',
  'quote_sent',
  'quote_accepted',
  'manual_export',
];

const ZAPIER_WEBHOOK_HOSTS = [
  'hooks.zapier.com',
  'hooks.zapier.com.',
];

export class ZapierConnector implements Connector {
  readonly provider = 'zapier';
  readonly capabilities = CAPABILITIES;
  readonly supportedEvents = SUPPORTED_EVENTS;

  async validateConfig(config: IntegrationConfig): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const webhookUrl = config.config?.webhookUrl as string;

    if (!webhookUrl) {
      errors.push('Zapier webhook URL is required');
    } else {
      // Validate URL
      try {
        const url = new URL(webhookUrl);
        if (url.protocol !== 'https:') {
          errors.push('Webhook URL must use HTTPS');
        }
        // SSRF protection: restrict to Zapier hosts
        const hostname = url.hostname.toLowerCase();
        if (!ZAPIER_WEBHOOK_HOSTS.includes(hostname)) {
          errors.push('Webhook URL must be a Zapier hooks.zapier.com URL');
        }
      } catch {
        errors.push('Webhook URL is not a valid URL');
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  async validateExport(
    envelope: IntegrationEnvelopeV1,
    config: IntegrationConfig
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!envelope.data.customer.name) {
      warnings.push('Customer name is empty');
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  async plan(
    envelope: IntegrationEnvelopeV1,
    config: IntegrationConfig,
    _context: ConnectorContext
  ): Promise<IntegrationPlan> {
    const steps: PlanStep[] = [
      {
        type: 'add_activity_note',
        description: 'Send quote payload to Zapier webhook',
        optional: false,
      },
    ];

    return {
      steps,
      willCreate: true,
      willUpdate: false,
      summary: 'Deliver quote payload to Zapier webhook',
    };
  }

  async execute(
    plan: IntegrationPlan,
    envelope: IntegrationEnvelopeV1,
    config: IntegrationConfig,
    context: ExecutionContext
  ): Promise<ConnectorExecutionResult> {
    const webhookUrl = config.config?.webhookUrl as string;
    const steps: StepResult[] = [];
    const externalRecords: CreatedExternalRecord[] = [];

    // Build the Zapier-safe payload
    const payload = toZapierPayload(envelope.data, config.dataScopes);

    const startTime = Date.now();

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30_000), // 30s timeout
      });

      const durationMs = Date.now() - startTime;

      await context.logStep('send_to_zapier', {
        responseStatus: response.status,
        durationMs,
        requestSummary: { url: 'hooks.zapier.com (redacted)', payloadSize: JSON.stringify(payload).length },
        responseSummary: response.ok ? { status: 'accepted' } : { status: response.status, statusText: response.statusText },
      });

      if (response.ok) {
        // Zapier accepted the webhook
        steps.push({
          type: 'add_activity_note',
          status: 'succeeded',
        });

        // Store the Zapier delivery as an external record (for idempotency)
        externalRecords.push({
          externalType: 'zapier_delivery',
          externalId: envelope.eventId,
          externalUrl: null,
        });

        return {
          status: 'succeeded',
          steps,
          externalRecords,
        };
      } else {
        // Zapier returned an error
        const errorText = await response.text().catch(() => 'No response body');
        const errorSummary = `Zapier returned ${response.status}: ${errorText.slice(0, 200)}`;

        steps.push({
          type: 'add_activity_note',
          status: 'failed',
          errorSummary,
        });

        return {
          status: 'failed',
          steps,
          externalRecords,
          errorSummary,
        };
      }
    } catch (err) {
      const durationMs = Date.now() - startTime;
      const errorSummary = err instanceof Error ? err.message : 'Unknown error';

      await context.logStep('send_to_zapier', {
        durationMs,
        errorClass: err instanceof Error ? err.constructor.name : 'Unknown',
        errorSummary,
      });

      steps.push({
        type: 'add_activity_note',
        status: 'failed',
        errorSummary,
      });

      return {
        status: 'failed',
        steps,
        externalRecords,
        errorSummary,
      };
    }
  }
}

// Singleton instance
let _instance: ZapierConnector | null = null;
export function getZapierConnector(): ZapierConnector {
  if (!_instance) _instance = new ZapierConnector();
  return _instance;
}
