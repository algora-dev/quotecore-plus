const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'public', 'logos');
fs.mkdirSync(dir, { recursive: true });

// JobNimbus - official brand color #00A6E2
const jobnimbusSvg = `<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <title>JobNimbus</title>
  <rect width="24" height="24" rx="4" fill="#00A6E2"/>
  <path d="M12 5L5 10.5V19h4v-5h6v5h4v-8.5L12 5z" fill="white"/>
</svg>`;
fs.writeFileSync(path.join(dir, 'jobnimbus.svg'), jobnimbusSvg);

// Fergus - official brand color #FF7A00
const fergusSvg = `<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <title>Fergus</title>
  <rect width="24" height="24" rx="4" fill="#FF7A00"/>
  <path d="M17.5 6.5c-.4-.4-1-.4-1.4 0l-2.8 2.8-1.1-1.1 2.8-2.8c.4-.4.4-1 0-1.4a3 3 0 0 0-4.2 4.2l-4.2 4.2a1 1 0 0 0 0 1.4l.7.7a1 1 0 0 0 1.4 0l4.2-4.2a3 3 0 0 0 4.2-4.2z" fill="white"/>
</svg>`;
fs.writeFileSync(path.join(dir, 'fergus.svg'), fergusSvg);

console.log('Saved JobNimbus and Fergus SVGs');
