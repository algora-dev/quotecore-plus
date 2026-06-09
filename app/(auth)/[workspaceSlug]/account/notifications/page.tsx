import { redirect } from 'next/navigation';

/**
 * Legacy redirect shim. The per-user email-alerts master has moved into the
 * Message Center (per-event email toggles), so this now points at the inbox.
 */
export default async function NotificationsRedirectPage(props: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await props.params;
  redirect(`/${workspaceSlug}/inbox`);
}
