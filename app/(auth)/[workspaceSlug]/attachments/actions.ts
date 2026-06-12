'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { requireCompanyContext } from '@/app/lib/supabase/server';
import { BUCKETS } from '@/app/lib/storage/buckets';
import {
  requireFeature,
  requireAttachmentSlot,
  AttachmentLimitReachedError,
  FeatureGatedError,
  SubscriptionInactiveError,
  isBillingError,
  loadCompanyEntitlements,
} from '@/app/lib/billing/entitlements';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminAny = any;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AttachmentRow {
  id: string;
  name: string;
  file_name: string;
  storage_path: string;
  file_size: number;
  mime_type: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export type AttachmentActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string };

// ---------------------------------------------------------------------------
// loadAttachments - list company attachments (active first, then archived)
// ---------------------------------------------------------------------------

export async function loadAttachments(): Promise<AttachmentRow[]> {
  const profile = await requireCompanyContext();
  const admin = createAdminClient() as AdminAny;

  const { data, error } = await admin
    .from('company_attachments')
    .select('id, name, file_name, storage_path, file_size, mime_type, archived_at, created_at, updated_at')
    .eq('company_id', profile.company_id)
    .order('archived_at', { ascending: true, nullsFirst: true }) // active (null) first
    .order('updated_at', { ascending: false });

  if (error) throw new Error(`Failed to load attachments: ${error.message}`);
  return (data ?? []) as AttachmentRow[];
}

// ---------------------------------------------------------------------------
// createAttachment - record a freshly-uploaded library file
// ---------------------------------------------------------------------------
// The file must already be in the QUOTE-DOCUMENTS bucket under
// {companyId}/library/ via the signed-upload flow (scope: 'library'). This
// writes the metadata row. We re-read the real object size from storage to
// keep storage accounting honest (the storage trigger already incremented
// storage_used_bytes when the object landed).
// ---------------------------------------------------------------------------

export async function createAttachment(args: {
  name: string;
  fileName: string;
  storagePath: string;
  claimedSize: number;
  mimeType: string | null;
}): Promise<AttachmentActionResult<{ attachmentId: string }>> {
  // Set once we've confirmed the object lives under this company's library
  // prefix. If creation then fails (entitlement race, DB insert error, etc.)
  // we delete the just-uploaded object so it cannot orphan + consume storage
  // (Gerald H-02). Only ever set to a verified, company-owned path.
  let cleanupPath: string | null = null;
  try {
    const profile = await requireCompanyContext();

    // Path ownership FIRST: the object MUST live under this company's library
    // folder. Validate before the entitlement gate so a failed gate can
    // safely trigger cleanup of the verified path.
    const expectedPrefix = `${profile.company_id}/library/`;
    if (!args.storagePath.startsWith(expectedPrefix)) {
      return { ok: false, code: 'invalid_path', message: 'Invalid storage path for attachment.' };
    }
    cleanupPath = args.storagePath;

    await requireFeature(profile.company_id, 'attachment_library');
    await requireAttachmentSlot(profile.company_id);

    if (!args.name.trim()) {
      return { ok: false, code: 'validation', message: 'Please give the attachment a name.' };
    }

    const admin = createAdminClient() as AdminAny;

    // Re-read the real object size from storage rather than trusting the
    // browser-claimed value. The storage.objects trigger already accounted
    // for these bytes against storage_used_bytes on upload. We use list()
    // with a search filter - the documented single-object metadata lookup
    // (mirrors saveFileMetadata in storage-actions.ts).
    let realSize = args.claimedSize;
    const lastSlash = args.storagePath.lastIndexOf('/');
    const prefix = lastSlash >= 0 ? args.storagePath.slice(0, lastSlash) : '';
    const objectName = lastSlash >= 0 ? args.storagePath.slice(lastSlash + 1) : args.storagePath;
    const { data: listResult } = await admin.storage
      .from(BUCKETS.QUOTE_DOCUMENTS)
      .list(prefix, { search: objectName, limit: 1 });
    const obj = (listResult as Array<{ name: string; metadata?: { size?: number } | null }> | null)
      ?.find((o) => o.name === objectName);
    const infoSize = obj?.metadata?.size;
    if (typeof infoSize === 'number' && Number.isFinite(infoSize) && infoSize >= 0) {
      realSize = infoSize;
    }

    const { data, error } = await admin
      .from('company_attachments')
      .insert({
        company_id: profile.company_id,
        name: args.name.trim(),
        file_name: args.fileName,
        storage_path: args.storagePath,
        file_size: realSize,
        mime_type: args.mimeType,
      })
      .select('id')
      .single();

    if (error) throw new Error(error.message);

    const attachmentId = (data as { id: string }).id;
    cleanupPath = null; // success - keep the object
    revalidatePath(`/[workspaceSlug]/attachments`, 'page');
    return { ok: true, data: { attachmentId } };
  } catch (err) {
    if (err instanceof FeatureGatedError) {
      await cleanupOrphan(cleanupPath);
      return { ok: false, code: 'feature_gated', message: err.message };
    }
    if (err instanceof AttachmentLimitReachedError) {
      await cleanupOrphan(cleanupPath);
      return { ok: false, code: 'attachment_limit_reached', message: err.message };
    }
    if (err instanceof SubscriptionInactiveError) {
      await cleanupOrphan(cleanupPath);
      return { ok: false, code: 'subscription_inactive', message: err.message };
    }
    if (isBillingError(err)) {
      await cleanupOrphan(cleanupPath);
      return { ok: false, code: err.code, message: err.message };
    }
    console.error('[createAttachment]', err);
    await cleanupOrphan(cleanupPath);
    return { ok: false, code: 'unknown', message: err instanceof Error ? err.message : 'Unexpected error' };
  }
}

// ---------------------------------------------------------------------------
// cleanupOrphan - best-effort delete of a just-uploaded library object whose
// metadata row failed to create. Caller passes only a company-verified path
// (checked against the {companyId}/library/ prefix) so this can never remove
// an object outside the caller's folder. The storage.objects DELETE trigger
// decrements storage_used_bytes automatically.
// ---------------------------------------------------------------------------
async function cleanupOrphan(storagePath: string | null): Promise<void> {
  if (!storagePath) return;
  try {
    const admin = createAdminClient() as AdminAny;
    await admin.storage.from(BUCKETS.QUOTE_DOCUMENTS).remove([storagePath]);
  } catch (e) {
    console.error('[createAttachment] orphan cleanup failed for', storagePath, e);
  }
}

// ---------------------------------------------------------------------------
// renameAttachment
// ---------------------------------------------------------------------------

export async function renameAttachment(
  attachmentId: string,
  name: string,
): Promise<AttachmentActionResult> {
  try {
    const profile = await requireCompanyContext();
    if (!name.trim()) return { ok: false, code: 'validation', message: 'Name cannot be blank.' };

    const admin = createAdminClient() as AdminAny;
    const { error } = await admin
      .from('company_attachments')
      .update({ name: name.trim(), updated_at: new Date().toISOString() })
      .eq('id', attachmentId)
      .eq('company_id', profile.company_id);

    if (error) throw new Error(error.message);
    revalidatePath(`/[workspaceSlug]/attachments`, 'page');
    return { ok: true, data: undefined };
  } catch (err) {
    console.error('[renameAttachment]', err);
    return { ok: false, code: 'unknown', message: err instanceof Error ? err.message : 'Unexpected error' };
  }
}

// ---------------------------------------------------------------------------
// archiveAttachment / unarchiveAttachment
// ---------------------------------------------------------------------------

export async function archiveAttachment(attachmentId: string): Promise<AttachmentActionResult> {
  try {
    const profile = await requireCompanyContext();
    const admin = createAdminClient() as AdminAny;
    const { error } = await admin
      .from('company_attachments')
      .update({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', attachmentId)
      .eq('company_id', profile.company_id)
      .is('archived_at', null);

    if (error) throw new Error(error.message);
    revalidatePath(`/[workspaceSlug]/attachments`, 'page');
    return { ok: true, data: undefined };
  } catch (err) {
    console.error('[archiveAttachment]', err);
    return { ok: false, code: 'unknown', message: err instanceof Error ? err.message : 'Unexpected error' };
  }
}

export async function unarchiveAttachment(attachmentId: string): Promise<AttachmentActionResult> {
  try {
    const profile = await requireCompanyContext();
    await requireAttachmentSlot(profile.company_id); // re-check cap

    const admin = createAdminClient() as AdminAny;
    const { error } = await admin
      .from('company_attachments')
      .update({ archived_at: null, updated_at: new Date().toISOString() })
      .eq('id', attachmentId)
      .eq('company_id', profile.company_id)
      .not('archived_at', 'is', null);

    if (error) throw new Error(error.message);
    revalidatePath(`/[workspaceSlug]/attachments`, 'page');
    return { ok: true, data: undefined };
  } catch (err) {
    if (err instanceof AttachmentLimitReachedError) {
      return { ok: false, code: 'attachment_limit_reached', message: err.message };
    }
    if (err instanceof FeatureGatedError) {
      return { ok: false, code: 'feature_gated', message: err.message };
    }
    console.error('[unarchiveAttachment]', err);
    return { ok: false, code: 'unknown', message: err instanceof Error ? err.message : 'Unexpected error' };
  }
}

// ---------------------------------------------------------------------------
// deleteAttachment - hard removal; deletes storage object + frees slot/storage
// ---------------------------------------------------------------------------
// Removing the storage object fires the storage.objects DELETE trigger, which
// decrements storage_used_bytes automatically. We delete the metadata row
// regardless of whether template references exist, but null out any baked
// template reference first to avoid a dangling pointer (handled in Phase 4).
// ---------------------------------------------------------------------------

export async function deleteAttachment(attachmentId: string): Promise<AttachmentActionResult> {
  try {
    const profile = await requireCompanyContext();
    const admin = createAdminClient() as AdminAny;

    const { data: row, error: fetchErr } = await admin
      .from('company_attachments')
      .select('storage_path')
      .eq('id', attachmentId)
      .eq('company_id', profile.company_id)
      .single();

    if (fetchErr) throw new Error(fetchErr.message);
    const storagePath = (row as { storage_path: string } | null)?.storage_path;

    // Remove the storage object first (decrements storage_used_bytes via trigger).
    if (storagePath) {
      const { error: rmErr } = await admin.storage
        .from(BUCKETS.QUOTE_DOCUMENTS)
        .remove([storagePath]);
      if (rmErr) {
        // Log but continue - a missing object shouldn't block metadata cleanup.
        console.error('[deleteAttachment] storage remove failed:', rmErr.message);
      }
    }

    // Phase 4: explicitly null any email_templates baking this attachment as
    // their default, scoped to this company. The FK is ON DELETE SET NULL so
    // DB integrity is guaranteed either way, but doing it here makes the
    // behaviour intentional and lets us revalidate the templates surface.
    const { error: tmplErr } = await admin
      .from('email_templates')
      .update({ attachment_id: null })
      .eq('attachment_id', attachmentId)
      .eq('company_id', profile.company_id);
    if (tmplErr) {
      // Non-fatal: the FK will still null these on delete below.
      console.error('[deleteAttachment] template unlink failed:', tmplErr.message);
    }

    const { error } = await admin
      .from('company_attachments')
      .delete()
      .eq('id', attachmentId)
      .eq('company_id', profile.company_id);

    if (error) throw new Error(error.message);

    revalidatePath(`/[workspaceSlug]/attachments`, 'page');
    revalidatePath(`/[workspaceSlug]/resources`, 'page');
    return { ok: true, data: undefined };
  } catch (err) {
    console.error('[deleteAttachment]', err);
    return { ok: false, code: 'unknown', message: err instanceof Error ? err.message : 'Unexpected error' };
  }
}

// ---------------------------------------------------------------------------
// loadAttachmentEntitlements - for page SSR (gating banner + cap display)
// ---------------------------------------------------------------------------

export async function loadAttachmentEntitlements() {
  const profile = await requireCompanyContext();
  const ent = await loadCompanyEntitlements(profile.company_id);
  return {
    attachmentsEnabled: ent.features.attachment_library,
    attachmentLimit: ent.attachmentLimit,
    attachmentCount: ent.attachmentCount,
    isActive: ent.isActive,
    effectivePlanCode: ent.effectivePlanCode,
    isOverStorage: ent.isOverStorage,
  };
}

// ---------------------------------------------------------------------------
// loadAttachmentsForPicker - active attachments only, minimal shape
// ---------------------------------------------------------------------------
// Used by the "Add extra file" picker at quote-send time. Archived files are
// excluded. Returns enough to display + later attach (storage_path + file_name).
// ---------------------------------------------------------------------------

export interface AttachmentPickerItem {
  id: string;
  name: string;
  file_name: string;
  storage_path: string;
  file_size: number;
}

export async function loadAttachmentsForPicker(): Promise<AttachmentPickerItem[]> {
  const profile = await requireCompanyContext();
  const admin = createAdminClient() as AdminAny;

  const { data, error } = await admin
    .from('company_attachments')
    .select('id, name, file_name, storage_path, file_size')
    .eq('company_id', profile.company_id)
    .is('archived_at', null)
    .order('name', { ascending: true });

  if (error) {
    console.error('[loadAttachmentsForPicker]', error);
    return [];
  }
  return (data ?? []) as AttachmentPickerItem[];
}
