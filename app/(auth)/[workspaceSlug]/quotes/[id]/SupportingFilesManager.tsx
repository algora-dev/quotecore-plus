'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/lib/supabase/client';
import { FileUploader } from '@/app/components/FileUploader';
import { checkStorageQuota, saveFileMetadata } from '../../account/actions';
import { deleteFile } from './actions-files';

interface SupportingFile {
  id: string;
  fileName: string;
  fileSize: number;
  url: string;
  uploadedAt: string;
}

interface Props {
  quoteId: string;
  companyId: string;
  initialFiles: SupportingFile[];
}

export function SupportingFilesManager({ quoteId, companyId, initialFiles }: Props) {
  const [files, setFiles] = useState<SupportingFile[]>(initialFiles);
  const [showUploader, setShowUploader] = useState(false);
  const [expanded, setExpanded] = useState(initialFiles.length === 0); // Auto-expand if empty
  const [deleting, setDeleting] = useState<string | null>(null);
  const router = useRouter();

  async function handleUpload(file: File) {
    // Check quota
    const hasQuota = await checkStorageQuota(companyId, file.size);
    if (!hasQuota) {
      throw new Error('Storage quota exceeded. Please upgrade your plan.');
    }

    // Upload to Supabase Storage
    const supabase = createClient();
    const fileExt = file.name.split('.').pop();
    const fileName = `supporting-${Date.now()}.${fileExt}`;
    const storagePath = `${companyId}/${quoteId}/supporting/${fileName}`;
    
    const { error: uploadError } = await supabase.storage
      .from('QUOTE-DOCUMENTS')
      .upload(storagePath, file, { upsert: true });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('QUOTE-DOCUMENTS')
      .getPublicUrl(storagePath);

    const publicUrl = urlData.publicUrl;

    // Save metadata
    await saveFileMetadata({
      companyId,
      quoteId,
      fileType: 'supporting',
      fileName,
      fileSize: file.size,
      mimeType: file.type,
      storagePath,
    });

    // Add to local state
    const newFile: SupportingFile = {
      id: storagePath, // Temporary ID (will be replaced on refresh)
      fileName,
      fileSize: file.size,
      url: publicUrl,
      uploadedAt: new Date().toISOString(),
    };
    setFiles(prev => [...prev, newFile]);
    setShowUploader(false);
    router.refresh();
  }

  async function handleDelete(fileId: string, storagePath: string) {
    if (!confirm('Delete this file? This cannot be undone.')) {
      return;
    }

    setDeleting(fileId);
    try {
      await deleteFile(fileId, storagePath);
      setFiles(prev => prev.filter(f => f.id !== fileId));
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete file');
    } finally {
      setDeleting(null);
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-sm font-semibold text-slate-900 hover:text-slate-700"
        >
          <svg
            className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          Supporting Files
          {files.length > 0 && (
            <span className="text-xs font-normal text-slate-500">({files.length})</span>
          )}
        </button>
        {expanded && (
          <button
            onClick={() => setShowUploader(!showUploader)}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            {showUploader ? 'Cancel' : '+ Add File'}
          </button>
        )}
      </div>

      {expanded && (
        <>
          <p className="text-xs text-slate-500">
            Upload photos, revised plans, or site images. Max 10 MB per file.
          </p>

          {showUploader && (
            <FileUploader
              accept="image/*,application/pdf"
              maxSize={10485760} // 10 MB
              onUpload={handleUpload}
              currentFileUrl={null}
              label="Upload Supporting File"
              description="PDF or image (max 10 MB)"
            />
          )}

          {files.length > 0 ? (
            <div className="space-y-2">
              {files.map(file => (
                <div
                  key={file.id}
                  className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200"
                >
                  <div className="flex-shrink-0">
                    {file.fileName.toLowerCase().endsWith('.pdf') ? (
                      <svg className="w-10 h-10 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                      </svg>
                    ) : (
                      <img
                        src={file.url}
                        alt={file.fileName}
                        className="w-10 h-10 object-cover rounded border border-slate-300"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{file.fileName}</p>
                    <p className="text-xs text-slate-500">{formatFileSize(file.fileSize)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      View
                    </a>
                    <button
                      onClick={() => handleDelete(file.id, file.fileName)}
                      disabled={deleting === file.id}
                      className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                    >
                      {deleting === file.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">No supporting files uploaded yet.</p>
          )}
        </>
      )}
    </div>
  );
}
