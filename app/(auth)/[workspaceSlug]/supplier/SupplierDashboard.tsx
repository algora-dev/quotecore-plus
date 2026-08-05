'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  updateSupplierProfile,
  updateTakeoffBuilderSettings,
  publishCatalogUpdate,
  checkPublicationReadiness,
  updateSupplierVisibility,
  previewPublicProfile,
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

const COUNTRIES = [
  { code: '', name: 'Select country...' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'AU', name: 'Australia' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'IE', name: 'Ireland' },
];

type Tab = 'libraries' | 'catalogues' | 'takeoff-builder' | 'public-presence';

function Chevron({ open }: { open: boolean }) {
  return (
    <svg className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${open ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-slate-400 mt-0.5">{children}</p>;
}

function TipBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 mb-4">
      <div className="flex items-start gap-2">
        <svg className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-xs text-blue-700">{children}</p>
      </div>
    </div>
  );
}

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

  // Collapsible sections
  const [profileExpanded, setProfileExpanded] = useState(true);
  const [urlsExpanded, setUrlsExpanded] = useState(false);

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

  const [branchCity, setBranchCity] = useState(profile?.branch_city ?? '');
  const [branchRegion, setBranchRegion] = useState(profile?.branch_region ?? '');
  const [branchCountry, setBranchCountry] = useState(profile?.branch_country ?? '');
  const [branchPostcode, setBranchPostcode] = useState(profile?.branch_postcode ?? '');
  const [logoUrl, setLogoUrl] = useState(profile?.logo_url ?? '');
  const [bannerUrl, setBannerUrl] = useState(profile?.banner_url ?? '');

  const [uploading, setUploading] = useState<'logo' | 'banner' | 'price-list' | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [priceListUrl, setPriceListUrl] = useState(profile?.price_list_url ?? '');
  const [priceListFilename, setPriceListFilename] = useState(profile?.price_list_filename ?? '');
  const [priceListUploadedAt, setPriceListUploadedAt] = useState(profile?.price_list_uploaded_at ?? '');

  // Tax treatment
  const [taxTreatment, setTaxTreatment] = useState<string>(profile?.tax_treatment ?? 'exclusive');
  const [taxName, setTaxName] = useState(profile?.tax_name ?? '');
  const [taxRate, setTaxRate] = useState<string>(profile?.tax_rate != null ? String(profile.tax_rate) : '');

  // Delivery coverage
  const DELIVERY_OPTIONS = [
    { value: 'nationwide', label: 'Nationwide delivery' },
    { value: 'regional', label: 'State/Province-wide delivery' },
    { value: 'local', label: 'City-wide delivery' },
    { value: 'pickup_only', label: 'Pick Up' },
  ] as const;
  const [deliveryCoverage, setDeliveryCoverage] = useState<string[]>(profile?.delivery_coverage ?? []);

  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [takeoffEnabled, setTakeoffEnabled] = useState(profile?.takeoff_builder_enabled ?? false);
  const [takeoffCollectionId, setTakeoffCollectionId] = useState<string | null>(profile?.default_takeoff_collection_id ?? null);
  const [takeoffEnquiryEmail, setTakeoffEnquiryEmail] = useState(profile?.enquiry_email ?? '');
  const [takeoffEnquiriesEnabled, setTakeoffEnquiriesEnabled] = useState(profile?.enquiries_enabled ?? false);
  const [takeoffInstantPricing, setTakeoffInstantPricing] = useState(profile?.instant_pricing_available ?? false);
  const [takeoffSaving, setTakeoffSaving] = useState(false);
  const [takeoffSaved, setTakeoffSaved] = useState(false);
  const [takeoffError, setTakeoffError] = useState<string | null>(null);

  const [pubPageEnabled, setPubPageEnabled] = useState(profile?.public_page_enabled ?? false);
  const [pubIndexingEnabled, setPubIndexingEnabled] = useState(profile?.search_indexing_enabled ?? false);
  const [pubCatalogueEnabled, setPubCatalogueEnabled] = useState(profile?.public_catalogue_enabled ?? false);
  const [pubPriceVisibility, setPubPriceVisibility] = useState<'hidden' | 'web_only' | 'full'>(profile?.public_price_visibility ?? 'hidden');
  const [pubContactVisibility, setPubContactVisibility] = useState<'hidden' | 'page_only' | 'full'>(profile?.public_contact_visibility ?? 'hidden');
  const [pubState, setPubState] = useState(profile?.publication_state ?? 'unready');
  const [readinessChecks, setReadinessChecks] = useState<{ label: string; passed: boolean; detail?: string }[] | null>(null);
  const [pubSaving, setPubSaving] = useState(false);
  const [pubSaved, setPubSaved] = useState(false);
  const [pubError, setPubError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<Record<string, unknown> | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  async function handleUpload(file: File, kind: 'logo' | 'banner' | 'price-list') {
    setUploading(kind);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('kind', kind);
      const res = await fetch('/api/supplier-upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) { setUploadError(data.error || 'Upload failed'); return; }
      if (kind === 'logo') setLogoUrl(data.url);
      else if (kind === 'banner') setBannerUrl(data.url);
      else { setPriceListUrl(data.url); setPriceListFilename(data.filename); setPriceListUploadedAt(new Date().toISOString()); }
    } catch (e) { setUploadError(e instanceof Error ? e.message : 'Upload failed'); }
    finally { setUploading(null); }
  }

  function handleCopyLink(url: string, field: string) {
    navigator.clipboard.writeText(url).then(() => { setCopiedField(field); setTimeout(() => setCopiedField(null), 2000); });
  }

  async function handleSaveProfile() {
    setSaving(true); setError(null);
    try {
      const result = await updateSupplierProfile({
        website_url: websiteUrl.trim() || null, contact_email: contactEmail.trim() || null,
        phone_number: phoneNumber.trim() || null, description: description.trim() || null,
        service_areas: serviceAreas.split(',').map(s => s.trim()).filter(Boolean),
        roofing_types: roofingTypes, allow_custom_pricing: allowCustomPricing,
        branch_city: branchCity.trim() || null, branch_region: branchRegion.trim() || null,
        branch_country: branchCountry || null, branch_postcode: branchPostcode.trim() || null,
        logo_url: logoUrl || null, banner_url: bannerUrl || null,
        price_list_url: priceListUrl || null, price_list_filename: priceListFilename || null,
        price_list_uploaded_at: priceListUploadedAt || null, price_list_content_type: null,
        tax_treatment: taxTreatment,
        tax_name: taxTreatment === 'inclusive' ? (taxName.trim() || null) : null,
        tax_rate: taxTreatment === 'inclusive' ? (parseFloat(taxRate) || null) : null,
        delivery_coverage: deliveryCoverage.length > 0 ? deliveryCoverage : null,
      });
      if (!result.ok) setError(result.message); else setEditingProfile(false);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to save'); }
    finally { setSaving(false); }
  }

  async function handleSaveTakeoffSettings() {
    setTakeoffSaving(true); setTakeoffError(null); setTakeoffSaved(false);
    try {
      const result = await updateTakeoffBuilderSettings({
        takeoff_builder_enabled: takeoffEnabled, default_takeoff_collection_id: takeoffCollectionId,
        enquiry_email: takeoffEnquiryEmail.trim() || null, enquiries_enabled: takeoffEnquiriesEnabled,
        instant_pricing_available: takeoffInstantPricing,
      });
      if (!result.ok) setTakeoffError(result.message);
      else { setTakeoffSaved(true); setTimeout(() => setTakeoffSaved(false), 3000); }
    } catch (e) { setTakeoffError(e instanceof Error ? e.message : 'Failed to save'); }
    finally { setTakeoffSaving(false); }
  }

  async function handleCheckReadiness() {
    try { const result = await checkPublicationReadiness(); setReadinessChecks(result.checks); }
    catch (e) { setPubError(e instanceof Error ? e.message : 'Failed to check readiness'); }
  }

  async function handleSaveVisibility() {
    setPubSaving(true); setPubError(null); setPubSaved(false);
    try {
      const result = await updateSupplierVisibility({
        public_page_enabled: pubPageEnabled, search_indexing_enabled: pubIndexingEnabled,
        public_catalogue_enabled: pubCatalogueEnabled, public_price_visibility: pubPriceVisibility,
        public_contact_visibility: pubContactVisibility,
        publication_state: pubState as 'unready' | 'ready' | 'published' | 'unlisted',
      });
      if (!result.ok) setPubError(result.message);
      else { setPubSaved(true); setTimeout(() => setPubSaved(false), 3000); }
    } catch (e) { setPubError(e instanceof Error ? e.message : 'Failed to save'); }
    finally { setPubSaving(false); }
  }

  async function handlePreview() {
    try {
      const result = await previewPublicProfile();
      if (result.ok) { setPreviewData(result.data as Record<string, unknown>); setShowPreview(true); }
      else setPubError(result.message);
    } catch (e) { setPubError(e instanceof Error ? e.message : 'Failed to preview'); }
  }

  async function handlePublishUpdate(libraryId: string) {
    setPublishing(libraryId);
    try {
      const res = await fetch('/api/supplier-publish-update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ libraryId }) });
      const data = await res.json();
      setPublishResult(prev => ({ ...prev, [libraryId]: { ok: data.ok, message: data.ok ? `Published v${data.newVersion} (${data.changesRecorded} change${data.changesRecorded !== 1 ? 's' : ''})` : data.message || 'Failed' } }));
    } catch { setPublishResult(prev => ({ ...prev, [libraryId]: { ok: false, message: 'Network error' } })); }
    finally { setPublishing(null); }
  }

  async function handleRename(id: string) {
    if (!renameValue.trim()) return;
    setRenaming(true);
    try {
      const result = await renameComponentCollection(id, renameValue);
      if (!result.ok) { alert(result.message); return; }
      setLocalLibraries(prev => prev.map(l => l.id === id ? { ...l, name: result.name } : l));
      setRenamingId(null); setRenameValue('');
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed to rename'); }
    finally { setRenaming(false); }
  }

  async function handleDelete(id: string) {
    setDeleteLoading(true);
    try {
      const result = await deleteComponentCollection(id);
      if (!result.ok) { alert(result.message); return; }
      setLocalLibraries(prev => prev.filter(l => l.id !== id));
      setDeletingId(null);
    } catch (e) { alert(e instanceof Error ? e.message : 'Failed to delete'); }
    finally { setDeleteLoading(false); }
  }

  async function handleCatalogPublish(catalogId: string) {
    setPublishing(catalogId);
    try {
      const result = await publishCatalogUpdate(catalogId);
      if (result.ok) {
        setLocalCatalogs(prev => prev.map(c => c.id === catalogId ? { ...c, published_version: result.newVersion, published_at: new Date().toISOString() } : c));
        setPublishResult(prev => ({ ...prev, [catalogId]: { ok: true, message: `Published v${result.newVersion}` } }));
      } else { setPublishResult(prev => ({ ...prev, [catalogId]: { ok: false, message: result.message } })); }
    } catch (e) { setPublishResult(prev => ({ ...prev, [catalogId]: { ok: false, message: e instanceof Error ? e.message : 'Failed' } })); }
    finally { setPublishing(null); }
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

        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}
        {uploadError && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{uploadError}</div>}

        {/* === SUPPLIER PROFILE (collapsible) === */}
        {profile ? (
          <div className="rounded-xl border border-slate-200 bg-white mb-4 overflow-hidden">
            <button onClick={() => setProfileExpanded(!profileExpanded)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/50 transition">
              <div className="flex items-center gap-3 min-w-0">
                <Chevron open={profileExpanded} />
                {logoUrl || profile.logo_url ? (
                  <img src={(logoUrl || profile.logo_url) ?? ''} alt="Logo" className="h-8 w-8 rounded-lg border border-slate-200 object-contain flex-shrink-0" />
                ) : (
                  <div className="h-8 w-8 rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-slate-300 flex-shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-slate-900 truncate">Supplier Profile</h2>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium flex-shrink-0 ${STATUS_STYLES[profile.status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>{profile.status}</span>
                  </div>
                  <p className="text-xs text-slate-400 truncate">{profile.supplier_name}{profile.branch_city ? ` - ${profile.branch_city}` : ''}</p>
                </div>
              </div>
              {!profileExpanded && !editingProfile && <span className="text-xs text-slate-400 flex-shrink-0 ml-2">Click to expand</span>}
            </button>

            {profileExpanded && (
              <div className="px-5 pb-5 border-t border-slate-100">
                <div className="flex items-center justify-between mb-3 pt-3">
                  <p className="text-xs text-slate-400">Your business details shown on your public supplier page.</p>
                  {!editingProfile && (
                    <button onClick={() => setEditingProfile(true)} className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700 rounded-full px-3 py-1 hover:bg-slate-100">Edit Profile</button>
                  )}
                </div>

                {editingProfile ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-slate-600">Logo</label>
                      <div className="flex items-center gap-3 mt-1">
                        {logoUrl ? (
                          <img src={logoUrl} alt="Logo" className="h-12 w-12 rounded-lg border border-slate-200 object-contain" />
                        ) : (
                          <div className="h-12 w-12 rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-slate-300">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          </div>
                        )}
                        <div className="flex-1">
                          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f, 'logo'); }} disabled={uploading !== null}
                            className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-medium file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200" />
                          {uploading === 'logo' && <span className="text-xs text-slate-400 ml-2">Uploading...</span>}
                          {logoUrl && <button type="button" onClick={() => setLogoUrl('')} className="text-xs text-red-400 hover:text-red-600 ml-2">Remove</button>}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-600">Banner Image</label>
                      <Hint>Recommended: 1600x400px (4:1 ratio). Max 5MB. JPG, PNG, or WebP.</Hint>
                      {bannerUrl ? (
                        <div className="mt-1 relative rounded-lg overflow-hidden border border-slate-200">
                          <img src={bannerUrl} alt="Banner" className="w-full h-24 object-cover" />
                          <button type="button" onClick={() => setBannerUrl('')} className="absolute top-1 right-1 rounded-full bg-black/50 text-white p-1 hover:bg-black/70">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      ) : (
                        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f, 'banner'); }} disabled={uploading !== null}
                          className="mt-1 text-xs text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-medium file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200" />
                      )}
                      {uploading === 'banner' && <span className="text-xs text-slate-400 ml-2">Uploading...</span>}
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-600">Website URL</label>
                      <input type="text" value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none" placeholder="https://..." />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-slate-600">Contact Email (public)</label>
                        <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none" placeholder="sales@yourcompany.com" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600">Phone Number</label>
                        <input type="tel" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none" placeholder="+44 7700 900000" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600">Description</label>
                      <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none" placeholder="Tell customers about your products..." />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600">Service Areas (comma-separated)</label>
                      <input type="text" value={serviceAreas} onChange={e => setServiceAreas(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none" placeholder="UK, US, Australia" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600">Roofing Types</label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {ROOFING_TYPES.map(rt => {
                          const selected = roofingTypes.includes(rt);
                          return (
                            <button key={rt} type="button" onClick={() => setRoofingTypes(selected ? roofingTypes.filter(x => x !== rt) : [...roofingTypes, rt])}
                              className={`cursor-pointer rounded-full border px-3 py-1 text-xs transition ${selected ? 'bg-slate-900 border-slate-900 text-white' : 'border-slate-300 text-slate-600 hover:border-slate-400'}`}>{rt}</button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-xs font-medium text-slate-700">Allow custom pricing on takeoff tool</label>
                          <Hint>When enabled, users on your branded takeoff tool can enter their own known prices.</Hint>
                        </div>
                        <button type="button" onClick={() => setAllowCustomPricing(!allowCustomPricing)} className={`relative inline-flex h-6 w-11 cursor-pointer rounded-full transition flex-shrink-0 ${allowCustomPricing ? 'bg-[#FF6B35]' : 'bg-slate-300'}`}>
                          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition mt-0.5 ${allowCustomPricing ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-slate-600">Country</label>
                        <select value={branchCountry} onChange={e => setBranchCountry(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none">
                          {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600">City</label>
                        <input type="text" value={branchCity} onChange={e => setBranchCity(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none" placeholder="Christchurch" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600">Region / State</label>
                        <input type="text" value={branchRegion} onChange={e => setBranchRegion(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none" placeholder="Canterbury" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600">Postcode (optional)</label>
                        <input type="text" value={branchPostcode} onChange={e => setBranchPostcode(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none" placeholder="8011" />
                      </div>
                    </div>

                    {/* Tax Treatment */}
                    <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                      <label className="text-xs font-medium text-slate-700">Tax Treatment</label>
                      <Hint>How tax applies to your published prices. Users will see this information when using your takeoff builder.</Hint>
                      <div className="mt-2 space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="tax-treatment" value="inclusive" checked={taxTreatment === 'inclusive'} onChange={() => setTaxTreatment('inclusive')} className="text-[#FF6B35] focus:ring-[#FF6B35]" />
                          <span className="text-sm text-slate-700">Prices <strong>include</strong> tax</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="tax-treatment" value="exclusive" checked={taxTreatment === 'exclusive'} onChange={() => setTaxTreatment('exclusive')} className="text-[#FF6B35] focus:ring-[#FF6B35]" />
                          <span className="text-sm text-slate-700">Prices <strong>exclude</strong> tax</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="tax-treatment" value="not_applicable" checked={taxTreatment === 'not_applicable'} onChange={() => setTaxTreatment('not_applicable')} className="text-[#FF6B35] focus:ring-[#FF6B35]" />
                          <span className="text-sm text-slate-700">Tax not applicable</span>
                        </label>
                      </div>
                      {taxTreatment === 'inclusive' && (
                        <div className="mt-3 grid grid-cols-2 gap-2 pl-6">
                          <div>
                            <label className="text-xs font-medium text-slate-600">Tax Name</label>
                            <input type="text" value={taxName} onChange={e => setTaxName(e.target.value)}
                              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none" placeholder="e.g. GST, VAT" />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-slate-600">Rate (%)</label>
                            <input type="number" step="0.01" min="0" max="100" value={taxRate} onChange={e => setTaxRate(e.target.value)}
                              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none" placeholder="e.g. 15" />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Delivery Coverage */}
                    <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                      <label className="text-xs font-medium text-slate-700">Delivery Coverage</label>
                      <Hint>Select all areas you can deliver to. If none are selected, your page will show "Pick up only".</Hint>
                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {DELIVERY_OPTIONS.map(opt => {
                          const selected = deliveryCoverage.includes(opt.value);
                          return (
                            <label key={opt.value} className={`flex items-center gap-2 cursor-pointer rounded-lg border px-3 py-2 text-sm transition ${selected ? 'border-[#FF6B35] bg-orange-50/50 text-slate-900' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                              <input type="checkbox" checked={selected} onChange={() => setDeliveryCoverage(selected ? deliveryCoverage.filter(v => v !== opt.value) : [...deliveryCoverage, opt.value])}
                                className="rounded text-[#FF6B35] focus:ring-[#FF6B35]" />
                              {opt.label}
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                      <label className="text-xs font-medium text-slate-700">Price List File (PDF or CSV)</label>
                      <Hint>Upload your full price list for customers to download from your supplier page. Max 10MB.</Hint>
                      {priceListUrl ? (
                        <div className="mt-2 flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                              <span className="text-sm text-slate-700 truncate">{priceListFilename}</span>
                            </div>
                            {priceListUploadedAt && <span className="text-xs text-slate-400">Uploaded {new Date(priceListUploadedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                          </div>
                          <button type="button" onClick={() => { setPriceListUrl(''); setPriceListFilename(''); setPriceListUploadedAt(''); }} className="text-xs text-red-400 hover:text-red-600">Remove</button>
                        </div>
                      ) : (
                        <input type="file" accept=".pdf,.csv,application/pdf,text/csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f, 'price-list'); }} disabled={uploading !== null}
                          className="mt-2 text-xs text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-medium file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200" />
                      )}
                      {uploading === 'price-list' && <span className="text-xs text-slate-400 ml-2">Uploading...</span>}
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      <button onClick={handleSaveProfile} disabled={saving} className="cursor-pointer px-4 py-2 text-sm font-semibold rounded-full bg-black text-white hover:bg-slate-800 transition disabled:opacity-40">{saving ? 'Saving...' : 'Save Profile'}</button>
                      <button onClick={() => setEditingProfile(false)} className="cursor-pointer px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(logoUrl || profile.logo_url) && (
                      <div className="flex items-center gap-2 text-xs"><span className="text-slate-400 w-20">Logo</span><img src={(logoUrl || profile.logo_url) ?? ''} alt="Logo" className="h-8 w-8 rounded border border-slate-200 object-contain" /></div>
                    )}
                    {(bannerUrl || profile.banner_url) && (
                      <div className="flex items-center gap-2 text-xs"><span className="text-slate-400 w-20">Banner</span><img src={(bannerUrl || profile.banner_url) ?? ''} alt="Banner" className="h-10 w-24 rounded border border-slate-200 object-cover" /></div>
                    )}
                    {profile.website_url && (<div className="flex items-center gap-2 text-xs"><span className="text-slate-400 w-20">Website</span><a href={profile.website_url} target="_blank" rel="noopener noreferrer" className="text-[#2563EB] hover:underline">{profile.website_url}</a></div>)}
                    {profile.contact_email && (<div className="flex items-center gap-2 text-xs"><span className="text-slate-400 w-20">Contact</span><span className="text-slate-600">{profile.contact_email}</span></div>)}
                    {profile.phone_number && (<div className="flex items-center gap-2 text-xs"><span className="text-slate-400 w-20">Phone</span><span className="text-slate-600">{profile.phone_number}</span></div>)}
                    {profile.description && (<div className="flex items-start gap-2 text-xs"><span className="text-slate-400 w-20">Description</span><span className="text-slate-600">{profile.description}</span></div>)}
                    {profile.service_areas && profile.service_areas.length > 0 && (
                      <div className="flex items-center gap-2 text-xs"><span className="text-slate-400 w-20">Areas</span><div className="flex flex-wrap gap-1">{profile.service_areas.map(sa => <span key={sa} className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-600">{sa}</span>)}</div></div>
                    )}
                    {profile.roofing_types && profile.roofing_types.length > 0 && (
                      <div className="flex items-center gap-2 text-xs"><span className="text-slate-400 w-20">Types</span><div className="flex flex-wrap gap-1">{profile.roofing_types.map(rt => <span key={rt} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{rt}</span>)}</div></div>
                    )}
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-400 w-20">Custom Price</span>
                      <span className={`rounded-full px-2 py-0.5 ${profile.allow_custom_pricing ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>{profile.allow_custom_pricing ? 'Enabled' : 'Disabled'}</span>
                    </div>
                    {(profile.branch_city || profile.branch_region || profile.branch_country) && (
                      <div className="flex items-center gap-2 text-xs"><span className="text-slate-400 w-20">Location</span><span className="text-slate-600">{[profile.branch_city, profile.branch_region, profile.branch_country].filter(Boolean).join(', ')}</span></div>
                    )}
                    {profile.delivery_coverage && profile.delivery_coverage.length > 0 ? (
                      <div className="flex items-start gap-2 text-xs"><span className="text-slate-400 w-20">Delivery</span>
                        <div className="flex flex-wrap gap-1">
                          {profile.delivery_coverage.map(d => <span key={d} className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-600">{d === 'nationwide' ? 'Nationwide' : d === 'regional' ? 'State/Province' : d === 'local' ? 'City-wide' : d === 'pickup_only' ? 'Pick up' : d}</span>)}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs"><span className="text-slate-400 w-20">Delivery</span><span className="text-slate-600">Pick up only</span></div>
                    )}
                    {profile.tax_treatment && profile.tax_treatment !== 'not_applicable' && (
                      <div className="flex items-center gap-2 text-xs"><span className="text-slate-400 w-20">Tax</span>
                        <span className="text-slate-600">
                          {profile.tax_treatment === 'inclusive'
                            ? `Prices include ${profile.tax_name ?? 'tax'}${profile.tax_rate != null ? ` (${profile.tax_rate}%)` : ''}`
                            : 'Prices exclude tax'}
                        </span>
                      </div>
                    )}
                    {(priceListUrl || profile.price_list_url) && (
                      <div className="flex items-center gap-2 text-xs"><span className="text-slate-400 w-20">Price List</span><span className="text-slate-600 truncate max-w-xs">{priceListFilename || profile.price_list_filename}</span></div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center mb-4">
            <p className="text-sm text-slate-400">No supplier profile found. Contact admin to set up your supplier account.</p>
          </div>
        )}

        {/* === SUPPLIER PUBLIC URLS (collapsible) === */}
        {profile?.slug && (
          <div className="rounded-xl border border-slate-200 bg-white mb-4 overflow-hidden">
            <button onClick={() => setUrlsExpanded(!urlsExpanded)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/50 transition">
              <div className="flex items-center gap-3 min-w-0">
                <Chevron open={urlsExpanded} />
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-slate-900">Supplier Public URLs</h2>
                  <p className="text-xs text-slate-400 truncate">Share these links with customers and on your website so they can find your page and use your roofing calculator.</p>
                </div>
              </div>
              {!urlsExpanded && <span className="text-xs text-slate-400 flex-shrink-0 ml-2">Click to expand</span>}
            </button>
            {urlsExpanded && (
              <div className="px-5 pb-5 border-t border-slate-100">
                <div className="space-y-3 pt-3">
                  <div>
                    <p className="text-xs text-slate-400 mb-2">Your public supplier page on QuoteCore+. Add this link to your website, emails, or social media so customers can find your business and see your products.</p>
                    <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-medium text-slate-500 block">Supplier Page</span>
                        <code className="text-xs text-[#BD4A1A] break-all">https://quote-core.com/suppliers/{profile.slug}</code>
                      </div>
                      <button onClick={() => handleCopyLink(`https://quote-core.com/suppliers/${profile.slug}`, 'supplier-page')} className="flex-shrink-0 rounded-full p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition" title="Copy URL">
                        {copiedField === 'supplier-page' ? (
                          <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10a2 2 0 00-2 2v3a2 2 0 002 2h10a2 2 0 002-2v-3a2 2 0 00-2-2z" /></svg>
                        )}
                      </button>
                    </div>
                  </div>
                  {profile.takeoff_builder_enabled && (
                    <div>
                      <p className="text-xs text-slate-400 mb-2">Your branded roofing calculator. Customers can measure their roof and get instant pricing using your components. Add this as a button on your website.</p>
                      <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-medium text-slate-500 block">Roofing Calculator</span>
                          <code className="text-xs text-[#BD4A1A] break-all">https://quote-core.com/free-roofing-takeoff-builder/{profile.slug}</code>
                        </div>
                        <button onClick={() => handleCopyLink(`https://quote-core.com/free-roofing-takeoff-builder/${profile.slug}`, 'takeoff-builder')} className="flex-shrink-0 rounded-full p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition" title="Copy URL">
                          {copiedField === 'takeoff-builder' ? (
                            <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10a2 2 0 00-2 2v3a2 2 0 002 2h10a2 2 0 002-2v-3a2 2 0 00-2-2z" /></svg>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                  {profile.publication_state !== 'published' && profile.publication_state !== 'unlisted' && (
                    <p className="text-xs text-amber-600">Your page is not yet published. The URL will work once you publish in the Visibility & Publishing tab below.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* === TABS === */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <button onClick={() => setActiveTab('libraries')} className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${activeTab === 'libraries' ? 'bg-slate-900 text-white' : 'border border-slate-300 text-slate-600 hover:bg-slate-50'}`}>Component Libraries</button>
          <button onClick={() => setActiveTab('catalogues')} className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${activeTab === 'catalogues' ? 'bg-slate-900 text-white' : 'border border-slate-300 text-slate-600 hover:bg-slate-50'}`}>Price Catalogues</button>
          <button onClick={() => setActiveTab('takeoff-builder')} className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${activeTab === 'takeoff-builder' ? 'bg-slate-900 text-white' : 'border border-slate-300 text-slate-600 hover:bg-slate-50'}`}>Roofing Calculator</button>
          <button onClick={() => { setActiveTab('public-presence'); handleCheckReadiness(); }} className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${activeTab === 'public-presence' ? 'bg-slate-900 text-white' : 'border border-slate-300 text-slate-600 hover:bg-slate-50'}`}>Visibility & Publishing</button>
        </div>

        {/* === LIBRARIES TAB === */}
        {activeTab === 'libraries' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-400">Groups of roofing components with pricing that customers can use in the calculator. Publish a library to make it available to the public.</p>
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
                          <input type="text" value={renameValue} onChange={e => setRenameValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void handleRename(lib.id); } if (e.key === 'Escape') { setRenamingId(null); setRenameValue(''); } }} maxLength={80} className="px-2 py-1 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none" autoFocus />
                          <button type="button" onClick={() => void handleRename(lib.id)} disabled={renaming || !renameValue.trim()} className="px-3 py-1 text-xs font-medium rounded-full bg-black text-white hover:bg-slate-800 disabled:opacity-50">{renaming ? 'Saving...' : 'Save'}</button>
                          <button type="button" onClick={() => { setRenamingId(null); setRenameValue(''); }} className="px-3 py-1 text-xs rounded-full border border-slate-300 hover:bg-slate-50">Cancel</button>
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
                      <button type="button" onClick={() => setShowPublishModal(lib.id)} className="text-xs px-3 py-1.5 rounded-full border border-slate-300 hover:bg-slate-50 hover:border-orange-300 text-slate-600 transition font-medium">{(lib.visibility ?? 'private') === 'private' ? 'Publish' : 'Settings'}</button>
                      {renamingId !== lib.id && !lib.is_bootstrap && (<button type="button" title="Rename" onClick={() => { setRenamingId(lib.id); setRenameValue(lib.name); }} className="text-xs text-slate-400 hover:text-orange-500 transition">Rename</button>)}
                      {!lib.is_bootstrap && deletingId !== lib.id && (<button type="button" title="Delete" onClick={() => setDeletingId(lib.id)} className="text-xs text-slate-400 hover:text-red-500 transition">Delete</button>)}
                      {deletingId === lib.id && (
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => void handleDelete(lib.id)} disabled={deleteLoading} className="text-xs px-2 py-1 rounded-full bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">{deleteLoading ? 'Deleting...' : 'Confirm'}</button>
                          <button type="button" onClick={() => setDeletingId(null)} className="text-xs px-2 py-1 rounded-full border border-slate-300 hover:bg-slate-50">Cancel</button>
                        </div>
                      )}
                      {lib.visibility === 'published' && (
                        <button onClick={() => handlePublishUpdate(lib.id)} disabled={publishing === lib.id} className="text-xs px-3 py-1 rounded-full bg-[#FF6B35] text-white hover:bg-[#e55a2b] transition disabled:opacity-50 font-medium">{publishing === lib.id ? 'Publishing...' : 'Push Update'}</button>
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

        {/* === CATALOGUES TAB === */}
        {activeTab === 'catalogues' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-400">Upload CSV or PDF price lists from your suppliers. Convert them into component libraries using the converter below.</p>
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
                      <button type="button" onClick={() => setShowCatalogPublishModal(cat.id)} className="text-xs px-3 py-1.5 rounded-full border border-slate-300 hover:bg-slate-50 hover:border-orange-300 text-slate-600 transition font-medium">{cat.visibility === 'private' ? 'Publish' : 'Settings'}</button>
                      {cat.visibility === 'published' && (<Link href={`/${workspaceSlug}/catalogs?replace=${cat.id}`} className="text-xs px-3 py-1 rounded-full bg-[#FF6B35] text-white hover:bg-[#e55a2b] transition font-medium text-center">Upload New Version</Link>)}
                      {publishResult[cat.id] && <span className={`text-xs ${publishResult[cat.id].ok ? 'text-emerald-600' : 'text-red-600'}`}>{publishResult[cat.id].message}</span>}
                      {cat.published_version > 0 && cat.visibility === 'published' && <span className="text-xs text-slate-400">v{cat.published_version}</span>}
                    </div>
                  </div>
                </div>
              ))
            )}

            {/* Catalogue Converter - inside the tab */}
            {profile?.status === 'approved' && (
              <div className="mt-4">
                <CatalogueConverter workspaceSlug={workspaceSlug} collections={collections} catalogs={catalogs.map(c => ({ id: c.id, name: c.name, row_count: c.row_count, source_catalog_id: null }))} />
              </div>
            )}
          </div>
        )}

        {/* === TAKEOFF BUILDER TAB === */}
        {activeTab === 'takeoff-builder' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-slate-900">Roofing Calculator</h3>
              <p className="text-xs text-slate-400 mt-1">Your branded roofing calculator that customers can use to get instant quotes. Turn this on to get a custom URL you can share with customers or add to your website.</p>

              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-medium text-slate-700">Calculator enabled</label>
                    <Hint>When enabled, your branded calculator URL is active and your components are available.</Hint>
                  </div>
                  <button type="button" onClick={() => setTakeoffEnabled(!takeoffEnabled)} className={`relative inline-flex h-6 w-11 cursor-pointer rounded-full transition flex-shrink-0 ${takeoffEnabled ? 'bg-[#FF6B35]' : 'bg-slate-300'}`}>
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition mt-0.5 ${takeoffEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>

              {takeoffEnabled && profile?.slug && (
                <div className="mt-4 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3">
                  <p className="text-xs font-semibold text-emerald-800 mb-1">Your Calculator URL</p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs text-[#BD4A1A] flex-1 break-all">https://quote-core.com/free-roofing-takeoff-builder/{profile.slug}</code>
                    <button onClick={() => navigator.clipboard.writeText(`https://quote-core.com/free-roofing-takeoff-builder/${profile.slug}`)} className="flex-shrink-0 text-slate-400 hover:text-slate-600 transition" title="Copy URL">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10a2 2 0 00-2 2v3a2 2 0 002 2h10a2 2 0 002-2v-3a2 2 0 00-2-2z" /></svg>
                    </button>
                  </div>
                  <p className="text-[11px] text-emerald-700 mt-2">Share this URL with customers or add it as a button on your website. It will use your selected component library for pricing.</p>
                </div>
              )}

              <div className="mt-4">
                <label className="text-xs font-medium text-slate-600">Component Library for Calculator</label>
                <Hint>Select which library powers your branded calculator. Customers will see prices from this library.</Hint>
                {localLibraries.length === 0 ? (
                  <div className="mt-2 rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center">
                    <p className="text-sm text-slate-500">No component libraries found.</p>
                    <Link href={`/${workspaceSlug}/components`} className="mt-2 inline-block text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8]">Create a library first</Link>
                  </div>
                ) : (
                  <div className="mt-2 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="takeoff-collection" checked={takeoffCollectionId === null} onChange={() => setTakeoffCollectionId(null)} className="border-slate-300 text-orange-500 focus:ring-orange-500" />
                      <span className="text-sm text-slate-500">No library (uses generic components)</span>
                    </label>
                    {localLibraries.map((lib) => (
                      <label key={lib.id} className="flex items-center gap-2 cursor-pointer rounded-lg border border-slate-200 px-3 py-2 hover:bg-orange-50/40 transition">
                        <input type="radio" name="takeoff-collection" checked={takeoffCollectionId === lib.id} onChange={() => setTakeoffCollectionId(lib.id)} className="border-slate-300 text-orange-500 focus:ring-orange-500" />
                        <div className="flex-1">
                          <span className="text-sm font-medium text-slate-900">{lib.name}</span>
                          <span className="ml-2 text-xs text-slate-400">{lib.component_count} components</span>
                          {lib.is_default_takeoff_library && (<span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">Current default</span>)}
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${lib.visibility === 'published' ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-500'}`}>{lib.visibility ?? 'private'}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600">Enquiry Email</label>
                    <input type="email" value={takeoffEnquiryEmail} onChange={(e) => setTakeoffEnquiryEmail(e.target.value)} placeholder="sales@yourcompany.com" className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none" />
                    <Hint>Email that receives customer enquiries from the calculator.</Hint>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={takeoffEnquiriesEnabled} onChange={(e) => setTakeoffEnquiriesEnabled(e.target.checked)} className="rounded border-slate-300 text-orange-500 focus:ring-orange-500" />
                    <span className="text-sm text-slate-700">Enquiries enabled</span>
                    <span className="text-xs text-slate-400">(customers can send enquiries to your email)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={takeoffInstantPricing} onChange={(e) => setTakeoffInstantPricing(e.target.checked)} className="rounded border-slate-300 text-orange-500 focus:ring-orange-500" />
                    <span className="text-sm text-slate-700">Instant pricing available</span>
                    <span className="text-xs text-slate-400">(shows real-time prices in the calculator)</span>
                  </label>
                </div>
              </div>

              {takeoffError && (<div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{takeoffError}</div>)}
              {takeoffSaved && (<div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-600">Settings saved. Your calculator URL is {takeoffEnabled ? 'active.' : 'disabled.'}</div>)}
              <div className="mt-4 flex items-center gap-2">
                <button onClick={handleSaveTakeoffSettings} disabled={takeoffSaving} className="cursor-pointer px-4 py-2 text-sm font-semibold rounded-full bg-black text-white hover:bg-slate-800 transition disabled:opacity-40">{takeoffSaving ? 'Saving...' : 'Save Calculator Settings'}</button>
              </div>
            </div>
          </div>
        )}

        {/* === VISIBILITY & PUBLISHING TAB === */}
        {activeTab === 'public-presence' && (
          <div className="space-y-4">
            <TipBanner>The more visible your business, the more likely customers will find and contact you. We recommend enabling all options below unless you have a specific reason to keep something private.</TipBanner>

            {/* Page status banner */}
            <div className={`rounded-xl border px-4 py-3 ${
              pubState === 'published' ? 'border-emerald-200 bg-emerald-50' :
              pubState === 'unlisted' ? 'border-blue-200 bg-blue-50' :
              pubState === 'ready' ? 'border-amber-200 bg-amber-50' :
              'border-slate-200 bg-slate-50'
            }`}>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-900">Page status: {pubState === 'published' ? 'Live in directory' : pubState === 'unlisted' ? 'Direct link only' : pubState === 'ready' ? 'Ready to publish' : 'Not ready'}</span>
                {pubState === 'published' && <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Live</span>}
                {pubState === 'unlisted' && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Direct-link only</span>}
                {pubState === 'unready' && <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">Not ready</span>}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {pubState === 'published' ? 'Your supplier page is live and visible in the directory. New customers can find you.' :
                 pubState === 'unlisted' ? 'Your page is accessible via direct link but not shown in the directory.' :
                 pubState === 'ready' ? 'You are ready to publish. Select "Visible in directory" below and save.' :
                 'Complete the checklist below to enable publishing.'}
              </p>
            </div>

            {/* Readiness checklist */}
            {readinessChecks && (
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Before You Publish</h3>
                <p className="text-xs text-slate-400 mb-3">Make sure these items are complete so your page looks professional.</p>
                <div className="space-y-2">
                  {readinessChecks.map((check, i) => (
                    <div key={i} className="flex items-center gap-2">
                      {check.passed ? (
                        <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      ) : (
                        <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      )}
                      <span className={`text-sm ${check.passed ? 'text-slate-700' : 'text-slate-500'}`}>{check.label}</span>
                      {check.detail && <span className="text-xs text-slate-400">- {check.detail}</span>}
                    </div>
                  ))}
                </div>
                <button onClick={handleCheckReadiness} className="mt-3 text-xs text-[#2563EB] hover:underline">Re-check</button>
              </div>
            )}

            {/* Visibility controls */}
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-slate-900">Visibility Controls</h3>
              <p className="text-xs text-slate-400 mt-1">Control how visible your business is to customers searching online.</p>

              {/* Page toggle */}
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-medium text-slate-700">Public supplier page</label>
                    <Hint>Your profile page at quote-core.com/suppliers/{profile?.slug || 'your-slug'}. This is where customers can find your business.</Hint>
                  </div>
                  <button type="button" onClick={() => setPubPageEnabled(!pubPageEnabled)} className={`relative inline-flex h-6 w-11 cursor-pointer rounded-full transition flex-shrink-0 ${pubPageEnabled ? 'bg-[#FF6B35]' : 'bg-slate-300'}`}>
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition mt-0.5 ${pubPageEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>

              {/* Show on Google */}
              <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-medium text-slate-700">Show on Google</label>
                    <Hint>When on, your supplier page can appear in Google search results, helping new customers find you.</Hint>
                  </div>
                  <button type="button" onClick={() => setPubIndexingEnabled(!pubIndexingEnabled)} className={`relative inline-flex h-6 w-11 cursor-pointer rounded-full transition flex-shrink-0 ${pubIndexingEnabled ? 'bg-[#FF6B35]' : 'bg-slate-300'}`}>
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition mt-0.5 ${pubIndexingEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>

              {/* Show product categories */}
              <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-medium text-slate-700">Show product categories</label>
                    <Hint>Displays your roofing types and brands on your public page so customers know what you sell.</Hint>
                  </div>
                  <button type="button" onClick={() => setPubCatalogueEnabled(!pubCatalogueEnabled)} className={`relative inline-flex h-6 w-11 cursor-pointer rounded-full transition flex-shrink-0 ${pubCatalogueEnabled ? 'bg-[#FF6B35]' : 'bg-slate-300'}`}>
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition mt-0.5 ${pubCatalogueEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>

              {/* Show your prices */}
              <div className="mt-4">
                <label className="text-xs font-medium text-slate-600">Show your prices</label>
                <Hint>Control where your pricing is shown. More visibility means more customers can see your pricing and send enquiries.</Hint>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {([
                    { value: 'hidden', label: 'Hidden', desc: 'No prices shown anywhere' },
                    { value: 'web_only', label: 'On your page', desc: 'Prices on your supplier page only' },
                    { value: 'full', label: 'Everywhere', desc: 'On your page, in the calculator, and in AI tools' },
                  ] as const).map((opt) => (
                    <button key={opt.value} type="button" onClick={() => setPubPriceVisibility(opt.value)} className={`rounded-lg border px-3 py-2 text-left transition ${pubPriceVisibility === opt.value ? 'border-[#FF6B35] bg-orange-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                      <span className="text-xs font-medium text-slate-900">{opt.label}</span>
                      <span className="block text-[11px] text-slate-400 mt-0.5">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Show your contact details */}
              <div className="mt-4">
                <label className="text-xs font-medium text-slate-600">Show your contact details</label>
                <Hint>Control where your phone number and email are shown to customers.</Hint>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {([
                    { value: 'hidden', label: 'Hidden', desc: 'No contact details shown' },
                    { value: 'page_only', label: 'On your page', desc: 'Shown on your supplier page' },
                    { value: 'full', label: 'Everywhere', desc: 'On your page, in the calculator, and in results' },
                  ] as const).map((opt) => (
                    <button key={opt.value} type="button" onClick={() => setPubContactVisibility(opt.value)} className={`rounded-lg border px-3 py-2 text-left transition ${pubContactVisibility === opt.value ? 'border-[#FF6B35] bg-orange-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                      <span className="text-xs font-medium text-slate-900">{opt.label}</span>
                      <span className="block text-[11px] text-slate-400 mt-0.5">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Page status selector */}
              <div className="mt-4">
                <label className="text-xs font-medium text-slate-600">Page status</label>
                <Hint>Control whether your page is visible in the supplier directory or only accessible by direct link.</Hint>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {([
                    { value: 'unready', label: 'Hidden', desc: 'Not visible to the public' },
                    { value: 'unlisted', label: 'Direct link only', desc: 'Accessible via URL but not in directory' },
                    { value: 'published', label: 'Visible in directory', desc: 'Anyone can find you in the directory' },
                  ] as const).map((opt) => (
                    <button key={opt.value} type="button" onClick={() => setPubState(opt.value)} className={`rounded-lg border px-3 py-2 text-left transition ${pubState === opt.value ? 'border-[#FF6B35] bg-orange-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                      <span className="text-xs font-medium text-slate-900">{opt.label}</span>
                      <span className="block text-[11px] text-slate-400 mt-0.5">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* URLs */}
              {profile?.slug && pubPageEnabled && (
                <div className="mt-4 space-y-2">
                  <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2">
                    <p className="text-xs font-semibold text-emerald-800">Supplier Page URL</p>
                    <code className="text-xs text-[#BD4A1A]">https://quote-core.com/suppliers/{profile.slug}</code>
                  </div>
                  {takeoffEnabled && (
                    <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2">
                      <p className="text-xs font-semibold text-emerald-800">Calculator URL</p>
                      <code className="text-xs text-[#BD4A1A]">https://quote-core.com/free-roofing-takeoff-builder/{profile.slug}</code>
                    </div>
                  )}
                </div>
              )}

              {pubError && (<div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{pubError}</div>)}
              {pubSaved && (<div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-600">Visibility settings saved.</div>)}

              <div className="mt-4 flex items-center gap-2">
                <button onClick={handleSaveVisibility} disabled={pubSaving} className="cursor-pointer px-4 py-2 text-sm font-semibold rounded-full bg-black text-white hover:bg-slate-800 transition disabled:opacity-40">{pubSaving ? 'Saving...' : 'Save Visibility Settings'}</button>
                <button onClick={handlePreview} className="cursor-pointer px-4 py-2 text-sm font-medium rounded-full border border-slate-300 text-slate-600 hover:bg-slate-50 transition">Preview Public Profile</button>
              </div>
            </div>

            {/* Preview modal */}
            {showPreview && previewData && (
              <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
                  <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
                    <h3 className="text-sm font-semibold text-slate-900">Public Profile Preview</h3>
                    <button onClick={() => setShowPreview(false)} className="text-slate-400 hover:text-slate-600 transition">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                  <div className="p-5">
                    <pre className="text-xs text-slate-600 bg-slate-50 rounded-lg p-3 overflow-x-auto">{JSON.stringify(previewData, null, 2)}</pre>
                    <p className="text-xs text-slate-400 mt-3">This is what the public will see when they view your supplier page. Details you have not shared are removed automatically.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* === HIDDEN STATS (at the bottom) === */}
        <div className="mt-8 pt-6 border-t border-slate-100">
          <details className="text-xs text-slate-400">
            <summary className="cursor-pointer hover:text-slate-600">Stats: {localLibraries.length} libraries ({publishedCount} published), {localCatalogs.length} catalogues ({publishedCatalogCount} published)</summary>
            <div className="grid grid-cols-4 gap-3 mt-3">
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
          </details>
        </div>

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