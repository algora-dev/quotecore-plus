import { loadOrderTemplates } from '../template-actions';
import { loadFlashingLibrary } from '../../flashings/actions';
import { OrderCreateForm } from './order-create-form';
import { loadQuoteData } from './quote-loader';

interface Props {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ quoteId?: string }>;
}

export default async function CreateOrderPage(props: Props) {
  const { workspaceSlug } = await props.params;
  const { quoteId } = await props.searchParams;
  
  const [templates, flashings, quoteData] = await Promise.all([
    loadOrderTemplates(),
    loadFlashingLibrary(),
    quoteId ? loadQuoteData(quoteId) : Promise.resolve(null),
  ]);

  return (
    <div className="h-screen overflow-hidden">
      <OrderCreateForm
        templates={templates}
        flashings={flashings}
        quoteData={quoteData}
      />
    </div>
  );
}
