import { loadOrderForEdit } from '../../create/order-loader';
import { loadFlashingLibrary } from '../../../flashings/actions';
import { OrderPreview } from './order-preview';
import { SupplierResponsePanel } from './SupplierResponsePanel';
import { notFound } from 'next/navigation';

interface Props {
  params: Promise<{ workspaceSlug: string; orderId: string }>;
}

export default async function OrderPreviewPage(props: Props) {
  const { workspaceSlug, orderId } = await props.params;
  
  const [orderData, flashings] = await Promise.all([
    loadOrderForEdit(orderId),
    loadFlashingLibrary(),
  ]);
  
  if (!orderData) {
    notFound();
  }

  return (
    <>
      <OrderPreview
        order={orderData.order}
        lines={orderData.lines}
        flashings={flashings}
        workspaceSlug={workspaceSlug}
      />
      {/*
        Supplier responses live OUTSIDE the A4-sized print container so
        they never end up on the printable order PDF; the panel itself
        carries the `data-exclude-pdf` marker for the in-app PDF flow.
        Wrapping div restores the page's max-width + padding because
        OrderPreview's wrapper sits inside its own min-h-screen shell.
      */}
      <div className="max-w-[210mm] mx-auto px-8 pb-8 -mt-4">
        <SupplierResponsePanel orderId={orderId} />
      </div>
    </>
  );
}
