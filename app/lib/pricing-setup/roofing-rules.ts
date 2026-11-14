import type { ExtractedLine, PricingDraft } from './domain';
/** Versioned roofing domain rules. Ordering is significant: specific before general. */
export const ROOFING_RULEBOOK_VERSION = '2026-11-14.1';
type Rule = {id:string;pattern:RegExp;measurement:PricingDraft['measurementType'];pitch:PricingDraft['pitchType'];slot:string;reason:string};
const RULES:Rule[]=[
 {id:'valley',pattern:/\b(valley|valleys|valley tray|valley flashing)\b/i,measurement:'lineal',pitch:'valley_hip',slot:'valley',reason:'Conventional valley measured in plan view uses the hip/valley pitch correction.'},
 {id:'hip',pattern:/\b(hip|hips|hip cap|hip flashing|hip ridge)\b/i,measurement:'lineal',pitch:'valley_hip',slot:'hip',reason:'Conventional diagonal hip measured in plan view uses the hip/valley pitch correction.'},
 {id:'rake-barge',pattern:/\b(rake|rakes|barge|bargeboard|verge|gable edge|gable flashing)\b/i,measurement:'lineal',pitch:'rafter',slot:'barge',reason:'The sloping gable edge uses the rafter pitch correction for plan-view length.'},
 {id:'area',pattern:/\b(sheets?|sheeting|roof cover(?:ing)?|roofing tiles?|concrete tiles?|clay tiles?|shingles?|long[\s-]?run|standing seam|roof panels?|roof membrane|underlay(?:ment)?|roof blanket|insulation blanket|metal roofing|roof decking)\b/i,measurement:'area',pitch:'rafter',slot:'roof_area',reason:'Roof surface products use the rafter pitch correction when the measurement is a projected plan area.'},
 {id:'ridge',pattern:/\b(ridge|ridging|ridge capping|ridge cap)\b/i,measurement:'lineal',pitch:'none',slot:'ridge',reason:'A conventional horizontal ridge length is already horizontal. Confirm unusual roof geometry.'},
 {id:'eaves',pattern:/\b(eaves?|gutter(?:ing)?|spout(?:ing)?|fascia|drip edge|drip flashing)\b/i,measurement:'lineal',pitch:'none',slot:'spouting',reason:'A conventional horizontal edge is not slope-adjusted.'},
 {id:'fixings',pattern:/\b(screws?|clips?|fixings?|fasteners?|nails?|bolts?|washers?|rivets?)\b/i,measurement:'quantity',pitch:'none',slot:'fixings',reason:'Counted fasteners do not receive a second pitch correction. Area-derived fixing quantities require their own explicit rule.'},
 {id:'labour',pattern:/\b(labou?r|installation|install|site setup|scaffold(?:ing)?)\b/i,measurement:'fixed',pitch:'none',slot:'custom',reason:'A service could be fixed or measured. Confirm its charging unit.'},
];
export type Classification={measurementType:PricingDraft['measurementType'];pitchType:PricingDraft['pitchType'];slot:string;rule:string|null;reason:string;confidence:'high'|'medium'|'low'};
export function classifyRoofing(name:string,unit:string):Classification{
 const title=name.toLowerCase();const found=RULES.find(r=>r.pattern.test(title));
 const norm=unit.toLowerCase().replace(/\s/g,'');
 const area=/m(?:²|2|\^2)|sq(?:m|ft)|ft(?:²|2|\^2)|roofingsquare/.test(norm);
 const length=/^(?:m|lm|linm|linealm|metre|meter|ft|feet|linft)$/.test(norm);
 const count=/^(?:ea|each|pcs?|units?|no\.?|piece|item)$/.test(norm);
 let measured:PricingDraft['measurementType']=area?'area':length?'lineal':count?'quantity':found?.measurement??'quantity';
 let conflict=false;
 if(found&&((area&&found.measurement!=='area')||(length&&found.measurement!=='lineal')||(count&&found.measurement!=='quantity'))){conflict=true;}
 const pitch=found&&!conflict?found.pitch:'none';
 return {measurementType:measured,pitchType:pitch,slot:found?.slot??'custom',rule:found?.id??null,
  reason:found?.reason??'No reliable roofing term matched. Check measurement and pitch manually.',confidence:found&&!conflict?'high':found?'low':'low'};
}
/** Convert per-display-unit source prices to the engine's canonical m / m² basis. */
export function canonicalRateFactor(unit:string, measurement:PricingDraft['measurementType']):number|null{
 const u=unit.toLowerCase().replace(/\s+/g,'').replace(/\./g,'').replace(/per/g,'/');
 if(measurement==='area'){
  if(/ft(?:²|2|\^2)|sqft|squarefeet/.test(u))return 10.7639104167097;
  if(/roofingsquare|^rs$|^sq(?:uare)?$/.test(u))return 0.107639104167097;
  if(/m(?:²|2|\^2)|sqm|squaremet(?:re|er)s?/.test(u))return 1;
 }
 if(measurement==='lineal'){
  if(/^(?:\/)?(?:ft|feet|linft|linearfeet)$/.test(u))return 3.28083989501312;
  if(/^(?:\/)?(?:m|lm|linm|linealm|metre|meter|linearmetre)$/.test(u))return 1;
 }
 if(measurement==='quantity' || measurement==='fixed'){
  if(/^(?:\/)?(?:ea|each|piece|pcs|pc|item|no|unit)$/.test(u))return 1;
 }
 return null;
}
export function draftFromExtraction(line:ExtractedLine,sourceBasis:'unknown'|'purchase'|'selling'|'mixed'):PricingDraft{
 const c=classifyRoofing(line.name,line.sourceUnit??'');
 const basis=line.priceBasis&&line.priceBasis!=='unknown'?line.priceBasis:sourceBasis;
 const valid=(n:number|null|undefined):number|null=>typeof n==='number'&&Number.isFinite(n)&&n>=0?n:null;
 const price=valid(line.sourcePrice);
 const rawMaterial=valid(line.materialRate)??(basis==='purchase'?price:null);
 const rawLabour=valid(line.labourRate);
 const factor=canonicalRateFactor(line.sourceUnit??'',c.measurementType);
 const packs=/\b(pack|bundle|roll|box|carton|pallet)\b/i.test(line.sourceUnit??'');
 // A known imperial rate is converted correctly, while a pack price never becomes a per-unit rate silently.
 const material=packs?null:rawMaterial==null?null:Math.round(rawMaterial*(factor??1)*10000)/10000;
 const labour=packs?null:rawLabour==null?null:Math.round(rawLabour*(factor??1)*10000)/10000;
 const wasteType=line.wasteType??null;
 const waste=wasteType===null?'unknown':wasteType;
 const warnings:string[]=[];
 if(c.confidence==='low')warnings.push('Measurement or pitch needs checking.');
 if(waste==='unknown')warnings.push('Waste not supplied. Confirm none or enter your own allowance.');
 if(material===null)warnings.push('Material purchase cost not verified.');
 if(labour===null)warnings.push('Labour rate not supplied.');
 if(basis==='selling')warnings.push('Selling price is not the same as material purchase cost.');
 if(!line.sourceUnit)warnings.push('Source does not identify a pricing unit. Confirm that the entered rates use the canonical metric unit shown.');
 else if(packs)warnings.push('Pack or roll price found. Enter the pack coverage/size before using it to price a measured quantity.');
 else if(factor===null)warnings.push('Source unit is not a recognised canonical pricing unit. Verify and convert costs yourself before confirming.');
 else if(factor!==1)warnings.push('Source rates were converted into canonical metric units. Verify the original unit and conversion.');
 return {
  practicePricing:false,
  sku:(line.sku??'').slice(0,100),name:line.name.trim().slice(0,180),notes:(line.notes??'').slice(0,3000),
  sourceUnit:(line.sourceUnit??'').slice(0,60),sourcePrice:price,priceBasis:basis,materialRate:material,labourRate:labour,
  measurementType:c.measurementType,componentType:'main',soldBy:null,coverWidthMm:null,quantitySpacingM:null,spacingAllowancePercent:0,spacingRoundUp:1,unitsPerAreaEnabled:false,unitsPerArea:null,pitchType:c.pitchType,wasteKind:waste,wasteValue:valid(line.wasteValue),
  pricingStrategy:'per_unit',packPrice:null,packSize:null,takeoffSlot:c.slot,
  origins:{sku:line.sku?'source':'missing',name:'source',notes:line.notes?'source':'missing',sourcePrice:price!=null?'source':'missing',
    materialRate:material!=null?(factor!==null&&factor!==1?'rule':'source'):'missing',labourRate:labour!=null?(factor!==null&&factor!==1?'rule':'source'):'missing',measurementType:c.rule?'rule':'inference',
    pitchType:c.rule?'rule':'inference',wasteKind:wasteType?'source':'missing',wasteValue:line.wasteValue!=null?'source':'missing'},
  warnings,confidence:c.confidence,
 };
}
