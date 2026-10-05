import { redirect } from 'next/navigation';

/** P8-D02: retire the unused creator without breaking saved links.
 * No template is created and no legacy server action runs on this route.
 * Owner direction 2026-09-28: /resources/new lands on the Resources hub
 * (the legacy New Template creator is retired; creation lives in the hub).
 */
export default async function NewTemplatePage({ params }: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  redirect(`/${workspaceSlug}/resources`);
}
