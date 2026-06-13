import { redirect } from 'next/navigation';

/**
 * Redirect shim - preserves old /[slug]/templates* bookmarks and deep-links.
 * Redirects to the equivalent /[slug]/resources path with the same
 * sub-path segments and query string intact.
 */
export default async function TemplatesRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string; rest?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { workspaceSlug, rest } = await params;
  const sp = await searchParams;

  const restPath = rest && rest.length > 0 ? `/${rest.join('/')}` : '';

  const qs = new URLSearchParams();
  for (const [key, val] of Object.entries(sp)) {
    if (typeof val === 'string') qs.set(key, val);
    else if (Array.isArray(val)) val.forEach(v => qs.append(key, v));
  }
  const qsString = qs.toString();

  redirect(`/${workspaceSlug}/resources${restPath}${qsString ? `?${qsString}` : ''}`);
}
