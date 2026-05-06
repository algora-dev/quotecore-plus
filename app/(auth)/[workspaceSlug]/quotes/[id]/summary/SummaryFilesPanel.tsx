'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/lib/supabase/client';
import { FileUploader } from '@/app/components/FileUploader';
import { SummaryFileRow } from './SummaryFileRow';
import { checkStorageQuota, saveFileMetadata } from '../../../account/actions';

interface FileEntry {
  id: string;
  file_name: string;
  file_type: 'plan' | 'supporting' | 'canvas' | string;
  file_size: number;
  storage_path: string;
  url: string;
}

interface Props {
  quoteId: string;
  companyId: string;
  files: FileEntry[];
}

/**
 * Summary "Files & Documents" panel.
 *
 * Renders the existing files (plan, takeoff snapshots, supporting uploads) and an
 * inline "Upload" affordance so users can add more supporting files without going
 * back to the Quote Builder. Uploaded files always go in as `supporting` — the
 * single-slot Roof Plan is owned by the takeoff flow and shouldn't be replaced
 * from here.
 */
export function SummaryFilesPanel({ quoteId, companyId, files }: Props) {
  const router = useRouter();
  const [uploaderOpen, setUploaderOpen] = useState(false);

  async function handleSupportingUpload(file: File) {
    // Quota check via the existing company action so the user gets a friendly
    // error instead of a 500 from Storage.
    const hasQuota = await checkStorageQuota(companyId, file.size);
    if (!hasQuota) {
      throw new Error('Storage quota exceeded. Please upgrade your plan.');
    }

    const supabase = createClient();
    const fileExt = file.name.split('.').pop() || 'bin';
    const fileName = `supporting-${Date.now()}.${fileExt}`;
    const storagePath = `${companyId}/${quoteId}/supporting/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('QUOTE-DOCUMENTS')
      .upload(storagePath, file, { upsert: true });
    if (uploadError) throw new Error(uploadError.message);

    await saveFileMetadata({
      companyId,
      quoteId,
      fileType: 'supporting',
      fileName,
      fileSize: file.size,
      mimeType: file.type,
      storagePath,
    });

    setUploaderOpen(false);
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 data-exclude-pdf">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-900">Files &amp; Documents</h3>
        <button
          type="button"
          onClick={() => setUploaderOpen((v) => !v)}
          title={uploaderOpen ? 'Cancel upload' : 'Upload supporting file'}
          className="icon-btn border-slate-300 bg-white"
        >
          {uploaderOpen ? (
            // Close (X) icon
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            // Upload (arrow up to tray) icon
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M17 8l-5-5m0 0L7 8m5-5v12"
              />
            </svg>
          )}
        </button>
      </div>

      {uploaderOpen && (
        <div className="mb-3">
          <FileUploader
            accept="image/*,application/pdf"
            maxSize={10485760}
            onUpload={handleSupportingUpload}
            currentFileUrl={null}
            label="Upload Supporting File"
            description="PDF or image (max 10 MB) — added as a supporting file on this quote"
          />
        </div>
      )}

      {files.length === 0 ? (
        <p className="text-xs text-slate-400 italic">No files attached yet.</p>
      ) : (
        <div className="space-y-2">
          {files.map((file) => (
            <SummaryFileRow
              key={file.id}
              quoteId={quoteId}
              id={file.id}
              fileName={file.file_name}
              fileType={file.file_type as string}
              fileSize={file.file_size}
              storagePath={file.storage_path}
              url={file.url}
            />
          ))}
        </div>
      )}
    </div>
  );
}
