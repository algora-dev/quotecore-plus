import { redirect } from 'next/navigation';

/** Phase 7: preserve bookmarked list URLs; the existing create/edit routes remain. */
export default async function LegacyTemplateList({ params }: { params: Promise<{ workspaceSlug: string }> }) {
  const { workspaceSlug } = await params;
  redirect(`/${workspaceSlug}/resources/document-templates?type=order`);
}
