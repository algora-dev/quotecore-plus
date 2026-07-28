'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { UpgradeModal } from '@/app/components/UpgradeModal';
import { UploadWizard } from './upload-wizard';
import { EditCatalogModal } from './edit-catalog-modal';
import { archiveCatalog, deleteCatalog, unarchiveCatalog } from './actions';
import type { CatalogRow } from './actions';
import type { DirectoryCatalog } from '../supplier-directory/actions';

type CatalogTab = 'my-catalogs' | 'find-catalogs';

interface Props {
  initialCatalogs: CatalogRow[];
  workspaceSlug: string;
  catalogsEnabled: boolean;
  catalogLimit: number | null;
  catalogCount: number;
  effectivePlanCode: string;
  subscriptionActive: boolean;
  /** When true the company is over storage - block CSV uploads. */
  isOverStorage?: boolean;
  /** Supplier catalogues for the Find Catalogs tab */
  supplierCatalogs?: DirectoryCatalog[];
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return '1 week ago';
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 60) return '1 month ago';
  return `${Math.floor(diffDays / 30)} months ago`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const STATUS_CONFIG: Record<CatalogRow['status'], { label: string; bg: string; text: string; border: string; dot: string }> = {
  ready:     { label: 'Ready',       bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300', dot: 'bg-emerald-500' },
  importing: { label: 'Importing',   bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-300',    dot: 'bg-blue-500' },
  archived:  { label: 'Archived',    bg: 'bg-slate-100',  text: 'text-slate-500',   border: 'border-slate-200',   dot: 'bg-slate-400' },
  error:     { label: 'Error',       bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-300',     dot: 'bg-red-500' },
};

function StatusBadge({ status }: { status: CatalogRow['status'] }) {
  const c = STATUS_CONFIG[status] ?? STATUS_CONFIG.ready;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border ${c.bg} ${c.text} ${c.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

export function CatalogList({
  initialCatalogs,
  workspaceSlug,
  catalogsEnabled,
  catalogLimit,
  catalogCount,
  subscriptionActive,
  isOverStorage,
  supplierCatalogs = [],
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [catalogs, setCatalogs] = useState<CatalogRow[]>(initialCatalogs);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<CatalogTab>('my-catalogs');
  const [savingCatalogId, setSavingCatalogId] = useState<string | null>(null);
  const [saveResult, setSaveResult] = useState<Record<string, { ok: boolean; message: string }>>({});

  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editCatalog, setEditCatalog] = useState<CatalogRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CatalogRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<CatalogRow | null>(null);
  const [archiving, setArchiving] = useState(false);

  const atLimit = catalogLimit !== null && catalogCount >= catalogLimit;

  const searchLower = searchQuery.toLowerCase();
  const filtered = catalogs.filter((c) => c.name.toLowerCase().includes(searchLower));
  const activeCatalogs = filtered.filter((c) => c.status !== 'archived');
  const archivedCatalogs = filtered.filter((c) => c.status === 'archived');

  function handleNewCatalog() {
    if (!subscriptionActive || !catalogsEnabled || atLimit) {
      setUpgradeOpen(true);
      return;
    }
    setWizardOpen(true);
  }

  function handleWizardComplete(partial: Partial<CatalogRow>) {
    setWizardOpen(false);
    if (partial.id) {
      setCatalogs((prev) => [
        {
          id: partial.id!,
          name: partial.name ?? 'New catalog',
          original_filename: partial.original_filename ?? null,
          row_count: partial.row_count ?? 0,
          data_bytes: partial.data_bytes ?? 0,
          column_mapping: (partial.column_mapping ?? {}) as Record<string, string | null>,
          headers: (partial.headers ?? []) as string[],
          status: 'ready',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        ...prev,
      ]);
    }
    startTransition(() => router.refresh());
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const result = await deleteCatalog(deleteTarget.id);
    setDeleting(false);
    if (result.ok) {
      setCatalogs((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      setDeleteTarget(null);
      startTransition(() => router.refresh());
    } else {
      alert(result.message);
    }
  }

  async function handleArchive() {
    if (!archiveTarget) return;
    setArchiving(true);
    const result = await archiveCatalog(archiveTarget.id);
    setArchiving(false);
    if (result.ok) {
      setCatalogs((prev) => prev.map((c) => (c.id === archiveTarget.id ? { ...c, status: 'archived' as const } : c)));
      setArchiveTarget(null);
      startTransition(() => router.refresh());
    } else {
      alert(result.message);
    }
  }

  async function handleUnarchive(catalog: CatalogRow) {
    if (atLimit) {
      setUpgradeOpen(true);
      return;
    }
    const result = await unarchiveCatalog(catalog.id);
    if (result.ok) {
      setCatalogs((prev) => prev.map((c) => (c.id === catalog.id ? { ...c, status: 'ready' as const } : c)));
      startTransition(() => router.refresh());
    } else {
      alert(result.message);
    }
  }

  async function handleSaveSupplierCatalog(catalogId: string) {
    setSavingCatalogId(catalogId);
    try {
      const res = await fetch('/api/supplier-directory/save-catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ catalogId }),
      });
      const data = await res.json();
      setSaveResult(prev => ({
        ...prev,
        [catalogId]: data.ok
          ? { ok: true, message: 'Added to your catalogs' }
          : { ok: false, message: data.message || 'Failed' },
      }));
      if (data.ok) {
        startTransition(() => router.refresh());
      }
    } catch {
      setSaveResult(prev => ({ ...prev, [catalogId]: { ok: false, message: 'Network error' } }));
    }
    setSavingCatalogId(null);
  }

  function renderRow(catalog: CatalogRow) {
    const isArchived = catalog.status === 'archived';
    return (
      <div
        key={catalog.id}
        onClick={() => setEditCatalog(catalog)}
        title="Click to edit this catalog"
        className={`grid sm:grid-cols-[1fr_140px_120px_120px_80px] gap-4 items-center rounded-xl border bg-white px-2 md:px-4 py-2 md:py-3 cursor-pointer hover:bg-orange-50/40 hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] transition group ${isArchived ? 'border-slate-200 opacity-75' : 'border-slate-200'}`}
      >
        {/* Name */}
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900 truncate">{catalog.name}</p>
          {catalog.original_filename && (
            <p className="text-xs text-slate-400 truncate">{catalog.original_filename}</p>
          )}
        </div>

        {/* Rows + size */}
        <div className="text-xs text-slate-500">
          <p className="font-medium text-slate-700">{catalog.row_count.toLocaleString()} rows</p>
          <p className="text-slate-400">{formatBytes(catalog.data_bytes)}</p>
        </div>

        {/* Status */}
        <div><StatusBadge status={catalog.status} /></div>

        {/* Last activity */}
        <div className="text-xs text-slate-400">{timeAgo(catalog.updated_at)}</div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {isArchived ? (
            <button
              onClick={() => handleUnarchive(catalog)}
              title="Reinstate catalog"
              className="icon-btn"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          ) : (
            <>
              <button
                onClick={() => setEditCatalog(catalog)}
                title="Edit catalog"
                className="icon-btn opacity-0 group-hover:opacity-100"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                onClick={() => setArchiveTarget(catalog)}
                title="Archive catalog"
                className="icon-btn opacity-0 group-hover:opacity-100"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
              </button>
            </>
          )}
          <button
            onClick={() => setDeleteTarget(catalog)}
            title="Delete catalog"
            className="icon-btn icon-btn--danger opacity-0 group-hover:opacity-100"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Catalog Library</h1>
          <p className="text-sm text-slate-500 mt-1">
            Import CSV price lists and search them when adding quote lines.
            {catalogLimit !== null && (
              <span className="ml-1 text-slate-400">{catalogCount} of {catalogLimit} catalogs used.</span>
            )}
          </p>
        </div>
        {activeTab === 'my-catalogs' && (
          <button
            onClick={handleNewCatalog}
            data-copilot="upload-catalog"
            className="inline-flex items-center gap-1.5 rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)] ring-2 ring-transparent hover:ring-orange-400/30 self-start sm:self-auto"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Upload catalog
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2">
        <button onClick={() => setActiveTab('my-catalogs')}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${activeTab === 'my-catalogs' ? 'bg-slate-900 text-white' : 'border border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
          My Catalogs ({catalogs.length})
        </button>
        <button onClick={() => setActiveTab('find-catalogs')}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${activeTab === 'find-catalogs' ? 'bg-slate-900 text-white' : 'border border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
            Find Supplier Catalogs ({supplierCatalogs.length})
          </button>
      </div>

      {/* Find Supplier Catalogs Tab */}
      {activeTab === 'find-catalogs' && (
        supplierCatalogs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-2 md:px-6 py-8 md:py-12 text-center">
            <p className="text-sm font-medium text-slate-700 mb-1">No supplier catalogs available</p>
            <p className="text-xs text-slate-400 mb-4">When suppliers publish catalogues, they'll appear here for you to add to your account.</p>
            <Link href={`/${workspaceSlug}/supplier-directory`}
              className="inline-flex items-center gap-1.5 rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800">
              Browse Supplier Directory
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {supplierCatalogs.map(cat => (
              <div key={cat.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3 hover:bg-orange-50/40 hover:border-orange-200 transition">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-slate-900">{cat.public_title || cat.name}</span>
                      <span className="rounded-full bg-blue-100 text-blue-700 border border-blue-200 px-2 py-0.5 text-xs">
                        {cat.row_count} row{cat.row_count !== 1 ? 's' : ''}
                      </span>
                      {cat.published_version > 0 && <span className="text-xs text-slate-400">v{cat.published_version}</span>}
                    </div>
                    {cat.public_description && <p className="text-xs text-slate-500 mt-0.5">{cat.public_description}</p>}
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                      <span>by {cat.supplier_name}</span>
                      {cat.published_at && <span>Updated: {new Date(cat.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                    </div>
                    {cat.service_areas && cat.service_areas.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">{cat.service_areas.map(a => <span key={a} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600">{a}</span>)}</div>
                    )}
                    {cat.roofing_types && cat.roofing_types.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">{cat.roofing_types.map(rt => <span key={rt} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{rt}</span>)}</div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 items-end shrink-0">
                    <button
                      onClick={() => handleSaveSupplierCatalog(cat.id)}
                      disabled={savingCatalogId === cat.id}
                      className="cursor-pointer rounded-full bg-[#FF6B35] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#e55a2b] transition disabled:opacity-50"
                    >
                      {savingCatalogId === cat.id ? 'Adding...' : 'Add Catalog'}
                    </button>
                    {saveResult[cat.id] && (
                      <span className={`text-xs ${saveResult[cat.id].ok ? 'text-emerald-600' : 'text-red-600'}`}>{saveResult[cat.id].message}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* My Catalogs Tab Content */}
      {activeTab === 'my-catalogs' && (<>

      {/* Search */}
      {catalogs.length > 0 && (
        <div className="relative max-w-sm">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search catalogs..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
          />
          <svg className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">✕</button>
          )}
        </div>
      )}

      {/* Empty state */}
      {catalogs.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-2 md:px-6 py-8 md:py-12 text-center">
          <p className="text-sm font-medium text-slate-700 mb-1">No catalogs yet</p>
          <p className="text-xs text-slate-400 mb-4">Upload a CSV price list to get started.</p>
          <button
            onClick={handleNewCatalog}
            className="inline-flex items-center gap-1.5 rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)]"
          >
            Upload your first catalog
          </button>
        </div>
      )}

      {/* Active catalogs */}
      {activeCatalogs.length > 0 && (
        <>
          <div className="hidden sm:grid sm:grid-cols-[1fr_140px_120px_120px_80px] gap-4 px-4 text-xs font-medium text-slate-400 uppercase tracking-wide">
            <span>Catalog</span>
            <span>Size</span>
            <span>Status</span>
            <span>Last Activity</span>
            <span></span>
          </div>
          <div className="grid gap-1">{activeCatalogs.map(renderRow)}</div>
        </>
      )}

      {/* Archived */}
      {archivedCatalogs.length > 0 && (
        <div className="pt-2">
          <h2 className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2 px-4">Archived</h2>
          <div className="grid gap-1">{archivedCatalogs.map(renderRow)}</div>
        </div>
      )}

      {/* No results from search */}
      {catalogs.length > 0 && filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-2 md:px-6 py-8 md:py-12 text-center">
          <p className="text-sm text-slate-500">No catalogs match your search.</p>
        </div>
      )}

      {/* Upload wizard */}
      {wizardOpen && (
        <UploadWizard workspaceSlug={workspaceSlug} onComplete={handleWizardComplete} onClose={() => setWizardOpen(false)} isOverStorage={isOverStorage} />
      )}

      {/* Edit modal */}
      {editCatalog && (
        <EditCatalogModal
          catalog={editCatalog}
          onClose={() => setEditCatalog(null)}
          onSaved={() => { setEditCatalog(null); startTransition(() => router.refresh()); }}
        />
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-4 md:p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Delete catalog</h3>
            <p className="text-sm text-slate-500 mt-2">
              Permanently delete <strong className="text-slate-700">{deleteTarget.name}</strong>? This removes {deleteTarget.row_count.toLocaleString()} rows and frees {formatBytes(deleteTarget.data_bytes)} of storage. This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 text-sm font-medium rounded-full bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Archive confirmation */}
      {archiveTarget && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-4 md:p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Archive catalog</h3>
            <p className="text-sm text-slate-500 mt-2">
              Archive <strong className="text-slate-700">{archiveTarget.name}</strong>? It will be hidden from search and the active list, but kept and reinstatable. Storage still counts toward your plan limit.
            </p>
            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => setArchiveTarget(null)} disabled={archiving} className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50">Cancel</button>
              <button onClick={handleArchive} disabled={archiving} className="px-4 py-2 text-sm font-medium rounded-full bg-black text-white hover:bg-slate-800 disabled:opacity-50">
                {archiving ? 'Archiving...' : 'Archive'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade modal */}
      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        title={
          !catalogsEnabled || !subscriptionActive
            ? 'Catalog Library requires a higher plan'
            : `You've reached your catalog limit (${catalogLimit})`
        }
        description={
          !catalogsEnabled || !subscriptionActive
            ? 'Catalog Library is available on the Pro plan or above. Upload CSV price lists and search them directly in your quotes.'
            : `Your current plan allows ${catalogLimit} active catalogs. Upgrade to Pro Plus or Premium for more, or archive an existing catalog to free a slot.`
        }
        recommendedPlan="pro"
      />
      </>
      )}
    </section>
  );
}
