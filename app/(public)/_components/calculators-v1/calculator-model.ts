/**
 * Shared state and validation for Construction and Birdsmouth. No host engine changes.
 * Geometry is delegated to the existing host functions. Nothing in the shared
 * pricing engine, other calculators, authentication or quotas is changed.
 * Input strings deliberately remain strings: clearing a field is not zero.
 */
import { rafterPitchFactor, hipValleyPitchFactor, rafterLength } from '@/app/(public)/lib/calculator';
import { calculateRidgeAngle, calculateHipValleyMultiPitch, calculateChangeOfPitch,
  calculateUpstandOntoRoof, calculateRoofIntoUpstand } from '@/app/lib/roofAngleCalculator';

import { profileFor, type Trade, type Tab } from './calculator-profile';
export type { Trade, Tab } from './calculator-profile';
export type System = 'metric' | 'imperial';
export type Basis = 'plan' | 'surface';
export interface Pitch { mode: 'degrees' | 'ratio'; degrees: string; rise: string; run: string }
export interface AreaInputs { surface: 'floor' | 'wall' | 'slope'; deduction: string; basis: Basis; entry: 'dimensions' | 'direct'; width: string; length: string; direct: string; pitch: Pitch }
export interface MemberInputs { kind: 'rafter' | 'birdsmouth'; run: string; pitch: Pitch; seat: string; depth: string; limit: 'third' | 'quarter' | 'custom'; limitPercent: string }
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
export interface CalculatorState {
  version: 1; trade: Trade; tab: Tab; system: System; currency: string;
  area: AreaInputs; members: MemberInputs; battens: BattenInputs; pricing: PriceInputs; angles: AngleInputs;
}
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
const makeArea = (): AreaInputs => ({surface:'floor',deduction:'',basis:'surface',entry:'dimensions',width:'',length:'',direct:'',pitch:makePitch('0')});
export function initialState(trade: Trade = 'construction'): CalculatorState {
  return { version: 1, trade, tab: trade === 'birdsmouth' ? 'members' : 'area', system: 'metric', currency: 'GBP', area: makeArea(),
    members: { kind: trade === 'birdsmouth' ? 'birdsmouth' : 'rafter', run: '', pitch: makePitch('35'), seat: '', depth: '', limit: 'third', limitPercent: '' },
    battens: { ...makeArea(), gauge: '600', waste: '10', source: '' },
    pricing: { name: trade === 'birdsmouth' ? 'Rafter timber' : 'Building material', measurementType: trade === 'birdsmouth' ? 'lineal' : 'area', entry: 'direct', amount: '', dimA: '', dimB: '', dimC: '',
      wasteType: 'percent', wasteValue: '10', segments: '1', pricingStrategy: 'per_unit', packSize: '', price: '', labour: '',
      pitchEnabled: false, pitchType: 'rafter', pitch: makePitch('35'), source: '' },
    angles: { kind: 'ridge', pitch1: '30', pitch2: '30', samePitch: true, corner: '90' } };
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
export function pitchValue(p:Pitch):number {
  if(p.mode==='degrees')return p.degrees.trim()===''?NaN:Number(p.degrees);
  if(p.rise.trim()===''||p.run.trim()===''||Number(p.run)<=0||Number(p.rise)<0)return NaN;
  return Math.atan(Number(p.rise)/Number(p.run))*180/Math.PI;
}
export function pitchMode(p:Pitch,mode:Pitch['mode']):Pitch {
  if(mode===p.mode)return p;
  const d=pitchValue(p);
  if(!Number.isFinite(d)||d<0||d>89)return mode==='ratio'?{...p,mode,rise:'',run:'12'}:{...p,mode,degrees:''};
  return mode==='ratio'?{...p,mode,rise:numericText(Math.tan(d*Math.PI/180)*12),run:'12'}:{...p,mode,degrees:numericText(d)};
}
export interface Metric {label:string;value:number;unit?:string;digits?:number}
export interface Result {
  label:string; value:number; unit:string; power:number; metrics:Metric[]; notes:string[];
  formula:string; summary:string; pitch?:number; area?:number; plan?:number; factor?:number;
  cut?: { seat:number; depth:number; verticalCut:number; notch:number; remaining:number; hap:number; allowance:number; fraction:number; exceeds:boolean };
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
    if(p.mode==='degrees')return this.number('pitch','pitch / angle',p.degrees,0,89,true);
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
function areaValues(a: AreaInputs, v: Inputs) {
  const measured = a.entry === 'dimensions'
    ? v.number('width', 'width', a.width) * v.number('length', a.surface === 'wall' ? 'height' : 'length', a.length)
    : v.number('direct', a.basis === 'plan' ? 'plan area' : 'measured surface area', a.direct);
  const deg = a.surface === 'slope' && a.basis === 'plan' ? v.pitch(a.pitch) : 0;
  const factor = a.surface === 'slope' && a.basis === 'plan' ? rafterPitchFactor(deg) : 1;
  const gross = measured * factor;
  const deduction = v.number('deduction', 'opening area', a.deduction, 0, 1e9, true, true);
  if (!v.missing.length && deduction > gross + 1e-10 * Math.max(1, gross)) v.errors.deduction = 'Openings cannot be larger than the measured surface.';
  return { measured, deg, factor, gross, deduction, actual: Math.max(0, gross - deduction) };
}
export function calculateArea(a: AreaInputs, s: System): Calculation {
  const v = new Inputs(), u = unitLabels(s), { measured, deg, factor, gross, deduction, actual } = areaValues(a, v);
  return v.finish({ label: deduction > 0 ? 'Net surface area' : 'Surface area', value: actual, unit: u.area, power: 2, area: actual, plan: measured, pitch: deg, factor,
    metrics: [ { label: a.basis === 'plan' && a.surface === 'slope' ? 'Flat plan area' : 'Measured area', value: measured, unit: u.area },
      ...(a.surface === 'slope' && a.basis === 'plan' ? [{ label: 'Slope factor', value: factor, unit: '×', digits: 4 }] : []),
      ...(deduction > 0 ? [{ label: 'Gross surface area', value: gross, unit: u.area }, { label: 'Openings deducted', value: deduction, unit: u.area }] : []) ],
    notes: ['No waste, cutting layout or product coverage is included. Add those in Material pricing.', ...(actual === 0 ? ['The openings use the entire measured area. There is no net area to transfer.'] : [])],
    formula: `${format(measured)} ${u.area} × ${format(factor, 4)} − ${format(deduction)} ${u.area} = ${format(actual)} ${u.area}`,
    summary: a.surface === 'slope' && a.basis === 'plan' ? 'Flat plan area is divided by cos(angle). Measured opening areas are deducted afterwards.' : 'Surface dimensions are used directly. No slope factor is applied to a wall, floor or already-measured surface.' });
}
export function calculateBirdsmouth(a: MemberInputs, s: System): Calculation {
  const v = new Inputs(), deg = v.pitch(a.pitch), seat = v.number('seat', 'horizontal seat length', a.seat), depth = v.number('depth', 'actual rafter depth', a.depth);
  if (Number.isFinite(pitchValue(a.pitch)) && deg <= 0) v.errors.pitch = 'A birdsmouth needs a pitch greater than 0° and no greater than 89°.';
  const fraction = a.limit === 'third' ? 1 / 3 : a.limit === 'quarter' ? 1 / 4 : v.number('limitPercent', 'comparison percentage', a.limitPercent, 0, 100) / 100;
  const theta = deg * Math.PI / 180, notch = seat * Math.sin(theta), verticalCut = seat * Math.tan(theta), remaining = depth - notch;
  const hap = remaining / Math.cos(theta), allowance = depth * fraction;
  const exceeds = notch > allowance + 1e-10 * Math.max(1, allowance);
  if (seat > 0 && depth > 0 && remaining <= 0) v.errors.depth = 'This notch removes the entire rafter depth. Check the pitch, seat length and timber depth.';
  const unit = unitLabels(s).gauge;
  return v.finish({ label: 'Perpendicular notch depth', value: notch, unit, power: 0, pitch: deg,
    cut: { seat, depth, verticalCut, notch, remaining, hap, allowance, fraction, exceeds },
    metrics: [ { label: 'Seat angle · from rafter edge', value: deg, unit: '°', digits: 2 },
      { label: 'Plumb angle · from rafter edge', value: 90 - deg, unit: '°', digits: 2 },
      { label: 'Vertical heel cut', value: verticalCut, unit },
      { label: 'Timber remaining · perpendicular', value: remaining, unit },
      { label: 'Height above seat at heel · vertical', value: hap, unit } ],
    notes: [ 'Planning geometry only. Not a structural pass, saw setting or full-size cutting template.',
      `${exceeds ? 'Exceeds' : 'Within'} the selected ${format(fraction * 100, 2)}% depth comparison (${format(allowance)} ${unit}). This is not building-code approval.`,
      'Verify bearing, timber product, loads, overhang and the required detail before making a cut. Do not assume this approves engineered timber or stair stringers.' ],
    formula: `Notch = ${format(seat)} × sin(${format(deg)}°) = ${format(notch)} ${unit}. Vertical heel cut = seat × tan(pitch). HAP = (depth − notch) ÷ cos(pitch).`,
    summary: 'Seat is horizontal. Timber depth and notch depth are perpendicular to the rafter. Vertical heel cut and HAP are vertical; they are different dimensions.' });
}
export function calculateMembers(a: MemberInputs, s: System, trade: Trade = 'construction'): Calculation {
  if (a.kind === 'birdsmouth') return calculateBirdsmouth(a, s);
  const v = new Inputs(), deg = v.pitch(a.pitch), run = v.number('memberRun', 'horizontal run', a.run), factor = rafterPitchFactor(deg), actual = rafterLength(run, deg), u = unitLabels(s);
  return v.finish({ label: trade === 'birdsmouth' ? 'Rafter length' : 'Angled member length', value: actual, unit: u.length, power: 1, plan: run, pitch: deg, factor,
    metrics: [ { label: 'Horizontal run', value: run, unit: u.length }, { label: 'Vertical rise', value: run * Math.tan(deg * Math.PI / 180), unit: u.length }, { label: 'Length factor', value: factor, unit: '×', digits: 4 } ],
    notes: [ 'Geometric length only. Add allowances for overhang, joints, cuts and trimming separately.', 'This does not count studs or determine structural timber sizes.' ],
    formula: `${format(run)} ${u.length} ÷ cos(${format(deg)}°) = ${format(actual)} ${u.length}`,
    summary: 'Horizontal run is not full building span. For a symmetric gable, start with the actual wall-to-ridge horizontal distance.' });
}
export function calculateBattens(a: BattenInputs, s: System): Calculation {
  const v = new Inputs(), u = unitLabels(s), { measured, deg, factor, actual } = areaValues(a, v);
  const gauge = v.number('gauge', 'centre spacing', a.gauge), waste = v.number('waste', 'waste percentage', a.waste, 0, 1000, true);
  const gaugeLength = s === 'metric' ? gauge / 1000 : gauge / 12;
  const raw = gaugeLength > 0 ? actual / gaugeLength : 0, total = raw * (1 + waste / 100);
  return v.finish({ label: 'Batten length to allow', value: total, unit: u.length, power: 1, area: actual, plan: measured, pitch: deg, factor,
    metrics: [ { label: 'Net surface area', value: actual, unit: u.area }, { label: 'Before waste', value: raw, unit: u.length }, { label: `Waste allowance (${format(waste, 1)}%)`, value: total - raw, unit: u.length } ],
    notes: [ 'Area ÷ spacing is a planning estimate, not an exact row count.', 'Check spacing against the product and support requirements. Allow separately for edges, extra supports and cut lengths.' ],
    formula: `${format(actual)} ${u.area} ÷ ${format(gaugeLength, 4)} ${u.length} × ${numericText(1 + waste / 100)} = ${format(total)} ${u.length}`,
    summary: 'Spacing is measured along the surface, perpendicular to the batten rows. No stock-length or cutting optimisation is included.' });
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
export function calculate(state:CalculatorState):Calculation {
  return state.tab==='area'?calculateArea(state.area,state.system):state.tab==='members'?calculateMembers(state.members,state.system,state.trade):state.tab==='battens'?calculateBattens(state.battens,state.system):state.tab==='pricing'?calculatePricing(state.pricing,state.system,state.currency):calculateAngles(state.angles);
}
// Use one dimensional conversion factor throughout, including inverse rates.
// Keeping powers coherent avoids area/rate drift from separately rounded factors.
export function unitFactor(power:number,from:System,to:System):number {return from===to?1:Math.pow(from==='metric'?1/0.3048:0.3048,power);}
function converted(value:string,power:number,from:System,to:System):string {
  if(value.trim()===''||!Number.isFinite(Number(value))||!power)return value;
  return numericText(Number(value)*unitFactor(power,from,to));
}
/** Convert measurements AND per-unit rates. Never silently relabel an existing number. */
export function convertSystem(state:CalculatorState,to:System):CalculatorState {
  const from=state.system;if(from===to)return state;
  const c=(value:string,power:number)=>converted(value,power,from,to);
  const area=(a:AreaInputs)=>({...a,width:c(a.width,1),length:c(a.length,1),direct:c(a.direct,2),deduction:c(a.deduction,2)});
  const small=(value:string)=>value.trim()===''||!Number.isFinite(Number(value))?value:numericText(Number(value)*(to==='imperial'?1/25.4:25.4));
  const p=state.pricing,power=powerOf(p.measurementType);
  const multiplier=unitFactor(power,from,to);
  return {...state,system:to,area:area(state.area),members:{...state.members,run:c(state.members.run,1),seat:small(state.members.seat),depth:small(state.members.depth)},
    battens:{...state.battens,...area(state.battens),gauge:state.battens.gauge.trim()===''||!Number.isFinite(Number(state.battens.gauge))?state.battens.gauge:numericText(Number(state.battens.gauge)*(to==='imperial'?1/25.4:25.4))},
    pricing:{...p,amount:c(p.amount,power),dimA:c(p.dimA,1),dimB:c(p.dimB,1),dimC:c(p.dimC,1),packSize:c(p.packSize,power),
      wasteValue:p.wasteType==='fixed'||p.wasteType==='fixed_per_segment'?c(p.wasteValue,power):p.wasteValue,
      price:p.pricingStrategy==='per_unit'&&p.price.trim()!==''&&Number.isFinite(Number(p.price))?numericText(Number(p.price)/multiplier):p.price}};
}
export function exampleFor(state: CalculatorState): CalculatorState {
  const metric = state.system === 'metric' ? state : convertSystem(state, 'metric');
  const defaults = initialState(state.trade);
  const next: CalculatorState = { ...metric };
  if (state.tab === 'area') {
    const surface = state.area.surface;
    next.area = { ...makeArea(), surface, basis: surface === 'slope' ? 'plan' : 'surface', width: '6', length: surface === 'wall' ? '2.4' : '4', deduction: surface === 'wall' ? '1.89' : '', pitch: makePitch(surface === 'slope' ? '30' : '0') };
  }
  if (state.tab === 'members') next.members = { ...defaults.members, kind: state.members.kind, run: '3', seat: '100', depth: '200', pitch: makePitch('35') };
  if (state.tab === 'battens') next.battens = { ...makeArea(), surface: 'wall', width: '6', length: '2.4', gauge: '600', waste: '10', source: '' };
  if (state.tab === 'pricing') next.pricing = { ...defaults.pricing, amount: state.trade === 'birdsmouth' ? '12' : '20', price: state.trade === 'birdsmouth' ? '8.50' : '4.20', source: 'Example figures only. Replace with your own material rate.' };
  if (state.tab === 'angles') next.angles = { ...defaults.angles, kind: state.angles.kind, pitch2: state.angles.kind === 'change' ? '10' : '30' };
  return state.system === 'metric' ? next : convertSystem(next, 'imperial');
}
export function resetActive(state:CalculatorState):CalculatorState {
  const defaults=state.system==='metric'?initialState(state.trade):convertSystem(initialState(state.trade),'imperial');
  return {...state,[state.tab]:defaults[state.tab]};
}
export function transferToPricing(state:CalculatorState,r:Result):CalculatorState {
  if(![1,2,3].includes(r.power)||r.value<=0)return state;
  return {...state,tab:'pricing',pricing:{...state.pricing,measurementType:r.power===2?'area':r.power===3?'volume_3d':'lineal',entry:'direct',amount:numericText(r.value),
    name:state.tab==='battens'?'Battens':state.tab==='members'?(state.trade==='birdsmouth'?'Rafter timber':'Angled timber'):'Surface material',pitchEnabled:false,pitchType:'rafter',
    // Batten total includes waste; do not add it again automatically.
    wasteType:state.tab==='battens'?'none':state.pricing.wasteType,
    price:'',pricingStrategy:'per_unit',packSize:'',source:`${r.label} · ${format(r.value)} ${r.unit}${state.tab==='battens'?' · waste already included':''}${state.tab==='area'?' · pitch already included':''}`}};
}
export function transferToBattens(state:CalculatorState,r:Result):CalculatorState {
  if(r.power!==2||r.value<=0)return state;
  return {...state,tab:'battens',battens:{...state.battens,surface:state.area.surface,deduction:'',basis:'surface',entry:'direct',direct:numericText(r.value),source:`From net surface area · ${format(r.value)} ${r.unit}. Pitch is already included.`}};
}
export function quoteHref(state:CalculatorState,r:Result):string {
  if(state.tab!=='pricing'&&(r.power<=0||r.value<=0))throw new Error('Only a positive material measurement can be sent to a quote. Cut depths and angles are not quantities.');
  const params=new URLSearchParams({ref:profileFor(state.trade).slug,currency:state.currency});
  if(state.tab==='pricing'&&r.price){
    const p=state.pricing,lines=[{description:p.name.trim()||'Building material',qty:Number(numericText(r.price.pricedQuantity)),unit:p.pricingStrategy==='per_unit'?r.price.unit:'packs',rate:Number(p.price)}];
    if(r.price.labourCost>0)lines.push({description:`Labour — ${p.name.trim()||'building work'}`,qty:1,unit:'job',rate:r.price.labourCost});
    params.set('lines',JSON.stringify(lines));
  }else {params.set('qty',numericText(r.value));params.set('unit',r.unit);}
  return '/free-quote-generator?'+params.toString();
}
export function resultText(state:CalculatorState,r:Result):string {
  const value=state.tab==='pricing'?money(r.value,state.currency):`${format(r.value,r.unit==='°'?1:2)} ${r.unit}`;
  return ['QuoteCore+ · '+profileFor(state.trade).name,r.label+': '+value,...r.metrics.map(m=>`${m.label}: ${CURRENCIES.includes(m.unit as typeof CURRENCIES[number])?money(m.value,m.unit!):format(m.value,m.digits??2)+' '+(m.unit??'')}`),'',r.formula,'',r.summary,...r.notes].join('\n');
}
/** Existing smart-component draft envelope, normalised to SI for the app.
 * UI-only fields travel separately; app spec names remain compatible.
 */
export function componentPayload(state:CalculatorState,forDownload=false):Record<string,unknown> {
  const s=convertSystem(state,'metric'),p=s.pricing,c=calculatePricing(p,'metric',s.currency);
  if(!c.result?.price)throw new Error('Complete the material pricing first.');
  if(!forDownload&&p.wasteType==='fixed_per_segment'&&Number(p.segments)!==1)throw new Error('Multi-segment waste can be estimated here, but saving its per-segment rule needs app-side verification. Download this draft for review instead.');
  return {slug:profileFor(state.trade).slug,savedAt:new Date().toISOString(),data:{
    spec:{name:p.name,measurementType:p.measurementType,wasteType:p.wasteType,wasteValue:p.wasteValue,pricePerUnit:p.price,pricingStrategy:p.pricingStrategy,packSize:p.packSize,labourAmount:p.labour,
      pitchEnabled:p.pitchEnabled,pitchType:p.pitchType,pitchDegrees:numericText(pitchValue(p.pitch))},
    result:c.result.price,areaInput:powerOf(p.measurementType)>1?numericText(measurementBeforePitch(p)):'',linearInput:powerOf(p.measurementType)===1?p.amount:'',quantityInput:powerOf(p.measurementType)===0?p.amount:'',
    currencyCode:s.currency,unitSystem:'metric',calculatorPairVersion:1,
    ...(forDownload?{calculatorInputs:s.pricing,reviewRequired:p.wasteType==='fixed_per_segment'&&Number(p.segments)!==1}: {})}};
}
function measurementBeforePitch(p:PriceInputs):number {
  return p.entry==='dimensions'&&powerOf(p.measurementType)>1?Number(p.dimA)*Number(p.dimB)*(powerOf(p.measurementType)===3?Number(p.dimC):1):Number(p.amount);
}
/** Strict restoration: reject unknown enum values, oversized strings and wrong
 * shapes. This is browser convenience, not a trusted server entitlement. */
export function restoreState(raw:string|null,trade:Trade):CalculatorState|null {
  if(!raw||raw.length>40000)return null;
  try{
    const value=JSON.parse(raw),defaults=initialState(trade);
    function validate(v:unknown,d:unknown):boolean{
      if(typeof d==='string')return typeof v==='string'&&v.length<=300;
      if(typeof d==='boolean'||typeof d==='number')return typeof v===typeof d;
      if(!v||typeof v!=='object'||Array.isArray(v))return false;
      return Object.entries(d as Record<string,unknown>).every(([k,x])=>validate((v as Record<string,unknown>)[k],x));
    }
    if(!validate(value,defaults)||value.version!==1||value.trade!==trade||!profileFor(trade).tabs.some(t=>t.id===value.tab)||!['metric','imperial'].includes(value.system)||!CURRENCIES.includes(value.currency))return null;
    for(const a of [value.area,value.battens])if(!['floor','wall','slope'].includes(a.surface)||!['plan','surface'].includes(a.basis)||!['direct','dimensions'].includes(a.entry))return null;
    for(const p of [value.area.pitch,value.members.pitch,value.battens.pitch,value.pricing.pitch])if(!['degrees','ratio'].includes(p.mode))return null;
    if(!['third','quarter','custom'].includes(value.members.limit)||!['rafter','birdsmouth'].includes(value.members.kind)||!['ridge','hip','change','upstand','into-upstand'].includes(value.angles.kind))return null;
    if(!MEASUREMENTS.some(m=>m.value===value.pricing.measurementType)||!['none','percent','fixed','fixed_per_segment'].includes(value.pricing.wasteType)||!['per_unit','per_pack_length','per_pack_area','per_pack_volume'].includes(value.pricing.pricingStrategy)||!['rafter','valley_hip'].includes(value.pricing.pitchType)||!['direct','dimensions'].includes(value.pricing.entry))return null;
    // Copy only known schema keys (no prototype pollution / unexpected state).
    function clean(v:Record<string,unknown>,d:Record<string,unknown>):Record<string,unknown>{return Object.fromEntries(Object.entries(d).map(([k,x])=>[k,x&&typeof x==='object'?clean(v[k] as Record<string,unknown>,x as Record<string,unknown>):v[k]]));}
    return clean(value,defaults as unknown as Record<string,unknown>) as unknown as CalculatorState;
  }catch{return null;}
}
