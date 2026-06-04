import { loadOrderTemplates } from '../template-actions';
import { loadFlashingLibrary } from '../../flashings/actions';
import { loadComponentLibrary, loadComponentCollections } from '../../components/actions';
import { OrderCreateForm } from './order-create-form';
import { loadQuoteData } from './quote-loader';
import { loadOrderForEdit } from './order-loader';
import { requireCompanyContext, createSupabaseServerClient } from '@/app/lib/supabase/server';
import { loadCompanyEntitlements } from '@/app/lib/billing/entitlements';

interface Props {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ quoteId?: string; orderId?: string; layout?: string; column?: string }>;
}

export default async function CreateOrderPage(props: Props) {
  const { workspaceSlug: _workspaceSlug } = await props.params;
  const { quoteId, orderId, layout, column } = await props.searchParams;
  
  
  // Run diagnostic test if quoteId present
  if (quoteId) {
  }
  
  const profile = await requireCompanyContext();
  const [templates, flashings, components, collections, quoteData, existingOrder, ent] = await Promise.all([
    loadOrderTemplates(),
    loadFlashingLibrary(),
    loadComponentLibrary(),
    loadComponentCollections(),
    quoteId ? loadQuoteData(quoteId) : Promise.resolve(null),
    orderId ? loadOrderForEdit(orderId) : Promise.resolve(null),
    loadCompanyEntitlements(profile.company_id),
  ]);
  

  // Layout family is chosen up front (orders hub picker) and locked for the
  // life of the order. When editing an existing order, its saved layout_mode
  // wins. 'line_by_line' = customer-quote-style editor; otherwise the
  // Components + Images editor (single/double toggle lives inside it).
  const savedLayout = existingOrder?.order?.layout_mode;
  const initialLayout: 'line_by_line' | 'components' =
    (savedLayout === 'line_by_line' || (!savedLayout && layout === 'line_by_line'))
      ? 'line_by_line'
      : 'components';

  // Column mode for the Components editor. Editing an existing order: use its
  // saved layout_mode (single/double). New order: from the picker's `column`.
  const initialColumn: 'single' | 'double' =
    savedLayout === 'double' || (!savedLayout && column === 'double') ? 'double' : 'single';

  // Company currency for line-by-line price rendering.
  const supabase = await createSupabaseServerClient();
  const { data: companyRow } = await supabase
    .from('companies')
    .select('default_currency')
    .eq('id', profile.company_id)
    .maybeSingle();
  const currency = companyRow?.default_currency ?? 'GBP';

  return (
    <div className="h-screen overflow-hidden">
      <OrderCreateForm
        templates={templates}
        flashings={flashings}
        components={(components ?? []).map((c) => ({ id: c.id as string, name: c.name as string, collection_id: (c.collection_id as string | null) ?? null }))}
        collections={(collections ?? []).map((c) => ({ id: c.id as string, name: c.name as string }))}
        workspaceSlug={_workspaceSlug}
        quoteData={quoteData}
        existingOrder={existingOrder}
        isOverStorage={ent.isOverStorage}
        initialLayout={initialLayout}
        initialColumn={initialColumn}
        currency={currency}
      />
    </div>
  );
}
