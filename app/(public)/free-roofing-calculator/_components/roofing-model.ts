/**
 * Route-local state and validation for the Roofing Calculator refresh.
 * Geometry is delegated to the existing host functions. Nothing in the shared
 * pricing engine, other calculators, authentication or quotas is changed.
 * Input strings deliberately remain strings: clearing a field is not zero.
 */
import { rafterPitchFactor, hipValleyPitchFactor, rafterLength, hipValleyLength } from '../../lib/calculator';
import { calculateRidgeAngle, calculateHipValleyMultiPitch, calculateChangeOfPitch,
  calculateUpstandOntoRoof, calculateRoofIntoUpstand } from '@/app/lib/roofAngleCalculator';

export type Tab = 'area' | 'members' | 'battens' | 'pricing' | 'angles';
export type System = 'metric' | 'imperial';
export type Basis = 'plan' | 'surface';
export interface Pitch { mode: 'degrees' | 'ratio'; degrees: string; rise: string; run: string }
export interface AreaInputs { basis: Basis; entry: 'dimensions' | 'direct'; width: string; length: string; direct: string; pitch: Pitch }
export interface MemberInputs { kind: 'rafter' | 'hip'; run: string; diagonal: string; pitch: Pitch }
export interface BattenInputs extends AreaInputs { gauge: string; waste: string; source: string }
export type Measurement = 'area' | 'lineal' | 'quantity' | 'fixed' | 'length_x_height' | 'volume' | 'volume_3d' | 'hours_days' | 'count' | 'curved_line' | 'irregular_area' | 'multi_lineal' | 'multi_lineal_lxh' | 'length_x_height_freestyle' | 'multi_lineal_lxh_freestyle';
export interface PriceInputs {
  name: string; measurementType: Measurement; entry: 'direct' | 'dimensions'; amount: string;
  dimA: string; dimB: string; dimC: string; wasteType: 'none' | 'percent' | 'fixed' | 'fixed_per_segment';
  wasteValue: string; segments: string; pricingStrategy: 'per_unit' | 'per_pack_length' | 'per_pack_area' | 'per_pack_volume';
  packSize: string; price: string; labour: string; pitchEnabled: boolean; pitchType: 'rafter' | 'valley_hip';
  pitch: Pitch; source: string;
}
export type AngleKind = 'ridge' | 'hip' | 'change' | 'upstand' | 'into-upstand';
export interface AngleInputs { kind: AngleKind; pitch1: string; pitch2: string; samePitch: boolean; corner: string }
export interface RoofState {
  version: 1; tab: Tab; system: System; currency: string;
  area: AreaInputs; members: MemberInputs; battens: BattenInputs; pricing: PriceInputs; angles: AngleInputs;
}
export const STORAGE_KEY = 'qcp:roofing-calculator:v1';
export const TABS: { id: Tab; label: string; description: string; icon: string }[] = [
  { id: 'area', label: 'Roof area', description: 'From plan to surface', icon: 'area' },
  { id: 'members', label: 'Rafters & hips', description: 'Sloping lengths', icon: 'ruler' },
  { id: 'battens', label: 'Battens', description: 'Spacing to quantity', icon: 'battens' },
  { id: 'pricing', label: 'Material pricing', description: 'A Smart Component™ draft', icon: 'calculator' },
  { id: 'angles', label: 'Flashing angles', description: 'Junctions & bends', icon: 'angle' },
];
export const MEASUREMENTS: { value: Measurement; label: string; power: number }[] = [
  {value:'area', label:'Area', power:2}, {value:'lineal',label:'Linear length',power:1},
  {value:'quantity',label:'Quantity',power:0},{value:'fixed',label:'Fixed quantity',power:0},
  {value:'length_x_height',label:'Length × height',power:2},{value:'volume',label:'Volume / preset depth',power:3},
  {value:'volume_3d',label:'Volume / 3 dimensions',power:3},{value:'hours_days',label:'Labour hours',power:0},
  {value:'count',label:'Count (each)',power:0},{value:'curved_line',label:'Curved length',power:1},
  {value:'irregular_area',label:'Irregular area',power:2},{value:'multi_lineal',label:'Multiple lengths',power:1},
  {value:'multi_lineal_lxh',label:'Multiple length × height',power:2},
  {value:'length_x_height_freestyle',label:'Custom length × height',power:2},
  {value:'multi_lineal_lxh_freestyle',label:'Multiple custom length × height',power:2},
];
export const CURRENCIES = ['GBP','USD','EUR','AUD','NZD','CAD'] as const;
export const makePitch = (degrees='25'): Pitch => ({ mode:'degrees', degrees, rise:'6', run:'12' });
const makeArea = (): AreaInputs => ({basis:'plan',entry:'dimensions',width:'',length:'',direct:'',pitch:makePitch()});
export function initialState(): RoofState {
  return { version:1,tab:'area',system:'metric',currency:'GBP',area:makeArea(),
    members:{kind:'rafter',run:'',diagonal:'',pitch:makePitch()},
    battens:{...makeArea(),gauge:'345',waste:'10',source:''},
    pricing:{name:'Roof covering',measurementType:'area',entry:'direct',amount:'',dimA:'',dimB:'',dimC:'',
      wasteType:'percent',wasteValue:'10',segments:'1',pricingStrategy:'per_unit',packSize:'',price:'',labour:'',
      pitchEnabled:false,pitchType:'rafter',pitch:makePitch(),source:''},
    angles:{kind:'ridge',pitch1:'25',pitch2:'25',samePitch:true,corner:'90'} };
}
export const unitLabels = (s:System) => ({length:s==='metric'?'m':'ft',area:s==='metric'?'m²':'ft²',volume:s==='metric'?'m³':'ft³',gauge:s==='metric'?'mm':'in'});
export const powerOf = (m:Measurement) => MEASUREMENTS.find(x=>x.value===m)?.power ?? 0;
export function measurementUnit(m:Measurement,s:System): string {
  const p=powerOf(m),u=unitLabels(s);return p===3?u.volume:p===2?u.area:p===1?u.length:m==='hours_days'?'hrs':'each';
}
export function format(n:number, digits=2):string { return new Intl.NumberFormat('en-GB',{maximumFractionDigits:digits,minimumFractionDigits:digits}).format(n); }
export function money(n:number,currency:string):string {return new Intl.NumberFormat('en-GB',{style:'currency',currency,minimumFractionDigits:2,maximumFractionDigits:2}).format(n);}
export function numericText(n:number): string {
  if(!Number.isFinite(n))return String(n);
  // Prefer the shortest value within conversion noise, e.g. 10 rather than
  // 9.99999999999 after a unit round-trip. Never round results to money precision.
  const tolerance=5e-12*Math.max(1,Math.abs(n));
  for(let digits=1;digits<12;digits++){const candidate=Number(n.toPrecision(digits));if(Math.abs(candidate-n)<=tolerance)return String(candidate);}
  return Number(n.toPrecision(12)).toString();
}
export function pitchValue(p:Pitch):number {return p.mode==='degrees'?Number(p.degrees):Math.atan(Number(p.rise)/Number(p.run))*180/Math.PI;}
export function pitchMode(p:Pitch,mode:Pitch['mode']):Pitch {
  if(mode===p.mode)return p;
  const d=pitchValue(p);
  if(!Number.isFinite(d)||d<0||d>89)return {...p,mode};
  return mode==='ratio'?{...p,mode,rise:numericText(Math.tan(d*Math.PI/180)*12),run:'12'}:{...p,mode,degrees:numericText(d)};
}
export interface Metric {label:string;value:number;unit?:string;digits?:number}
export interface Result {
  label:string; value:number; unit:string; power:number; metrics:Metric[]; notes:string[];
  formula:string; summary:string; pitch?:number; area?:number; plan?:number; factor?:number;
  price?: {rawValue:number;wasteAmount:number;totalValue:number;pricedQuantity:number;materialCost:number;labourCost:number;totalCost:number;unit:string};
}
export interface Calculation {status:'empty'|'invalid'|'ready';errors:Record<string,string>;missing:string[];result:Result|null}
class Inputs {
  errors:Record<string,string>={}; missing:string[]=[];
  number(key:string,label:string,value:string,min=0,max=1e9,allowZero=false,optional=false):number {
    if(value.trim()===''){if(optional)return 0;this.missing.push(label);return 0;}
    const n=Number(value);
    if(!Number.isFinite(n)||n<min||(!allowZero&&n===0)||n>max){this.errors[key]=max===89?'Use a pitch from 0° to 89°.':n>max?`Enter a value no greater than ${max}.`:allowZero?'Enter a number of zero or more.':'Enter a number greater than zero.';return 0;}
    return n;
  }
  pitch(p:Pitch):number {
    if(p.mode==='degrees')return this.number('pitch','roof pitch',p.degrees,0,89,true);
    const rise=this.number('rise','rise',p.rise,0,1e9,true),run=this.number('run','run',p.run);
    const d=Math.atan(rise/run)*180/Math.PI;
    if(run>0&&d>89)this.errors.rise='This ratio gives a pitch above 89°.';
    return Number.isFinite(d)?d:0;
  }
  finish(result:Result):Calculation {
    if(Object.keys(this.errors).length)return {status:'invalid',errors:this.errors,missing:this.missing,result:null};
    if(this.missing.length)return {status:'empty',errors:{},missing:this.missing,result:null};
    if(!Number.isFinite(result.value)||Math.abs(result.value)>1e15||result.metrics.some(x=>!Number.isFinite(x.value))){return{status:'invalid',errors:{total:'These values are too large to calculate reliably.'},missing:[],result:null};}
    return {status:'ready',errors:{},missing:[],result};
  }
}
function areaValues(a:AreaInputs,v:Inputs) {
  const measured=a.entry==='dimensions'?v.number('width','width',a.width)*v.number('length','length',a.length):v.number('direct',a.basis==='plan'?'plan area':'measured roof area',a.direct);
  const deg=a.basis==='plan'?v.pitch(a.pitch):0;
  const factor=a.basis==='plan'?rafterPitchFactor(deg):1;
  return {measured,deg,factor,actual:measured*factor};
}
export function calculateArea(a:AreaInputs,s:System):Calculation {
  const v=new Inputs(),u=unitLabels(s),{measured,deg,factor,actual}=areaValues(a,v);
  return v.finish({label:'Roof surface area',value:actual,unit:u.area,power:2,area:actual,plan:measured,factor,pitch:deg,
    metrics:[{label:a.basis==='plan'?'Plan area':'Measured surface',value:measured,unit:u.area},{label:'Pitch factor',value:factor,unit:'×',digits:4}],
    notes:[a.basis==='plan'?'Pitch applied once. Enter the full roof footprint, including any overhangs you want to include.':'This is already the sloping surface area. No pitch adjustment is applied.','Waste is not included. Add a waste allowance when pricing materials.'],
    formula:a.basis==='plan'?`${format(measured)} ${u.area} ÷ cos(${format(deg,1)}°) = ${format(actual)} ${u.area}`:`Measured roof surface = ${format(actual)} ${u.area}`,
    summary:'Single-pitch calculation. Calculate differently pitched sections separately and add their surface areas.'});
}
export function calculateMembers(a:MemberInputs,s:System):Calculation {
  const v=new Inputs(),u=unitLabels(s),p=v.pitch(a.pitch);
  const plan=a.kind==='rafter'?v.number('run','horizontal run',a.run):v.number('diagonal','plan diagonal',a.diagonal);
  const factor=a.kind==='rafter'?rafterPitchFactor(p):hipValleyPitchFactor(p);
  const actual=a.kind==='rafter'?rafterLength(plan,p):hipValleyLength(plan,p);
  return v.finish({label:a.kind==='rafter'?'Rafter length':'Hip / valley length',value:actual,unit:u.length,power:1,pitch:p,plan,factor,
    metrics:[{label:a.kind==='rafter'?'Horizontal run':'Plan diagonal',value:plan,unit:u.length},{label:'Length factor',value:factor,unit:'×',digits:4}],
    notes:a.kind==='rafter'?['Run means wall to ridge, not the full building width.','This is a geometric length. Allow separately for overhangs, ridge thickness, cuts and connections.']:['For equal roof pitches at a 90° plan corner.','Use the diagonal measured in plan, not the straight wall-to-ridge run.'],
    formula:`${format(plan)} ${u.length} × ${format(factor,4)} = ${format(actual)} ${u.length}`,
    summary:'Geometry only. Not a structural design or a cutting schedule.'});
}
export function calculateBattens(a:BattenInputs,s:System):Calculation {
  const v=new Inputs(),u=unitLabels(s),{measured,deg,factor,actual}=areaValues(a,v);
  const gauge=v.number('gauge','batten gauge',a.gauge),waste=v.number('waste','waste percentage',a.waste,0,1000,true);
  const gaugeLength=s==='metric'?gauge/1000:gauge/12;
  const raw=gaugeLength>0?actual/gaugeLength:0,total=raw*(1+waste/100);
  return v.finish({label:'Batten length to allow',value:total,unit:u.length,power:1,area:actual,plan:measured,pitch:deg,factor,
    metrics:[{label:'Roof surface',value:actual,unit:u.area},{label:'Before waste',value:raw,unit:u.length},{label:`Waste allowance (${format(waste,1)}%)`,value:total-raw,unit:u.length}],
    notes:['Area ÷ gauge is a planning estimate, not an exact row count.','Check gauge against the selected covering manufacturer. Add extra lengths for edges, junctions and any counter-battens.'],
    formula:`${format(actual)} ${u.area} ÷ ${format(gaugeLength,4)} ${u.length} × ${numericText(1+waste/100)} = ${format(total)} ${u.length}`,
    summary:'Batten gauge is the spacing up the roof slope. No stock-length or cutting optimisation is included.'});
}
export function calculatePricing(a:PriceInputs,s:System,currency:string):Calculation {
  const v=new Inputs(),u=measurementUnit(a.measurementType,s),power=powerOf(a.measurementType);
  let raw=a.entry==='dimensions'&&power>1?v.number('dimA','length',a.dimA)*v.number('dimB',power===2?'width / height':'width',a.dimB)*(power===3?v.number('dimC','depth',a.dimC):1):v.number('amount','measurement',a.amount);
  let factor=1,p=0;
  if(a.pitchEnabled&&(power===1||power===2)){p=v.pitch(a.pitch);factor=power===1&&a.pitchType==='valley_hip'?hipValleyPitchFactor(p):rafterPitchFactor(p);raw*=factor;}
  const waste=a.wasteType==='none'?0:v.number('wasteValue','waste allowance',a.wasteValue,0,1e9,true);
  const segments=a.wasteType==='fixed_per_segment'?v.number('segments','number of segments',a.segments,1,100000):1;
  if(!Number.isInteger(segments))v.errors.segments='Enter a whole number of segments.';
  const wasteAmount=a.wasteType==='percent'?raw*waste/100:a.wasteType==='fixed_per_segment'?waste*segments:waste;
  const totalValue=raw+wasteAmount;
  const size=a.pricingStrategy==='per_unit'?1:v.number('packSize','pack size',a.packSize);
  const packRatio=size>0?totalValue/size:0;
  // Unit conversion must not turn an exact pack boundary into an extra pack.
  const roundedRatio=Math.abs(packRatio-Math.round(packRatio))<=1e-10*Math.max(1,Math.abs(packRatio))?Math.round(packRatio):packRatio;
  const pricedQuantity=a.pricingStrategy==='per_unit'?totalValue:Math.ceil(roundedRatio);
  const price=v.number('price','material rate',a.price,0,1e9,true),labour=v.number('labour','labour amount',a.labour,0,1e9,true,true);
  const materialCost=pricedQuantity*price,totalCost=materialCost+labour;
  const priceResult={rawValue:raw,wasteAmount,totalValue,pricedQuantity,materialCost,labourCost:labour,totalCost,unit:u};
  return v.finish({label:'Estimated materials + labour',value:totalCost,unit:currency,power:0,price:priceResult,pitch:p,factor,
    metrics:[{label:'Measured quantity',value:raw,unit:u},{label:'Waste allowance',value:wasteAmount,unit:u},{label:a.pricingStrategy==='per_unit'?'Quantity with waste':'Whole packs to allow',value:pricedQuantity,unit:a.pricingStrategy==='per_unit'?u:'packs'},
      {label:'Materials',value:materialCost,unit:currency},{label:'Labour (fixed)',value:labour,unit:currency}],
    notes:['An estimate before tax, profit margin or delivery. Review these before creating a customer quote.',a.pricingStrategy==='per_unit'?'The material rate applies to one measurement unit.':'Pack quantities round up to whole packs; the material rate is per pack.'],
    formula:`${format(pricedQuantity)} ${a.pricingStrategy==='per_unit'?u:'packs'} × ${money(price,currency)} + ${money(labour,currency)} labour = ${money(totalCost,currency)}`,
    summary:a.pitchEnabled?'The selected pitch adjustment is applied before waste.':'The measurement is used as entered; no additional pitch adjustment.'});
}
export function calculateAngles(a:AngleInputs):Calculation {
  const v=new Inputs(),p1=v.number('pitch1',a.kind==='change'?'upper pitch':'roof pitch',a.pitch1,0,89,true);
  const two=['ridge','hip','change'].includes(a.kind),p2=two?(a.samePitch&&a.kind!=='change'?p1:v.number('pitch2',a.kind==='change'?'lower pitch':'second pitch',a.pitch2,0,89,true)):p1;
  const corner=a.kind==='hip'?v.number('corner','plan corner angle',a.corner,0,179.999):90;
  const r=a.kind==='ridge'?calculateRidgeAngle(p1,p2):a.kind==='hip'?calculateHipValleyMultiPitch(p1,p2,corner):a.kind==='change'?calculateChangeOfPitch(p1,p2):a.kind==='upstand'?calculateUpstandOntoRoof(p1):calculateRoofIntoUpstand(p1);
  return v.finish({label:'Finished included angle',value:r.finishedAngle,unit:'°',power:0,pitch:p1,
    metrics:[{label:'Bend from flat',value:r.bendAngleFromFlat,unit:'°',digits:1},{label:'Outside / reflex angle',value:r.exterior,unit:'°',digits:1}],
    notes:[`Bend direction: ${r.bendDirection==='none'?'straight (no bend)':r.bendDirection}.`,'Confirm orientation, material and fabrication requirements before ordering flashings.'],
    formula:a.kind==='ridge'?`180° − ${p1}° − ${p2}° = ${r.finishedAngle}°`:a.kind==='change'?`180° − ${p1}° + ${p2}° = ${r.finishedAngle}°`:a.kind==='upstand'?`90° + ${p1}° = ${r.finishedAngle}°`:a.kind==='into-upstand'?`90° − ${p1}° = ${r.finishedAngle}°`:`Existing multi-pitch roof-plane calculation at a ${corner}° plan corner.`,
    summary:'Finished included angle and bend-from-flat are different measurements. Check which one your fabricator needs.'});
}
export function calculate(state:RoofState):Calculation {
  return state.tab==='area'?calculateArea(state.area,state.system):state.tab==='members'?calculateMembers(state.members,state.system):state.tab==='battens'?calculateBattens(state.battens,state.system):state.tab==='pricing'?calculatePricing(state.pricing,state.system,state.currency):calculateAngles(state.angles);
}
// Use one dimensional conversion factor throughout, including inverse rates.
// Keeping powers coherent avoids area/rate drift from separately rounded factors.
export function unitFactor(power:number,from:System,to:System):number {return from===to?1:Math.pow(from==='metric'?1/0.3048:0.3048,power);}
function converted(value:string,power:number,from:System,to:System):string {
  if(value.trim()===''||!Number.isFinite(Number(value))||!power)return value;
  return numericText(Number(value)*unitFactor(power,from,to));
}
/** Convert measurements AND per-unit rates. Never silently relabel an existing number. */
export function convertSystem(state:RoofState,to:System):RoofState {
  const from=state.system;if(from===to)return state;
  const c=(value:string,power:number)=>converted(value,power,from,to);
  const area=(a:AreaInputs)=>({...a,width:c(a.width,1),length:c(a.length,1),direct:c(a.direct,2)});
  const p=state.pricing,power=powerOf(p.measurementType);
  const multiplier=unitFactor(power,from,to);
  return {...state,system:to,area:area(state.area),members:{...state.members,run:c(state.members.run,1),diagonal:c(state.members.diagonal,1)},
    battens:{...state.battens,...area(state.battens),gauge:state.battens.gauge.trim()===''||!Number.isFinite(Number(state.battens.gauge))?state.battens.gauge:numericText(Number(state.battens.gauge)*(to==='imperial'?1/25.4:25.4))},
    pricing:{...p,amount:c(p.amount,power),dimA:c(p.dimA,1),dimB:c(p.dimB,1),dimC:c(p.dimC,1),packSize:c(p.packSize,power),
      wasteValue:p.wasteType==='fixed'||p.wasteType==='fixed_per_segment'?c(p.wasteValue,power):p.wasteValue,
      price:p.pricingStrategy==='per_unit'&&p.price.trim()!==''&&Number.isFinite(Number(p.price))?numericText(Number(p.price)/multiplier):p.price}};
}
export function exampleFor(state:RoofState):RoofState {
  const metric=state.system==='metric'?state:convertSystem(state,'metric');
  let next:RoofState={...metric};
  const a={...makeArea(),width:'10',length:'8',pitch:makePitch('35')};
  if(state.tab==='area')next.area=a;
  if(state.tab==='members')next.members={kind:state.members.kind,run:'5',diagonal:'7.07106781187',pitch:makePitch('35')};
  if(state.tab==='battens')next.battens={...a,gauge:'345',waste:'10',source:''};
  if(state.tab==='pricing')next.pricing={...initialState().pricing,amount:numericText(80*rafterPitchFactor(35)),price:'2.50',source:'Example roof · surface area; pitch already included'};
  if(state.tab==='angles')next.angles={...initialState().angles,kind:state.angles.kind,pitch2:state.angles.kind==='change'?'10':'25'};
  return state.system==='metric'?next:convertSystem(next,'imperial');
}
export function resetActive(state:RoofState):RoofState {
  const defaults=state.system==='metric'?initialState():convertSystem(initialState(),'imperial');
  return {...state,[state.tab]:defaults[state.tab]};
}
export function transferToPricing(state:RoofState,r:Result):RoofState {
  if(![1,2,3].includes(r.power))return state;
  return {...state,tab:'pricing',pricing:{...state.pricing,measurementType:r.power===2?'area':r.power===3?'volume_3d':'lineal',entry:'direct',amount:numericText(r.value),
    name:state.tab==='battens'?'Roof battens':state.tab==='members'?r.label:'Roof covering',pitchEnabled:false,pitchType:'rafter',
    // Batten total includes waste; do not add it again automatically.
    wasteType:state.tab==='battens'?'none':state.pricing.wasteType,
    price:'',pricingStrategy:'per_unit',packSize:'',source:`${r.label} · ${format(r.value)} ${r.unit}${state.tab==='battens'?' · waste already included':''}${state.tab==='area'?' · pitch already included':''}`}};
}
export function transferToBattens(state:RoofState,r:Result):RoofState {
  if(r.power!==2)return state;
  return {...state,tab:'battens',battens:{...state.battens,basis:'surface',entry:'direct',direct:numericText(r.value),source:`From roof area · ${format(r.value)} ${r.unit}. Pitch is already included.`}};
}
export function quoteHref(state:RoofState,r:Result):string {
  const params=new URLSearchParams({ref:'free-roofing-calculator',currency:state.currency});
  if(state.tab==='pricing'&&r.price){
    const p=state.pricing,lines=[{description:p.name.trim()||'Roofing material',qty:Number(numericText(r.price.pricedQuantity)),unit:p.pricingStrategy==='per_unit'?r.price.unit:'packs',rate:Number(p.price)}];
    if(r.price.labourCost>0)lines.push({description:`Labour — ${p.name.trim()||'roofing work'}`,qty:1,unit:'job',rate:r.price.labourCost});
    params.set('lines',JSON.stringify(lines));
  }else {params.set('qty',numericText(r.value));params.set('unit',r.unit);}
  return '/free-quote-generator?'+params.toString();
}
export function resultText(state:RoofState,r:Result):string {
  const value=state.tab==='pricing'?money(r.value,state.currency):`${format(r.value,r.unit==='°'?1:2)} ${r.unit}`;
  return ['QuoteCore+ · Roofing Calculator',r.label+': '+value,...r.metrics.map(m=>`${m.label}: ${CURRENCIES.includes(m.unit as typeof CURRENCIES[number])?money(m.value,m.unit!):format(m.value,m.digits??2)+' '+(m.unit??'')}`),'',r.formula,'',r.summary,...r.notes].join('\n');
}
/** Existing smart-component draft envelope, normalised to SI for the app.
 * UI-only fields travel separately; app spec names remain compatible.
 */
export function componentPayload(state:RoofState,forDownload=false):Record<string,unknown> {
  const s=convertSystem(state,'metric'),p=s.pricing,c=calculatePricing(p,'metric',s.currency);
  if(!c.result?.price)throw new Error('Complete the material pricing first.');
  if(!forDownload&&p.wasteType==='fixed_per_segment'&&Number(p.segments)!==1)throw new Error('Multi-segment waste can be estimated here, but saving its per-segment rule needs app-side verification. Download this draft for review instead.');
  return {slug:'free-roofing-calculator',savedAt:new Date().toISOString(),data:{
    spec:{name:p.name,measurementType:p.measurementType,wasteType:p.wasteType,wasteValue:p.wasteValue,pricePerUnit:p.price,pricingStrategy:p.pricingStrategy,packSize:p.packSize,labourAmount:p.labour,
      pitchEnabled:p.pitchEnabled,pitchType:p.pitchType,pitchDegrees:numericText(pitchValue(p.pitch))},
    result:c.result.price,areaInput:powerOf(p.measurementType)>1?numericText(measurementBeforePitch(p)):'',linearInput:powerOf(p.measurementType)===1?p.amount:'',quantityInput:powerOf(p.measurementType)===0?p.amount:'',
    currencyCode:s.currency,unitSystem:'metric',roofingCalculatorVersion:1,
    ...(forDownload?{calculatorInputs:s.pricing,reviewRequired:p.wasteType==='fixed_per_segment'&&Number(p.segments)!==1}: {})}};
}
function measurementBeforePitch(p:PriceInputs):number {
  return p.entry==='dimensions'&&powerOf(p.measurementType)>1?Number(p.dimA)*Number(p.dimB)*(powerOf(p.measurementType)===3?Number(p.dimC):1):Number(p.amount);
}
/** Strict restoration: reject unknown enum values, oversized strings and wrong
 * shapes. This is browser convenience, not a trusted server entitlement. */
export function restoreState(raw:string|null):RoofState|null {
  if(!raw||raw.length>40000)return null;
  try{
    const value=JSON.parse(raw),defaults=initialState();
    function validate(v:unknown,d:unknown):boolean{
      if(typeof d==='string')return typeof v==='string'&&v.length<=300;
      if(typeof d==='boolean'||typeof d==='number')return typeof v===typeof d;
      if(!v||typeof v!=='object'||Array.isArray(v))return false;
      return Object.entries(d as Record<string,unknown>).every(([k,x])=>validate((v as Record<string,unknown>)[k],x));
    }
    if(!validate(value,defaults)||value.version!==1||!TABS.some(t=>t.id===value.tab)||!['metric','imperial'].includes(value.system)||!CURRENCIES.includes(value.currency))return null;
    for(const a of [value.area,value.battens])if(!['plan','surface'].includes(a.basis)||!['direct','dimensions'].includes(a.entry))return null;
    for(const p of [value.area.pitch,value.members.pitch,value.battens.pitch,value.pricing.pitch])if(!['degrees','ratio'].includes(p.mode))return null;
    if(!['rafter','hip'].includes(value.members.kind)||!['ridge','hip','change','upstand','into-upstand'].includes(value.angles.kind))return null;
    if(!MEASUREMENTS.some(m=>m.value===value.pricing.measurementType)||!['none','percent','fixed','fixed_per_segment'].includes(value.pricing.wasteType)||!['per_unit','per_pack_length','per_pack_area','per_pack_volume'].includes(value.pricing.pricingStrategy)||!['rafter','valley_hip'].includes(value.pricing.pitchType)||!['direct','dimensions'].includes(value.pricing.entry))return null;
    // Copy only known schema keys (no prototype pollution / unexpected state).
    function clean(v:Record<string,unknown>,d:Record<string,unknown>):Record<string,unknown>{return Object.fromEntries(Object.entries(d).map(([k,x])=>[k,x&&typeof x==='object'?clean(v[k] as Record<string,unknown>,x as Record<string,unknown>):v[k]]));}
    return clean(value,defaults as unknown as Record<string,unknown>) as unknown as RoofState;
  }catch{return null;}
}
