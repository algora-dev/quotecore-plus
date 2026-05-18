'use server';
import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import { pickFields } from '@/app/lib/security/pickFields';
import type { FlashingLibraryInsert, FlashingLibraryRow } from '@/app/lib/types';
import {
  requireFlashingSlot,
  FlashingLimitReachedError,
  FeatureGatedError,
  SubscriptionInactiveError,
} from '@/app/lib/billing/entitlements';

/**
 * Envelope returned by the create paths so the client can show an upgrade
 * modal on cap/feature-gate without parsing message strings. On success
 * `data` is the new row. On feature-gate failure `code='feature_gated'`,
 * on cap failure `code='flashing_limit_reached'`.
 */
export type CreateFlashingResult =
  | { ok: true; data: FlashingLibraryRow }
  | { ok: false; code: 'flashing_limit_reached'; used: number; limit: number; planCode: string }
  | { ok: false; code: 'feature_gated'; currentPlan: string; requiredPlan: string }
  | { ok: false; code: 'subscription_inactive'; status: string }
  | { ok: false; code: 'internal_error'; message: string };

// TODO(phase-2 storage quota): createFlashing / createFlashingFromCanvas /
// updateFlashing all upload to the PUBLIC company-logos bucket. Phase 1
// quota only covers QUOTE-DOCUMENTS, so these paths intentionally bypass
// finaliseUpload. When we widen the storage quota model to all buckets,
// wire them through finaliseUpload (or an equivalent helper that supports
// the company-logos bucket). See app/lib/files/upload-finaliser.ts.

export async function loadFlashingLibrary(): Promise<FlashingLibraryRow[]> {
  let profile;
  try {
    profile = await requireCompanyContext();
  } catch (err) {
    console.error('[loadFlashingLibrary] Failed to get company context:', err);
    throw new Error('Account setup incomplete. Please ensure you are logged in and have a company workspace.');
  }
  
  console.log('[loadFlashingLibrary] Loading flashings for company:', profile.company_id);
  
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('flashing_library')
    .select('*')
    .eq('company_id', profile.company_id)
    .order('name');
  
  if (error) {
    console.error('[loadFlashingLibrary] Database error:', error);
    console.error('[loadFlashingLibrary] Error details:', JSON.stringify(error, null, 2));
    throw new Error(`Failed to load flashings: ${error.message}`);
  }
  
  console.log('[loadFlashingLibrary] Successfully loaded', data?.length || 0, 'flashings');
  // `measurements` is Json at the DB level but our app always writes
  // FlashingMeasurement[] into it. Narrow at the boundary so the rest of
  // the codebase doesn't need to.
  return (data ?? []) as unknown as FlashingLibraryRow[];
}

export async function loadFlashingById(id: string): Promise<FlashingLibraryRow> {
  let profile;
  try {
    profile = await requireCompanyContext();
  } catch (err) {
    console.error('[loadFlashingById] Failed to get company context:', err);
    throw new Error('Account setup incomplete. Please ensure you are logged in and have a company workspace.');
  }
  
  console.log('[loadFlashingById] Loading flashing:', id);
  
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('flashing_library')
    .select('*')
    .eq('id', id)
    .eq('company_id', profile.company_id)
    .single();
  
  if (error) {
    console.error('[loadFlashingById] Database error:', error);
    throw new Error(`Failed to load flashing: ${error.message}`);
  }
  
  console.log('[loadFlashingById] Successfully loaded flashing');
  // Same narrowing as loadFlashingLibrary (measurements is Json at the DB).
  return data as unknown as FlashingLibraryRow;
}

export async function createFlashing(formData: FormData): Promise<CreateFlashingResult> {
  let profile;
  try {
    profile = await requireCompanyContext();
  } catch (err) {
    console.error('[createFlashing] Failed to get company context:', err);
    return { ok: false, code: 'internal_error', message: 'Account setup incomplete. Please log out and log back in.' };
  }

  // Tier gate: refuse before we upload anything to storage.
  const gateResult = await guardFlashingSlot(profile.company_id);
  if (gateResult) return gateResult;

  const name = formData.get('name') as string;
  const description = formData.get('description') as string | null;
  const imageFile = formData.get('image') as File;

  if (!name || !imageFile) {
    return { ok: false, code: 'internal_error', message: 'Name and image file are required' };
  }

  console.log('[createFlashing] Creating flashing for company:', profile.company_id);
  console.log('[createFlashing] File:', imageFile.name, imageFile.type, imageFile.size);

  const supabase = await createSupabaseServerClient();

  // 1. Upload image to storage
  const fileExt = imageFile.name.split('.').pop();
  const fileName = `${crypto.randomUUID()}.${fileExt}`;
  const storagePath = `${profile.company_id}/flashings/${fileName}`;

  // Convert File to Buffer for server-side upload
  const arrayBuffer = await imageFile.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error: uploadError } = await supabase.storage
    .from('company-logos')
    .upload(storagePath, buffer, {
      contentType: imageFile.type,
      upsert: false,
    });

  if (uploadError) {
    console.error('[createFlashing] Upload error:', uploadError);
    return { ok: false, code: 'internal_error', message: `Failed to upload image: ${uploadError.message}` };
  }

  // 2. Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('company-logos')
    .getPublicUrl(storagePath);

  console.log('[createFlashing] Image uploaded to:', publicUrl);

  // 3. Create database record
  const { data, error } = await supabase
    .from('flashing_library')
    .insert({
      name,
      description: description || null,
      image_url: publicUrl,
      company_id: profile.company_id,
      is_default: false,
    })
    .select()
    .single();
  
  if (error) {
    console.error('[createFlashing] Database error:', error);
    // Try to clean up uploaded file if database insert fails
    await supabase.storage.from('company-logos').remove([storagePath]);
    return { ok: false, code: 'internal_error', message: `Failed to create flashing: ${error.message}` };
  }
  
  revalidatePath('/[workspaceSlug]/flashings');
  return { ok: true, data: data as unknown as FlashingLibraryRow };
}

/**
 * Shared slot-acquisition gate for both create paths. Returns null on success,
 * or the envelope-shaped error so the caller can `return` directly.
 */
async function guardFlashingSlot(companyId: string): Promise<CreateFlashingResult | null> {
  try {
    await requireFlashingSlot(companyId);
    return null;
  } catch (err) {
    if (err instanceof FlashingLimitReachedError) {
      return {
        ok: false,
        code: 'flashing_limit_reached',
        used: err.used,
        limit: err.limit,
        planCode: err.planCode,
      };
    }
    if (err instanceof FeatureGatedError) {
      return {
        ok: false,
        code: 'feature_gated',
        currentPlan: err.currentPlan,
        requiredPlan: err.requiredPlan,
      };
    }
    if (err instanceof SubscriptionInactiveError) {
      return { ok: false, code: 'subscription_inactive', status: err.currentStatus };
    }
    throw err;
  }
}

export async function updateFlashing(id: string, input: Partial<FlashingLibraryInsert>): Promise<FlashingLibraryRow> {
  let profile;
  try {
    profile = await requireCompanyContext();
  } catch (err) {
    console.error('[updateFlashing] Failed to get company context:', err);
    throw new Error('Account setup incomplete. Please log out and log back in.');
  }

  console.log('[updateFlashing] Updating flashing:', id);

  // Whitelist columns before passing to the DB. `company_id`, `id`,
  // `created_at`, `updated_at` are NOT updatable from the client even if
  // a request tries to set them; see pickFields.ts (Gerald audit M-03).
  const UPDATABLE_FLASHING_FIELDS = [
    'name',
    'description',
    'image_url',
    'canvas_data',
    'measurements',
    'is_default',
  ] as const;
  const update = pickFields(input as Record<string, unknown>, UPDATABLE_FLASHING_FIELDS);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('flashing_library')
    // Cast safe: `update` keys come from UPDATABLE_FLASHING_FIELDS, and
    // FlashingLibraryInsert narrows `measurements` from Json to
    // FlashingMeasurement[] | null at the type boundary; the runtime
    // value is the same.
    .update(update as Record<string, unknown>)
    .eq('id', id)
    .eq('company_id', profile.company_id)
    .select()
    .single();

  if (error) {
    console.error('[updateFlashing] Database error:', error);
    throw new Error(`Failed to update flashing: ${error.message}`);
  }

  revalidatePath('/[workspaceSlug]/flashings');
  return data as unknown as FlashingLibraryRow;
}

export async function updateFlashingWithImage(id: string, formData: FormData): Promise<FlashingLibraryRow> {
  let profile;
  try {
    profile = await requireCompanyContext();
  } catch (err) {
    console.error('[updateFlashingWithImage] Failed to get company context:', err);
    throw new Error('Account setup incomplete. Please log out and log back in.');
  }

  const name = formData.get('name') as string;
  const description = formData.get('description') as string | null;
  const imageFile = formData.get('image') as File | null;
  const canvasData = formData.get('canvas_data') as string | null;
  const measurementsData = formData.get('measurements') as string | null;

  console.log('[updateFlashingWithImage] Updating flashing:', id);

  const supabase = await createSupabaseServerClient();

  // Get current flashing to get old image URL
  const { data: currentFlashing } = await supabase
    .from('flashing_library')
    .select('image_url')
    .eq('id', id)
    .single();

  let imageUrl = currentFlashing?.image_url;
  // Track whether we just uploaded a new image so we know to clean up the
  // OLD image only AFTER the DB update succeeds. If we deleted the old image
  // before the update and the update then failed, the surviving DB row
  // would point at a now-missing object and the user would see a broken
  // image with no path back.
  let oldImageUrlToCleanUp: string | null = null;

  // Upload new image if provided.
  if (imageFile && imageFile.size > 0) {
    const fileName = `${crypto.randomUUID()}.png`;
    const storagePath = `${profile.company_id}/flashings/${fileName}`;

    const arrayBuffer = await imageFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from('company-logos')
      .upload(storagePath, buffer, {
        contentType: 'image/png',
        upsert: false,
      });

    if (uploadError) {
      console.error('[updateFlashingWithImage] Upload error:', uploadError);
      throw new Error(`Failed to upload image: ${uploadError.message}`);
    }

    // Get new public URL
    const { data: { publicUrl } } = supabase.storage
      .from('company-logos')
      .getPublicUrl(storagePath);

    imageUrl = publicUrl;
    // Defer the old-image cleanup until AFTER the DB update succeeds.
    oldImageUrlToCleanUp = currentFlashing?.image_url ?? null;
  }

  // Update database
  const { data, error } = await supabase
    .from('flashing_library')
    .update({
      name,
      description: description || null,
      image_url: imageUrl,
      canvas_data: canvasData ? JSON.parse(canvasData) : undefined,
      measurements: measurementsData ? JSON.parse(measurementsData) : undefined,
    })
    .eq('id', id)
    .eq('company_id', profile.company_id)
    .select()
    .single();

  if (error) {
    console.error('[updateFlashingWithImage] Database error:', error);
    // Note: we don't clean up the freshly-uploaded NEW image on DB failure
    // because retrying the operation will pick a new uuid name. A periodic
    // orphan-sweep is the right tool for that, not inline rollback.
    throw new Error(`Failed to update flashing: ${error.message}`);
  }

  // DB update succeeded — NOW it is safe to remove the old image.
  if (oldImageUrlToCleanUp) {
    const oldPath = oldImageUrlToCleanUp.split('/storage/v1/object/public/company-logos/')[1];
    if (oldPath) {
      const { error: removeErr } = await supabase.storage.from('company-logos').remove([oldPath]);
      if (removeErr) {
        console.warn('[updateFlashingWithImage] Old image cleanup failed:', removeErr.message);
      }
    }
  }

  revalidatePath('/[workspaceSlug]/flashings');
  return data as unknown as FlashingLibraryRow;
}

export async function deleteFlashing(id: string) {
  let profile;
  try {
    profile = await requireCompanyContext();
  } catch (err) {
    console.error('[deleteFlashing] Failed to get company context:', err);
    throw new Error('Account setup incomplete. Please log out and log back in.');
  }

  console.log('[deleteFlashing] Deleting flashing:', id);

  const supabase = await createSupabaseServerClient();

  // 1. Get flashing record to find image URL
  const { data: flashing, error: fetchError } = await supabase
    .from('flashing_library')
    .select('image_url')
    .eq('id', id)
    .eq('company_id', profile.company_id)
    .single();

  if (fetchError) {
    console.error('[deleteFlashing] Fetch error:', fetchError);
    throw new Error(`Failed to fetch flashing: ${fetchError.message}`);
  }

  // 2. Delete from storage if image exists
  if (flashing?.image_url && !flashing.image_url.includes('placeholder')) {
    try {
      // Extract storage path from URL
      // URL format: https://{project}.supabase.co/storage/v1/object/public/company-logos/{path}
      const urlParts = flashing.image_url.split('/company-logos/');
      if (urlParts.length === 2) {
        const storagePath = urlParts[1];
        console.log('[deleteFlashing] Removing storage file:', storagePath);
        
        const { error: storageError } = await supabase.storage
          .from('company-logos')
          .remove([storagePath]);

        if (storageError) {
          console.error('[deleteFlashing] Storage deletion error:', storageError);
          // Don't throw - continue with database deletion even if storage fails
        }
      }
    } catch (err) {
      console.error('[deleteFlashing] Error parsing storage path:', err);
      // Don't throw - continue with database deletion
    }
  }

  // 3. Delete database record
  const { error } = await supabase
    .from('flashing_library')
    .delete()
    .eq('id', id)
    .eq('company_id', profile.company_id);
  
  if (error) {
    console.error('[deleteFlashing] Database error:', error);
    throw new Error(`Failed to delete flashing: ${error.message}`);
  }
  
  revalidatePath('/[workspaceSlug]/flashings');
}

export async function createFlashingFromCanvas(formData: FormData): Promise<CreateFlashingResult> {
  let profile;
  try {
    profile = await requireCompanyContext();
  } catch (err) {
    console.error('[createFlashingFromCanvas] Failed to get company context:', err);
    return { ok: false, code: 'internal_error', message: 'Account setup incomplete. Please log out and log back in.' };
  }

  // Tier gate: refuse before we upload anything.
  const gateResult = await guardFlashingSlot(profile.company_id);
  if (gateResult) return gateResult;

  const name = formData.get('name') as string;
  const description = formData.get('description') as string | null;
  const imageFile = formData.get('image') as File;
  const canvasData = formData.get('canvas_data') as string | null;
  const measurementsData = formData.get('measurements') as string | null;

  if (!name || !imageFile) {
    return { ok: false, code: 'internal_error', message: 'Name and image are required' };
  }

  console.log('[createFlashingFromCanvas] Creating flashing from canvas:', name);
  console.log('[createFlashingFromCanvas] Measurements:', measurementsData ? JSON.parse(measurementsData).length : 0);

  const supabase = await createSupabaseServerClient();

  // 1. Upload canvas image to storage
  const fileName = `${crypto.randomUUID()}.png`;
  const storagePath = `${profile.company_id}/flashings/${fileName}`;

  const arrayBuffer = await imageFile.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error: uploadError } = await supabase.storage
    .from('company-logos')
    .upload(storagePath, buffer, {
      contentType: 'image/png',
      upsert: false,
    });

  if (uploadError) {
    console.error('[createFlashingFromCanvas] Upload error:', uploadError);
    return { ok: false, code: 'internal_error', message: `Failed to upload canvas image: ${uploadError.message}` };
  }

  // 2. Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('company-logos')
    .getPublicUrl(storagePath);

  console.log('[createFlashingFromCanvas] Canvas image uploaded:', publicUrl);

  // 3. Create database record with canvas JSON and measurements
  const { data, error } = await supabase
    .from('flashing_library')
    .insert({
      name,
      description: description || null,
      image_url: publicUrl,
      canvas_data: canvasData ? JSON.parse(canvasData) : null,
      measurements: measurementsData ? JSON.parse(measurementsData) : [],
      company_id: profile.company_id,
      is_default: false,
    })
    .select()
    .single();
  
  if (error) {
    console.error('[createFlashingFromCanvas] Database error:', error);
    // Try to clean up uploaded file
    await supabase.storage.from('company-logos').remove([storagePath]);
    return { ok: false, code: 'internal_error', message: `Failed to create flashing: ${error.message}` };
  }
  
  revalidatePath('/[workspaceSlug]/flashings');
  return { ok: true, data: data as unknown as FlashingLibraryRow };
}
