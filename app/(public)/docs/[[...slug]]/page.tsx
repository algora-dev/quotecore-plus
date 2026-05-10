import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { loadDoc, buildToc } from '@/app/lib/docs/loader';
import { getAllSlugs, getDocTree } from '@/app/lib/docs/tree';
import { DocsToc } from '@/app/components/docs/DocsToc';

interface Props {
  params: Promise<{ slug?: string[] }>;
}

export const dynamicParams = false; // every slug is generated at build time

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({
    slug: slug === '' ? [] : slug.split('/'),
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const slugStr = (slug ?? []).join('/');
  const doc = await loadDoc(slugStr);
  if (!doc) return { title: 'Not found - QuoteCore+ docs' };
  return {
    title: `${doc.frontmatter.title} - QuoteCore+ docs`,
    description: doc.frontmatter.description,
  };
}

export default async function DocPage({ params }: Props) {
  const { slug } = await params;
  const slugStr = (slug ?? []).join('/');
  const doc = await loadDoc(slugStr);
  if (!doc) notFound();

  const toc = buildToc(doc.rawBody);
  const tree = getDocTree();

  // Build prev/next from the flat ordered list of pages.
  const flat: { slug: string; title: string }[] = [];
  if (tree.root) flat.push({ slug: '', title: tree.root.frontmatter.title });
  for (const s of tree.sections) {
    for (const p of s.pages) flat.push({ slug: p.slug, title: p.frontmatter.title });
  }
  const i = flat.findIndex((p) => p.slug === slugStr);
  const prev = i > 0 ? flat[i - 1] : null;
  const next = i >= 0 && i < flat.length - 1 ? flat[i + 1] : null;

  // Breadcrumb. Section title resolved via tree.
  const sectionId = doc.page.section;
  const section = tree.sections.find((s) => s.id === sectionId);

  return (
    <div className="lg:flex lg:gap-10">
      <article className="min-w-0 flex-1">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-4 text-xs text-slate-500">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li><Link href="/docs" className="hover:text-slate-700">Docs</Link></li>
            {section ? (
              <>
                <li aria-hidden>/</li>
                <li className="text-slate-700">{section.title}</li>
              </>
            ) : null}
          </ol>
        </nav>

        {doc.frontmatter.status === 'coming-soon' ? (
          <div className="mb-6 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
            This feature is coming soon. The doc is here so you know what to expect.
          </div>
        ) : null}

        <header className="mb-8 border-b border-slate-200 pb-6">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{doc.frontmatter.title}</h1>
          {doc.frontmatter.description ? (
            <p className="mt-2 text-lg text-slate-600">{doc.frontmatter.description}</p>
          ) : null}
        </header>

        <div className="docs-prose">
          {doc.content}
        </div>

        {/* Prev / next */}
        {(prev || next) ? (
          <div className="mt-12 grid gap-3 border-t border-slate-200 pt-6 sm:grid-cols-2">
            <div>
              {prev ? (
                <Link href={`/docs/${prev.slug}`} className="block rounded-lg border border-slate-200 p-3 hover:border-slate-300 hover:bg-slate-50">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Previous</p>
                  <p className="text-sm font-semibold text-slate-900">{prev.title}</p>
                </Link>
              ) : null}
            </div>
            <div className="sm:text-right">
              {next ? (
                <Link href={`/docs/${next.slug}`} className="block rounded-lg border border-slate-200 p-3 hover:border-slate-300 hover:bg-slate-50">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Next</p>
                  <p className="text-sm font-semibold text-slate-900">{next.title}</p>
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}

        <p className="mt-10 text-xs text-slate-400">Last updated: {doc.frontmatter.updated}</p>
      </article>

      <aside className="hidden xl:block xl:w-56 xl:flex-shrink-0">
        <div className="sticky top-20">
          <DocsToc entries={toc} />
        </div>
      </aside>
    </div>
  );
}
