import { NextResponse } from 'next/server';
import { getDocTree, getSearchIndex } from '@/app/lib/docs/tree';

/**
 * Returns the docs tree with only the data the drawer needs: section titles,
 * page slugs, page titles, and coming-soon flags. Keeps the wire payload small.
 *
 * Also ships a `searchIndex` so the in-app help drawer can run client-side
 * fuzzy search without a second round-trip. The index is ~title + description
 * + section per page - still small, but enough to be useful.
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
    searchIndex: getSearchIndex(),
  });
}
