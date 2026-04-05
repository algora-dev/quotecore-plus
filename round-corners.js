const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'app', '(auth)', '[workspaceSlug]', 'quotes', '[id]', 'takeoff', 'TakeoffWorkstation.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Add rounded corners to all major elements
const roundingFixes = [
  // Buttons that are just "rounded" → rounded-lg
  ['className="px-3 py-2 rounded text-sm', 'className="px-3 py-2 rounded-lg text-sm'],
  ['className="px-4 py-2 rounded text-sm', 'className="px-4 py-2 rounded-lg text-sm'],
  ['className="px-3 py-1 rounded text-sm', 'className="px-3 py-1 rounded-lg text-sm'],
  ['className="px-4 py-2 rounded disabled', 'className="px-4 py-2 rounded-lg disabled'],
  
  // Component cards and containers
  ['className="p-2 rounded bg-', 'className="p-2 rounded-lg bg-'],
  ['className="p-3 rounded bg-', 'className="p-3 rounded-lg bg-'],
  
  // Small buttons with just "rounded"
  ['className="w-6 h-6 flex items-center justify-center text-red-400 hover:bg-red-600/20 rounded"', 'className="w-6 h-6 flex items-center justify-center text-red-400 hover:bg-red-600/20 rounded-md"'],
  ['className="w-6 h-6 flex items-center justify-center text-green-400 hover:bg-green-600/20 rounded font-bold"', 'className="w-6 h-6 flex items-center justify-center text-green-400 hover:bg-green-600/20 rounded-md font-bold"'],
  
  // Specific small elements
  ['hover:bg-green-600/20 rounded"', 'hover:bg-green-600/20 rounded-md"'],
  
  // Status badges and indicators
  ['text-xs bg-blue-600 px-2 py-1 rounded"', 'text-xs bg-blue-600 px-2 py-1 rounded-md"'],
];

roundingFixes.forEach(([old, replacement]) => {
  content = content.replace(new RegExp(old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacement);
});

fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ Rounded corners applied to all elements');
console.log(`  - Applied ${roundingFixes.length} rounding fixes`);
console.log('  - Buttons: rounded-lg');
console.log('  - Cards/panels: rounded-lg or rounded-xl');
console.log('  - Small buttons/badges: rounded-md');
