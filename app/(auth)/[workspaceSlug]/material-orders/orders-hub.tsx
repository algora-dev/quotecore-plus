'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { MaterialOrderTemplateRow, MaterialOrderRow } from '@/app/lib/types';
import { OrderList } from './order-list';
import { OrderLayoutPickerModal } from './OrderLayoutPickerModal';

interface Props {
  workspaceSlug: string;
  initialTemplates: MaterialOrderTemplateRow[];
  recentOrders: MaterialOrderRow[];
}

export function MaterialOrdersHub({ workspaceSlug, initialTemplates, recentOrders }: Props) {
  const router = useRouter();
  // Which entry point opened the layout picker: 'custom' -> blank create,
  // 'from-quote' -> quote selector first. null = picker closed.
  const [pickerFor, setPickerFor] = useState<'custom' | 'from-quote' | null>(null);

  const handleLayoutSelected = (choice: 'line_by_line' | 'single' | 'double') => {
    // 3 cards -> 2 layout families. Single/Double both use the 'components'
    // editor, pre-set to that column via the `column` param.
    const layout = choice === 'line_by_line' ? 'line_by_line' : 'components';
    const columnParam = choice === 'single' || choice === 'double' ? `&column=${choice}` : '';
    const base =
      pickerFor === 'from-quote'
        ? `/${workspaceSlug}/material-orders/order-from-quote`
        : `/${workspaceSlug}/material-orders/create`;
    setPickerFor(null);
    router.push(`${base}?layout=${layout}${columnParam}`);
  };

  return (
    <div className="space-y-6">
      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" data-copilot="mo-action-cards">
        {/* Create Custom Order */}
        <button
          type="button"
          onClick={() => setPickerFor('custom')}
          data-copilot="mo-custom-order"
          className="block w-full text-left p-6 bg-white border-2 border-slate-200 rounded-xl hover:border-[#FF6B35] hover:shadow-lg transition-all group"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-full bg-orange-50 group-hover:bg-orange-100 transition-colors">
              <svg className="w-6 h-6 text-[#FF6B35]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 mb-1">Custom Order</h3>
              <p className="text-sm text-slate-600">Start from scratch with a blank order form</p>
            </div>
          </div>
        </button>

        {/* Order from Quote */}
        <button
          type="button"
          onClick={() => setPickerFor('from-quote')}
          data-copilot="mo-order-from-quote"
          className="block w-full text-left p-6 bg-white border-2 border-slate-200 rounded-xl hover:border-[#FF6B35] hover:shadow-lg transition-all group"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-full bg-orange-50 group-hover:bg-orange-100 transition-colors">
              <svg className="w-6 h-6 text-[#FF6B35]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 mb-1">Order from Quote</h3>
              <p className="text-sm text-slate-600">Pre-populate with data from an existing quote</p>
            </div>
          </div>
        </button>

        {/* Order Templates - managed in Resource Library */}
        <button
          onClick={() => router.push(`/${workspaceSlug}/resources?tab=order`)}
          className="block w-full p-6 bg-white border-2 border-slate-200 rounded-xl hover:border-[#FF6B35] hover:shadow-lg transition-all group text-left"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-full bg-slate-100 group-hover:bg-slate-200 transition-colors">
              <svg className="w-6 h-6 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 mb-1">Order Templates</h3>
              <p className="text-sm text-slate-600">Manage reusable supplier info ({initialTemplates.length} saved)</p>
            </div>
          </div>
        </button>
      </div>

      {pickerFor && (
        <OrderLayoutPickerModal
          onSelect={handleLayoutSelected}
          onClose={() => setPickerFor(null)}
        />
      )}

      {/* Recent Orders Section */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="font-semibold text-slate-900 mb-4">Recent Orders</h2>
        <OrderList orders={recentOrders} workspaceSlug={workspaceSlug} />
      </div>


    </div>
  );
}
