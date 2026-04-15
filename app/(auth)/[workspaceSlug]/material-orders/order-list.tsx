'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { MaterialOrderRow } from '@/app/lib/types';
import { deleteOrder } from './order-list-actions';

interface Props {
  orders: MaterialOrderRow[];
  workspaceSlug: string;
}

export function OrderList({ orders, workspaceSlug }: Props) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleDelete(orderId: string, orderNumber: string) {
    if (!confirm(`Delete order ${orderNumber}? This cannot be undone.`)) {
      return;
    }

    setDeleting(orderId);
    try {
      await deleteOrder(orderId);
      router.refresh();
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete order. Please try again.');
    } finally {
      setDeleting(null);
    }
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <svg className="w-16 h-16 mx-auto mb-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-sm">No orders yet. Create your first order above!</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="text-left py-3 px-4 font-semibold text-slate-700">Order #</th>
            <th className="text-left py-3 px-4 font-semibold text-slate-700">Reference</th>
            <th className="text-left py-3 px-4 font-semibold text-slate-700">Supplier</th>
            <th className="text-left py-3 px-4 font-semibold text-slate-700">Status</th>
            <th className="text-left py-3 px-4 font-semibold text-slate-700">Created</th>
            <th className="text-right py-3 px-4 font-semibold text-slate-700">Actions</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="py-3 px-4">
                <span className="font-medium text-slate-900">{order.order_number}</span>
              </td>
              <td className="py-3 px-4 text-slate-700">
                {order.reference || order.job_name || '—'}
              </td>
              <td className="py-3 px-4 text-slate-700">
                {order.to_supplier || order.supplier_name || '—'}
              </td>
              <td className="py-3 px-4">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  order.status === 'ordered' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {order.status === 'ordered' ? 'Ordered' : 'Ready'}
                </span>
              </td>
              <td className="py-3 px-4 text-slate-600">
                {new Date(order.created_at).toLocaleDateString()}
              </td>
              <td className="py-3 px-4 text-right">
                <div className="flex items-center justify-end gap-3">
                  <Link
                    href={`/${workspaceSlug}/material-orders/${order.id}/preview`}
                    className="text-sm font-medium text-slate-600 hover:text-slate-900"
                  >
                    Preview
                  </Link>
                  <Link
                    href={`/${workspaceSlug}/material-orders/create?orderId=${order.id}`}
                    className="text-sm font-medium text-[#FF6B35] hover:text-orange-600"
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDelete(order.id, order.order_number)}
                    disabled={deleting === order.id}
                    className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                  >
                    {deleting === order.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
