'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { MaterialOrderRow } from '@/app/lib/types';
import { deleteOrder, updateOrderStatus } from './order-list-actions';

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

export function OrderList({ orders, workspaceSlug }: Props) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleDelete(e: React.MouseEvent, orderId: string, orderNumber: string) {
    e.stopPropagation();
    if (!confirm(`Delete order ${orderNumber}? This cannot be undone.`)) return;
    setDeleting(orderId);
    try {
      await deleteOrder(orderId);
      router.refresh();
    } catch {
      alert('Failed to delete order.');
    } finally {
      setDeleting(null);
    }
  }

  if (orders.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
        <p className="text-sm text-slate-500">No orders yet. Create your first order above.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="hidden sm:grid grid-cols-[80px_1fr_1fr_130px_100px_70px] gap-4 px-4 pb-2 text-xs font-medium text-slate-400 uppercase tracking-wide">
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
            onClick={() => router.push(`/${workspaceSlug}/material-orders/create?orderId=${order.id}`)}
            title="Click to edit"
            className="grid sm:grid-cols-[80px_1fr_1fr_130px_100px_70px] gap-4 items-center rounded-xl border border-slate-200 bg-white px-4 py-3 cursor-pointer hover:bg-orange-50/40 hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] transition group"
          >
            <div className="font-semibold text-sm text-orange-600">{order.order_number}</div>
            <div className="text-sm text-slate-700 truncate">{order.reference || order.job_name || '—'}</div>
            <div className="text-sm text-slate-700 truncate">{order.to_supplier || order.supplier_name || '—'}</div>
            <div>
              <OrderStatusDropdown orderId={order.id} currentStatus={order.status || 'ready'} />
            </div>
            <div className="text-xs text-slate-400">
              {new Date(order.created_at).toLocaleDateString('en-NZ', { day: '2-digit', month: 'short' })}
            </div>
            <div className="flex items-center justify-end gap-1">
              <Link
                href={`/${workspaceSlug}/material-orders/${order.id}/preview`}
                onClick={e => e.stopPropagation()}
                title="Preview"
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              </Link>
              <button
                onClick={(e) => handleDelete(e, order.id, order.order_number)}
                disabled={deleting === order.id}
                title="Click to delete"
                className="p-1.5 rounded-full text-slate-300 hover:text-red-500 hover:bg-red-50 transition opacity-0 group-hover:opacity-100"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
