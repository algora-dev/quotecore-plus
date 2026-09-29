const {loadModule}=require('./module-loader.cjs'),assert=require('node:assert/strict');
const {calculateComponentTest:calc,unitForDimension,canonicalUnit,displayQuantity}=loadModule('app/components/pricing/componentTest.ts');
const E=loadModule('app/lib/pricing/engine.ts');
const U=loadModule('app/lib/measurements/conversions.ts');
const base={name:'Test',measurementType:'area',materialRate:'2',labourRate:'4',wasteType:'none',wasteAmount:'',pitchType:'none',strategy:'per_unit',packPrice:'',packSize:'',packCoverage:'',heightMm:'',depthMm:'',timeUnit:'hr'};
const inp={values:['120'],system:'metric',basis:'surface',pitch:''};let checks=[];
function test(name,fn){fn();checks.push({name,status:'PASS'})}
function run(patch={},input={}){return calc({...base,...patch},{...inp,...input})}
function good(patch={},input={}){const r=run(patch,input);assert.ok(r.ok,JSON.stringify(r));return r.result}
function close(a,b){assert.ok(Math.abs(a-b)<=Math.max(1e-9,Math.abs(b)*1e-10),`${a} != ${b}`)}
test('120 square metres /10% /50m2 rolls: 3 whole packs, labour on132 not150',()=>{const r=good({wasteType:'percent',wasteAmount:'10',strategy:'per_pack_area',packPrice:'200',packSize:'50'});close(r.required,132);assert.equal(r.packs,3);close(r.purchased,150);close(r.spare,18);close(r.materialCost,600);close(r.labourCost,528);close(r.total,1128);close(r.effectiveCost,9.4)});
test('Rafter 25 degrees uses existing helper before waste',()=>{const r=good({pitchType:'rafter',wasteType:'percent',wasteAmount:'10',strategy:'per_pack_area',packPrice:'200',packSize:'50'},{basis:'plan',pitch:'25'});close(r.afterPitch,120*E.rafterPitchFactor(25));close(r.required,r.afterPitch*1.1);close(r.materialCost,E.computeMaterialCostByStrategy({strategy:'per_pack_area',totalQuantity:r.required,materialRate:0,packPrice:200,packSize:50,packCoverageM2:null}).cost)});
test('Already on slope does not apply pitch twice or require degrees',()=>close(good({pitchType:'rafter'},{basis:'surface',pitch:''}).required,120));
test('Hip valley existing formula, not rafter factor',()=>close(good({measurementType:'lineal',pitchType:'valley_hip'},{values:['10'],basis:'plan',pitch:'35'}).required,10*E.hipValleyPitchFactor(35)));
for(const value of ['0','-1','','NaN','Infinity','1e309'])test(`Invalid measurement ${JSON.stringify(value)} has no result`,()=>{const r=run({}, {values:[value]});assert.equal(r.ok,false);assert.ok(r.errors['value-0'])});
for(const key of['materialRate','labourRate'])for(const value of['','-3','NaN'])test(`Invalid ${key} ${JSON.stringify(value)} invalidates result`,()=>assert.equal(run({[key]:value}).ok,false));
test('Zero material/labour is explicitly accepted',()=>assert.equal(good({materialRate:'0',labourRate:'0'}).total,0));
test('Missing pack values fail instead of silently free material',()=>assert.equal(run({strategy:'per_pack_area'}).ok,false));
test('Positive pack price required by authoritative helper',()=>assert.equal(run({strategy:'per_pack_area',packPrice:'0',packSize:'50'}).ok,false));
test('Per-unit ignores unused stale pack settings',()=>close(good({packPrice:'-1',packSize:'bad'}).total,720));
test('Pack material rate is ignored as in quote engine',()=>assert.equal(good({strategy:'per_pack_area',packPrice:'200',packSize:'50',materialRate:''}).materialCost,600));
for(const value of['90','100','-1',''])test(`Invalid plan pitch ${JSON.stringify(value)}`,()=>assert.equal(run({pitchType:'rafter'},{basis:'plan',pitch:value}).ok,false));
test('Zero plan pitch allowed',()=>close(good({pitchType:'rafter'},{basis:'plan',pitch:'0'}).required,120));
test('Percentage waste uses adjusted quantity',()=>close(good({wasteType:'percent',wasteAmount:'12.5'}).required,135));
test('Fixed waste manual entries each receive the allowance',()=>{const r=good({measurementType:'multi_lineal',wasteType:'fixed',wasteAmount:'.25'},{values:['4','7']});close(r.required,11.5);assert.equal(r.entryCount,2)});
test('Segment waste manual fallback matches engine, pack rounding across aggregate',()=>{const r=good({measurementType:'multi_lineal',wasteType:'fixed_per_segment',wasteAmount:'.5',strategy:'per_pack_length',packPrice:'50',packSize:'20'},{values:['4','7']});close(r.required,12);assert.equal(r.packs,1)});
test('Preset height millimetres multiplies length before pricing',()=>{const r=good({measurementType:'length_x_height',heightMm:'2400'},{values:['10']});close(r.measured,24);close(r.total,144)});
test('Preset depth millimetres multiplies area before volume pack',()=>{const r=good({measurementType:'volume',depthMm:'100',strategy:'per_pack_volume',packPrice:'400',packSize:'5'});close(r.required,12);assert.equal(r.packs,3);close(r.materialCost,1200);close(r.labourCost,48)});
for(const t of['length_x_height','multi_lineal_lxh','volume'])test(`Missing preset ${t} rejects rather than fake price`,()=>assert.equal(run({measurementType:t}).ok,false));
for(const t of['length_x_height_freestyle','multi_lineal_lxh_freestyle','volume_3d'])test(`Already calculated ${t} avoids double multiplier`,()=>close(good({measurementType:t}).required,120));
test('Quantity + labour',()=>close(good({measurementType:'quantity',materialRate:'12',labourRate:'3'},{values:['5']}).total,75));
test('Fixed charge uses one',()=>close(good({measurementType:'fixed',materialRate:'80',labourRate:'20'},{values:['100']}).total,100));
test('Time does not invent hour to day conversion',()=>close(good({measurementType:'hours_days',materialRate:'0',labourRate:'120',timeUnit:'day'},{values:['2']}).total,240));
for(const value of['1','5','500','1000'])test(`${value} can be tested without a hardcoded sample cap`,()=>close(good({}, {values:[value]}).total,Number(value)*6));
test('Imperial area -> canonical costs',()=>close(good({}, {system:'imperial_ft',values:['100']}).required,U.areaInputToMetric(100,'imperial_ft')));
test('Roofing square -> 100 square feet',()=>close(good({}, {system:'imperial_rs',values:['1']}).required,U.areaInputToMetric(100,'imperial_ft')));
test('Feet into preset metric height',()=>close(good({measurementType:'length_x_height',heightMm:'1000'},{values:['10'],system:'imperial_ft'}).required,U.linearInputToMetric(10,'imperial_ft')));
test('Cubic feet -> cubic metres',()=>close(good({measurementType:'volume_3d'},{system:'imperial_ft',values:['1']}).required,U.volumeInputToMetric(1,'imperial_ft')));
test('Legacy pack coverage kept',()=>{const r=good({strategy:'per_pack_coverage',packPrice:'50',packSize:'10',packCoverage:'20'});assert.equal(r.packs,6);close(r.purchased,120);close(r.materialCost,300)});
test('Incompatible pack method fails',()=>assert.equal(run({measurementType:'quantity',strategy:'per_pack_area',packPrice:'5',packSize:'20'}).ok,false));
test('Missing rows fails',()=>assert.equal(run({},{values:[]}).ok,false));
test('NaN allowance fails',()=>assert.equal(run({wasteType:'percent',wasteAmount:'x'}).ok,false));
test('Hidden allowance invalid values ignored',()=>close(good({wasteType:'none',wasteAmount:'x'}).required,120));
test('Too large calculation rejected',()=>assert.equal(run({materialRate:'1e308'},{values:['1e308']}).ok,false));
test('Small job effective cost includes pack boundary',()=>{const a=good({strategy:'per_pack_area',packPrice:'200',packSize:'50',labourRate:'0'},{values:['5']}),b=good({strategy:'per_pack_area',packPrice:'200',packSize:'50',labourRate:'0'},{values:['50']});close(a.effectiveCost,40);close(b.effectiveCost,4)});
test('No draft or input object mutation',()=>{const a=Object.freeze({...base}), b=Object.freeze({...inp,values:Object.freeze(['120'])});assert.ok(calc(a,b).ok)});
for(const t of['area','lineal','linear','multi_lineal','quantity','count','fixed','irregular_area','curved_line','hours_days','volume_3d'])test(`Canonical dimension ${t}`,()=>assert.ok(canonicalUnit(t)));
require('fs').writeFileSync(require('node:path').join(__dirname,'engine-results.json'),JSON.stringify({scope:'Real pure helper + new draft adapter; no server or DB executed',passed:checks.length,checks},null,2));console.log(`${checks.length} adapter/engine checks PASS`);
