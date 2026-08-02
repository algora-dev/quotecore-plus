const fs = require('fs');
const path = require('path');

const pages = [
  'digital-roof-takeoff',
  'smart-components',
  'material-ordering',
  'invoicing',
  'supplier-resources',
];

const base = 'C:/Users/Jimmy/.openclaw/workspace-ron/projects/quotecore-nz/app/features';

for (const page of [...pages, '']) {
  const filePath = page ? `${base}/${page}/page.tsx` : `${base}/page.tsx`;
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Remove hreflang import line
  content = content.replace(/import \{ hreflangLanguages \} from "@\/lib\/seo\/hreflang";\r?\n/g, '');
  
  // Fix quote-core.com to quote-core.co.nz
  content = content.replace(/https:\/\/quote-core\.com/g, 'https://www.quote-core.co.nz');
  
  // Fix alternates: remove languages line
  content = content.replace(/,\r?\n\s*languages: hreflangLanguages\("\/features[^"]*"\),/g, ',');
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Fixed: ${page || 'hub'}`);
}
