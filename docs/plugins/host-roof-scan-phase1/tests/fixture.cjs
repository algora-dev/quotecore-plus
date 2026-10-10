const path = require('node:path');
const root = path.resolve(__dirname, '../../../..');
const out = process.env.QC_TEST_OUT || path.join(root, '.host-outline-test');
const sharp = require(path.join(out, 'node_modules/sharp'));
const points = [{x:100,y:100},{x:700,y:100},{x:700,y:300},{x:500,y:300},{x:500,y:500},{x:100,y:500}];
async function fixture() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="white"/><g fill="none" stroke="#333" stroke-width="3"><polygon points="100,100 700,100 700,300 500,300 500,500 100,500"/><path d="M100 100L250 250L550 250L700 100 M250 250L100 500 M500 300L350 400L350 250 M500 500L350 400"/></g><text x="60" y="565" fill="#333" font-size="18">SYNTHETIC SOFTWARE TEST ONLY. NOT A VISION BENCHMARK.</text></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
module.exports = { fixture, points, out };
