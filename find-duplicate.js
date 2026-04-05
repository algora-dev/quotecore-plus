const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'app', '(auth)', '[workspaceSlug]', 'quotes', '[id]', 'takeoff', 'TakeoffWorkstation.tsx');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

const matches = [];
lines.forEach((line, idx) => {
  if (line.includes('handleAddComponent')) {
    matches.push({ line: idx + 1, content: line.trim() });
  }
});

console.log(`Found ${matches.length} occurrences of 'handleAddComponent':`);
matches.forEach(m => {
  console.log(`  Line ${m.line}: ${m.content.substring(0, 100)}`);
});
