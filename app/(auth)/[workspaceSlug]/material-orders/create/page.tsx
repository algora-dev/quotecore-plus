import { loadOrderTemplates } from '../template-actions';
import { loadFlashingLibrary } from '../../flashings/actions';
import { OrderCreateForm } from './order-create-form';
import { loadQuoteData } from './quote-loader';
import { testQuoteQuery } from './test-query';

interface Props {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ quoteId?: string }>;
}

export default async function CreateOrderPage(props: Props) {
  const { workspaceSlug } = await props.params;
  const { quoteId } = await props.searchParams;
  
  console.log('[CreateOrderPage] quoteId:', quoteId);
  
  // Run diagnostic test if quoteId present
  if (quoteId) {
    const testResults = await testQuoteQuery(quoteId);
    console.log('[CreateOrderPage] Test results:', testResults);
  }
  
  const [templates, flashings, quoteData] = await Promise.all([
    loadOrderTemplates(),
    loadFlashingLibrary(),
    quoteId ? loadQuoteData(quoteId) : Promise.resolve(null),
  ]);
  
  console.log('[CreateOrderPage] quoteData loaded:', quoteData ? `${quoteData.quote_number} with ${quoteData.components.length} components` : 'null');

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
