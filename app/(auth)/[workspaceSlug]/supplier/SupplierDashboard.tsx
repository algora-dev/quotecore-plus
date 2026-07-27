'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  updateSupplierProfile,
  type SupplierProfileData,
  type SupplierLibraryData,
} from './actions';
import { CatalogueConverter } from './CatalogueConverter';
import { getUserCollections, type UserCollection } from '../supplier-directory/actions';
import { PublishLibraryModal } from '../components/components/PublishLibraryModal';
import { renameComponentCollection, deleteComponentCollection } from '../components/actions';

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  suspended: 'bg-orange-100 text-orange-700 border-orange-200',
  revoked: 'bg-red-100 text-red-700 border-red-200',
};

const VISIBILITY_STYLES: Record<string, string> = {
  private: 'bg-slate-100 text-slate-600 border-slate-200',
  unlisted: 'bg-blue-100 text-blue-700 border-blue-200',
  published: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const ROOFING_TYPES = ['All Roofing', 'Metal Roofing', 'Tile Roofing', 'Flat Roofing', 'Shingle Roofing', 'Membrane', 'EPDM/TPO', 'Slate'];

export function SupplierDashboard({
  workspaceSlug,
  profile,
  libraries,
  collections,
}: {
  workspaceSlug: string;
  profile: SupplierProfileData | null;
  libraries: SupplierLibraryData[];
  collections: UserCollection[];
}) {
  const [editingProfile, setEditingProfile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [publishResult, setPublishResult] = useState<Record<string, { ok: boolean; message: string }>>({});

  // Publish modal state
  const [showPublishModal, setShowPublishModal] = useState<string | null>(null);

  // Rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Local libraries state (so we can update after rename/delete/publish without reload)
  const [localLibraries, setLocalLibraries] = useState(libraries);

  // Editable profile fields
  const [websiteUrl, setWebsiteUrl] = useState(profile?.website_url ?? '');
  const [contactEmail, setContactEmail] = useState(profile?.contact_email ?? '');
  const [phoneNumber, setPhoneNumber] = useState(profile?.phone_number ?? '');
  const [description, setDescription] = useState(profile?.description ?? '');
  const [serviceAreas, setServiceAreas] = useState(profile?.service_areas?.join(', ') ?? '');
  const [roofingTypes, setRoofingTypes] = useState(profile?.roofing_types ?? []);

  async function handleSaveProfile() {
    setSaving(true);
    setError(null);
    try {
      const result = await updateSupplierProfile({
        website_url: websiteUrl.trim() || null,
        contact_email: contactEmail.trim() || null,
        phone_number: phoneNumber.trim() || null,
        description: description.trim() || null,
        service_areas: serviceAreas.split(',').map(s => s.trim()).filter(Boolean),
        roofing_types: roofingTypes,
      });
      if (!result.ok) {
        setError(result.message);
      } else {
        setEditingProfile(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handlePublishUpdate(libraryId: string) {
    setPublishing(libraryId);
    try {
      const res = await fetch('/api/supplier-publish-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ libraryId }),
      });
      const data = await res.json();
      setPublishResult(prev => ({
        ...prev,
        [libraryId]: {
          ok: data.ok,
          message: data.ok
            ? `Published v${data.newVersion} (${data.changesRecorded} change${data.changesRecorded !== 1 ? 's' : ''})`
            : data.message || 'Failed',
        },
      }));
    } catch {
      setPublishResult(prev => ({
        ...prev,
        [libraryId]: { ok: false, message: 'Network error' },
      }));
    }
    setPublishing(null);
  }

  async function handleRename(id: string) {
    if (!renameValue.trim()) return;
    setRenaming(true);
    try {
      const result = await renameComponentCollection(id, renameValue);
      if (!result.ok) {
        alert(result.message);
        return;
      }
      setLocalLibraries(prev => prev.map(l => l.id === id ? { ...l, name: result.name } : l));
      setRenamingId(null);
      setRenameValue('');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to rename');
    } finally {
      setRenaming(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleteLoading(true);
    try {
      const result = await deleteComponentCollection(id);
      if (!result.ok) {
        alert(result.message);
        return;
      }
      setLocalLibraries(prev => prev.filter(l => l.id !== id));
      setDeletingId(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setDeleteLoading(false);
    }
  }

  const publishedCount = localLibraries.filter(l => l.visibility === 'published').length;
  const totalComponents = localLibraries.reduce((sum, l) => sum + l.component_count, 0);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Supplier Dashboard</h1>
            <p className="text-sm text-slate-400 mt-0.5">Manage your supplier profile and published libraries</p>
          </div>
          <Link
            href={`/${workspaceSlug}/components`}
            className="text-xs font-medium text-slate-500 hover:text-slate-700 rounded-full border border-slate-300 px-3 py-1.5"
          >
            Components
          </Link>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Profile Card */}
        {profile ? (
          <div className="rounded-xl border border-slate-200 bg-white p-5 mb-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-slate-900">{profile.supplier_name}</h2>
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[profile.status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                    {profile.status}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">Slug: {profile.slug}</p>
              </div>
              {!editingProfile && (
                <button
                  onClick={() => setEditingProfile(true)}
                  className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700 rounded-full px-3 py-1 hover:bg-slate-100"
                >
                  Edit Profile
                </button>
              )}
            </div>

            {editingProfile ? (
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div>
                  <label className="text-xs font-medium text-slate-600">Website URL</label>
                  <input
                    type="text"
                    value={websiteUrl}
                    onChange={e => setWebsiteUrl(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none"
                    placeholder="https://..."
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600">Contact Email (public)</label>
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={e => setContactEmail(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none"
                      placeholder="sales@yourcompany.com"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">Phone Number</label>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={e => setPhoneNumber(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none"
                      placeholder="+64 21 123 4567"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Description</label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none"
                    placeholder="Tell customers about your products..."
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Service Areas (comma-separated)</label>
                  <input
                    type="text"
                    value={serviceAreas}
                    onChange={e => setServiceAreas(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none"
                    placeholder="UK, US, Australia"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Roofing Types</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {ROOFING_TYPES.map(rt => {
                      const selected = roofingTypes.includes(rt);
                      return (
                        <button
                          key={rt}
                          type="button"
                          onClick={() => setRoofingTypes(selected ? roofingTypes.filter(x => x !== rt) : [...roofingTypes, rt])}
                          className={`cursor-pointer rounded-full border px-3 py-1 text-xs transition ${selected ? 'bg-slate-900 border-slate-900 text-white' : 'border-slate-300 text-slate-600 hover:border-slate-400'}`}
                        >
                          {rt}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="cursor-pointer px-4 py-2 text-sm font-semibold rounded-full bg-black text-white hover:bg-slate-800 transition disabled:opacity-40"
                  >
                    {saving ? 'Saving...' : 'Save Profile'}
                  </button>
                  <button
                    onClick={() => setEditingProfile(false)}
                    className="cursor-pointer px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2 pt-3 border-t border-slate-100">
                {profile.website_url && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400 w-20">Website</span>
                    <a href={profile.website_url} target="_blank" rel="noopener noreferrer" className="text-[#2563EB] hover:underline">{profile.website_url}</a>
                  </div>
                )}
                {profile.contact_email && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400 w-20">Contact</span>
                    <span className="text-slate-600">{profile.contact_email}</span>
                  </div>
                )}
                {profile.phone_number && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400 w-20">Phone</span>
                    <span className="text-slate-600">{profile.phone_number}</span>
                  </div>
                )}
                {profile.description && (
                  <div className="flex items-start gap-2 text-xs">
                    <span className="text-slate-400 w-20">Description</span>
                    <span className="text-slate-600">{profile.description}</span>
                  </div>
                )}
                {profile.service_areas && profile.service_areas.length > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400 w-20">Areas</span>
                    <div className="flex flex-wrap gap-1">
                      {profile.service_areas.map(sa => (
                        <span key={sa} className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-600">{sa}</span>
                      ))}
                    </div>
                  </div>
                )}
                {profile.roofing_types && profile.roofing_types.length > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400 w-20">Types</span>
                    <div className="flex flex-wrap gap-1">
                      {profile.roofing_types.map(rt => (
                        <span key={rt} className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{rt}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center mb-6">
            <p className="text-sm text-slate-400">No supplier profile found. Contact admin to set up your supplier account.</p>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-2xl font-semibold text-slate-900">{libraries.length}</div>
            <div className="text-xs text-slate-400 mt-0.5">Total Libraries</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-2xl font-semibold text-emerald-600">{publishedCount}</div>
            <div className="text-xs text-slate-400 mt-0.5">Published</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-2xl font-semibold text-slate-900">{totalComponents}</div>
            <div className="text-xs text-slate-400 mt-0.5">Components</div>
          </div>
        </div>

        {/* Catalogue Converter */}
        {profile?.status === 'approved' && (
          <CatalogueConverter workspaceSlug={workspaceSlug} collections={collections} />
        )}

        {/* Libraries */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Libraries</h3>
            <Link
              href={`/${workspaceSlug}/components`}
              className="text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8]"
            >
              Manage in Components →
            </Link>
          </div>
          {localLibraries.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
              <p className="text-sm text-slate-400">No libraries yet.</p>
              <Link href={`/${workspaceSlug}/components`} className="mt-2 inline-block text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8]">
                Go to Components to create one
              </Link>
            </div>
          ) : (
            localLibraries.map(lib => (
              <div key={lib.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    {renamingId === lib.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); void handleRename(lib.id); }
                            if (e.key === 'Escape') { setRenamingId(null); setRenameValue(''); }
                          }}
                          maxLength={80}
                          className="px-2 py-1 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => void handleRename(lib.id)}
                          disabled={renaming || !renameValue.trim()}
                          className="px-3 py-1 text-xs font-medium rounded-full bg-black text-white hover:bg-slate-800 disabled:opacity-50"
                        >
                          {renaming ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setRenamingId(null); setRenameValue(''); }}
                          className="px-3 py-1 text-xs rounded-full border border-slate-300 hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-900">{lib.name}</span>
                        {lib.is_bootstrap && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Default</span>
                        )}
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${VISIBILITY_STYLES[lib.visibility ?? 'private'] || VISIBILITY_STYLES.private}`}>
                          {lib.visibility ?? 'private'}
                        </span>
                      </div>
                    )}
                    {lib.public_title && lib.visibility !== 'private' && (
                      <p className="text-xs text-slate-500 mt-1">Public title: {lib.public_title}</p>
                    )}
                    {lib.public_description && lib.visibility !== 'private' && (
                      <p className="text-xs text-slate-400 mt-0.5">{lib.public_description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
                      <span>{lib.component_count} component{lib.component_count !== 1 ? 's' : ''}</span>
                      {lib.published_at && (
                        <span>Published: {new Date(lib.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      )}
                    </div>
                    {lib.roofing_types && lib.roofing_types.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {lib.roofing_types.map(rt => (
                          <span key={rt} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{rt}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-col gap-1.5 items-end shrink-0">
                    {/* Publish / Settings button */}
                    <button
                      type="button"
                      onClick={() => setShowPublishModal(lib.id)}
                      className="text-xs px-3 py-1.5 rounded-full border border-slate-300 hover:bg-slate-50 hover:border-orange-300 text-slate-600 transition font-medium"
                    >
                      {(lib.visibility ?? 'private') === 'private' ? 'Publish' : 'Settings'}
                    </button>

                    {/* Rename button */}
                    {renamingId !== lib.id && !lib.is_bootstrap && (
                      <button
                        type="button"
                        title="Rename"
                        onClick={() => { setRenamingId(lib.id); setRenameValue(lib.name); }}
                        className="text-xs text-slate-400 hover:text-orange-500 transition"
                      >
                        Rename
                      </button>
                    )}

                    {/* Delete button */}
                    {!lib.is_bootstrap && deletingId !== lib.id && (
                      <button
                        type="button"
                        title="Delete"
                        onClick={() => setDeletingId(lib.id)}
                        className="text-xs text-slate-400 hover:text-red-500 transition"
                      >
                        Delete
                      </button>
                    )}

                    {/* Delete confirmation */}
                    {deletingId === lib.id && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => void handleDelete(lib.id)}
                          disabled={deleteLoading}
                          className="text-xs px-2 py-1 rounded-full bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          {deleteLoading ? 'Deleting...' : 'Confirm'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingId(null)}
                          className="text-xs px-2 py-1 rounded-full border border-slate-300 hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                      </div>
                    )}

                    {/* Publish update button for already-published libraries */}
                    {lib.visibility === 'published' && (
                      <button
                        onClick={() => handlePublishUpdate(lib.id)}
                        disabled={publishing === lib.id}
                        className="text-xs px-3 py-1 rounded-full bg-[#FF6B35] text-white hover:bg-[#e55a2b] transition disabled:opacity-50 font-medium"
                      >
                        {publishing === lib.id ? 'Publishing...' : 'Push Update'}
                      </button>
                    )}

                    {publishResult[lib.id] && (
                      <span className={`text-xs ${publishResult[lib.id].ok ? 'text-emerald-600' : 'text-red-600'}`}>
                        {publishResult[lib.id].message}
                      </span>
                    )}
                    {lib.published_version != null && lib.published_version > 0 && lib.visibility === 'published' && (
                      <span className="text-xs text-slate-400">v{lib.published_version}</span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Publish Library Modal */}
        {showPublishModal && (() => {
          const lib = localLibraries.find(l => l.id === showPublishModal);
          if (!lib) return null;
          return (
            <PublishLibraryModal
              collectionId={lib.id}
              collectionName={lib.name}
              currentVisibility={(lib.visibility as 'private' | 'unlisted' | 'published') || 'private'}
              publicTitle={lib.public_title || ''}
              publicDescription={lib.public_description || ''}
              roofingTypes={lib.roofing_types || []}
              onClose={() => setShowPublishModal(null)}
              onSaved={() => {
                // Refresh local state optimistically
                setShowPublishModal(null);
                // Force a reload to get fresh data
                window.location.reload();
              }}
            />
          );
        })()}
      </div>
    </div>
  );
}
