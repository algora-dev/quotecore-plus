'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
  workspaceSlug: string;
  planUrl: string | null;
  planName: string | null;
  supportingFiles: SupportingFile[];
}

export function FilesManager({ quoteId, companyId, workspaceSlug, planUrl: initialPlanUrl, planName: initialPlanName, supportingFiles: initialFiles }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [supportingExpanded, setSupportingExpanded] = useState(false);
  const [showSupportingUploader, setShowSupportingUploader] = useState(false);
  const [planUrl, setPlanUrl] = useState(initialPlanUrl);
  const [planName, setPlanName] = useState(initialPlanName);
  const [supportingFiles, setSupportingFiles] = useState<SupportingFile[]>(initialFiles);
  const [deleting, setDeleting] = useState<string | null>(null);
  const router = useRouter();

  async function handlePlanUpload(file: File) {
    const hasQuota = await checkStorageQuota(companyId, file.size);
    if (!hasQuota) {
      throw new Error('Storage quota exceeded. Please upgrade your plan.');
    }

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

    const { data: urlData } = supabase.storage
      .from('QUOTE-DOCUMENTS')
      .getPublicUrl(storagePath);

    await saveFileMetadata({
      companyId,
      quoteId,
      fileType: 'plan',
      fileName,
      fileSize: file.size,
      mimeType: file.type,
      storagePath,
    });

    setPlanUrl(urlData.publicUrl);
    setPlanName(fileName);
    router.refresh();
  }

  async function handleSupportingUpload(file: File) {
    const hasQuota = await checkStorageQuota(companyId, file.size);
    if (!hasQuota) {
      throw new Error('Storage quota exceeded. Please upgrade your plan.');
    }

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

    const { data: urlData } = supabase.storage
      .from('QUOTE-DOCUMENTS')
      .getPublicUrl(storagePath);

    await saveFileMetadata({
      companyId,
      quoteId,
      fileType: 'supporting',
      fileName,
      fileSize: file.size,
      mimeType: file.type,
      storagePath,
    });

    const newFile: SupportingFile = {
      id: storagePath,
      fileName,
      fileSize: file.size,
      url: urlData.publicUrl,
      uploadedAt: new Date().toISOString(),
    };
    setSupportingFiles(prev => [...prev, newFile]);
    setShowSupportingUploader(false);
    router.refresh();
  }

  async function handleDelete(fileId: string, storagePath: string) {
    if (!confirm('Delete this file? This cannot be undone.')) {
      return;
    }

    setDeleting(fileId);
    try {
      await deleteFile(fileId, storagePath);
      setSupportingFiles(prev => prev.filter(f => f.id !== fileId));
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

  const totalFiles = (planUrl ? 1 : 0) + supportingFiles.length;

  return (
    <div className="border-l-4 border-slate-300 bg-slate-50 pl-3 py-2 rounded">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 w-full"
      >
        <svg
          className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        Roof plans and files
        {totalFiles > 0 && (
          <span className="text-xs font-normal text-slate-500">({totalFiles})</span>
        )}
      </button>

      {expanded && (
        <div className="mt-3 mr-3 space-y-6 bg-white p-4 rounded-lg border border-slate-200">
          {/* Roof Plan Section */}
          <div>
            <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">Roof Plan</h3>
            <p className="text-xs text-slate-500 mb-3">
              Upload roof plan (PDF or image) for digital takeoff. Max 10 MB.
            </p>

            {planUrl && planName ? (
              <div className="space-y-3">
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
                      className="text-xs text-orange-600 hover:text-blue-800"
                    >
                      View Plan →
                    </a>
                  </div>
                </div>

                {/* Digital Takeoff Button */}
                <Link
                  href={`/${workspaceSlug}/quotes/${quoteId}/takeoff`}
                  className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Use Digital Take-off Station
                </Link>
              </div>
            ) : (
              <FileUploader
                accept="image/*,application/pdf"
                maxSize={10485760}
                onUpload={handlePlanUpload}
                currentFileUrl={null}
                label="Upload Roof Plan"
                description="PDF or image (max 10 MB)"
              />
            )}
          </div>

          {/* Supporting Files Section */}
          <div className="pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={() => setSupportingExpanded(!supportingExpanded)}
                className="flex items-center gap-2 text-xs font-semibold text-slate-700 uppercase tracking-wide hover:text-slate-900"
              >
                <svg
                  className={`w-3 h-3 transition-transform ${supportingExpanded ? 'rotate-90' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Supporting Files
                {supportingFiles.length > 0 && (
                  <span className="text-xs font-normal text-slate-500">({supportingFiles.length})</span>
                )}
              </button>
              {supportingExpanded && (
                <button
                  onClick={() => setShowSupportingUploader(!showSupportingUploader)}
                  className="text-xs text-orange-600 hover:text-blue-800 font-medium"
                >
                  {showSupportingUploader ? 'Cancel' : '+ Add File'}
                </button>
              )}
            </div>

            {supportingExpanded && (
              <>
                <p className="text-xs text-slate-500 mb-3">
                  Photos, revised plans, or site images. Max 10 MB per file.
                </p>

                {showSupportingUploader && (
                  <div className="mb-3">
                    <FileUploader
                      accept="image/*,application/pdf"
                      maxSize={10485760}
                      onUpload={handleSupportingUpload}
                      currentFileUrl={null}
                      label="Upload Supporting File"
                      description="PDF or image (max 10 MB)"
                    />
                  </div>
                )}

                {supportingFiles.length > 0 ? (
                  <div className="space-y-2">
                    {supportingFiles.map(file => (
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
                            className="text-xs text-orange-600 hover:text-blue-800"
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
                  <p className="text-xs text-slate-400 italic">No supporting files yet.</p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
