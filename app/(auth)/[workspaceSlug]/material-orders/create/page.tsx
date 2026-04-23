import { loadOrderTemplates } from '../template-actions';
import { loadFlashingLibrary } from '../../flashings/actions';
import { OrderCreateForm } from './order-create-form';
import { loadQuoteData } from './quote-loader';
import { loadOrderForEdit } from './order-loader';

interface Props {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ quoteId?: string; orderId?: string }>;
}

export default async function CreateOrderPage(props: Props) {
  const { workspaceSlug } = await props.params;
  const { quoteId, orderId } = await props.searchParams;
  
  
  // Run diagnostic test if quoteId present
  if (quoteId) {
  }
  
  const [templates, flashings, quoteData, existingOrder] = await Promise.all([
    loadOrderTemplates(),
    loadFlashingLibrary(),
    quoteId ? loadQuoteData(quoteId) : Promise.resolve(null),
    orderId ? loadOrderForEdit(orderId) : Promise.resolve(null),
  ]);
  

  return (
    <div className="h-screen overflow-hidden">
      <OrderCreateForm
        templates={templates}
        flashings={flashings}
        quoteData={quoteData}
        existingOrder={existingOrder}
      />
    </div>
  );
}
