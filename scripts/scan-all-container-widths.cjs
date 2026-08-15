// Refined: collect ALL max-w container widths (sections + their immediate
// inner container divs). A page is uniform if it uses exactly one width family.
const fs = require("fs");
const path = require("path");

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (e.name === "page.tsx") out.push(full);
  }
  return out;
}

for (const page of walk("app/(marketing)")) {
  const src = fs.readFileSync(page, "utf8");
  const widths = new Set();
  // section tags with max-w
  for (const m of src.matchAll(/<section[^>]*max-w-(\S+?)(?=["\s])/g)) widths.add(m[1]);
  // container divs (mx-auto + max-w) anywhere
  for (const m of src.matchAll(/<div[^>]*mx-auto[^>]*max-w-(\S+?)(?=["\s])/g)) widths.add(m[1]);
  const w = [...widths].filter((x) => x !== "3xl" || !/(features)/.test(page));
  const label = widths.size > 1 ? [...widths].sort().join("+") : [...widths][0];
  if (widths.size > 1) console.log(`MIXED ${label.padEnd(16)} ${page.replace(/\\/g, "/")}`);
}
console.log("scan complete");
