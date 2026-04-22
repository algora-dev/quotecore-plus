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

  async function handleDelete(id: string) {
    if (!confirm('Delete this flashing? This cannot be undone.')) return;
    
    try {
      await deleteFlashing(id);
      setFlashings(flashings.filter((f) => f.id !== id));
    } catch (err: any) {
      console.error('Failed to delete flashing:', err);
      alert(`Error: ${err.message}`);
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
              className="border border-slate-200 rounded-xl bg-white p-3 hover:border-slate-300 transition-colors"
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
              <div className="mb-2">
                <h3 className="font-medium text-sm text-slate-900">{flashing.name}</h3>
                {flashing.description && (
                  <p className="text-xs text-slate-500 mt-0.5">{flashing.description}</p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setViewingFlashing(flashing)}
                  className="flex-1 px-2 py-1 text-xs text-slate-700 border border-slate-300 rounded-full hover:bg-slate-50 transition-all"
                >
                  View
                </button>
                <button
                  onClick={() => handleDelete(flashing.id)}
                  className="flex-1 px-2 py-1 text-xs text-red-600 border border-red-200 rounded-full hover:bg-red-50 transition-all"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
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
