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
  // Await once and keep the resolved object so we can both destructure values
  // and inspect key presence (needed for H-03-R1 tamper detection below).
  const resolvedSearchParams = await searchParams;
  const { quoteId, lines, templateId } = resolvedSearchParams;

  await requireCompanyContext();

  if (!quoteId) {
    redirect(`/${workspaceSlug}/invoices`);
  }

  // H-03-R1: distinguish "?lines=" / "?lines=,,," (key present but empty/invalid)
  // from the key being absent entirely. When the `lines` key is present but
  // all tokens filter out, we pass an empty array so the action treats it as
  // an explicit-but-invalid selection and rejects instead of falling back to
  // importing all visible components.
  const linesKeyPresent = 'lines' in resolvedSearchParams;
  const selectedLineIds: string[] | undefined = linesKeyPresent
    ? (lines ?? '').split(',').filter(Boolean)
    : undefined;

  const invoiceId = await createInvoiceFromQuote(
    quoteId,
    templateId ?? undefined,
    selectedLineIds,
  );

  redirect(`/${workspaceSlug}/invoices/${invoiceId}`);
}
