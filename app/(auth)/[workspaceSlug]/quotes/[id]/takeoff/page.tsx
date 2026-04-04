import { requireCompanyContext } from '@/app/lib/supabase/server';
import { TakeoffPage } from './TakeoffPage';

export default async function Page({
  params,
}: {
  params: Promise<{ workspaceSlug: string; id: string }>;
}) {
  const { workspaceSlug, id: quoteId } = await params;
  await requireCompanyContext();

  return (
    <TakeoffPage
      workspaceSlug={workspaceSlug}
      quoteId={quoteId}
    />
  );
}
