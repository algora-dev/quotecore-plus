/**
 * Connector Framework - Standard interface every integration connector implements.
 *
 * Each connector (Zapier, JobNimbus, Fergus, etc.) implements this interface.
 * The execution engine calls validateConfig -> validateExport -> plan -> execute.
 */

import type { IntegrationEnvelopeV1 } from './envelope-v1';

export interface ConnectorCapabilities {
  supportsContacts: boolean;
  supportsSites: boolean;
  supportsJobs: boolean;
  supportsQuotes: boolean;
  supportsLineItems: boolean;
  supportsAttachments: boolean;
  supportsCreate: boolean;
  supportsUpdate: boolean;
  supportsWebhooks: boolean;
  supportsAutomaticSync: boolean;
  nativeActions?: {
    quotes: 'create_update' | 'create_only' | 'unsupported';
    invoices: 'create_update' | 'read_only' | 'unsupported';
    materialOrders: 'create_update' | 'read_only' | 'unsupported';
  };
  artifactFallbacks?: {
    invoices: 'attachment' | 'unsupported';
    materialOrders: 'attachment' | 'unsupported';
    measurements: 'attachment' | 'native' | 'unsupported';
  };
}

export type ExportEvent = 'quote_confirmed' | 'quote_sent' | 'quote_accepted' | 'manual_export';

export interface IntegrationConfig {
  provider: string;
  config: Record<string, unknown>;
  dataScopes: DataScopes;
}

export interface DataScopes {
  customerDetails: boolean;
  siteDetails: boolean;
  customerFacingQuote: boolean;
  internalCosts: boolean;
  marginInformation: boolean;
  labourBreakdown: boolean;
  measurementsAndTakeoff: boolean;
  filesAndPlans: boolean;
  internalNotes: boolean;
  acceptanceDetails: boolean;
}

export const DEFAULT_DATA_SCOPES: DataScopes = {
  customerDetails: true,
  siteDetails: true,
  customerFacingQuote: true,
  internalCosts: false,
  marginInformation: false,
  labourBreakdown: false,
  measurementsAndTakeoff: false,
  filesAndPlans: true,
  internalNotes: false,
  acceptanceDetails: true,
};

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ConnectorContext {
  integrationId: string;
  companyId: string;
  exportId: string;
  attemptNumber: number;
}

export interface ExecutionContext extends ConnectorContext {
  /** Function to fetch a decrypted credential from Supabase Vault */
  getCredential: (credentialType: string) => Promise<string | null>;
  /** Function to generate a fresh signed URL for a file path */
  getSignedUrl: (path: string, expiresInSec: number) => Promise<string | null>;
  /** Function to log a step attempt without sensitive data */
  logStep: (step: string, summary: StepSummary) => Promise<void>;
  /** Existing external record mappings for this source */
  existingMappings: ExternalMapping[];
}

export interface StepSummary {
  responseStatus?: number;
  providerRequestId?: string;
  durationMs?: number;
  errorClass?: string;
  errorSummary?: string;
  requestSummary?: Record<string, unknown>;
  responseSummary?: Record<string, unknown>;
}

export interface ExternalMapping {
  externalType: string;
  externalId: string;
  externalUrl: string | null;
  lastSyncedRevision: number | null;
}

export type PlanStepType =
  | 'upsert_contact'
  | 'upsert_site'
  | 'upsert_job'
  | 'create_or_update_quote'
  | 'upload_quote_pdf'
  | 'upload_plan'
  | 'upload_supporting_file'
  | 'add_activity_note'
  | 'store_external_links';

export interface PlanStep {
  type: PlanStepType;
  description: string;
  optional: boolean;
}

export interface IntegrationPlan {
  steps: PlanStep[];
  willCreate: boolean;
  willUpdate: boolean;
  summary: string;
}

export interface ConnectorExecutionResult {
  status: 'succeeded' | 'partially_completed' | 'failed';
  steps: StepResult[];
  externalRecords: CreatedExternalRecord[];
  errorSummary?: string;
}

export interface StepResult {
  type: PlanStepType;
  status: 'succeeded' | 'failed' | 'skipped';
  externalId?: string;
  externalUrl?: string;
  errorSummary?: string;
}

export interface CreatedExternalRecord {
  externalType: string;
  externalId: string;
  externalUrl: string | null;
}

export interface Connector {
  provider: string;
  capabilities: ConnectorCapabilities;
  supportedEvents: ExportEvent[];

  validateConfig(config: IntegrationConfig): Promise<ValidationResult>;
  validateExport(
    envelope: IntegrationEnvelopeV1,
    config: IntegrationConfig
  ): Promise<ValidationResult>;
  plan(
    envelope: IntegrationEnvelopeV1,
    config: IntegrationConfig,
    context: ConnectorContext
  ): Promise<IntegrationPlan>;
  execute(
    plan: IntegrationPlan,
    envelope: IntegrationEnvelopeV1,
    config: IntegrationConfig,
    context: ExecutionContext
  ): Promise<ConnectorExecutionResult>;
}
