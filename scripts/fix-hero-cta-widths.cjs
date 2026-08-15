// Feature pages + hub: widen hero inner containers and bottom CTA containers
// from max-w-3xl to max-w-5xl so left edges align with body sections; drop
// text-center on CTA blocks (left-aligned per design direction).
const fs = require("fs");

const pages = [
  "app/(marketing)/features/page.tsx",
  "app/(marketing)/features/ai-scan-assist/page.tsx",
  "app/(marketing)/features/digital-roof-takeoff/page.tsx",
  "app/(marketing)/features/invoicing/page.tsx",
  "app/(marketing)/features/material-ordering/page.tsx",
  "app/(marketing)/features/sending-and-tracking/page.tsx",
  "app/(marketing)/features/smart-components/page.tsx",
  "app/(marketing)/features/supplier-resources/page.tsx",
];

for (const file of pages) {
  let src = fs.readFileSync(file, "utf8");
  const before = src;
  // Hero inner container (and any remaining 3xl section/container divs on these pages)
  src = src.replaceAll(
    '<div className="relative mx-auto max-w-3xl px-6 lg:px-8">',
    '<div className="relative mx-auto max-w-5xl px-6 lg:px-8">',
  );
  src = src.replaceAll(
    '<div className="relative mx-auto max-w-3xl px-6 text-center lg:px-8">',
    '<div className="relative mx-auto max-w-5xl px-6 lg:px-8">',
  );
  src = src.replaceAll(
    '<div className="mx-auto max-w-3xl px-6 text-center lg:px-8">',
    '<div className="mx-auto max-w-5xl px-6 lg:px-8">',
  );
  if (src !== before) {
    fs.writeFileSync(file, src);
    console.log(`updated: ${file}`);
  } else {
    console.log(`no hero/CTA 3xl containers found: ${file}`);
  }
}

// Report any remaining max-w-3xl in these files (should be none)
for (const file of pages) {
  const src = fs.readFileSync(file, "utf8");
  const lines = src.split("\n");
  lines.forEach((l, i) => {
    if (l.includes("max-w-3xl")) console.log(`REMAINING ${file}:${i + 1}: ${l.trim().slice(0, 100)}`);
  });
}
