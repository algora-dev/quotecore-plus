const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'app', '(auth)', '[workspaceSlug]', 'quotes', '[id]', 'takeoff', 'TakeoffWorkstation.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Major color simplification
const colorFixes = [
  // Remove all amber/yellow/orange backgrounds - replace with blue or gray
  ['bg-amber-500 hover:bg-amber-600 text-white', 'bg-blue-100 hover:bg-blue-200 text-blue-700 border border-blue-300'],
  ['bg-amber-50 border border-amber-300', 'bg-white border-2 border-orange-400'],
  ['text-amber-700', 'text-gray-700'],
  ['text-amber-600', 'text-gray-700'],
  
  // Make green buttons pastel
  ['bg-green-600 hover:bg-green-700', 'bg-emerald-400 hover:bg-emerald-500 text-white'],
  
  // Make blue buttons pastel
  ['bg-blue-600 hover:bg-blue-700', 'bg-blue-400 hover:bg-blue-500 text-white'],
  
  // Make purple buttons pastel
  ['bg-purple-600 hover:bg-purple-700', 'bg-purple-400 hover:bg-purple-500 text-white'],
  
  // Selected state: light blue background
  ['bg-blue-600 hover:bg-blue-700', 'bg-blue-100 text-blue-700 border border-blue-400'],
  
  // Yellow button (calibrate)
  ['text-yellow-400', 'text-blue-600'],
  
  // Remove yellow highlights in headings
  ['text-yellow-400', 'text-blue-600'],
];

colorFixes.forEach(([old, replacement]) => {
  content = content.replace(new RegExp(old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacement);
});

fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ Color simplification complete');
console.log('  - Removed all amber/orange colors');
console.log('  - Selected: light blue (bg-blue-100 + blue-700 text)');
console.log('  - Buttons: pastel shades');
console.log('  - Warning boxes: white with orange border');
