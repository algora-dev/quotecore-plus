/** Auditable physical root-sheet accounting. Each installed descendant is mapped
 * back into the ONE original ordered rectangle. Intermediate offcuts are not
 * new purchases and consumed ancestors are not counted as remaining stock.
 * Areas (not sums of angled maximum lengths) conserve material through cuts. */
import type { Issue, Lap, Placement, Point, Region, Solution } from './types';
import { isStraightFiller } from './material';
import { area, bounds, intersect, rotate180, subtract, translate, unionAll } from './regions';

export const PURCHASE_LEDGER_MODEL='root-sheet-ledger-v1' as const;
export interface RootTransform {sign:1|-1; x:number; y:number}
export interface LedgerPiece {
  demandId:string; faceId:string; sourceOffcutId:string|null; generation:number;
  toRoot:RootTransform; lap:Lap; originalLeftEdgeAt:'left'|'right';
  physicalAreaM2:number; netCoverAreaM2:number;
}
export interface PurchasedRoot {
  rootDemandId:string; faceId:string; lengthM:number; widthM:number; coverM:number;
  stockAreaM2:number; installedPhysicalAreaM2:number; netCoverAreaM2:number;
  terminalReusableAreaM2:number; otherRemainderAreaM2:number; balanceErrorM2:number;
  pieces:LedgerPiece[]; unusedOffcutIds:string[];
}
export interface PurchaseLedger {
  model:typeof PURCHASE_LEDGER_MODEL; valid:boolean; issues:Issue[];
  roots:PurchasedRoot[];
  totals:{newSheets:number;purchasedLinealM:number;suppliedCoverAreaM2:number;suppliedPhysicalAreaM2:number;
    netRoofAreaM2:number;installedPhysicalAreaM2:number;allowanceAndReservedAreaM2:number;
    terminalReusableAreaM2:number;otherRemainderAreaM2:number;balanceErrorM2:number};
  stockSchedule:{faceId:string;lengthM:number;count:number;linealM:number;rootDemandIds:string[]}[];
  method:'unique-new-roots-not-sections-or-descendants';
}
const identity=():RootTransform=>({sign:1,x:0,y:0});
function compose(a:RootTransform,b:RootTransform):RootTransform{return{sign:(a.sign*b.sign) as 1|-1,x:a.sign*b.x+a.x,y:a.sign*b.y+a.y};}
function toSource(p:Placement,width:number):RootTransform {
  return p.rotation===180?{sign:-1,x:width,y:p.translateY}:{sign:1,x:0,y:-p.translateY};
}
export function transformToRoot(r:Region,t:RootTransform):Region {
  // rotate180(r,0) = (-x,-y); the accumulated translation supplies true width.
  return translate(t.sign===-1?rotate180(r,0):r,t.x,t.y);
}
export function rootSheetLedger(s:Solution):PurchaseLedger {
  const issues:Issue[]=[],error=(code:string,message:string,objectId?:string)=>issues.push({severity:'error' as const,code,message,objectId});
  const ds=new Map(s.demands.map(d=>[d.id,d])),os=new Map(s.offcuts.map(o=>[o.id,o]));
  const placements=new Map<string,Placement>();
  for(const p of s.placements){if(placements.has(p.demandId))error('LEDGER_DUPLICATE','A physical sheet position is allocated more than once.',p.demandId);placements.set(p.demandId,p);}
  if(ds.size!==s.demands.length||os.size!==s.offcuts.length)error('LEDGER_DUPLICATE','A demand or offcut identifier is duplicated.');
  interface Location {root:string;transform:RootTransform;generation:number}
  const locations=new Map<string,Location>();
  const locate=(id:string,visiting=new Set<string>()):Location|null=>{
    if(locations.has(id))return locations.get(id)!;
    if(visiting.has(id)){error('LEDGER_CYCLE','The cut tree contains a cycle.',id);return null;}
    visiting.add(id);const d=ds.get(id),p=placements.get(id);if(!d||!p){error('LEDGER_MISSING','Missing physical sheet allocation.',id);return null;}
    if(p.kind==='new'){const found={root:id,transform:identity(),generation:0};locations.set(id,found);return found;}
    const o=os.get(p.offcutId??'');if(!o){error('LEDGER_SOURCE','The inherited material is missing.',id);return null;}
    if(p.rotation!==0&&p.rotation!==180||!Number.isFinite(p.translateY)){error('LEDGER_TRANSFORM','Invalid physical piece transform.',id);return null;}
    const source=locate(o.sourceDemandId,visiting);if(!source)return null;
    if(o.rootDemandId&&o.rootDemandId!==source.root)error('LEDGER_ROOT','A child piece changed its purchased root identity.',id);
    const location={root:source.root,transform:compose(source.transform,toSource(p,o.widthMm)),generation:source.generation+1};
    locations.set(id,location);return location;
  };
  for(const d of s.demands)locate(d.id);
  for(const o of s.offcuts){const source=locations.get(o.sourceDemandId);if(source&&o.rootDemandId&&source.root!==o.rootDemandId)error('LEDGER_ROOT','An unused or reused piece changed its purchased root identity.',o.id);}
  const used=new Set<string>();
  for(const p of s.placements)if(p.kind==='reuse'){if(used.has(p.offcutId??''))error('LEDGER_DOUBLE_USE','The same offcut is consumed twice.',p.offcutId);used.add(p.offcutId??'');}
  // Parent-stock continuity is independent of the final short installed piece.
  // A cuttable primary lane may not silently use a shorter lower-ridge blank.
  for(const d of s.demands){
    if(placements.get(d.id)?.kind!=='new'||!s.bankLayout?.primaryFaceIds.includes(d.faceId)||!d.cutEdges?.length||isStraightFiller(d.required))continue;
    const length=s.bankLayout.cutLengthByFace?.[d.faceId];if(length===undefined)continue;
    const requiredLength=length+2*s.profile.endAllowanceMm+(s.bankLayout.extraLengthByFace[d.faceId]??0)+(s.bankLayout.tailExtensionByFace?.[d.faceId]??0);
    const actual=bounds(d.blank).maxY-bounds(d.blank).minY;
    if(actual+1e-5<requiredLength)error('CUT_STOCK_CONTINUITY','An angled primary lane was shortened below its controlling stock length, breaking its reusable cut set.',d.id);
  }
  const roots:PurchasedRoot[]=[];
  for(const [id,p] of placements)if(p.kind==='new'){
    const d=ds.get(id);if(!d)continue;
    const b=bounds(d.blank),length=b.maxY-b.minY,width=b.maxX-b.minX;
    if(![length,width].every(n=>Number.isFinite(n)&&n>0)){error('LEDGER_STOCK','Purchased stock has invalid dimensions.',id);continue;}
    const members=s.demands.filter(m=>locations.get(m.id)?.root===id);
    const physical=members.map(m=>transformToRoot(m.required,locations.get(m.id)!.transform));
    const covers=members.map(m=>transformToRoot(m.cover,locations.get(m.id)!.transform));
    const installed=unionAll(physical),net=unionAll(covers),stockArea=area(d.blank),installedArea=area(installed);
    const sumArea=physical.reduce((n,r)=>n+area(r),0),tolerance=Math.max(.001,stockArea*1e-9);
    if(area(subtract(installed,d.blank))>tolerance)error('LEDGER_OUTSIDE','Installed descendants extend beyond their original purchased rectangle.',id);
    if(sumArea-installedArea>tolerance)error('LEDGER_OVERLAP','Two installed descendants consume the same original metal.',id);
    const pieces:LedgerPiece[]=members.map(m=>{
      const loc=locations.get(m.id)!,expected=(d.lap*loc.transform.sign) as Lap;
      if(expected!==m.lap)error('ROOT_LAP_CONFLICT','A descendant changed the original sheet side-lap identity.',m.id);
      return{demandId:m.id,faceId:m.faceId,sourceOffcutId:placements.get(m.id)?.offcutId??null,generation:loc.generation,toRoot:loc.transform,
        lap:m.lap,originalLeftEdgeAt:loc.transform.sign===1?'left':'right',physicalAreaM2:area(m.required)/1e6,netCoverAreaM2:area(m.cover)/1e6};
    });
    const remainder=subtract(d.blank,installed);
    const terminal=s.offcuts.filter(o=>!used.has(o.id)&&locations.get(o.sourceDemandId)?.root===id);
    const leafRegions=terminal.map(o=>transformToRoot(o.region,locations.get(o.sourceDemandId)!.transform));
    const leaves=unionAll(leafRegions);
    if(area(subtract(leaves,remainder))>tolerance||leafRegions.reduce((n,r)=>n+area(r),0)-area(leaves)>tolerance)error('LEDGER_LEAF_OVERLAP','Unused stock overlaps installed or other unused material.',id);
    const reusable=intersect(remainder,leaves),other=subtract(remainder,reusable);
    const balance=stockArea-installedArea-area(reusable)-area(other);
    if(Math.abs(balance)>tolerance)error('LEDGER_BALANCE','Purchased stock does not reconcile with installed and remaining metal.',id);
    roots.push({rootDemandId:id,faceId:d.faceId,lengthM:length/1000,widthM:width/1000,coverM:s.profile.coverMm/1000,stockAreaM2:stockArea/1e6,
      installedPhysicalAreaM2:installedArea/1e6,netCoverAreaM2:area(net)/1e6,terminalReusableAreaM2:area(reusable)/1e6,otherRemainderAreaM2:area(other)/1e6,balanceErrorM2:balance/1e6,pieces,unusedOffcutIds:terminal.map(o=>o.id)});
  }
  const sum=(f:(r:PurchasedRoot)=>number)=>roots.reduce((n,r)=>n+f(r),0);
  const schedule=new Map<string,PurchaseLedger['stockSchedule'][number]>();
  for(const r of roots){const key=`${r.faceId}/${r.lengthM.toFixed(9)}`;const row=schedule.get(key)??{faceId:r.faceId,lengthM:r.lengthM,count:0,linealM:0,rootDemandIds:[]};row.count++;row.linealM+=r.lengthM;row.rootDemandIds.push(r.rootDemandId);schedule.set(key,row);}
  const totals={newSheets:roots.length,purchasedLinealM:sum(r=>r.lengthM),suppliedCoverAreaM2:sum(r=>r.lengthM*r.coverM),suppliedPhysicalAreaM2:sum(r=>r.stockAreaM2),
    netRoofAreaM2:sum(r=>r.netCoverAreaM2),installedPhysicalAreaM2:sum(r=>r.installedPhysicalAreaM2),allowanceAndReservedAreaM2:sum(r=>r.installedPhysicalAreaM2-r.netCoverAreaM2),
    terminalReusableAreaM2:sum(r=>r.terminalReusableAreaM2),otherRemainderAreaM2:sum(r=>r.otherRemainderAreaM2),balanceErrorM2:sum(r=>r.balanceErrorM2)};
  if(Math.abs(totals.suppliedPhysicalAreaM2*1e6-s.metrics.newMaterialMm2)>Math.max(.001,s.metrics.newMaterialMm2*1e-9))error('LEDGER_TOTAL','The headline supply does not match unique purchased roots.');
  return{model:PURCHASE_LEDGER_MODEL,valid:!issues.length,issues,roots,totals,stockSchedule:[...schedule.values()].sort((a,b)=>a.faceId.localeCompare(b.faceId)||b.lengthM-a.lengthM),method:'unique-new-roots-not-sections-or-descendants'};
}
/** Safe machine-readable CSV, one row per new root. No intermediate offcut rows
 * are added to the purchase schedule. Frame orientation lives in the JSON audit. */
export function purchaseLedgerCsv(ledger:PurchaseLedger):string {
  if(!ledger.valid)throw new Error('Correct material-ledger errors before exporting purchase quantities.');
  const cell=(x:unknown)=>'"'+String(x??'').replace(/^([=+@\-\t\r\n])/,"'$1").replace(/"/g,'""')+'"';
  const header=['parent_sheet','face','length_m','cover_width_m','physical_width_m','supply_m2','installed_physical_m2','unused_reusable_m2','other_remainder_m2','installed_pieces'];
  const rows=ledger.roots.map(r=>[r.rootDemandId,r.faceId,r.lengthM,r.coverM,r.widthM,r.stockAreaM2,r.installedPhysicalAreaM2,r.terminalReusableAreaM2,r.otherRemainderAreaM2,r.pieces.length]);
  return [header,...rows].map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
}
/** Lap wording is eave-relative. Equal screen arrows on opposite-facing planes
 * are not by themselves evidence of a reversed physical edge. */
export function lapFromSpouting(lap:Lap,flow:Point):{label:string;screenVector:Point} {
  return{label:lap===1?'Left to right, looking upslope from the spouting':'Right to left, looking upslope from the spouting',screenVector:{x:flow.y*lap,y:-flow.x*lap}};
}
