'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { MaterialOrderRow } from '@/app/lib/types';
import { deleteOrder, updateOrderStatus } from './order-list-actions';
import { loadOrderBundleData, bulkDeleteOrders } from './actions-bulk';
import { addOrderToZip, downloadBlob, sanitizeFilename } from './lib/order-bundle';
import JSZip from 'jszip';
import { RecipientStatusBadge, type RecipientStatus } from '@/app/components/RecipientStatusBadge';

/**
 * Client-side cap on the multi-select. Must match `MAX_BULK_BATCH` in
 * actions-bulk.ts. The server enforces the same cap authoritatively; this is
 * for UX so the user can't even build a selection larger than we'll process.
 */
const MAX_BULK_SELECTION = 25;

/**
 * Recipient-driven status for an order's Status column.
 * Action Required: supplier requested changes/info on the order.
 * Read: supplier opened the public order link.
 *
 * "Read" is TRANSIENT: it only shows while the order is still in its as-sent
 * baseline status ('ready' / "Not Ordered"). The moment the owner moves the
 * status forward (Ordered/Delivered/Paid/Pickup/Waiting) - manually or via any
 * auto update - "Read" disappears, since the owner has clearly moved on past
 * the "they opened it" signal (2026-06-10).
 */
const ORDER_SENT_BASELINE = new Set(['ready']);
function orderRecipientStatus(order: MaterialOrderRow): RecipientStatus {
  if (order.changes_requested_at || order.info_requested_at) return 'action_required';
  if (order.viewed_at && ORDER_SENT_BASELINE.has(order.status)) return 'viewed';
  return null;
}

interface Props {
  orders: MaterialOrderRow[];
  workspaceSlug: string;
}

const ORDER_STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string; dot: string }> = {
  ready:      { label: 'Not Ordered',  bg: 'bg-slate-50',    text: 'text-slate-600',   border: 'border-slate-300', dot: 'bg-slate-400' },
  ordered:    { label: 'Ordered',      bg: 'bg-blue-50',     text: 'text-blue-700',    border: 'border-blue-300', dot: 'bg-blue-500' },
  delivered:  { label: 'Delivered',    bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-emerald-300', dot: 'bg-emerald-500' },
  paid:       { label: 'Paid',         bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-emerald-300', dot: 'bg-emerald-500' },
  pickup:     { label: 'Pick Up',      bg: 'bg-orange-50',   text: 'text-orange-700',  border: 'border-orange-300', dot: 'bg-orange-500' },
  waiting:    { label: 'Waiting',      bg: 'bg-amber-50',    text: 'text-amber-700',   border: 'border-amber-300', dot: 'bg-amber-500' },
};

const ORDER_STATUS_ORDER = ['ready', 'ordered', 'delivered', 'paid', 'pickup', 'waiting'];

function OrderStatusDropdown({ orderId, currentStatus }: { orderId: string; currentStatus: string }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(currentStatus);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const config = ORDER_STATUS_CONFIG[status] || ORDER_STATUS_CONFIG.ready;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  async function handleSelect(newStatus: string) {
    if (newStatus === status) { setOpen(false); return; }
    setSaving(true);
    setOpen(false);
    try {
      await updateOrderStatus(orderId, newStatus);
      setStatus(newStatus);
      router.refresh();
    } catch (err) {
      console.error('Failed to update order status:', err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative" ref={ref} onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setOpen(!open)}
        disabled={saving}
        title="Click to change status"
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border transition-all hover:shadow-sm ${config.bg} ${config.text} ${config.border} ${saving ? 'opacity-50' : ''}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
        {saving ? '...' : config.label}
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-40 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {ORDER_STATUS_ORDER.map((s) => {
            const c = ORDER_STATUS_CONFIG[s];
            const isActive = s === status;
            return (
              <button key={s} onClick={() => handleSelect(s)} className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs transition hover:bg-slate-50 ${isActive ? 'font-semibold' : ''}`}>
                <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                <span className={isActive ? c.text : 'text-slate-700'}>{c.label}</span>
                {isActive && <svg className="w-3 h-3 ml-auto text-slate-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Small inline pill that shows whether the supplier has responded to a
 * given order via the public /orders/[token] page. Renders nothing when
 * no response has happened (so untouched orders stay visually clean).
 * Confirmed wins over Changes-requested wins over generic Response when
 * multiple timestamps are set (because the user typically wants to know
 * the latest meaningful state).
 */
function SupplierResponseBadge({
  confirmedAt,
  changesRequestedAt,
  lastResponseAt,
}: {
  confirmedAt: string | null;
  changesRequestedAt: string | null;
  lastResponseAt: string | null;
}) {
  if (changesRequestedAt && (!confirmedAt || new Date(changesRequestedAt) > new Date(confirmedAt))) {
    return (
      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 uppercase tracking-wide whitespace-nowrap">
        Changes
      </span>
    );
  }
  if (confirmedAt) {
    return (
      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 uppercase tracking-wide whitespace-nowrap">
        Confirmed
      </span>
    );
  }
  if (lastResponseAt) {
    return (
      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 uppercase tracking-wide whitespace-nowrap">
        Replied
      </span>
    );
  }
  return null;
}

export function OrderList({ orders, workspaceSlug }: Props) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  // Multi-select state for bulk download / delete (mirrors QuotesList).
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState<null | 'download' | 'delete'>(null);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number; message: string } | null>(null);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [capNotice, setCapNotice] = useState<string | null>(null);

  // Drop selections that no longer exist (e.g. after a delete refresh).
  useEffect(() => {
    setSelectedIds((prev) => {
      const stillExists = new Set(orders.map((o) => o.id));
      const next = new Set<string>();
      for (const id of prev) if (stillExists.has(id)) next.add(id);
      return next;
    });
  }, [orders]);

  useEffect(() => {
    if (!capNotice) return;
    const t = setTimeout(() => setCapNotice(null), 4000);
    return () => clearTimeout(t);
  }, [capNotice]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        return next;
      }
      if (next.size >= MAX_BULK_SELECTION) {
        setCapNotice(`You can select up to ${MAX_BULK_SELECTION} orders at a time.`);
        return prev;
      }
      next.add(id);
      return next;
    });
  }

  function toggleSelectAllVisible(visibleOrders: MaterialOrderRow[]) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const visibleIds = visibleOrders.map((o) => o.id);
      const allSelected = visibleIds.every((id) => next.has(id));
      if (allSelected) {
        for (const id of visibleIds) next.delete(id);
        return next;
      }
      for (const id of visibleIds) {
        if (next.has(id)) continue;
        if (next.size >= MAX_BULK_SELECTION) break;
        next.add(id);
      }
      const remainingVisible = visibleIds.filter((id) => !next.has(id)).length;
      if (remainingVisible > 0) {
        setCapNotice(
          `Selected the first ${MAX_BULK_SELECTION} orders. Process this batch first, then select the next ${remainingVisible}.`,
        );
      }
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  /**
   * Bulk download: load each order's data on the server, build a single ZIP
   * client-side, then trigger a download. Orders are processed serially so the
   * UI stays responsive. Best-effort per order: a failure is reported, the
   * rest continue.
   */
  async function handleBulkDownload() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (ids.length > MAX_BULK_SELECTION) {
      alert(`Too many orders selected (${ids.length}). Maximum ${MAX_BULK_SELECTION} per batch.`);
      return;
    }

    setBulkBusy('download');
    setBulkProgress({ done: 0, total: ids.length, message: 'Preparing export...' });

    try {
      const zip = new JSZip();
      let succeeded = 0;
      const failures: string[] = [];

      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        const row = orders.find((o) => o.id === id);
        const label = row ? row.order_number : id;
        setBulkProgress({ done: i, total: ids.length, message: `Bundling ${label} (${i + 1} of ${ids.length})...` });

        try {
          const data = await loadOrderBundleData(id);
          if (!data) {
            failures.push(`${label} (not found)`);
          } else {
            const fileName = await addOrderToZip(zip, data);
            if (fileName) succeeded++;
            else failures.push(`${label} (render failed)`);
          }
        } catch (err) {
          console.error('[bulkDownload] failed for', id, err);
          failures.push(`${label} (${err instanceof Error ? err.message : 'error'})`);
        }

        await new Promise((r) => setTimeout(r, 0));
      }

      if (succeeded === 0) {
        alert(`No orders could be exported.${failures.length ? '\n\nFailed:\n' + failures.join('\n') : ''}`);
        return;
      }

      setBulkProgress({ done: ids.length, total: ids.length, message: 'Compressing ZIP...' });
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });

      let zipName: string;
      if (succeeded === 1 && ids.length === 1) {
        const o = orders.find((x) => x.id === ids[0]);
        const supplier = o?.to_supplier || o?.supplier_name || '';
        zipName = `Order-${sanitizeFilename([o?.order_number ?? 'Order', supplier].filter(Boolean).join('-'))}.zip`;
      } else {
        const stamp = new Date().toISOString().slice(0, 10);
        zipName = `QuoteCore-Orders-${stamp}-${succeeded}-orders.zip`;
      }

      downloadBlob(blob, zipName);

      if (failures.length > 0) {
        alert(`Exported ${succeeded} of ${ids.length} orders.\n\nFailed:\n${failures.join('\n')}`);
      }
    } finally {
      setBulkBusy(null);
      setBulkProgress(null);
    }
  }

  /** Bulk delete after explicit confirmation. */
  async function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkBusy('delete');
    try {
      const result = await bulkDeleteOrders(ids);
      setSelectedIds(new Set());
      setBulkDeleteConfirmOpen(false);
      router.refresh();
      if (result.skipped > 0) {
        alert(`Deleted ${result.deleted} orders. ${result.skipped} were skipped (not owned or already gone).`);
      }
    } catch (err) {
      console.error('[bulkDelete] failed:', err);
      alert(`Failed to delete orders: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setBulkBusy(null);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(deleteId);
    try {
      await deleteOrder(deleteId);
      setDeleteId(null);
      router.refresh();
    } catch {
      alert('Failed to delete order.');
    } finally {
      setDeleting(null);
    }
  }

  if (orders.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white px-2 md:px-6 py-8 md:py-12 text-center">
        <p className="text-sm text-slate-500">No orders yet. Create your first order above.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="hidden sm:grid grid-cols-[28px_160px_1fr_1fr_130px_80px_70px] gap-4 px-4 pb-2 text-xs font-medium text-slate-400 uppercase tracking-wide items-center">
        <input
          type="checkbox"
          checked={orders.length > 0 && orders.every((o) => selectedIds.has(o.id))}
          ref={(el) => {
            if (!el) return;
            const someSelected = orders.some((o) => selectedIds.has(o.id));
            const allSelected = orders.every((o) => selectedIds.has(o.id));
            el.indeterminate = someSelected && !allSelected;
          }}
          onChange={() => toggleSelectAllVisible(orders)}
          onClick={(e) => e.stopPropagation()}
          title="Select all visible orders"
          className="w-4 h-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
        />
        <span>Order</span>
        <span>Reference</span>
        <span>Supplier</span>
        <span>Status</span>
        <span>Created</span>
        <span></span>
      </div>

      <div className="grid gap-1">
        {orders.map((order) => (
          <div
            key={order.id}
            // Click the row to open the Preview (the canonical "order
            // summary" surface). The pencil icon is the explicit
            // affordance for opening the editor; the eye icon used to
            // do this but is now redundant, kept only for backwards
            // discoverability and removed below.
            onClick={() => router.push(`/${workspaceSlug}/material-orders/${order.id}/preview`)}
            title="Click to view"
            className={`grid sm:grid-cols-[28px_160px_1fr_1fr_130px_80px_70px] gap-4 items-center rounded-xl border bg-white px-2 md:px-4 py-2 md:py-3 cursor-pointer hover:bg-orange-50/40 hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] transition group ${selectedIds.has(order.id) ? 'border-orange-300 bg-orange-50/30' : 'border-slate-200'}`}
          >
            <input
              type="checkbox"
              checked={selectedIds.has(order.id)}
              onChange={() => toggleSelect(order.id)}
              onClick={(e) => e.stopPropagation()}
              title="Select for bulk download or delete"
              className="w-4 h-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
            />
            <div className="font-semibold text-sm text-orange-600">{order.order_number}</div>
            <div className="text-sm text-slate-700 truncate">{order.reference || order.job_name || '-'}</div>
            <div className="text-sm text-slate-700 truncate flex items-center gap-2">
              <span className="truncate">{order.to_supplier || order.supplier_name || '-'}</span>
              <SupplierResponseBadge
                confirmedAt={order.confirmed_at}
                changesRequestedAt={order.changes_requested_at}
                lastResponseAt={order.last_supplier_response_at}
              />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <OrderStatusDropdown orderId={order.id} currentStatus={order.status || 'ready'} />
              <RecipientStatusBadge status={orderRecipientStatus(order)} />
            </div>
            <div className="text-xs text-slate-400">
              {new Date(order.created_at).toLocaleDateString('en-NZ', { day: '2-digit', month: 'short' })}
            </div>
            <div className="flex items-center justify-end gap-1">
              {/*
                Click-the-row now opens Preview, so the eye icon would be
                redundant. The pencil opens the editor instead (parallel
                to the templates list pattern). Delete trash stays on the
                right with hover-revealed visibility.
              */}
              <Link
                href={`/${workspaceSlug}/material-orders/create?orderId=${order.id}`}
                onClick={(e) => e.stopPropagation()}
                title="Edit order"
                className="p-1.5 rounded-full text-slate-400 hover:text-orange-600 hover:bg-orange-50 transition opacity-0 group-hover:opacity-100"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              </Link>
              <button
                onClick={(e) => { e.stopPropagation(); setDeleteId(order.id); }}
                disabled={deleting === order.id}
                title="Delete order"
                className="p-1.5 rounded-full text-slate-300 hover:text-red-500 hover:bg-red-50 transition opacity-0 group-hover:opacity-100"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Cap notice toast (fires when the user tries to exceed MAX_BULK_SELECTION). */}
      {capNotice && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 max-w-md rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 text-sm text-orange-900 shadow-lg">
          {capNotice}
        </div>
      )}

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-lg">
          <span className="text-sm text-slate-700">
            {selectedIds.size} selected
            <span className="ml-1 text-xs text-slate-400">/ {MAX_BULK_SELECTION} max</span>
          </span>
          <button onClick={clearSelection} className="text-xs text-slate-500 hover:text-slate-700 underline">
            clear
          </button>
          <span className="w-px h-6 bg-slate-200" />
          <button
            onClick={handleBulkDownload}
            disabled={bulkBusy !== null}
            className="inline-flex items-center gap-1.5 rounded-full bg-black px-4 py-1.5 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_12px_rgba(255,107,53,0.4)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
            </svg>
            {bulkBusy === 'download' ? 'Bundling...' : `Download ${selectedIds.size} as ZIP`}
          </button>
          <button
            onClick={() => setBulkDeleteConfirmOpen(true)}
            disabled={bulkBusy !== null}
            className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-1.5 text-sm font-semibold text-white transition-all hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete Selected
          </button>
        </div>
      )}

      {/* Bulk download progress modal */}
      {bulkProgress && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-4 md:p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Building Export</h3>
            <p className="text-sm text-slate-600 mt-2">{bulkProgress.message}</p>
            <div className="mt-4 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-orange-500 transition-all"
                style={{ width: `${Math.round((bulkProgress.done / Math.max(1, bulkProgress.total)) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-2 text-right">
              {bulkProgress.done} / {bulkProgress.total}
            </p>
          </div>
        </div>
      )}

      {/* Bulk delete confirmation */}
      {bulkDeleteConfirmOpen && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-4 md:p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Delete {selectedIds.size} Orders</h3>
            <p className="text-sm text-slate-500 mt-2">
              This action cannot be undone. All selected orders and their line items will be permanently deleted.
              Make sure you&apos;ve downloaded a copy first if you want to keep records.
            </p>
            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setBulkDeleteConfirmOpen(false)}
                className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50"
                disabled={bulkBusy === 'delete'}
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-4 py-2 text-sm font-medium rounded-full bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                disabled={bulkBusy === 'delete'}
              >
                {bulkBusy === 'delete' ? 'Deleting...' : `Delete ${selectedIds.size}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteId && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-4 md:p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Delete Order</h3>
            <p className="text-sm text-slate-500 mt-2">This action cannot be undone. The order will be permanently deleted.</p>
            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50" disabled={!!deleting}>Cancel</button>
              <button onClick={confirmDelete} className="px-4 py-2 text-sm font-medium rounded-full bg-red-600 text-white hover:bg-red-700 disabled:opacity-50" disabled={!!deleting}>{deleting ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
