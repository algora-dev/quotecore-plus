'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { OrderLayoutPickerModal, type LayoutChoice } from '../../../../material-orders/OrderLayoutPickerModal';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { QcIcon } from '@/app/components/ui/v2/QcIcon';

/** Navigation shortcut only. Reuse the existing layout choice, then existing
 * line selector. Never create an order or change its layout in this component.
 */
export function JobOrderAction({ workspaceSlug, quoteId }: { workspaceSlug: string; quoteId: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  function choose(choice: LayoutChoice) {
    const layout = choice === 'line_by_line' ? 'line_by_line' : 'components';
    const column = choice === 'single' || choice === 'double' ? `&column=${choice}` : '';
    setOpen(false);
    router.push(`/${workspaceSlug}/material-orders/order-from-quote/${quoteId}?layout=${layout}${column}`);
  }
  return <>
    <QcButton variant="ghost" onClick={() => setOpen(true)}><QcIcon name="plus" />Create order</QcButton>
    {open && <OrderLayoutPickerModal onSelect={choose} onClose={() => setOpen(false)} />}
  </>;
}
