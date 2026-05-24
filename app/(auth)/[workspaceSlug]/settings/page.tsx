import { redirect } from 'next/navigation';

/**
 * Legacy /settings route - kept alive only as a 308 redirect to /account
 * so any stale bookmarks / shared links continue to work.
 *
 * The whole settings UI moved to /account/* as part of the sidebar
 * restructure. The components and *-actions.ts files in this directory are
 * still imported by the new pages; only the route entry point moved.
 *
 * We DO NOT preserve the old route's content. Returning a redirect from a
 * `page.tsx` is the canonical Next pattern for route-level redirects;
 * Next emits a 307/308 depending on whether the request was idempotent.
 */
export default async function LegacySettingsRedirect({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  redirect(`/${workspaceSlug}/account`);
}
