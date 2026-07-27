'use client';

import { useState, useEffect, useTransition } from 'react';
import {
  getSuppliers,
  createSupplier,
  updateSupplier,
  setSupplierStatus,
  searchCompanies,
  type SupplierProfile,
} from './actions';

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  suspended: 'bg-orange-100 text-orange-700 border-orange-200',
  revoked: 'bg-red-100 text-red-700 border-red-200',
};

const ROOFING_TYPES = ['All Roofing', 'Metal Roofing', 'Tile Roofing', 'Flat Roofing', 'Shingle Roofing', 'Membrane', 'EPDM/TPO'];

export function SuppliersPanel() {
  const [suppliers, setSuppliers] = useState<SupplierProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Add form state
  const [companySearch, setCompanySearch] = useState('');
  const [companyResults, setCompanyResults] = useState<{ id: string; name: string; email: string }[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [serviceAreas, setServiceAreas] = useState('');
  const [roofingTypes, setRoofingTypes] = useState<string[]>([]);
  const [masterEmail, setMasterEmail] = useState('');
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

  async function handleCompanySearch(query: string) {
    setCompanySearch(query);
    if (query.trim().length < 2) {
      setCompanyResults([]);
      return;
    }
    try {
      const results = await searchCompanies(query.trim());
      setCompanyResults(results);
    } catch {
      setCompanyResults([]);
    }
  }

  function toggleRoofingType(type: string) {
    setRoofingTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  }

  async function handleCreate() {
    if (!selectedCompanyId || !supplierName.trim()) return;
    try {
      const areas = serviceAreas
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      await createSupplier({
        company_id: selectedCompanyId || undefined,
        supplier_name: supplierName.trim(),
        master_email: masterEmail.trim() || undefined,
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
    setWebsiteUrl(s.website_url || '');
    setServiceAreas(s.service_areas?.join(', ') || '');
    setRoofingTypes(s.roofing_types || []);
    setMasterEmail(s.master_email || '');
    setDescription(s.description || '');
    setShowAddForm(false);
  }

  function resetForm() {
    setCompanySearch('');
    setCompanyResults([]);
    setSelectedCompanyId('');
    setSupplierName('');
    setWebsiteUrl('');
    setServiceAreas('');
    setRoofingTypes([]);
    setMasterEmail('');
    setDescription('');
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-3 underline">Dismiss</button>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-slate-400 py-8 text-center">Loading suppliers...</div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">{suppliers.length} supplier{suppliers.length !== 1 ? 's' : ''} total</p>
            <button
              onClick={() => { setShowAddForm(true); setEditingId(null); resetForm(); }}
              className="inline-flex items-center gap-1.5 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Supplier
            </button>
          </div>

          {/* Add / Edit form */}
          {(showAddForm || editingId) && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
              <h3 className="font-semibold text-slate-900">
                {editingId ? 'Edit Supplier' : 'New Supplier'}
              </h3>

              {!editingId && (
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Search Company (optional)</label>
                  <input
                    type="text"
                    value={companySearch}
                    onChange={(e) => handleCompanySearch(e.target.value)}
                    placeholder="Type company name..."
                    className="w-full px-2 py-1.5 text-base md:text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
                  />
                  {companyResults.length > 0 && (
                    <div className="mt-1 border border-slate-200 rounded-lg overflow-hidden">
                      {companyResults.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => {
                            setSelectedCompanyId(c.id);
                            setCompanySearch(c.name);
                            setCompanyResults([]);
                            if (!supplierName) setSupplierName(c.name);
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-orange-50/40 border-b border-slate-100 last:border-0"
                        >
                          <span className="font-medium text-slate-900">{c.name}</span>
                          <span className="text-xs text-slate-400 ml-2">{c.email}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedCompanyId && (
                    <p className="text-xs text-emerald-600 mt-1">Company selected</p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs text-slate-500 mb-1">Master Email <span className="text-orange-500">*</span></label>
                <input
                  type="email"
                  value={masterEmail}
                  onChange={(e) => setMasterEmail(e.target.value)}
                  placeholder="supplier@example.com"
                  className="w-full px-2 py-1.5 text-base md:text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
                />
                <p className="text-xs text-slate-400 mt-1">When this user logs in with this email, they get supplier abilities.</p>
              </div>

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
                <div>
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
          )}

          {/* Supplier list */}
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
                        {s.master_email && (
                          <span className="text-xs text-orange-600 font-medium">- {s.master_email}</span>
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
    </div>
  );
}
