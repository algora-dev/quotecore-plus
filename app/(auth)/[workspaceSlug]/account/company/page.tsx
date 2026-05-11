import { redirect } from 'next/navigation';

/**
 * Legacy redirect shim. The Company experience now lives at
 * `/account?tab=company` inside the unified tabbed Account page. Anyone
 * landing here via an old bookmark or external link gets forwarded.
 */
export default async function CompanyRedirectPage(props: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await props.params;
  redirect(`/${workspaceSlug}/account?tab=company`);
}
