import { loadOrderTemplates } from './template-actions';
import { loadRecentOrders } from './order-list-actions';
import { MaterialOrdersHub } from './orders-hub';
import { BackButton } from '@/app/components/BackButton';

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
    <div className="p-6 max-w-7xl mx-auto">
      <BackButton />
      
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Material Orders</h1>
        <p className="text-sm text-slate-600 mt-1">Create orders, manage supplier templates, and track deliveries</p>
      </div>

      <MaterialOrdersHub 
        workspaceSlug={workspaceSlug}
        initialTemplates={templates}
        recentOrders={recentOrders}
      />
    </div>
  );
}
