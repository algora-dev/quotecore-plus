const fs = require('fs');
const path = require('path');

// Slice 1: Quote builder + Digital takeoff files
const targetFiles = [
  'app/(auth)/[workspaceSlug]/quotes/[id]/quote-builder.tsx',
  'app/(auth)/[workspaceSlug]/quotes/[id]/quote-builder-v2.tsx',
  'app/(auth)/[workspaceSlug]/quotes/[id]/build/QuoteBuilderV2.tsx',
  'app/(auth)/[workspaceSlug]/quotes/[id]/build/components/RoofAreaCard.tsx',
  'app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/TakeoffWorkstation.tsx',
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

  // Strategy: Parse line-by-line, track when we're inside a <button> or <Link> element
  const lines = content.split('\n');
  let insideButton = false;
  let buttonStartLine = -1;
  
  const newLines = lines.map((line, idx) => {
    // Detect button/Link opening tags
    if (/<button|<Link/.test(line)) {
      insideButton = true;
      buttonStartLine = idx;
    }
    
    // Detect closing tags (look for > or />)
    if (insideButton && />\s*$|\/>\s*$/.test(line)) {
      const isLastLine = line.includes('</button>') || line.includes('</Link>') || line.includes('/>');
      if (isLastLine || (idx - buttonStartLine) > 10) {
        insideButton = false;
      }
    }

    // Only replace rounded-lg/md if we're inside a button/Link AND the line has className
    if (insideButton && /className/.test(line) && /rounded-(?:lg|md)/.test(line)) {
      // Extra check: make sure it's not an input, select, div, or info box
      const previousLines = lines.slice(Math.max(0, idx - 3), idx).join(' ');
      const isNotInput = !/type="text"|type="email"|type="password"|<input|<select|<div/.test(previousLines);
      
      if (isNotInput) {
        fileChanges++;
        return line.replace(/rounded-(?:lg|md)/g, 'rounded-full');
      }
    }

    return line;
  });

  content = newLines.join('\n');

  // Pattern 2: Add shimmer to secondary buttons (border + bg-white/transparent)
  content = content.replace(
    /(<(?:button|Link)[^>]*className="[^"]*border[^"]*border-slate-[23]\d{2}[^"]*bg-white[^"]*rounded-full[^"]*)"(?!.*pill-shimmer)/g,
    (match, group) => {
      if (!group.includes('pill-shimmer') && !group.includes('input') && !group.includes('select')) {
        fileChanges++;
        return group + ' pill-shimmer"';
      }
      return match;
    }
  );

  // Pattern 3: Add glow to primary buttons (solid bg)
  content = content.replace(
    /(<(?:button|Link)[^>]*className="[^"]*(?:bg-(?:slate-[89]\d{2}|orange-[456]\d{2}|blue-[56]\d{2}|emerald-[56]\d{2}))[^"]*rounded-full[^"]*)"(?!.*hover:shadow)/g,
    (match, group) => {
      if (!group.includes('hover:shadow')) {
        if (!group.includes('transition')) {
          group = group.slice(0, -1) + ' transition-all"';
        }
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
