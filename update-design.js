const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'app', '(auth)', '[workspaceSlug]', 'quotes', '[id]', 'takeoff', 'TakeoffWorkstation.tsx');

// Read file
let content = fs.readFileSync(filePath, 'utf8');

// Define replacements
const replacements = [
  // Backgrounds
  ['bg-slate-900', 'bg-gray-50'],
  ['bg-slate-800', 'bg-white'],
  ['bg-slate-700', 'bg-gray-100'],
  ['bg-slate-600', 'bg-gray-200'],
  ['bg-slate-500', 'bg-gray-300'],
  
  // Text
  ['text-white', 'text-gray-900'],
  ['text-slate-400', 'text-gray-600'],
  ['text-slate-300', 'text-gray-700'],
  ['text-slate-500', 'text-gray-500'],
  
  // Borders
  ['border-slate-700', 'border-gray-200'],
  ['border-slate-600', 'border-gray-300'],
  
  // Hovers
  ['hover:bg-slate-600', 'hover:bg-gray-200'],
  ['hover:bg-slate-700', 'hover:bg-gray-100'],
  
  // Colored badges - more subtle
  ['bg-yellow-600/20 border border-yellow-600', 'bg-amber-50 border border-amber-300'],
  ['text-yellow-400', 'text-amber-700'],
  
  ['bg-green-600/20 border border-green-600', 'bg-emerald-50 border border-emerald-300'],
  
  ['bg-blue-600/20 border border-blue-600', 'bg-blue-50 border border-blue-300'],
  
  // Canvas
  ['border-2 border-slate-700 rounded', 'border-2 border-gray-300 rounded-lg shadow-sm'],
];

// Apply replacements
replacements.forEach(([oldStr, newStr]) => {
  const regex = new RegExp(oldStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  content = content.replace(regex, newStr);
});

// Write back
fs.writeFileSync(filePath, content, 'utf8');

console.log(`✅ Applied ${replacements.length} style replacements`);
console.log('Design updated to match platform!');
