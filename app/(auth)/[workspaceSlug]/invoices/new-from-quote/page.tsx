/**
 * Server-side redirect page that creates an invoice from a quote with
 * pre-selected lines, then redirects to the new invoice editor.
 *
 * URL shape:  /[workspaceSlug]/invoices/new-from-quote?quoteId=<id>&lines=id1,id2,...
 */
import { redirect } from 'next/navigation';
import { requireCompanyContext } from '@/app/lib/supabase/server';
import { createInvoiceFromQuote } from '../actions';

interface Props {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ quoteId?: string; lines?: string; templateId?: string }>;
}

export default async function NewFromQuotePage({ params, searchParams }: Props) {
  const { workspaceSlug } = await params;
  const { quoteId, lines, templateId } = await searchParams;

  await requireCompanyContext();

  if (!quoteId) {
    redirect(`/${workspaceSlug}/invoices`);
  }

  const selectedLineIds = lines ? lines.split(',').filter(Boolean) : undefined;

  const invoiceId = await createInvoiceFromQuote(
    quoteId,
    templateId ?? undefined,
    selectedLineIds,
  );

  redirect(`/${workspaceSlug}/invoices/${invoiceId}`);
}
