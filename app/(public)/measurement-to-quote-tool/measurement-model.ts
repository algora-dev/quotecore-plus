/** Manual companion to Digital Takeoffs V1. No canvas/geometry dependency.
 * Numeric fields remain strings while editing: clearing an input never silently
 * falls back to its old value. References are links, not billable area rows.
 */
import type {TakeoffComponentSpec,TakeoffUnitSystem,TakeoffTradeConfig} from '../free-roof-takeoff/tradeConfig';
import {ROOFING_TAKEOFF_CONFIG,CLADDING_TAKEOFF_CONFIG,FLOORING_TAKEOFF_CONFIG} from '../free-roof-takeoff/tradeConfig';
import {exampleSpecs,convertSpecs,quantityFactor,specUnit,validateSpec,componentLimit,TAKEOFF_CURRENCIES,type TakeoffCurrency} from '../free-roof-takeoff/takeoff-examples';
import {rafterPitchFactor,hipValleyPitchFactor} from './calc';
import {buildConvertUrl,type ConvertibleLine} from '../shared/convertLines';
export type Trade='roofing'|'cladding'|'flooring';
export type Basis='actual'|'plan';
export type Spec=TakeoffComponentSpec & {sku?:string};
export type Units=TakeoffUnitSystem;
export type Currency=TakeoffCurrency;
export type EntryMode='total'|'dimensions'|'reference';
export interface ReferenceSize {mode:'total'|'dimensions';a:string;b:string;basis:Basis}
export interface Measurement {id:string;label:string;mode:EntryMode;a:string;b:string;repeat:string;referenceId:string;basis:Basis;pitchOverride:string}
export interface Assignment {id:string;componentId:string;entries:Measurement[]}
export interface Area {id:string;name:string;pitch:string;basis:Basis;reference:ReferenceSize|null;components:Assignment[]}
export interface Job {version:1;trade:Trade;units:Units;currency:Currency;title:string;components:Spec[];areas:Area[];selectedAreaId:string;choice:'examples'|'custom';}
export const CONFIGS:Record<Trade,TakeoffTradeConfig>={roofing:ROOFING_TAKEOFF_CONFIG,cladding:CLADDING_TAKEOFF_CONFIG,flooring:FLOORING_TAKEOFF_CONFIG};
export const TRADE_COPY={
 roofing:{name:'Roofing',noun:'area',plural:'areas',first:'Main roof',placeholder:'e.g. Detached garage roof',description:'Roof areas, flashings, ridges and spouting.',hint:'Separate a garage, extension or roof covering into its own area.',dimension:'Width',digital:'/free-roof-takeoff/measure'},
 cladding:{name:'Cladding',noun:'area',plural:'areas',first:'Front elevation',placeholder:'e.g. Rear elevation  -  cedar cladding',description:'Elevations, cladding, wrap, trims and openings.',hint:'Use a different area for each elevation or cladding type.',dimension:'Height',digital:'/free-cladding-takeoff'},
 flooring:{name:'Flooring',noun:'room',plural:'rooms',first:'Living room',placeholder:'e.g. Bedroom 2  -  carpet',description:'Rooms, floor coverings, underlay and trims.',hint:'Create a room or zone for each space or different floor covering.',dimension:'Width',digital:'/free-flooring-takeoff'},
} as const;
export function id(prefix='m'){return `${prefix}-${typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2)+Date.now()}`;}
export function fmt(n:number,dp=2){return n.toLocaleString('en-NZ',{maximumFractionDigits:dp,minimumFractionDigits:dp});}
export function money(n:number,currency:Currency){return new Intl.NumberFormat('en-NZ',{style:'currency',currency,minimumFractionDigits:2,maximumFractionDigits:2}).format(n);}
export function cleanNumber(n:number){return Number.isFinite(n)?String(Number(n.toPrecision(13))):'';}
export function lengthUnit(u:Units){return u==='metric'?'m':'ft';}
export {specUnit,componentLimit,TAKEOFF_CURRENCIES};
export function newMeasurement(type:Spec['measurementType'],basis:Basis='actual',referenceId=''):Measurement{return {id:id('entry'),label:'',mode:referenceId&&type==='area'?'reference':type==='area'?'total':'total',a:'',b:'',repeat:'1',referenceId,basis,pitchOverride:''};}
export function newArea(name:string,basis:Basis='actual'):Area{return {id:id('area'),name,pitch:'',basis,reference:null,components:[]};}
export function newJob(trade:Trade='roofing',units:Units='metric',basis:Basis='actual'):Job{
 const actualUnits=trade!=='roofing'&&units==='squares'?'imperial':units;
 const first=newArea(TRADE_COPY[trade].first,trade==='roofing'?basis:'actual');
 return {version:1,trade,units:actualUnits,currency:'NZD',title:'',components:exampleSpecs(CONFIGS[trade],actualUnits),areas:[first],selectedAreaId:first.id,choice:'examples'};
}
export function isBlank(e:Measurement){return e.mode==='reference'?!e.referenceId:!e.a.trim()&&!e.b.trim();}
function positive(value:string,label:string,integer=false){const n=Number(value);if(!value.trim()||!Number.isFinite(n)||n<=0||n>1e9||(integer&&!Number.isInteger(n)))throw Error(`${label}: enter ${integer?'a whole number':'a number'} greater than zero${integer?'':' (up to 1 billion)'}.`);return n;}
function dimensions(a:string,b:string,u:Units){return positive(a,'Length')*positive(b,'Width / height')/(u==='squares'?100:1);}
export function referenceValue(area:Area,units:Units):number|null{
 if(!area.reference)return null;
 try{return area.reference.mode==='total'?positive(area.reference.a,'Reference area'):dimensions(area.reference.a,area.reference.b,units);}catch{return null;}
}
export function referenceUsers(job:Job,areaId:string,externalOnly=false){return job.areas.filter(a=>!externalOnly||a.id!==areaId).flatMap(a=>a.components.flatMap(ac=>ac.entries.filter(e=>e.mode==='reference'&&e.referenceId===areaId).map(e=>({area:a,assignment:ac,entry:e}))));}
export interface EntryResult {id:string;label:string;raw:number;adjusted:number;repetitions:number;factor:number;basis:Basis;source:string;working:string;error?:string;blank:boolean}
export function calculateEntry(e:Measurement,c:Spec,a:Area,job:Job):EntryResult{
 const result:EntryResult={id:e.id,label:e.label||'Measurement',raw:0,adjusted:0,repetitions:0,factor:1,basis:e.basis,source:'',working:'',blank:isBlank(e)};
 if(result.blank)return result;
 try{
  const repeat=c.measurementType==='quantity'?1:positive(e.repeat,'Repeat',true);
  let base=0,basis=e.basis,pitch=e.pitchOverride||a.pitch,source='';
  if(c.measurementType==='area'&&e.mode==='reference'){
   const reference=job.areas.find(x=>x.id===e.referenceId);if(!reference||!reference.reference)throw Error('The linked area is missing. Choose a saved size or enter a measurement.');
   const value=referenceValue(reference,job.units);if(value===null)throw Error(`Complete the saved size for “${reference.name}”.`);
   base=value;basis=reference.reference.basis;pitch=reference.pitch;source=reference.name;
  }else if(c.measurementType==='area'&&e.mode==='dimensions')base=dimensions(e.a,e.b,job.units);
  else base=positive(e.a,c.measurementType==='quantity'?'Count':'Measurement',c.measurementType==='quantity');
  let factor=1;
  if(job.trade==='roofing'&&basis==='plan'&&c.pitchEnabled&&c.measurementType!=='quantity'){
   const deg=Number(pitch);if(!pitch.trim()||!Number.isFinite(deg)||deg<0||deg>=90)throw Error('Enter the roof pitch from 0° to less than 90°, or select actual measurements.');
   factor=c.pitchType==='valley_hip'?hipValleyPitchFactor(deg):rafterPitchFactor(deg);
  }
  const raw=base*repeat,adjusted=raw*factor;
  if(!Number.isFinite(adjusted)||adjusted>1e12)throw Error('This measurement is too large. Check the values and units.');
  const unit=specUnit(c.measurementType,job.units);
  return {...result,raw,adjusted,repetitions:repeat,factor,basis,source,working:`${e.mode==='dimensions'&&c.measurementType==='area'?`${e.a} × ${e.b} ${lengthUnit(job.units)}${job.units==='squares'?' ÷ 100':''}`:`${fmt(base)} ${unit}`}${repeat>1?` × ${repeat}`:''}${factor!==1?` × ${fmt(factor,4)} pitch`:''}`};
 }catch(err){return {...result,error:err instanceof Error?err.message:'Check this measurement.'};}
}
export interface ComponentResult {areaId:string;areaName:string;assignmentId:string;component:Spec;unit:string;entries:EntryResult[];raw:number;adjusted:number;waste:number;quantity:number;material:number;labour:number;total:number;packs:number;example:boolean;issues:string[];unused:boolean}
export interface JobResult {rows:ComponentResult[];areas:{area:Area;rows:ComponentResult[];total:number}[];material:number;labour:number;total:number;entryCount:number;issues:string[];hasExamples:boolean;unused:number;valid:boolean;}
function packsFor(q:number,size:number){const ratio=q/size,nearest=Math.round(ratio);return Math.abs(ratio-nearest)<=1e-10*Math.max(1,Math.abs(ratio))?nearest:Math.ceil(ratio);}
export function calculateJob(job:Job):JobResult{
 const result:JobResult={rows:[],areas:[],material:0,labour:0,total:0,entryCount:0,issues:[],hasExamples:false,unused:0,valid:false};
 for(const a of job.areas){
  const areaRows:ComponentResult[]=[];
  for(const ac of a.components){
   const c=job.components.find(x=>x.id===ac.componentId);if(!c){result.issues.push(`${a.name}: a component is no longer available.`);continue;}
   const entries=ac.entries.map(e=>calculateEntry(e,c,a,job));
   const good=entries.filter(e=>!e.blank&&!e.error),unused=entries.every(e=>e.blank);
   const issues=[...validateSpec(c,job.trade==='roofing'),...entries.filter(e=>e.error).map(e=>e.error!)];
   const raw=good.reduce((s,e)=>s+e.raw,0),adjusted=good.reduce((s,e)=>s+e.adjusted,0);
   // Fixed-total is once per assigned component/area. A repeated measurement
   // receives a per-entry allowance for every repetition, not just the UI row.
   const repetitions=good.reduce((s,e)=>s+e.repetitions,0);
   const waste=good.length?c.wasteType==='percent'?adjusted*c.wasteValue/100:c.wasteType==='fixed'?c.wasteValue:c.wasteType==='fixed_per_segment'?c.wasteValue*repetitions:0:0;
   const quantity=adjusted+waste;
   // Packs round per area: do not silently assume spare material in another room
   // is usable. This is quantity pricing, not carpet-roll/sheet cutting optimisation.
   const isPack=c.pricingStrategy!=='per_unit';
   const packs=isPack&&c.packSize&&quantity>0?packsFor(quantity,c.packSize):0;
   const material=isPack?packs*(c.packPrice??0):quantity*c.materialRate,labour=quantity*c.labourRate;
   if(![raw,adjusted,quantity,material,labour].every(n=>Number.isFinite(n)&&n>=0&&n<=1e15))issues.push('The calculated total is out of range. Check measurements and pricing.');
   const row:ComponentResult={areaId:a.id,areaName:a.name,assignmentId:ac.id,component:c,unit:specUnit(c.measurementType,job.units),entries,raw,adjusted,waste,quantity,material:issues.length?0:material,labour:issues.length?0:labour,total:issues.length?0:material+labour,packs,example:c.pricingOrigin!=='user',issues,unused};
   result.rows.push(row);areaRows.push(row);result.entryCount+=good.length;
   result.issues.push(...issues.map(e=>`${a.name} · ${c.name}: ${e}`));
   if(unused)result.unused++;
   result.material+=row.material;result.labour+=row.labour;
   if(!unused&&row.example)result.hasExamples=true;
  }
  result.areas.push({area:a,rows:areaRows,total:areaRows.reduce((s,r)=>s+r.total,0)});
 }
 result.total=result.material+result.labour;if(!Number.isFinite(result.total)||result.total>1e15)result.issues.push('The job total is out of range. Check the values and currency.');result.valid=result.entryCount>0&&!result.issues.length;return result;
}
export function addAssignment(area:Area,c:Spec,withReference=false):Area{
 if(area.components.some(ac=>ac.componentId===c.id))return area;
 return {...area,components:[...area.components,{id:id('group'),componentId:c.id,entries:[newMeasurement(c.measurementType,area.basis,withReference&&area.reference?area.id:'')]}]};
}
export function duplicateArea(area:Area,name:string):Area{
 const newId=id('area');return {...area,id:newId,name,reference:area.reference?{...area.reference}:null,components:area.components.map(ac=>({...ac,id:id('group'),entries:ac.entries.map(e=>({...e,id:id('entry'),referenceId:e.referenceId===area.id?newId:e.referenceId}))}))};
}
export function convertJob(job:Job,to:Units):Job{
 if(job.units===to)return job;if(job.trade!=='roofing'&&to==='squares')throw Error('Roofing squares are only available for roofing.');
 const from=job.units,linear=quantityFactor('lineal',to)/quantityFactor('lineal',from),areaFactor=quantityFactor('area',to)/quantityFactor('area',from);
 const convert=(v:string,factor:number)=>v.trim()&&Number.isFinite(Number(v))?cleanNumber(Number(v)*factor):v;
 return {...job,units:to,components:convertSpecs(job.components,from,to),areas:job.areas.map(a=>({...a,
  reference:a.reference?{...a.reference,a:convert(a.reference.a,a.reference.mode==='dimensions'?linear:areaFactor),b:convert(a.reference.b,linear)}:null,
  components:a.components.map(ac=>{const c=job.components.find(x=>x.id===ac.componentId);return {...ac,entries:ac.entries.map(e=>({...e,a:convert(e.a,c?.measurementType==='quantity'?1:c?.measurementType==='area'&&e.mode!=='dimensions'?areaFactor:linear),b:convert(e.b,linear)}))};})
 }))};
}
export function transferToQuote(job:Job,includePrices:boolean,ackExamples=false):{url:string;lines:ConvertibleLine[]}{
 const r=calculateJob(job);if(!r.valid)throw Error('Finish or correct the measurements before creating a quote.');
 if(includePrices&&r.hasExamples&&!ackExamples)throw Error('Confirm that example prices will be replaced in the quote.');
 const lines:ConvertibleLine[]=r.rows.filter(row=>!row.unused&&row.quantity>0).map(row=>({
  description:`${row.areaName}  -  ${row.component.name}${includePrices&&row.example?' · EXAMPLE PRICE  -  REPLACE':''}`,
  qty:row.quantity,unit:row.unit,rate:includePrices?row.total/row.quantity:0
 }));
 if(lines.length>500||lines.some(l=>l.qty>1e12||l.rate>1e12))throw Error('This estimate exceeds the quote importer’s limits. Export CSV or reduce the quantities before transferring.');
 const base=buildConvertUrl({targetPath:'/free-quote-generator',amount:includePrices?r.total:0,lines,ref:'measurement-to-quote-tool'});
 const params=new URLSearchParams(base.split('?')[1]);params.set('currency',job.currency);params.set('taxEnabled','false');params.set('taxRate','0');params.set('taxName','Tax');params.set('sourceLabel','Measurements to pricing');
 const url=`/free-quote-generator?${params.toString()}`;
 // Keep the existing quote URL contract; do not truncate large jobs silently.
 if(url.length>16000)throw Error('This estimate is too large for a safe URL transfer. Export CSV, or transfer fewer areas.');
 return {url,lines};
}
export function exampleJob(trade:Trade,units:Units='metric',currency:Currency='NZD'):Job{
 let j=newJob(trade);j.currency=currency;j.title=trade==='flooring'?'Living room & bedroom':trade==='cladding'?'Two elevations':'House & garage';
 const defs=trade==='roofing'?[['Main roof','120','Roof Area','Spouting','42'],['Detached garage','36','Roof Area','Spouting','24']]:trade==='cladding'?[['Front elevation  -  cedar','42','Horizontal Cladding - Cedar','Window Trim','12'],['Rear elevation  -  corrugate','36','Horizontal Cladding - Corrugate','Corner Trims','10']]:[['Living room','24','Carpet','Skirting','20'],['Bedroom 1','12','Carpet','Skirting','14']];
 j.areas=defs.map(([name,size,cover,linear],i)=>{
  let a=newArea(name);a.reference=trade==='flooring'?{mode:'dimensions',a:i?'4':'6',b:i?'3':'4',basis:'actual'}:{mode:'total',a:size,b:'',basis:'actual'};
  const names=[cover,trade==='flooring'?'Underlay':trade==='cladding'?'Building Wrap':'Ridge',linear];
  for(const name of names){const c=j.components.find(c=>c.name===name)!;a=addAssignment(a,c,c.measurementType==='area');const ac=a.components[a.components.length-1];if(c.measurementType==='lineal')ac.entries[0].a=name===linear?defs[i][4]:i?'6':'12';}
  return a;
 });j.selectedAreaId=j.areas[0].id;return convertJob(j,units);
}
export const DRAFT_KEY='qc-measurement-pricing-v1';
/** Parse only this local draft version; old builder data is never silently migrated. */
export function restoreJob(raw:string):Job|null{
 try{if(raw.length>3e6)return null;const j=JSON.parse(raw) as Job;
  if(j.version!==1||!Object.hasOwn(CONFIGS,j.trade)||!['metric','imperial','squares'].includes(j.units)||!TAKEOFF_CURRENCIES.includes(j.currency)||j.trade!=='roofing'&&j.units==='squares'||typeof j.title!=='string'||j.title.length>160||!Array.isArray(j.components)||!Array.isArray(j.areas)||!j.areas.length||j.areas.length>100||j.components.length>componentLimit(CONFIGS[j.trade]))return null;
  const ids=new Set<string>();const checkId=(x:unknown)=>{if(typeof x!=='string'||!x||x.length>180||ids.has(x))throw Error();ids.add(x);};
  for(const c of j.components){checkId(c.id);if(typeof c.name!=='string'||!['area','lineal','quantity'].includes(c.measurementType)||!['none','percent','fixed','fixed_per_segment'].includes(c.wasteType)||!['per_unit','per_pack_area','per_pack_length'].includes(c.pricingStrategy)||!['rafter','valley_hip'].includes(c.pitchType)||!['user','example'].includes(c.pricingOrigin??'example')||validateSpec(c,j.trade==='roofing').length)return null;}
  const strs=(o:Record<string,unknown>,ks:string[],max=160)=>ks.every(k=>typeof o[k]==='string'&&(o[k] as string).length<=max);
  for(const a of j.areas){checkId(a.id);if(!strs(a as unknown as Record<string,unknown>,['name','pitch'])||!a.name.trim()||!['actual','plan'].includes(a.basis)||!Array.isArray(a.components)||a.components.length>j.components.length)return null;
   if(a.reference&&(!['total','dimensions'].includes(a.reference.mode)||!['actual','plan'].includes(a.reference.basis)||!strs(a.reference as unknown as Record<string,unknown>,['a','b'])))return null;
   const assigned=new Set<string>();for(const ac of a.components){checkId(ac.id);if(!j.components.some(c=>c.id===ac.componentId)||assigned.has(ac.componentId)||!Array.isArray(ac.entries)||ac.entries.length>500)return null;assigned.add(ac.componentId);
    for(const e of ac.entries){checkId(e.id);if(!strs(e as unknown as Record<string,unknown>,['label','a','b','repeat','referenceId','pitchOverride'])||!['actual','plan'].includes(e.basis)||!['total','dimensions','reference'].includes(e.mode))return null;}}
  }
  j.selectedAreaId=j.areas.some(a=>a.id===j.selectedAreaId)?j.selectedAreaId:j.areas[0].id;j.choice=j.choice==='custom'?'custom':'examples';return j;
 }catch{return null;}
}
