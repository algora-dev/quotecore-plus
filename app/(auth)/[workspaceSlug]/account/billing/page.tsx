import { redirect } from 'next/navigation';

/**
 * Legacy redirect shim. See ../page.tsx for the unified tabbed implementation.
 */
export default async function BillingRedirectPage(props: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await props.params;
  redirect(`/${workspaceSlug}/account?tab=billing`);
}
