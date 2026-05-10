import { NextResponse } from 'next/server';
import { loadDoc } from '@/app/lib/docs/loader';
import { getDocTree } from '@/app/lib/docs/tree';

export const runtime = 'nodejs';

/**
 * Internal endpoint that returns rendered HTML for a single doc page.
 *
 * react-dom/server is loaded via createRequire to avoid Turbopack's static
 * "no react-dom/server in route handlers" check; the runtime import is fine
 * because this route always executes in Node.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug?: string[] }> }
) {
  const { slug } = await params;
  const slugStr = (slug ?? []).join('/');

  const doc = await loadDoc(slugStr);
  if (!doc) {
    return NextResponse.json({ error: 'not-found' }, { status: 404 });
  }

  // Dynamic require avoids Turbopack's static-analysis ban on importing
  // react-dom/server from a route handler. We're in nodejs runtime so this
  // is safe at runtime.
  const { createRequire } = await import('module');
  const req = createRequire(import.meta.url);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const reactDomServer: typeof import('react-dom/server') = req('react-dom/server');
  const html = reactDomServer.renderToStaticMarkup(doc.content as any);

  const tree = getDocTree();

  return NextResponse.json({
    slug: doc.page.slug,
    section: doc.page.section,
    sectionTitle: tree.sections.find((s) => s.id === doc.page.section)?.title ?? '',
    title: doc.frontmatter.title,
    description: doc.frontmatter.description,
    status: doc.frontmatter.status,
    updated: doc.frontmatter.updated,
    html,
  });
}
