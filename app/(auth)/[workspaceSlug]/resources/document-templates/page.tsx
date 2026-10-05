import { requireCompanyContext } from '@/app/lib/supabase/server';
import { BackButton } from '@/app/components/BackButton';
import { loadTemplates } from '../data';
import { loadCustomerQuoteTemplates } from '../../quotes/actions';
import { loadOrderTemplates } from '../../material-orders/template-actions';
import { listInvoiceTemplates } from '../../invoices/template-actions';
import { loadAttachmentEntitlements } from '../../attachments/actions';
import { DocumentTemplateLibrary } from './DocumentTemplateLibrary';

/** Presentation aggregation only: same company-scoped stores/actions; no migration.
 * Failed sections are explicitly unavailable, never presented as an empty success.
 */
export default async function DocumentTemplatesPage({ params, searchParams }: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ type?: string; kind?: string }>;
}) {
  const { workspaceSlug } = await params;
  const { type, kind } = await searchParams;
  await requireCompanyContext();
  const entitlements = await loadAttachmentEntitlements();
  const [structures, headers, orders, invoices] = await Promise.allSettled([
    loadTemplates(), loadCustomerQuoteTemplates(), loadOrderTemplates(), listInvoiceTemplates(),
  ]);
  const errors = [
    structures.status === 'rejected' ? 'Quote structures' : null,
    headers.status === 'rejected' ? 'Quote headers' : null,
    orders.status === 'rejected' ? 'Order templates' : null,
    invoices.status === 'rejected' ? 'Invoice templates' : null,
  ].filter((value): value is string => !!value);
  return <>
    <BackButton href={`/${workspaceSlug}/resources`} label="Back to Resources" />
    <DocumentTemplateLibrary workspaceSlug={workspaceSlug}
      structures={structures.status === 'fulfilled' ? structures.value : []}
      headers={headers.status === 'fulfilled' ? headers.value : []}
      orders={orders.status === 'fulfilled' ? orders.value : []}
      invoices={invoices.status === 'fulfilled' ? invoices.value : []}
      unavailable={errors} isOverStorage={entitlements.isOverStorage}
      initialType={type === 'quote' || type === 'order' || type === 'invoice' ? type : 'all'}
      initialKind={kind === 'quote-header' || kind === 'quote-structure' ? kind : null} />
  </>;
}
