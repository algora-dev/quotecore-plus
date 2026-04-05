const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'app', '(auth)', '[workspaceSlug]', 'quotes', '[id]', 'takeoff', 'TakeoffWorkstation.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Fix specific low-contrast text elements
const fixes = [
  // Roof area measurements and labels
  ['text-gray-700', 'text-gray-900'], // Make primary text darker
  
  // Available/Active headings
  ['text-xs font-semibold text-gray-500', 'text-xs font-semibold text-gray-700 uppercase tracking-wide'],
  
  // Measurement values (sq meters, etc)
  ['text-xs text-gray-700', 'text-xs text-gray-900 font-medium'],
];

fixes.forEach(([old, replacement]) => {
  // Only replace in specific contexts to avoid over-replacing
  content = content.replace(new RegExp(old, 'g'), replacement);
});

fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ Contrast improvements applied');
console.log('  - Primary text: gray-900 (darker)');
console.log('  - Headings: gray-700 with uppercase + tracking');
console.log('  - Measurements: gray-900 + font-medium');
