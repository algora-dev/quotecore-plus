import { loadOrderTemplates } from '../template-actions';
import { OrderCreateForm } from './order-create-form';

interface Props {
  params: Promise<{ workspaceSlug: string }>;
}

export default async function CreateOrderPage(props: Props) {
  const { workspaceSlug } = await props.params;
  
  const templates = await loadOrderTemplates();

  return (
    <div className="h-screen overflow-hidden">
      <OrderCreateForm
        templates={templates}
      />
    </div>
  );
}
