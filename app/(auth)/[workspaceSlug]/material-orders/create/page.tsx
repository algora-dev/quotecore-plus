import { loadOrderTemplates } from '../template-actions';
import { loadFlashingLibrary } from '../../flashings/actions';
import { OrderCreateForm } from './order-create-form';

interface Props {
  params: Promise<{ workspaceSlug: string }>;
}

export default async function CreateOrderPage(props: Props) {
  const { workspaceSlug } = await props.params;
  
  const [templates, flashings] = await Promise.all([
    loadOrderTemplates(),
    loadFlashingLibrary(),
  ]);

  return (
    <div className="h-screen overflow-hidden">
      <OrderCreateForm
        templates={templates}
        flashings={flashings}
      />
    </div>
  );
}
