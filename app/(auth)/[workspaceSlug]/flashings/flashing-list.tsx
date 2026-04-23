'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createFlashing, updateFlashing, deleteFlashing } from './actions';
import type { FlashingLibraryRow } from '@/app/lib/types';
import Image from 'next/image';

interface Props {
  initialFlashings: FlashingLibraryRow[];
  workspaceSlug: string;
}

export function FlashingList({ initialFlashings, workspaceSlug }: Props) {
  const router = useRouter();
  const [flashings, setFlashings] = useState(initialFlashings);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [viewingFlashing, setViewingFlashing] = useState<FlashingLibraryRow | null>(null);
  const [deleteFlashingId, setDeleteFlashingId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

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
      const newFlashing = await createFlashing(fd);

      setFlashings([...flashings, newFlashing]);
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
          {flashings.length} {flashings.length === 1 ? 'flashing' : 'flashings'} in library
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => router.push(`/${workspaceSlug}/flashings/draw`)}
            className="px-4 py-2 text-sm font-medium rounded-full bg-[#FF6B35] text-white hover:bg-[#ff5722] transition-all shadow-sm hover:shadow-md"
          >
            Draw Flashing
          </button>
          <button
            onClick={() => setShowUploadForm(true)}
            className="px-4 py-2 text-sm font-medium rounded-full bg-black text-white hover:bg-slate-800 transition-all shadow-sm hover:shadow-md"
          >
            Upload Image
          </button>
        </div>
      </div>

      {showUploadForm && (
        <div className="mb-6 p-4 border border-slate-200 rounded-xl bg-white">
          <h3 className="font-semibold text-slate-900 mb-3">Upload New Flashing</h3>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Name *</label>
                <input
                  name="name"
                  required
                  placeholder="e.g., Ridge Flashing"
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
                Upload a PNG or JPG image of the flashing design
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
          <p className="text-slate-500 mb-2">No flashings in your library yet</p>
          <p className="text-xs text-slate-400">
            Upload standard flashing designs to use in material order forms
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
              <button
                onClick={(e) => { e.stopPropagation(); setDeleteFlashingId(flashing.id); }}
                title="Click to delete"
                className="absolute top-2 right-2 p-1.5 rounded-full text-slate-300 hover:text-red-500 hover:bg-red-50 transition opacity-0 group-hover:opacity-100"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Delete Modal */}
      {deleteFlashingId && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Delete Flashing</h3>
            <p className="text-sm text-slate-500 mt-2">This action cannot be undone. The flashing will be permanently deleted.</p>
            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => setDeleteFlashingId(null)} className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50" disabled={deleteLoading}>Cancel</button>
              <button onClick={confirmDeleteFlashing} className="px-4 py-2 text-sm font-medium rounded-full bg-red-600 text-white hover:bg-red-700 disabled:opacity-50" disabled={deleteLoading}>{deleteLoading ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}

      {/* View Flashing Modal */}
      {viewingFlashing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setViewingFlashing(null)}>
          <div className="bg-white rounded-xl p-6 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{viewingFlashing.name}</h3>
                {viewingFlashing.description && (
                  <p className="text-sm text-slate-500 mt-0.5">{viewingFlashing.description}</p>
                )}
              </div>
              <button onClick={() => setViewingFlashing(null)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
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
