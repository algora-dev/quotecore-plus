/** Strategy above the physical matcher. Offers contain already verified sheet
 * fits; this module cannot rotate, stretch, create stock or override a lap.
 * It reserves whole complementary sets BEFORE a partial match consumes them. */
import type { Demand, Offcut } from './types';
import type { CoherentMatch } from './coherentMatching';
import { isStraightFiller } from './material';
import { area } from './regions';
export type CutRelationship='valley-complement'|'paired-hip-complement'|'whole-set'|'coherent-majority'|'partial-set';
export interface CutStrategy {
  relationship:CutRelationship; tier:0|1|2|3;
  cutCoverage:number; newCutPositions:number; fillerPositions:number;
  wholeSetFraction:number; sourceSetIds:string[]; usedSetIds:string[];
  sourceFaceIds:string[]; suppliedSavingMm2:number; retainedFraction:number;
}
export function describeCutStrategy(ds:Demand[],pool:Offcut[],match:CoherentMatch):CutStrategy{
  const cut=ds.filter(d=>d.zoneRole!=='ridge-fill'&&!isStraightFiller(d.required));
  const reused=new Set(match.placements.filter(p=>p.kind==='reuse').map(p=>p.demandId));
  const cutArea=cut.reduce((n,d)=>n+area(d.required),0);
  const covered=cut.filter(d=>reused.has(d.id)).reduce((n,d)=>n+area(d.required),0);
  const cutCoverage=cutArea?covered/cutArea:0;
  const selected=pool.filter(o=>match.used.has(o.id));
  const set=(o:Offcut)=>o.cutSetId??`${o.sourceFaceId}:legacy`;
  const sourceSetIds=[...new Set(pool.map(set))],usedSetIds=[...new Set(selected.map(set))];
  // Use only the participating sets for completeness. A donor's other valley
  // must remain available for a different receiver, not dilute this hip pair.
  const participating=pool.filter(o=>usedSetIds.includes(set(o)));
  const total=participating.reduce((n,o)=>n+area(o.region),0);
  const usedArea=selected.reduce((n,o)=>n+area(o.region),0);
  const wholeSetFraction=total?usedArea/total:0;
  const newCutPositions=cut.filter(d=>!reused.has(d.id)).length;
  const fillerPositions=ds.filter(d=>!reused.has(d.id)&&!cut.includes(d)).length;
  const complementary=cutCoverage>=.9&&wholeSetFraction>=.75&&match.retainedFraction>=.72;
  const valley=selected.length>0&&selected.every(o=>o.cutKind==='valley');
  const paired=selected.every(o=>o.cutKind==='hip'||o.cutKind==='broken_hip')&&usedSetIds.length>=2;
  let tier:CutStrategy['tier']=0,relationship:CutRelationship='partial-set';
  if(complementary&&valley){tier=3;relationship='valley-complement';}
  else if(complementary&&paired){tier=3;relationship='paired-hip-complement';}
  else if(complementary){tier=2;relationship='whole-set';}
  else if(cutCoverage>=.65&&wholeSetFraction>=.5){tier=1;relationship='coherent-majority';}
  return{relationship,tier,cutCoverage,newCutPositions,fillerPositions,wholeSetFraction,sourceSetIds,usedSetIds,
    sourceFaceIds:[...new Set(selected.map(o=>o.sourceFaceId))],retainedFraction:match.retainedFraction,
    suppliedSavingMm2:ds.filter(d=>reused.has(d.id)).reduce((n,d)=>n+area(d.blank),0)};
}
export interface ReservableOffer {id:string;faceId:string;pieceIds:string[];strategy:CutStrategy;score:number}
/** Small weighted set-packing beam. A face and physical offcut may appear in
 * only one commitment. Valley and hip sets from one donor can thus be committed
 * to two receivers together. No random singleton may steal one of those pieces.
 * Alternatives can vary lower-tier offers; complete complements remain strong. */
export function chooseCutCommitments<T extends ReservableOffer>(offers:T[],limit=32):T[]{
  if(!offers.length)return[];
  const scale=Math.max(1,...offers.map(o=>o.strategy.suppliedSavingMm2));
  const value=(o:T)=>[0,20,100,300][o.strategy.tier]+10*o.strategy.suppliedSavingMm2/scale+o.score;
  const sorted=[...offers].sort((a,b)=>b.strategy.tier-a.strategy.tier||value(b)-value(a)||a.id.localeCompare(b.id));
  const unique:T[]=[],keys=new Set<string>();
  for(const o of sorted){const k=o.faceId+'|'+[...o.pieceIds].sort().join(',');if(keys.has(k))continue;keys.add(k);unique.push(o);if(unique.length>=64)break;}
  type State={chosen:T[];faces:Set<string>;pieces:Set<string>;value:number};
  let beam:State[]=[{chosen:[],faces:new Set(),pieces:new Set(),value:0}];
  for(const offer of unique){
    const next=[...beam];
    for(const state of beam){
      if(state.faces.has(offer.faceId)||offer.pieceIds.some(id=>state.pieces.has(id)))continue;
      next.push({chosen:[...state.chosen,offer],faces:new Set([...state.faces,offer.faceId]),pieces:new Set([...state.pieces,...offer.pieceIds]),value:state.value+value(offer)});
    }
    const seen=new Set<string>();
    beam=next.sort((a,b)=>b.value-a.value||a.chosen.length-b.chosen.length).filter(s=>{const k=s.chosen.map(o=>o.id).sort().join('|');if(seen.has(k))return false;seen.add(k);return true;}).slice(0,limit);
  }
  return beam[0].chosen.sort((a,b)=>b.strategy.tier-a.strategy.tier||value(b)-value(a));
}
