import fs from 'fs';
import path from 'path';

function walk(dir) {
  let results = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.next' || e.name === '.git') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) results.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(e.name)) results.push(p);
  }
  return results;
}

const bad = [];
const patterns = /[\u00c3][\u00a2-\u00bf]|\ufffd|[\u00c3][\u00a9-\u00aa]|\u00f0[\u009f]|[\u00e2][\u0080-\u009c]|\u00e2\u0080\u0093|\u00e2\u0080\u0094|\u00e2\u0080\u009c|\u00e2\u0080\u009d/;

for (const f of walk('.')) {
  const c = fs.readFileSync(f, 'utf8');
  if (patterns.test(c)) bad.push(f);
}

if (bad.length) {
  console.log('BAD FILES:');
  bad.forEach(f => console.log(f));
} else {
  console.log('No mojibake found');
}
