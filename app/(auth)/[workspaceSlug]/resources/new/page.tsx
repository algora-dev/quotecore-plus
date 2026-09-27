import { redirect } from 'next/navigation';

/** P8-D02: retire the unused creator without breaking saved links.
 * No template is created and no legacy server action runs on this route.
 */
export default async function NewTemplatePage({ params }: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  redirect(`/${workspaceSlug}/resources/document-templates`);
}
