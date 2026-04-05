const fs = require('fs');
const path = require('path');

// Slice 2: Templates + Component Library files
const targetFiles = [
  'app/(auth)/[workspaceSlug]/templates/page.tsx',
  'app/(auth)/[workspaceSlug]/templates/create/TemplateBuilder.tsx',
  'app/(auth)/[workspaceSlug]/templates/[id]/edit/TemplateEditor.tsx',
  'app/(auth)/[workspaceSlug]/templates/EditCustomerTemplateModal.tsx',
  'app/(auth)/[workspaceSlug]/templates/TemplatesPageClient.tsx',
  'app/(auth)/[workspaceSlug]/components/page.tsx',
  'app/(auth)/[workspaceSlug]/components/component-list.tsx',
  'app/(auth)/[workspaceSlug]/customer-quote-templates/page.tsx',
  'app/(auth)/[workspaceSlug]/customer-quote-templates/create/TemplateCreator.tsx',
  'app/(auth)/[workspaceSlug]/customer-quote-templates/create/build/TemplateBuilder.tsx',
  'app/(auth)/[workspaceSlug]/customer-quote-templates/save-from-quote/SaveFromQuote.tsx',
];

let totalChanges = 0;
const changeLog = [];

targetFiles.forEach(filePath => {
  if (!fs.existsSync(filePath)) {
    console.log(`  Skipped (not found): ${filePath}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  let fileChanges = 0;

  // Pattern 1: Change rounded-lg/md to rounded-full for button/Link elements
  const lines = content.split('\n');
  const newLines = lines.map((line, idx) => {
    const isButton = /className=.*(?:button|px-\d+.*py-\d+|bg-(?:slate|orange|blue|green|red|emerald|purple|amber)|border.*(?:slate|orange))/.test(line) ||
                     /<button|<Link/.test(lines[idx - 1] || '') ||
                     /<button|<Link/.test(lines[idx - 2] || '');
    
    if (isButton && /rounded-(?:lg|md)/.test(line)) {
      fileChanges++;
      return line.replace(/rounded-(?:lg|md)/g, 'rounded-full');
    }
    return line;
  });

  content = newLines.join('\n');

  // Pattern 2: Change primary buttons to black with orange glow
  // bg-blue-600, bg-emerald-600, bg-purple-600 -> bg-black
  content = content.replace(
    /bg-(blue|emerald|purple|amber)-[56]\d{2}/g,
    'bg-black'
  );
  
  content = content.replace(
    /hover:bg-(blue|emerald|purple|amber)-[67]\d{2}/g,
    'hover:bg-slate-800'
  );

  // Pattern 3: Add orange glow to black buttons if not already present
  content = content.replace(
    /(className="[^"]*bg-black[^"]*text-white[^"]*rounded-full[^"]*)"(?!.*hover:shadow)/g,
    (match, group) => {
      if (!group.includes('hover:shadow') && !group.includes('transition')) {
        fileChanges++;
        return group.slice(0, -1) + ' transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"';
      }
      return match;
    }
  );

  // Pattern 4: Secondary buttons (white with border) get shimmer
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

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    totalChanges += fileChanges;
    changeLog.push({ file: filePath, changes: fileChanges });
    console.log(`  Updated: ${path.basename(filePath)} (${fileChanges} changes)`);
  } else {
    console.log(`  No changes: ${path.basename(filePath)}`);
  }
});

console.log(`\nSlice 2 Complete: ${totalChanges} changes across ${changeLog.length} files`);
if (changeLog.length > 0) {
  console.log('\nSummary:');
  changeLog.forEach(({ file, changes }) => {
    console.log(`  ${path.basename(file)}: ${changes} changes`);
  });
}
