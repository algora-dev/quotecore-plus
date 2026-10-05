/** Never convert screen pixels to scene units while a dialog/parent is hidden.
 * A zero rectangle previously produced enormous white vertex/arrow handles,
 * covering the whole SVG until the first interaction measured it again. */
export function sceneScale(viewBox:readonly number[],width:number,height:number):number|null {
  if(viewBox.length!==4||!viewBox.every(Number.isFinite)||viewBox[2]<=0||viewBox[3]<=0||
    !Number.isFinite(width)||!Number.isFinite(height)||width<2||height<2)return null;
  return Math.max(viewBox[2]/width,viewBox[3]/height);
}
/** Observe the actual canvas, including hidden-to-visible and sidebar/mobile
 * changes. Only the SVG is redrawn; the viewport never resets the user's view. */
export function watchSceneViewport(redraw:()=>void):{observe:(element:HTMLElement)=>void;request:()=>void;destroy:()=>void} {
  let element:HTMLElement|null=null,frame=0,disposed=false,last='';
  const request=()=>{if(disposed||frame)return;frame=requestAnimationFrame(()=>{frame=0;if(!disposed)redraw();});};
  const measure=()=>{
    if(!element||disposed)return;
    const r=element.getBoundingClientRect(),key=`${r.width.toFixed(2)}/${r.height.toFixed(2)}`;
    if(key!==last){last=key;if(r.width>=2&&r.height>=2)request();}
  };
  const observer=typeof ResizeObserver==='function'?new ResizeObserver(measure):null;
  window.addEventListener('resize',measure);
  return{
    observe(next){if(disposed||element===next)return;observer?.disconnect();element=next;last='';observer?.observe(next);measure();},
    request,
    destroy(){disposed=true;if(frame)cancelAnimationFrame(frame);observer?.disconnect();window.removeEventListener('resize',measure);element=null;},
  };
}
