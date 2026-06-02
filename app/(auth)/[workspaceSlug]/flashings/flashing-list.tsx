'use client';

import { useState } from 'react';
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
  /** When true the company is over storage — block image uploads. */
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
    alert(`Could not download flashing: ${err.message || 'unknown error'}`);
  }
}

/**
 * Open a print-only window with just the flashing image. Using a fresh window
 * avoids dragging app chrome into the printed page; `window.print()` is fired
 * after the image has loaded so the browser has the correct intrinsic size.
 */
function printFlashing(flashing: FlashingLibraryRow) {
  const w = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
  if (!w) {
    alert('Pop-up blocked. Please allow pop-ups for printing.');
    return;
  }
  const safeName = flashing.name.replace(/</g, '&lt;');
  const safeDesc = (flashing.description || '').replace(/</g, '&lt;');
  w.document.write(`<!doctype html>
<html><head><title>${safeName}</title>
<style>
  body { margin: 0; padding: 24px; font-family: system-ui, -apple-system, Segoe UI, sans-serif; color: #0f172a; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  p { margin: 0 0 16px; color: #475569; font-size: 13px; }
  img { display: block; max-width: 100%; max-height: 80vh; margin: 0 auto; }
  @media print { p, h1 { color: #000; } }
</style>
</head><body>
  <h1>${safeName}</h1>
  ${safeDesc ? `<p>${safeDesc}</p>` : ''}
  <img id="img" src="${flashing.image_url}" alt="${safeName}" />
  <script>
    var img = document.getElementById('img');
    function go() { setTimeout(function () { window.focus(); window.print(); }, 100); }
    if (img && !img.complete) { img.onload = go; img.onerror = go; } else { go(); }
  </script>
</body></html>`);
  w.document.close();
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
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [storageBlocked, setStorageBlocked] = useState(false);

  // Live cap: prefer the local count once we've started mutating the list,
  // but never undershoot the server-side count (defends against concurrent
  // edits in another tab).
  const effectiveCount = Math.max(flashingCount, flashings.length);
  const atCap = flashingLimit !== null && effectiveCount >= flashingLimit;

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData(e.currentTarget);
      const imageFile = fd.get('image') as File;

      if (!imageFile || imageFile.size === 0) {
        alert('Please select an image file');
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
          alert(result.code === 'internal_error' ? `Error: ${result.message}` : 'Could not create flashing.');
        }
        return;
      }

      setFlashings([...flashings, result.data]);
      setShowUploadForm(false);
      // Form will be unmounted when upload form closes, no need to reset
    } catch (err: any) {
      console.error('Failed to create flashing:', err);
      alert(`Error creating flashing: ${err.message || 'Unknown error'}\n\nCheck browser console for details.`);
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeleteFlashing() {
    if (!deleteFlashingId) return;
    setDeleteLoading(true);
    try {
      await deleteFlashing(deleteFlashingId);
      setFlashings(flashings.filter((f) => f.id !== deleteFlashingId));
      setDeleteFlashingId(null);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <p className="text-sm text-slate-500">
          {flashings.length} {flashings.length === 1 ? featureSingularLower : featureLower} in library
        </p>
        <div className="flex gap-2 items-center">
          {flashingLimit !== null && (
            <span className="text-xs text-slate-500 mr-1">
              {effectiveCount}/{flashingLimit} used
            </span>
          )}
          <button
            onClick={() => {
              if (atCap) {
                setUpgradeOpen(true);
                return;
              }
              router.push(`/${workspaceSlug}/flashings/draw`);
            }}
            data-copilot={isRoofing ? 'draw-flashing' : 'create-drawing'}
            title={atCap ? `Upgrade to create more ${featureLower}` : `Create a new ${featureSingularLower}`}
            className="px-4 py-2 text-sm font-medium rounded-full bg-[#FF6B35] text-white hover:bg-[#ff5722] transition-all shadow-sm hover:shadow-md"
          >
            Create
          </button>
          <button
            onClick={() => {
              if (atCap) { setUpgradeOpen(true); return; }
              if (isOverStorage) { setStorageBlocked(true); return; }
              setShowUploadForm(true);
            }}
            title={atCap ? `Upgrade to upload more ${featureLower}` : `Upload an existing ${featureSingularLower}`}
            className="px-4 py-2 text-sm font-medium rounded-full bg-black text-white hover:bg-slate-800 transition-all shadow-sm hover:shadow-md"
          >
            Upload
          </button>
        </div>
      </div>

      {showUploadForm && (
        <div className="mb-6 p-4 border border-slate-200 rounded-xl bg-white">
          <h3 className="font-semibold text-slate-900 mb-3">Upload New {featureLabelSingular}</h3>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Name *</label>
                <input
                  name="name"
                  required
                  placeholder={isRoofing ? 'e.g., Ridge Flashing' : 'e.g., Site Plan'}
                  className="w-full px-2 py-1 text-sm border border-slate-300 rounded"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Description</label>
                <input
                  name="description"
                  placeholder="Optional description"
                  className="w-full px-2 py-1 text-sm border border-slate-300 rounded"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Image File *</label>
              <input
                type="file"
                name="image"
                accept="image/*"
                required
                className="w-full px-2 py-1 text-sm border border-slate-300 rounded"
              />
              <p className="text-xs text-slate-400 mt-1">
                Upload a PNG or JPG image of the {featureSingularLower}
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-3 py-1.5 text-sm font-medium rounded-full bg-black text-white hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)] disabled:opacity-50"
              >
                {saving ? 'Uploading...' : 'Upload'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowUploadForm(false);
                }}
                className="px-3 py-1.5 text-sm rounded-full border border-slate-300 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {flashings.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-slate-300 rounded-xl bg-slate-50">
          <p className="text-slate-500 mb-2">No {featureLower} in your library yet</p>
          <p className="text-xs text-slate-400">
            Upload standard {featureSingularLower} designs to use in material order forms
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {flashings.map((flashing) => (
            <div
              key={flashing.id}
              onClick={() => setViewingFlashing(flashing)}
              title="Click to view"
              className="border border-slate-200 rounded-xl bg-white p-3 cursor-pointer hover:bg-orange-50/40 hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] transition group relative"
            >
              <div className="aspect-square bg-slate-100 rounded-lg mb-2 flex items-center justify-center overflow-hidden">
                <Image
                  src={flashing.image_url}
                  alt={flashing.name}
                  width={200}
                  height={200}
                  className="object-contain"
                />
              </div>
              <div>
                <h3 className="font-medium text-sm text-slate-900">{flashing.name}</h3>
                {flashing.description && (
                  <p className="text-xs text-slate-500 mt-0.5">{flashing.description}</p>
                )}
              </div>
              {/* Hover-reveal action row: download, print, delete. Same icon
                  language as the quote summary pages (icon-btn class + matching
                  outline SVGs) so the action vocabulary is consistent. */}
              <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                <button
                  onClick={(e) => { e.stopPropagation(); downloadFlashing(flashing); }}
                  title={`Download ${featureSingularLower} image`}
                  className="icon-btn border-slate-300 bg-white"
                >
                  <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); printFlashing(flashing); }}
                  title={`Print ${featureSingularLower} image`}
                  className="icon-btn border-slate-300 bg-white"
                >
                  <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteFlashingId(flashing.id); }}
                  title={`Delete ${featureSingularLower}`}
                  className="icon-btn icon-btn--danger border-slate-300 bg-white"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Modal */}
      {deleteFlashingId && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Delete {featureLabelSingular}</h3>
            <p className="text-sm text-slate-500 mt-2">This action cannot be undone. The {featureSingularLower} will be permanently deleted.</p>
            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => setDeleteFlashingId(null)} className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50" disabled={deleteLoading}>Cancel</button>
              <button onClick={confirmDeleteFlashing} className="px-4 py-2 text-sm font-medium rounded-full bg-red-600 text-white hover:bg-red-700 disabled:opacity-50" disabled={deleteLoading}>{deleteLoading ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}

      <StorageBlockedModal open={storageBlocked} onClose={() => setStorageBlocked(false)} />
      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        title={`${featureLabelSingular} library full on ${effectivePlanCode === 'trial' ? 'the free trial' : `the ${effectivePlanCode} plan`}`}
        description={`You've reached your ${flashingLimit ?? 0} ${featureSingularLower} limit. Upgrade your plan to add more ${featureSingularLower} designs to your library.`}
        recommendedPlan="pro"
      />

      {/* View Flashing Modal */}
      {viewingFlashing && (

        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setViewingFlashing(null)}>
          <div className="bg-white rounded-xl p-6 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 gap-3">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-slate-900 truncate">{viewingFlashing.name}</h3>
                {viewingFlashing.description && (
                  <p className="text-sm text-slate-500 mt-0.5">{viewingFlashing.description}</p>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => downloadFlashing(viewingFlashing)}
                  title={`Download ${featureSingularLower} image`}
                  className="icon-btn border-slate-300 bg-white"
                >
                  <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </button>
                <button
                  onClick={() => printFlashing(viewingFlashing)}
                  title={`Print ${featureSingularLower} image`}
                  className="icon-btn border-slate-300 bg-white"
                >
                  <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                </button>
                <button onClick={() => setViewingFlashing(null)} title="Close" className="icon-btn border-slate-300 bg-white">
                  <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            <div className="bg-slate-50 rounded-lg p-4 flex items-center justify-center">
              <Image
                src={viewingFlashing.image_url}
                alt={viewingFlashing.name}
                width={800}
                height={800}
                className="object-contain max-h-[70vh]"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
