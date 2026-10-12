/** Drawing-only placement for START HERE. Never changes the certified grid.
 * Keep the label box inside its own face, not on the other side of a shared
 * junction. A leader ties the text to the unchanged physical reference point. */
import type { Point, Ring } from '../core/types';
import { centroid } from '../core/math';
import { area, bounds, fromRing, pointInRegion, rectangle, subtract } from '../core/regions';
export interface LabelBox { x:number;y:number;width:number;height:number }
export interface StartLabel extends LabelBox { inside:boolean; leaderEnd:Point }
export function startLabelPosition(polygon:Ring,point:Point,sceneUnitsPerPixel=1,obstacles:LabelBox[]=[]):StartLabel {
  const px=Number.isFinite(sceneUnitsPerPixel)&&sceneUnitsPerPixel>0?sceneUnitsPerPixel:1;
  const region=fromRing(polygon),box=bounds(region),c=centroid(polygon),width=82*px,height=22*px;
  const candidates:Point[]=[];
  // Search locally first, then cover a concave face's interior. This keeps a
  // large roof from making the start label wander to its centre unnecessarily.
  for(const radius of [28,44,64,90,125,180,250])for(let i=0;i<24;i++)
    candidates.push({x:point.x+Math.cos(i*Math.PI/12)*radius*px,y:point.y+Math.sin(i*Math.PI/12)*radius*px});
  candidates.push(c);
  for(let i=1;i<16;i++)for(let j=1;j<16;j++)candidates.push({x:box.minX+(box.maxX-box.minX)*i/16,y:box.minY+(box.maxY-box.minY)*j/16});
  const overlap=(a:LabelBox,b:LabelBox)=>Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
  const scored=candidates.map(q=>{
    const b={x:q.x-width/2,y:q.y-height/2,width,height};
    return{q,b,score:Math.hypot(q.x-point.x,q.y-point.y)/px+obstacles.reduce((n,o)=>n+overlap(b,o)/(px*px),0)*10};
  }).sort((a,b)=>a.score-b.score);
  for(const {q,b}of scored){
    if(b.x<box.minX||b.x+width>box.maxX||b.y<box.minY||b.y+height>box.maxY)continue;
    if(![0,.5,1].every(t=>pointInRegion(region,{x:b.x+width*t,y:b.y})&&pointInRegion(region,{x:b.x+width*t,y:b.y+height})))continue;
    // Exact band difference also catches a notch passing through a rectangle
    // whose four corners happen to lie inside the face.
    if(area(subtract(rectangle(b.x,b.y,b.x+width,b.y+height),region))>1e-6)continue;
    const dx=q.x-point.x,dy=q.y-point.y, edge=Math.max(Math.abs(dx)/(width/2),Math.abs(dy)/(height/2));
    const end=edge>1?{x:q.x-dx/edge,y:q.y-dy/edge}:q;
    if(!Array.from({length:16},(_,i)=>(i+1)/16).every(t=>pointInRegion(region,{x:point.x+(end.x-point.x)*t,y:point.y+(end.y-point.y)*t})))continue;
    return{...b,inside:true,leaderEnd:end};
  }
  // At very low zoom a face can be narrower than the readable label. Do not
  // shrink the text to illegibility: callers show the face name on the callout.
  return{x:point.x+12*px,y:point.y-30*px,width,height,inside:false,leaderEnd:{x:point.x+12*px,y:point.y-19*px}};
}
