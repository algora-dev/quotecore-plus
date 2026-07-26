'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  updateSupplierProfile,
  type SupplierProfileData,
  type SupplierLibraryData,
} from './actions';

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

const ROOFING_TYPES = ['All Roofing', 'Metal Roofing', 'Tile Roofing', 'Flat Roofing', 'Shingle Roofing', 'EPDM/TPO'];

export function SupplierDashboard({
  workspaceSlug,
  profile,
  libraries,
}: {
  workspaceSlug: string;
  profile: SupplierProfileData | null;
  libraries: SupplierLibraryData[];
}) {
  const [editingProfile, setEditingProfile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editable profile fields
  const [websiteUrl, setWebsiteUrl] = useState(profile?.website_url ?? '');
  const [description, setDescription] = useState(profile?.description ?? '');
  const [serviceAreas, setServiceAreas] = useState(profile?.service_areas?.join(', ') ?? '');
  const [roofingTypes, setRoofingTypes] = useState(profile?.roofing_types ?? []);

  async function handleSaveProfile() {
    setSaving(true);
    setError(null);
    try {
      const result = await updateSupplierProfile({
        website_url: websiteUrl.trim() || null,
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

  const publishedCount = libraries.filter(l => l.visibility === 'published').length;
  const totalComponents = libraries.reduce((sum, l) => sum + l.component_count, 0);

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

        {/* Libraries */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Libraries</h3>
          {libraries.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
              <p className="text-sm text-slate-400">No libraries yet.</p>
              <Link href={`/${workspaceSlug}/components`} className="mt-2 inline-block text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8]">
                Go to Components to create one
              </Link>
            </div>
          ) : (
            libraries.map(lib => (
              <div key={lib.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-900">{lib.name}</span>
                      {lib.is_bootstrap && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Default</span>
                      )}
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${VISIBILITY_STYLES[lib.visibility ?? 'private'] || VISIBILITY_STYLES.private}`}>
                        {lib.visibility ?? 'private'}
                      </span>
                    </div>
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
                  <Link
                    href={`/${workspaceSlug}/components`}
                    className="shrink-0 text-xs font-medium text-slate-500 hover:text-slate-700 rounded-full border border-slate-300 px-3 py-1.5 hover:bg-slate-50"
                  >
                    Manage
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
