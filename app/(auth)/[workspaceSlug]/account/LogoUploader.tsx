'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/lib/supabase/client';
import { FileUploader } from '@/app/components/FileUploader';
import { checkStorageQuota, saveFileMetadata } from './actions';

interface Props {
  companyId: string;
  currentLogoUrl: string | null;
}

export function LogoUploader({ companyId, currentLogoUrl }: Props) {
  const [logoUrl, setLogoUrl] = useState(currentLogoUrl);
  const router = useRouter();

  async function handleUpload(file: File) {
    // Check quota
    const hasQuota = await checkStorageQuota(companyId, file.size);
    if (!hasQuota) {
      throw new Error('Storage quota exceeded. Please upgrade your plan.');
    }

    // Upload to Supabase Storage (client-side)
    const supabase = createClient();
    const fileName = `logo.${file.name.split('.').pop()}`;
    const storagePath = `${companyId}/${fileName}`;
    
    const { error: uploadError } = await supabase.storage
      .from('company-logos')
      .upload(storagePath, file, { upsert: true });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('company-logos')
      .getPublicUrl(storagePath);

    const publicUrl = urlData.publicUrl;

    // Save metadata
    await saveFileMetadata({
      companyId,
      fileType: 'logo',
      fileName,
      fileSize: file.size,
      mimeType: file.type,
      storagePath,
    });

    setLogoUrl(publicUrl);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-900">Company Logo</h3>
      <p className="text-xs text-slate-500">
        This logo will appear on customer quotes. Recommended: 400×200px PNG with transparent background.
      </p>
      
      <FileUploader
        accept="image/jpeg,image/png,image/webp"
        maxSize={2097152} // 2 MB
        onUpload={handleUpload}
        currentFileUrl={logoUrl}
        label="Upload Logo"
        description="PNG, JPG or WebP (max 2 MB)"
      />
    </div>
  );
}
