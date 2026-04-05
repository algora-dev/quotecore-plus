const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Find all TSX files
const files = execSync('git ls-files "*.tsx"', { encoding: 'utf8' })
  .trim()
  .split('\n')
  .filter(f => f && !f.includes('node_modules'));

const replacements = [
  // Primary action buttons: blue → orange
  ['bg-blue-600 hover:bg-blue-700', 'bg-orange-500 hover:bg-orange-600'],
  ['bg-blue-500 hover:bg-blue-600', 'bg-orange-500 hover:bg-orange-600'],
  
  // Active states: blue → orange
  ['border-blue-500', 'border-orange-500'],
  ['text-blue-600', 'text-orange-600'],
  ['bg-blue-100 text-blue-700', 'bg-orange-100 text-orange-700'],
  
  // Focus rings: blue → orange
  ['ring-blue-500', 'ring-orange-500'],
  ['focus:ring-blue-500', 'focus:ring-orange-500'],
];

let totalChanges = 0;

files.forEach(filePath => {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  replacements.forEach(([old, replacement]) => {
    const regex = new RegExp(old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    if (content.includes(old)) {
      content = content.replace(regex, replacement);
      changed = true;
      totalChanges++;
    }
  });

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ Updated: ${filePath}`);
  }
});

console.log(`\n✅ Applied branding to ${totalChanges} instances across ${files.length} files`);
console.log('   Orange accent (#FF6B35) is now the primary brand color!');
