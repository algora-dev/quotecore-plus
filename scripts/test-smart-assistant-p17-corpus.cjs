/* Example-plan compilation, NOT natural-language or live acceptance testing. */
const {root}=require('./sa-speed-test-loader.cjs');
const path=require('node:path'),fs=require('node:fs'),test=require('node:test'),assert=require('node:assert/strict');
const {compileIntelligentPlan}=require(path.join(root,'app/lib/smart-assistant/retrieval/semantics.ts'));
const {parseCompositeSelection}=require(path.join(root,'app/lib/smart-assistant/retrieval/relationships.ts'));
const {DEFAULT_SECTION_PERMISSIONS}=require(path.join(root,'app/lib/smart-assistant/section-permissions.ts'));
const corpus=JSON.parse(fs.readFileSync(path.join(root,'docs/sa-p17-2026-09-26/ACCEPTANCE_CASES.json'),'utf8'));
test('50 unique acceptance cases distinguish manual fixtures from read automation',()=>{assert.equal(corpus.cases.length,50);assert.equal(new Set(corpus.cases.map(c=>c.id)).size,50);for(const c of corpus.cases){assert.ok(c.prompt&&c.expected);assert.ok(['manual-only','automated-read'].includes(c.execution));if(/\b(?:set|change|confirm|cancel|delete|remove|send|publish)\b/i.test(c.prompt))assert.equal(c.execution,'manual-only');}});
for(const c of corpus.cases){
 if(c.examplePlan)test(`${c.id} example plan compiles (not a language-quality pass)`,()=>assert.ok(compileIntelligentPlan(c.examplePlan,DEFAULT_SECTION_PERMISSIONS).plan));
 if(c.exampleSelection)test(`${c.id} example selection validates (not a live resolution pass)`,()=>assert.ok(parseCompositeSelection(c.exampleSelection,DEFAULT_SECTION_PERMISSIONS,true)));
}
