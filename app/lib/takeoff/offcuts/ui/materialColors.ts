import type { Solution } from '../core/types';
import { supplyView } from '../core/supply';

/** Source colours are domain data, not brand tokens. Never recycle a colour
 * just because two faces happen to point in the same direction. */
export const MATERIAL_PALETTE = [
  '#B63D0A','#087443','#7650AD','#245DB3','#AC356D','#7A6A13',
  '#087D8B','#915133','#486A22','#88479A','#28696E','#A34543',
  '#4960A0','#9B591A','#467064','#863D62',
];
export const FILLER_COLOR='#B5BAC2';
export function materialColors(s:Solution) {
  const view=supplyView(s);
  const consumed=new Set(s.placements.filter(p=>p.kind==='reuse').map(p=>p.offcutId));
  const donorRoots=new Set(s.offcuts.filter(o=>consumed.has(o.id)).map(o=>o.rootDemandId??o.sourceDemandId));
  const cuttingBlocks=view.blocks.filter(b=>b.rootDemandIds.some(id=>!view.fillerDemandIds.has(id)||donorRoots.has(id)));
  const colors=new Map(cuttingBlocks.map((b,i)=>[b.id,MATERIAL_PALETTE[i]??`hsl(${(i*137.508)%360} 52% 34%)`]));
  const index=new Map(cuttingBlocks.map((b,i)=>[b.id,i]));
  const color=(id:string|undefined)=>id?colors.get(id)??'#596273':'#596273';
  const face=(id:string)=>{
    const ds=s.demands.filter(d=>d.faceId===id);
    const own=cuttingBlocks.find(b=>b.faceIds.includes(id));
    const block=own?.id??ds.filter(d=>!view.fillerDemandIds.has(d.id)).map(d=>view.blockByPlacement.get(d.id)).find(Boolean);
    return color(block);
  };
  return {...view,blocks:cuttingBlocks,colors,index,color,face};
}
