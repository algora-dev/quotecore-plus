// Generates link snapshots + link map for blog internal links (single source of truth for agents).
// Usage: node scripts/generate-blog-link-map.mjs
// Output: docs/blog-links/<slug>.md (per-article) + docs/blog-links/LINK-MAP.md (overview)
// Re-run after ANY blog content change and commit the result with that change.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'app', '(marketing)', 'blog', '[slug]', 'content');
const OUT_DIR = path.join(ROOT, 'docs', 'blog-links');
const MONEY_PAGES = new Set([
  '/roofing-quoting-software',
  '/roofing-estimating-software',
  '/construction-quoting-software',
  '/roofing-takeoff-software',
]);

const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.tsx')).sort();
const articles = [];

for (const file of files) {
  const slug = file.replace(/\.tsx$/, '');
  const src = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8');
  const links = [];
  const re = /<(a|Link)\s+href="([^"]+)"([^>]*)>([\s\S]*?)<\/\1>/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const dest = m[2];
    if (!dest.startsWith('/')) continue; // external only noted separately
    const anchor = m[4].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    links.push({ dest, anchor });
  }
  articles.push({ slug, file, links });
}

const bySlug = new Map(articles.map((a) => [a.slug, a]));
const inbounds = new Map(articles.map((a) => [a.slug, []]));
for (const a of articles) {
  for (const l of a.links) {
    const target = l.dest.replace(/^\/blog\//, '').replace(/\/$/, '');
    if (l.dest.startsWith('/blog/') && bySlug.has(target)) {
      inbounds.get(target).push({ from: a.slug, anchor: l.anchor });
    }
  }
}

fs.mkdirSync(OUT_DIR, { recursive: true });

// Per-article snapshots
for (const a of articles) {
  const external = (fs.readFileSync(path.join(CONTENT_DIR, a.file), 'utf8').match(/href="https?:\/\//g) || []).length;
  const blog = a.links.filter((l) => l.dest.startsWith('/blog/'));
  const money = a.links.filter((l) => MONEY_PAGES.has(l.dest));
  const tools = a.links.filter((l) => l.dest.startsWith('/free-') || l.dest.startsWith('/roof-takeoff') || l.dest.startsWith('/takeoff') || /^\/[a-z-]+-calculator/.test(l.dest));
  const other = a.links.filter((l) => !blog.includes(l) && !money.includes(l) && !tools.includes(l));
  const lines = [
    `# ${a.slug}`,
    '',
    `Source: \`app/(marketing)/blog/[slug]/content/${a.file}\``,
    '',
    `## Outbound internal links (${a.links.length})`,
    '',
  ];
  const section = (title, arr) => {
    if (!arr.length) return;
    lines.push(`### ${title} (${arr.length})`, '', '| Destination | Anchor |', '|---|---|');
    for (const l of arr) lines.push(`| ${l.dest} | ${l.anchor.replace(/\|/g, '\\|')} |`);
    lines.push('');
  };
  section('Money pages', money);
  section('Blog articles', blog);
  section('Free tools', tools);
  section('Other site pages', other);
  const inb = inbounds.get(a.slug);
  lines.push(`## Inbound in-article links (${inb.length})`, '');
  if (inb.length) {
    lines.push('| From | Anchor used |', '|---|---|');
    for (const i of inb) lines.push(`| /blog/${i.from} | ${i.anchor.replace(/\|/g, '\\|')} |`);
  } else {
    lines.push('_None — potential in-article orphan._');
  }
  lines.push('', `External links in source: ${external}`, '');
  fs.writeFileSync(path.join(OUT_DIR, `${a.slug}.md`), lines.join('\n'));
}

// Overview
const rows = articles.map((a) => {
  const blog = a.links.filter((l) => l.dest.startsWith('/blog/')).length;
  const money = a.links.filter((l) => MONEY_PAGES.has(l.dest)).length;
  return `| ${a.slug} | ${a.links.length} | ${blog} | ${money} | ${inbounds.get(a.slug).length} |`;
});

const orphans = articles.filter((a) => inbounds.get(a.slug).length === 0).map((a) => a.slug);
const moneyTotals = {};
for (const a of articles) for (const l of a.links) if (MONEY_PAGES.has(l.dest)) moneyTotals[l.dest] = (moneyTotals[l.dest] || 0) + 1;

const map = [
  '# Blog Internal Link Map',
  '',
  `Generated: ${new Date().toISOString().slice(0, 10)} by \`scripts/generate-blog-link-map.mjs\` — re-run after any blog content change and commit together.`,
  '',
  'Per-article snapshots live next to this file. This is the canonical record of what links to what (blog body links only).',
  '',
  '## Cluster overview',
  '',
  '| Article | Internal links out | Blog links out | Money-page links out | In-article inbounds |',
  '|---|---|---|---|---|',
  ...rows,
  '',
  '## In-article orphans (0 inbounds)',
  '',
  orphans.length ? orphans.map((s) => `- ${s}`).join('\n') : '_None._',
  '',
  '## Money-page inbound totals (from article body links)',
  '',
  ...Object.entries(moneyTotals).sort().map(([dest, n]) => `- ${dest}: ${n}`),
  ...(MONEY_PAGES.size > Object.keys(moneyTotals).length
    ? [...MONEY_PAGES].filter((p) => !moneyTotals[p]).map((p) => `- ${p}: 0`)
    : []),
  '',
  '## Agent workflow',
  '',
  '1. Editing a blog article? Read its snapshot here first — check existing anchors before adding links (no duplicate anchor→destination pairs in the same article).',
  '2. New article? Add it, link it from at least one related article, then re-run the script.',
  '3. Always re-run `node scripts/generate-blog-link-map.mjs` and commit updated snapshots with the content change.',
  '',
];
fs.writeFileSync(path.join(OUT_DIR, 'LINK-MAP.md'), map.join('\n'));

console.log(`Wrote ${articles.length} snapshots + LINK-MAP.md to docs/blog-links/`);
console.log(`Orphans: ${orphans.length ? orphans.join(', ') : 'none'}`);
