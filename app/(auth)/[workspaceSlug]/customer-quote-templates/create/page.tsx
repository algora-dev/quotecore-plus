import { redirect } from 'next/navigation';
import { requireCompanyContext } from '@/app/lib/supabase/server';

export default async function CreateTemplatePage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ name?: string }>;
}) {
  const { workspaceSlug } = await params;
  await requireCompanyContext();
  const { name } = await searchParams;
  const nameParam = name ? `?name=${encodeURIComponent(name)}` : '';
  redirect(`/${workspaceSlug}/customer-quote-templates/create/build${nameParam}`);
}
