import { NextResponse } from 'next/server';
import { getDocTree } from '@/app/lib/docs/tree';

/**
 * Returns the docs tree with only the data the drawer needs: section titles,
 * page slugs, page titles, and coming-soon flags. Keeps the wire payload small.
 */
export async function GET() {
  const tree = getDocTree();
  return NextResponse.json({
    root: tree.root ? {
      slug: '',
      title: tree.root.frontmatter.title,
    } : null,
    sections: tree.sections.map((s) => ({
      id: s.id,
      title: s.title,
      pages: s.pages.map((p) => ({
        slug: p.slug,
        title: p.frontmatter.title,
        status: p.frontmatter.status,
      })),
    })),
  });
}
