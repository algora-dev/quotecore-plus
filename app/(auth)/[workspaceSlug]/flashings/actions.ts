'use server';
import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import type { FlashingLibraryInsert } from '@/app/lib/types';
import { redirect } from 'next/navigation';

export async function loadFlashingLibrary() {
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
  return data || [];
}

export async function createFlashing(formData: FormData) {
  let profile;
  try {
    profile = await requireCompanyContext();
  } catch (err) {
    console.error('[createFlashing] Failed to get company context:', err);
    throw new Error('Account setup incomplete. Please log out and log back in.');
  }

  const name = formData.get('name') as string;
  const description = formData.get('description') as string | null;
  const imageFile = formData.get('image') as File;

  if (!name || !imageFile) {
    throw new Error('Name and image file are required');
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
    throw new Error(`Failed to upload image: ${uploadError.message}`);
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
    throw new Error(`Failed to create flashing: ${error.message}`);
  }
  
  revalidatePath('/[workspaceSlug]/flashings');
  return data;
}

export async function updateFlashing(id: string, input: Partial<FlashingLibraryInsert>) {
  let profile;
  try {
    profile = await requireCompanyContext();
  } catch (err) {
    console.error('[updateFlashing] Failed to get company context:', err);
    throw new Error('Account setup incomplete. Please log out and log back in.');
  }

  console.log('[updateFlashing] Updating flashing:', id);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('flashing_library')
    .update(input)
    .eq('id', id)
    .eq('company_id', profile.company_id)
    .select()
    .single();
  
  if (error) {
    console.error('[updateFlashing] Database error:', error);
    throw new Error(`Failed to update flashing: ${error.message}`);
  }
  
  revalidatePath('/[workspaceSlug]/flashings');
  return data;
}

export async function updateFlashingWithImage(id: string, formData: FormData) {
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

  // Upload new image if provided
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

    // Delete old image (best effort)
    if (currentFlashing?.image_url) {
      const oldPath = currentFlashing.image_url.split('/storage/v1/object/public/company-logos/')[1];
      if (oldPath) {
        await supabase.storage.from('company-logos').remove([oldPath]);
      }
    }
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
    throw new Error(`Failed to update flashing: ${error.message}`);
  }

  revalidatePath('/[workspaceSlug]/flashings');
  return data;
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

export async function createFlashingFromCanvas(formData: FormData) {
  let profile;
  try {
    profile = await requireCompanyContext();
  } catch (err) {
    console.error('[createFlashingFromCanvas] Failed to get company context:', err);
    throw new Error('Account setup incomplete. Please log out and log back in.');
  }

  const name = formData.get('name') as string;
  const description = formData.get('description') as string | null;
  const imageFile = formData.get('image') as File;
  const canvasData = formData.get('canvas_data') as string | null;
  const measurementsData = formData.get('measurements') as string | null;

  if (!name || !imageFile) {
    throw new Error('Name and image are required');
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
    throw new Error(`Failed to upload canvas image: ${uploadError.message}`);
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
    throw new Error(`Failed to create flashing: ${error.message}`);
  }
  
  revalidatePath('/[workspaceSlug]/flashings');
  return data;
}
