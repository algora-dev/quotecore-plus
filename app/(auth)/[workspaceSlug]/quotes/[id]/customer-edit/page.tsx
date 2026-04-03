import { requireCompanyContext } from '@/app/lib/supabase/server';
import { loadQuote, loadQuoteRoofAreas, loadQuoteComponents } from '../../actions';
import { CustomerQuoteEditor } from './CustomerQuoteEditor';

export default async function CustomerQuoteEditPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; id: string }>;
}) {
  const { workspaceSlug, id } = await params;
  await requireCompanyContext();

  const [quote, roofAreas, components] = await Promise.all([
    loadQuote(id),
    loadQuoteRoofAreas(id),
    loadQuoteComponents(id),
  ]);

  return (
    <CustomerQuoteEditor
      quote={quote}
      roofAreas={roofAreas}
      components={components}
      workspaceSlug={workspaceSlug}
    />
  );
}
