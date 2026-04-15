'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { MaterialOrderRow, MaterialOrderLineRow, FlashingLibraryRow } from '@/app/lib/types';
import { markOrderAsOrdered } from '../../order-list-actions';

interface Props {
  order: MaterialOrderRow;
  lines: MaterialOrderLineRow[];
  flashings: FlashingLibraryRow[];
  workspaceSlug: string;
}

export function OrderPreview({ order, lines, flashings, workspaceSlug }: Props) {
  const router = useRouter();
  const [markingOrdered, setMarkingOrdered] = useState(false);

  const isOrdered = order.status === 'ordered';

  async function handleMarkAsOrdered() {
    if (!confirm('Mark this order as sent to supplier?')) return;
    
    setMarkingOrdered(true);
    try {
      await markOrderAsOrdered(order.id);
      router.refresh();
      alert('Order marked as sent!');
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to update status');
    } finally {
      setMarkingOrdered(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Top Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="text-slate-600 hover:text-slate-900"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Order Preview</h1>
            <p className="text-sm text-slate-600">{order.order_number}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!isOrdered && (
            <button
              onClick={handleMarkAsOrdered}
              disabled={markingOrdered}
              className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {markingOrdered ? 'Updating...' : 'Mark as Ordered'}
            </button>
          )}
          <Link
            href={`/${workspaceSlug}/material-orders/create?orderId=${order.id}`}
            className="px-4 py-2 text-sm font-medium bg-[#FF6B35] text-white rounded-lg hover:bg-orange-600"
          >
            Edit Order
          </Link>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 text-sm font-medium bg-slate-700 text-white rounded-lg hover:bg-slate-800"
          >
            Print / Save PDF
          </button>
        </div>
      </div>

      {/* A4 Preview Container */}
      <div className="max-w-[210mm] mx-auto p-8">
        <div className="bg-white shadow-lg" style={{ minHeight: '297mm' }}>
          {/* A4 Page Content */}
          <div className="p-[15mm]">
            {/* Header */}
            <div className="grid grid-cols-2 gap-8 mb-8">
              {/* Left: To Section */}
              <div>
                <h2 className="text-sm font-bold text-slate-900 mb-3 uppercase tracking-wide">To:</h2>
                <div className="space-y-1 text-sm">
                  {order.to_supplier && <p className="font-semibold">{order.to_supplier}</p>}
                  {order.contact_person && <p className="text-slate-700">{order.contact_person}</p>}
                  {order.contact_details && <p className="text-slate-600">{order.contact_details}</p>}
                </div>
                
                {order.delivery_address && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold text-slate-700 mb-1">Delivery Address:</p>
                    <p className="text-sm text-slate-600 whitespace-pre-line">{order.delivery_address}</p>
                  </div>
                )}
              </div>

              {/* Right: From Section + Logo */}
              <div className="text-right">
                {order.logo_url && (
                  <div className="mb-4 flex justify-end">
                    <img src={order.logo_url} alt="Company Logo" className="h-16 object-contain" />
                  </div>
                )}
                <h2 className="text-sm font-bold text-slate-900 mb-3 uppercase tracking-wide">From:</h2>
                <div className="space-y-1 text-sm">
                  {order.from_company && <p className="font-semibold">{order.from_company}</p>}
                </div>
              </div>
            </div>

            {/* Order Details Grid */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 mb-6 pb-6 border-b-2 border-slate-200 text-sm">
              {order.reference && (
                <>
                  <div className="font-semibold text-slate-700">Reference:</div>
                  <div className="text-slate-900">{order.reference}</div>
                </>
              )}
              {order.order_date && (
                <>
                  <div className="font-semibold text-slate-700">Order Date:</div>
                  <div className="text-slate-900">{new Date(order.order_date).toLocaleDateString()}</div>
                </>
              )}
              {order.delivery_date && (
                <>
                  <div className="font-semibold text-slate-700">Delivery Date:</div>
                  <div className="text-slate-900">{new Date(order.delivery_date).toLocaleDateString()}</div>
                </>
              )}
              {order.order_type && (
                <>
                  <div className="font-semibold text-slate-700">Order Type:</div>
                  <div className="text-slate-900">{order.order_type}</div>
                </>
              )}
              {order.colours && (
                <>
                  <div className="font-semibold text-slate-700">Colours:</div>
                  <div className="text-slate-900">{order.colours}</div>
                </>
              )}
            </div>

            {/* Line Items */}
            <div className="space-y-6">
              {lines.map((line, index) => {
                const flashing = line.flashing_id ? flashings.find(f => f.id === line.flashing_id) : null;
                
                return (
                  <div key={line.id} className="border border-slate-200 rounded-lg p-4">
                    <div className={order.layout_mode === 'double' ? 'grid grid-cols-2 gap-4' : ''}>
                      {/* Component Name */}
                      {line.show_component_name && (
                        <div className="font-semibold text-slate-900 mb-2">
                          {index + 1}. {line.item_name}
                        </div>
                      )}
                      
                      {/* Flashing Image */}
                      {line.show_flashing_image && flashing && (
                        <div className={`mb-3 ${order.layout_mode === 'single' ? 'max-w-md' : 'max-w-xs'}`}>
                          <img 
                            src={flashing.image_url} 
                            alt={flashing.name}
                            className="w-full h-auto border border-slate-200 rounded"
                          />
                        </div>
                      )}
                      
                      {/* Measurements */}
                      {line.show_measurements && (
                        <div className="text-sm text-slate-700">
                          {line.entry_mode === 'single' ? (
                            <p><strong>Quantity:</strong> {line.quantity} {line.unit}</p>
                          ) : (
                            line.lengths && (
                              <div>
                                <p className="font-semibold mb-1">Individual Lengths:</p>
                                <ul className="space-y-1">
                                  {(line.lengths as any[]).map((entry, idx) => (
                                    <li key={idx}>
                                      {entry.length} {line.length_unit} × {entry.multiplier}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )
                          )}
                        </div>
                      )}
                      
                      {/* Notes */}
                      {line.item_notes && (
                        <div className="text-sm text-slate-600 italic mt-2">
                          Note: {line.item_notes}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer Notes */}
            {order.header_notes && (
              <div className="mt-8 pt-6 border-t border-slate-200">
                <h3 className="text-sm font-semibold text-slate-900 mb-2">Order Notes:</h3>
                <p className="text-sm text-slate-700 whitespace-pre-line">{order.header_notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
