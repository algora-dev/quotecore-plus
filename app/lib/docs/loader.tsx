import fs from 'fs';
import matter from 'gray-matter';
import * as runtime from 'react/jsx-runtime';
import * as devRuntime from 'react/jsx-dev-runtime';
import { evaluate, type EvaluateOptions } from '@mdx-js/mdx';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import { mdxComponents } from '@/app/components/docs/mdx-components';
import { findDocBySlug, type DocPage, type DocFrontmatter } from './tree';

/**
 * Compiled doc page ready to render.
 */
export interface LoadedDoc {
  page: DocPage;
  frontmatter: DocFrontmatter;
  /** React node from MDX evaluate, ready to drop into JSX. */
  content: React.ReactNode;
  /** Plain text body without frontmatter, used to derive the TOC. */
  rawBody: string;
}

/**
 * Compile a single MDX file using `@mdx-js/mdx`'s evaluate, which produces a
 * component bound to whichever React runtime we pass in.
 *
 * We prefer this over `next-mdx-remote/rsc` because that package currently
 * bundles its own React copy on Next 16, which trips the
 * "Element from an older version of React" prerender check.
 */
export async function loadDoc(slug: string): Promise<LoadedDoc | null> {
  const page = findDocBySlug(slug);
  if (!page) return null;

  const fileSource = fs.readFileSync(page.filePath, 'utf8');
  const { content: body, data } = matter(fileSource);

  const evalOptions = {
    ...runtime,
    ...devRuntime,
    development: false,
    remarkPlugins: [remarkGfm],
    rehypePlugins: [
      rehypeSlug,
      [rehypeAutolinkHeadings, { behavior: 'wrap' }],
    ],
  } as unknown as EvaluateOptions;

  const { default: MDXContent } = await evaluate(body, evalOptions);

  // MDXContent is a React component; render it bound to our component overrides.
  const Comp = MDXContent as React.ComponentType<{ components: typeof mdxComponents }>;
  const content = <Comp components={mdxComponents} />;

  return {
    page,
    frontmatter: {
      title: String(data.title ?? page.frontmatter.title),
      description: String(data.description ?? page.frontmatter.description),
      order: typeof data.order === 'number' ? data.order : page.frontmatter.order,
      status: data.status === 'coming-soon' ? 'coming-soon' : 'published',
      updated: String(data.updated ?? page.frontmatter.updated),
    },
    content,
    rawBody: body,
  };
}

/**
 * Extract h2/h3 headings from raw MDX for the right-side TOC.
 */
export interface TocEntry {
  depth: 2 | 3;
  text: string;
  id: string;
}

export function buildToc(rawBody: string): TocEntry[] {
  const lines = rawBody.split(/\r?\n/);
  const out: TocEntry[] = [];
  let inFence = false;

  for (const line of lines) {
    if (/^```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const m = /^(#{2,3})\s+(.+?)\s*$/.exec(line);
    if (!m) continue;
    const depth = m[1].length === 2 ? 2 : 3;
    const text = m[2].replace(/`([^`]+)`/g, '$1').trim();
    if (!text) continue;
    out.push({
      depth: depth as 2 | 3,
      text,
      id: slugify(text),
    });
  }
  return out;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
