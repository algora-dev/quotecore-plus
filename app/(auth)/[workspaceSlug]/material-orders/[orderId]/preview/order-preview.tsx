'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { MaterialOrderRow, MaterialOrderLineRow, FlashingLibraryRow } from '@/app/lib/types';
import { markOrderAsOrdered } from '../../order-list-actions';
import { BackButton } from '@/app/components/BackButton';

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
      {/* Back Button */}
      <div className="bg-white px-6 pt-4">
        <BackButton />
      </div>
      
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
              className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-full hover:bg-green-700 disabled:opacity-50"
            >
              {markingOrdered ? 'Updating...' : 'Mark as Ordered'}
            </button>
          )}
          <Link
            href={`/${workspaceSlug}/material-orders/create?orderId=${order.id}`}
            className="px-4 py-2 text-sm font-medium bg-[#FF6B35] text-white rounded-full hover:bg-orange-600"
          >
            Edit Order
          </Link>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 text-sm font-medium bg-slate-700 text-white rounded-full hover:bg-slate-800"
          >
            Print / Save PDF
          </button>
        </div>
      </div>

      {/* A4 Preview Container */}
      <div className="max-w-[210mm] mx-auto p-8 space-y-8">
        {/* Page 1 - Header + Start of Items */}
        <div className="bg-white shadow-lg relative" style={{ width: '210mm', height: '297mm' }}>
          {/* Page number indicator */}
          <div className="absolute top-2 right-4 text-xs text-slate-400">Page 1</div>
          
          <div className="p-[15mm] h-full flex flex-col">
            {/* Header - Three Column Layout */}
            <div className="grid grid-cols-3 gap-8 mb-6 pb-6 border-b-2 border-slate-200">
              {/* Column 1: TO Section (left-aligned) */}
              <div className="space-y-3 text-sm">
                <h2 className="text-sm font-bold text-slate-900 mb-3 uppercase tracking-wide">TO:</h2>
                {order.to_supplier && <p className="font-semibold text-slate-900">{order.to_supplier}</p>}
                {order.reference && (
                  <p className="text-slate-700">
                    <span className="font-medium">Ref:</span> {order.reference}
                  </p>
                )}
                {order.order_type && (
                  <p className="text-slate-700">
                    <span className="font-medium">Order Type:</span> {order.order_type}
                  </p>
                )}
                {order.colours && (
                  <p className="text-slate-700">
                    <span className="font-medium">Colours:</span> {order.colours}
                  </p>
                )}
                
                {order.delivery_address && (
                  <div className="mt-4">
                    <p className="font-semibold text-slate-900 uppercase text-xs mb-1">DELIVERY ADDRESS:</p>
                    <p className="text-slate-700 whitespace-pre-line">{order.delivery_address}</p>
                  </div>
                )}
                
                {order.delivery_date && (
                  <p className="text-slate-700">
                    <span className="font-medium">Delivery Date:</span> {new Date(order.delivery_date).toLocaleDateString()}
                  </p>
                )}
              </div>

              {/* Column 2: Spacer (breathing room) */}
              <div></div>

              {/* Column 3: Logo + FROM Section (left-aligned) */}
              <div className="space-y-3 text-sm">
                {/* Logo pinned to top, max height */}
                {order.logo_url && (
                  <div className="flex items-start mb-4">
                    <img src={order.logo_url} alt="Company Logo" className="max-h-16 max-w-full object-contain" />
                  </div>
                )}
                
                {/* FROM section - left-aligned */}
                <div className="space-y-2">
                  <h2 className="text-sm font-bold text-slate-900 mb-3 uppercase tracking-wide">FROM:</h2>
                  {order.from_company && <p className="font-semibold text-slate-900">{order.from_company}</p>}
                  {order.contact_person && <p className="text-slate-700">{order.contact_person}</p>}
                  {order.contact_details && <p className="text-slate-700">{order.contact_details}</p>}
                  {order.order_date && (
                    <p className="text-slate-700">
                      <span className="font-medium">Order Date:</span> {new Date(order.order_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Line Items (first few that fit) */}
            <div className={`flex-1 overflow-hidden ${order.layout_mode === 'double' ? 'grid grid-cols-2 gap-4' : 'space-y-4'}`}>
              {lines.slice(0, 3).map((line, index) => {
                const flashing = line.flashing_id ? flashings.find(f => f.id === line.flashing_id) : null;
                
                return (
                  <div key={line.id} className="border border-slate-200 rounded-lg p-4 break-inside-avoid">
                    {line.show_component_name && (
                      <div className="font-semibold text-slate-900 mb-3">
                        {index + 1}. {line.item_name}
                      </div>
                    )}
                    
                    {line.show_flashing_image && flashing && (
                      <div className="mb-3">
                        <img 
                          src={flashing.image_url} 
                          alt={flashing.name}
                          className="w-full h-auto border border-slate-200 rounded"
                        />
                      </div>
                    )}
                    
                    {line.show_measurements && (
                      <div className="text-sm text-slate-700">
                        {line.entry_mode === 'single' ? (
                          <p><strong>Quantity:</strong> {line.quantity} {line.unit}</p>
                        ) : (
                          line.lengths && (
                            <div>
                              <p className="font-semibold mb-1">LENGTHS (M):</p>
                              <ul className="space-y-1">
                                {(line.lengths as any[]).map((entry, idx) => (
                                  <li key={idx}>
                                    {entry.length}{line.length_unit} × {entry.multiplier}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )
                        )}
                      </div>
                    )}
                    
                    {line.item_notes && (
                      <div className="text-sm text-slate-600 italic mt-2">
                        Note: {line.item_notes}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Continuation Pages (if more than 3 items) */}
        {lines.length > 3 && (
          <>
            {Array.from({ length: Math.ceil((lines.length - 3) / 5) }).map((_, pageIdx) => {
              const startIdx = 3 + (pageIdx * 5);
              const pageLines = lines.slice(startIdx, startIdx + 5);
              const pageNumber = pageIdx + 2;
              
              return (
                <div key={pageIdx} className="bg-white shadow-lg relative" style={{ width: '210mm', height: '297mm' }}>
                  <div className="absolute top-2 right-4 text-xs text-slate-400">Page {pageNumber}</div>
                  
                  <div className={`p-[15mm] ${order.layout_mode === 'double' ? 'grid grid-cols-2 gap-4' : 'space-y-4'}`}>
                    {pageLines.map((line, index) => {
                      const flashing = line.flashing_id ? flashings.find(f => f.id === line.flashing_id) : null;
                      const globalIndex = startIdx + index;
                      
                      return (
                        <div key={line.id} className="border border-slate-200 rounded-lg p-4 break-inside-avoid">
                          {line.show_component_name && (
                            <div className="font-semibold text-slate-900 mb-3">
                              {globalIndex + 1}. {line.item_name}
                            </div>
                          )}
                          
                          {line.show_flashing_image && flashing && (
                            <div className="mb-3">
                              <img 
                                src={flashing.image_url} 
                                alt={flashing.name}
                                className="w-full h-auto border border-slate-200 rounded"
                              />
                            </div>
                          )}
                          
                          {line.show_measurements && (
                            <div className="text-sm text-slate-700">
                              {line.entry_mode === 'single' ? (
                                <p><strong>Quantity:</strong> {line.quantity} {line.unit}</p>
                              ) : (
                                line.lengths && (
                                  <div>
                                    <p className="font-semibold mb-1">LENGTHS (M):</p>
                                    <ul className="space-y-1">
                                      {(line.lengths as any[]).map((entry, idx) => (
                                        <li key={idx}>
                                          {entry.length}{line.length_unit} × {entry.multiplier}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )
                              )}
                            </div>
                          )}
                          
                          {line.item_notes && (
                            <div className="text-sm text-slate-600 italic mt-2">
                              Note: {line.item_notes}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* Final Page with Footer (if notes exist) */}
        {order.header_notes && (
          <div className="bg-white shadow-lg relative" style={{ width: '210mm', minHeight: '297mm' }}>
            <div className="absolute top-2 right-4 text-xs text-slate-400">
              Page {Math.ceil(lines.length / 5) + 1}
            </div>
            
            <div className="p-[15mm]">
              <div className="pt-6 border-t border-slate-200">
                <h3 className="text-sm font-semibold text-slate-900 mb-2">Order Notes:</h3>
                <p className="text-sm text-slate-700 whitespace-pre-line">{order.header_notes}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
