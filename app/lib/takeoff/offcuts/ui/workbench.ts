import { ReviewSaver, createReviewDocument, restoreReviewDocument, reviewScope, sourceFingerprint, type ReviewRepository, type StoredReview, type SaveState } from '../persistence/reviews';
import { confirmReviewedFace, flowAngle, flowFromAngle, hasFlow, nextFlowAngle, SCREEN_DIRECTIONS } from '../core/directions';
import type { MaterialSection } from '../core/sections';
import { quantitySummary, quoteQuantityProposal, type QuantitySummary, type QuoteQuantityBasis, type QuoteQuantityProposal } from '../core/quantities';
import type { AlternativePlanResult, DecisionTrace, Draft, Issue, Point, RoofFace, RoofInput, Solution } from '../core/types';
import { DEFAULT_PROFILE, DEFAULT_SETTINGS } from '../core/types';
import { deriveFaces } from '../core/graph';
import { auditFaceBehaviour, FACE_GEOMETRY_MODEL } from '../core/faceGeometry';
import { applyLocalFaceRepair } from '../core/faceRepair';
import { revertAutomaticJoins, alignReviewedFaces, draftingPolicy, snapDrawingPoint, type DrawingSnap, type BoundaryRepair, type DrawingAdjustment } from '../core/drafting';
import { dismissWarning, warningDismissed, warningKey, issueTitle } from '../core/reviewIssues';
import { alternativeReference, differentSavedPlan } from '../core/alternatives';
import { analysePartition, type PartitionReport } from '../core/partition';
import { currentDetectionIssues, narrowFace, refreshFaceBoundary, validateFaceDirections } from '../core/reviewGeometry';
import { centroid, distance, unit, sub, validateRing, fingerprint } from '../core/math';
import { area, pointInRegion, bounds } from '../core/regions';
import { scenePointToDemand, validateInputs } from '../core/material';
import { findFit } from '../core/solver';
import { materialPlan, newStockSchedule, reuseGroups } from '../core/plan';
import { materialSummary } from '../core/supply';
import { planSignature, traceText } from '../core/diagnostics';
import { projectBank } from '../core/zones';
import { materialColors } from './materialColors';
import { moveReuseGroup } from '../core/groupEditing';
import { editPlacement, mergeFaces, splitFace, validateDraft } from '../core/editing';
import { exportDraft } from '../core/codec';
import { roofRevision } from '../adapters/quotecore';
import { exportLiveCapture, type LiveInputCapture } from '../adapters/liveSnapshot';
import { escapeHtml as esc, renderSvg, interiorAnchor } from './svg';
import { styles } from './styles';
import { icon } from './icons';
import { sceneScale, watchSceneViewport } from './viewport';
export interface WorkbenchOptions {
  initialDraft?: Draft;
  /** Authenticated repository supplied by host; no service-role client. */
  reviewRepository?: ReviewRepository;
  /** Explicit restore only; never silently overrides the current live input. */
  initialSavedReview?: StoredReview;
  inputCapture?: LiveInputCapture;
  initialIssues?: Issue[];
  createWorker?: () => Worker;
  onClose?: () => void;
  onExport?: (draft: Draft) => void;
  /** Optional host hook: a proposal only, after explicit basis selection. The host confirms a target material line. */
  onQuantityProposal?: (proposal: QuoteQuantityProposal) => void;
  /** Returns the original workspace revision, not the edited review draft. */
  readCurrentSourceRevision?: () => string;
}
export interface WorkbenchHandle { destroy: () => void; getDraft: () => Draft; getDebugBundle?: () => string; flushReview?: () => Promise<void>; getSaveState?: () => SaveState|null }
let localIdCounter = 0;
function localId(): string { return globalThis.crypto?.randomUUID?.() ?? `review-${Date.now().toString(36)}-${++localIdCounter}`; }
interface Drag {
  kind: 'vertex' | 'flow' | 'offcut' | 'group' | 'pan'; groupId?: string; faceId?: string; vertex?: number; offcutId?: string;
  start: Point; last: Point; original?: Point; pointerId: number;
  clientStart: Point; initialView?: number[]; inverse?: { a: number; b: number; c: number; d: number };
}
export function mountWorkbench(host: HTMLElement, roof: RoofInput, options: WorkbenchOptions = {}): WorkbenchHandle {
  const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
  let draft: Draft = options.initialDraft ? structuredClone(options.initialDraft) : {
    schemaVersion: 1, roof: structuredClone(roof), faces: [], profile: { ...DEFAULT_PROFILE }, settings: { ...DEFAULT_SETTINGS }, solution: null,
  };
  const capturedRevision=roof.sourceRevision, sourceOutlines=structuredClone(roof.outlines);
  const capturedRoof=structuredClone(roof);
  let initialDetection:unknown=options.initialSavedReview?.document.diagnostics.initialDetection??null;
  let panelTarget:string|null=null;
  function revealPanel(selector:string):void {
    const el=shadow.querySelector<HTMLElement>(selector),side=shadow.querySelector<HTMLElement>('.qc-sidebar'),main=shadow.querySelector<HTMLElement>('.qc-main');
    if(!el||!side)return;
    for(let parent=el.parentElement;parent&&parent!==side;parent=parent.parentElement)if(parent instanceof HTMLDetailsElement)parent.open=true;
    const scroller=getComputedStyle(side).overflowY==='visible'?main:side;if(!scroller)return;
    // Scroll only the controls, never scrollIntoView() on the whole page/SVG.
    scroller.scrollTop+=el.getBoundingClientRect().top-scroller.getBoundingClientRect().top-12;
    (el.matches('button,input,select')?el:el.querySelector<HTMLElement>('button,input,select'))?.focus({preventScroll:true});
  }
  function chooseFlow(id:string):void {
    if(!draft.faces.some(f=>f.id===id))return;
    selectedFaceId=id;customFlowOpen=false;phase='faces';notice='';error='';panelTarget='#qc-water-direction';render();
  }
  
  function adapterIssues():Issue[] {
    return (options.initialIssues??[]).filter(i=>i.code!=='UNMAPPED_COMPONENT');
  }
  function boundaryPanel():string {
    const audit=options.inputCapture?.adapted.audit;
    if(!audit)return '';
    const groups=new Map<string,{name:string;edges:string[]}>();
    for(const row of audit.lines.filter(r=>r.included)){
      const g=groups.get(row.componentId)??{name:row.componentName,edges:[]};
      g.edges.push(...row.topologyEdgeIds);groups.set(row.componentId,g);
    }
    return `<p class="qc-muted">Every selected line is a boundary, regardless of its component name. Exclude only annotations or lines that do not separate roof planes. Water arrows determine cuts after review.</p>${[...groups].map(([id,g])=>{
      const excluded=g.edges.every(e=>draft.roof.faceDetectionIgnoredEdgeIds?.includes(e));
      return `<div class="qc-boundary-row"><span>${esc(g.name)} · ${g.edges.length} lines</span><button data-action="toggle-boundary-group" data-id="${esc(id)}">${excluded?'Include lines':'Exclude lines'}</button></div>`;
    }).join('')}`;
  }
  let phase: 'faces'|'solution' = draft.solution?'solution':'faces';
  let selectedFaceId='', selectedOffcutId='', selectedGroupId='', advancedOpen=false, editPieces=false, worker: Worker|null=null, jobId='', busy=false, progress='', disposed=false;
  let issues: Issue[] = [...adapterIssues()], error='', stale=false, notice='';
  let repairs:BoundaryRepair[]=[], drawingAdjustments:DrawingAdjustment[]=[], selectedRepairId='';
  let drawHover:Point|undefined, snapHint:DrawingSnap|null=null, drawingFrame:number|null=null;
  let hiddenFaceIds = new Set<string>(), panMode = false, spaceHeld = false, pointerOverCanvas = false;
  let focusedDiagnosticId = '', validationAttempted = false, pendingSourceAck = false;
  let partitionKey = '', partitionCache: PartitionReport | null = null;
  let showSheets=false, showSources=false, showEnvelope=false, drawPoints: Point[]|null=null, drag:Drag|null=null;
  let layouts:Solution[] = draft.solution ? [draft.solution] : [], layoutIndex=0;
  let backgroundFailed=false;
  let selectedSectionId='', editGroups=false, showDetailedLabels=false, customFlowOpen=false;
  let quantityBasis:QuoteQuantityBasis='lineal-metres', quotePreviewOpen=false;
  let quantityCache:{solution:Solution;summary:QuantitySummary}|null=null;
  function quantities():QuantitySummary|null {
    if(!draft.solution)return null;
    if(quantityCache?.solution!==draft.solution)quantityCache={solution:draft.solution,summary:quantitySummary(draft.solution)};
    return quantityCache.summary;
  }
  function sectionLabel(section:MaterialSection):string {
    return section.role==='new-bank'?'New bank':section.role==='new-filler'?'New filler':section.role==='self-fill'?'Self-fill':section.role==='bank-continuation'?'Shared bank stock':'Offcuts';
  }
  function selectSection(id:string):void {
    const section=quantities()?.sections.find(a=>a.id===id);if(!section)return;
    selectedSectionId=section.id;selectedFaceId=section.faceId;selectedOffcutId='';selectedGroupId='';notice='';render(true);
  }
  let alternativeMenu=false, alternativeAttempt=0, extraMaterialCap=15;
  let lastSearchTrace:DecisionTrace|null=null;
  let storedReview:StoredReview|null=null, saveReady=false, saveSignature='';
  let saveState:SaveState|null=options.reviewRepository?{status:'loading',revision:0,message:'Checking for a saved review…'}:null;
  const reviewSaver=options.reviewRepository?new ReviewSaver(options.reviewRepository,reviewScope(capturedRoof),state=>{saveState=state;if(!disposed)render();}):null;
  function queueReviewSave():void {
    if(!reviewSaver||!saveReady||disposed||stale)return;
    const signature=fingerprint([draft,layouts,layoutIndex,issues,repairs,drawingAdjustments]);if(signature===saveSignature)return;
    try{
      const document=createReviewDocument({draft,sourceRoof:capturedRoof,capture:options.inputCapture,plans:layouts,selectedPlanIndex:layoutIndex,
        diagnostics:{initialDetection,issues,repairs,adjustments:drawingAdjustments}});
      saveSignature=signature;reviewSaver.queue(document);
    }catch(e){saveState={status:'error',revision:saveState?.revision??0,message:message(e)};}
  }
  function applySavedReview(record:StoredReview):void {
    const restored=restoreReviewDocument(record.document,reviewScope(capturedRoof));
    checkpoint();cancel();draft=restored.draft;draft.roof.imageUrl=roof.imageUrl;
    layouts=restored.plans;layoutIndex=Math.max(0,layouts.findIndex(p=>p.layoutId===draft.solution?.layoutId));
    issues=restored.document.diagnostics.issues??[];
    repairs=(restored.document.diagnostics.repairs??[]) as BoundaryRepair[];
    drawingAdjustments=(restored.document.diagnostics.adjustments??[]) as DrawingAdjustment[];
    initialDetection=restored.document.diagnostics.initialDetection;phase=draft.solution?'solution':'faces';
    selectedFaceId=draft.faces[0]?.id??'';selectedSectionId='';partitionKey='';validationAttempted=false;
    storedReview=null;saveReady=true;saveSignature='';reviewSaver?.initialise(record.revision);
    notice=restored.warnings.length?restored.warnings.join(' '):'Saved review restored. Source takeoff and quote quantities have not been changed.';render();
  }
  async function loadStoredReview():Promise<void> {
    if(!options.reviewRepository)return;
    saveReady=false;saveState={status:'loading',revision:saveState?.revision??0,message:'Checking saved review…'};
    try{
      const saved=await options.reviewRepository.load(reviewScope(capturedRoof));if(disposed)return;
      reviewSaver?.initialise(saved?.revision??0);
      if(saved){storedReview=saved;saveState={status:'ready',revision:saved.revision,message:'A saved review is available.'};}
      else{saveReady=true;storedReview=null;saveState={status:'ready',revision:0,message:'Autosave ready.'};}
    }catch(e){if(!disposed)saveState={status:'error',revision:0,message:message(e)};}
    if(!disposed)render();
  }

  const viewport = watchSceneViewport(() => renderScene());
  let background:HTMLImageElement|null=null;
  let viewBox = [-30,-30,roof.sceneWidth+60,roof.sceneHeight+60];
  const history: string[] = [], redoHistory: string[] = [];
  function snapshot(): string { return JSON.stringify({ draft, issues, repairs, drawingAdjustments, hiddenFaceIds: [...hiddenFaceIds], selectedFaceId, phase, layoutIndex }); }
  function checkpoint(): void {
    const value = snapshot();
    if (history[history.length - 1] !== value) history.push(value);
    if (history.length > 40) history.shift();
    redoHistory.length = 0;
  }
  function cancel(): void { worker?.terminate(); worker = null; busy = false; jobId = ''; }
  function invalidate(): void {
    cancel(); draft.solution = null; layouts=[];layoutIndex=0; phase = 'faces'; selectedOffcutId = ''; selectedGroupId = '';
    selectedSectionId='';quotePreviewOpen=false;quantityCache=null;
    error = ''; pendingSourceAck = false; partitionKey = ''; alternativeMenu=false;lastSearchTrace=null;alternativeAttempt=0;
  }
  function detect(record = true): void {
    if (record) {checkpoint();draft.roof=revertAutomaticJoins(draft.roof,drawingAdjustments);}
    invalidate(); hiddenFaceIds.clear(); notice = ''; validationAttempted = false;
    try {
      const result = deriveFaces(draft.roof);
      draft.faces = result.faces.map(f => ({ ...f, flowSource: 'inferred' }));
      issues = [...adapterIssues(), ...result.issues];
      if(result.normalisedEdges){draft.roof.edges=structuredClone(result.normalisedEdges);draft.roof.sourceRevision=roofRevision(draft.roof);}
      if(initialDetection===null)initialDetection=structuredClone(result);
      repairs=result.repairs;drawingAdjustments=result.adjustments;selectedRepairId='';
      selectedFaceId = draft.faces[0]?.id ?? '';
    } catch (e) { error = message(e); draft.faces = []; }
  }
  const message = (e: unknown): string => e instanceof Error ? e.message : String(e);
  if (!draft.faces.length) detect(false); else selectedFaceId = draft.faces[0]?.id ?? '';
  function face(): RoofFace | undefined { return draft.faces.find(f => f.id === selectedFaceId); }
  function partition(): PartitionReport {
    const key = fingerprint([draft.roof.outlines, draft.roof.mmPerSceneUnit, draft.roof.calibrationConfirmed, draft.faces.map(f => [f.id, f.polygon]), draft.roof.draftingTolerance]);
    if (!partitionCache || key !== partitionKey) { partitionCache = analysePartition(draft.roof, draft.faces); partitionKey = key; }
    return partitionCache;
  }
  function allIssues(): Issue[] {
    const current = draft.solution ? validateDraft(draft) : validationAttempted
      ? validateInputs(draft.roof, draft.faces, draft.profile, draft.settings)
      : [...partition().issues, ...draft.faces.flatMap(f => validateRing(f.polygon) ? [] : validateFaceDirections(f, draft.roof))];
    const small = draft.faces.filter(f => !validateRing(f.polygon) && narrowFace(f, draft.roof)).map(f => ({
      severity: 'warning' as const, code: 'NARROW_FACE', faceId: f.id,
      message: `${f.name}: narrow face. Hide it to inspect what lies underneath; delete only if it is a false face. It still participates in the calculation while hidden.`,
    }));
    const extras:Issue[]=[];
    if(backgroundFailed)extras.push({severity:'warning',code:'BACKGROUND_IMAGE',message:'The plan image did not load. Reviewed vector faces remain available; reopen the takeoff to refresh the image.'});
    if(draft.solution?.search.budgetReached)extras.push({severity:'warning',code:'SEARCH_LIMIT',message:'Search time limit reached. This is the best complete plan found in that search, not proof of the minimum.'});
    if(!draft.profile.allowEndForEnd)extras.push({severity:'warning',code:'END_FOR_END_DISABLED',message:'End-for-end reuse is disabled for this profile. Check this setting if expected hip cuts are missing.'});
    const reported: Issue[] = [...currentDetectionIssues(issues, draft.faces), ...current, ...small, ...(draft.solution?.issues ?? []),...extras];
    return reported.filter((i, index, a) => a.findIndex(j => j.code === i.code && j.message === i.message && j.faceId === i.faceId && j.objectId === i.objectId) === index);
  }
  function visibleCoverage() {
    const report=partition();
    return report.regions.filter(r=>{
      const issue=report.issues.find(i=>i.objectId===r.id);
      return (!issue||!warningDismissed(issue,draft)) && (!r.quiet||r.id===focusedDiagnosticId);
    });
  }
  function drawingSnap(p:Point,excludePoint?:Point):DrawingSnap|null {
    const canvas=shadow.querySelector<HTMLElement>('.qc-canvas'),box=canvas?.getBoundingClientRect();
    const scale=box?sceneScale(viewBox,box.width,box.height):null;
    return scale? snapDrawingPoint(p,draft.roof,draft.faces,{sceneUnitsPerPixel:scale,pending:drawPoints??undefined,excludePoint}):null;
  }
  function finishPolygon():void {
    if(!drawPoints||drawPoints.length<3)throw new Error('Add at least three corners, then click the first point or Finish.');
    const invalid=validateRing(drawPoints);if(invalid)throw new Error('The outline crosses itself or has a repeated corner. Backspace removes the last point; Escape cancels.');
    const id=`manual-${localId().slice(0,8)}`;
    draft.faces.push(refreshFaceBoundary({id,name:`Face ${draft.faces.length+1}`,polygon:drawPoints,boundary:[],flow:null,lap:1,lapLocked:false,pitchDeg:face()?.pitchDeg??draft.faces[0]?.pitchDeg??draft.roof.outlines[0]?.suggestedPitchDeg??null,laneOffsetMm:0,confirmed:false,provenance:'manual'},draft.roof));
    selectedFaceId=id;drawPoints=null;drawHover=undefined;snapHint=null;
    notice='Face added. Choose its water direction below.';
  }
  function applyAlignment():void {
    const aligned=alignReviewedFaces(draft.roof,draft.faces);
    if(!aligned.adjustments.length){notice='No unambiguous small alignments found. Use Show on plan, then adjust or redraw the affected area.';return;}
    checkpoint();invalidate();draft.faces=aligned.faces.map(f=>refreshFaceBoundary(f,draft.roof));
    drawingAdjustments.push(...aligned.adjustments);notice=`Aligned ${aligned.adjustments.length} nearby points in this review. Check the faces; Undo restores the previous drawing. Takeoff measurements are unchanged.`;
  }
  function scenePoint(e:PointerEvent|MouseEvent|WheelEvent):Point {
    const svg=shadow.querySelector('svg.qc-scene') as SVGSVGElement|null;
    if(!svg)return{x:0,y:0};const matrix=svg.getScreenCTM();if(!matrix)return{x:0,y:0};
    const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());return{x:p.x,y:p.y};
  }
  function renderScene(): void {
    if(disposed)return;
    const canvas = shadow.querySelector<HTMLElement>('.qc-canvas'); if (!canvas) return;
    viewport.observe(canvas);
    const box = canvas.getBoundingClientRect(), scale = sceneScale(viewBox,box.width,box.height);
    if(scale===null){canvas.innerHTML='<div class="qc-canvas-wait" role="status">Preparing plan…</div>';return;}
    canvas.dataset.renderWidth=String(box.width);canvas.dataset.renderHeight=String(box.height);canvas.dataset.renderScale=String(scale);
    canvas.dataset.pan = String(panMode || spaceHeld);
    canvas.dataset.drawing=String(drawPoints!==null);
    canvas.dataset.dragging = String(drag?.kind === 'pan');
    const focussedSection = shadow.activeElement?.getAttribute('data-section');
    canvas.innerHTML = renderSvg(draft, { phase, selectedFaceId, selectedOffcutId, selectedGroupId, editPieces,
      showSheets, showSources, showEnvelope, editGroups, selectedSectionId, sections:quantities()?.sections, showDetailedLabels, viewBox: viewBox.join(' '), pendingPolygon: drawPoints ?? undefined,
      hiddenFaceIds, coverage: visibleCoverage(), focusedDiagnosticId,
      pendingCursor:drawHover,snapHint:snapHint??undefined,
      boundaryRepair:repairs.find(r=>r.id===selectedRepairId),
      boundaryIssues:allIssues().filter(i=>i.location&&i.severity==='error'&&!warningDismissed(i,draft)),
      sceneUnitsPerPixel: scale,
    });
    // Resize/image observers can repaint after full render has restored focus.
    // Keep the same section keyboard target without scrolling the canvas.
    if(focussedSection) [...canvas.querySelectorAll<SVGElement>('[data-section]')].find(el=>el.dataset.section===focussedSection)?.focus({preventScroll:true});
  }

  function focusFace(id: string): void {
    const f = draft.faces.find(f => f.id === id); if (!f) return;
    selectedFaceId = id;
    const xs = f.polygon.map(p => p.x), ys = f.polygon.map(p => p.y);
    fitBounds(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
  }
  function fitBounds(minX: number, minY: number, maxX: number, maxY: number): void {
    const pad = Math.max(5, Math.max(maxX - minX, maxY - minY) * .18);
    const width = Math.max(roof.sceneWidth * .05, maxX - minX + pad * 2);
    const height = Math.max(roof.sceneHeight * .05, maxY - minY + pad * 2);
    viewBox = [(minX + maxX - width) / 2, (minY + maxY - height) / 2, width, height];
  }
  /** Rerendering never throws the sidebar back to its top or discards keyboard
   * focus/disclosure state. Scene geometry stays outside application state. */
  function captureView(): { scroll: number; mainScroll: number; open: Map<string, boolean>; focus: Record<string, string> | null } {
    const active = shadow.activeElement as HTMLElement | null;
    const identity: Record<string, string> = {};
    if (active) for (const name of ['id', 'data-action', 'data-id', 'data-field', 'data-display', 'data-outline', 'data-focus', 'data-section', 'data-quantity-basis']) {
      const value = active.getAttribute(name); if (value) identity[name] = value;
    }
    return { scroll: shadow.querySelector('.qc-sidebar')?.scrollTop ?? 0, mainScroll: shadow.querySelector('.qc-main')?.scrollTop ?? 0,
      open: new Map([...shadow.querySelectorAll('details')].map(d => [d.id || d.querySelector('summary')?.textContent || '', d.open])),
      focus: Object.keys(identity).length ? identity : null };
  }
  function restoreView(view: ReturnType<typeof captureView>, resetScroll: boolean): void {
    for (const d of shadow.querySelectorAll('details')) {
      const key = d.id || d.querySelector('summary')?.textContent || '';
      if (d.id !== 'qc-advanced' && view.open.has(key)) d.open = view.open.get(key)!;
    }
    if (view.focus) [...shadow.querySelectorAll<HTMLElement>('button,input,select,textarea,summary,[tabindex]')]
      .find(e => Object.entries(view.focus!).every(([k, v]) => e.getAttribute(k) === v))?.focus({ preventScroll: true });
    const sidebar = shadow.querySelector('.qc-sidebar'), main = shadow.querySelector('.qc-main');
    if (sidebar) sidebar.scrollTop = resetScroll ? 0 : view.scroll;
    if (main) main.scrollTop = resetScroll ? 0 : view.mainScroll;
  }
  function inputField(label:string,field:string,value:number|null,step='1'):string {return `<label>${esc(label)}<input data-field="${field}" type="number" step="${step}" value="${value===null?'':value}"/></label>`;}
  function tracePanel(trace:DecisionTrace):string {
    return `<p class="qc-muted">V${trace.engineVersion} · ${esc(trace.objective)} · selected trial ${trace.selectedTrial??'none'} · ${trace.candidates.length} candidate trials${trace.budgetReached?' · budget reached':''}${trace.historic?' · historic (manually edited plan)':''}</p>
      <ol class="qc-trace-events">${trace.events.slice(0,100).map(e=>`<li><details><summary>${esc(e.action)} — ${esc(e.message)}</summary>${e.faceIds?.length?`<p>${e.faceIds.map(id=>esc(draft.faces.find(f=>f.id===id)?.name??id)).join(', ')}</p>`:''}${e.data?`<pre>${esc(JSON.stringify(e.data,null,2))}</pre>`:''}</details></li>`).join('')}</ol>
      <details><summary>Why this candidate was selected</summary><pre>${esc(JSON.stringify(trace.candidates,null,2))}</pre></details>
      ${trace.truncated||trace.events.length>100?'<p class="qc-muted">Detailed events are bounded; export the trace for all retained events and truncation counts.</p>':''}`;
  }
  function render(resetScroll = false): void {
    if (disposed) return;
    const view = captureView();
    const f = face(), s = draft.solution, reported = allIssues(), errors = reported.filter(i => i.severity === 'error');
    const visibleIssues=reported.filter(i=>!warningDismissed(i,draft));
    const ignored=reported.filter(i=>warningDismissed(i,draft));
    const faceName = (id: string): string => draft.faces.find(g => g.id === id)?.name ?? id;
        const bankName=(ids:string[])=>ids.map(id=>faceName(id)).join(' + ');
    const sourceStyle=s?materialColors(s):null;
    const rowColor=(faceId:string):string=>sourceStyle?.face(faceId)??'#596273';
    const pitch = draft.faces.length && draft.faces.every(g => g.pitchDeg === draft.faces[0].pitchDeg) ? draft.faces[0].pitchDeg : null;
    const smallIds = new Set(draft.faces.filter(g => !validateRing(g.polygon) && narrowFace(g, draft.roof)).map(g => g.id));
    const missing=draft.faces.filter(g=>!hasFlow(g.flow));
    const directionControl=f?`<div class="qc-direction" id="qc-water-direction"><div class="qc-direction-heading"><b>Water direction</b><small>${hasFlow(f.flow)?`${flowAngle(f.flow)!.toFixed(1)}°`:'Required'}</small></div>
      <div class="qc-direction-buttons" role="group" aria-label="Water direction for ${esc(f.name)}">${SCREEN_DIRECTIONS.map(p=>`<button data-action="set-flow" data-angle="${p.angle}" aria-label="Water ${p.label.toLowerCase()} on ${esc(f.name)}" aria-pressed="${flowAngle(f.flow)!==null&&Math.abs(flowAngle(f.flow)!-p.angle)<.01}">${p.arrow}</button>`).join('')}
      <button data-action="rotate-flow" title="Cycle up → right → down → left" aria-label="Rotate water direction clockwise">↻</button></div>
      <button class="qc-direction-custom" data-action="custom-flow" aria-expanded="${customFlowOpen}">Custom angle</button>${customFlowOpen?`<div class="qc-fields">${inputField('Angle ° (0 right, 90 down)','flowAngle',flowAngle(f.flow),'0.1')}</div><p class="qc-muted">Screen directions, not compass bearings. Drag the plan arrow for fine adjustment.</p>`:''}
      ${!hasFlow(f.flow)?'<p class="qc-direction-required">Choose a direction. No direction has been assumed.</p>':''}</div>`:'';
    const faceButtons = `<div class="qc-face-grid" aria-label="Roof faces">${draft.faces.map(g => `<button class="qc-face ${g.id === selectedFaceId ? 'active' : ''}" data-action="select-face" data-id="${esc(g.id)}" aria-pressed="${g.id === selectedFaceId}" data-hidden="${hiddenFaceIds.has(g.id)}"><span class="qc-face-label">${esc(g.name)}</span><span class="qc-face-meta">${!hasFlow(g.flow)?'<span class="qc-flow-missing" title="Water direction needed">! Flow</span>':''}${reported.some(i=>i.faceId===g.id&&i.severity==='error')?'<span class="qc-small-tag">Review</span>':smallIds.has(g.id) ? '<span class="qc-small-tag">Small</span>' : ''}${hiddenFaceIds.has(g.id) ? icon('eyeOff') + '<span class="qc-sr-only">Hidden</span>' : g.confirmed ? icon('check') + '<span class="qc-sr-only">Confirmed</span>' : ''}</span></button>`).join('')}</div>`;
    const quickTools = f ? `<div class="qc-face-tools"><div class="qc-face-tools-head"><strong>${esc(f.name)}</strong>${hiddenFaceIds.has(f.id) ? '<span class="qc-badge">Hidden</span>' : smallIds.has(f.id) ? '<span class="qc-small-tag">Narrow face</span>' : ''}</div><small>${hiddenFaceIds.has(f.id) ? 'Hidden on screen only — still part of the roof.' : smallIds.has(f.id) ? 'Hide to inspect underneath, or delete if incorrect.' : 'Select a face to inspect, hide or remove it.'}</small><div class="qc-quick-actions"><button data-action="focus-face" data-id="${esc(f.id)}" title="Zoom to ${esc(f.name)}">${icon('focus')}Locate</button><button data-action="toggle-face" aria-label="${hiddenFaceIds.has(f.id) ? 'Show' : 'Hide'} ${esc(f.name)}">${icon(hiddenFaceIds.has(f.id) ? 'eye' : 'eyeOff')}${hiddenFaceIds.has(f.id) ? 'Show' : 'Hide'}</button><button data-action="delete-face" class="quiet-danger" aria-label="Delete ${esc(f.name)}">${icon('trash')}Delete</button></div>${directionControl}</div>` : '';
    const faceTools = f ? `<h3>${esc(f.name)} — face tools</h3><label class="qc-field">Name<input data-field="name" value="${esc(f.name)}"/></label>
      <div class="qc-fields">${inputField('This face’s pitch °', 'pitch', f.pitchDeg, '0.5')}${inputField('Lane start offset, mm', 'laneOffset', f.laneOffsetMm)}<label>Lap direction<select data-field="lap"><option value="1" ${f.lap === 1 ? 'selected' : ''}>Along +cross-slope</option><option value="-1" ${f.lap === -1 ? 'selected' : ''}>Along −cross-slope</option></select></label></div>
      <label class="qc-check"><input data-field="lapLocked" type="checkbox" ${f.lapLocked ? 'checked' : ''}/>Lock this face’s lap direction</label>
      <label class="qc-check"><input data-field="laneOffsetLocked" type="checkbox" ${f.laneOffsetLocked ? 'checked' : ''}/>Lock this face’s sheet-joint registration</label>
      <div class="qc-actions"><button data-action="confirm-face">Confirm this face</button><button data-action="apply-pitch">Apply pitch to all</button></div>
      <details><summary>Split, join or edit vertices</summary><div class="qc-fields"><label>Split axis<select id="split-axis"><option value="x">Vertical (x)</option><option value="y">Horizontal (y)</option></select></label><label>Scene coordinate<input id="split-at" type="number" value="${centroid(f.polygon).x.toFixed(1)}"/></label></div><button data-action="split">Split selected face</button>
      <label class="qc-field">Join with<select id="merge-target">${draft.faces.filter(g => g.id !== f.id).map(g => `<option value="${esc(g.id)}">${esc(g.name)}</option>`).join('')}</select></label><button data-action="merge" ${draft.faces.length < 2 ? 'disabled' : ''}>Join faces</button>
      <label class="qc-field">Vertices: x,y per line<textarea id="polygon-points">${f.polygon.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join('\n')}</textarea></label><button data-action="apply-polygon">Apply polygon</button></details>` : '';
    const materialTools = `<h3>Material rules</h3><label class="qc-field">Stock strategy<select data-field="stockMode"><option value="bank-first" ${draft.settings.stockMode === 'bank-first' ? 'selected' : ''}>Primary banks + straight fillers</option><option value="face-envelope" ${draft.settings.stockMode === 'face-envelope' ? 'selected' : ''}>Legacy: full face envelopes</option><option value="per-lane" ${draft.settings.stockMode === 'per-lane' ? 'selected' : ''}>Legacy: independent sheet lengths</option></select></label>
      <div class="qc-fields">${inputField('Self-fill valley transition, mm', 'selfFillTransitionMm', draft.settings.selfFillTransitionMm??100)}${inputField('Physical left lap, mm', 'leftLapMm', draft.profile.leftLapMm)}${inputField('Physical right lap, mm', 'rightLapMm', draft.profile.rightLapMm)}${inputField('Cut clearance, mm', 'cutGapMm', draft.profile.cutGapMm)}${inputField('End allowance, mm', 'endAllowanceMm', draft.profile.endAllowanceMm)}${inputField('Maximum sheet length, mm', 'maxLengthMm', draft.profile.maxLengthMm)}${inputField('Length increment, mm', 'lengthIncrementMm', draft.profile.lengthIncrementMm)}${inputField('Max extra reuse stock, mm', 'maxBankExtensionMm', draft.settings.maxBankExtensionMm ?? 100)}</div>
      <p class="qc-muted">Extra reuse stock is optional, counted as supplied length and reported on the plan. Set its limit to 0 to prohibit it. Physical overlaps and cut allowances require profile-specific checks.</p>
      <label class="qc-check"><input data-field="allowEndForEnd" type="checkbox" ${draft.profile.allowEndForEnd ? 'checked' : ''}/>Allow end-for-end reuse (long-run default)</label><p class="qc-muted">Rotation stays face-up. Side-lap compatibility is always checked. Disable for profiles or finishes that cannot be reversed.</p>
      <label class="qc-check"><input data-field="rulesConfirmed" type="checkbox" ${draft.profile.rulesConfirmed ? 'checked' : ''}/>Profile / lap rules checked</label>
      <label class="qc-field">Coherent source blocks per face<select data-field="maxSourceBlocksPerFace"><option value="1" ${(draft.settings.maxSourceBlocksPerFace??2)===1?'selected':''}>Single source block</option><option value="2" ${(draft.settings.maxSourceBlocksPerFace??2)===2?'selected':''}>Up to two useful sets (practical default)</option></select></label>
      <label class="qc-check"><input data-field="optimiseLapDirections" type="checkbox" ${draft.settings.optimiseLapDirections ? 'checked' : ''}/>Suggest lap directions for unlocked faces</label>`;
    let normal = '', solutionTools = '';
    if (s && phase === 'solution') {
      const rows = materialPlan(draft.faces, s), summary=materialSummary(s), groups = reuseGroups(s), selectedGroup = groups.find(g => g.id === selectedGroupId);
      const q=quantities()!, sections=q.sections, section=sections.find(a=>a.id===selectedSectionId);
      const scopeLabel='Selected roof / page scope';
      const sectionNumber=(a:MaterialSection)=>sections.filter(b=>b.faceId===a.faceId).findIndex(b=>b.id===a.id)+1;
      const sectionButtons=(id:string)=>`<div class="qc-section-list" aria-label="Sections of ${esc(faceName(id))}">${sections.filter(a=>a.faceId===id).map(a=>`<button data-action="select-section" data-id="${esc(a.id)}" aria-pressed="${a.id===selectedSectionId}"><span>${sectionNumber(a)} · ${sectionLabel(a)}</span><small>${a.purchasedDemandIds.length?`${a.purchasedDemandIds.length} new · ${a.purchasedLinealM.toFixed(2)} lm`:`${a.positionCount} positions · already supplied`}</small></button>`).join('')}</div>`;
      const lap=section?(s.lapByFace[section.faceId]??draft.faces.find(f=>f.id===section.faceId)?.lap):1;
      const sectionDetail=section?`<div class="qc-section-detail" aria-live="polite"><div class="qc-section-heading"><h3>${esc(faceName(section.faceId))} · Section ${sectionNumber(section)}</h3><button data-action="clear-selection" aria-label="Deselect section">Deselect</button></div>
        <dl class="qc-simple-section"><dt>Material</dt><dd>${sectionLabel(section)}</dd><dt>Sheets</dt><dd>${section.positionCount}${section.role==='offcut'||section.role==='self-fill'?' offcuts':' positions'}</dd>
        ${section.sourceFaceIds.length?`<dt>From</dt><dd>${section.sourceFaceIds.map(id=>id===section.faceId?'This face’s own cuts':esc(faceName(id))).join(' + ')}</dd>`:''}
        <dt>New purchase</dt><dd>${section.purchasedLinealM.toFixed(2)} lm${section.purchasedDemandIds.length?` · ${section.purchasedDemandIds.length} sheets`:' (already bought at source)'}</dd>
        <dt>Suggested lap</dt><dd>${lap===1?'Left → right':'Right → left'}</dd></dl>
        <p class="qc-muted">Lap viewed from the spouting, looking up the roof. Follow the lap arrow on the plan.</p>
        <details><summary>Lengths & material origin</summary><p>Net cut-piece run lengths: ${section.cutPieceRunLinealM.toFixed(2)} lm (sum of each piece’s maximum sheet-run extent; <b>not</b> a purchased quantity).</p><p>Original supplied bank: ${sourceStyle!.blocks.find(b=>b.id===section.supplyBlockId)?.faceIds.map(id=>esc(faceName(id))).join(' + ')??'See physical trace'}.</p>
          ${section.sharedPurchasedDemandIds.length?'<p>A full sheet also crosses another visible section. Its purchase is counted only once in that section.</p>':''}
          ${section.purchasedDemandIds.length?`<table class="qc-stock"><thead><tr><th>New sheet</th><th>Supply length</th></tr></thead><tbody>${q.purchaseRows.filter(r=>section.purchasedDemandIds.includes(r.rootDemandId)).map(r=>`<tr><td>${esc(r.rootDemandId.split(':').slice(-1)[0])}</td><td>${r.lengthM.toFixed(3)} m</td></tr>`).join('')}</tbody></table>`:''}
          <p class="qc-muted">Lengths already include pitch, configured allowances and length rounding. Verify on site before ordering.</p></details></div>`:
        '<p class="qc-selection-hint">Select a coloured or hatched section for sheets, source and lap direction.</p>';
      const basisValue=quantityBasis==='lineal-metres'?q.purchasedLinealM:quantityBasis==='cover-square-metres'?q.suppliedCoverAreaM2:q.suppliedProfileAreaM2;
      const quantityPanel=`<details class="qc-quantities"><summary>Use this material quantity in a quote</summary><p class="qc-muted">${scopeLabel}. Totals do not include other pages or spare sheets.</p><dl class="qc-quantity-grid"><dt>Purchased length</dt><dd>${q.purchasedLinealM.toFixed(2)} lm</dd><dt>Supply at ${s.profile.coverMm} mm cover</dt><dd>${q.suppliedCoverAreaM2.toFixed(2)} m²</dd><dt>Supply at configured profile width</dt><dd>${q.suppliedProfileAreaM2.toFixed(2)} m²</dd><dt>Measured roof (pitch included)</dt><dd>${q.netRoofAreaM2.toFixed(2)} m²</dd><dt>Extra material above net roof (cover basis)</dt><dd>${q.coverUpliftPercent?.toFixed(1)??'—'}%</dd></dl>
        <p class="qc-muted">Lineals count each new sheet once. Offcuts and recuts add no second purchase. Profile-width area includes configured side laps; neither area is developed coil area. Cutting remainder may include reusable stock.</p>
        <label class="qc-field">Rate / quantity basis<select data-quantity-basis><option value="lineal-metres" ${quantityBasis==='lineal-metres'?'selected':''}>Lineal metres</option><option value="cover-square-metres" ${quantityBasis==='cover-square-metres'?'selected':''}>Square metres — effective cover</option><option value="profile-square-metres" ${quantityBasis==='profile-square-metres'?'selected':''}>Square metres — configured profile width</option></select></label>
        <button data-action="preview-quantity" class="qc-wide" ${s.status==='invalid'||stale?'disabled':''}>Review material quantity</button>
        ${quotePreviewOpen?`<div class="qc-quantity-proposal"><b>${basisValue.toFixed(2)} ${quantityBasis==='lineal-metres'?'lm':'m²'} for the selected material scope</b><p>Keep the measured roof area and labour quantities. This plan already includes cutting stock and configured allowances; do not apply the old waste factor again automatically. Spares are separate.</p><p class="qc-muted">Match this basis to the quote line’s rate. No quote is changed by this preview or export.</p><div class="qc-actions"><button data-action="export-quantity">Export quantity proposal</button>${options.onQuantityProposal?'<button data-action="send-quantity" class="primary">Send to quote review</button>':''}</div></div>`:''}
        <details><summary>Purchase breakdown by section</summary><table class="qc-stock"><thead><tr><th>Section</th><th>Sheets</th><th>New lm</th></tr></thead><tbody>${sections.filter(a=>a.purchasedDemandIds.length).map(a=>`<tr><td>${esc(faceName(a.faceId))}.${sectionNumber(a)}</td><td>${a.purchasedDemandIds.length}</td><td>${a.purchasedLinealM.toFixed(2)}</td></tr>`).join('')}</tbody><tfoot><tr><th>Total</th><td>${q.newSheetCount}</td><td>${q.purchasedLinealM.toFixed(2)}</td></tr></tfoot></table></details></details>`;
      normal = `<h2>Sheet & offcut plan</h2><p class="qc-plan-total"><strong>${q.newSheetCount} new sheets</strong><strong class="qc-lineal-total">${q.purchasedLinealM.toFixed(2)} <small>purchased lineal metres</small></strong><span>${q.suppliedCoverAreaM2.toFixed(2)} m² material required (cover basis)<br/>${q.netRoofAreaM2.toFixed(2)} m² net roof · ${(q.suppliedCoverAreaM2-q.netRoofAreaM2).toFixed(2)} m² extra (${q.coverUpliftPercent?.toFixed(1)??'—'}%)<br/>This roof scope only · no spares</span></p>
        <p class="qc-muted qc-material-key">Solid = new bank · matching hatch = offcuts · grey = new filler.</p>${sectionDetail}
        <div class="qc-plan-variants">
          ${layouts.length>1?`<label class="qc-field">Saved in this session<select data-plan-index aria-label="Choose saved cut plan">${layouts.map((layout,i)=>`<option value="${i}" ${i===layoutIndex?'selected':''}>Plan ${i+1} — ${esc(layout.layoutLabel??'Cut plan')}</option>`).join('')}</select></label>`:`<p class="qc-muted">Plan 1 — ${esc(s.layoutLabel??'Recommended')}</p>`}
          <button data-action="alternative-menu" class="qc-wide" aria-expanded="${alternativeMenu}" ${busy||stale||s.status==='invalid'||layouts.length>=12?'disabled':''}>Create another cut plan ${icon('arrow')}</button>
          ${alternativeMenu?`<div class="qc-alternative-options"><button data-action="alternative-simpler" ${busy?'disabled':''}><b>Simpler offcuts</b><small>Fewer sets, transfers and recuts. May buy extra material.</small></button><button data-action="alternative-material" ${busy?'disabled':''}><b>Less material / waste</b><small>Try to beat the lowest-material plan saved in this session.</small></button><p class="qc-muted">Your current plan is kept. A new version appears only if a different valid plan improves the chosen goal.</p></div>`:''}
          ${s.comparison?`<p class="qc-plan-comparison" role="status">Compared with ${esc(layouts.findIndex(p=>p.layoutId===s.comparison?.previousLayoutId)>=0?'Plan '+(layouts.findIndex(p=>p.layoutId===s.comparison?.previousLayoutId)+1):'its reference plan')}: ${s.comparison.newSheetDelta>0?'+':''}${s.comparison.newSheetDelta} new sheets; ${(s.comparison.suppliedDeltaMm2/(s.profile.coverMm+s.profile.leftLapMm+s.profile.rightLapMm)/1000).toFixed(2)} lm; ${s.comparison.suppliedDeltaMm2>0?'+':''}${(s.comparison.suppliedDeltaMm2/1e6).toFixed(2)} m² purchased material. ${s.comparison.changedFaceIds.length} faces changed.${s.objective==='simpler'?' Lower cutting-complexity score; review the trade-off.':''}</p>`:''}
          ${layouts.length>=12?'<p class="qc-muted">Session limit reached: 12 saved plans. Export the plan you want to keep.</p>':''}
        </div>
        ${differentSavedPlan(s,alternativeReference(s,layouts,'less-material'))?`<button data-action="show-lowest-plan" class="qc-wide">Show lowest-material saved plan · ${quantitySummary(alternativeReference(s,layouts,'less-material')).purchasedLinealM.toFixed(2)} lm</button>`:''}
        ${quantityPanel}<details class="qc-faces-summary"><summary>Faces & sections (${rows.length})</summary><div class="qc-material-plan">${rows.map(row => {
          const type = row.primaryOperationFaceIds.length>1 ? 'MAIN BANK' : row.selfFill ? `${row.newCount} NEW + ${row.reuseCount} SELF-FILL` : row.newCount === row.sheetCount ? `NEW · ${row.sheetCount} sheets` : row.newCount === 0 ? `OFFCUT · ${row.sheetCount} sheets` : `${row.newCount} NEW + ${row.reuseCount} OFFCUT`;
          const sourceBlocks=new Set(s.placements.filter(p=>p.kind==='reuse'&&s.demands.find(d=>d.id===p.demandId)?.faceId===row.faceId).map(p=>sourceStyle!.blockByPlacement.get(p.demandId)));
          const sameBank=row.sources.length>1 && sourceBlocks.size===1;
          const feeds=row.feeds.filter(a=>a.faceId!==row.faceId);
          const source = row.sources.length ? sameBank ? `From ${esc(bankName(row.sources.map(a=>a.faceId).sort()))} bank` : `From ${row.sources.map(a => a.faceId===row.faceId ? 'this face’s own cuts' : esc(faceName(a.faceId))).join(' + ')}` : feeds.length ? `Offcuts → ${feeds.map(a => esc(faceName(a.faceId))).join(', ')}` : 'New material · no reuse assigned from this block';
          const onward=row.sources.length && feeds.length ? `<small>Next cuts → ${feeds.map(a=>esc(faceName(a.faceId))).join(', ')}</small>` : '';
          return `<button class="qc-plan-row ${selectedFaceId === row.faceId ? 'selected' : ''}" data-action="select-plan-face" data-id="${esc(row.faceId)}" style="--source-color:${rowColor(row.faceId)}"><span><b>${esc(row.name)}</b><strong>${esc(type)}</strong></span><small>${row.primaryOperationFaceIds.length>1?`Part of ${esc(bankName(row.primaryOperationFaceIds))} · common stock`:source}</small>${row.newFillerCount?`<small>${row.newFillerCount} new filler${row.newFillerCount===1?'':'s'} shown in grey · ${row.sheetCount} positions total</small>`:`<small>${row.sheetCount} positions total</small>`}${onward}</button>${row.faceId===selectedFaceId?sectionButtons(row.faceId):''}`;
        }).join('')}</div>
        ${rows.filter(row=>row.faceId===selectedFaceId).map(row=>`<details class="qc-count-explanation"><summary>How ${esc(row.name)} is counted</summary><p>Whole-face span across the sheets: ${(row.projectedSpanMm/1000).toFixed(3)} m. Effective cover: ${s.profile.coverMm} mm. Minimum ${Math.ceil(row.projectedSpanMm/s.profile.coverMm-1e-10)} positions; this registered layout uses ${row.sheetCount}.</p><p>Actual spouting span: ${(row.eaveSpanMm/1000).toFixed(3)} m. Ridge span: ${(row.ridgeSpanMm/1000).toFixed(3)} m.</p>${row.selfFill?`<p>Self-fill: the new bank starts on the spouting span, then its hip cuts supply the valley side. Transition target: ${s.settings.selfFillTransitionMm??100} mm; extra donor positions are included where the physical fit needs them. These are not spare sheets.</p>`:''}<p>${row.newCount} sheets purchased here (${row.newFillerCount} visible filler separators); ${row.reuseCount} positions use existing cuts.${row.continuationCount?` ${row.continuationCount} are same-bank continuations, shown solid because they belong to the same cutting operation.`:''} Shared source sheets are not ordered again at their destination.</p></details>`).join('')}
        </details><label class="qc-check"><input data-display="showSheets" type="checkbox" ${showSheets ? 'checked' : ''}/>Show sheet lines</label>
        ${selectedGroup ? `<div class="qc-selection"><b>${esc(faceName(selectedGroup.sourceFaceId))} → ${esc(faceName(selectedGroup.destinationFaceId))}</b><p>${selectedGroup.sheetCount} offcut sheets. Drag the set to another face to try a valid fit.</p><button data-action="edit-group-pieces">Edit individual pieces</button><button data-action="clear-selection">Deselect</button></div>` : ''}
        <div class="qc-actions"><button data-action="back">Review faces</button></div>
`;
      const selected = s.offcuts.find(o => o.id === selectedOffcutId);
      const placement = s.placements.find(p => p.kind === 'reuse' && p.offcutId === selectedOffcutId) ?? (selected ? { demandId: s.demands[0]?.id ?? '', rotation: 0 as const, translateY: 0 } : undefined);
      const unused = s.offcuts.filter(o => !s.placements.some(p => p.kind === 'reuse' && p.offcutId === o.id));
      solutionTools = `<h3>Drawing & physical pieces</h3><label class="qc-check"><input data-display="showDetailedLabels" type="checkbox" ${showDetailedLabels?'checked':''}/>Show counts on the drawing</label><label class="qc-check"><input data-display="editGroups" type="checkbox" ${editGroups?'checked':''}/>Move offcut sets (advanced)</label><p class="qc-muted">Normal mode selects sections without moving material. Enable movement only to edit a plan; physical validation still applies.</p><label class="qc-check"><input data-display="editPieces" type="checkbox" ${editPieces ? 'checked' : ''}/>Edit individual offcuts instead of sets</label>
        <label class="qc-check"><input data-display="showSources" type="checkbox" ${showSources ? 'checked' : ''}/>Show offcuts at their source</label><label class="qc-check"><input data-display="showEnvelope" type="checkbox" ${showEnvelope ? 'checked' : ''}/>Show new-sheet envelopes</label>
        <details><summary>Individual assignments (${s.metrics.reusedPieceCount})</summary><div class="qc-list">${s.placements.filter(p => p.kind === 'reuse').map(p => `<button class="qc-assignment" data-action="select-offcut" data-id="${esc(p.offcutId)}">${esc(s.offcuts.find(o => o.id === p.offcutId)?.sourceDemandId)} → ${esc(p.demandId)}</button>`).join('')}</div></details>
        <details><summary>Unused source pieces (${unused.length})</summary><div class="qc-list">${unused.map(o => `<button class="qc-assignment" data-action="select-offcut" data-id="${esc(o.id)}">${esc(o.sourceDemandId)} · ${(area(o.region) / 1e6).toFixed(3)} m²</button>`).join('')}</div></details>
        ${placement ? `<h3>Selected physical offcut</h3><label class="qc-field">Destination sheet<select id="destination">${s.demands.map(d => `<option value="${esc(d.id)}" ${d.id === placement.demandId ? 'selected' : ''}>${esc(d.id)}</option>`).join('')}</select></label><div class="qc-fields"><label>Rotation<select id="offcut-rotation"><option value="0" ${placement.rotation === 0 ? 'selected' : ''}>0°</option><option value="180" ${placement.rotation === 180 ? 'selected' : ''}>180° end-for-end</option></select></label><label>Along-sheet shift, mm<input id="offcut-shift" type="number" value="${placement.translateY.toFixed(2)}"/></label></div><div class="qc-actions"><button data-action="fit-placement">Snap valid fit</button><button data-action="apply-placement">Apply placement</button><button data-action="rotate-offcut">Rotate 180°</button></div>` : ''}
        <details><summary>Material banks & cutting sequence</summary><p class="qc-muted">Direction families share a planning frame, not a merged roof polygon. Every real face and sheet position is retained.</p>${s.bankLayout?.materialBanks?.map(b=>{const projection=projectBank(b,{roof:draft.roof,faces:draft.faces,profile:draft.profile,settings:draft.settings});return `<p><b>${esc(bankName(b.faceIds))}</b><br/><small>Parallel run family · longest bank ${(b.cutLengthMm/1000).toFixed(2)} m<br/>Projected cross-sheet span ${(projection.spanMm/1000).toFixed(3)} m / ${s.profile.coverMm} mm = ${projection.minimumColumns} minimum columns. This is an elevation-grid count, not an order count; separate physical faces remain accounted for.</small></p>`;}).join('')??''}<p class="qc-muted">New bank sequence: ${s.bankLayout?.primarySequence?.map(faceName).map(esc).join(' → ')??'Legacy plan'}</p></details>
        <details><summary>Plan-derived stock lengths</summary><p class="qc-muted">Replace with verified site-measured lengths before ordering. Includes reported extra stock. Spares are not included.</p><table class="qc-stock"><thead><tr><th>Face</th><th>Qty</th><th>Length</th></tr></thead><tbody>${newStockSchedule(s).map(g => `<tr><td>${esc(faceName(g.faceId))}<small>${esc(g.role)}</small></td><td>${g.count}</td><td>${(g.lengthMm / 1000).toFixed(3)} m</td></tr>`).join('')}</tbody></table></details>
        <details><summary>Material totals & search</summary><p class="qc-muted">Net roof surface (pitch included): ${(summary.netRoofMm2/1e6).toFixed(2)} m²<br/>New physical metal supplied: ${(summary.suppliedMm2/1e6).toFixed(2)} m²<br/><b>Supply above net roof: +${summary.supplyUpliftPercent?.toFixed(1)??'—'}%</b><br/>Laps / end allowances / reserved run envelopes: ${(summary.overlapAndEnvelopeMm2/1e6).toFixed(2)} m²<br/>Cutting remainder: ${(summary.cuttingRemainderMm2/1e6).toFixed(2)} m²</p><p class="qc-muted">Draft geometry quantities, not a verified quote or order. Supply uplift is relative to net roof area, not a markup on supplied stock. No site spares, damage allowance or supplier minimums are added. Reusable but unassigned pieces are included in the remainder; it is not all necessarily discarded.</p><p class="qc-muted">${s.search.completedTrials} completed trials · ${(s.search.elapsedMs/1000).toFixed(2)} s. Practical bounded search, not a proven minimum.</p></details>
        <details class="qc-trace"><summary>Optimiser decision trace</summary>
          <p class="qc-muted">Actual search decisions, not AI narration. Includes candidate scores, rejected fits, cut inventory, order and material comparisons. Exports include this roof’s geometry but no plan-image URL; share only with your trusted agent.</p>
          <div class="qc-actions"><button data-action="copy-trace">Copy trace</button></div>
          ${s.decisionTrace?tracePanel(s.decisionTrace):'<p>No trace was stored for this older plan. Calculate a new plan to record one.</p>'}
          ${lastSearchTrace&&lastSearchTrace!==s.decisionTrace?`<details><summary>Most recent alternative search</summary>${tracePanel(lastSearchTrace)}</details>`:''}
        </details>
        <details><summary>Alternative search limits</summary><label class="qc-field">Maximum extra material for a simpler plan, %<input type="number" data-alt-cap min="0" max="100" value="${extraMaterialCap}"/></label><p class="qc-muted">Default 15%. This is a ceiling on alternative purchased material, not added waste or spares. “Less material” must strictly reduce purchased metal. Both searches keep the same physical rules and locks.</p></details>`;
    } else {
      normal = `<h2>Review roof faces</h2><p class="qc-muted qc-geometry-summary">${draft.faces.length} shapes from ${draft.roof.edges.filter(e=>!draft.roof.faceDetectionIgnoredEdgeIds?.includes(e.id)).length} drawing lines${drawingAdjustments.length?` · ${drawingAdjustments.length} small joins aligned`:''}. Check the shapes and water arrows. Component names are not required.</p>${missing.length?`<div class="qc-note" role="status"><b>${missing.length} water direction${missing.length===1?'':'s'} needed</b><p>${missing.map(g=>esc(g.name)).join(', ')}</p><button data-action="choose-flow" data-id="${esc(missing[0].id)}">Set next direction</button></div>`:''}${quickTools}${faceButtons}
        ${hiddenFaceIds.size ? `<div class="qc-hidden-summary"><span>${hiddenFaceIds.size} hidden · still included</span><button data-action="show-all">Show all</button></div>` : ''}
        <div class="qc-actions"><button data-action="add-face">${icon('plus')}Add face</button></div>
        <div class="qc-fields">${inputField('Sheet cover, mm', 'coverMm', draft.profile.coverMm)}${inputField('Pitch ° — all faces', 'allPitch', pitch, '0.5')}</div>
        ${draft.faces.some(g => g.pitchDeg !== pitch) ? '<p class="qc-muted">Mixed pitches: keep them, or enter a common pitch. Individual pitches are in Advanced.</p>' : ''}
        ${!draft.profile.allowEndForEnd ? '<div class="qc-note">End-for-end reuse is off. This may reduce matches; change it under Advanced → Material rules.</div>' : ''}
        ${drawPoints ? '<div class="qc-actions"><button data-action="finish-polygon">Finish polygon</button><button data-action="cancel-polygon">Cancel polygon</button></div>' : ''}
        <p class="qc-muted qc-approval-note">These shapes and water arrows will be used for the cut plan. The original takeoff will not be changed.</p><button data-action="confirm-run" class="primary qc-wide" ${busy || stale || drawPoints ? 'disabled' : ''}>Faces correct — find offcuts ${icon('arrow')}</button>`;

    }
    const advanced = `<details id="qc-advanced" ${advancedOpen ? 'open' : ''}><summary>Advanced</summary>${phase === 'solution' ? solutionTools : `<details><summary>Selected roof outlines</summary>${sourceOutlines.map(o => `<label class="qc-check"><input data-outline="${esc(o.id)}" type="checkbox" ${draft.roof.outlines.some(a => a.id === o.id) ? 'checked' : ''}/>${esc(o.name)}</label>`).join('')}<button data-action="detect">Rebuild from linework</button></details><div class="qc-actions"><button data-action="confirm-all">Confirm reviewed faces</button></div>${faceTools}${materialTools}`}
      <details id="qc-checks"><summary>Review notes (${visibleIssues.length}${ignored.length?` · ${ignored.length} ignored`:''})</summary>
        ${visibleIssues.slice(0,50).map(i=>`<div class="qc-note ${i.severity==='error'?'qc-error':''}"><b>${esc(issueTitle(i,draft.faces))}</b><p>${esc(i.message)}</p>${i.location?`<button data-action="focus-boundary" data-id="${warningKey(i,draft)}">Show boundary</button>`:i.faceId?`<button data-action="focus-face" data-id="${esc(i.faceId)}">Show face</button>`:''}${i.severity==='warning'?`<button data-action="ignore-warning" data-id="${warningKey(i,draft)}">Ignore</button>`:''}</div>`).join('')}
        ${ignored.length?`<button data-action="restore-warnings">Restore ignored notes (${ignored.length})</button>`:''}</details>
      ${phase==='faces'?`<details id="qc-drawing-settings"><summary>Drawing tolerance & repairs</summary><label class="qc-field">Drawing precision<select data-tolerance><option value="tight" ${draft.roof.draftingTolerance==='tight'?'selected':''}>Tight · auto-connect up to 50 mm</option><option value="balanced" ${!draft.roof.draftingTolerance||draft.roof.draftingTolerance==='balanced'?'selected':''}>Balanced · auto-connect up to 150 mm</option><option value="relaxed" ${draft.roof.draftingTolerance==='relaxed'?'selected':''}>Relaxed · auto-connect up to 150 mm</option></select></label><p class="qc-muted">Calibrated plan distance. Unique, aligned connections are repaired in a review copy; competing junctions stay separate. Thin parallel edges and the original takeoff are preserved. Coverage and physical cut-fit tolerances are unchanged.</p><button data-action="align-review">Align small gaps</button>${draft.roof.faceDetectionIgnoredEdgeIds?.length?`<button data-action="restore-boundaries">Restore excluded boundaries (${draft.roof.faceDetectionIgnoredEdgeIds.length})</button>`:''}<details><summary>Alignment log (${drawingAdjustments.length})</summary><pre>${esc(JSON.stringify(drawingAdjustments,null,2))}</pre></details></details>`:''}
      ${options.inputCapture?`<details id="qc-captured-input"><summary>Captured takeoff</summary><p class="qc-muted">Captured from the live workspace at ${esc(options.inputCapture.capturedAt)}. ${options.inputCapture.adapted.audit.counts.includedEdges} boundary segments, including ${options.inputCapture.adapted.audit.counts.unmappedLines} lines with custom names. All are usable without classifying them. ${esc(options.inputCapture.storage?.message??'Input is held in this review.')}</p><p class="qc-muted">Capture ${esc(options.inputCapture.captureId)} · ${esc(options.inputCapture.inputFingerprint)}</p><details id="qc-boundary-lines"><summary>Included drawing lines</summary>${boundaryPanel()}</details><button data-action="export-input">Export captured takeoff</button></details>`:''}
      <div class="qc-actions"><button data-action="export-trace">Export debug bundle</button><button data-action="export-json">Export draft</button></div><p class="qc-muted">Page: ${esc(draft.roof.pageId)}<br/>Scope: ${esc(draft.roof.areaScopeId ?? 'selected page')}<br/>${draft.roof.mmPerSceneUnit.toFixed(3)} mm / scene unit<br/>${options.reviewRepository?'Structured review autosave is connected. Takeoff measurements and quote prices are never changed by saving here.':'Account saving is not connected. Export a draft to keep these changes.'}</p></details>`;
    const savedMatches=storedReview?.document.sourceFingerprint===sourceFingerprint(capturedRoof,options.inputCapture);
    const storageCard=storedReview?`<div class="qc-note qc-resume"><b>Saved review available</b><p>${savedMatches?'Your saved faces and cut plans match this takeoff.':'The saved review belongs to an older takeoff. It will not replace your current drawing automatically.'}</p><div class="qc-actions">${savedMatches?'<button data-action="resume-review" class="primary">Resume saved review</button>':''}<button data-action="start-fresh-review">Use current takeoff</button><button data-action="export-saved-review">Export saved review</button></div></div>`:
      saveState&&['error','conflict'].includes(saveState.status)?`<div class="qc-note"><b>Review not saved to account</b><p>${esc(saveState.message)}</p><button data-action="retry-save">${saveState.status==='conflict'?'Load saved version':'Retry save'}</button><button data-action="export-trace">Export backup</button></div>`:'';
    const coverage = visibleCoverage();
    const focused = coverage.find(r => r.id === focusedDiagnosticId) ?? coverage.find(r => r.severity === 'error') ?? coverage[0];
    const focusedIndex = focused ? coverage.indexOf(focused) : 0;
    const coverageLabel = focused?.kind === 'gap' ? 'Uncovered roof area' : focused?.kind === 'outside' ? 'Face outside the roof' : focused?.kind === 'overlap' ? 'Faces overlap' : 'Roof outlines overlap';
    const coverageAlert = focused ? `<div class="qc-note ${focused.severity === 'error' ? 'qc-error' : ''}"><div class="qc-check-title">${icon('warning')}${esc(coverageLabel)}</div><p>${(focused.areaMm2 / 1e6).toFixed(4)} m² · ${focused.severity === 'error' ? 'Check the highlighted region before calculating.' : 'Small drawing discrepancy. Shown in amber; draft calculation can continue.'}</p><div class="qc-view-issues"><button data-action="focus-issue" data-id="${focused.id}">${icon('focus')}Show on plan</button>${coverage.length > 1 ? `<button data-action="next-issue">Next (${focusedIndex + 1}/${coverage.length})</button>` : ''}${focused.severity==='warning'?`<button data-action="ignore-warning" data-id="${warningKey(partition().issues.find(i=>i.objectId===focused.id)!,draft)}">Ignore</button>`:`<button data-action="align-review">Align small gaps</button><button data-action="add-face">Draw missing face</button>`}</div></div>` : '';
    const otherError = errors.find(i => !partition().regions.some(r => r.id === i.objectId));
    const directFix=(i:Issue):string=>{
      const id=i.faceId??selectedFaceId;
      if(i.code==='DANGLING_LINE'&&i.faceId)return `<button data-action="approve-direction" data-id="${esc(id)}">${draft.faces.some(f=>f.id===id&&hasFlow(f.flow))?'Use this shape as drawn':'Choose its water direction'}</button><button data-action="edit-face-outline" data-id="${esc(id)}">Edit shape</button>`;
      if(/^(FLOW|MISSING_FLOW|FLOW_REVIEW|FLOW_EAVE_CONFLICT|RIDGE_DIRECTION|BARGE_DIRECTION|UNSUPPORTED_ANGLE)$/.test(i.code))return `<button data-action="choose-flow" data-id="${esc(id)}">Set water direction</button>${draft.faces.some(f=>f.id===id&&hasFlow(f.flow))?`<button data-action="approve-direction" data-id="${esc(id)}">Use my reviewed direction</button>`:''}`;
      if(i.code==='NO_FACES')return '<button data-action="detect">Find faces again</button><button data-action="add-face">Draw a face</button>';
      if(i.code==='NO_OUTLINE')return '<p>Close this review, select or draw the roof outline in the takeoff, then reopen Find offcuts.</p><button data-action="close">Back to takeoff</button>';
      if(i.code==='BUDGET')return '<button data-action="reset-search-budget">Restore safe search limits</button>';
      if(['DEMAND_TAMPER','STALE_TOTALS','MISSING_BANK_LAYOUT','SOLUTION_RULES'].includes(i.code))return '<button data-action="run">Recalculate reviewed faces</button>';
      if(i.code==='PITCH')return `<button data-action="fix-field" data-id="${esc(id)}" data-field-target="pitch">Set pitch</button>`;
      if(/^(FACE_POLYGON|INVALID_POLYGON|LOCAL_REPAIR_REVIEW|OPEN_TOPOLOGY)$/.test(i.code))return `<button data-action="edit-face-outline" data-id="${esc(id)}">Edit this outline</button><button data-action="add-face">Draw missing face</button>`;
      if(['FACE_UNCONFIRMED','FACE_REVIEW_CHANGED'].includes(i.code))return `<button data-action="approve-direction" data-id="${esc(id)}">Confirm this face</button>`;
      if(/^(PROFILE|ASYMMETRIC_PROFILE|LANE_PHASE|LAP|BUDGET|BANK_EXTENSION|SELF_FILL_MARGIN|SOURCE_LIMIT|STOCK_MODE)$/.test(i.code))return `<button data-action="fix-field" data-id="${esc(id)}" data-field-target="${({LANE_PHASE:'laneOffset',LAP:'lap',BANK_EXTENSION:'maxBankExtensionMm',SELF_FILL_MARGIN:'selfFillTransitionMm',SOURCE_LIMIT:'maxSourceBlocksPerFace',STOCK_MODE:'stockMode',PROFILE:'coverMm',ASYMMETRIC_PROFILE:'leftLapMm'} as Record<string,string>)[i.code]??'coverMm'}">Review these settings</button>`;
      if(i.code==='CALIBRATION')return '<p>Close this review and calibrate the current plan in the takeoff, then reopen Find offcuts.</p><button data-action="close">Back to takeoff</button>';
      return '';
    };
    const activeRepair=repairs.find(r=>r.id===selectedRepairId)??repairs.find(r=>r.edgeId===otherError?.objectId);
    const actionableError = otherError ? `<div class="qc-note qc-error" role="alert"><div class="qc-check-title">${icon('warning')}${esc(issueTitle(otherError,draft.faces))}</div>
      <p>${activeRepair?`${esc(activeRepair.message)} Gap: ${activeRepair.distanceMm.toFixed(0)} mm.`:esc(otherError.message)}</p>
      <div class="qc-actions">${directFix(otherError)}${activeRepair?`<button data-action="connect-repair" data-id="${activeRepair.id}">Connect & find faces</button><button data-action="preview-repair" data-id="${activeRepair.id}">Show connection</button>`:otherError.location?`<button data-action="focus-boundary" data-id="${warningKey(otherError,draft)}">Show boundary</button>`:otherError.faceId?`<button data-action="focus-face" data-id="${esc(otherError.faceId)}">Show face</button>`:''}</div>
      ${otherError.code==='DANGLING_LINE'?`<details class="qc-repair-options"><summary>Other options</summary><p>Keep this line separate only if it does not divide roof planes. Or draw/split the affected face yourself.</p>${activeRepair&&repairs.filter(r=>r.edgeId===activeRepair.edgeId).length>1?`<button data-action="next-repair" data-id="${activeRepair.id}">Other connection</button>`:''}<button data-action="keep-separate" data-id="${esc(otherError.objectId)}">Not a face boundary</button><button data-action="add-face">Draw missing face</button></details>`:''}
      ${!otherError.location&&!otherError.faceId?'<button data-action="review-inputs">Review settings</button>':''}
      ${errors.length>1?`<small>${errors.length} checks remain. Other valid faces are preserved.</small>`:''}</div>`:'';
    const advisory=visibleIssues.find(i=>i.code==='BACKGROUND_IMAGE'&&i.severity==='warning')??visibleIssues.find(i=>i.severity==='warning'&&!partition().regions.some(r=>r.id===i.objectId)&&!['SNAPPED_ENDPOINTS','NARROW_FACE','FLOW_REVIEW'].includes(i.code));
    const advisoryCard=advisory?`<details class="qc-advisory"><summary>${esc(issueTitle(advisory,draft.faces))}</summary><p>${esc(advisory.message)}</p><button data-action="ignore-warning" data-id="${warningKey(advisory,draft)}">Ignore</button></details>`:'';
    shadow.innerHTML = `<style>${styles}</style><div class="qc-app"><header class="qc-header"><div class="qc-title"><span class="qc-brand-mark">${icon('focus')}</span><div><h1>Find offcuts</h1><p>Plan the new sheets. Reuse the cuts.</p></div></div><span class="qc-badge">V2.11 · Draft plan</span>${saveState?`<small class="qc-save-status" role="status">${esc(saveState.message)}</small>`:''}${options.onClose ? '<button data-action="close" aria-label="Close offcut review">Close</button>' : ''}</header>
      <nav class="qc-topbar" aria-label="Offcut review and view controls"><span class="qc-step" ${phase === 'faces' ? 'aria-current="step"' : ''}><b>1</b>Review faces</span><span class="qc-muted" aria-hidden="true">→</span><span class="qc-step" ${phase === 'solution' ? 'aria-current="step"' : ''}><b>2</b>Cut plan</span><span class="qc-spacer"></span><span class="qc-nav-divider"></span><button class="qc-icon-button" data-action="undo" aria-label="Undo" title="Undo (Ctrl / ⌘ Z)" ${history.length ? '' : 'disabled'}>${icon('undo')}</button><button class="qc-icon-button" data-action="redo" aria-label="Redo" title="Redo (Ctrl / ⌘ Shift Z)" ${redoHistory.length ? '' : 'disabled'}>${icon('redo')}</button><button data-action="pan" aria-pressed="${panMode}" title="Pan tool. Also use middle mouse or Space + drag.">${icon('hand')}Pan</button><button data-action="fit" title="Fit whole plan">Fit</button><button class="qc-icon-button" data-action="zoom-in" aria-label="Zoom in">${icon('plus')}</button><button class="qc-icon-button" data-action="zoom-out" aria-label="Zoom out">${icon('minus')}</button>${s ? '<button data-action="export-svg">Export drawing</button>' : ''}</nav>
      <main class="qc-main"><section class="qc-viewport"><div class="qc-canvas" data-focus="roof-canvas" tabindex="0" aria-label="Roof canvas. Scroll to zoom. Middle mouse or Space and drag to pan. Select a face in review, or a material section in the cut plan."></div><div class="qc-help">${drawPoints ? 'Click corners · click first point / Enter to finish · Backspace removes last · Esc cancels · Alt bypasses snap' : phase === 'faces' ? 'Scroll to zoom · middle mouse / Space + drag to pan · select a face to edit' : 'Select a section for source & lengths · solid = new · hatch = offcuts · grey = filler'}</div>${busy ? `<div class="qc-busy" role="status"><strong>Planning sheet banks & offcuts</strong><span>${esc(progress)}</span><button data-action="cancel">Cancel</button></div>` : ''}</section>
      <aside class="qc-sidebar" aria-label="Offcut review controls">${storageCard}${stale ? '<div class="qc-note qc-error" role="alert">Takeoff changed. Close and reopen Find offcuts before using this plan.</div>' : ''}${notice ? `<div class="qc-notice" role="status">${esc(notice)}</div>` : ''}${error ? `<div class="qc-note qc-error" role="alert">${esc(error).replace(/\n/g, '<br/>')}<button data-action="dismiss-action-error">Dismiss message</button></div>` : ''}${coverageAlert}${actionableError}${pendingSourceAck ? `<div class="qc-note"><b>Use your reviewed faces?</b><p>The original linework had ambiguities. Continue only after checking the faces and water arrows. Geometry and coverage checks still apply.</p><div class="qc-actions"><button data-action="acknowledge-run">Use reviewed faces</button><button data-action="cancel-acknowledge">Keep reviewing</button></div></div>` : ''}${normal}${advisoryCard}${advanced}</aside></main>
      <footer class="qc-footer"><span>Draft only — verify profile and site lengths before ordering.</span><span>No spare sheets included.</span></footer></div>`;
    renderScene(); restoreView(view, resetScroll);
    if(panelTarget){const target=panelTarget;panelTarget=null;revealPanel(target);}
    queueReviewSave();
  }

  function download(name:string,contents:string,mime:string):void {
    const blob=new Blob([contents],{type:mime}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function debugBundle():string {
    let currentIssues:Issue[]=issues;
    try{currentIssues=allIssues();}catch(e){currentIssues=[...issues,{severity:'error',code:'DIAGNOSTIC_CHECK_FAILED',message:message(e)}];}
    const source=structuredClone(capturedRoof);delete source.imageUrl;
    return JSON.stringify({schemaVersion:1,kind:'quotecore-offcut-debug',engineVersion:'2.11',phase,planningModel:FACE_GEOMETRY_MODEL,
      boundaryBehaviour:auditFaceBehaviour(draft.faces),
      liveInputSnapshot:options.inputCapture?JSON.parse(exportLiveCapture(options.inputCapture)):null,
      persistence:{kind:options.reviewRepository?.kind??'not-connected',state:saveState},
      sourceRoofAtOpen:source,initialDetection,
      inputEvidence:options.inputCapture?'live-workspace-capture':'direct-roof-input; host adapter evidence not supplied',
      selectedPlanIndex:layoutIndex,approvedDraft:JSON.parse(exportDraft(draft)),
      reviewDiagnostics:{issues:currentIssues,repairs,drawingAdjustments,ignoredWarnings:draft.dismissedWarnings??[],componentBoundaryOverrides:draft.componentBoundaryOverrides??{},policy:draftingPolicy(draft.roof),stale},
      quantitySummary:quantities(),selectedSectionId,selectedTrace:draft.solution?.decisionTrace??null,lastAlternativeSearch:lastSearchTrace,
      sessionPlans:layouts.map(p=>({layoutId:p.layoutId,objective:p.objective,metrics:p.metrics,quantities:{purchasedLinealM:quantitySummary(p).purchasedLinealM,suppliedCoverAreaM2:quantitySummary(p).suppliedCoverAreaM2},comparison:p.comparison,decisionTrace:p.decisionTrace??null}))},null,2);
  }
  function ensureCurrent():void { if(stale||options.readCurrentSourceRevision&&options.readCurrentSourceRevision()!==capturedRevision)throw new Error('Takeoff changed. Reopen this review from the current canvas.'); }
  function run(objective?:'simpler'|'less-material'):void {
    ensureCurrent();
    validationAttempted = true;
    const detected = currentDetectionIssues(issues, draft.faces);
    if (detected.some(i => i.severity === 'error')) { pendingSourceAck = true; render(true); return; }
    if (validateInputs(draft.roof, draft.faces, draft.profile, draft.settings).some(i => i.severity === 'error')) { render(true); return; }
    if(objective&&!draft.solution)throw new Error('Create a first plan before asking for an alternative.');
    if(objective&&layouts.length>=12)throw new Error('Export the chosen plan; this session already has 12 alternatives.');
    const previous=objective?structuredClone(alternativeReference(draft.solution!,layouts,objective)):null;
    checkpoint();cancel();error='';selectedSectionId='';quotePreviewOpen=false;selectedOffcutId='';busy=true;alternativeMenu=false;
    progress=objective==='simpler'?'Searching for a simpler distinct plan…':objective==='less-material'?'Searching below the lowest purchased-material total saved…':'Testing longest banks and complete offcut sets…';jobId=localId();
    const id=jobId;
    try {
      worker=options.createWorker?.()??new Worker(new URL('../worker.ts',import.meta.url),{type:'module'});
      worker.onmessage=(event:MessageEvent)=>{
        if(disposed||event.data.id!==jobId||id!==jobId)return;
        if(event.data.kind==='progress'){progress=`${event.data.completed} / ${event.data.total} layout trials`;render();return;}
        if(event.data.kind==='result'){
          try{ensureCurrent();}catch(e){error=message(e);cancel();render();return;}layouts=[structuredClone(event.data.solution as Solution)];layoutIndex=0;draft.solution=structuredClone(layouts[0]);lastSearchTrace=null;alternativeAttempt=0;phase='solution';selectedOffcutId='';selectedGroupId='';advancedOpen=false;editPieces=false;
          // Suggestions become visible arrows without mutating the locked input
          // face state used to fingerprint the original solve request.
          notice=''; cancel();render(true);
        }else if(event.data.kind==='alternative-result'){
          try{ensureCurrent();}catch(e){error=message(e);cancel();render();return;}
          const result=event.data.result as AlternativePlanResult;lastSearchTrace=result.trace;
          if(result.status==='found'&&result.solution){
            const signature=planSignature(result.solution);
            if(layouts.some(s=>planSignature(s)===signature))notice='The search returned an already-saved plan. Your current plan has been kept.';
            else {layouts.push(structuredClone(result.solution));layoutIndex=layouts.length-1;draft.solution=structuredClone(result.solution);phase='solution';notice=result.message;lastSearchTrace=null;}
          }else notice=result.message;
          selectedOffcutId='';selectedGroupId='';cancel();render(true);
        }else if(event.data.kind==='error'){error=event.data.message;cancel();render();}
      };
      worker.onerror=(e)=>{error=`Worker failed: ${e.message}. Check the module-worker path / Content Security Policy.`;cancel();render();};
      worker.postMessage({id,request:{roof:draft.roof,faces:draft.faces,profile:draft.profile,settings:draft.settings},
        ...(objective&&previous?{alternative:{objective,previous,attempt:++alternativeAttempt,
          excludedSignatures:layouts.map(planSignature),maxExtraMaterialPercent:extraMaterialCap}}:{})});
    } catch(e){error=message(e);cancel();}
    render();
  }
  function click(event:Event):void {
    const target=(event.target as Element).closest<HTMLElement>('[data-action]');if(!target)return;
    const action=target.dataset.action;error='';
    if (target instanceof HTMLButtonElement && target.disabled) return;
    try {
      if(action==='resume-review'&&storedReview){applySavedReview(storedReview);return;}
      if(action==='start-fresh-review'){storedReview=null;saveReady=true;saveSignature='';notice='Current takeoff kept. Saving this review does not change the main takeoff.';render();return;}
      if(action==='export-saved-review'&&storedReview){download('quotecore-saved-offcut-review.json',JSON.stringify(storedReview.document,null,2),'application/json');return;}
      if(action==='retry-save'){
        if(!saveReady||saveState?.status==='conflict'){void loadStoredReview();return;}
        void reviewSaver?.flush().catch(()=>{});return;
      }
      if(action==='close'){options.onClose?.();return;}
      if(action==='cancel'){cancel();render();return;}
      if(action==='alternative-menu'){alternativeMenu=!alternativeMenu;render();return;}
      if(action==='alternative-simpler'){run('simpler');return;}
      if(action==='alternative-material'){run('less-material');return;}
      if(action==='export-input'){
        if(!options.inputCapture)throw new Error('This direct-geometry review has no host input snapshot. Export the debug bundle instead.');
        download('quotecore-offcuts-live-input.json',exportLiveCapture(options.inputCapture),'application/json');notice='Captured live takeoff exported. The source image URL and pricing data are excluded.';render();return;
      }
      if(action==='toggle-boundary-group'){
        const ids=options.inputCapture?.adapted.audit.lines.filter(r=>r.componentId===target.dataset.id&&r.included).flatMap(r=>r.topologyEdgeIds)??[];
        if(!ids.length)return;
        checkpoint();invalidate();
        const ignored=new Set(draft.roof.faceDetectionIgnoredEdgeIds??[]),allIgnored=ids.every(id=>ignored.has(id));
        for(const id of ids)if(allIgnored)ignored.delete(id);else ignored.add(id);
        draft.roof.faceDetectionIgnoredEdgeIds=[...ignored];draft.roof.sourceRevision=roofRevision(draft.roof);
        detect(false);notice='Review copy rebuilt from the included drawing lines. Undo restores the previous shapes and arrows.';render();return;
      }
      if(action==='export-trace'||action==='copy-trace'){
        if(action==='export-trace'){
          download('quotecore-offcuts-v2.11-debug.json',debugBundle(),'application/json');
          notice='Debug bundle exported with the captured input and face diagnostics. No cut plan is required.';render();return;
        }
        if(!draft.solution)throw new Error('No cut-plan trace exists yet. Export the debug bundle for face-detection diagnostics.');
        const trace=draft.solution.decisionTrace;
        const parts=[trace?traceText(trace):'No generation trace was stored for this plan.',
          lastSearchTrace?'\nMOST RECENT ALTERNATIVE SEARCH\n'+traceText(lastSearchTrace):''];
        const text=parts.join('\n');
        const fallback=()=>{download('quotecore-offcuts-trace.txt',text,'text/plain');notice='Clipboard unavailable; trace downloaded as text instead.';render();};
        if(navigator.clipboard?.writeText)void navigator.clipboard.writeText(text).then(()=>{if(!disposed){notice='Decision trace copied.';render();}},()=>{if(!disposed)fallback();});
        else fallback();return;
      }
      if(action==='show-lowest-plan'&&draft.solution){
        const best=alternativeReference(draft.solution,layouts,'less-material');layoutIndex=layouts.findIndex(s=>planSignature(s)===planSignature(best));draft.solution=structuredClone(best);selectedSectionId='';selectedFaceId='';notice='Showing the lowest purchased-material plan saved in this session.';render(true);return;
      }
      if(action==='ignore-warning'){
        const issue=allIssues().find(i=>warningKey(i,draft)===target.dataset.id);if(!issue)return;
        checkpoint();dismissWarning(draft,issue);focusedDiagnosticId='';notice='Review note ignored for these inputs. Restore it under Advanced.';render();return;
      }
      if(action==='restore-warnings'){checkpoint();draft.dismissedWarnings=[];notice='Ignored review notes restored.';render();return;}
      if(action==='reset-search-budget'){checkpoint();invalidate();draft.settings.maxSheets=DEFAULT_SETTINGS.maxSheets;draft.settings.maxTrials=DEFAULT_SETTINGS.maxTrials;draft.settings.maxMilliseconds=DEFAULT_SETTINGS.maxMilliseconds;render();return;}
      if(action==='review-inputs'){advancedOpen=true;panelTarget='[data-field="coverMm"]';render();return;}
      if(action==='dismiss-action-error'){error='';render();return;}
      if(action==='fix-field'||action==='edit-face-outline'){selectedFaceId=target.dataset.id??selectedFaceId;phase='faces';advancedOpen=true;panelTarget=action==='edit-face-outline'?'#polygon-points':`[data-field="${target.dataset.fieldTarget??'coverMm'}"]`;render();return;}
      if(action==='approve-direction'){const f=draft.faces.find(f=>f.id===(target.dataset.id??selectedFaceId));if(!f)return;if(!hasFlow(f.flow)){chooseFlow(f.id);return;}const confirmed=confirmReviewedFace(f);checkpoint();invalidate();Object.assign(f,confirmed);selectedFaceId=f.id;notice='Your reviewed direction is used.';panelTarget='#qc-water-direction';render();return;}
      if(action==='align-review'){applyAlignment();render();return;}
      if(action==='focus-boundary'){
        const issue=allIssues().find(i=>warningKey(i,draft)===target.dataset.id);if(!issue?.location)return;
        const p=issue.location;selectedFaceId=issue.faceId??selectedFaceId;fitBounds(p.x-15,p.y-15,p.x+15,p.y+15);selectedRepairId=issue.suggestionId??'';render();return;
      }
      if(action==='preview-repair'||action==='next-repair'){
        let repair=repairs.find(r=>r.id===target.dataset.id);if(!repair)return;
        if(action==='next-repair'){const choices=repairs.filter(r=>r.edgeId===repair!.edgeId);repair=choices[(choices.findIndex(r=>r.id===repair!.id)+1)%choices.length];}
        selectedRepairId=repair.id;fitBounds(Math.min(repair.from.x,repair.to.x)-10,Math.min(repair.from.y,repair.to.y)-10,Math.max(repair.from.x,repair.to.x)+10,Math.max(repair.from.y,repair.to.y)+10);render();return;
      }
      if(action==='connect-repair'){
        const repair=repairs.find(r=>r.id===target.dataset.id),edge=draft.roof.edges.find(e=>e.id===repair?.edgeId);if(!repair||!edge)return;
        const result=applyLocalFaceRepair(draft.roof,draft.faces,repair);
        checkpoint();invalidate();draft.roof=result.roof;draft.roof.sourceRevision=roofRevision(draft.roof);draft.faces=result.faces;
        issues=[...(options.initialIssues??[]),...result.issues];repairs=result.repairs;drawingAdjustments.push(...result.adjustments);selectedRepairId='';
        hiddenFaceIds=new Set([...hiddenFaceIds].filter(id=>result.preservedFaceIds.includes(id)));
        selectedFaceId=result.faces.find(f=>!result.preservedFaceIds.includes(f.id))?.id??result.faces[0]?.id??'';
        notice=`Connection applied to this review. ${result.preservedFaceIds.length} other faces kept unchanged; check the repaired area. Undo restores the previous review. Main takeoff unchanged.`;render();return;
      }
      if(action==='restore-boundaries'){checkpoint();draft.roof.faceDetectionIgnoredEdgeIds=[];draft.roof.sourceRevision=roofRevision(draft.roof);detect(false);notice='All measurement boundaries are included again. Review the detected faces.';render();return;}
      if(action==='keep-separate'){
        if(!target.dataset.id)return;checkpoint();invalidate();draft.roof.faceDetectionIgnoredEdgeIds=[...new Set([...(draft.roof.faceDetectionIgnoredEdgeIds??[]),target.dataset.id])];draft.roof.sourceRevision=roofRevision(draft.roof);
        // This action is offered only for a diagnosed dangling bridge. Such a
        // line is not part of any closed cell, so exclusion must not reset
        // unrelated hand-drawn faces or manually approved water arrows.
        issues=issues.filter(i=>i.objectId!==target.dataset.id);repairs=repairs.filter(r=>r.edgeId!==target.dataset.id);selectedRepairId='';
        notice='Line retained in the takeoff but excluded from this face search. Your reviewed faces are unchanged; Undo restores it.';render();return;
      }
      if(action==='select-section'){selectSection(target.dataset.id??'');return;}
      if(action==='choose-flow'){chooseFlow(target.dataset.id??selectedFaceId);return;}
      if(action==='custom-flow'){customFlowOpen=!customFlowOpen;render();return;}
      if((action==='set-flow'||action==='rotate-flow')&&face()){
        const f=face()!,angle=action==='rotate-flow'?nextFlowAngle(f.flow):Number(target.dataset.angle);
        const flow=flowFromAngle(angle);checkpoint();invalidate();f.flow=flow;f.flowSource='manual';f.confirmed=false;delete f.directionApproval;
        notice='';panelTarget='#qc-water-direction';render();return;
      }
      if(action==='preview-quantity'){ensureCurrent();quoteQuantityProposal(draft,quantityBasis);quotePreviewOpen=!quotePreviewOpen;render();return;}
      if(action==='export-quantity'||action==='send-quantity'){
        ensureCurrent();const proposal=quoteQuantityProposal(draft,quantityBasis);
        if(action==='send-quantity'){options.onQuantityProposal?.(proposal);notice='Quantity proposal sent to the host quote review. Confirm the target material line there.';}
        else {download('quotecore-offcuts-material-quantity.json',JSON.stringify({proposal,totals:quantities()},null,2),'application/json');notice='Quantity proposal exported. No quote or measured roof area has been changed.';}
        render();return;
      }
      if(action==='next-layout'){
        if(layouts.length<2)return;
        checkpoint();layoutIndex=(layoutIndex+1)%layouts.length;draft.solution=structuredClone(layouts[layoutIndex]);
        selectedSectionId='';selectedGroupId='';selectedOffcutId='';notice=`Layout ${layoutIndex+1} of ${layouts.length}. All sheet positions are allocated; review the changed source relationships.`;render(true);return;
      }
      if(action==='select-face'){selectedFaceId=target.dataset.id??'';customFlowOpen=false;notice='';panelTarget='#qc-water-direction';render();return;}
      if(action==='focus-face'){focusFace(target.dataset.id ?? selectedFaceId);render();return;}
      if(action==='focus-issue'){
        const region=partition().regions.find(r=>r.id===target.dataset.id);if(!region)return;
        focusedDiagnosticId=region.id;const b=bounds(region.region);fitBounds(b.minX,b.minY,b.maxX,b.maxY);render();return;
      }
      if(action==='next-issue'){
        const rs=partition().regions, index=rs.findIndex(r=>r.id===focusedDiagnosticId);
        if(rs.length)focusedDiagnosticId=rs[(index+1)%rs.length].id;
        render();return;
      }
      if(action==='toggle-face'&&face()){
        checkpoint();const f=face()!;if(hiddenFaceIds.has(f.id))hiddenFaceIds.delete(f.id);else hiddenFaceIds.add(f.id);
        notice=hiddenFaceIds.has(f.id)?`${f.name} hidden for inspection. It is still included in the roof.`:`${f.name} shown.`;render();return;
      }
      if(action==='show-all'){checkpoint();hiddenFaceIds.clear();notice='All faces are visible.';render();return;}
      if(action==='pan'){panMode=!panMode;render();return;}

      if(action==='select-offcut'){selectedOffcutId=target.dataset.id??'';selectedGroupId='';advancedOpen=true;editPieces=true;render();return;}
      if(action==='select-plan-face'){selectedFaceId=target.dataset.id??'';selectedSectionId='';selectedGroupId='';render();return;}
      if(action==='clear-selection'){selectedFaceId='';selectedSectionId='';selectedGroupId='';selectedOffcutId='';render();return;}
      if(action==='edit-group-pieces'&&draft.solution){selectedOffcutId=reuseGroups(draft.solution).find(g=>g.id===selectedGroupId)?.offcutIds[0]??'';editPieces=true;advancedOpen=true;render();return;}
      if(action==='flip-lap'&&draft.solution){const f=draft.faces.find(f=>f.id===target.dataset.id);if(!f)return;const lap=draft.solution.lapByFace[f.id];checkpoint();invalidate();f.lap=lap===1?-1:1;f.lapLocked=true;run();return;}
      if(action==='undo'||action==='redo'){
        const from=action==='undo'?history:redoHistory,to=action==='undo'?redoHistory:history,item=from.pop();
        if(item){
          to.push(snapshot());cancel();const saved=JSON.parse(item) as {draft:Draft;issues:Issue[];repairs?:BoundaryRepair[];drawingAdjustments?:DrawingAdjustment[];hiddenFaceIds:string[];selectedFaceId:string;phase:'faces'|'solution';layoutIndex?:number};
          draft=saved.draft;issues=saved.issues;repairs=saved.repairs??[];drawingAdjustments=saved.drawingAdjustments??[];hiddenFaceIds=new Set(saved.hiddenFaceIds);selectedFaceId=saved.selectedFaceId;
          phase=saved.phase;layoutIndex=saved.layoutIndex??0;
          if(draft.solution && !layouts.some(s=>s.layoutId===draft.solution?.layoutId)){layouts=[structuredClone(draft.solution)];layoutIndex=0;}
          selectedOffcutId='';selectedGroupId='';partitionKey='';drawPoints=null;drawHover=undefined;snapHint=null;pendingSourceAck=false;validationAttempted=false;
          notice=action==='undo'?'Previous change undone.':'Change restored.';
        }render();return;
      }
      if(action==='fit'){viewBox=[-30,-30,roof.sceneWidth+60,roof.sceneHeight+60];renderScene();return;}
      if(action==='zoom-in'||action==='zoom-out'){const factor=action==='zoom-in'?.8:1.25;zoom(factor,{x:viewBox[0]+viewBox[2]/2,y:viewBox[1]+viewBox[3]/2});return;}
      if(action==='export-json'){ensureCurrent();download('quotecore-offcuts-review-draft.json',exportDraft(draft),'application/json');options.onExport?.(structuredClone(draft));return;}
      if(action==='export-svg'){
        ensureCurrent();if(!draft.solution)throw new Error('Run the optimiser first.');
        if(validateDraft(draft).some(i=>i.severity==='error'))throw new Error('The current placement is invalid. Export a draft JSON for review, or fix it before exporting a drawing.');
        download('quotecore-offcuts-PROTOTYPE.svg',renderSvg(draft,{phase:'solution',print:true,showSheets,showEnvelope,showDetailedLabels,coverage:partition().regions}),'image/svg+xml');return;
      }
      if(action==='run'){run();return;}
      if(action==='back'){cancel();phase='faces';render();return;}
      if(action==='detect'){detect();render();return;}
      if(action==='add-face'){checkpoint();invalidate();panMode=false;drawPoints=[];drawHover=undefined;snapHint=null;notice='Draw the missing face. Click the first point to close, then choose water direction.';render();shadow.querySelector<HTMLElement>('.qc-canvas')?.focus({preventScroll:true});return;}
      if(action==='cancel-polygon'){drawPoints=null;drawHover=undefined;snapHint=null;render();return;}
      if(action==='finish-polygon'){finishPolygon();render();return;}
      if(action==='cancel-acknowledge'){pendingSourceAck=false;render();return;}
      if(action==='confirm-all'||action==='confirm-run'||action==='acknowledge-run'){
        if(hiddenFaceIds.size){checkpoint();hiddenFaceIds.clear();notice='Hidden faces are visible again. Review the whole roof, then confirm to calculate.';render(true);return;}
        const missing=draft.faces.filter(f=>!hasFlow(f.flow));
        if(missing.length){chooseFlow(missing[0].id);return;}
        // The approved partition is the solver input. Unresolved raw linework
        // does not veto that explicit decision, but missing roof/overlap still can.
        const proposed=draft.faces.map(confirmReviewedFace);
        const blockers=validateInputs(draft.roof,proposed,draft.profile,draft.settings).filter(i=>i.severity==='error');
        if(blockers.length){validationAttempted=true;error='Review the highlighted shapes or required settings before calculating.';render();return;}
        checkpoint();draft.faces=proposed;pendingSourceAck=false;
        const sourceProblems=issues.filter(i=>['DANGLING_LINE','OPEN_TOPOLOGY'].includes(i.code));
        if(sourceProblems.length){
          draft.reviewNotes=[...(draft.reviewNotes??[]),...sourceProblems];
          issues=issues.map(i=>['DANGLING_LINE','OPEN_TOPOLOGY'].includes(i.code)?{...i,severity:'warning',code:`REVIEWED_${i.code}`,message:'Original linework was incomplete here. Your approved shape and water arrow are used.'}:i);
        }
        if(action!=='confirm-all'){run();return;}render();return;
      }
      const f=face();
      if(action==='confirm-face'&&f){const confirmed=confirmReviewedFace(f);checkpoint();Object.assign(f,confirmed);render();return;}
      if(action==='apply-pitch'&&f){checkpoint();invalidate();draft.faces.forEach(g=>{g.pitchDeg=f.pitchDeg;g.confirmed=false;});render();return;}
      if(action==='delete-face'&&f){
        checkpoint();const index=draft.faces.findIndex(g=>g.id===f.id);invalidate();hiddenFaceIds.delete(f.id);
        draft.faces=draft.faces.filter(g=>g.id!==f.id);selectedFaceId=draft.faces[Math.min(index,draft.faces.length-1)]?.id??'';
        notice=`${f.name} deleted. Undo restores it. The roof perimeter has not been changed.`;render();return;
      }
      if(action==='merge'&&f){const id=(shadow.querySelector('#merge-target') as HTMLSelectElement).value,g=draft.faces.find(g=>g.id===id);if(!g)throw new Error('Choose an adjacent face.');const combined=refreshFaceBoundary(mergeFaces(f,g),draft.roof);checkpoint();invalidate();draft.faces=draft.faces.filter(h=>h.id!==g.id).map(h=>h.id===f.id?combined:h);hiddenFaceIds.delete(g.id);hiddenFaceIds.delete(f.id);render();return;}
      if(action==='split'&&f){const axis=(shadow.querySelector('#split-axis') as HTMLSelectElement).value as 'x'|'y',at=Number((shadow.querySelector('#split-at') as HTMLInputElement).value);const parts=splitFace(f,axis,at).map(g=>refreshFaceBoundary(g,draft.roof));checkpoint();invalidate();draft.faces=draft.faces.flatMap(g=>g.id===f.id?parts:[g]);hiddenFaceIds.delete(f.id);selectedFaceId=parts[0].id;render();return;}
      if(action==='apply-polygon'&&f){const text=(shadow.querySelector('#polygon-points') as HTMLTextAreaElement).value,ps=text.trim().split(/\n+/).map(line=>{const nums=line.trim().split(/[,\s]+/).map(Number);if(nums.length!==2||!nums.every(Number.isFinite))throw new Error('Use one x,y vertex per line.');return{x:nums[0],y:nums[1]};});checkpoint();invalidate();f.polygon=ps;Object.assign(f,refreshFaceBoundary(f,draft.roof));f.confirmed=false;f.provenance='edited';render();return;}
      if((action==='apply-placement'||action==='rotate-offcut'||action==='fit-placement')&&draft.solution){
        const o=draft.solution.offcuts.find(o=>o.id===selectedOffcutId);if(!o)throw new Error('Select an offcut.');
        const p=draft.solution.placements.find(p=>p.kind==='reuse'&&p.offcutId===selectedOffcutId) ?? {rotation:0 as const,translateY:0};
        const id=(shadow.querySelector('#destination') as HTMLSelectElement).value;
        if(action==='fit-placement'){const d=draft.solution.demands.find(d=>d.id===id)!;const fit=findFit(o,d,draft.profile);if(!fit)throw new Error('No shape- and lap-compatible fit was found for this sheet lane.');checkpoint();layouts=[];layoutIndex=0;draft.solution=editPlacement(draft.solution,selectedOffcutId,id,fit.rotation,fit.translateY);render();return;}
        const rot=action==='rotate-offcut'?(p.rotation===0?180:0):Number((shadow.querySelector('#offcut-rotation') as HTMLSelectElement).value) as 0|180;
        const y=Number((shadow.querySelector('#offcut-shift') as HTMLInputElement).value);checkpoint();layouts=[];layoutIndex=0;draft.solution=editPlacement(draft.solution,selectedOffcutId,id,rot,y);render();return;
      }
    }catch(e){error=message(e);if(busy)cancel();}render();
  }
  function change(event:Event):void {
    const target=event.target as HTMLInputElement|HTMLSelectElement;
    try{
      if(target.hasAttribute('data-tolerance')){
        const value=target.value;if(!['tight','balanced','relaxed'].includes(value))throw new Error('Choose Tight, Balanced or Relaxed.');
        checkpoint();invalidate();draft.roof.draftingTolerance=value as 'tight'|'balanced'|'relaxed';draft.roof.sourceRevision=roofRevision(draft.roof);notice='Review tolerance updated. Existing faces are kept. Align small gaps or rebuild from linework to apply connection changes.';render();return;
      }
      if(target.hasAttribute('data-plan-index')){
        const index=Number(target.value);if(busy||!Number.isInteger(index)||!layouts[index])return;
        checkpoint();layoutIndex=index;draft.solution=structuredClone(layouts[index]);lastSearchTrace=null;selectedSectionId='';selectedGroupId='';selectedOffcutId='';notice=`Showing saved Plan ${index+1}; no recalculation performed.`;render();return;
      }
      if(target.hasAttribute('data-quantity-basis')){quantityBasis=target.value as QuoteQuantityBasis;quotePreviewOpen=false;render();return;}
      if(target.hasAttribute('data-alt-cap')){
        const cap=Number(target.value);if(!Number.isFinite(cap)||cap<0||cap>100)throw new Error('Extra material limit must be between 0% and 100%.');
        extraMaterialCap=cap;return;
      }
      if(target.dataset.display){const checked=(target as HTMLInputElement).checked;if(target.dataset.display==='editGroups'){editGroups=checked;selectedSectionId='';selectedGroupId='';render();return;}if(target.dataset.display==='showDetailedLabels'){showDetailedLabels=checked;renderScene();return;}if(target.dataset.display==='showSheets')showSheets=checked;if(target.dataset.display==='showSources')showSources=checked;if(target.dataset.display==='showEnvelope')showEnvelope=checked;if(target.dataset.display==='editPieces'){editPieces=checked;selectedOffcutId='';selectedGroupId='';render();return;}renderScene();return;}
      if(target.dataset.outline){checkpoint();invalidate();const ids=new Set(draft.roof.outlines.map(o=>o.id));if((target as HTMLInputElement).checked)ids.add(target.dataset.outline);else ids.delete(target.dataset.outline);draft.roof.outlines=sourceOutlines.filter(o=>ids.has(o.id));draft.roof.sourceRevision=roofRevision(draft.roof);detect();render();return;}
      const field=target.dataset.field;if(!field)return;
      checkpoint();invalidate();const f=face(),value=target.value;
      if(field==='name'&&f)f.name=value;
      else if(field==='pitch'&&f){f.pitchDeg=value===''?null:Number(value);f.confirmed=false;}
      else if(field==='flowAngle'&&f){f.flow=value===''?null:flowFromAngle(Number(value));f.flowSource='manual';f.confirmed=false;delete f.directionApproval;}
      else if(field==='laneOffset'&&f)f.laneOffsetMm=Number(value);
      else if(field==='lap'&&f)f.lap=Number(value) as -1|1;
      else if(field==='lapLocked'&&f)f.lapLocked=(target as HTMLInputElement).checked;
      else if(field==='laneOffsetLocked'&&f)f.laneOffsetLocked=(target as HTMLInputElement).checked;
      else if(field==='allPitch')draft.faces.forEach(g=>{g.pitchDeg=value===''?null:Number(value);g.confirmed=false;});
      else if(field==='maxBankExtensionMm')draft.settings.maxBankExtensionMm=Number(value);
      else if(field==='selfFillTransitionMm')draft.settings.selfFillTransitionMm=Number(value);
      else if(field==='maxSourceBlocksPerFace')draft.settings.maxSourceBlocksPerFace=Number(value);
      else if(field==='stockMode')draft.settings.stockMode=value as 'bank-first'|'per-lane'|'face-envelope';
      else if(field==='optimiseLapDirections')draft.settings.optimiseLapDirections=(target as HTMLInputElement).checked;
      else if(field==='rulesConfirmed'||field==='allowEndForEnd')draft.profile[field]=(target as HTMLInputElement).checked;
      else if(['coverMm','leftLapMm','rightLapMm','cutGapMm','endAllowanceMm','maxLengthMm','lengthIncrementMm'].includes(field)) (draft.profile as unknown as Record<string,unknown>)[field]=Number(value);
    }catch(e){error=message(e);}render();
  }
  function releasePointer(id: number): void {
    const canvas = shadow.querySelector<HTMLElement>('.qc-canvas');
    if (canvas?.hasPointerCapture(id)) canvas.releasePointerCapture(id);
  }
  function pointerDown(event: Event): void {
    const e = event as PointerEvent, target = e.target as Element;
    if (!target.closest('.qc-canvas') || drag || e.button === 2) return;
    const canvas = shadow.querySelector<HTMLElement>('.qc-canvas')!;
    const p = scenePoint(e), base = { start: p, last: p, clientStart: { x: e.clientX, y: e.clientY }, pointerId: e.pointerId };
    // Navigation wins BEFORE face/handle hit testing. A middle click or Space
    // drag must never start moving a vertex, flow arrow or physical offcut.
    if (e.button === 1 || e.button === 0 && (spaceHeld || panMode)) {
      const svg = shadow.querySelector<SVGSVGElement>('svg.qc-scene'), m = svg?.getScreenCTM()?.inverse();
      if (!m) return;
      drag = { ...base, kind: 'pan', initialView: [...viewBox], inverse: { a: m.a, b: m.b, c: m.c, d: m.d } };
      canvas.focus({ preventScroll: true }); canvas.dataset.dragging = 'true';
    } else {
      if (e.button !== 0 || busy || stale) return;
      if (drawPoints) {
        e.preventDefault();canvas.focus({preventScroll:true});snapHint=e.altKey?null:drawingSnap(p);
        if(snapHint?.kind==='close'){try{finishPolygon();}catch(err){error=message(err);}render();return;}
        const point=snapHint?.point??p;if(!drawPoints.length||distance(point,drawPoints[drawPoints.length-1])>1e-6)drawPoints.push({...point});drawHover=point;renderScene();return;
      }
      if (target.closest('[data-action]')) return; // lap/diagnostic buttons own clicks
      const section=target.closest<SVGElement>('[data-section]');
      if(section&&phase==='solution'&&!editPieces&&!editGroups){e.preventDefault();canvas.focus({preventScroll:true});selectSection(section.dataset.section??'');return;}
      const vertex = target.closest<SVGElement>('[data-vertex]'), flow = target.closest<SVGElement>('[data-flow]');
      const offcut = target.closest<SVGElement>('[data-offcut]'), group = target.closest<SVGElement>('[data-group]'), faceEl = target.closest<SVGElement>('[data-face]');
      if (vertex) {
        const f = draft.faces.find(f => f.id === vertex.dataset.faceId);
        if (f) drag = { ...base, kind: 'vertex', faceId: f.id, vertex: Number(vertex.dataset.vertex), original: { ...f.polygon[Number(vertex.dataset.vertex)] } };
      } else if (flow) drag = { ...base, kind: 'flow', faceId: flow.dataset.flow };
      else if (group && phase === 'solution') { selectedGroupId = group.dataset.group ?? ''; selectedOffcutId = ''; drag = { ...base, kind: 'group', groupId: selectedGroupId }; }
      else if (offcut && phase === 'solution') { selectedOffcutId = offcut.dataset.offcut ?? ''; drag = { ...base, kind: 'offcut', offcutId: selectedOffcutId }; }
      else if (faceEl && phase === 'faces') { selectedFaceId = faceEl.dataset.face ?? ''; notice = ''; render(); shadow.querySelector<HTMLElement>('.qc-canvas')?.focus({ preventScroll: true }); return; }
    }
    if (drag) { e.preventDefault(); canvas.setPointerCapture(e.pointerId); }
  }
  function pointerMove(event: Event): void {
    const e = event as PointerEvent;
    if(drawPoints&&!drag&&(e.target as Element).closest('.qc-canvas')){
      const p=scenePoint(e);snapHint=e.altKey?null:drawingSnap(p);drawHover=snapHint?.point??p;
      if(drawingFrame===null)drawingFrame=requestAnimationFrame(()=>{drawingFrame=null;renderScene();});return;
    }
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (drag.kind === 'pan') {
      const dx = e.clientX - drag.clientStart.x, dy = e.clientY - drag.clientStart.y, m = drag.inverse!, initial = drag.initialView!;
      // Transform the CLIENT delta as a vector, using the gesture's original
      // matrix. SVG meet/letterboxing and non-zero page offsets are supported.
      viewBox = [initial[0] - (m.a * dx + m.c * dy), initial[1] - (m.b * dx + m.d * dy), initial[2], initial[3]];
      shadow.querySelector('svg.qc-scene')?.setAttribute('viewBox', viewBox.join(' '));
      e.preventDefault(); return;
    }
    const raw=scenePoint(e);snapHint=drag.kind==='vertex'&&!e.altKey?drawingSnap(raw,drag.original):null;drag.last=snapHint?.point??raw;
    if (drag.kind === 'group') {
      const group = [...shadow.querySelectorAll<SVGGElement>('[data-group]')].find(g => g.dataset.group === drag!.groupId);
      group?.setAttribute('transform', `translate(${drag.last.x - drag.start.x} ${drag.last.y - drag.start.y})`);
    } else if (drag.kind === 'offcut') {
      const group = [...shadow.querySelectorAll<SVGGElement>('[data-offcut]')].find(g => g.dataset.offcut === drag!.offcutId);
      group?.setAttribute('transform', `translate(${drag.last.x - drag.start.x} ${drag.last.y - drag.start.y})`);
    } else if (drag.kind === 'vertex') {
      const handle = [...shadow.querySelectorAll<SVGCircleElement>('[data-vertex]')].find(g => g.dataset.faceId === drag!.faceId && Number(g.dataset.vertex) === drag!.vertex);
      handle?.setAttribute('cx', String(drag.last.x)); handle?.setAttribute('cy', String(drag.last.y));
      for (const f of draft.faces) {
        const polygon = [...shadow.querySelectorAll<SVGPolygonElement>('polygon[data-face]')].find(g => g.dataset.face === f.id);
        polygon?.setAttribute('points', f.polygon.map(q => distance(q, drag!.original!) < .01 ? drag!.last : q).map(p => `${p.x},${p.y}`).join(' '));
      }
    } else {
      const handle = [...shadow.querySelectorAll<SVGCircleElement>('[data-flow]')].find(g => g.dataset.flow === drag!.faceId);
      handle?.setAttribute('cx', String(drag.last.x)); handle?.setAttribute('cy', String(drag.last.y));
      const arrow = [...shadow.querySelectorAll<SVGLineElement>('[data-water-face]')].find(g => g.dataset.waterFace === drag!.faceId);
      arrow?.setAttribute('x2', String(drag.last.x)); arrow?.setAttribute('y2', String(drag.last.y));
    }
  }
  function pointerUp(event: Event): void {
    const e = event as PointerEvent;
    if (!drag || e.pointerId !== drag.pointerId) return;
    const state = drag; drag = null; releasePointer(e.pointerId);
    if (state.kind === 'pan') { renderScene(); return; }
    try {
      const raw=scenePoint(e), snapped=state.kind==='vertex'&&!e.altKey?drawingSnap(raw,state.original):null,p=snapped?.point??raw;
      snapHint=null;
      if (distance({ x: e.clientX, y: e.clientY }, state.clientStart) < 3) { render(); return; }
      if (state.kind === 'vertex') {
        checkpoint(); invalidate();
        for (const f of draft.faces) {
          let changed = false;
          f.polygon = f.polygon.map(q => { if (distance(q, state.original!) < .01) { changed = true; return p; } return q; });
          if (changed) { f.confirmed = false; f.provenance = 'edited'; Object.assign(f, refreshFaceBoundary(f, draft.roof)); }
        }
      } else if (state.kind === 'flow') {
        const f = draft.faces.find(f => f.id === state.faceId);
        if (f) { const flow = unit(sub(p, interiorAnchor(f.polygon))); checkpoint(); invalidate(); f.flow = flow; f.flowSource = 'manual'; f.confirmed = false; delete f.directionApproval; }
      } else if (state.kind === 'group' && draft.solution) {
        const target = draft.solution.demands.find(d => pointInRegion(d.cover, scenePointToDemand(p, d)));
        if (!target) throw new Error('Drop this offcut set onto a roof face.');
        const moved = moveReuseGroup(draft.solution, state.groupId!, target.faceId, target.laneIndex);
        checkpoint(); layouts=[];layoutIndex=0;draft.solution = moved; selectedGroupId = '';
      } else if (draft.solution) {
        const s = draft.solution, o = s.offcuts.find(o => o.id === state.offcutId); if (!o) throw new Error('Source offcut not found.');
        const placement = s.placements.find(a => a.offcutId === state.offcutId && a.kind === 'reuse') ?? { demandId: o.sourceDemandId, translateY: 0, rotation: 0 as const };
        const target = s.demands.find(d => pointInRegion(d.cover, scenePointToDemand(p, d)));
        if (!target) throw new Error('Drop the offcut onto a sheet lane on the roof.');
        const original = s.demands.find(d => d.id === placement.demandId)!;
        let dy = placement.translateY;
        if (target.id === original.id) dy += scenePointToDemand(p, target).y - scenePointToDemand(state.start, original).y;
        else { const anchor = scenePointToDemand(state.start, original).y - placement.translateY; dy = scenePointToDemand(p, target).y - anchor; }
        checkpoint(); layouts=[];layoutIndex=0;draft.solution = editPlacement(s, state.offcutId!, target.id, placement.rotation, dy);
      }
    } catch (e) { error = message(e); }
    render();
  }
  function zoom(factor: number, anchor: Point): void {
    if (drag || !Number.isFinite(factor) || factor <= 0 || viewBox[2] * factor < roof.sceneWidth * .015 || viewBox[2] * factor > roof.sceneWidth * 4) return;
    viewBox = [anchor.x + (viewBox[0] - anchor.x) * factor, anchor.y + (viewBox[1] - anchor.y) * factor, viewBox[2] * factor, viewBox[3] * factor]; renderScene();
  }
  function wheel(event: Event): void {
    const e = event as WheelEvent; if (!(e.target as Element).closest('.qc-canvas')) return;
    e.preventDefault(); if (!e.deltaY) return; zoom(e.deltaY > 0 ? 1.12 : 1 / 1.12, scenePoint(e));
  }
  function pointerCancel(event?: Event): void {
    if (!drag || event instanceof PointerEvent && event.pointerId !== drag.pointerId) return;
    const id = drag.pointerId; drag = null; releasePointer(id); renderScene();
  }
  function isEditing(e: KeyboardEvent): boolean {
    return e.composedPath().some(t => t instanceof HTMLElement && (t.matches('input,textarea,select') || t.isContentEditable));
  }
  function invoke(action: string): void { shadow.querySelector<HTMLButtonElement>(`button[data-action="${action}"]`)?.click(); }
  function keyDown(event: Event): void {
    const e = event as KeyboardEvent;
    if (isEditing(e)) return;
    const section=(e.target as Element).closest<SVGElement>('[data-section]');
    if(section&&(e.key==='Enter'||e.key===' ')){e.preventDefault();e.stopPropagation();selectSection(section.dataset.section??'');return;}
    if(drawPoints&&(e.key==='Backspace'||e.key==='Delete')){e.preventDefault();e.stopPropagation();drawPoints.pop();drawHover=undefined;snapHint=null;renderScene();return;}
    if(drawPoints&&e.key==='Enter'){e.preventDefault();e.stopPropagation();try{finishPolygon();}catch(err){error=message(err);}render();return;}
    if(e.key==='Escape'&&selectedSectionId){e.preventDefault();e.stopPropagation();selectedSectionId='';selectedFaceId='';render();return;}
    if (e.key === 'Escape' && (drag || drawPoints || pendingSourceAck)) {
      e.preventDefault(); e.stopPropagation(); pointerCancel(); drawPoints = null; drawHover=undefined;snapHint=null; pendingSourceAck = false; render(); return;
    }
    if ((e.ctrlKey || e.metaKey) && !e.altKey && ['z', 'y'].includes(e.key.toLowerCase())) {
      e.preventDefault(); e.stopPropagation(); invoke(e.key.toLowerCase() === 'y' || e.shiftKey ? 'redo' : 'undo'); return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && phase === 'faces' && !e.ctrlKey && !e.metaKey && !e.altKey &&
        (e.target as Element).matches('.qc-canvas,button[data-action="select-face"]')) {
      e.preventDefault(); e.stopPropagation(); invoke('delete-face'); return;
    }
    if ((e.key === 'Enter' || e.key === ' ') && (e.target as Element).closest('[data-action="flip-lap"],[data-action="focus-issue"],[data-action="choose-flow"]')) { e.preventDefault(); click(e); }
  }
  function globalKeyDown(e: KeyboardEvent): void {
    if (e.code !== 'Space' || isEditing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    const canvas = shadow.querySelector<HTMLElement>('.qc-canvas');
    if (!pointerOverCanvas && shadow.activeElement !== canvas) return;
    spaceHeld = true; e.preventDefault();
    if (canvas) canvas.dataset.pan = 'true';
  }
  function globalKeyUp(e: KeyboardEvent): void {
    if (e.code !== 'Space') return;
    spaceHeld = false; const canvas = shadow.querySelector<HTMLElement>('.qc-canvas'); if (canvas) canvas.dataset.pan = String(panMode);
  }
  function blur(): void { spaceHeld = false; pointerOverCanvas = false; pointerCancel(); const c = shadow.querySelector<HTMLElement>('.qc-canvas'); if (c) c.dataset.pan = String(panMode); }
  function over(event: Event): void { pointerOverCanvas = !!(event.target as Element).closest('.qc-canvas'); }
  function out(event: Event): void { const to = (event as PointerEvent).relatedTarget; if (!(to instanceof Element) || !to.closest('.qc-canvas')) pointerOverCanvas = false; }
  function auxClick(event: Event): void { if ((event as MouseEvent).button === 1 && (event.target as Element).closest('.qc-canvas')) event.preventDefault(); }
  function toggle(event: Event): void { const target = event.target as HTMLDetailsElement; if (target.id === 'qc-advanced') advancedOpen = target.open; }
  const listeners: [string, EventListener, boolean | AddEventListenerOptions | undefined][] = [
    ['toggle', toggle, true], ['keydown', keyDown, undefined], ['click', click, undefined], ['change', change, undefined],
    ['pointerdown', pointerDown, undefined], ['pointermove', pointerMove, undefined], ['pointerup', pointerUp, undefined],
    ['pointercancel', pointerCancel, undefined], ['lostpointercapture', pointerCancel, undefined], ['wheel', wheel, { passive: false }],
    ['pointerover', over, undefined], ['pointerout', out, undefined], ['auxclick', auxClick, undefined],
  ];
  for (const [type, fn, config] of listeners) shadow.addEventListener(type, fn, config);
  window.addEventListener('keydown', globalKeyDown); window.addEventListener('keyup', globalKeyUp); window.addEventListener('blur', blur);
  const watch = options.readCurrentSourceRevision ? setInterval(() => {
    try { if (!stale && options.readCurrentSourceRevision!() !== capturedRevision) { stale = true; cancel(); pointerCancel(); render(); } }
    catch { stale = true; cancel(); pointerCancel(); render(); }
  }, 1000) : null;
  if(options.initialSavedReview&&reviewSaver){
    reviewSaver.initialise(options.initialSavedReview.revision);saveReady=true;
    applySavedReview(options.initialSavedReview);
  }else{render();void loadStoredReview();}
  if(draft.roof.imageUrl && /^(https?:|blob:|data:image\/)/.test(draft.roof.imageUrl)){
    background=new Image();
    background.onload=()=>{if(!disposed){backgroundFailed=false;viewport.request();}};
    background.onerror=()=>{if(!disposed){backgroundFailed=true;render();}};
    background.src=draft.roof.imageUrl;
    if(background.complete&&background.naturalWidth>0)viewport.request();
  }
  return {
    getDraft: () => structuredClone(draft),
    getDebugBundle: () => debugBundle(),
    flushReview: async()=>{queueReviewSave();await reviewSaver?.flush();if(options.reviewRepository&&!saveReady&&!storedReview)throw new Error('Saving is not ready. Retry or export before closing.');},
    getSaveState:()=>saveState,
    destroy: () => {
      disposed = true; reviewSaver?.dispose(); if(drawingFrame!==null)cancelAnimationFrame(drawingFrame); viewport.destroy();if(background){background.onload=null;background.onerror=null;background=null;} cancel(); pointerCancel(); if (watch) clearInterval(watch);
      for (const [type, fn, config] of listeners) shadow.removeEventListener(type, fn, config);
      window.removeEventListener('keydown', globalKeyDown); window.removeEventListener('keyup', globalKeyUp); window.removeEventListener('blur', blur);
      shadow.innerHTML = '';
    },
  };
}
