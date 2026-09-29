import type { Draft, Issue, Point, RoofFace, RoofInput, Solution } from '../core/types';
import { DEFAULT_PROFILE, DEFAULT_SETTINGS } from '../core/types';
import { deriveFaces, validatePartition } from '../core/graph';
import { centroid, distance, unit, sub } from '../core/math';
import { area, pointInRegion } from '../core/regions';
import { scenePointToDemand } from '../core/material';
import { findFit } from '../core/solver';
import { materialPlan, newStockSchedule, reuseGroups } from '../core/plan';
import { moveReuseGroup } from '../core/groupEditing';
import { editPlacement, mergeFaces, splitFace, validateDraft } from '../core/editing';
import { exportDraft } from '../core/codec';
import { roofRevision } from '../adapters/quotecore';
import { escapeHtml as esc, PALETTE, renderSvg, interiorAnchor } from './svg';
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
  kind: 'vertex' | 'flow' | 'offcut' | 'group'; groupId?: string; faceId?: string; vertex?: number; offcutId?: string;
  start: Point; last: Point; original?: Point; pointerId: number;
}
export function mountWorkbench(host: HTMLElement, roof: RoofInput, options: WorkbenchOptions = {}): WorkbenchHandle {
  const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
  let draft: Draft = options.initialDraft ? structuredClone(options.initialDraft) : {
    schemaVersion: 1, roof: structuredClone(roof), faces: [], profile: { ...DEFAULT_PROFILE }, settings: { ...DEFAULT_SETTINGS }, solution: null,
  };
  const capturedRevision=roof.sourceRevision, sourceOutlines=structuredClone(roof.outlines);
  let phase: 'faces'|'solution' = draft.solution?'solution':'faces';
  let selectedFaceId='', selectedOffcutId='', selectedGroupId='', advancedOpen=false, editPieces=false, worker: Worker|null=null, jobId='', busy=false, progress='', disposed=false;
  let issues: Issue[] = [...(options.initialIssues??[])], error='', stale=false;
  let showSheets=false, showSources=false, showEnvelope=false, drawPoints: Point[]|null=null, drag:Drag|null=null;
  let viewBox = [-30,-30,roof.sceneWidth+60,roof.sceneHeight+60];
  const history: string[] = [], redoHistory: string[] = [];
  function checkpoint():void { history.push(JSON.stringify(draft)); if(history.length>40)history.shift(); redoHistory.length=0; }
  function cancel():void {worker?.terminate();worker=null;busy=false;jobId='';}
  function invalidate():void { cancel();draft.solution=null;phase='faces';selectedOffcutId='';selectedGroupId='';error=''; }
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
    canvas.innerHTML=renderSvg(draft,{phase,selectedFaceId,selectedOffcutId,selectedGroupId,editPieces,showSheets,showSources,showEnvelope,viewBox:viewBox.join(' '),pendingPolygon:drawPoints??undefined});
  }
  function inputField(label:string,field:string,value:number|null,step='1'):string {return `<label>${esc(label)}<input data-field="${field}" type="number" step="${step}" value="${value===null?'':value}"/></label>`;}
  function render(): void {
    if (disposed) return;
    const f = face(), s = draft.solution, reported = allIssues(), errors = reported.filter(i => i.severity === 'error');
    const faceName = (id: string): string => draft.faces.find(g => g.id === id)?.name ?? id;
    const color = (id: string): string => PALETTE[Math.max(0, draft.faces.findIndex(g => g.id === id)) % PALETTE.length];
    const pitch = draft.faces.length && draft.faces.every(g => g.pitchDeg === draft.faces[0].pitchDeg) ? draft.faces[0].pitchDeg : null;
    const faceButtons = `<div class="qc-face-grid">${draft.faces.map(g => `<button class="qc-face ${g.id === selectedFaceId ? 'active' : ''}" data-action="select-face" data-id="${esc(g.id)}">${esc(g.name)}${g.confirmed ? ' ✓' : ''}</button>`).join('')}</div>`;
    const faceTools = f ? `<h3>${esc(f.name)} — face tools</h3><label class="qc-field">Name<input data-field="name" value="${esc(f.name)}"/></label>
      <div class="qc-fields">${inputField('Water angle ° (90 = down)', 'flowAngle', f.flow ? Math.atan2(f.flow.y, f.flow.x) * 180 / Math.PI : null, '45')}${inputField('This face’s pitch °', 'pitch', f.pitchDeg, '0.5')}${inputField('Lane start offset, mm', 'laneOffset', f.laneOffsetMm)}<label>Lap direction<select data-field="lap"><option value="1" ${f.lap === 1 ? 'selected' : ''}>Along +cross-slope</option><option value="-1" ${f.lap === -1 ? 'selected' : ''}>Along −cross-slope</option></select></label></div>
      <label class="qc-check"><input data-field="lapLocked" type="checkbox" ${f.lapLocked ? 'checked' : ''}/>Lock this face’s lap direction</label>
      <label class="qc-check"><input data-field="laneOffsetLocked" type="checkbox" ${f.laneOffsetLocked ? 'checked' : ''}/>Lock this face’s sheet-joint registration</label>
      <div class="qc-actions"><button data-action="confirm-face">Confirm this face</button><button data-action="apply-pitch">Apply pitch to all</button><button data-action="delete-face">Delete face</button></div>
      <details><summary>Split, join or edit vertices</summary><div class="qc-fields"><label>Split axis<select id="split-axis"><option value="x">Vertical (x)</option><option value="y">Horizontal (y)</option></select></label><label>Scene coordinate<input id="split-at" type="number" value="${centroid(f.polygon).x.toFixed(1)}"/></label></div><button data-action="split">Split selected face</button>
      <label class="qc-field">Join with<select id="merge-target">${draft.faces.filter(g => g.id !== f.id).map(g => `<option value="${esc(g.id)}">${esc(g.name)}</option>`).join('')}</select></label><button data-action="merge" ${draft.faces.length < 2 ? 'disabled' : ''}>Join faces</button>
      <label class="qc-field">Vertices: x,y per line<textarea id="polygon-points">${f.polygon.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join('\n')}</textarea></label><button data-action="apply-polygon">Apply polygon</button></details>` : '';
    const materialTools = `<h3>Material rules</h3><label class="qc-field">Stock strategy<select data-field="stockMode"><option value="bank-first" ${draft.settings.stockMode === 'bank-first' ? 'selected' : ''}>Primary banks + straight fillers</option><option value="face-envelope" ${draft.settings.stockMode === 'face-envelope' ? 'selected' : ''}>Legacy: full face envelopes</option><option value="per-lane" ${draft.settings.stockMode === 'per-lane' ? 'selected' : ''}>Legacy: independent sheet lengths</option></select></label>
      <div class="qc-fields">${inputField('Physical left lap, mm', 'leftLapMm', draft.profile.leftLapMm)}${inputField('Physical right lap, mm', 'rightLapMm', draft.profile.rightLapMm)}${inputField('Cut clearance, mm', 'cutGapMm', draft.profile.cutGapMm)}${inputField('End allowance, mm', 'endAllowanceMm', draft.profile.endAllowanceMm)}${inputField('Maximum sheet length, mm', 'maxLengthMm', draft.profile.maxLengthMm)}${inputField('Length increment, mm', 'lengthIncrementMm', draft.profile.lengthIncrementMm)}${inputField('Max extra reuse stock, mm', 'maxBankExtensionMm', draft.settings.maxBankExtensionMm ?? 100)}</div>
      <p class="qc-muted">Extra reuse stock is optional, counted as supplied length and reported on the plan. Set its limit to 0 to prohibit it. Physical overlaps and cut allowances require profile-specific checks.</p>
      <label class="qc-check"><input data-field="rulesConfirmed" type="checkbox" ${draft.profile.rulesConfirmed ? 'checked' : ''}/>Profile / lap rules checked</label>
      <label class="qc-check"><input data-field="optimiseLapDirections" type="checkbox" ${draft.settings.optimiseLapDirections ? 'checked' : ''}/>Suggest lap directions for unlocked faces</label>`;
    let normal = '', solutionTools = '';
    if (s && phase === 'solution') {
      const rows = materialPlan(draft.faces, s), groups = reuseGroups(s), selectedGroup = groups.find(g => g.id === selectedGroupId);
      normal = `<h2>Sheet & offcut plan</h2><p class="qc-plan-total"><strong>${s.metrics.newSheetCount} new sheets</strong><span>${s.metrics.reusedPieceCount} positions filled with offcuts</span></p>
        <div class="qc-material-plan">${rows.map(row => {
          const type = row.newCount === row.sheetCount ? `NEW · ${row.sheetCount} sheets` : row.newCount === 0 ? `OFFCUT · ${row.sheetCount} sheets` : `${row.newCount} NEW + ${row.reuseCount} OFFCUT`;
          const source = row.sources.length ? `From ${row.sources.map(a => esc(faceName(a.faceId))).join(' + ')}` : row.feeds.length ? `Offcuts → ${row.feeds.map(a => esc(faceName(a.faceId))).join(', ')}` : 'New material';
          return `<button class="qc-plan-row ${selectedFaceId === row.faceId ? 'selected' : ''}" data-action="select-plan-face" data-id="${esc(row.faceId)}" style="--source-color:${color(row.sources[0]?.faceId ?? row.faceId)}"><span><b>${esc(row.name)}</b><strong>${esc(type)}</strong></span><small>${source}</small>${row.extraLengthMm > 0 ? `<small class="qc-extra">Cut stock includes +${row.extraLengthMm.toFixed(1)} mm — verify length</small>` : ''}</button>`;
        }).join('')}</div>
        <label class="qc-check"><input data-display="showSheets" type="checkbox" ${showSheets ? 'checked' : ''}/>Show sheet lines</label>
        ${selectedGroup ? `<div class="qc-selection"><b>${esc(faceName(selectedGroup.sourceFaceId))} → ${esc(faceName(selectedGroup.destinationFaceId))}</b><p>${selectedGroup.sheetCount} offcut sheets. Drag the set to another face to try a valid fit.</p><button data-action="edit-group-pieces">Edit individual pieces</button><button data-action="clear-selection">Deselect</button></div>` : ''}
        <div class="qc-actions"><button data-action="back">Review faces</button><button data-action="run" class="primary" ${busy || stale ? 'disabled' : ''}>Recalculate</button></div>
        ${!draft.profile.allowEndForEnd ? '<p class="qc-note">End-for-end reuse is disabled. Check the profile setting in Review faces if the expected hip offcuts are missing.</p>' : ''}
        ${s.search.budgetReached ? '<p class="qc-note">Search limit reached. This is the best complete plan found; some reuse may remain undiscovered.</p>' : ''}`;
      const selected = s.offcuts.find(o => o.id === selectedOffcutId);
      const placement = s.placements.find(p => p.kind === 'reuse' && p.offcutId === selectedOffcutId) ?? (selected ? { demandId: s.demands[0]?.id ?? '', rotation: 0 as const, translateY: 0 } : undefined);
      const fresh = new Set(s.placements.filter(p => p.kind === 'new').map(p => p.demandId));
      const unused = s.offcuts.filter(o => fresh.has(o.sourceDemandId) && !s.placements.some(p => p.kind === 'reuse' && p.offcutId === o.id));
      solutionTools = `<h3>Drawing & physical pieces</h3><label class="qc-check"><input data-display="editPieces" type="checkbox" ${editPieces ? 'checked' : ''}/>Edit individual offcuts instead of sets</label>
        <label class="qc-check"><input data-display="showSources" type="checkbox" ${showSources ? 'checked' : ''}/>Show offcuts at their source</label><label class="qc-check"><input data-display="showEnvelope" type="checkbox" ${showEnvelope ? 'checked' : ''}/>Show new-sheet envelopes</label>
        <details><summary>Individual assignments (${s.metrics.reusedPieceCount})</summary><div class="qc-list">${s.placements.filter(p => p.kind === 'reuse').map(p => `<button class="qc-assignment" data-action="select-offcut" data-id="${esc(p.offcutId)}">${esc(s.offcuts.find(o => o.id === p.offcutId)?.sourceDemandId)} → ${esc(p.demandId)}</button>`).join('')}</div></details>
        <details><summary>Unused source pieces (${unused.length})</summary><div class="qc-list">${unused.map(o => `<button class="qc-assignment" data-action="select-offcut" data-id="${esc(o.id)}">${esc(o.sourceDemandId)} · ${(area(o.region) / 1e6).toFixed(3)} m²</button>`).join('')}</div></details>
        ${placement ? `<h3>Selected physical offcut</h3><label class="qc-field">Destination sheet<select id="destination">${s.demands.map(d => `<option value="${esc(d.id)}" ${d.id === placement.demandId ? 'selected' : ''}>${esc(d.id)}</option>`).join('')}</select></label><div class="qc-fields"><label>Rotation<select id="offcut-rotation"><option value="0" ${placement.rotation === 0 ? 'selected' : ''}>0°</option><option value="180" ${placement.rotation === 180 ? 'selected' : ''}>180° end-for-end</option></select></label><label>Along-sheet shift, mm<input id="offcut-shift" type="number" value="${placement.translateY.toFixed(2)}"/></label></div><div class="qc-actions"><button data-action="fit-placement">Snap valid fit</button><button data-action="apply-placement">Apply placement</button><button data-action="rotate-offcut">Rotate 180°</button></div>` : ''}
        <details><summary>Plan-derived stock lengths</summary><p class="qc-muted">Replace with verified site-measured lengths before ordering. Includes reported extra stock. Spares are not included.</p><table class="qc-stock"><thead><tr><th>Face</th><th>Qty</th><th>Length</th></tr></thead><tbody>${newStockSchedule(s).map(g => `<tr><td>${esc(faceName(g.faceId))}<small>${esc(g.role)}</small></td><td>${g.count}</td><td>${(g.lengthMm / 1000).toFixed(3)} m</td></tr>`).join('')}</tbody></table></details>
        <details><summary>Material totals & search</summary><p class="qc-muted">New physical metal: ${(s.metrics.newMaterialMm2 / 1e6).toFixed(2)} m²<br/>Net roof surface: ${(s.metrics.netRoofMm2 / 1e6).toFixed(2)} m²<br/>Modelled waste: ${(s.metrics.wasteMm2 / 1e6).toFixed(2)} m²<br/>${s.search.completedTrials} completed trials · ${(s.search.elapsedMs / 1000).toFixed(2)} s<br/>Practical bounded search, not a proven minimum. Areas include pitch; physical overlaps differ from net cover. Waste is not a quoting allowance.</p></details>`;
    } else {
      normal = `<h2>Check the faces</h2><p class="qc-muted">${draft.faces.length} faces found. Check the outlines and water arrows; drag to correct them.</p>${faceButtons}
        <div class="qc-fields">${inputField('Sheet cover, mm', 'coverMm', draft.profile.coverMm)}${inputField('Pitch ° — all faces', 'allPitch', pitch, '0.5')}</div>
        ${draft.faces.some(g => g.pitchDeg !== pitch) ? '<p class="qc-muted">Mixed pitches: keep them, or enter a common pitch. Individual pitches are in Advanced.</p>' : ''}
        <label class="qc-check"><input data-field="approvedEndForEnd" type="checkbox" ${draft.profile.allowEndForEnd && draft.profile.rulesConfirmed ? 'checked' : ''}/>End-for-end reuse is approved for this profile.</label>
        <p class="qc-muted">Never turn a sheet face-down. Leave this unchecked until the profile / lap rule is verified.</p>
        ${drawPoints ? '<div class="qc-actions"><button data-action="finish-polygon">Finish polygon</button><button data-action="cancel-polygon">Cancel polygon</button></div>' : ''}
        <button data-action="confirm-run" class="primary qc-wide" ${busy || stale ? 'disabled' : ''}>Faces correct — find offcuts</button>`;
    }
    const advanced = `<details id="qc-advanced" ${advancedOpen ? 'open' : ''}><summary>Advanced</summary>${phase === 'solution' ? solutionTools : `<details><summary>Selected roof outlines</summary>${sourceOutlines.map(o => `<label class="qc-check"><input data-outline="${esc(o.id)}" type="checkbox" ${draft.roof.outlines.some(a => a.id === o.id) ? 'checked' : ''}/>${esc(o.name)}</label>`).join('')}<button data-action="detect">Rebuild from linework</button></details><div class="qc-actions"><button data-action="add-face">Add face</button><button data-action="confirm-all">Confirm reviewed faces</button></div>${faceTools}${materialTools}`}
      ${reported.length ? `<details ${errors.length ? 'open' : ''}><summary>Checks / notes (${reported.length})</summary>${reported.slice(0, 35).map(i => `<div class="qc-note ${i.severity === 'error' ? 'qc-error' : ''}"><b>${esc(i.code)}</b><br/>${esc(i.message)}</div>`).join('')}</details>` : ''}
      <div class="qc-actions"><button data-action="export-json">Export draft</button><button data-action="redo" ${redoHistory.length ? '' : 'disabled'}>Redo</button></div><p class="qc-muted">Page: ${esc(draft.roof.pageId)}<br/>Scope: ${esc(draft.roof.areaScopeId ?? 'selected page')}<br/>${draft.roof.mmPerSceneUnit.toFixed(3)} mm / scene unit<br/>Export a draft to keep it; this review does not save to the database.</p></details>`;
    shadow.innerHTML = `<style>${styles}</style><div class="qc-app"><header class="qc-header"><div><h1>Find offcuts</h1><p>Plan the new sheets. Reuse the cuts.</p></div><span class="qc-badge">V2 · DRAFT PLAN</span>${options.onClose ? '<button data-action="close" aria-label="Close offcut review">Close</button>' : ''}</header>
      <nav class="qc-topbar"><span class="qc-step"><b>1</b>Review faces</span><span class="qc-muted">→</span><span class="qc-step"><b>2</b>Cut plan</span><span class="qc-spacer"></span><button data-action="undo" ${history.length ? '' : 'disabled'}>Undo</button><button data-action="fit">Fit</button><button data-action="zoom-in" aria-label="Zoom in">+</button><button data-action="zoom-out" aria-label="Zoom out">−</button>${s ? '<button data-action="export-svg">Export drawing</button>' : ''}</nav>
      <main class="qc-main"><section class="qc-viewport"><div class="qc-canvas"></div><div class="qc-help">${drawPoints ? 'Click polygon vertices, then Finish polygon.' : phase === 'faces' ? 'Select a face · drag a vertex or water arrow · scroll to zoom' : 'Solid = new · matching hatch = offcuts · arrows = water / lap'}</div>${busy ? `<div class="qc-busy"><strong>Planning sheet banks & offcuts</strong><span>${esc(progress)}</span><button data-action="cancel">Cancel</button></div>` : ''}</section>
      <aside class="qc-sidebar">${stale ? '<div class="qc-note qc-error" role="alert">Takeoff changed. Close and reopen Find offcuts before using this plan.</div>' : ''}${error ? `<div class="qc-note qc-error" role="alert">${esc(error).replace(/\n/g, '<br/>')}</div>` : ''}${errors.length ? `<div class="qc-note qc-error" role="alert"><b>${errors.length} check${errors.length === 1 ? '' : 's'} need attention.</b> ${esc(errors[0].message)}<br/>See Advanced for details. An invalid plan cannot be exported as a drawing.</div>` : ''}${normal}${advanced}</aside></main>
      <footer class="qc-footer"><span>Draft only — verify profile and site lengths before ordering.</span><span>No spare sheets included.</span></footer></div>`;
    renderScene();
  }
  function download(name:string,contents:string,mime:string):void {
    const blob=new Blob([contents],{type:mime}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function ensureCurrent():void { if(stale||options.readCurrentSourceRevision&&options.readCurrentSourceRevision()!==capturedRevision)throw new Error('Takeoff changed. Reopen this review from the current canvas.'); }
  function run():void {
    ensureCurrent();
    if(issues.some(i=>i.severity==='error'))throw new Error('Face detection reported topology errors. Correct the faces, then use Confirm reviewed faces to explicitly acknowledge the reviewed linework.');
    checkpoint();cancel();error='';selectedOffcutId='';busy=true;progress='Testing primary banks and complete offcut sets…';jobId=localId();
    const id=jobId;
    try {
      worker=options.createWorker?.()??new Worker(new URL('../worker.ts',import.meta.url),{type:'module'});
      worker.onmessage=(event:MessageEvent)=>{
        if(disposed||event.data.id!==jobId||id!==jobId)return;
        if(event.data.kind==='progress'){progress=`${event.data.completed} / ${event.data.total} layout trials`;render();return;}
        if(event.data.kind==='result'){
          draft.solution=event.data.solution as Solution;phase='solution';selectedOffcutId='';selectedGroupId='';advancedOpen=false;editPieces=false;
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
      if(action==='select-offcut'){selectedOffcutId=target.dataset.id??'';selectedGroupId='';advancedOpen=true;editPieces=true;render();return;}
      if(action==='select-plan-face'){selectedFaceId=target.dataset.id??'';selectedGroupId=draft.solution?reuseGroups(draft.solution).find(g=>g.destinationFaceId===selectedFaceId)?.id??'':'';render();return;}
      if(action==='clear-selection'){selectedGroupId='';selectedOffcutId='';render();return;}
      if(action==='edit-group-pieces'&&draft.solution){selectedOffcutId=reuseGroups(draft.solution).find(g=>g.id===selectedGroupId)?.offcutIds[0]??'';editPieces=true;advancedOpen=true;render();return;}
      if(action==='flip-lap'&&draft.solution){const f=draft.faces.find(f=>f.id===target.dataset.id);if(!f)return;const lap=draft.solution.lapByFace[f.id];checkpoint();invalidate();f.lap=lap===1?-1:1;f.lapLocked=true;run();return;}
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
      if(action==='confirm-all'||action==='confirm-run'){
        if(issues.some(i=>i.severity==='error')){
          if(!window.confirm('Linework anomalies remain. Have you manually checked and corrected every face despite these anomalies? The geometric partition will still be validated.'))return;
          draft.reviewNotes=[...(draft.reviewNotes??[]),...issues.filter(i=>i.severity==='error')];
          issues=issues.map(i=>i.severity==='error'?{...i,severity:'warning',code:`REVIEWED_${i.code}`,message:`Explicitly acknowledged during face review: ${i.message}`} : i);
        }
        checkpoint();draft.faces.forEach(f=>{f.confirmed=true;});if(action==='confirm-run'){run();return;}render();return;
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
      if(target.dataset.display){const checked=(target as HTMLInputElement).checked;if(target.dataset.display==='showSheets')showSheets=checked;if(target.dataset.display==='showSources')showSources=checked;if(target.dataset.display==='showEnvelope')showEnvelope=checked;if(target.dataset.display==='editPieces'){editPieces=checked;selectedOffcutId='';selectedGroupId='';render();return;}renderScene();return;}
      if(target.dataset.outline){checkpoint();invalidate();const ids=new Set(draft.roof.outlines.map(o=>o.id));if((target as HTMLInputElement).checked)ids.add(target.dataset.outline);else ids.delete(target.dataset.outline);draft.roof.outlines=sourceOutlines.filter(o=>ids.has(o.id));draft.roof.sourceRevision=roofRevision(draft.roof);detect();render();return;}
      const field=target.dataset.field;if(!field)return;
      checkpoint();invalidate();const f=face(),value=target.value;
      if(field==='name'&&f)f.name=value;
      else if(field==='pitch'&&f){f.pitchDeg=value===''?null:Number(value);f.confirmed=false;}
      else if(field==='flowAngle'&&f){const angle=Number(value)*Math.PI/180;f.flow={x:Math.cos(angle),y:Math.sin(angle)};f.confirmed=false;}
      else if(field==='laneOffset'&&f)f.laneOffsetMm=Number(value);
      else if(field==='lap'&&f)f.lap=Number(value) as -1|1;
      else if(field==='lapLocked'&&f)f.lapLocked=(target as HTMLInputElement).checked;
      else if(field==='laneOffsetLocked'&&f)f.laneOffsetLocked=(target as HTMLInputElement).checked;
      else if(field==='allPitch')draft.faces.forEach(g=>{g.pitchDeg=value===''?null:Number(value);g.confirmed=false;});
      else if(field==='approvedEndForEnd'){const yes=(target as HTMLInputElement).checked;draft.profile.allowEndForEnd=yes;draft.profile.rulesConfirmed=yes;}
      else if(field==='maxBankExtensionMm')draft.settings.maxBankExtensionMm=Number(value);
      else if(field==='stockMode')draft.settings.stockMode=value as 'bank-first'|'per-lane'|'face-envelope';
      else if(field==='optimiseLapDirections')draft.settings.optimiseLapDirections=(target as HTMLInputElement).checked;
      else if(field==='rulesConfirmed'||field==='allowEndForEnd')draft.profile[field]=(target as HTMLInputElement).checked;
      else if(['coverMm','leftLapMm','rightLapMm','cutGapMm','endAllowanceMm','maxLengthMm','lengthIncrementMm'].includes(field)) (draft.profile as unknown as Record<string,unknown>)[field]=Number(value);
    }catch(e){error=message(e);}render();
  }
  function pointerDown(event:Event):void {
    const e=event as PointerEvent,target=e.target as Element;if(!target.closest('svg.qc-scene'))return;
    const p=scenePoint(e);if(drawPoints){drawPoints.push(p);renderScene();return;}
    const vertex=target.closest<SVGElement>('[data-vertex]'),flow=target.closest<SVGElement>('[data-flow]'),offcut=target.closest<SVGElement>('[data-offcut]'),group=target.closest<SVGElement>('[data-group]'),faceEl=target.closest<SVGElement>('[data-face]');
    if(vertex){const f=draft.faces.find(f=>f.id===vertex.dataset.faceId);if(f)drag={kind:'vertex',faceId:f.id,vertex:Number(vertex.dataset.vertex),start:p,last:p,original:{...f.polygon[Number(vertex.dataset.vertex)]},pointerId:e.pointerId};}
    else if(flow)drag={kind:'flow',faceId:flow.dataset.flow,start:p,last:p,pointerId:e.pointerId};
    else if(group&&phase==='solution'){selectedGroupId=group.dataset.group??'';selectedOffcutId='';drag={kind:'group',groupId:selectedGroupId,start:p,last:p,pointerId:e.pointerId};}
    else if(offcut&&phase==='solution'){selectedOffcutId=offcut.dataset.offcut??'';drag={kind:'offcut',offcutId:selectedOffcutId,start:p,last:p,pointerId:e.pointerId};}
    else if(faceEl&&phase==='faces'){selectedFaceId=faceEl.dataset.face??'';render();return;}
    if(drag){e.preventDefault();(shadow.querySelector('.qc-canvas') as HTMLElement).setPointerCapture(e.pointerId);}
  }
  function pointerMove(event:Event):void {
    if(!drag)return;const e=event as PointerEvent;drag.last=scenePoint(e);
    if(drag.kind==='group'){
      const group=[...shadow.querySelectorAll<SVGGElement>('[data-group]')].find(g=>g.dataset.group===drag!.groupId);
      group?.setAttribute('transform',`translate(${drag.last.x-drag.start.x} ${drag.last.y-drag.start.y})`);
    }else if(drag.kind==='offcut'){
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
        const f=draft.faces.find(f=>f.id===state.faceId);if(f){invalidate();f.flow=unit(sub(p,interiorAnchor(f.polygon)));f.confirmed=false;}
      }else if(state.kind==='group'&&draft.solution){
        const target=draft.solution.demands.find(d=>pointInRegion(d.cover,scenePointToDemand(p,d)));
        if(!target)throw new Error('Drop this offcut set onto a roof face.');
        draft.solution=moveReuseGroup(draft.solution,state.groupId!,target.faceId,target.laneIndex);selectedGroupId='';
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
  function keyDown(event:Event):void {const e=event as KeyboardEvent;if((e.key==='Enter'||e.key===' ')&&(e.target as Element).closest('[data-action="flip-lap"]')){e.preventDefault();click(e);}}
  function toggle(event:Event):void {const target=event.target as HTMLDetailsElement;if(target.id==='qc-advanced')advancedOpen=target.open;}
  shadow.addEventListener('toggle',toggle,true);shadow.addEventListener('keydown',keyDown);
  shadow.addEventListener('click',click);shadow.addEventListener('change',change);shadow.addEventListener('pointerdown',pointerDown);shadow.addEventListener('pointermove',pointerMove);shadow.addEventListener('pointerup',pointerUp);shadow.addEventListener('pointercancel',pointerCancel);shadow.addEventListener('wheel',wheel,{passive:false});
  const watch=options.readCurrentSourceRevision?setInterval(()=>{try{if(!stale&&options.readCurrentSourceRevision!()!==capturedRevision){stale=true;cancel();render();}}catch{stale=true;cancel();render();}},1000):null;
  render();
  return {getDraft:()=>structuredClone(draft),destroy:()=>{disposed=true;cancel();if(watch)clearInterval(watch);shadow.removeEventListener('toggle',toggle,true);shadow.removeEventListener('keydown',keyDown);shadow.removeEventListener('click',click);shadow.removeEventListener('change',change);shadow.removeEventListener('pointerdown',pointerDown);shadow.removeEventListener('pointermove',pointerMove);shadow.removeEventListener('pointerup',pointerUp);shadow.removeEventListener('wheel',wheel);shadow.removeEventListener('pointercancel',pointerCancel);shadow.innerHTML='';}};
}
