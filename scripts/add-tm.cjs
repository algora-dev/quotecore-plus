const fs = require('fs');
const TM = '\u2122';
const files = [
  'app/(marketing)/features/smart-components/page.tsx',
  'app/(marketing)/features/digital-roof-takeoff/page.tsx',
  'app/(marketing)/features/material-ordering/page.tsx',
  'app/(marketing)/features/invoicing/page.tsx',
  'app/(marketing)/features/supplier-resources/page.tsx',
  'app/(marketing)/features/page.tsx',
];

for (const f of files) {
  let c = fs.readFileSync(f, 'utf8');
  
  // JSX text content: >...Smart Components...<
  c = c.replace(/(>)([^<]*?)Smart Components([^<]*?)(<)/g, '$1$2Smart Components' + TM + '$3$4');
  
  // FAQ q: and a: strings (visible text)
  c = c.replace(/(q: ")([^"]*?)Smart Components([^"]*?)(")/g, '$1$2Smart Components' + TM + '$3$4');
  c = c.replace(/(a: ")([^"]*?)Smart Components([^"]*?)(")/g, '$1$2Smart Components' + TM + '$3$4');
  
  // step title: and text: strings (visible text)
  c = c.replace(/(title: ")([^"]*?)Smart Components([^"]*?)(")/g, '$1$2Smart Components' + TM + '$3$4');
  c = c.replace(/(text: ")([^"]*?)Smart Components([^"]*?)(")/g, '$1$2Smart Components' + TM + '$3$4');
  
  // feature hub description: strings (multiline)
  c = c.replace(/(description:\s*\n\s*")([^"]*?)Smart Components([^"]*?)(")/g, '$1$2Smart Components' + TM + '$3$4');
  
  fs.writeFileSync(f, c, 'utf8');
  console.log('Updated: ' + f);
}
