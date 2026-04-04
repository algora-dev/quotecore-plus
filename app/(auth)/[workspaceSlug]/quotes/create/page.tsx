import { redirect } from 'next/navigation';
import { requireCompanyContext } from '@/app/lib/supabase/server';
import { createQuoteFromTemplate } from '../actions';

export default async function CreateQuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ template?: string }>;
}) {
  const { workspaceSlug } = await params;
  const { template: templateId } = await searchParams;
  
  await requireCompanyContext();

  if (!templateId) {
    // No template specified, redirect to quotes list
    redirect(`/${workspaceSlug}/quotes`);
  }

  // Create quote from template with placeholder name
  const quoteId = await createQuoteFromTemplate(templateId, 'New Customer', null);

  // Redirect to quote builder where user can edit name
  redirect(`/${workspaceSlug}/quotes/${quoteId}`);
}
