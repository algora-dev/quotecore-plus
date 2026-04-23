import { loadOrderTemplates } from './template-actions';
import { loadRecentOrders } from './order-list-actions';
import { MaterialOrdersHub } from './orders-hub';

interface Props {
  params: Promise<{ workspaceSlug: string }>;
}

export default async function MaterialOrdersPage(props: Props) {
  const { workspaceSlug } = await props.params;
  
  const [templates, recentOrders] = await Promise.all([
    loadOrderTemplates(),
    loadRecentOrders(),
  ]);

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Material Orders</h1>
        <p className="text-sm text-slate-500 mt-1">Create orders, manage suppliers, and track deliveries.</p>
      </div>

      <MaterialOrdersHub 
        workspaceSlug={workspaceSlug}
        initialTemplates={templates}
        recentOrders={recentOrders}
      />
    </section>
  );
}
