/**
 * Shared types for the unified send-document pipeline.
 *
 * The orchestrator (`orchestrator.ts`) + per-entity adapters use these
 * types. The server pipeline (`sendOutboundMessage` in `app/lib/messages/send.ts`)
 * is NOT modified — adapters produce the inputs it expects.
 */

import type { OutboundMessageKind } from '@/app/lib/messages/send';
import type { SupabaseClient } from '@supabase/supabase-js';

export type EntityKind = 'quote' | 'order' | 'invoice';

export interface SendDocumentInput {
  entityKind: EntityKind;
  entityId: string;
  templateId: string | null;
  subject: string;
  body: string;
  recipientEmail: string;
  recipientName?: string | null;
  attachmentSelection?: {
    libraryAttachmentIds?: string[];
    quoteFileIds?: string[];
  };
}

export type SendDocumentResult =
  | { ok: true; messageId: string; status: 'sent' | 'suppressed'; gated?: false }
  | { ok: false; error: string; gated?: boolean };

/** Entity row loaded by the adapter's `loadEntity`. Adapters narrow this. */
export interface LoadedEntity {
  id: string;
  [key: string]: unknown;
}

export interface SharedMergeContext {
  company_name: string;
  company_email?: string;
  company_phone?: string;
  sender_name?: string;
  today: string;
  customer_name?: string;
}

export interface AfterSendContext {
  supabase: SupabaseClient;
  admin: SupabaseClient;
  profile: { id: string; company_id: string; email: string | null; full_name: string | null };
  recipientEmail: string;
  result: { messageId: string; status: 'sent' | 'suppressed' };
}

export interface DocumentSendAdapter {
  kind: OutboundMessageKind;
  /** Extra entitlements beyond assertCanSendMessage (order: material_orders). */
  extraEntitlements?(companyId: string): Promise<void>;
  /** Ownership-scoped load. Return null → generic "not found". */
  loadEntity(supabase: SupabaseClient, companyId: string, id: string): Promise<LoadedEntity | null>;
  /** Reject unsendable states (invoice paid/cancelled). Return error string or null. */
  validateSendable?(entity: LoadedEntity): string | null;
  /** Resolve or mint the public token. */
  resolveToken(entity: LoadedEntity, companyId: string): Promise<string | null>;
  /** Entity-specific merge vars (quote_total, order_total_items, invoice_link, ...). */
  buildMergeContext(entity: LoadedEntity, shared: SharedMergeContext): Promise<Record<string, string | undefined>>;
  /** Branding overrides (quote/invoice cq_* fields; order from_company). */
  resolveBranding(entity: LoadedEntity, companyName: string, companyEmail: string | null): {
    companyName: string;
    companyLogoUrl?: string | null;
    companyEmail?: string | null;
    companyPhone?: string | null;
  };
  /** relatedQuoteId / relatedOrderId / primaryCta override for sendOutboundMessage. */
  pipelineExtras(entity: LoadedEntity, token: string | null): {
    relatedQuoteId?: string | null;
    relatedOrderId?: string | null;
    primaryCta?: { label: string; url: string } | null;
  };
  /** Post-send side effects (invoice: status flip + activity + alert). Only on status==='sent'. */
  afterSend?(entity: LoadedEntity, ctx: AfterSendContext): Promise<void>;
  /** Paths to revalidate. */
  revalidatePaths(workspaceSlug: string, entityId: string): string[];
  /** Filter attachment selection (order: library only). */
  filterAttachments?(sel: NonNullable<SendDocumentInput['attachmentSelection']>): NonNullable<SendDocumentInput['attachmentSelection']>;
}
