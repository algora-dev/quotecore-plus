'use server';

/**
 * Order adapter for the unified send-document pipeline.
 *
 * Orders use an idempotent supplier token (generateOrderSupplierToken),
 * require dual entitlements (material_orders + email_send), and
 * attach library files only (no quote files).
 */

import { getSiteUrl } from '@/app/lib/email/urls';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  assertCanSendMessage,
  requireFeature,
  FeatureGatedError,
  SubscriptionInactiveError,
  FEATURE_LABELS,
} from '@/app/lib/billing/entitlements';
import type { DocumentSendAdapter, LoadedEntity, SharedMergeContext } from '../types';

interface OrderEntity extends LoadedEntity {
  id: string;
  order_number: string;
  reference: string | null;
  to_supplier: string | null;
  from_company: string | null;
  contact_details: unknown;
  acceptance_token: string | null;
}

// We need to call generateOrderSupplierToken, which lives in the order preview
// directory. Rather than importing a 'use server' file across directories (which
// works in Next.js but creates a circular-ish dependency), we inline the token
// generation logic here using the same approach: check for existing live token,
// mint a new one if none.
async function ensureOrderSupplierToken(
  supabase: SupabaseClient,
  orderId: string,
  companyId: string,
): Promise<string | null> {
  // Check if there's already a live token.
  const { data: order } = await supabase
    .from('material_orders')
    .select('acceptance_token')
    .eq('id', orderId)
    .eq('company_id', companyId)
    .maybeSingle();

  if (order?.acceptance_token) return order.acceptance_token;

  // Mint a new one.
  const { randomUUID } = await import('node:crypto');
  const token = randomUUID();
  const { error } = await supabase
    .from('material_orders')
    .update({ acceptance_token: token })
    .eq('id', orderId)
    .eq('company_id', companyId);
  if (error) return null;
  return token;
}

export const orderAdapter: DocumentSendAdapter = {
  kind: 'order_send',

  async extraEntitlements(companyId) {
    // Orders require material_orders entitlement IN ADDITION to email_send.
    await requireFeature(companyId, 'material_orders');
  },

  async loadEntity(supabase, companyId, id) {
    const { data, error } = await supabase
      .from('material_orders')
      .select(
        'id, order_number, reference, to_supplier, from_company, contact_details, acceptance_token',
      )
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle();
    if (error || !data) return null;
    return data as OrderEntity;
  },

  // No validateSendable — orders don't have terminal states that block sending.

  async resolveToken(entity, companyId) {
    const order = entity as OrderEntity;
    // Reuse existing token or mint a new one (idempotent).
    if (order.acceptance_token) return order.acceptance_token;
    // We need a supabase client — but resolveToken doesn't get one in the
    // current interface. The token minting happens in the orchestrator
    // before calling resolveToken for orders. So just return null here
    // and the orchestrator handles it.
    // Actually, looking at the interface, resolveToken doesn't receive supabase.
    // We need to handle order token generation differently. Let's return
    // the existing token (already loaded) and let the orchestrator mint
    // if null. For orders, we'll override this in the orchestrator.
    return order.acceptance_token;
  },

  async buildMergeContext(entity, shared) {
    const order = entity as OrderEntity;
    // Item count for {{order_total_items}} — needs a DB query, but we
    // can't do it here without supabase. The orchestrator passes it
    // via shared context. Actually, let's compute it in the orchestrator
    // after loading the entity and pass it as an extra merge var.
    return {
      ...shared,
      order_number: order.order_number,
      order_reference: order.reference ?? undefined,
      order_supplier: order.to_supplier ?? undefined,
      // order_total_items and order_link are injected by the orchestrator
      // (they need DB queries / token resolution).
    };
  },

  resolveBranding(entity, companyName, companyEmail) {
    const order = entity as OrderEntity;
    return {
      companyName: order.from_company || companyName,
      companyEmail,
      companyPhone: null,
      companyLogoUrl: null,
    };
  },

  pipelineExtras(entity, token) {
    return {
      relatedOrderId: (entity as OrderEntity).id,
    };
  },

  // No afterSend for orders.

  revalidatePaths(workspaceSlug, entityId) {
    return [`/[workspaceSlug]/material-orders/${entityId}/preview`];
  },

  filterAttachments(sel) {
    // Orders: library files only.
    return {
      libraryAttachmentIds: sel.libraryAttachmentIds ?? [],
      quoteFileIds: [],
    };
  },
};

// Export the token helper for the orchestrator to use.
export { ensureOrderSupplierToken };
