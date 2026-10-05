/* eslint-disable @typescript-eslint/no-require-imports */
// U0: dump test annotations from a JSON reporter file.
const fs = require('fs');
let raw = fs.readFileSync('e2e-u0-annotations.json', 'utf8');
if (raw.includes('\x00')) raw = fs.readFileSync('e2e-u0-annotations.json', 'utf16le');
const j = JSON.parse(raw.slice(raw.indexOf('{')));
const specs = [];
(function walk(suites) {
  for (const su of suites) {
    (su.specs ?? []).forEach((sp) => specs.push(sp));
    walk(su.suites ?? []);
  }
})(j.suites);
for (const t of specs) {
  for (const v of t.tests ?? []) {
    for (const res of v.results ?? []) {
      if (res.annotations?.length) {
        console.log('==', t.title, res.status);
        for (const a of res.annotations) console.log('  ' + a.type + ': ' + a.description);
      }
    }
  }
}
