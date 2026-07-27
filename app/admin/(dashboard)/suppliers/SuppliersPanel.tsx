'use client';

import { useState, useEffect, useTransition } from 'react';
import {
  getSuppliers,
  createSupplier,
  updateSupplier,
  setSupplierStatus,
  searchSupplierUsers,
  type SupplierProfile,
  type SupplierSearchResult,
} from './actions';

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  suspended: 'bg-orange-100 text-orange-700 border-orange-200',
  revoked: 'bg-red-100 text-red-700 border-red-200',
};

const ROOFING_TYPES = ['All Roofing', 'Metal Roofing', 'Tile Roofing', 'Flat Roofing', 'Shingle Roofing', 'Membrane', 'EPDM/TPO', 'Slate'];

export function SuppliersPanel() {
  const [suppliers, setSuppliers] = useState<SupplierProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SupplierSearchResult[]>([]);
  const [searching, startSearching] = useTransition();
  const [hasSearched, setHasSearched] = useState(false);

  // Add form state
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [masterEmail, setMasterEmail] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [serviceAreas, setServiceAreas] = useState('');
  const [roofingTypes, setRoofingTypes] = useState<string[]>([]);
  const [description, setDescription] = useState('');

  useEffect(() => {
    loadSuppliers();
  }, []);

  async function loadSuppliers() {
    setLoading(true);
    setError(null);
    try {
      const data = await getSuppliers();
      setSuppliers(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  // Search handler - matches Users tab pattern
  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startSearching(async () => {
      const res = await searchSupplierUsers(searchQuery);
      if (res.ok) {
        setSearchResults(res.users);
        setHasSearched(true);
      } else {
        setError(res.error);
      }
    });
  }

  // When a search result is clicked, populate the form
  function selectSearchResult(r: SupplierSearchResult) {
    setSelectedCompanyId(r.companyId || '');
    setSupplierName(r.companyName || '');
    setMasterEmail(r.email || '');
    setContactEmail(r.email || '');
    setSearchResults([]);
    setSearchQuery('');
    setHasSearched(false);
  }

  function toggleRoofingType(type: string) {
    setRoofingTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  }

  async function handleCreate() {
    if (!supplierName.trim() || !masterEmail.trim()) return;
    try {
      const areas = serviceAreas
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      await createSupplier({
        company_id: selectedCompanyId || undefined,
        supplier_name: supplierName.trim(),
        master_email: masterEmail.trim() || undefined,
        contact_email: contactEmail.trim() || undefined,
        phone_number: phoneNumber.trim() || undefined,
        website_url: websiteUrl.trim() || undefined,
        service_areas: areas,
        roofing_types: roofingTypes,
        description: description.trim() || undefined,
      });
      setShowAddForm(false);
      resetForm();
      await loadSuppliers();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create supplier');
    }
  }

  async function handleStatusChange(id: string, status: 'pending' | 'approved' | 'suspended' | 'revoked') {
    startTransition(async () => {
      try {
        await setSupplierStatus(id, status);
        await loadSuppliers();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to update status');
      }
    });
  }

  async function handleSaveEdit(id: string) {
    try {
      await updateSupplier(id, {
        supplier_name: supplierName.trim(),
        master_email: masterEmail.trim() || null,
        contact_email: contactEmail.trim() || null,
        phone_number: phoneNumber.trim() || null,
        website_url: websiteUrl.trim() || null,
        service_areas: serviceAreas.split(',').map(s => s.trim()).filter(Boolean),
        roofing_types: roofingTypes,
        description: description.trim() || null,
      });
      setEditingId(null);
      resetForm();
      await loadSuppliers();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update supplier');
    }
  }

  function startEdit(s: SupplierProfile) {
    setEditingId(s.id);
    setSelectedCompanyId(s.company_id || '');
    setSupplierName(s.supplier_name);
    setMasterEmail(s.master_email || '');
    setContactEmail(s.contact_email || '');
    setPhoneNumber(s.phone_number || '');
    setWebsiteUrl(s.website_url || '');
    setServiceAreas(s.service_areas?.join(', ') || '');
    setRoofingTypes(s.roofing_types || []);
    setDescription(s.description || '');
    setShowAddForm(false);
  }

  function resetForm() {
    setSelectedCompanyId('');
    setSupplierName('');
    setMasterEmail('');
    setContactEmail('');
    setPhoneNumber('');
    setWebsiteUrl('');
    setServiceAreas('');
    setRoofingTypes([]);
    setDescription('');
    setSearchQuery('');
    setSearchResults([]);
    setHasSearched(false);
  }

  // Show search + form view, or list view
  if (loading) {
    return <div className="text-sm text-slate-400 py-8 text-center">Loading suppliers...</div>;
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-3 underline">Dismiss</button>
        </div>
      )}

      {/* Supplier list view */}
      {!showAddForm && !editingId && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">{suppliers.length} supplier{suppliers.length !== 1 ? 's' : ''} total</p>
            <button
              onClick={() => { setShowAddForm(true); resetForm(); }}
              className="inline-flex items-center gap-1.5 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Supplier
            </button>
          </div>

          {suppliers.length === 0 ? (
            <div className="rounded-xl border-dashed border border-slate-200 px-6 py-12 text-center">
              <p className="text-sm text-slate-400">No suppliers yet. Add one to get started.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {suppliers.map((s) => (
                <div
                  key={s.id}
                  className="rounded-xl border border-slate-200 bg-white hover:bg-orange-50/40 hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] transition p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium text-slate-900">{s.supplier_name}</h3>
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border ${STATUS_STYLES[s.status] || STATUS_STYLES.pending}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                          {s.status}
                        </span>
                        {s.company_name && (
                          <span className="text-xs text-slate-400">- {s.company_name}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                        {s.master_email && (
                          <span className="text-xs text-slate-500">Master: <span className="text-orange-600 font-medium">{s.master_email}</span></span>
                        )}
                        {s.contact_email && (
                          <span className="text-xs text-slate-500">Contact: {s.contact_email}</span>
                        )}
                        {s.phone_number && (
                          <span className="text-xs text-slate-500">Phone: {s.phone_number}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {s.roofing_types?.map((t) => (
                          <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{t}</span>
                        ))}
                        {s.service_areas?.map((a) => (
                          <span key={a} className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">{a}</span>
                        ))}
                      </div>
                      {s.website_url && (
                        <a
                          href={s.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-orange-600 hover:underline mt-1.5 inline-block"
                        >
                          {s.website_url}
                        </a>
                      )}
                      {s.description && (
                        <p className="text-xs text-slate-500 mt-1">{s.description}</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 items-end">
                      <button
                        onClick={() => startEdit(s)}
                        className="p-1.5 rounded-full text-slate-400 hover:text-orange-600 hover:bg-orange-50 transition"
                        title="Edit"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      {s.status === 'approved' ? (
                        <button
                          onClick={() => handleStatusChange(s.id, 'suspended')}
                          className="text-xs px-2.5 py-1 rounded-full border border-orange-300 text-orange-600 hover:bg-orange-50 transition"
                        >
                          Suspend
                        </button>
                      ) : s.status === 'suspended' || s.status === 'pending' ? (
                        <button
                          onClick={() => handleStatusChange(s.id, 'approved')}
                          className="text-xs px-2.5 py-1 rounded-full border border-emerald-300 text-emerald-600 hover:bg-emerald-50 transition"
                        >
                          Approve
                        </button>
                      ) : null}
                      {s.status !== 'revoked' && (
                        <button
                          onClick={() => handleStatusChange(s.id, 'revoked')}
                          className="text-xs px-2.5 py-1 rounded-full border border-red-300 text-red-600 hover:bg-red-50 transition"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Add / Edit form view */}
      {(showAddForm || editingId) && (
        <div className="space-y-4">
          {/* Search section - only for new suppliers */}
          {!editingId && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">Search Existing Users</h3>
                <button
                  onClick={() => { setShowAddForm(false); resetForm(); }}
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
              </div>
              <form onSubmit={onSearch} className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 max-w-sm">
                  <svg className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by email or company name..."
                    className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={searching}
                  className="inline-flex items-center rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 disabled:opacity-50"
                >
                  {searching ? 'Searching...' : 'Search'}
                </button>
                <button
                  type="button"
                  onClick={() => { setHasSearched(false); setSearchResults([]); }}
                  className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50 transition"
                >
                  Clear
                </button>
              </form>

              {/* Search results table */}
              {searchResults.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Email</th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Name</th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Company</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {searchResults.map((r) => (
                        <tr
                          key={r.id}
                          onClick={() => selectSearchResult(r)}
                          className="hover:bg-orange-50/40 hover:border-orange-200 transition cursor-pointer"
                        >
                          <td className="px-4 py-3 font-medium text-slate-900">{r.email}</td>
                          <td className="px-4 py-3 text-slate-600">{r.fullName || <span className="text-slate-400">-</span>}</td>
                          <td className="px-4 py-3 text-slate-700">{r.companyName}</td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-xs text-orange-600 font-medium">Select →</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {hasSearched && searchResults.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-8 text-center">
                  <p className="text-sm text-slate-500">No users matching &quot;{searchQuery}&quot;. You can still fill in the form manually below.</p>
                </div>
              )}
            </div>
          )}

          {/* Supplier form */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <h3 className="font-semibold text-slate-900">
              {editingId ? 'Edit Supplier' : 'New Supplier'}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Supplier Name <span className="text-red-400">*</span></label>
                <input
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="e.g. Apex Roofing Supplies"
                  className="w-full px-2 py-1.5 text-base md:text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Master Email <span className="text-orange-500">*</span></label>
                <input
                  type="email"
                  value={masterEmail}
                  onChange={(e) => setMasterEmail(e.target.value)}
                  placeholder="login@email.com"
                  className="w-full px-2 py-1.5 text-base md:text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
                />
                <p className="text-xs text-slate-400 mt-1">Email that grants supplier abilities on login.</p>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Contact Email (public)</label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="sales@supplier.com"
                  className="w-full px-2 py-1.5 text-base md:text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
                />
                <p className="text-xs text-slate-400 mt-1">Shown to users in supplier directory.</p>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+64 21 123 4567"
                  className="w-full px-2 py-1.5 text-base md:text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Website URL</label>
                <input
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-2 py-1.5 text-base md:text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Service Areas (comma-separated)</label>
                <input
                  value={serviceAreas}
                  onChange={(e) => setServiceAreas(e.target.value)}
                  placeholder="London, South East, UK"
                  className="w-full px-2 py-1.5 text-base md:text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
                />
              </div>
              <div className="col-span-1 sm:col-span-2">
                <label className="block text-xs text-slate-500 mb-1">Roofing Types</label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {ROOFING_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => toggleRoofingType(type)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition ${
                        roofingTypes.includes(type)
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-600 border-slate-300 hover:border-orange-300'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              <div className="col-span-1 sm:col-span-2">
                <label className="block text-xs text-slate-500 mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Brief description of the supplier..."
                  className="w-full px-2 py-1.5 text-base md:text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => editingId ? handleSaveEdit(editingId) : handleCreate()}
                disabled={!supplierName.trim() || !masterEmail.trim()}
                className="inline-flex items-center rounded-full bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {editingId ? 'Save Changes' : 'Create Supplier'}
              </button>
              <button
                onClick={() => { setShowAddForm(false); setEditingId(null); resetForm(); }}
                className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
