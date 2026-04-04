'use client';
import { useState } from 'react';
import { createClient } from '@/app/lib/supabase/client';
import { FileUploader } from '@/app/components/FileUploader';

interface Props {
  companyId: string;
  templateId: string;
  currentLogoUrl: string | null;
  onUploadComplete: (url: string) => void;
}

export function CustomerTemplateLogoUploader({ companyId, templateId, currentLogoUrl, onUploadComplete }: Props) {
  const [logoUrl, setLogoUrl] = useState(currentLogoUrl);
  const [uploading, setUploading] = useState(false);

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      // Upload to Supabase Storage (client-side)
      const supabase = createClient();
      const fileName = `template-${templateId}-logo.${file.name.split('.').pop()}`;
      const storagePath = `${companyId}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('COMPANY-LOGOS')
        .upload(storagePath, file, { upsert: true });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('COMPANY-LOGOS')
        .getPublicUrl(storagePath);

      const publicUrl = urlData.publicUrl;

      setLogoUrl(publicUrl);
      onUploadComplete(publicUrl);
    } catch (err) {
      console.error('Upload failed:', err);
      throw err;
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove() {
    setLogoUrl(null);
    onUploadComplete('');
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-slate-700">Template Logo</label>
      <p className="text-xs text-slate-500">
        Upload a different logo for this template (optional). Leave blank to use account default.
      </p>

      <FileUploader
        onUpload={handleUpload}
        maxSizeMB={2}
        accept="image/*"
        label="Drop logo here or click to browse"
      />

      {logoUrl && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">Current Logo</label>
          <div className="flex items-center gap-3">
            <img 
              src={logoUrl} 
              alt="Template Logo" 
              className="h-16 object-contain border border-slate-200 rounded p-2 bg-white"
            />
            <button
              onClick={handleRemove}
              className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-300 rounded hover:bg-red-50"
            >
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
