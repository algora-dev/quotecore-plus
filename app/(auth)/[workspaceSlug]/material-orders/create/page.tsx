import { loadOrderTemplates } from '../template-actions';
import { loadFlashingLibrary } from '../../flashings/actions';
import { loadComponentLibrary } from '../../components/actions';
import { OrderCreateForm } from './order-create-form';
import { loadQuoteData } from './quote-loader';
import { loadOrderForEdit } from './order-loader';
import { requireCompanyContext } from '@/app/lib/supabase/server';
import { loadCompanyEntitlements } from '@/app/lib/billing/entitlements';

interface Props {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ quoteId?: string; orderId?: string }>;
}

export default async function CreateOrderPage(props: Props) {
  const { workspaceSlug: _workspaceSlug } = await props.params;
  const { quoteId, orderId } = await props.searchParams;
  
  
  // Run diagnostic test if quoteId present
  if (quoteId) {
  }
  
  const profile = await requireCompanyContext();
  const [templates, flashings, components, quoteData, existingOrder, ent] = await Promise.all([
    loadOrderTemplates(),
    loadFlashingLibrary(),
    loadComponentLibrary(),
    quoteId ? loadQuoteData(quoteId) : Promise.resolve(null),
    orderId ? loadOrderForEdit(orderId) : Promise.resolve(null),
    loadCompanyEntitlements(profile.company_id),
  ]);
  

  return (
    <div className="h-screen overflow-hidden">
      <OrderCreateForm
        templates={templates}
        flashings={flashings}
        components={(components ?? []).map((c) => ({ id: c.id as string, name: c.name as string }))}
        workspaceSlug={_workspaceSlug}
        quoteData={quoteData}
        existingOrder={existingOrder}
        isOverStorage={ent.isOverStorage}
      />
    </div>
  );
}
