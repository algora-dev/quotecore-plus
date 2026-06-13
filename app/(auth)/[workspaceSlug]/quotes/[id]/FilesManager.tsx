'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/app/lib/supabase/client';
import { FileUploader } from '@/app/components/FileUploader';
import { checkStorageQuota, saveFileMetadata, getQuoteFileSignedUrl } from '@/app/lib/files/storage-actions';
import { mintQuoteDocumentUploadUrl } from '@/app/lib/files/signed-upload';
import { deleteFile } from './actions-files';
import { ConfirmModal } from '@/app/components/ConfirmModal';
import { createTakeoffPageForArea } from './takeoff/actions';

// QUOTE-DOCUMENTS is private. After uploading, we ask the server to mint a
// short-lived signed URL so the freshly-uploaded image previews correctly
// without exposing the service-role key in the browser.
const QUOTE_DOCS_BUCKET = 'QUOTE-DOCUMENTS';

interface SupportingFile {
  storagePath: string;
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
  /** True when this quote already has saved takeoff measurements. */
  hasExistingTakeoff?: boolean;
  /** Signed URL for the lines-only canvas snapshot (if the takeoff was ever saved). */
  linesImageUrl?: string | null;
  /** Raw storage path for the current plan file - used when cloning page-1 for a new area. */
  planStoragePath?: string | null;
  /** When true the company is over storage - block file uploads. */
  isOverStorage?: boolean;
}

type TakeoffOption = 'continue' | 'new-area-same-plan' | 'new-area-new-plan';
type PlanMode = 'clean' | 'lines';

export function FilesManager({
  quoteId,
  companyId,
  workspaceSlug,
  planUrl: initialPlanUrl,
  planName: initialPlanName,
  supportingFiles: initialFiles,
  hasExistingTakeoff = false,
  linesImageUrl = null,
  planStoragePath = null,
  isOverStorage,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [supportingExpanded, setSupportingExpanded] = useState(false);
  const [showSupportingUploader, setShowSupportingUploader] = useState(false);
  const [planUrl, setPlanUrl] = useState(initialPlanUrl);
  const [planName, setPlanName] = useState(initialPlanName);
  const [supportingFiles, setSupportingFiles] = useState<SupportingFile[]>(initialFiles);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SupportingFile | null>(null);
  const router = useRouter();

  // --- Takeoff re-entry modal state ---
  const [showTakeoffModal, setShowTakeoffModal] = useState(false);
  const [takeoffOption, setTakeoffOption] = useState<TakeoffOption>('continue');
  const [planMode, setPlanMode] = useState<PlanMode>('clean');
  const [areaName, setAreaName] = useState('');
  const [newPlanFile, setNewPlanFile] = useState<File | null>(null);
  const [isStartingTakeoff, setIsStartingTakeoff] = useState(false);
  const [takeoffError, setTakeoffError] = useState<string | null>(null);

  async function handlePlanUpload(file: File) {
    const hasQuota = await checkStorageQuota(companyId, file.size);
    if (!hasQuota) {
      throw new Error('Storage quota exceeded. Please upgrade your plan.');
    }

    // Gerald audit H-05: signed-upload-URL flow.
    const mint = await mintQuoteDocumentUploadUrl({
      scope: { kind: 'quote', quoteId },
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
      claimedSize: file.size,
    });
    if (!mint.ok) throw new Error(mint.message);

    const supabase = createClient();
    const { error: uploadError } = await supabase.storage
      .from(mint.bucket)
      .uploadToSignedUrl(mint.storagePath, mint.token, file, {
        contentType: file.type || undefined,
      });
    if (uploadError) throw new Error(uploadError.message);

    await saveFileMetadata({
      companyId,
      quoteId,
      fileType: 'plan',
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      storagePath: mint.storagePath,
    });

    const signedUrl = await getQuoteFileSignedUrl(mint.storagePath);
    setPlanUrl(signedUrl);
    setPlanName(file.name);
    router.refresh();
  }

  async function handleSupportingUpload(file: File) {
    const hasQuota = await checkStorageQuota(companyId, file.size);
    if (!hasQuota) {
      throw new Error('Storage quota exceeded. Please upgrade your plan.');
    }

    const mint = await mintQuoteDocumentUploadUrl({
      scope: { kind: 'quote', quoteId },
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
      claimedSize: file.size,
    });
    if (!mint.ok) throw new Error(mint.message);

    const supabase = createClient();
    const { error: uploadError } = await supabase.storage
      .from(mint.bucket)
      .uploadToSignedUrl(mint.storagePath, mint.token, file, {
        contentType: file.type || undefined,
      });
    if (uploadError) throw new Error(uploadError.message);

    await saveFileMetadata({
      companyId,
      quoteId,
      fileType: 'supporting',
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      storagePath: mint.storagePath,
    });

    // Mint a signed URL via a server action (private bucket).
    const signedUrl = await getQuoteFileSignedUrl(mint.storagePath);

    const newFile: SupportingFile = {
      id: mint.storagePath, // transient - router.refresh() below replaces this with the real DB id
      storagePath: mint.storagePath,
      fileName: file.name,
      fileSize: file.size,
      url: signedUrl,
      uploadedAt: new Date().toISOString(),
    };
    setSupportingFiles(prev => [...prev, newFile]);
    setShowSupportingUploader(false);
    router.refresh();
  }

  function requestDelete(file: SupportingFile) {
    setPendingDelete(file);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const { id: fileId } = pendingDelete;
    setDeleting(fileId);
    try {
      // Server derives the storage path from the DB row - we no longer
      // pass `storagePath` here (Gerald audit H-01, 2026-05-11).
      await deleteFile(fileId);
      setSupportingFiles(prev => prev.filter(f => f.id !== fileId));
      setPendingDelete(null);
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

  // --- Takeoff entry logic ---

  function handleTakeoffClick() {
    if (!hasExistingTakeoff) {
      // First time - go straight in, no modal needed.
      router.push(`/${workspaceSlug}/quotes/${quoteId}/takeoff`);
      return;
    }
    // Re-entry - show the 3-option modal.
    setTakeoffOption('continue');
    setPlanMode('clean');
    setAreaName('');
    setNewPlanFile(null);
    setTakeoffError(null);
    setShowTakeoffModal(true);
  }

  async function handleTakeoffConfirm() {
    setTakeoffError(null);
    setIsStartingTakeoff(true);

    try {
      if (takeoffOption === 'continue') {
        const pm = linesImageUrl ? `&planMode=${planMode}` : '';
        router.push(`/${workspaceSlug}/quotes/${quoteId}/takeoff?mode=add${pm}`);
        setShowTakeoffModal(false);
        return;
      }

      if (takeoffOption === 'new-area-same-plan') {
        if (!areaName.trim()) {
          setTakeoffError('Please enter a name for this area.');
          return;
        }
        // Server creates the new page (uses page-1 image path).
        const encoded = encodeURIComponent(areaName.trim());
        router.push(`/${workspaceSlug}/quotes/${quoteId}/takeoff?mode=new-page&areaName=${encoded}`);
        setShowTakeoffModal(false);
        return;
      }

      if (takeoffOption === 'new-area-new-plan') {
        if (!areaName.trim()) {
          setTakeoffError('Please enter a name for this area.');
          return;
        }
        if (!newPlanFile) {
          setTakeoffError('Please upload a plan for this area.');
          return;
        }

        // 1. Upload new plan file.
        const hasQuota = await checkStorageQuota(companyId, newPlanFile.size);
        if (!hasQuota) {
          setTakeoffError('Storage quota exceeded. Please upgrade your plan.');
          return;
        }
        const mint = await mintQuoteDocumentUploadUrl({
          scope: { kind: 'quote', quoteId },
          filename: newPlanFile.name,
          contentType: newPlanFile.type || 'application/octet-stream',
          claimedSize: newPlanFile.size,
        });
        if (!mint.ok) {
          setTakeoffError(mint.message || 'Failed to prepare upload.');
          return;
        }
        const supabase = createClient();
        const { error: uploadError } = await supabase.storage
          .from(mint.bucket)
          .uploadToSignedUrl(mint.storagePath, mint.token, newPlanFile, {
            contentType: newPlanFile.type || undefined,
          });
        if (uploadError) {
          setTakeoffError(uploadError.message);
          return;
        }

        // 2. Record the new plan image in quote_files so it appears in
        // Files & Documents on the quote summary (same as the original plan).
        await saveFileMetadata({
          companyId,
          quoteId,
          fileType: 'plan',
          fileName: newPlanFile.name,
          fileSize: newPlanFile.size,
          mimeType: newPlanFile.type || 'image/png',
          storagePath: mint.storagePath,
        });

        // 3. Create the new takeoff page with the uploaded image.
        const result = await createTakeoffPageForArea(quoteId, areaName.trim(), mint.storagePath);
        if (!result.ok || !result.pageId) {
          setTakeoffError(result.error || 'Failed to create new takeoff page.');
          return;
        }

        // 3. Navigate to takeoff with the new page + roofAreaId.
        const encoded = encodeURIComponent(areaName.trim());
        const raParam = result.roofAreaId ? `&roofAreaId=${result.roofAreaId}` : '';
        router.push(
          `/${workspaceSlug}/quotes/${quoteId}/takeoff?mode=new-page&areaName=${encoded}&pageId=${result.pageId}${raParam}`
        );
        setShowTakeoffModal(false);
        return;
      }
    } finally {
      setIsStartingTakeoff(false);
    }
  }

  const totalFiles = (planUrl ? 1 : 0) + supportingFiles.length;

  return (
    <>
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
        Plans and files
        {totalFiles > 0 && (
          <span className="text-xs font-normal text-slate-500">({totalFiles})</span>
        )}
      </button>

      {expanded && (
        <div className="mt-3 mr-3 space-y-6 bg-white p-4 rounded-lg border border-slate-200">
          {/* Roof Plan Section */}
          <div>
            <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">Plan / Image</h3>
            <p className="text-xs text-slate-500 mb-3">
              Upload your plan or image (PDF or image). Max 10 MB.
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
                <button
                  onClick={handleTakeoffClick}
                  className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-black text-white font-medium rounded-full hover:bg-slate-800 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  {hasExistingTakeoff ? 'Edit Digital Take-off' : 'Use Digital Take-off Station'}
                </button>
              </div>
            ) : (
              <FileUploader
                accept="image/*,application/pdf"
                maxSize={10485760}
                onUpload={handlePlanUpload}
                currentFileUrl={null}
                label="Upload Plans / Images"
                description="PDF or image (max 10 MB)"
                isOverStorage={isOverStorage}
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
                      isOverStorage={isOverStorage}
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
                            onClick={() => requestDelete(file)}
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

    {/* --- Delete confirm modal --- */}
    <ConfirmModal
      open={pendingDelete !== null}
      title="Delete file"
      description={
        pendingDelete
          ? `Delete "${pendingDelete.fileName}"? This cannot be undone.`
          : ''
      }
      confirmLabel="Delete"
      pendingLabel="Deleting..."
      pending={deleting !== null}
      onCancel={() => { if (deleting === null) setPendingDelete(null); }}
      onConfirm={confirmDelete}
    />

    {/* --- Takeoff re-entry modal --- */}
    {showTakeoffModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-1">Edit Digital Take-off</h2>
            <p className="text-sm text-slate-500 mb-5">
              This quote already has measurements. What would you like to do?
            </p>

            {/* Option A */}
            <button
              onClick={() => setTakeoffOption('continue')}
              className={`w-full text-left p-4 rounded-xl border-2 mb-3 transition-colors ${
                takeoffOption === 'continue'
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <p className="text-sm font-semibold text-slate-900">Continue measuring on this plan</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Add more measurements to the existing plan. Existing entries are preserved.
              </p>
            </button>

            {/* Option A sub-toggle - plan mode */}
            {takeoffOption === 'continue' && linesImageUrl && (
              <div className="ml-4 mb-3 space-y-2">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="radio"
                    name="planMode"
                    checked={planMode === 'clean'}
                    onChange={() => setPlanMode('clean')}
                    className="w-4 h-4 accent-orange-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-800">Use clean plan</p>
                    <p className="text-xs text-slate-500">Original plan without any markings</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="radio"
                    name="planMode"
                    checked={planMode === 'lines'}
                    onChange={() => setPlanMode('lines')}
                    className="w-4 h-4 accent-orange-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-800">Show measurements on plan</p>
                    <p className="text-xs text-slate-500">Plan with previous measurements marked in colour</p>
                  </div>
                </label>
              </div>
            )}

            {/* Option B */}
            <button
              onClick={() => setTakeoffOption('new-area-same-plan')}
              className={`w-full text-left p-4 rounded-xl border-2 mb-3 transition-colors ${
                takeoffOption === 'new-area-same-plan'
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <p className="text-sm font-semibold text-slate-900">New area, same plan</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Measure a different area using the same plan (e.g. garage roof).
              </p>
            </button>

            {takeoffOption === 'new-area-same-plan' && (
              <div className="ml-4 mb-3">
                <label className="block text-xs font-medium text-slate-700 mb-1">Area name</label>
                <input
                  type="text"
                  placeholder="e.g. Garage Roof"
                  value={areaName}
                  onChange={e => setAreaName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            )}

            {/* Option C */}
            <button
              onClick={() => setTakeoffOption('new-area-new-plan')}
              className={`w-full text-left p-4 rounded-xl border-2 mb-3 transition-colors ${
                takeoffOption === 'new-area-new-plan'
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <p className="text-sm font-semibold text-slate-900">New area, new plan</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Upload a different plan and measure a new area.
              </p>
            </button>

            {takeoffOption === 'new-area-new-plan' && (
              <div className="ml-4 mb-3 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Area name</label>
                  <input
                    type="text"
                    placeholder="e.g. Extension Roof"
                    value={areaName}
                    onChange={e => setAreaName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Plan / image</label>
                  {newPlanFile ? (
                    <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200">
                      <span className="text-xs text-slate-700 flex-1 truncate">{newPlanFile.name}</span>
                      <button
                        onClick={() => setNewPlanFile(null)}
                        className="text-xs text-red-500 hover:text-red-700 flex-shrink-0"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center gap-2 w-full px-3 py-2 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-orange-400 transition-colors">
                      <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-xs text-slate-500">Choose plan (PDF or image, max 10 MB)</span>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        className="hidden"
                        onChange={e => {
                          const f = e.target.files?.[0] || null;
                          if (f && f.size > 10485760) {
                            setTakeoffError('File exceeds 10 MB limit.');
                            return;
                          }
                          setNewPlanFile(f);
                          setTakeoffError(null);
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>
            )}

            {takeoffError && (
              <p className="text-xs text-red-600 mb-3">{takeoffError}</p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowTakeoffModal(false)}
                disabled={isStartingTakeoff}
                className="flex-1 py-2.5 text-sm font-medium text-slate-700 border border-slate-300 rounded-full hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleTakeoffConfirm}
                disabled={isStartingTakeoff}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-black rounded-full hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                {isStartingTakeoff ? 'Starting...' : 'Continue'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
