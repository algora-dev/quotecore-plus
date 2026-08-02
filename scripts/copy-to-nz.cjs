const fs = require('fs');
const path = require('path');

const pages = [
  'digital-roof-takeoff',
  'smart-components',
  'material-ordering',
  'invoicing',
  'supplier-resources',
];

const srcBase = 'C:/Users/Jimmy/.openclaw/workspace-ron/projects/quotecore-plus/app/(marketing)/features';
const dstBase = 'C:/Users/Jimmy/.openclaw/workspace-ron/projects/quotecore-nz/app/features';

for (const page of pages) {
  let content = fs.readFileSync(`${srcBase}/${page}/page.tsx`, 'utf8');
  
  // Fix imports
  content = content.replace('import { SITE_URL } from "@/lib/seo/site-url";', 'import { site, absoluteUrl, breadcrumbSchema } from "@/lib/seo";');
  content = content.replace(/import \{ hreflangLanguages \} from "@\/lib\/seo\/hreflang";\n/g, '');
  
  // Fix SITE_URL references → site.url
  content = content.replace(/SITE_URL/g, 'site.url');
  
  // Remove hreflang from alternates
  content = content.replace(/,\n\s*languages: hreflangLanguages\("\/features\/[^"]*"\),/g, ',');
  content = content.replace(/,\n\s*languages: hreflangLanguages\("\/features"\),/g, ',');
  
  // Fix canonical URLs
  content = content.replace(/https:\/\/quote-core\.com/g, 'https://www.quote-core.co.nz');
  
  // Fix openGraph URLs
  // Already handled by the quote-core.com replacement above
  
  // Write to NZ site
  fs.writeFileSync(`${dstBase}/${page}/page.tsx`, content, 'utf8');
  console.log(`Adapted: ${page}`);
}

// Now handle the features hub page
let hub = fs.readFileSync(`${srcBase}/page.tsx`, 'utf8');
hub = hub.replace('import { SITE_URL } from "@/lib/seo/site-url";', 'import { site, absoluteUrl, breadcrumbSchema } from "@/lib/seo";');
hub = hub.replace(/import \{ hreflangLanguages \} from "@\/lib\/seo\/hreflang";\n/g, '');
hub = hub.replace(/SITE_URL/g, 'site.url');
hub = hub.replace(/,\n\s*languages: hreflangLanguages\("\/features"\),/g, ',');
hub = hub.replace(/https:\/\/quote-core\.com/g, 'https://www.quote-core.co.nz');
fs.writeFileSync(`${dstBase}/page.tsx`, hub, 'utf8');
console.log('Adapted: features hub');
