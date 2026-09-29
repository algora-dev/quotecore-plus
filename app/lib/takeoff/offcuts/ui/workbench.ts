import type { Draft, Issue, Point, RoofFace, RoofInput, Solution } from '../core/types';
import { DEFAULT_PROFILE, DEFAULT_SETTINGS } from '../core/types';
import { deriveFaces, validatePartition } from '../core/graph';
import { centroid, distance, unit, sub } from '../core/math';
import { area, pointInRegion } from '../core/regions';
import { scenePointToDemand } from '../core/material';
import { findFit } from '../core/solver';
import { editPlacement, mergeFaces, splitFace, validateDraft } from '../core/editing';
import { exportDraft } from '../core/codec';
import { roofRevision } from '../adapters/quotecore';
import { escapeHtml as esc, PALETTE, renderSvg } from './svg';
import { styles } from './styles';
export interface WorkbenchOptions {
  initialDraft?: Draft;
  initialIssues?: Issue[];
  createWorker?: () => Worker;
  onClose?: () => void;
  onExport?: (draft: Draft) => void;
  /** Returns the original workspace revision, not the edited review draft. */
  readCurrentSourceRevision?: () => string;
}
export interface WorkbenchHandle { destroy: () => void; getDraft: () => Draft }
let localIdCounter = 0;
function localId(): string { return globalThis.crypto?.randomUUID?.() ?? `review-${Date.now().toString(36)}-${++localIdCounter}`; }
interface Drag {
  kind: 'vertex' | 'flow' | 'offcut'; faceId?: string; vertex?: number; offcutId?: string;
  start: Point; last: Point; original?: Point; pointerId: number;
}
export function mountWorkbench(host: HTMLElement, roof: RoofInput, options: WorkbenchOptions = {}): WorkbenchHandle {
  const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
  let draft: Draft = options.initialDraft ? structuredClone(options.initialDraft) : {
    schemaVersion: 1, roof: structuredClone(roof), faces: [], profile: { ...DEFAULT_PROFILE }, settings: { ...DEFAULT_SETTINGS }, solution: null,
  };
  const capturedRevision=roof.sourceRevision, sourceOutlines=structuredClone(roof.outlines);
  let phase: 'faces'|'solution' = draft.solution?'solution':'faces';
  let selectedFaceId='', selectedOffcutId='', worker: Worker|null=null, jobId='', busy=false, progress='', disposed=false;
  let issues: Issue[] = [...(options.initialIssues??[])], error='', stale=false;
  let showSheets=false, showSources=false, showEnvelope=false, drawPoints: Point[]|null=null, drag:Drag|null=null;
  let viewBox = [-30,-30,roof.sceneWidth+60,roof.sceneHeight+60];
  const history: string[] = [], redoHistory: string[] = [];
  function checkpoint():void { history.push(JSON.stringify(draft)); if(history.length>40)history.shift(); redoHistory.length=0; }
  function cancel():void {worker?.terminate();worker=null;busy=false;jobId='';}
  function invalidate():void { cancel();draft.solution=null;phase='faces';selectedOffcutId='';error=''; }
  function detect():void {
    checkpoint();invalidate();
    try { const result=deriveFaces(draft.roof);draft.faces=result.faces;issues=[...(options.initialIssues??[]),...result.issues];selectedFaceId=draft.faces[0]?.id??''; }
    catch(e){error=message(e);draft.faces=[];}
  }
  const message=(e:unknown):string=>e instanceof Error?e.message:String(e);
  if(!draft.faces.length)detect();else selectedFaceId=draft.faces[0]?.id??'';
  // The first detection runs synchronously; constructor failures remain visible.
  function face():RoofFace|undefined {return draft.faces.find(f=>f.id===selectedFaceId);}
  function allIssues():Issue[] {
    const current=draft.solution?validateDraft(draft):validatePartition(draft.roof,draft.faces);
    const reported=[...issues,...current,...(draft.solution?.issues??[])];
    return reported.filter((i,index,a)=>a.findIndex(j=>j.code===i.code&&j.message===i.message)===index);
  }
  function scenePoint(e:PointerEvent|MouseEvent|WheelEvent):Point {
    const svg=shadow.querySelector('svg.qc-scene') as SVGSVGElement|null;
    if(!svg)return{x:0,y:0};const matrix=svg.getScreenCTM();if(!matrix)return{x:0,y:0};
    const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());return{x:p.x,y:p.y};
  }
  function renderScene():void {
    const canvas=shadow.querySelector('.qc-canvas');if(!canvas)return;
    canvas.innerHTML=renderSvg(draft,{phase,selectedFaceId,selectedOffcutId,showSheets,showSources,showEnvelope,viewBox:viewBox.join(' '),pendingPolygon:drawPoints??undefined});
  }
  function inputField(label:string,field:string,value:number|null,step='1'):string {return `<label>${esc(label)}<input data-field="${field}" type="number" step="${step}" value="${value===null?'':value}"/></label>`;}
  function render():void {
    if(disposed)return;
    const f=face(), s=draft.solution, reported=allIssues(), errors=reported.filter(i=>i.severity==='error');
    const editForm=f?`
      <h3>Selected face</h3><label class="qc-field">Name<input data-field="name" value="${esc(f.name)}"/></label>
      <div class="qc-fields">${inputField('Water angle ° (90 = down)','flowAngle',f.flow?Math.atan2(f.flow.y,f.flow.x)*180/Math.PI:null,'45')}${inputField('Pitch ° — required','pitch',f.pitchDeg,'0.5')}${inputField('Lane start offset, mm','laneOffset',f.laneOffsetMm)}<label>Lap across the face<select data-field="lap"><option value="1" ${f.lap===1?'selected':''}>Along +cross-slope</option><option value="-1" ${f.lap===-1?'selected':''}>Along −cross-slope</option></select></label></div>
      <label class="qc-check"><input data-field="lapLocked" type="checkbox" ${f.lapLocked?'checked':''}/>Lock this face’s lap direction</label>
      <div class="qc-actions"><button data-action="confirm-face" class="primary">Confirm this face</button><button data-action="apply-pitch">Apply pitch to all</button><button data-action="delete-face">Delete face</button></div>
      <details><summary>Split / join / edit polygon</summary><div class="qc-fields"><label>Split axis<select id="split-axis"><option value="x">Vertical cut (x)</option><option value="y">Horizontal cut (y)</option></select></label><label>Scene coordinate<input id="split-at" type="number" value="${centroid(f.polygon).x.toFixed(1)}"/></label></div><button data-action="split">Split selected face</button>
      <div class="qc-field" style="margin-top:12px"><label>Join with adjacent face<select id="merge-target">${draft.faces.filter(g=>g.id!==f.id).map(g=>`<option value="${esc(g.id)}">${esc(g.name)}</option>`).join('')}</select></label><button data-action="merge" ${draft.faces.length<2?'disabled':''}>Join faces</button></div>
      <label class="qc-field" style="margin-top:12px">Polygon vertices: x,y per line<textarea id="polygon-points">${f.polygon.map(p=>`${p.x.toFixed(2)},${p.y.toFixed(2)}`).join('\n')}</textarea></label><button data-action="apply-polygon" style="margin-top:7px">Apply polygon</button></details>`:'';
    const profileForm=`<h3>Sheet / profile rules</h3><div class="qc-fields">${inputField('Effective cover, mm','coverMm',draft.profile.coverMm)}<label>New-sheet layout<select data-field="stockMode"><option value="per-lane" ${draft.settings.stockMode==='per-lane'?'selected':''}>Cut to each lane’s length</option><option value="face-envelope" ${draft.settings.stockMode==='face-envelope'?'selected':''}>Equal-length face rectangle</option></select></label></div>
      <details><summary>Overlap, cutting and handling constraints</summary><div class="qc-fields">${inputField('Physical left lap, mm','leftLapMm',draft.profile.leftLapMm)}${inputField('Physical right lap, mm','rightLapMm',draft.profile.rightLapMm)}${inputField('Longitudinal cut clearance, mm','cutGapMm',draft.profile.cutGapMm)}${inputField('End allowance, mm','endAllowanceMm',draft.profile.endAllowanceMm)}${inputField('Max sheet length, mm','maxLengthMm',draft.profile.maxLengthMm)}${inputField('Length increment, mm','lengthIncrementMm',draft.profile.lengthIncrementMm)}</div><p class="qc-muted">Cover plus these two overlaps defines physical sheet width. Values here are not manufacturer specifications.</p></details>
      <label class="qc-check"><input data-field="rulesConfirmed" type="checkbox" ${draft.profile.rulesConfirmed?'checked':''}/>I have checked the profile / lap rules for this prototype.</label>
      <label class="qc-check"><input data-field="allowEndForEnd" type="checkbox" ${draft.profile.allowEndForEnd?'checked':''}/>Allow approved end-for-end rotation (never face-down mirroring).</label>
      <label class="qc-check"><input data-field="optimiseLapDirections" type="checkbox" ${draft.settings.optimiseLapDirections?'checked':''}/>Test alternative lap directions on unlocked faces.</label>`;
    let solutionPanel='';
    if(s){
      const selected=s.offcuts.find(o=>o.id===selectedOffcutId);
      const p=s.placements.find(p=>p.kind==='reuse'&&p.offcutId===selectedOffcutId) ?? (selected ? { demandId: s.placements.find(p=>p.kind==='new')?.demandId ?? s.demands[0].id, rotation: 0 as const, translateY: 0 } : undefined);
      const freshIds=new Set(s.placements.filter(p=>p.kind==='new').map(p=>p.demandId));
      const unused=s.offcuts.filter(o=>freshIds.has(o.sourceDemandId)&&!s.placements.some(p=>p.offcutId===o.id&&p.kind==='reuse')); 
      solutionPanel=`<h2>Material reuse proposal</h2><div class="qc-statgrid"><div class="qc-stat"><strong>${s.metrics.reusedPieceCount}</strong><span>offcuts assigned</span></div><div class="qc-stat"><strong>${(s.metrics.savedMm2/1e6).toFixed(2)} m²</strong><span>less new material vs baseline</span></div><div class="qc-stat"><strong>${(s.metrics.newMaterialMm2/1e6).toFixed(2)} m²</strong><span>new physical material</span></div><div class="qc-stat"><strong>${(s.metrics.wasteMm2/1e6).toFixed(2)} m²</strong><span>remaining modelled waste</span></div></div>
      <div class="qc-note ${s.status==='invalid'?'qc-error':'qc-success'}">${s.status==='invalid'?'An edit is invalid. Review the warnings; this drawing is not suitable for quoting.':'All proposed assignments passed the V1 geometry checks. Roofer validation is still required.'}</div>
      <p class="qc-muted">${s.search.completedTrials} search trials · ${(s.search.elapsedMs/1000).toFixed(2)} s in this browser${s.search.budgetReached?' · search budget reached':''}. Best found, not proven optimal. Baseline: ${(s.metrics.baselineNewMaterialMm2/1e6).toFixed(2)} m², using the same stock policy.</p>
      <h3>Source colour key</h3>${draft.faces.map((f,i)=>`<div class="qc-legend"><i class="qc-swatch" style="background:${PALETTE[i%PALETTE.length]}33;border-color:${PALETTE[i%PALETTE.length]}"></i>${esc(f.name)}: solid = new; cross-hatch = its offcut reused</div>`).join('')}
      <h3>Offcut assignments</h3><div class="qc-list">${s.placements.filter(p=>p.kind==='reuse').map(p=>{const o=s.offcuts.find(o=>o.id===p.offcutId)!;return `<button class="qc-assignment ${p.offcutId===selectedOffcutId?'selected':''}" data-action="select-offcut" data-id="${esc(p.offcutId)}"><b>${esc(draft.faces.find(f=>f.id===o.sourceFaceId)?.name)} → ${esc(draft.faces.find(f=>f.id===s.demands.find(d=>d.id===p.demandId)?.faceId)?.name)}</b>${esc(o.sourceDemandId)} → ${esc(p.demandId)}<br/>${p.rotation}° end orientation${p.manual?' · manually adjusted':''}</button>`;}).join('')||'<p class="qc-muted">No permitted reuse found. All-new coverage remains a valid fallback; unused offcuts are counted as waste.</p>'}</div>
      <details><summary>Unassigned source pieces (${unused.length})</summary><div class="qc-list">${unused.map(o=>`<button class="qc-assignment ${o.id===selectedOffcutId?'selected':''}" data-action="select-offcut" data-id="${esc(o.id)}"><b>${esc(o.sourceDemandId)}</b>${(area(o.region)/1e6).toFixed(3)} m² available · select to place manually</button>`).join('')}</div></details>
      ${p?`<h3>Selected physical offcut</h3><p class="qc-muted">Drag the outlined piece onto another sheet lane. Sideways motion snaps to actual lane registration; its size never changes.</p><label class="qc-field">Destination sheet<select id="destination">${s.demands.map(d=>`<option value="${esc(d.id)}" ${d.id===p.demandId?'selected':''}>${esc(d.id)}</option>`).join('')}</select></label><div class="qc-fields"><label>Rotation<select id="offcut-rotation"><option value="0" ${p.rotation===0?'selected':''}>0°</option><option value="180" ${p.rotation===180?'selected':''}>180° end-for-end</option></select></label><label>Along-sheet shift, mm<input id="offcut-shift" type="number" value="${p.translateY.toFixed(2)}"/></label></div><div class="qc-actions"><button data-action="fit-placement">Snap valid fit</button><button data-action="apply-placement">Apply placement</button><button data-action="rotate-offcut">Rotate 180°</button></div>`:''}
      <div class="qc-actions"><button data-action="back">Edit faces / rules</button><button class="primary" data-action="run">Re-optimise</button></div>`;
    }
    shadow.innerHTML=`<style>${styles}</style><div class="qc-app"><header class="qc-header"><div><h1>Find offcuts</h1><p>QuoteCore · roof-face review and sheet-level material reuse</p></div><span class="qc-badge">V1 · REVIEW REQUIRED</span>${options.onClose?'<button data-action="close" aria-label="Close offcut review">Close</button>':''}</header>
      <nav class="qc-topbar"><span class="qc-step"><b>1</b>Review faces</span><span class="qc-muted">→</span><span class="qc-step"><b>2</b>Find reuse</span><span class="qc-muted">→</span><span class="qc-step"><b>3</b>Adjust / export</span><span class="qc-spacer"></span><button data-action="undo" ${history.length?'':'disabled'}>Undo</button><button data-action="redo" ${redoHistory.length?'':'disabled'}>Redo</button><button data-action="fit">Fit</button><button data-action="zoom-in" aria-label="Zoom in">+</button><button data-action="zoom-out" aria-label="Zoom out">−</button><button data-action="export-json">Export draft</button><button data-action="export-svg" ${!s?'disabled':''}>Export drawing</button></nav>
      <main class="qc-main"><section class="qc-viewport"><div class="qc-canvas"></div><div class="qc-help">${drawPoints?'Click to add polygon points, then Finish polygon.':phase==='faces'?'Select a face. Drag its white vertex handles or the water-arrow tip. Wheel to zoom.':'Solid = new material · cross-hatch = reused offcuts · select or drag a reused piece.'}</div>${busy?`<div class="qc-busy"><strong>Finding compatible offcuts</strong><span>${esc(progress)}</span><button data-action="cancel">Cancel search</button></div>`:''}</section>
      <aside class="qc-sidebar">${stale?'<div class="qc-note qc-error">The underlying takeoff changed. Close and reopen Find offcuts before using or exporting this proposal.</div>':''}${error?`<div class="qc-note qc-error" role="alert">${esc(error).replace(/\n/g,'<br/>')}</div>`:''}
      ${phase==='faces'?`<h2>${draft.faces.length} roof faces</h2><p class="qc-muted">Read from the completed takeoff’s actual polygons and classified lines. Confirm the outline, drainage and pitch before solving.</p>
      <details><summary>Selected roof outlines (${sourceOutlines.length} available)</summary>${sourceOutlines.map(o=>`<label class="qc-check"><input data-outline="${esc(o.id)}" type="checkbox" ${draft.roof.outlines.some(a=>a.id===o.id)?'checked':''}/>${esc(o.name)}</label>`).join('')}<button data-action="detect">Rebuild faces from linework</button></details>
      <div class="qc-list">${draft.faces.map(g=>`<button class="qc-face ${g.id===selectedFaceId?'active':''}" data-action="select-face" data-id="${esc(g.id)}"><span>${esc(g.name)}</span><small>${g.confirmed?'✓ reviewed':'needs review'} · ${g.polygon.length} vertices</small></button>`).join('')}</div>
      <div class="qc-actions"><button data-action="add-face">Add face</button>${drawPoints?'<button data-action="finish-polygon">Finish polygon</button><button data-action="cancel-polygon">Cancel polygon</button>':''}<button data-action="confirm-all">Confirm reviewed faces</button></div>${editForm}${profileForm}<button data-action="run" class="primary" style="width:100%;margin-top:12px" ${busy||stale?'disabled':''}>Find offcut reuse</button>`:solutionPanel}
      ${phase==='solution'?`<h3>Drawing layers</h3><label class="qc-check"><input data-display="showSheets" type="checkbox" ${showSheets?'checked':''}/>Show individual sheet boundaries</label><label class="qc-check"><input data-display="showSources" type="checkbox" ${showSources?'checked':''}/>Show generated offcuts at their source</label><label class="qc-check"><input data-display="showEnvelope" type="checkbox" ${showEnvelope?'checked':''}/>Show new-sheet envelopes</label>`:''}
      <div class="qc-note">Prototype only. No quote prices, saved takeoff measurements or supplier orders are changed. A geometric fit is not manufacturer approval.</div>
      ${reported.length?`<details ${errors.length?'open':''}><summary>Checks / notes (${reported.length})</summary>${reported.slice(0,35).map(i=>`<div class="qc-note ${i.severity==='error'?'qc-error':''}"><b>${esc(i.code)}</b><br/>${esc(i.message)}</div>`).join('')}</details>`:''}</aside></main>
      <footer class="qc-footer"><span>Page: ${esc(draft.roof.pageId)} · scope: ${esc(draft.roof.areaScopeId??'selected page outlines')} · ${draft.roof.mmPerSceneUnit.toFixed(3)} mm / scene unit</span><span>No cloud writes · export to retain this draft</span></footer></div>`;
    renderScene();
  }
  function download(name:string,contents:string,mime:string):void {
    const blob=new Blob([contents],{type:mime}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function ensureCurrent():void { if(stale||options.readCurrentSourceRevision&&options.readCurrentSourceRevision()!==capturedRevision)throw new Error('Takeoff changed. Reopen this review from the current canvas.'); }
  function run():void {
    ensureCurrent();
    if(issues.some(i=>i.severity==='error'))throw new Error('Face detection reported topology errors. Correct the faces, then use Confirm reviewed faces to explicitly acknowledge the reviewed linework.');
    checkpoint();cancel();error='';selectedOffcutId='';busy=true;progress='Building pitch-corrected sheet lanes…';jobId=localId();
    const id=jobId;
    try {
      worker=options.createWorker?.()??new Worker(new URL('../worker.ts',import.meta.url),{type:'module'});
      worker.onmessage=(event:MessageEvent)=>{
        if(disposed||event.data.id!==jobId||id!==jobId)return;
        if(event.data.kind==='progress'){progress=`${event.data.completed} / ${event.data.total} layout trials`;render();return;}
        if(event.data.kind==='result'){
          draft.solution=event.data.solution as Solution;phase='solution';selectedOffcutId=draft.solution.placements.find(p=>p.kind==='reuse')?.offcutId??'';
          // Suggestions become visible arrows without mutating the locked input
          // face state used to fingerprint the original solve request.
          cancel();render();
        }else if(event.data.kind==='error'){error=event.data.message;cancel();render();}
      };
      worker.onerror=(e)=>{error=`Worker failed: ${e.message}. Check the module-worker path / Content Security Policy.`;cancel();render();};
      worker.postMessage({id,request:{roof:draft.roof,faces:draft.faces,profile:draft.profile,settings:draft.settings}});
    } catch(e){error=message(e);cancel();}
    render();
  }
  function click(event:Event):void {
    const target=(event.target as Element).closest<HTMLElement>('[data-action]');if(!target)return;
    const action=target.dataset.action;error='';
    try {
      if(action==='close'){options.onClose?.();return;}
      if(action==='cancel'){cancel();render();return;}
      if(action==='select-face'){selectedFaceId=target.dataset.id??'';render();return;}
      if(action==='select-offcut'){selectedOffcutId=target.dataset.id??'';render();return;}
      if(action==='undo'||action==='redo'){
        const from=action==='undo'?history:redoHistory,to=action==='undo'?redoHistory:history,item=from.pop();
        if(item){to.push(JSON.stringify(draft));cancel();draft=JSON.parse(item);phase=draft.solution?'solution':'faces';selectedFaceId=draft.faces[0]?.id??'';selectedOffcutId='';}render();return;
      }
      if(action==='fit'){viewBox=[-30,-30,roof.sceneWidth+60,roof.sceneHeight+60];renderScene();return;}
      if(action==='zoom-in'||action==='zoom-out'){const factor=action==='zoom-in'?.8:1.25;zoom(factor,{x:viewBox[0]+viewBox[2]/2,y:viewBox[1]+viewBox[3]/2});return;}
      if(action==='export-json'){ensureCurrent();download('quotecore-offcuts-review-draft.json',exportDraft(draft),'application/json');options.onExport?.(structuredClone(draft));return;}
      if(action==='export-svg'){
        ensureCurrent();if(!draft.solution)throw new Error('Run the optimiser first.');
        if(validateDraft(draft).some(i=>i.severity==='error'))throw new Error('The current placement is invalid. Export a draft JSON for review, or fix it before exporting a drawing.');
        download('quotecore-offcuts-PROTOTYPE.svg',renderSvg(draft,{phase:'solution',print:true,showSheets,showEnvelope}),'image/svg+xml');return;
      }
      if(action==='run'){run();return;}
      if(action==='back'){cancel();phase='faces';render();return;}
      if(action==='detect'){detect();render();return;}
      if(action==='add-face'){checkpoint();invalidate();drawPoints=[];render();return;}
      if(action==='cancel-polygon'){drawPoints=null;render();return;}
      if(action==='finish-polygon'){
        if(!drawPoints||drawPoints.length<3)throw new Error('Add at least three polygon vertices.');
        const id=`manual-${localId().slice(0,8)}`;draft.faces.push({id,name:`Face ${draft.faces.length+1}`,polygon:drawPoints,boundary:[],flow:null,lap:1,lapLocked:false,pitchDeg:null,laneOffsetMm:0,confirmed:false,provenance:'manual'});selectedFaceId=id;drawPoints=null;render();return;
      }
      if(action==='confirm-all'){
        if(issues.some(i=>i.severity==='error')){
          if(!window.confirm('Linework anomalies remain. Have you manually checked and corrected every face despite these anomalies? The geometric partition will still be validated.'))return;
          draft.reviewNotes=[...(draft.reviewNotes??[]),...issues.filter(i=>i.severity==='error')];
          issues=issues.map(i=>i.severity==='error'?{...i,severity:'warning',code:`REVIEWED_${i.code}`,message:`Explicitly acknowledged during face review: ${i.message}`} : i);
        }
        checkpoint();draft.faces.forEach(f=>{f.confirmed=true;});render();return;
      }
      const f=face();
      if(action==='confirm-face'&&f){checkpoint();f.confirmed=true;render();return;}
      if(action==='apply-pitch'&&f){checkpoint();invalidate();draft.faces.forEach(g=>{g.pitchDeg=f.pitchDeg;g.confirmed=false;});render();return;}
      if(action==='delete-face'&&f){checkpoint();invalidate();draft.faces=draft.faces.filter(g=>g.id!==f.id);selectedFaceId=draft.faces[0]?.id??'';render();return;}
      if(action==='merge'&&f){const id=(shadow.querySelector('#merge-target') as HTMLSelectElement).value,g=draft.faces.find(g=>g.id===id);if(!g)throw new Error('Choose an adjacent face.');const combined=mergeFaces(f,g);checkpoint();invalidate();draft.faces=draft.faces.filter(h=>h.id!==g.id).map(h=>h.id===f.id?combined:h);render();return;}
      if(action==='split'&&f){const axis=(shadow.querySelector('#split-axis') as HTMLSelectElement).value as 'x'|'y',at=Number((shadow.querySelector('#split-at') as HTMLInputElement).value);const parts=splitFace(f,axis,at);checkpoint();invalidate();draft.faces=draft.faces.flatMap(g=>g.id===f.id?parts:[g]);selectedFaceId=parts[0].id;render();return;}
      if(action==='apply-polygon'&&f){const text=(shadow.querySelector('#polygon-points') as HTMLTextAreaElement).value,ps=text.trim().split(/\n+/).map(line=>{const nums=line.trim().split(/[,\s]+/).map(Number);if(nums.length!==2||!nums.every(Number.isFinite))throw new Error('Use one x,y vertex per line.');return{x:nums[0],y:nums[1]};});checkpoint();invalidate();f.polygon=ps;f.boundary=[];f.confirmed=false;f.provenance='edited';render();return;}
      if((action==='apply-placement'||action==='rotate-offcut'||action==='fit-placement')&&draft.solution){
        const o=draft.solution.offcuts.find(o=>o.id===selectedOffcutId);if(!o)throw new Error('Select an offcut.');
        const p=draft.solution.placements.find(p=>p.kind==='reuse'&&p.offcutId===selectedOffcutId) ?? {rotation:0 as const,translateY:0};
        const id=(shadow.querySelector('#destination') as HTMLSelectElement).value;
        if(action==='fit-placement'){const d=draft.solution.demands.find(d=>d.id===id)!;const fit=findFit(o,d,draft.profile);if(!fit)throw new Error('No shape- and lap-compatible fit was found for this sheet lane.');checkpoint();draft.solution=editPlacement(draft.solution,selectedOffcutId,id,fit.rotation,fit.translateY);render();return;}
        const rot=action==='rotate-offcut'?(p.rotation===0?180:0):Number((shadow.querySelector('#offcut-rotation') as HTMLSelectElement).value) as 0|180;
        const y=Number((shadow.querySelector('#offcut-shift') as HTMLInputElement).value);checkpoint();draft.solution=editPlacement(draft.solution,selectedOffcutId,id,rot,y);render();return;
      }
    }catch(e){error=message(e);if(busy)cancel();}render();
  }
  function change(event:Event):void {
    const target=event.target as HTMLInputElement|HTMLSelectElement;
    try{
      if(target.dataset.display){const checked=(target as HTMLInputElement).checked;if(target.dataset.display==='showSheets')showSheets=checked;if(target.dataset.display==='showSources')showSources=checked;if(target.dataset.display==='showEnvelope')showEnvelope=checked;renderScene();return;}
      if(target.dataset.outline){checkpoint();invalidate();const ids=new Set(draft.roof.outlines.map(o=>o.id));if((target as HTMLInputElement).checked)ids.add(target.dataset.outline);else ids.delete(target.dataset.outline);draft.roof.outlines=sourceOutlines.filter(o=>ids.has(o.id));draft.roof.sourceRevision=roofRevision(draft.roof);detect();render();return;}
      const field=target.dataset.field;if(!field)return;
      checkpoint();invalidate();const f=face(),value=target.value;
      if(field==='name'&&f)f.name=value;
      else if(field==='pitch'&&f){f.pitchDeg=value===''?null:Number(value);f.confirmed=false;}
      else if(field==='flowAngle'&&f){const angle=Number(value)*Math.PI/180;f.flow={x:Math.cos(angle),y:Math.sin(angle)};f.confirmed=false;}
      else if(field==='laneOffset'&&f)f.laneOffsetMm=Number(value);
      else if(field==='lap'&&f)f.lap=Number(value) as -1|1;
      else if(field==='lapLocked'&&f)f.lapLocked=(target as HTMLInputElement).checked;
      else if(field==='stockMode')draft.settings.stockMode=value as 'per-lane'|'face-envelope';
      else if(field==='optimiseLapDirections')draft.settings.optimiseLapDirections=(target as HTMLInputElement).checked;
      else if(field==='rulesConfirmed'||field==='allowEndForEnd')draft.profile[field]=(target as HTMLInputElement).checked;
      else if(['coverMm','leftLapMm','rightLapMm','cutGapMm','endAllowanceMm','maxLengthMm','lengthIncrementMm'].includes(field)) (draft.profile as unknown as Record<string,unknown>)[field]=Number(value);
    }catch(e){error=message(e);}render();
  }
  function pointerDown(event:Event):void {
    const e=event as PointerEvent,target=e.target as Element;if(!target.closest('svg.qc-scene'))return;
    const p=scenePoint(e);if(drawPoints){drawPoints.push(p);renderScene();return;}
    const vertex=target.closest<SVGElement>('[data-vertex]'),flow=target.closest<SVGElement>('[data-flow]'),offcut=target.closest<SVGElement>('[data-offcut]'),faceEl=target.closest<SVGElement>('[data-face]');
    if(vertex){const f=draft.faces.find(f=>f.id===vertex.dataset.faceId);if(f)drag={kind:'vertex',faceId:f.id,vertex:Number(vertex.dataset.vertex),start:p,last:p,original:{...f.polygon[Number(vertex.dataset.vertex)]},pointerId:e.pointerId};}
    else if(flow)drag={kind:'flow',faceId:flow.dataset.flow,start:p,last:p,pointerId:e.pointerId};
    else if(offcut&&phase==='solution'){selectedOffcutId=offcut.dataset.offcut??'';drag={kind:'offcut',offcutId:selectedOffcutId,start:p,last:p,pointerId:e.pointerId};}
    else if(faceEl&&phase==='faces'){selectedFaceId=faceEl.dataset.face??'';render();return;}
    if(drag){e.preventDefault();(shadow.querySelector('.qc-canvas') as HTMLElement).setPointerCapture(e.pointerId);}
  }
  function pointerMove(event:Event):void {
    if(!drag)return;const e=event as PointerEvent;drag.last=scenePoint(e);
    if(drag.kind==='offcut'){
      const group=[...shadow.querySelectorAll<SVGGElement>('[data-offcut]')].find(g=>g.dataset.offcut===drag!.offcutId);
      group?.setAttribute('transform',`translate(${drag.last.x-drag.start.x} ${drag.last.y-drag.start.y})`);
    }else if(drag.kind==='vertex'){
      const handle=[...shadow.querySelectorAll<SVGCircleElement>('[data-vertex]')].find(g=>g.dataset.faceId===drag!.faceId&&Number(g.dataset.vertex)===drag!.vertex);
      handle?.setAttribute('cx',String(drag.last.x));handle?.setAttribute('cy',String(drag.last.y));
    }else{
      const handle=[...shadow.querySelectorAll<SVGCircleElement>('[data-flow]')].find(g=>g.dataset.flow===drag!.faceId);
      handle?.setAttribute('cx',String(drag.last.x));handle?.setAttribute('cy',String(drag.last.y));
    }
  }
  function pointerUp(event:Event):void {
    if(!drag)return;const e=event as PointerEvent,state=drag;drag=null;
    try{
      const p=scenePoint(e);if(distance(p,state.start)<.5){render();return;}
      checkpoint();
      if(state.kind==='vertex'){
        invalidate();for(const f of draft.faces){let changed=false;f.polygon=f.polygon.map(q=>{if(distance(q,state.original!)<.01){changed=true;return p;}return q;});if(changed){f.confirmed=false;f.provenance='edited';f.boundary=[];}}
      }else if(state.kind==='flow'){
        const f=draft.faces.find(f=>f.id===state.faceId);if(f){invalidate();f.flow=unit(sub(p,centroid(f.polygon)));f.confirmed=false;}
      }else if(draft.solution){
        const s=draft.solution,o=s.offcuts.find(o=>o.id===state.offcutId);if(!o)throw new Error('Source offcut not found.');
        const placement=s.placements.find(a=>a.offcutId===state.offcutId&&a.kind==='reuse') ?? {demandId:o.sourceDemandId,translateY:0,rotation:0 as const};
        const target=s.demands.find(d=>pointInRegion(d.cover,scenePointToDemand(p,d)));
        if(!target)throw new Error('Drop the offcut onto a sheet lane on the roof.');
        const original=s.demands.find(d=>d.id===placement.demandId)!;
        let dy=placement.translateY;
        if(target.id===original.id)dy+=scenePointToDemand(p,target).y-scenePointToDemand(state.start,original).y;
        else {
          // Preserve the grabbed point's relative sheet coordinate at the new
          // destination. Horizontal motion snaps; only along-run shift is free.
          const anchor=scenePointToDemand(state.start,original).y-placement.translateY;
          dy=scenePointToDemand(p,target).y-anchor;
        }
        draft.solution=editPlacement(s,state.offcutId!,target.id,placement.rotation,dy);
      }
    }catch(e){error=message(e);}render();
  }
  function zoom(factor:number,anchor:Point):void {if(viewBox[2]*factor<roof.sceneWidth*.12||viewBox[2]*factor>roof.sceneWidth*3)return;viewBox=[anchor.x+(viewBox[0]-anchor.x)*factor,anchor.y+(viewBox[1]-anchor.y)*factor,viewBox[2]*factor,viewBox[3]*factor];renderScene();}
  function wheel(event:Event):void {const e=event as WheelEvent;if(!(e.target as Element).closest('.qc-canvas'))return;e.preventDefault();zoom(e.deltaY>0?1.12:1/1.12,scenePoint(e));}
  function pointerCancel():void {drag=null;renderScene();}
  shadow.addEventListener('click',click);shadow.addEventListener('change',change);shadow.addEventListener('pointerdown',pointerDown);shadow.addEventListener('pointermove',pointerMove);shadow.addEventListener('pointerup',pointerUp);shadow.addEventListener('pointercancel',pointerCancel);shadow.addEventListener('wheel',wheel,{passive:false});
  const watch=options.readCurrentSourceRevision?setInterval(()=>{try{if(!stale&&options.readCurrentSourceRevision!()!==capturedRevision){stale=true;cancel();render();}}catch{stale=true;cancel();render();}},1000):null;
  render();
  return {getDraft:()=>structuredClone(draft),destroy:()=>{disposed=true;cancel();if(watch)clearInterval(watch);shadow.removeEventListener('click',click);shadow.removeEventListener('change',change);shadow.removeEventListener('pointerdown',pointerDown);shadow.removeEventListener('pointermove',pointerMove);shadow.removeEventListener('pointerup',pointerUp);shadow.removeEventListener('wheel',wheel);shadow.removeEventListener('pointercancel',pointerCancel);shadow.innerHTML='';}};
}
