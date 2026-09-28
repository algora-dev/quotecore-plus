'use client';

import { QcJourney, QcJourneyDialog } from '@/app/components/ui/v2/QcJourney';
import { useState, useRef, useEffect } from 'react';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { useQcActionNotice } from '@/app/components/ui/v2/QcActionNotice';
import '@/app/components/ui/v2/qc-drawings.css';
import { useRouter } from 'next/navigation';
import { createFlashing, deleteFlashing } from './actions';
import type { FlashingLibraryRow } from '@/app/lib/types';
import Image from 'next/image';
import { UpgradeModal } from '@/app/components/UpgradeModal';
import { StorageBlockedModal } from '@/app/components/billing/StorageBlockedModal';

interface Props {
  initialFlashings: FlashingLibraryRow[];
  workspaceSlug: string;
  /** Plan cap on lifetime flashings. NULL = unlimited. */
  flashingLimit: number | null;
  /** Lifetime flashing count as of server render. */
  flashingCount: number;
  effectivePlanCode: string;
  /** Whether the company trade is roofing. Controls data-copilot attribute
   *  so the correct guide (roofing vs generic) can target this button. */
  isRoofing?: boolean;
  /** Trade-aware plural label: 'Flashings' / 'Drawings & Images'. */
  featureLabel?: string;
  /** Trade-aware singular label: 'Flashing' / 'Drawing/Image'. */
  featureLabelSingular?: string;
  /** When true the company is over storage - block image uploads. */
  isOverStorage?: boolean;
}

/**
 * Trigger a browser download for a flashing image. We fetch the image so the
 * file lands with the user's chosen filename (anchor download attribute is
 * cross-origin-friendly only when the response is same-origin or CORS-enabled,
 * which Supabase Storage signed URLs are).
 */
async function downloadFlashing(flashing: FlashingLibraryRow) {
  try {
    const res = await fetch(flashing.image_url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const ext = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
    const safeName = flashing.name.replace(/[^a-z0-9_-]+/gi, '_').slice(0, 64) || 'flashing';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err: any) {
    console.error('Download failed:', err);
    throw new Error('The image could not be downloaded. Please try again.');
  }
}

/**
 * Open a print-only window with just the flashing image. Using a fresh window
 * avoids dragging app chrome into the printed page; `window.print()` is fired
 * after the image has loaded so the browser has the correct intrinsic size.
 */
function printFlashing(flashing: FlashingLibraryRow, onError: (message: string) => void) {
  // Keep a same-origin handle for the print preview, then sever the opener before
  // adding content. Passing noopener to window.open can return null even on success.
  const preview = window.open('', '_blank', 'width=900,height=700');
  if (!preview) {
    onError('The print window was blocked. Allow pop-ups, then try Print again.');
    return;
  }
  preview.opener = null;
  preview.document.title = flashing.name;
  const style = preview.document.createElement('style');
  style.textContent = `body{margin:0;padding:24px;font-family:system-ui,sans-serif;color:#0f172a}
    h1{font-size:18px;margin:0 0 4px}p{margin:0 0 16px;color:#475569;font-size:13px}
    img{display:block;max-width:100%;max-height:80vh;margin:0 auto}
    @media print{p,h1{color:#000}}`;
  preview.document.head.appendChild(style);
  const heading = preview.document.createElement('h1');
  heading.textContent = flashing.name;
  preview.document.body.appendChild(heading);
  if (flashing.description) {
    const description = preview.document.createElement('p');
    description.textContent = flashing.description;
    preview.document.body.appendChild(description);
  }
  const image = preview.document.createElement('img');
  image.alt = flashing.name;
  image.onload = () => { if (!preview.closed) { preview.focus(); preview.print(); } };
  image.onerror = () => {
    onError('The image could not load in the print window. Close it and try again.');
    image.alt = 'Image unavailable. Close this window and try again.';
  };
  image.src = flashing.image_url;
  preview.document.body.appendChild(image);
}

/**
 * Drag-and-drop upload zone for the flashing/drawing image upload form.
 * Matches the FileUploader pattern used elsewhere in the app.
 */
function FlashingDropZone({
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  onClick,
  fileName,
  saving,
  featureSingularLower,
  error,
}: {
  isDragging: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onClick: () => void;
  fileName: string | null;
  saving: boolean;
  featureSingularLower: string;
  error: string | null;
}) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={() => { if (!saving) onClick(); }}
      role="button" tabIndex={0} aria-label={`Choose ${featureSingularLower} image`}
      aria-busy={saving} aria-disabled={saving}
      onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.currentTarget.click(); } }}
      className={`
        qc-flow-dropzone relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition
        ${isDragging ? 'border-orange-500 bg-orange-50' : 'border-slate-300 hover:border-slate-400 bg-white'}
        ${saving ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      <div className="space-y-2">
        {saving ? (
          <>
            <div className="inline-block w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-600">Uploading...</p>
          </>
        ) : fileName ? (
          <>
            <svg className="mx-auto w-10 h-10 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-sm font-medium text-slate-700">{fileName}</p>
            <p className="text-xs text-slate-500">Click to change file</p>
          </>
        ) : (
          <>
            <svg className="mx-auto w-12 h-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <div>
              <p className="text-sm font-medium text-slate-700">Click to browse or drag and drop</p>
              <p className="text-xs text-slate-500 mt-1">PNG, JPG or WebP · up to 10 MB · {featureSingularLower} image</p>
            </div>
          </>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700 mt-2 text-center">{error}</p>
      )}
    </div>
  );
}

export function FlashingList({ initialFlashings, workspaceSlug, flashingLimit, flashingCount, isRoofing = true, featureLabel = 'Flashings', featureLabelSingular = 'Flashing', effectivePlanCode, isOverStorage }: Props) {
  // Lowercased forms for inline copy.
  const featureLower = featureLabel.toLowerCase();
  const featureSingularLower = featureLabelSingular.toLowerCase();
  const router = useRouter();
  const [flashings, setFlashings] = useState(initialFlashings);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [viewingFlashing, setViewingFlashing] = useState<FlashingLibraryRow | null>(null);
  const [deleteFlashingId, setDeleteFlashingId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const downloadBusy = useRef(false);
  const { notice, showNotice } = useQcActionNotice();
  // Reconcile an explicit server refresh; do not poll or remount active editors.
  useEffect(() => setFlashings(initialFlashings), [initialFlashings]);

  async function handleDownload(flashing: FlashingLibraryRow) {
    if (downloadBusy.current) return;
    downloadBusy.current = true;
    setDownloadingId(flashing.id);
    setOperationError(null);
    try {
      await downloadFlashing(flashing);
      showNotice({ tone: 'success', title: 'Download started', description: `Your browser is downloading ${flashing.name}.` });
    } catch {
      reportOperationError('The image could not be downloaded. Please try again.');
    } finally {
      downloadBusy.current = false;
      setDownloadingId(null);
    }
  }

  function reportOperationError(message: string) {
    setOperationError(message);
    showNotice({ tone: 'danger', title: 'Image unavailable', description: message });
  }

  function handlePrint(flashing: FlashingLibraryRow) {
    setOperationError(null);
    try { printFlashing(flashing, reportOperationError); }
    catch { reportOperationError('The print preview could not open. Please try again.'); }
  }
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [storageBlocked, setStorageBlocked] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live cap: prefer the local count once we've started mutating the list,
  // but never undershoot the server-side count (defends against concurrent
  // edits in another tab).
  const effectiveCount = Math.max(flashingCount, flashings.length);
  const atCap = flashingLimit !== null && effectiveCount >= flashingLimit;

  // Max file size: 10MB (matches FileUploader default for images).
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

  function validateUploadFile(file: File): string | null {
    if (file.size > MAX_FILE_SIZE) {
      const maxMB = (MAX_FILE_SIZE / 1024 / 1024).toFixed(0);
      return `File too large. Max size: ${maxMB} MB`;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Invalid file type. Allowed: PNG, JPG, WebP';
    }
    return null;
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setUploadError(null);
    try {
      const fd = new FormData(e.currentTarget);
      const imageFile = fd.get('image') as File;

      if (!imageFile || imageFile.size === 0) {
        setUploadError('Please select an image file');
        setSaving(false);
        return;
      }

      const validationError = validateUploadFile(imageFile);
      if (validationError) {
        setUploadError(validationError);
        setSaving(false);
        return;
      }

      // Pass entire FormData to server action (includes name, description, image)
      const result = await createFlashing(fd);
      if (!result.ok) {
        if (result.code === 'flashing_limit_reached' || result.code === 'feature_gated') {
          setShowUploadForm(false);
          setUpgradeOpen(true);
        } else {
          setUploadError(result.code === 'internal_error' ? result.message : `Could not upload this ${featureSingularLower}. Please try again.`);
        }
        return;
      }

      setFlashings(current => [...current, result.data]);
      showNotice({ tone: 'success', title: 'Image added', description: `${result.data.name} is now in your library.`, focus: true });
      setShowUploadForm(false);
      setUploadFileName(null);
      setUploadError(null);
      // Form will be unmounted when upload form closes, no need to reset
    } catch (err: any) {
      console.error('Failed to create flashing:', err);
      setUploadError(`The upload could not be completed. Check your connection and try again.`);
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeleteFlashing() {
    if (!deleteFlashingId || deleteLoading) return;
    setDeleteError(null);
    setDeleteLoading(true);
    try {
      await deleteFlashing(deleteFlashingId);
      setFlashings(current => current.filter((f) => f.id !== deleteFlashingId));
      showNotice({ tone: 'success', title: 'Removed from library', description: `The ${featureSingularLower} has been deleted.`, focus: true });
      setDeleteFlashingId(null);
    } catch (err: any) {
      setDeleteError(`The ${featureSingularLower} could not be deleted. Please try again.`);
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <QcJourney><div className="qc-drawing-library">
      {notice}
      <div className="qc-drawing-library-heading">
        <div><h2 className="text-lg font-semibold">Your library</h2>
          <p className="text-sm text-slate-500">{flashings.length} {flashings.length === 1 ? featureSingularLower : featureLower}</p>
          {flashingLimit !== null && <p className="text-xs text-slate-500">{effectiveCount}/{flashingLimit} used</p>}
        </div>
        <div className="qc-drawing-actions">
          <QcButton variant="primary"
            onClick={() => { if (atCap) { setUpgradeOpen(true); return; } router.push(`/${workspaceSlug}/drawings/draw`); }}
            data-copilot={isRoofing ? 'draw-flashing' : 'create-drawing'}
            title={atCap ? `Upgrade to create more ${featureLower}` : `Create a new ${featureSingularLower}`}>
            Create drawing
          </QcButton>
          <QcButton variant="secondary" onClick={() => {
            if (atCap) { setUpgradeOpen(true); return; }
            if (isOverStorage) { setStorageBlocked(true); return; }
            setShowUploadForm(true);
          }}>Upload image</QcButton>
        </div>
      </div>

      {showUploadForm && <section className="qc-drawing-card" aria-labelledby="drawing-upload-heading">
        <h3 id="drawing-upload-heading" className="text-lg font-semibold mb-3">Upload {featureLabelSingular}</h3>
        <form onSubmit={handleCreate} className="space-y-3" aria-busy={saving}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="qc-flow-label" htmlFor="drawing-upload-name">Name *</label>
              <input id="drawing-upload-name" name="name" required disabled={saving}
                placeholder={isRoofing ? 'e.g., Ridge Flashing' : 'e.g., Site Plan'} className="qc-input w-full" /></div>
            <div><label className="qc-flow-label" htmlFor="drawing-upload-description">Description</label>
              <input id="drawing-upload-description" name="description" disabled={saving}
                placeholder="Optional description" className="qc-input w-full" /></div>
          </div>
          <FlashingDropZone isDragging={isDragging}
            onDragOver={e => { e.preventDefault(); if (!saving) setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={e => {
              e.preventDefault(); setIsDragging(false); if (saving) return;
              const file = e.dataTransfer.files[0];
              if (file) {
                const err = validateUploadFile(file);
                if (err) { setUploadError(err); return; }
                setUploadError(null);
                const dt = new DataTransfer(); dt.items.add(file);
                if (fileInputRef.current) { fileInputRef.current.files = dt.files; setUploadFileName(file.name); }
              }
            }} onClick={() => fileInputRef.current?.click()} fileName={uploadFileName}
            saving={saving} featureSingularLower={featureSingularLower} error={uploadError} />
          <input ref={fileInputRef} type="file" name="image" accept="image/png,image/jpeg,image/webp"
            disabled={saving} className="hidden" aria-label="Image file"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) {
                const err = validateUploadFile(file);
                if (err) { setUploadError(err); return; }
                setUploadError(null); setUploadFileName(file.name);
              }
            }} />
          <div className="qc-drawing-actions">
            <QcButton variant="primary" type="submit" pending={saving}>{saving ? 'Uploading...' : 'Upload'}</QcButton>
            <QcButton disabled={saving} onClick={() => { setShowUploadForm(false); setUploadFileName(null); setUploadError(null); }}>Cancel</QcButton>
          </div>
        </form>
      </section>}

      {flashings.length === 0 ? <div className="qc-drawing-card text-center py-12">
        <h3 className="font-semibold">No {featureLower} yet</h3>
        <p className="text-sm text-slate-500 mt-2">Create a drawing or upload an image to reuse in your material orders.</p>
      </div> : <div className="qc-drawing-library-grid">
        {flashings.map(flashing => <article key={flashing.id} className="qc-drawing-library-card">
          <button type="button" className="qc-drawing-card-open" onClick={() => { setOperationError(null); setViewingFlashing(flashing); }}
            aria-label={`View ${flashing.name}`}>
            <div className="qc-drawing-thumbnail"><Image src={flashing.image_url} alt="" width={200} height={200} className="object-contain" /></div>
            <strong>{flashing.name}</strong>{flashing.description && <span>{flashing.description}</span>}
          </button>
          <div className="qc-drawing-card-actions">
            <QcButton size="sm" disabled={downloadingId !== null} aria-label={`Download ${flashing.name}`} onClick={() => void handleDownload(flashing)}>
              {downloadingId === flashing.id ? 'Downloading...' : 'Download'}</QcButton>
            <QcButton size="sm" aria-label={`Print ${flashing.name}`} onClick={() => handlePrint(flashing)}>Print</QcButton>
            <QcButton size="sm" variant="danger" aria-label={`Delete ${flashing.name}`} onClick={() => { setDeleteError(null); setDeleteFlashingId(flashing.id); }}>Delete</QcButton>
          </div>
        </article>)}
      </div>}

      {deleteFlashingId && <QcJourneyDialog label={`Delete ${featureLabelSingular}`} size="sm" pending={deleteLoading}>
        <div className="p-5">
          <h3 className="text-lg font-semibold">Delete {featureLabelSingular}?</h3>
          <p className="text-sm text-slate-600 mt-2">This action cannot be undone. The {featureSingularLower} will be permanently deleted.</p>
          {deleteError && <p role="alert" className="text-sm text-red-700 mt-3">{deleteError}</p>}
          <div className="qc-drawing-actions mt-5">
            <QcButton disabled={deleteLoading} onClick={() => setDeleteFlashingId(null)}>Cancel</QcButton>
            <QcButton variant="danger" pending={deleteLoading} onClick={confirmDeleteFlashing}>{deleteLoading ? 'Deleting...' : 'Delete'}</QcButton>
          </div>
        </div>
      </QcJourneyDialog>}

      <StorageBlockedModal open={storageBlocked} onClose={() => setStorageBlocked(false)} />
      <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)}
        title={`${featureLabelSingular} library full on the ${effectivePlanCode} plan`}
        description={`You've reached your ${flashingLimit ?? 0} ${featureSingularLower} limit. Upgrade your plan to add more ${featureSingularLower} designs to your library.`}
        recommendedPlan="pro" />

      {viewingFlashing && <QcJourneyDialog label={`View ${viewingFlashing.name}`} size="lg">
        <div className="qc-drawing-viewer">
          <div className="qc-drawing-library-heading">
            <div className="min-w-0"><h3 className="text-lg font-semibold break-words">{viewingFlashing.name}</h3>
              {viewingFlashing.description && <p className="text-sm text-slate-500 break-words">{viewingFlashing.description}</p>}</div>
            <QcButton onClick={() => setViewingFlashing(null)}>Close</QcButton>
          </div>
          {operationError && <p role="alert" className="text-sm text-red-700 mb-3">{operationError}</p>}
          <div className="qc-drawing-viewer-image"><Image src={viewingFlashing.image_url} alt={viewingFlashing.name}
            width={800} height={800} className="object-contain" /></div>
          <div className="qc-drawing-actions mt-4">
            <QcButton disabled={downloadingId !== null} onClick={() => void handleDownload(viewingFlashing)}>
              {downloadingId ? 'Downloading...' : 'Download image'}</QcButton>
            <QcButton onClick={() => handlePrint(viewingFlashing)}>Print image</QcButton>
          </div>
        </div>
      </QcJourneyDialog>}
    </div></QcJourney>
  );
}
