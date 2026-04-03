'use server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { requireCompanyContext } from '@/app/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function deleteFile(fileId: string, storagePath: string): Promise<void> {
  const profile = await requireCompanyContext();
  
  const supabaseAdmin = createAdminClient();
  
  // Get file to verify ownership
  const { data: file } = await supabaseAdmin
    .from('quote_files')
    .select('company_id')
    .eq('id', fileId)
    .single();
  
  if (!file || file.company_id !== profile.company_id) {
    throw new Error('Unauthorized');
  }
  
  // Delete from storage
  const { error: storageError } = await supabaseAdmin.storage
    .from('QUOTE-DOCUMENTS')
    .remove([storagePath]);
  
  if (storageError) {
    console.error('[deleteFile] Storage error:', storageError);
    throw new Error(`Failed to delete file from storage: ${storageError.message}`);
  }
  
  // Delete from database (triggers storage_used_bytes update)
  const { error: dbError } = await supabaseAdmin
    .from('quote_files')
    .delete()
    .eq('id', fileId);
  
  if (dbError) {
    console.error('[deleteFile] Database error:', dbError);
    throw new Error(`Failed to delete file metadata: ${dbError.message}`);
  }
  
  revalidatePath('/quotes');
}
