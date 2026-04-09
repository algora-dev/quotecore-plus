import { requireCompanyContext } from '@/app/lib/supabase/server';
import { loadQuote, loadQuoteRoofAreas, loadQuoteComponents, loadCustomerQuoteLines } from '../../actions';
import { LaborSheetPreview } from './LaborSheetPreview';

export default async function LaborSheetPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; id: string }>;
}) {
  const { workspaceSlug, id } = await params;
  await requireCompanyContext();

  const [quote, roofAreas, components, savedLines] = await Promise.all([
    loadQuote(id),
    loadQuoteRoofAreas(id),
    loadQuoteComponents(id),
    loadCustomerQuoteLines(id),
  ]);

  return <LaborSheetPreview quote={quote} roofAreas={roofAreas} components={components} savedLines={savedLines} workspaceSlug={workspaceSlug} />;
}
