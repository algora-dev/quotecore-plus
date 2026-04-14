import { loadOrderTemplates } from '../template-actions';
import { OrderCreateForm } from './order-create-form';

interface Props {
  params: Promise<{ workspaceSlug: string }>;
}

export default async function CreateOrderPage(props: Props) {
  const { workspaceSlug } = await props.params;
  
  const templates = await loadOrderTemplates();

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">New Material Order</h1>
        <p className="text-sm text-slate-600 mt-1">Create a custom material order from scratch</p>
      </div>

      <OrderCreateForm
        templates={templates}
      />
    </div>
  );
}
