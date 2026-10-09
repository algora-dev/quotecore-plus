/** Report adapter only. Does not alter calibration, geometry or the canvas.
 * Convert units BEFORE pricing; apply pitch once, waste once, pack rounding once. */
import { applyPitchAndWaste, computeMaterialCostByStrategy } from '@/app/lib/pricing/engine';
import type { TakeoffFinishPayload } from '@/app/lib/takeoff/finishPayload';
import type { TakeoffComponentSpec, TakeoffUnitSystem } from './tradeConfig';
import { FEET_PER_METRE, quantityFactor, specUnit, validateSpec, type TakeoffCurrency } from './takeoff-examples';
import { buildConvertUrl, type ConvertibleLine } from '../shared/convertLines';
export type TakeoffTrade = 'roofing'|'cladding'|'flooring';
export interface ReportEntry { raw:number; pitched:number; quantity:number; areaId:string|null; }
export interface ReportComponent {
  id:string; name:string; type:TakeoffComponentSpec['measurementType']; unit:string; entries:ReportEntry[];
  raw:number; pitched:number; quantity:number; material:number|null; labour:number|null; cost:number|null;
  packs:number|null; example:boolean; wasteLabel:string; pitchApplied:boolean;
}
export interface ReportModel {
  areas:{id:string;name:string;plan:number;surface:number;pitch:number}[];
  components:ReportComponent[]; areaUnit:string; planArea:number; surfaceArea:number;
  materials:number; labour:number; total:number; hasPrices:boolean; hasExamples:boolean;
  issues:string[]; notes:string[]; currency:TakeoffCurrency; trade:TakeoffTrade;
}
const sum=(xs:number[])=>xs.reduce((a,b)=>a+b,0);
const valid=(n:number)=>Number.isFinite(n)&&n>=0&&n<=1e12;
function fallbackPitch(name:string, semantic:string|null):'none'|'rafter'|'valley_hip' {
  if (/^(hips?|valleys?|broken_hips)/i.test(semantic??name)) return 'valley_hip';
  if (/^barge/i.test(name)) return 'rafter';
  return 'none';
}
export function buildReport(payload:TakeoffFinishPayload,specs:TakeoffComponentSpec[],system:TakeoffUnitSystem,trade:TakeoffTrade,currency:TakeoffCurrency='NZD'):ReportModel {
  const issues:string[]=[],notes:string[]=[];
  const sourceFeet=payload.calibrationUnit==='feet';
  if (!['feet','meters'].includes(payload.calibrationUnit)) issues.push('The calibration unit is not recognised. Return to the canvas and check the scale.');
  const convert=(n:number,type:TakeoffComponentSpec['measurementType'])=>n/(sourceFeet?(type==='area'?FEET_PER_METRE**2:type==='lineal'?FEET_PER_METRE:1):1)*quantityFactor(type,system);
  const isRoof=trade==='roofing';
  const areas=payload.roofAreas.map(a=>{
    if (!valid(a.area) || !Number.isFinite(a.pitch) || (isRoof&&(a.pitch<0||a.pitch>=90))) issues.push(`Check the area or pitch for ${a.name}.`);
    const plan=valid(a.area)?convert(a.area,'area'):0;
    const pitch=isRoof && a.pitch>=0 && a.pitch<90?a.pitch:0;
    return {id:a.id,name:a.name,plan,surface:applyPitchAndWaste(plan,isRoof,'rafter',pitch,'none',0,0).afterPitch,pitch};
  });
  const components:ReportComponent[]=payload.componentGroups.filter(g=>g.measurements.length>0).map(g=>{
    const spec=specs.find(s=>s.id===g.componentId);
    if(spec) issues.push(...validateSpec(spec,isRoof).map(x=>`${g.name}: ${x}`));
    const type=(['area','lineal','quantity'].includes(g.measurementType??'')?g.measurementType:spec?.measurementType??'lineal') as TakeoffComponentSpec['measurementType'];
    if (!g.measurementType&&!spec) notes.push(`Check the measurement type for ${g.name}; the report has used length.`);
    let pitchApplied=false;
    const entries:ReportEntry[]=g.measurements.map(m=>{
      if(!valid(m.value)) issues.push(`A measurement for ${g.name} is invalid. Check it on the canvas.`);
      // Quantity entries may carry a value >1 (e.g. counts). Do not replace with entry count.
      const raw=convert(valid(m.value)?m.value:0,type);
      const areaId=m.quoteRoofAreaId??null;
      const matched=areas.find(a=>a.id===areaId);
      const area=matched??(areaId===null&&areas.length===1?areas[0]:undefined);
      const pt=!isRoof||type==='quantity'?'none':spec?(spec.pitchEnabled?spec.pitchType:'none'):type==='area'?'rafter':fallbackPitch(g.name,g.semantic);
      if(pt!=='none'&&!area&&areas.length>0) issues.push(`Assign ${g.name} to an area before pricing its pitch-adjusted measurements.`);
      if(pt!=='none'&&!area&&areas.length===0) notes.push(`${g.name} has no roof-area pitch; it is shown as measured. Confirm it is already a true measurement.`);
      const pitch=area?.pitch??0;
      if(pt!=='none'&&pitch>0) pitchApplied=true;
      const pitched=applyPitchAndWaste(raw,pt!=='none',pt,pitch,'none',0,0).afterPitch;
      return {raw,pitched,quantity:pitched,areaId};
    });
    const raw=sum(entries.map(e=>e.raw)),pitched=sum(entries.map(e=>e.pitched));
    let quantity=pitched,wasteLabel='No waste';
    if(spec&&pitched>0){
      if(spec.wasteType==='percent') {
        entries.forEach(e=>{e.quantity=e.pitched*(1+spec.wasteValue/100);});
        wasteLabel=`${spec.wasteValue}% waste`;
      } else if(spec.wasteType==='fixed') {
        // Fixed TOTAL allowance belongs to the component, not every drawn entry.
        entries.forEach(e=>{e.quantity=e.pitched+spec.wasteValue*(e.pitched/pitched);});
        wasteLabel=`${spec.wasteValue.toLocaleString(undefined,{maximumFractionDigits:3})} ${specUnit(type,system)} total allowance`;
      } else if(spec.wasteType==='fixed_per_segment') {
        entries.forEach(e=>{e.quantity=e.pitched+(e.pitched>0?spec.wasteValue:0);});
        wasteLabel=`${spec.wasteValue.toLocaleString(undefined,{maximumFractionDigits:3})} ${specUnit(type,system)} per measured entry`;
        notes.push('Per-entry waste uses one allowance per saved measurement; a polyline is one entry. Individual polyline segment counts are not included in the existing output contract.');
      }
      quantity=sum(entries.map(e=>e.quantity));
    }
    let material:number|null=null,labour:number|null=null,packs:number|null=null;
    if(spec){
      // Snap only floating-point noise at a whole-pack boundary; do not buy an
      // extra pack solely because a metric/imperial conversion yielded 2.0000000000000004.
      const packRatio=spec.packSize&&spec.packSize>0?quantity/spec.packSize:0;
      const nearWhole=spec.pricingStrategy!=='per_unit'&&spec.packSize&&Math.round(packRatio)>0&&Math.abs(packRatio-Math.round(packRatio))<=1e-10;
      const purchasingQuantity=nearWhole?Math.round(packRatio)*spec.packSize!:quantity;
      const m=spec.pricingStrategy!=='per_unit'&&spec.packPrice!=null&&spec.packSize!=null&&spec.packSize>0&&(nearWhole||spec.packPrice===0)
        ? {cost:(nearWhole?Math.round(packRatio):Math.ceil(packRatio))*spec.packPrice,packDataMissing:false} // Stable pack boundary; zero-price supplied material is valid.
        : computeMaterialCostByStrategy({strategy:spec.pricingStrategy,totalQuantity:purchasingQuantity,materialRate:spec.materialRate,packPrice:spec.packPrice,packSize:spec.packSize,packCoverageM2:null});
      material=m.cost;labour=quantity*spec.labourRate;
      if(m.packDataMissing){issues.push(`Enter a valid pack price and size for ${g.name}.`);material=null;}
      if(spec.pricingStrategy!=='per_unit'&&spec.packSize&&spec.packSize>0) packs=nearWhole?Math.round(packRatio):Math.ceil(quantity/spec.packSize);
    }
    const cost=material==null||labour==null?null:material+labour;
    if(!valid(quantity)||cost!=null&&!valid(cost)) issues.push(`The quantity or cost of ${g.name} is too large. Check the measurements and rates.`);
    return {id:g.componentId,name:g.name,type,unit:specUnit(type,system),entries,raw,pitched,quantity,material,labour,cost,packs,
      example:spec?.pricingOrigin==='example',wasteLabel,pitchApplied};
  });
  const materials=sum(components.map(c=>c.material??0)),labour=sum(components.map(c=>c.labour??0));
  const total=materials+labour;
  if(!valid(total))issues.push('The total is too large. Check the rates and measurements.');
  return {areas,components,areaUnit:specUnit('area',system),planArea:sum(areas.map(a=>a.plan)),surfaceArea:sum(areas.map(a=>a.surface)),
    materials,labour,total,hasPrices:components.some(c=>c.cost!=null),hasExamples:components.some(c=>c.example),
    issues:[...new Set(issues)],notes:[...new Set(notes)],currency,trade};
}
export function quoteLines(report:ReportModel,includePrices:boolean):ConvertibleLine[]{
  if(report.issues.length) throw new Error('Check the highlighted measurements before creating a quote.');
  const measured=report.components.filter(c=>c.quantity>0);
  if(!measured.length) return report.areas.filter(a=>a.surface>0).map(a=>({description:`${a.name} — measured ${report.trade==='roofing'?'surface':'area'} (unpriced)`,qty:a.surface,unit:report.areaUnit,rate:0}));
  return measured.map(c=>({description:`${c.name}${includePrices&&c.example?' [EXAMPLE PRICE — REPLACE]':''}${c.packs!=null?` (${c.packs} packs; cost spread over measured quantity)`:''}`,
    qty:c.quantity,unit:c.unit,rate:includePrices&&c.cost!=null?c.cost/c.quantity:0}));
}
export function quoteTransferUrl(report:ReportModel,includePrices:boolean,examplesAcknowledged=false):string{
  if(includePrices&&report.hasExamples&&!examplesAcknowledged) throw new Error('Review and acknowledge the example prices first.');
  const lines=quoteLines(report,includePrices);
  if(!lines.length)throw new Error('Measure at least one area or component first.');
  const url=buildConvertUrl({targetPath:'/free-quote-generator',amount:sum(lines.map(l=>l.qty*l.rate)),lines,ref:`free-${report.trade==='roofing'?'roof':report.trade}-takeoff`});
  const params=new URLSearchParams(url.split('?')[1]);params.set('currency',report.currency);
  params.set('taxEnabled','false');params.set('taxRate','0');params.set('taxName','Tax');
  // No rounding in the transfer. The quote editor owns its display rounding.
  return `/free-quote-generator?${params.toString()}`;
}
function csvCell(value:string|number):string{
  let text=String(value);if(typeof value==='string'&&/^[=+\-@\t\r]/.test(text))text="'"+text;
  return '"'+text.replace(/"/g,'""')+'"';
}
export function reportCsv(r:ReportModel):string{
  const rows:(string|number)[][]=[['QuoteCore+ takeoff',r.trade],['Currency',r.currency],['Pricing',r.hasExamples?'Contains fictitious example prices — replace before quoting':'User rates / unpriced'],
    ['Component','Measure type','Unit','Measured','Pitch adjusted','Including waste','Material cost','Labour cost','Estimated total','Price source']];
  r.components.forEach(c=>rows.push([c.name,c.type,c.unit,c.raw,c.pitched,c.quantity,c.material??'',c.labour??'',c.cost??'',c.example?'EXAMPLE':'User / unpriced']));
  if(!r.components.length)r.areas.forEach(a=>rows.push([a.name,'area',r.areaUnit,a.plan,a.surface,a.surface,'','','','Unpriced']));
  rows.push(['Total before tax',r.total]);
  return '\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n');
}
