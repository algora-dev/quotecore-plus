// Normalize feature-page section widths: from each page's anchor line onward,
// section containers max-w-3xl -> max-w-5xl so all body sections share the
// showcase width (left edges align, consistent page column).
const fs = require("fs");

const fixes = [
  ["app/(marketing)/features/digital-roof-takeoff/page.tsx", 222],
  ["app/(marketing)/features/ai-scan-assist/page.tsx", 231], // FAQ only
  ["app/(marketing)/features/smart-components/page.tsx", 184],
  ["app/(marketing)/features/material-ordering/page.tsx", 156],
  ["app/(marketing)/features/invoicing/page.tsx", 156],
  ["app/(marketing)/features/supplier-resources/page.tsx", 150],
];

for (const [file, anchor] of fixes) {
  const lines = fs.readFileSync(file, "utf8").split("\n");
  let changed = 0;
  for (let i = anchor - 1; i < lines.length; i++) {
    if (lines[i].includes("max-w-3xl") && lines[i].includes("<section")) {
      lines[i] = lines[i].replace("max-w-3xl", "max-w-5xl");
      changed++;
    }
  }
  fs.writeFileSync(file, lines.join("\n"));
  console.log(`${file}: ${changed} sections widened (from line ${anchor})`);
}
