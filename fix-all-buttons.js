const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'app', '(auth)', '[workspaceSlug]', 'quotes', '[id]', 'takeoff', 'TakeoffWorkstation.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Fix ALL remaining vivid button colors
const fixes = [
  // Calibrate button when selected (line 1245)
  ['bg-yellow-600 hover:bg-yellow-700', 'bg-blue-100 hover:bg-blue-200 text-blue-700 border border-blue-400'],
  
  // CalibrationModal Save & Add Another buttons (lines 1878, 1887)
  ['className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded"', 'className="px-4 py-2 bg-blue-400 hover:bg-blue-500 text-white rounded-lg"'],
  
  // Badge count indicator
  ['text-xs bg-blue-600 px-2 py-1', 'text-xs bg-blue-100 text-blue-700 px-2 py-1'],
  
  // Green hover states for visibility toggles - keep these, they're semantic
];

fixes.forEach(([old, replacement]) => {
  const regex = new RegExp(old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  content = content.replace(regex, replacement);
});

fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ Fixed all remaining vivid buttons');
console.log('  - Calibrate (selected): pastel blue');
console.log('  - Save & Add Another: pastel blue');
console.log('  - Badge counts: light blue');
