const fs = require('fs');
const c = fs.readFileSync('app/(marketing)/features/smart-components/page.tsx', 'utf8');
const lines = c.split('\n');
lines.forEach((l, i) => {
  if (l.includes('Smart Components')) {
    const hasTM = l.includes('\u2122');
    const isMeta = l.match(/title: "|description:|item: |name: "/);
    console.log((i+1) + ': ' + (hasTM ? 'TM' : 'NO-TM') + (isMeta ? ' [META]' : ' [VISIBLE]') + ' | ' + l.trim().substring(0, 90));
  }
});
