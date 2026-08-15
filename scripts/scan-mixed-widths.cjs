// Scan every marketing page for mixed section widths — pages where sections
// use more than one max-w-* value get flagged (excluding heading/paragraph
// max-w utilities inside sections, which are fine).
const fs = require("fs");
const path = require("path");

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name === "page.tsx") out.push(full);
  }
  return out;
}

const pages = walk("app/(marketing)");
const flagged = [];

for (const page of pages) {
  const src = fs.readFileSync(page, "utf8");
  const sectionWidths = new Set();
  const re = /<section[^>]*>/g;
  let m;
  while ((m = re.exec(src))) {
    const tag = m[0];
    const w = tag.match(/max-w-(\S+?)(?=["\s])/);
    if (w) sectionWidths.add(w[1]);
    else if (!/max-w/.test(tag)) sectionWidths.add("(none)");
  }
  if (sectionWidths.size > 1) {
    flagged.push({ page: page.replace(/\\/g, "/"), widths: [...sectionWidths].join(", ") });
  }
}

console.log(`Pages with MIXED section widths: ${flagged.length}/${pages.length}\n`);
for (const f of flagged) console.log(`${f.widths.padEnd(30)} ${f.page}`);
