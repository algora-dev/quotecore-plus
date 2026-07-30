'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  updateSupplierProfile,
  updateCatalogVisibility,
  publishCatalogUpdate,
  type SupplierProfileData,
  type SupplierLibraryData,
  type SupplierCatalogData,
} from './actions';
import { CatalogueConverter } from './CatalogueConverter';
import { getUserCollections, type UserCollection } from '../supplier-directory/actions';
import { PublishLibraryModal } from '../components/components/PublishLibraryModal';
import { CatalogPublishModal } from './CatalogPublishModal';
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

type Tab = 'libraries' | 'catalogues';

export function SupplierDashboard({
  workspaceSlug,
  profile,
  libraries,
  catalogs,
  collections,
}: {
  workspaceSlug: string;
  profile: SupplierProfileData | null;
  libraries: SupplierLibraryData[];
  catalogs: SupplierCatalogData[];
  collections: UserCollection[];
}) {
  const [activeTab, setActiveTab] = useState<Tab>('libraries');
  const [editingProfile, setEditingProfile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [publishResult, setPublishResult] = useState<Record<string, { ok: boolean; message: string }>>({});

  const [showPublishModal, setShowPublishModal] = useState<string | null>(null);
  const [showCatalogPublishModal, setShowCatalogPublishModal] = useState<string | null>(null);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [localLibraries, setLocalLibraries] = useState(libraries);
  const [localCatalogs, setLocalCatalogs] = useState(catalogs);

  const [websiteUrl, setWebsiteUrl] = useState(profile?.website_url ?? '');
  const [contactEmail, setContactEmail] = useState(profile?.contact_email ?? '');
  const [phoneNumber, setPhoneNumber] = useState(profile?.phone_number ?? '');
  const [description, setDescription] = useState(profile?.description ?? '');
  const [serviceAreas, setServiceAreas] = useState(profile?.service_areas?.join(', ') ?? '');
  const [roofingTypes, setRoofingTypes] = useState(profile?.roofing_types ?? []);
  const [allowCustomPricing, setAllowCustomPricing] = useState(profile?.allow_custom_pricing ?? false);

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
        allow_custom_pricing: allowCustomPricing,
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

  async function handleCatalogPublish(catalogId: string) {
    setPublishing(catalogId);
    try {
      const result = await publishCatalogUpdate(catalogId);
      if (result.ok) {
        setLocalCatalogs(prev => prev.map(c =>
          c.id === catalogId
            ? { ...c, published_version: result.newVersion, published_at: new Date().toISOString() }
            : c
        ));
        setPublishResult(prev => ({
          ...prev,
          [catalogId]: { ok: true, message: `Published v${result.newVersion}` },
        }));
      } else {
        setPublishResult(prev => ({
          ...prev,
          [catalogId]: { ok: false, message: result.message },
        }));
      }
    } catch (e) {
      setPublishResult(prev => ({
        ...prev,
        [catalogId]: { ok: false, message: e instanceof Error ? e.message : 'Failed' },
      }));
    }
    setPublishing(null);
  }

  const publishedCount = localLibraries.filter(l => l.visibility === 'published').length;
  const publishedCatalogCount = localCatalogs.filter(c => c.visibility === 'published').length;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-4">
          <Link href={`/${workspaceSlug}/components`} className="hover:text-slate-700">Components</Link>
          <svg className="w-3.5 h-3.5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-slate-900">Supplier Dashboard</span>
        </nav>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Supplier Dashboard</h1>
            <p className="text-sm text-slate-400 mt-0.5">Manage your supplier profile, libraries and catalogues</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>
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
                <button onClick={() => setEditingProfile(true)} className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700 rounded-full px-3 py-1 hover:bg-slate-100">
                  Edit Profile
                </button>
              )}
            </div>

            {editingProfile ? (
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div>
                  <label className="text-xs font-medium text-slate-600">Website URL</label>
                  <input type="text" value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none" placeholder="https://..." />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600">Contact Email (public)</label>
                    <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none" placeholder="sales@yourcompany.com" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">Phone Number</label>
                    <input type="tel" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none" placeholder="+44 7700 900000" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Description</label>
                  <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none" placeholder="Tell customers about your products..." />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Service Areas (comma-separated)</label>
                  <input type="text" value={serviceAreas} onChange={e => setServiceAreas(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none" placeholder="UK, US, Australia" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Roofing Types</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {ROOFING_TYPES.map(rt => {
                      const selected = roofingTypes.includes(rt);
                      return (
                        <button key={rt} type="button"
                          onClick={() => setRoofingTypes(selected ? roofingTypes.filter(x => x !== rt) : [...roofingTypes, rt])}
                          className={`cursor-pointer rounded-full border px-3 py-1 text-xs transition ${selected ? 'bg-slate-900 border-slate-900 text-white' : 'border-slate-300 text-slate-600 hover:border-slate-400'}`}>
                          {rt}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-medium text-slate-700">Allow custom pricing on takeoff tool</label>
                      <p className="text-[11px] text-slate-400 mt-0.5">When enabled, users on your branded takeoff tool can enter their own known prices.</p>
                    </div>
                    <button type="button" onClick={() => setAllowCustomPricing(!allowCustomPricing)}
                      className={`relative inline-flex h-6 w-11 cursor-pointer rounded-full transition flex-shrink-0 ${allowCustomPricing ? 'bg-[#FF6B35]' : 'bg-slate-300'}`}>
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition mt-0.5 ${allowCustomPricing ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <button onClick={handleSaveProfile} disabled={saving}
                    className="cursor-pointer px-4 py-2 text-sm font-semibold rounded-full bg-black text-white hover:bg-slate-800 transition disabled:opacity-40">
                    {saving ? 'Saving...' : 'Save Profile'}
                  </button>
                  <button onClick={() => setEditingProfile(false)}
                    className="cursor-pointer px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50">
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
                  <div className="flex items-center gap-2 text-xs"><span className="text-slate-400 w-20">Contact</span><span className="text-slate-600">{profile.contact_email}</span></div>
                )}
                {profile.phone_number && (
                  <div className="flex items-center gap-2 text-xs"><span className="text-slate-400 w-20">Phone</span><span className="text-slate-600">{profile.phone_number}</span></div>
                )}
                {profile.description && (
                  <div className="flex items-start gap-2 text-xs"><span className="text-slate-400 w-20">Description</span><span className="text-slate-600">{profile.description}</span></div>
                )}
                {profile.service_areas && profile.service_areas.length > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400 w-20">Areas</span>
                    <div className="flex flex-wrap gap-1">{profile.service_areas.map(sa => <span key={sa} className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-600">{sa}</span>)}</div>
                  </div>
                )}
                {profile.roofing_types && profile.roofing_types.length > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400 w-20">Types</span>
                    <div className="flex flex-wrap gap-1">{profile.roofing_types.map(rt => <span key={rt} className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{rt}</span>)}</div>
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400 w-20">Custom Price</span>
                  <span className={`rounded-full px-2 py-0.5 ${profile.allow_custom_pricing ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>{profile.allow_custom_pricing ? 'Enabled' : 'Disabled'}</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center mb-6">
            <p className="text-sm text-slate-400">No supplier profile found. Contact admin to set up your supplier account.</p>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-2xl font-semibold text-slate-900">{localLibraries.length}</div>
            <div className="text-xs text-slate-400 mt-0.5">Libraries</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-2xl font-semibold text-emerald-600">{publishedCount}</div>
            <div className="text-xs text-slate-400 mt-0.5">Published Libs</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-2xl font-semibold text-slate-900">{localCatalogs.length}</div>
            <div className="text-xs text-slate-400 mt-0.5">Catalogues</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-2xl font-semibold text-emerald-600">{publishedCatalogCount}</div>
            <div className="text-xs text-slate-400 mt-0.5">Published Cats</div>
          </div>
        </div>

        {/* Catalogue Converter */}
        {profile?.status === 'approved' && (
          <CatalogueConverter workspaceSlug={workspaceSlug} collections={collections} catalogs={catalogs.map(c => ({ id: c.id, name: c.name, row_count: c.row_count, source_catalog_id: null }))} />
        )}

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-4">
          <button onClick={() => setActiveTab('libraries')}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${activeTab === 'libraries' ? 'bg-slate-900 text-white' : 'border border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
            Component Libraries
          </button>
          <button onClick={() => setActiveTab('catalogues')}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${activeTab === 'catalogues' ? 'bg-slate-900 text-white' : 'border border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
            Catalogues
          </button>
        </div>

        {/* Libraries Tab */}
        {activeTab === 'libraries' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Libraries</h3>
              <Link href={`/${workspaceSlug}/components`} className="text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8]">Manage in Components →</Link>
            </div>
            {localLibraries.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
                <p className="text-sm text-slate-400">No libraries yet.</p>
                <Link href={`/${workspaceSlug}/components`} className="mt-2 inline-block text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8]">Go to Components to create one</Link>
              </div>
            ) : (
              localLibraries.map(lib => (
                <div key={lib.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      {renamingId === lib.id ? (
                        <div className="flex items-center gap-2">
                          <input type="text" value={renameValue} onChange={e => setRenameValue(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void handleRename(lib.id); } if (e.key === 'Escape') { setRenamingId(null); setRenameValue(''); } }}
                            maxLength={80} className="px-2 py-1 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none" autoFocus />
                          <button type="button" onClick={() => void handleRename(lib.id)} disabled={renaming || !renameValue.trim()}
                            className="px-3 py-1 text-xs font-medium rounded-full bg-black text-white hover:bg-slate-800 disabled:opacity-50">{renaming ? 'Saving...' : 'Save'}</button>
                          <button type="button" onClick={() => { setRenamingId(null); setRenameValue(''); }}
                            className="px-3 py-1 text-xs rounded-full border border-slate-300 hover:bg-slate-50">Cancel</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-slate-900">{lib.name}</span>
                          {lib.is_bootstrap && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Default</span>}
                          <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${VISIBILITY_STYLES[lib.visibility ?? 'private'] || VISIBILITY_STYLES.private}`}>{lib.visibility ?? 'private'}</span>
                        </div>
                      )}
                      {lib.public_title && lib.visibility !== 'private' && <p className="text-xs text-slate-500 mt-1">Public title: {lib.public_title}</p>}
                      {lib.public_description && lib.visibility !== 'private' && <p className="text-xs text-slate-400 mt-0.5">{lib.public_description}</p>}
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
                        <span>{lib.component_count} component{lib.component_count !== 1 ? 's' : ''}</span>
                        {lib.published_at && <span>Published: {new Date(lib.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                      </div>
                      {lib.roofing_types && lib.roofing_types.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">{lib.roofing_types.map(rt => <span key={rt} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{rt}</span>)}</div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5 items-end shrink-0">
                      <button type="button" onClick={() => setShowPublishModal(lib.id)}
                        className="text-xs px-3 py-1.5 rounded-full border border-slate-300 hover:bg-slate-50 hover:border-orange-300 text-slate-600 transition font-medium">
                        {(lib.visibility ?? 'private') === 'private' ? 'Publish' : 'Settings'}
                      </button>
                      {renamingId !== lib.id && !lib.is_bootstrap && (
                        <button type="button" title="Rename" onClick={() => { setRenamingId(lib.id); setRenameValue(lib.name); }} className="text-xs text-slate-400 hover:text-orange-500 transition">Rename</button>
                      )}
                      {!lib.is_bootstrap && deletingId !== lib.id && (
                        <button type="button" title="Delete" onClick={() => setDeletingId(lib.id)} className="text-xs text-slate-400 hover:text-red-500 transition">Delete</button>
                      )}
                      {deletingId === lib.id && (
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => void handleDelete(lib.id)} disabled={deleteLoading}
                            className="text-xs px-2 py-1 rounded-full bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">{deleteLoading ? 'Deleting...' : 'Confirm'}</button>
                          <button type="button" onClick={() => setDeletingId(null)} className="text-xs px-2 py-1 rounded-full border border-slate-300 hover:bg-slate-50">Cancel</button>
                        </div>
                      )}
                      {lib.visibility === 'published' && (
                        <button onClick={() => handlePublishUpdate(lib.id)} disabled={publishing === lib.id}
                          className="text-xs px-3 py-1 rounded-full bg-[#FF6B35] text-white hover:bg-[#e55a2b] transition disabled:opacity-50 font-medium">
                          {publishing === lib.id ? 'Publishing...' : 'Push Update'}
                        </button>
                      )}
                      {publishResult[lib.id] && <span className={`text-xs ${publishResult[lib.id].ok ? 'text-emerald-600' : 'text-red-600'}`}>{publishResult[lib.id].message}</span>}
                      {lib.published_version != null && lib.published_version > 0 && lib.visibility === 'published' && <span className="text-xs text-slate-400">v{lib.published_version}</span>}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Catalogues Tab */}
        {activeTab === 'catalogues' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Catalogues</h3>
              <Link href={`/${workspaceSlug}/catalogs`} className="text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8]">Upload in Catalogs →</Link>
            </div>
            {localCatalogs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
                <p className="text-sm text-slate-400">No catalogues yet.</p>
                <Link href={`/${workspaceSlug}/catalogs`} className="mt-2 inline-block text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8]">Go to Catalogs to upload one</Link>
              </div>
            ) : (
              localCatalogs.map(cat => (
                <div key={cat.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-900">{cat.name}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${VISIBILITY_STYLES[cat.visibility] || VISIBILITY_STYLES.private}`}>{cat.visibility}</span>
                        {cat.status === 'archived' && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Archived</span>}
                      </div>
                      {cat.public_title && cat.visibility !== 'private' && <p className="text-xs text-slate-500 mt-1">Public title: {cat.public_title}</p>}
                      {cat.public_description && cat.visibility !== 'private' && <p className="text-xs text-slate-400 mt-0.5">{cat.public_description}</p>}
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
                        <span>{cat.row_count} row{cat.row_count !== 1 ? 's' : ''}</span>
                        {cat.original_filename && <span>File: {cat.original_filename}</span>}
                        {cat.published_at && <span>Published: {new Date(cat.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                      </div>
                      {cat.roofing_types && cat.roofing_types.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">{cat.roofing_types.map(rt => <span key={rt} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{rt}</span>)}</div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5 items-end shrink-0">
                      <button type="button" onClick={() => setShowCatalogPublishModal(cat.id)}
                        className="text-xs px-3 py-1.5 rounded-full border border-slate-300 hover:bg-slate-50 hover:border-orange-300 text-slate-600 transition font-medium">
                        {cat.visibility === 'private' ? 'Publish' : 'Settings'}
                      </button>
                      {cat.visibility === 'published' && (
                        <Link href={`/${workspaceSlug}/catalogs?replace=${cat.id}`} className="text-xs px-3 py-1 rounded-full bg-[#FF6B35] text-white hover:bg-[#e55a2b] transition font-medium text-center">
                          Upload New Version
                        </Link>
                      )}
                      {publishResult[cat.id] && <span className={`text-xs ${publishResult[cat.id].ok ? 'text-emerald-600' : 'text-red-600'}`}>{publishResult[cat.id].message}</span>}
                      {cat.published_version > 0 && cat.visibility === 'published' && <span className="text-xs text-slate-400">v{cat.published_version}</span>}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Publish Library Modal */}
        {showPublishModal && (() => {
          const lib = localLibraries.find(l => l.id === showPublishModal);
          if (!lib) return null;
          return (
            <PublishLibraryModal
              collectionId={lib.id} collectionName={lib.name}
              currentVisibility={(lib.visibility as 'private' | 'unlisted' | 'published') || 'private'}
              publicTitle={lib.public_title || ''} publicDescription={lib.public_description || ''}
              roofingTypes={lib.roofing_types || []}
              onClose={() => setShowPublishModal(null)}
              onSaved={() => { setShowPublishModal(null); window.location.reload(); }}
            />
          );
        })()}

        {/* Catalog Publish Settings Modal */}
        {showCatalogPublishModal && (() => {
          const cat = localCatalogs.find(c => c.id === showCatalogPublishModal);
          if (!cat) return null;
          return (
            <CatalogPublishModal
              catalog={cat}
              onClose={() => setShowCatalogPublishModal(null)}
              onSaved={() => { setShowCatalogPublishModal(null); window.location.reload(); }}
            />
          );
        })()}
      </div>
    </div>
  );
}
