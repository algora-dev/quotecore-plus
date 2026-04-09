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
    <CustomerQuoteEditor
          quote={quote}
          roofAreas={roofAreas}
          components={laborOnlyComponents}
          savedLines={savedLines}
          templates={templates}
          workspaceSlug={workspaceSlug}
          currency={currency}
          defaultLogoUrl={defaultLogoUrl}
          disableAutoSave={false}
          editorTitle="Labor Sheet Editor"
          previewTitle="Labor Sheet Preview"
          includeMargins={false}
        />
  );
}
