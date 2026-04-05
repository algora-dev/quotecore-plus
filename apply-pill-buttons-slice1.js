const fs = require('fs');
const path = require('path');

// Slice 1: Quote builder + Digital takeoff files
const targetFiles = [
  'app/(auth)/[workspaceSlug]/quotes/[id]/quote-builder.tsx',
  'app/(auth)/[workspaceSlug]/quotes/[id]/quote-builder-v2.tsx',
  'app/(auth)/[workspaceSlug]/quotes/[id]/build/QuoteBuilderV2.tsx',
  'app/(auth)/[workspaceSlug]/quotes/[id]/build/QuoteBuilderV2Wrapper.tsx',
  'app/(auth)/[workspaceSlug]/quotes/[id]/build/components/RoofAreaCard.tsx',
  'app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/TakeoffWorkstation.tsx',
  'app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/page.tsx',
  'app/(auth)/[workspaceSlug]/quotes/new/QuoteDetailsForm.tsx',
  'app/(auth)/[workspaceSlug]/quotes/QuotesList.tsx',
];

let totalChanges = 0;
const changeLog = [];

targetFiles.forEach(filePath => {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Skipped (not found): ${filePath}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  let fileChanges = 0;

  // Pattern 1: Change rounded-lg/md to rounded-full for button/Link elements
  // Only if the line contains button, Link, or typical button classes
  const lines = content.split('\n');
  const newLines = lines.map((line, idx) => {
    // Check if line is part of a button/Link (has className and common button indicators)
    const isButton = /className=.*(?:button|px-\d+.*py-\d+|bg-(?:slate|orange|blue|green|red|emerald)|border.*(?:slate|orange))/.test(line) ||
                     /<button|<Link/.test(lines[idx - 1] || '') ||
                     /<button|<Link/.test(lines[idx - 2] || '');
    
    if (isButton && /rounded-(?:lg|md)/.test(line)) {
      fileChanges++;
      return line.replace(/rounded-(?:lg|md)/g, 'rounded-full');
    }
    return line;
  });

  content = newLines.join('\n');

  // Pattern 2: Add shimmer to secondary buttons (border + bg-white/transparent)
  // Look for patterns like: border border-slate-300 ... bg-white
  content = content.replace(
    /(className="[^"]*border[^"]*border-slate-[23]\d{2}[^"]*bg-white[^"]*rounded-full[^"]*)"(?!.*pill-shimmer)/g,
    (match, group) => {
      if (!group.includes('pill-shimmer')) {
        fileChanges++;
        return group + ' pill-shimmer"';
      }
      return match;
    }
  );

  // Pattern 3: Add glow to primary buttons (solid bg, no pill-shimmer)
  // Look for patterns like: bg-slate-900, bg-orange-500, bg-blue-600
  content = content.replace(
    /(className="[^"]*(?:bg-(?:slate-[89]\d{2}|orange-[456]\d{2}|blue-[56]\d{2}|emerald-[56]\d{2}))[^"]*rounded-full[^"]*)"(?!.*hover:shadow)/g,
    (match, group) => {
      if (!group.includes('transition')) {
        group = group.slice(0, -1) + ' transition-all"';
      }
      if (!group.includes('hover:shadow')) {
        fileChanges++;
        return group.slice(0, -1) + ' hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"';
      }
      return match;
    }
  );

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    totalChanges += fileChanges;
    changeLog.push({ file: filePath, changes: fileChanges });
    console.log(`✓ Updated: ${filePath} (${fileChanges} changes)`);
  } else {
    console.log(`  No changes: ${filePath}`);
  }
});

console.log(`\n✅ Slice 1 Complete: ${totalChanges} changes across ${changeLog.length} files`);
if (changeLog.length > 0) {
  console.log('\nSummary:');
  changeLog.forEach(({ file, changes }) => {
    console.log(`  ${path.basename(file)}: ${changes} changes`);
  });
}
