const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=(r)=>fs.readFileSync(path.join(root,'app/(marketing)',r,'page.tsx'),'utf8');
const pricing=read('roofing-pricing-setup');
const measurements=read('roof-measurements-to-price');
const takeoff=read('roofing-takeoff-software');

test('pricing AI page targets importing source prices and review, not inventing rates',()=>{
  assert.match(pricing,/Import Roofing Price Lists with AI/);
  assert.match(pricing,/Can AI create pricing components from a photo or supplier list\?/);
  for (const t of ['Excel','CSV','supplier PDF','photo','complete missing details','labour','/roof-measurements-to-price']) assert.ok(pricing.includes(t),t);
});
test('measurements AI page targets quantities already known, with linked pricing',()=>{
  assert.match(measurements,/Roof Measurements to Quote with AI Import/);
  assert.match(measurements,/Can AI turn handwritten roof measurements into a priced quote\?/);
  for (const t of ['photo','PDF','spreadsheet','selected pricing library','review the measurements','/roofing-pricing-setup','/roofing-takeoff-software']) assert.ok(measurements.toLowerCase().includes(t.toLowerCase()),t);
});
test('takeoff AI page targets editable geometry from plans and uploaded satellite images',()=>{
  assert.match(takeoff,/AI Roof Takeoff: Plans & Satellite Images/);
  assert.match(takeoff,/Can AI measure a roof from satellite images or PDF plans\?/);
  for (const t of ['Roof Scan Assist','shadows','trees','calibrat','edit','does not automatically fetch satellite imagery','/free-roof-takeoff']) assert.ok(takeoff.toLowerCase().includes(t.toLowerCase()),t);
});
test('three distinct title/description intents, one H1 and compact AI explanations per page',()=>{
  const pages=[pricing,measurements,takeoff];
  assert.equal(new Set(pages.map(p=>p.match(/const (?:pageTitle|title) = '([^']+)'/)[1])).size,3);
  for(const p of pages) { assert.equal((p.match(/<h1\b/g)||[]).length,1); assert.ok(p.includes('buildSoftwareApplicationSchema()')); assert.ok(p.includes('hreflangLanguages(path)')); }
  assert.match(pricing,/<details className=\{styles.aiFaq\}>/);
  assert.match(measurements,/<details className=\{styles.aiFaq\}>/);
  assert.match(takeoff,/<details key=\{faq.question\}>/);
});
