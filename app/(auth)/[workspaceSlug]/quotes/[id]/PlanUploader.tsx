'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/lib/supabase/client';
import { FileUploader } from '@/app/components/FileUploader';
import { checkStorageQuota, saveFileMetadata } from '../../account/actions';

interface Props {
  quoteId: string;
  companyId: string;
  currentPlanUrl: string | null;
  currentPlanName: string | null;
}

export function PlanUploader({ quoteId, companyId, currentPlanUrl, currentPlanName }: Props) {
  const [planUrl, setPlanUrl] = useState(currentPlanUrl);
  const [planName, setPlanName] = useState(currentPlanName);
  const router = useRouter();

  async function handleUpload(file: File) {
    // Check quota
    const hasQuota = await checkStorageQuota(companyId, file.size);
    if (!hasQuota) {
      throw new Error('Storage quota exceeded. Please upgrade your plan.');
    }

    // Upload to Supabase Storage (client-side)
    const supabase = createClient();
    const fileExt = file.name.split('.').pop();
    const fileName = `plan-${Date.now()}.${fileExt}`;
    const storagePath = `${companyId}/${quoteId}/${fileName}`;
    
    const { error: uploadError } = await supabase.storage
      .from('QUOTE-DOCUMENTS')
      .upload(storagePath, file, { upsert: true });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    // Get public URL (even though bucket is private, we get a signed URL via action)
    const { data: urlData } = supabase.storage
      .from('QUOTE-DOCUMENTS')
      .getPublicUrl(storagePath);

    const publicUrl = urlData.publicUrl;

    // Save metadata
    await saveFileMetadata({
      companyId,
      quoteId,
      fileType: 'plan',
      fileName,
      fileSize: file.size,
      mimeType: file.type,
      storagePath,
    });

    setPlanUrl(publicUrl);
    setPlanName(fileName);
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm('Delete this roof plan? This cannot be undone.')) {
      return;
    }

    // TODO: Add delete action
    alert('Delete functionality coming soon!');
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Roof Plan</h3>
        {planUrl && (
          <button
            onClick={handleDelete}
            className="text-xs text-red-600 hover:text-red-800"
          >
            Delete Plan
          </button>
        )}
      </div>
      
      <p className="text-xs text-slate-500">
        Upload a roof plan (PDF or image) for digital takeoff. Max 10 MB.
      </p>

      {planUrl && planName ? (
        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
          <div className="flex-shrink-0">
            {planName.toLowerCase().endsWith('.pdf') ? (
              <svg className="w-12 h-12 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
              </svg>
            ) : (
              <img
                src={planUrl}
                alt="Roof plan"
                className="w-12 h-12 object-cover rounded border border-slate-300"
              />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-700 truncate">{planName}</p>
            <a
              href={planUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              View Plan →
            </a>
          </div>
        </div>
      ) : (
        <FileUploader
          accept="image/*,application/pdf"
          maxSize={10485760} // 10 MB
          onUpload={handleUpload}
          currentFileUrl={null}
          label="Upload Roof Plan"
          description="PDF or image (max 10 MB)"
        />
      )}
    </div>
  );
}
