'use client';
import { useMemo } from 'react';
import Link from 'next/link';
import type { QuoteRow, QuoteRoofAreaRow, QuoteComponentRow, CustomerQuoteTemplateRow } from '@/app/lib/types';
import { CustomerQuoteEditor } from '../customer-edit/CustomerQuoteEditor';

interface Props {
  quote: QuoteRow;
  roofAreas: QuoteRoofAreaRow[];
  components: QuoteComponentRow[];
  savedLines: any[];
  templates: CustomerQuoteTemplateRow[];
  workspaceSlug: string;
  currency: string;
  defaultLogoUrl: string | null;
}

export function LaborSheetEditorWrapper({ 
  quote, 
  roofAreas, 
  components: allComponents, 
  savedLines, 
  templates, 
  workspaceSlug, 
  currency, 
  defaultLogoUrl 
}: Props) {
  // Transform components to show only labor costs (set material to 0)
  const laborOnlyComponents = useMemo(() => {
    return allComponents.map(c => ({
      ...c,
      material_cost: 0, // Zero out material costs
      // Keep labor costs as-is
    }));
  }, [allComponents]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-4">
          <Link
            href={`/${workspaceSlug}/quotes/${quote.id}`}
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            ← Back to Quote
          </Link>
        </div>
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Labor Sheet</h1>
          <p className="text-sm text-slate-600 mt-1">
            Quote #{quote.quote_number || 'DRAFT'} • {quote.customer_name}
          </p>
        </div>
        
        <CustomerQuoteEditor
          quote={quote}
          roofAreas={roofAreas}
          components={laborOnlyComponents}
          savedLines={savedLines}
          templates={templates}
          workspaceSlug={workspaceSlug}
          currency={currency}
          defaultLogoUrl={defaultLogoUrl}
        />
      </div>
    </div>
  );
}
