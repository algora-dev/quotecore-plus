import { loadOrderForEdit } from '../../create/order-loader';
import { loadFlashingLibrary } from '../../../flashings/actions';
import { OrderPreview } from './order-preview';
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
    <OrderPreview 
      order={orderData.order}
      lines={orderData.lines}
      flashings={flashings}
      workspaceSlug={workspaceSlug}
    />
  );
}
