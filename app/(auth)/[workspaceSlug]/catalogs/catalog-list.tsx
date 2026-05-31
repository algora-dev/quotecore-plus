'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { UpgradeModal } from '@/app/components/UpgradeModal';
import { UploadWizard } from './upload-wizard';
import { EditCatalogModal } from './edit-catalog-modal';
import { archiveCatalog, deleteCatalog, unarchiveCatalog } from './actions';
import type { CatalogRow } from './actions';

interface Props {
  initialCatalogs: CatalogRow[];
  workspaceSlug: string;
  catalogsEnabled: boolean;
  catalogLimit: number | null;
  catalogCount: number;
  effectivePlanCode: string;
  subscriptionActive: boolean;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function StatusBadge({ status }: { status: CatalogRow['status'] }) {
  const map: Record<CatalogRow['status'], { label: string; className: string }> = {
    ready: { label: 'Ready', className: 'bg-emerald-100 text-emerald-700' },
    importing: { label: 'Importing...', className: 'bg-blue-100 text-blue-700' },
    archived: { label: 'Archived', className: 'bg-slate-100 text-slate-500' },
    error: { label: 'Error', className: 'bg-red-100 text-red-600' },
  };
  const { label, className } = map[status] ?? map.ready;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

export function CatalogList({
  initialCatalogs,
  workspaceSlug,
  catalogsEnabled,
  catalogLimit,
  catalogCount,
  effectivePlanCode,
  subscriptionActive,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [catalogs, setCatalogs] = useState<CatalogRow[]>(initialCatalogs);

  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editCatalog, setEditCatalog] = useState<CatalogRow | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<CatalogRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Archive confirmation
  const [archiveTarget, setArchiveTarget] = useState<CatalogRow | null>(null);
  const [archiving, setArchiving] = useState(false);

  const activeCatalogs = catalogs.filter((c) => c.status !== 'archived');
  const archivedCatalogs = catalogs.filter((c) => c.status === 'archived');

  const atLimit = catalogLimit !== null && catalogCount >= catalogLimit;

  function handleNewCatalog() {
    if (!subscriptionActive || !catalogsEnabled) {
      setUpgradeOpen(true);
      return;
    }
    if (atLimit) {
      setUpgradeOpen(true);
      return;
    }
    setWizardOpen(true);
  }

  function handleWizardComplete(partial: Partial<CatalogRow>) {
    setWizardOpen(false);
    // Optimistically add new catalog to list
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
      setCatalogs((prev) =>
        prev.map((c) => (c.id === archiveTarget.id ? { ...c, status: 'archived' as const } : c)),
      );
      setArchiveTarget(null);
      startTransition(() => router.refresh());
    } else {
      alert(result.message);
    }
  }

  async function handleUnarchive(catalog: CatalogRow) {
    if (atLimit) {
      alert('You have reached your catalog limit. Delete or archive an active catalog first, or upgrade your plan.');
      return;
    }
    const result = await unarchiveCatalog(catalog.id);
    if (result.ok) {
      setCatalogs((prev) =>
        prev.map((c) => (c.id === catalog.id ? { ...c, status: 'ready' as const } : c)),
      );
      startTransition(() => router.refresh());
    } else {
      alert(result.message);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Catalog Library</h1>
          <p className="text-sm text-slate-500 mt-1">
            Import CSV price lists and search them when adding quote lines.
            {catalogLimit !== null && (
              <span className="ml-2 text-slate-400">
                {catalogCount} / {catalogLimit} catalogs used
              </span>
            )}
          </p>
        </div>
        <button
          onClick={handleNewCatalog}
          className="inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
          </svg>
          Upload catalog
        </button>
      </div>

      {/* Active catalogs */}
      {activeCatalogs.length === 0 && archivedCatalogs.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-slate-200 p-12 text-center">
          <svg className="h-10 w-10 mx-auto text-slate-300 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
          </svg>
          <p className="text-sm font-medium text-slate-700 mb-1">No catalogs yet</p>
          <p className="text-xs text-slate-400 mb-4">Upload a CSV price list to get started</p>
          <button
            onClick={handleNewCatalog}
            className="inline-flex items-center gap-1.5 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
          >
            Upload your first catalog
          </button>
        </div>
      )}

      {activeCatalogs.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {activeCatalogs.map((catalog) => (
            <CatalogCard
              key={catalog.id}
              catalog={catalog}
              onEdit={() => setEditCatalog(catalog)}
              onArchive={() => setArchiveTarget(catalog)}
              onDelete={() => setDeleteTarget(catalog)}
            />
          ))}
        </div>
      )}

      {/* Archived section */}
      {archivedCatalogs.length > 0 && (
        <div className="mt-10">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Archived</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {archivedCatalogs.map((catalog) => (
              <CatalogCard
                key={catalog.id}
                catalog={catalog}
                onEdit={() => setEditCatalog(catalog)}
                onArchive={() => setArchiveTarget(catalog)}
                onDelete={() => setDeleteTarget(catalog)}
                onUnarchive={() => handleUnarchive(catalog)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Upload wizard */}
      {wizardOpen && (
        <UploadWizard
          workspaceSlug={workspaceSlug}
          onComplete={handleWizardComplete}
          onClose={() => setWizardOpen(false)}
        />
      )}

      {/* Edit modal */}
      {editCatalog && (
        <EditCatalogModal
          catalog={editCatalog}
          onClose={() => setEditCatalog(null)}
          onSaved={() => {
            setEditCatalog(null);
            startTransition(() => router.refresh());
          }}
        />
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-6">
            <h3 className="text-base font-semibold text-slate-900 mb-2">Delete catalog</h3>
            <p className="text-sm text-slate-600 mb-1">
              Are you sure you want to permanently delete <strong>{deleteTarget.name}</strong>?
            </p>
            <p className="text-sm text-slate-500 mb-5">
              This removes {deleteTarget.row_count.toLocaleString()} rows and frees {formatBytes(deleteTarget.data_bytes)} of storage. This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm text-slate-600 rounded-lg border border-slate-200 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg disabled:opacity-40 hover:bg-red-700 transition-colors"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Archive confirmation */}
      {archiveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-6">
            <h3 className="text-base font-semibold text-slate-900 mb-2">Archive catalog</h3>
            <p className="text-sm text-slate-600 mb-5">
              Archive <strong>{archiveTarget.name}</strong>? It will be hidden from search and the catalog list, but data is kept and can be reinstated. Storage still counts toward your plan limit.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setArchiveTarget(null)}
                className="px-4 py-2 text-sm text-slate-600 rounded-lg border border-slate-200 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleArchive}
                disabled={archiving}
                className="px-4 py-2 text-sm font-medium text-white bg-black rounded-lg disabled:opacity-40 hover:bg-slate-800 transition-colors"
              >
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
            : `You have reached your catalog limit (${catalogLimit})`
        }
        description={
          !catalogsEnabled || !subscriptionActive
            ? 'Catalog Library is available on the Pro plan or above. Upload CSV price lists and search them directly in your quotes.'
            : `Your current plan allows ${catalogLimit} active catalogs. Upgrade to Pro Max or Premium for more, or archive an existing catalog to free a slot.`
        }
        recommendedPlan="pro"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// CatalogCard
// ---------------------------------------------------------------------------

interface CardProps {
  catalog: CatalogRow;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onUnarchive?: () => void;
}

function CatalogCard({ catalog, onEdit, onArchive, onDelete, onUnarchive }: CardProps) {
  const isArchived = catalog.status === 'archived';

  return (
    <div className={`rounded-xl border ${isArchived ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-white'} p-4 flex flex-col gap-3`}>
      {/* Top row: name + status */}
      <div className="flex items-start justify-between gap-2">
        <h3 className={`text-sm font-semibold ${isArchived ? 'text-slate-400' : 'text-slate-800'} leading-tight line-clamp-2`}>
          {catalog.name}
        </h3>
        <StatusBadge status={catalog.status} />
      </div>

      {/* Meta */}
      <div className="text-xs text-slate-400 space-y-0.5">
        <p>{catalog.row_count.toLocaleString()} rows · {formatBytes(catalog.data_bytes)}</p>
        <p>Updated {formatDate(catalog.updated_at)}</p>
        {catalog.original_filename && (
          <p className="truncate" title={catalog.original_filename}>{catalog.original_filename}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-auto pt-1 border-t border-slate-100">
        {isArchived ? (
          <>
            {onUnarchive && (
              <button
                onClick={onUnarchive}
                className="text-xs text-slate-600 hover:text-black transition-colors"
              >
                Reinstate
              </button>
            )}
            <button
              onClick={onDelete}
              className="ml-auto text-xs text-red-500 hover:text-red-700 transition-colors"
            >
              Delete
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onEdit}
              aria-label="Edit catalog"
              className="text-slate-400 hover:text-slate-700 transition-colors"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
            </button>
            <button
              onClick={onArchive}
              aria-label="Archive catalog"
              className="text-slate-400 hover:text-slate-700 transition-colors"
              title="Archive"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4zM3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
              </svg>
            </button>
            <button
              onClick={onDelete}
              aria-label="Delete catalog"
              className="ml-auto text-slate-400 hover:text-red-500 transition-colors"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
