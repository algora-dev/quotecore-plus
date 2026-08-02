const fs = require('fs');
const pages = ['digital-roof-takeoff', 'smart-components', 'material-ordering', 'invoicing', 'supplier-resources'];
const base = 'C:/Users/Jimmy/.openclaw/workspace-ron/projects/quotecore-nz/app/features';

for (const page of [...pages, '']) {
  const filePath = page ? `${base}/${page}/page.tsx` : `${base}/page.tsx`;
  let content = fs.readFileSync(filePath, 'utf8');
  // Fix import - only import what's used. Pages define their own breadcrumbSchema const.
  content = content.replace('import { site, absoluteUrl, breadcrumbSchema } from "@/lib/seo";', 'import { site } from "@/lib/seo";');
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Fixed import: ${page || 'hub'}`);
}
