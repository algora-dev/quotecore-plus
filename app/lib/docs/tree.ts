import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

/**
 * Source of truth for the docs sidebar.
 *
 * Reads every .mdx file under content/docs at module load. We do this once at
 * build time / first request and cache it in module scope so each request
 * doesn't re-walk the filesystem.
 *
 * Slug rules:
 *  - content/docs/index.mdx                                -> ""           (root)
 *  - content/docs/getting-started/welcome.mdx              -> "getting-started/welcome"
 *  - section folders are inferred from the directory name.
 */

export interface DocFrontmatter {
  title: string;
  description: string;
  order: number;
  status: 'published' | 'coming-soon';
  updated: string;
}

export interface DocPage {
  slug: string;            // "getting-started/welcome", "" for root
  section: string;         // "getting-started", "" for root
  filePath: string;        // absolute path on disk
  frontmatter: DocFrontmatter;
}

export interface DocSection {
  id: string;              // folder name, e.g. "getting-started"
  title: string;           // human title derived from id
  pages: DocPage[];        // sorted by frontmatter.order then title
}

export interface DocTree {
  root: DocPage | null;    // index.mdx
  sections: DocSection[];  // sorted by SECTION_ORDER below
}

const DOCS_ROOT = path.join(process.cwd(), 'content', 'docs');

// Display order for sections in the sidebar. Folders not listed fall back to
// alphabetical at the bottom.
const SECTION_ORDER: string[] = [
  'getting-started',
  // Components first, then the rest of the user journey. Concepts moved
  // to the end so it acts as 'look up when stuck' reference rather than
  // 'read first' theory; Shaun spec, 2026-05-11.
  'components',
  'catalog',
  'attachments',
  'templates',
  'building-a-quote',
  'customer-facing',
  'follow-ups',
  'labor-and-installers',
  'flashings',
  'material-orders',
  'files-and-quotes',
  'account',
  'help',
  'concepts',
];

const SECTION_TITLES: Record<string, string> = {
  'getting-started': 'Getting started',
  'concepts': 'Concepts',
  'components': 'Components',
  'catalog': 'Catalog Library',
  'attachments': 'Attachments',
  'templates': 'Templates',
  'building-a-quote': 'Building a quote',
  'customer-facing': 'Customer-facing',
  'follow-ups': 'Follow-ups',
  'labor-and-installers': 'Labor & installers',
  'flashings': 'Flashings',
  'material-orders': 'Material orders',
  'files-and-quotes': 'Files & quotes',
  'account': 'Account',
  'help': 'Help',
};

let cached: DocTree | null = null;

function readDocFile(absPath: string): DocPage | null {
  const raw = fs.readFileSync(absPath, 'utf8');
  const { data } = matter(raw);
  if (!data || typeof data.title !== 'string') return null;

  const rel = path.relative(DOCS_ROOT, absPath).replace(/\\/g, '/');
  const slug = rel === 'index.mdx' ? '' : rel.replace(/\.mdx$/, '');
  const parts = slug.split('/');
  const section = slug === '' ? '' : (parts.length > 1 ? parts[0] : '');

  return {
    slug,
    section,
    filePath: absPath,
    frontmatter: {
      title: String(data.title),
      description: String(data.description ?? ''),
      order: typeof data.order === 'number' ? data.order : 999,
      status: (data.status === 'coming-soon' ? 'coming-soon' : 'published'),
      updated: String(data.updated ?? ''),
    },
  };
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip private/source folders (e.g. _trade-overlays). The underscore
      // prefix marks per-trade content variants that are served behind the
      // scenes by trade, NOT flattened into the public docs sidebar.
      if (entry.name.startsWith('_')) continue;
      out.push(...walk(full));
    } else if (entry.isFile() && entry.name.endsWith('.mdx')) {
      out.push(full);
    }
  }
  return out;
}

export function getDocTree(): DocTree {
  if (cached) return cached;

  if (!fs.existsSync(DOCS_ROOT)) {
    cached = { root: null, sections: [] };
    return cached;
  }

  const files = walk(DOCS_ROOT);
  let root: DocPage | null = null;
  const bySection = new Map<string, DocPage[]>();

  for (const f of files) {
    const page = readDocFile(f);
    if (!page) continue;
    if (page.slug === '') {
      root = page;
      continue;
    }
    if (!page.section) continue; // top-level page outside a section, ignore
    const list = bySection.get(page.section) ?? [];
    list.push(page);
    bySection.set(page.section, list);
  }

  const sections: DocSection[] = [];
  const sectionIds = Array.from(bySection.keys()).sort((a, b) => {
    const ai = SECTION_ORDER.indexOf(a);
    const bi = SECTION_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  for (const id of sectionIds) {
    const pages = (bySection.get(id) ?? []).slice().sort((a, b) => {
      if (a.frontmatter.order !== b.frontmatter.order) {
        return a.frontmatter.order - b.frontmatter.order;
      }
      return a.frontmatter.title.localeCompare(b.frontmatter.title);
    });
    sections.push({
      id,
      title: SECTION_TITLES[id] ?? humanise(id),
      pages,
    });
  }

  cached = { root, sections };
  return cached;
}

export function findDocBySlug(slug: string): DocPage | null {
  const tree = getDocTree();
  if (!slug || slug === 'index') return tree.root;
  for (const section of tree.sections) {
    const hit = section.pages.find((p) => p.slug === slug);
    if (hit) return hit;
  }
  return null;
}

export function getAllSlugs(): string[] {
  const tree = getDocTree();
  const out: string[] = [];
  if (tree.root) out.push('');
  for (const section of tree.sections) {
    for (const p of section.pages) out.push(p.slug);
  }
  return out;
}

/**
 * Lightweight search index. Built once, queried client-side via a JSON
 * payload. Keep this small - we only ship title + description + slug + section.
 */
export interface SearchEntry {
  slug: string;
  title: string;
  description: string;
  section: string;
}

export function getSearchIndex(): SearchEntry[] {
  const tree = getDocTree();
  const out: SearchEntry[] = [];
  if (tree.root) {
    out.push({
      slug: '',
      title: tree.root.frontmatter.title,
      description: tree.root.frontmatter.description,
      section: '',
    });
  }
  for (const s of tree.sections) {
    for (const p of s.pages) {
      out.push({
        slug: p.slug,
        title: p.frontmatter.title,
        description: p.frontmatter.description,
        section: s.title,
      });
    }
  }
  return out;
}

function humanise(id: string): string {
  return id.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
