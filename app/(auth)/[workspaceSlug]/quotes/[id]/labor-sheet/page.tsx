import { redirect } from 'next/navigation';
import { loadQuote, loadQuoteComponents } from '../../actions';
import { LaborSheetEditor } from './LaborSheetEditor';

export default async function LaborSheetPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; id: string }>;
}) {
  const { workspaceSlug, id } = await params;
  
  const quote = await loadQuote(id);
  const components = await loadQuoteComponents(id);
  
  // Filter to only components with labor costs
  const laborComponents = components.filter(c => (c.labour_cost || 0) > 0);
  
  return (
    <LaborSheetEditor
      quote={quote}
      components={laborComponents}
      workspaceSlug={workspaceSlug}
    />
  );
}
