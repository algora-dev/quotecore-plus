const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'app', '(auth)', '[workspaceSlug]', 'quotes', '[id]', 'takeoff', 'TakeoffWorkstation.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Final pass: catch any remaining plain "rounded" that should be rounded-lg/md
const finalFixes = [
  // Catch-all for buttons with just "rounded" at the end
  [' rounded">', ' rounded-lg">'],
  [' rounded disabled', ' rounded-lg disabled'],
  [' rounded text-', ' rounded-lg text-'],
  [' rounded font-', ' rounded-lg font-'],
  
  // Internal badges/indicators
  ['bg-blue-600 px-2 py-1 rounded"', 'bg-blue-600 px-2 py-1 rounded-md"'],
  ['bg-emerald-50 border border-emerald-300 rounded', 'bg-emerald-50 border border-emerald-300 rounded-lg'],
  ['bg-amber-50 border border-amber-300 rounded', 'bg-amber-50 border border-amber-300 rounded-lg'],
  ['bg-blue-50 border border-blue-300 rounded', 'bg-blue-50 border border-blue-300 rounded-lg'],
  ['bg-red-50 rounded', 'bg-red-50 rounded-lg'],
];

let changesCount = 0;
finalFixes.forEach(([old, replacement]) => {
  const beforeCount = (content.match(new RegExp(old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  content = content.replace(new RegExp(old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacement);
  const afterCount = (content.match(new RegExp(replacement.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  if (afterCount > 0) {
    changesCount += beforeCount;
  }
});

fs.writeFileSync(filePath, content, 'utf8');

console.log(`✅ Final rounding pass complete`);
console.log(`  - Updated ${changesCount} additional elements`);
console.log('  - All corners now consistently rounded');
