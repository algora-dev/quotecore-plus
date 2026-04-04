import { redirect } from 'next/navigation';

export default async function CreateQuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ template?: string }>;
}) {
  const { workspaceSlug } = await params;
  const { template: templateId } = await searchParams;
  
  // Redirect to new job details form
  // Preserve template param if provided
  const url = `/${workspaceSlug}/quotes/new${templateId ? `?template=${templateId}` : ''}`;
  redirect(url);
}
