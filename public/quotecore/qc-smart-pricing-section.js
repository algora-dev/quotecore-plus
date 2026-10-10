/* QuoteCore+ / Smart Components� / premium website section 1.0.0. No external dependencies. */
(()=>{
"use strict";
/**
 * Narrow, local demonstration adapter — NOT the production QuoteCore engine.
 *
 * Supported: metric linear per-unit pricing, percentage waste, optional rafter
 * pitch, individual or combined lengths. Intentionally excludes packs, fixed
 * waste, valley/hip rules, tax, quote margins and job-level overrides.
 *
 * Source contracts:
 *  - supplied app/components/pricing/componentTest.ts
 *  - UX v2.15 registry/PRICING_ACTIVATION_CALCULATION_CONTRACT.md, clauses 3–7
 *
 * The supplied extracts omit app/lib/pricing/engine.ts. The rafter geometric
 * multiplier below is 1/cos(angle); production-helper parity is NOT certified.
 * Both material and labour use the quantity AFTER pitch AND percentage waste,
 * matching the supplied caller. No rounded display value re-enters the maths.
 */
function calculateLinearExample(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, errors: { input: "Provide the component rates and test measurement." } };
  const errors = {};
  const parse = (raw, key, label, positive = false) => {
    const n = Number(raw);
    if (raw === null || raw === undefined || String(raw).trim() === '' || !Number.isFinite(n) || (positive ? n <= 0 : n < 0)) {
      errors[key] = `${label}: enter ${positive ? 'a number above zero' : 'zero or a positive number'}.`;
      return 0;
    }
    return n;
  };
  const materialRate = parse(input.materialRate, 'materialRate', 'Material rate');
  const labourRate = parse(input.labourRate, 'labourRate', 'Labour rate');
  const wastePercent = parse(input.wastePercent, 'wastePercent', 'Waste');
  const values = Array.isArray(input.lengths) ? input.lengths.map((v, i) => parse(v, `length-${i}`, `Length ${i + 1}`, true)) : [];
  if (!values.length) errors.lengths = 'Add a length to test.';
  if (!['plan', 'surface'].includes(input.basis)) errors.basis = 'Choose plan or already-measured length.';
  const pitchApplied = input.basis === 'plan';
  const pitchDegrees = pitchApplied ? parse(input.pitchDegrees, 'pitchDegrees', 'Pitch') : 0;
  if (pitchApplied && pitchDegrees >= 90) errors.pitchDegrees = 'Pitch must be below 90°.';
  if (Object.keys(errors).length) return { ok: false, errors };
  const factor = pitchApplied ? 1 / Math.cos(pitchDegrees * Math.PI / 180) : 1;
  const entries = values.map(entered => {
    const afterPitch = entered * factor;
    return { entered, afterPitch, required: afterPitch * (1 + wastePercent / 100) };
  });
  const sum = key => entries.reduce((n, e) => n + e[key], 0);
  const entered = sum('entered');
  const afterPitch = sum('afterPitch');
  const required = sum('required');
  const materialCost = required * materialRate;
  const labourCost = required * labourRate;
  const total = materialCost + labourCost;
  if (![entered, afterPitch, required, materialCost, labourCost, total].every(Number.isFinite)) {
    return { ok: false, errors: { lengths: 'These values are too large. Reduce the measurements or rates.' } };
  }
  return { ok: true, result: { entered, afterPitch, required, wasteAdded: required - afterPitch,
    materialRate, labourRate, wastePercent, materialCost, labourCost, total,
    effectiveCost: total / entered, pitchDegrees, pitchApplied, entryCount: entries.length, entries } };
}

/** QuoteCore+ Smart Components™ • Website edition 1.0 (animation 4.1.0)
 * Native, dependency-free custom element. Deterministic 37.5-second animation.
 * V4 refines V3: five visible setup steps, real cell-to-field transfers, restrained styling.
 * One timeline / two responsive compositions / locally editable test example.
 * This script is wrapped with calculation.js and scoped CSS by build.py.
 */
const QC_DATA = Object.freeze([
  {name:'Barge Flashing',code:'BAR-001',material:24,labour:5.5,waste:5,unit:'m',measure:'Linear: Single (m)',pitch:'Rafter Pitch',notes:'Barge board flashing for gable end edges.'},
  {name:'Building Underlay',code:'UND-001',material:4.5,labour:2,waste:10,unit:'m²',measure:'Area (m²)',pitch:'Rafter Pitch',notes:'Synthetic roofing underlay. Breathable membrane.'},
  {name:'Spouting Half-Round',code:'SPO-HR',material:42,labour:8,waste:5,unit:'m',measure:'Linear: Single (m)',pitch:'',notes:'Half-round PVC spouting, 150mm diameter.'}
].map(Object.freeze));
// A real horizontal row: identity + the same five settings demonstrated first.
// These are analogy fields, not a promise about the importer mapping contract.
const QC_FIELDS = Object.freeze([
  {key:'name',letter:'A',heading:'Component name',destination:'Component name',width:172},
  {key:'material',letter:'B',heading:'Materials',destination:'Materials',width:96},
  {key:'labour',letter:'C',heading:'Labour',destination:'Labour',width:92},
  {key:'waste',letter:'D',heading:'Waste',destination:'Waste',width:64},
  {key:'measure',letter:'E',heading:'Measurement',destination:'Measurement type',width:137},
  {key:'pitch',letter:'F',heading:'Pitch rule',destination:'Pitch rule',width:107}
].map(Object.freeze));
const QC_SETUP = Object.freeze([
  {key:'materialRate',start:1.8,entered:2.35,value:'24.00'},
  {key:'labourRate',start:2.9,entered:3.45,value:'5.50'},
  {key:'wastePercent',start:4.0,entered:4.55,value:'5'},
  {key:'measure',start:4.95,entered:5.68,value:'Linear: Single (m)'},
  {key:'pitch',start:6.05,entered:6.78,value:'Rafter Pitch'}
].map(Object.freeze));
const QC_TIMING = Object.freeze({
  duration:37.5, chapters:[0,19.5], readLead:1.6, setupComplete:7.15,
  openCue:7.55, testFocus:8.05, testOpen:8.45, lengthEntry:9.15, pitchEntry:10.05, firstResult:11.35,
  editFocus:13.7, rateChange:14.65, resultFocus:15.6, updatedResult:16.45,
  staticIntro:18.7, sheetMessage:19.5, sheetReveal:21.1, rowFocus:21.7,
  fieldStart:22.1, fieldGap:1.25, flight:.96, detailComplete:29.6,
  otherRows:[{time:30.1,row:1},{time:31.3,row:2}], comparisonHold:32.25,
  closing:32.6, importNote:34.0
});
const clamp = (n,a=0,b=1) => Math.min(b,Math.max(a,n));
const mix = (a,b,p) => a+(b-a)*p;
const prog = (t,start,duration) => clamp((t-start)/duration);
const smooth = p => p*p*(3-2*p);
const esc = v => String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = n => '$'+Number(n).toLocaleString('en-NZ',{minimumFractionDigits:2,maximumFractionDigits:2});
const qty = n => Number(n).toLocaleString('en-NZ',{maximumFractionDigits:3});
const timeText = t => `00:${String(Math.floor(t)).padStart(2,'0')}`;
const brandHTML = value => esc(value).replace(/(Smart Components?)™/g,'$1<sup class="tm" aria-hidden="true">™</sup>');
const text = (el,v) => {
  const value=String(v);
  if(el.textContent===value)return;
  if(/Smart Components?™/.test(value))el.innerHTML=brandHTML(value);
  else el.textContent=value;
};
function styleBrandMarks(root) {
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  const nodes=[];
  while(walker.nextNode()) {
    const n=walker.currentNode;
    if(n.parentElement?.tagName==='STYLE'||n.parentElement?.tagName==='SCRIPT')continue;
    if(/Smart Components?™/.test(n.textContent))nodes.push(n);
  }
  for(const n of nodes){const fragment=document.createElement('template');fragment.innerHTML=brandHTML(n.textContent);n.replaceWith(fragment.content);}
}
const flag = (el,c,on) => { if (el.classList.contains(c)!==!!on) el.classList.toggle(c,!!on); };
const ICONS = {
  play:'<path d="m9 5 11 7-11 7z"/>', pause:'<path d="M8 5v14M16 5v14"/>',
  replay:'<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',
  edit:'<path d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5m-1.4-9.4a2 2 0 0 1 2.8 2.8L12 15H9v-3z"/>',
  calculator:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h1m6 0h1m-8 4h1m6 0h1m-8 3h1m6 0h1"/>',
  ruler:'<path d="M4 7h16v10H4zM8 7v5m4-5v3m4-3v5"/>',
  roof:'<path d="m3 16 9-9 9 9M6 18V7m12 11V7"/>',
  file:'<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8m-8 4h8"/>',
  check:'<path d="m5 12 4 4L19 6"/>', down:'<path d="m6 9 6 6 6-6"/>',
  arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  trash:'<path d="M4 7h16m-15 0 1 13h12l1-13M9 7V4h6v3m-5 4v5m4-5v5"/>',
  settings:'<path d="M5 5v14m7-14v14m7-14v14M2 9h6m1 7h6m1-9h6"/>',
  horizontal:'<path d="M3 12h18m-4-4 4 4-4 4M7 8l-4 4 4 4"/>',
  shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM8 12l3 3 5-6"/>'
};
const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]||ICONS.check}</svg>`;
function rowValue(row,key,rateOverride) {
  if (key==='material') return money(rateOverride===undefined?row.material:rateOverride)+'/'+row.unit;
  if (key==='labour') return money(row.labour)+'/'+row.unit;
  if (key==='waste') return row.waste+'%';
  if (key==='pitch') return row.pitch||'None';
  return row[key];
}
function cardMarkup(row,index=0,rateOverride) {
  const v = key => `<span class="target" data-target="${key}">${esc(rowValue(row,key,rateOverride))}</span>`;
  return `<div class="component-title"><h3>${v('name')}</h3><span class="pill code">${v('code')}</span></div>
    <div class="component-sub"><span class="pill main">main</span><span class="measure">${v('measure')}</span><span class="measure pitch-summary" ${row.pitch?'':'hidden'}>· ${v('pitch')}</span></div>
    <div class="card-costs"><span>Materials: <b>${v('material')}</b></span><span>Labour: <b>${v('labour')}</b></span><span>Waste: <b>${v('waste')}</b></span></div>
    <p class="card-notes">${v('notes')}</p>
    <div class="card-actions"><button type="button" class="card-action" data-open-card aria-label="Open and test ${esc(row.name)}">${icon('edit')}Open &amp; test</button></div>`;
}
const numericField = (key,label,unit,prefix='',placeholder='—') => `<label class="field" data-field="${key}"><span class="field-label">${label}</span><span class="number-shell">${prefix?`<span class="prefix">${prefix}</span>`:''}<input data-input="${key}" type="number" min="0" step="any" inputmode="decimal" placeholder="${placeholder}" readonly tabindex="-1" aria-label="${label}${unit?', '+unit:''}"/><span class="unit">${unit}</span></span></label>`;

function settingMarkup(key,label,iconName,placeholder,options,selected) {
  return `<div class="settings-line" data-setting="${key}">
    <span class="label">${icon(iconName)}<span>${label}</span></span>
    <span class="setting-control"><strong class="selection-value ${key==='pitch'?'pitch-rule':''}">${placeholder}</strong>${icon('down')}</span>
    <div class="selection-menu" aria-hidden="true">${options.map(x=>`<div class="selection-option ${x===selected?'chosen':''}"><span>${esc(x)}</span>${x===selected?icon('check'):''}</div>`).join('')}</div>
  </div>`;
}

function template() {
  return `<style>/* QuoteCore+ Smart Components / V4
   Scoped inside a custom element's shadow root. Approved light v2.15 direction.
   No fonts, assets, framework, or network requests are required for playback. */
:host {
  --qc-orange:#FF641F; --qc-orange-core:#FF6B35; --qc-orange-ink:#B63D0A;
  --qc-wash:#FFF4EB; --qc-tint:#FFE6D2; --qc-ink:#191B20; --qc-text:#303641;
  --qc-muted:#596273; --qc-canvas:#F6F7F9; --qc-surface:#FFFFFF; --qc-line:#DDE1E7;
  --qc-control:#7C8798; --qc-danger:#C72B3D;
  --qc-gradient:linear-gradient(135deg,#FF641F 0%,#FF8A3D 55%,#FFB36B 100%);
  --qc-sans:var(--quotecore-font,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);
  display:block; width:100%; min-width:0; container-type:inline-size;
  color:var(--qc-ink); font:14px/1.45 var(--qc-sans); color-scheme:light;
  -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility;
}
*,*::before,*::after { box-sizing:border-box; }
button,input,select { font:inherit; color:inherit; }
button { cursor:pointer; }
button,input,select { -webkit-tap-highlight-color:transparent; }
button { border:0; }
button:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible,[tabindex]:focus-visible {
  outline:2px solid var(--qc-orange-ink); outline-offset:3px;
}
h2,h3,p { margin:0; }
svg { display:block; }
.icon { width:18px; height:18px; flex:none; fill:none; stroke:currentColor; stroke-width:1.7; stroke-linecap:round; stroke-linejoin:round; }
.sr-only { position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0; }
[hidden] { display:none!important; }
.frame { border:1px solid var(--qc-line); border-radius:20px; overflow:hidden; background:var(--qc-surface); box-shadow:0 4px 24px rgba(25,27,32,.035); }
.stage { position:relative; height:538px; background:var(--qc-canvas); isolation:isolate; overflow:hidden; }
.scene { position:absolute; inset:24px; opacity:0; pointer-events:none; will-change:opacity,transform; }
.scene.is-active { pointer-events:auto; }
.two-up { display:grid;grid-template-columns:1fr 1fr;gap:26px; height:100%; align-items:center; }
.panel { min-width:0;position:relative; }
.panel-label { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:12px; height:20px; }
.panel-label h2,.panel-label h3 { font-size:14px;font-weight:650;letter-spacing:-.2px; }
.panel-label .subtle { font-size:11px; }
.subtle,.muted { color:var(--qc-muted); }
.eyebrow { font-size:10px; font-weight:700; letter-spacing:1.1px; text-transform:uppercase; color:var(--qc-orange-ink); }
.pill { display:inline-flex;align-items:center;gap:5px;white-space:nowrap;border-radius:999px;padding:3px 8px;font-size:11px;line-height:1.4; font-weight:550; }
.pill.orange { background:var(--qc-wash); color:var(--qc-orange-ink); border:1px solid var(--qc-tint); }
.pill.neutral { background:#F0F2F5;color:var(--qc-muted); }
.pill.main { background:#FFE9CF; color:#A83408; padding:2px 8px; }
.pill.code { font:11px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace;background:#F0F2F5;color:var(--qc-muted);padding:2px 7px; }
.card { background:white; border:1px solid var(--qc-line); border-radius:16px; }
.btn { display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:40px;padding:9px 13px;border-radius:12px;border:1px solid var(--qc-control);background:white;font-size:12px;font-weight:600;white-space:nowrap; }
.btn.primary { background:var(--qc-gradient);border-color:transparent;color:var(--qc-ink);box-shadow:0 2px 8px rgba(255,100,31,.12); }
.btn.primary:hover { background:linear-gradient(135deg,#FF6B35 0%,#FF923D 55%,#FFBC7A 100%);box-shadow:0 4px 14px rgba(255,107,53,.2); }
.btn.ghost { background:transparent;border-color:var(--qc-line); }
.btn:hover:not(.primary) { background:var(--qc-wash);border-color:#D99271; }
.btn:active { transform:translateY(1px); }
.btn.small { min-height:34px; padding:6px 11px; font-size:11px; }
.icon-btn { width:42px; height:42px; padding:0; border:1px solid transparent; border-radius:12px; background:transparent;display:flex;align-items:center;justify-content:center;flex:none; }
.icon-btn:hover { background:var(--qc-wash); }
.icon-btn.is-primary { background:var(--qc-gradient); }
.icon-btn .icon { width:17px; height:17px; }
.component-title { display:flex;align-items:center;gap:8px;flex-wrap:wrap; }
.component-title h3 { font-size:17px;line-height:1.3;font-weight:650;letter-spacing:-.3px; }
.component-sub { display:flex;flex-wrap:wrap;align-items:center;gap:7px;margin-top:7px; }
.component-sub .measure { color:var(--qc-muted);font-size:12px; }
.editor-card { padding:22px; min-height:438px;position:relative; }
.editor-head { margin-bottom:24px; }
.price-grid { display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:18px; }
.field { display:block;min-width:0; }
.field-label { display:block;font-size:11px;line-height:1.4;font-weight:550;color:var(--qc-muted);margin-bottom:7px; }
.number-shell { display:flex;align-items:center;border:1px solid var(--qc-line);border-radius:10px;background:var(--qc-canvas);height:44px;overflow:hidden;min-width:0; }
.number-shell input { width:100%;min-width:0;outline:none;border:0;background:transparent;font-size:18px;font-weight:550;letter-spacing:-.3px;line-height:1.2;padding:8px 9px;font-variant-numeric:tabular-nums;appearance:textfield; -moz-appearance:textfield; }
.number-shell input::-webkit-inner-spin-button,.number-shell input::-webkit-outer-spin-button { -webkit-appearance:none;margin:0; }
.number-shell .prefix { padding-left:10px;font-size:15px; }
.number-shell .prefix + input { padding-left:3px; }
.number-shell .unit { padding-right:9px;font-size:11px;color:var(--qc-muted);white-space:nowrap; }
.field.is-focus .number-shell,.settings-line.is-focus { border-color:var(--qc-orange);background:var(--qc-wash);box-shadow:0 0 0 3px rgba(255,100,31,.075); }
.number-shell:focus-within { outline:2px solid var(--qc-orange-ink);outline-offset:2px; }
.number-shell input:focus-visible { outline:none; }
.number-shell:has(input[aria-invalid=true]) { border-color:var(--qc-danger); }
.settings-grid { display:grid;gap:10px; }
.settings-line { display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid var(--qc-line);border-radius:10px;padding:11px 12px;min-height:45px; }
.settings-line .label { display:flex;align-items:center;gap:7px;font-size:12px;color:var(--qc-muted); }
.settings-line .label .icon { width:15px;height:15px; }
.settings-line strong { font-size:12px;font-weight:600; }
.editor-bottom { display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:22px; }
.editor-note { font-size:11px;color:var(--qc-muted);max-width:190px; }
.open-test.is-cued,.calculate.is-cued,.create-btn.is-cued { box-shadow:0 0 0 5px rgba(255,100,31,.14),0 4px 18px rgba(255,100,31,.1);border-color:var(--qc-orange); }
.test-card { padding:18px;position:relative;height:438px;overflow:hidden; }
.test-empty { position:absolute;inset:18px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:13px;pointer-events:none; }
.empty-symbol { width:84px;height:70px;border:1px solid var(--qc-line);border-radius:16px;background:var(--qc-canvas);display:grid;place-items:center;transform:rotate(-3deg); }
.empty-symbol .icon { width:33px;height:33px;color:var(--qc-control); }
.test-empty h3 { font-size:17px;letter-spacing:-.3px;font-weight:600; }
.test-empty p { font-size:12px;max-width:270px;color:var(--qc-muted); }
.test-content { opacity:0; }
.test-top { display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px; }
.test-top h3 { font-size:16px;font-weight:650;letter-spacing:-.3px; }
.test-fields { display:grid;grid-template-columns:1fr 1fr;gap:12px; }
.test-fields .field-label { margin-bottom:5px; }
.test-fields .number-shell { height:39px; }
.test-fields .number-shell input { font-size:17px; }
.basis-row { display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:9px; }
.basis-select { min-width:0;max-width:100%;border:0;background:transparent;font-size:11px;color:var(--qc-muted);padding:4px 18px 4px 0;cursor:pointer; }
.basis-label { display:none; }
.add-length { padding:5px 0;border:0;background:none;font-size:11px;color:var(--qc-orange-ink);font-weight:550;white-space:nowrap;min-height:26px; }
.add-length:hover { text-decoration:underline; }
.geometry { display:flex;align-items:center;gap:12px;border-block:1px solid #EDF0F4;margin-top:6px;padding:8px 0;height:73px; }
.roof { width:135px;height:61px;overflow:visible;flex:none; }
.roof text { font-family:var(--qc-sans);font-size:9px;fill:var(--qc-muted); }
.geometry-copy { min-width:0; }
.geometry-copy p { font-size:11px;line-height:1.5; }
.geometry-copy strong { font-weight:650;font-variant-numeric:tabular-nums;color:var(--qc-ink); }
.geometry-copy .geometry-note { font-size:10px;color:var(--qc-muted); }
.result { margin-top:10px;position:relative;min-height:129px; }
.result-main { display:flex;align-items:center;justify-content:space-between;gap:12px; }
.result-kicker { color:var(--qc-muted);font-size:11px; }
.total { font-size:39px;font-weight:650;line-height:1.1;letter-spacing:-1.6px;font-variant-numeric:tabular-nums; }
.total.is-updated { color:var(--qc-orange-ink); }
.result-meta { font-size:10px;color:var(--qc-muted);margin-top:4px; }
.live-badge { display:flex;align-items:center;gap:5px;font-size:10px;color:var(--qc-orange-ink);white-space:nowrap; }
.live-badge .icon { width:13px;height:13px; }
.required { display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:10px;font-size:11px;color:var(--qc-muted); }
.required strong { color:var(--qc-ink);font-weight:650; }
.cost-parts { display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:9px; }
.cost-part { display:flex;justify-content:space-between;gap:8px;font-size:11px; }
.cost-part + .cost-part { border-left:1px solid var(--qc-line);padding-left:16px; }
.cost-part span { color:var(--qc-muted); }
.cost-part strong { font-weight:600;font-variant-numeric:tabular-nums; }
.result-empty { font-size:12px;text-align:center;color:var(--qc-muted);padding:30px 12px 0; }
.errors { margin-top:12px;background:#FFF0F2;color:#9B2332;border-radius:10px;padding:12px;font-size:12px; }
.errors p + p { margin-top:5px; }
.extra-lengths { display:flex;gap:8px;flex-wrap:wrap;max-height:94px;overflow:auto;margin-top:8px; }
.extra-length { display:flex;align-items:center;gap:5px;width:calc(50% - 4px); }
.extra-length .number-shell { height:34px; }
.extra-length .number-shell input { font-size:15px; }
.extra-length button { background:none;border:0;color:var(--qc-muted);width:28px;height:34px;flex:none; }
.exploring .test-card { overflow:auto; }
.exploring .test-content { opacity:1!important; }
.exploring .scene-intro { transform:none!important;opacity:1!important; }
.exploring .number-shell { background:white;border-color:var(--qc-control); }
.exploring .field.is-focus .number-shell { box-shadow:none; }

/* V3: fixed-height stage, small stable headline, no narrative below the action. */
.frame { border-radius:20px;box-shadow:0 4px 24px rgba(25,27,32,.025); }
.story-heading { height:110px;padding:24px 28px 18px;text-align:center;display:flex;flex-direction:column;justify-content:center;gap:7px;background:white; }
.caption-title { font-size:25px;line-height:1.2;font-weight:650;letter-spacing:-.6px; }
.caption-description { font-size:13px;line-height:1.5;color:var(--qc-muted); }
.stage { height:432px;border-top:1px solid #EDF0F4; }
.scene { inset:22px; }
.two-up { gap:28px;align-items:center; }
.card { border-radius:16px; }
.editor-card,.test-card { height:374px;min-height:0; }
.editor-card { padding:22px; }
.test-card { padding:20px; }
.editor-head { margin-bottom:21px; }
.editor-bottom { margin-top:22px; }
.editor-note { max-width:150px; }
.test-empty { inset:20px; }
.empty-symbol { transform:none;background:white;width:62px;height:62px; }
.empty-symbol .icon { width:27px;height:27px; }
.test-top { margin-bottom:15px; }
.test-top h3 { font-size:16px; }
.test-top .btn { min-height:40px; }
.test-fields .number-shell { height:42px; }
.number-shell { font-variant-numeric:tabular-nums; }
.number-shell input { color:var(--qc-ink); }
.settings-panel,.test-panel { will-change:opacity; }
.focus-settings .editor-card,.focus-test .test-card { border-color:#EAB18F;box-shadow:0 0 0 1px rgba(255,100,31,.06); }
.basis-row { display:none; }
.geometry { margin-top:14px;height:70px; }
.geometry-copy .geometry-note { display:none; }
.geometry-copy p { font-size:11px; }
.roof { width:130px; }
.result { margin-top:14px;min-height:132px; }
.total { font-size:42px;letter-spacing:-1.6px; }
.result-kicker { font-size:11px;margin-bottom:3px; }
.result-meta { font-size:10px;margin-top:7px; }
.live-badge { font-size:11px; }
.previous-result { font-size:10px;color:var(--qc-muted);position:absolute;top:-4px;right:0;opacity:0; }
.previous-result s { text-decoration-color:var(--qc-muted); }
.required { display:none; }
.cost-parts { margin-top:14px;padding-top:11px;border-top:1px solid #EDF0F4; }
.result-empty { padding-top:30px; }
.exploring .basis-row { display:flex; }
.exploring .geometry-copy .geometry-note { display:block; }
.exploring .test-card { overflow:auto; }
.exploring .test-empty { opacity:0!important; }
.exploring .editor-card { border-color:var(--qc-line);box-shadow:none; }
.exploring .test-card { border-color:var(--qc-line);box-shadow:none; }
.exploring .previous-result { display:none; }
/* Base sheet styling. V4 extends this to six columns below. */
.sheet-layout { grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);align-items:start;gap:40px;padding-top:9px; }
.sheet-section,.component-section { min-width:0;position:relative; }
.panel-label { margin-bottom:11px; }
.panel-label h3 { font-size:13px;font-weight:600;letter-spacing:-.1px; }
.panel-label .subtle { font-size:11px; }
.sheet-viewport { border:1px solid var(--qc-line);border-radius:10px;overflow:auto;scrollbar-width:none;overscroll-behavior:contain;background:white; }
.sheet-viewport::-webkit-scrollbar { display:none; }
.sheet { border-collapse:separate;border-spacing:0;table-layout:fixed;width:100%;min-width:482px;color:var(--qc-ink);font-size:12px;line-height:1.25; }
.sheet th,.sheet td { padding:0 10px;border-right:1px solid #E2E6EC;border-bottom:1px solid #E2E6EC;height:41px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;vertical-align:middle;font-weight:400; }
.sheet tr:last-child td,.sheet tr:last-child th { border-bottom:0; }
.sheet th:last-child,.sheet td:last-child { border-right:0; }
.sheet .letters td,.sheet .letters th { height:25px;background:#F0F2F5;font-size:11px;text-align:center;color:var(--qc-muted); }
.sheet .headers th:not(.row-num) { background:#FFE8D3;font-size:11px;font-weight:600;height:34px;text-align:left; }
.sheet .headers .row-num { height:34px; }
.sheet .row-num { position:sticky;left:0;z-index:2;background:#F0F2F5;color:var(--qc-muted);width:30px;text-align:center;padding:0;font-size:11px;font-weight:400; }
.sheet tbody tr.is-selected td { background:var(--qc-wash); }
.sheet tbody tr.is-selected .row-num { background:var(--qc-tint);color:var(--qc-orange-ink);font-weight:650;box-shadow:inset 3px 0 0 var(--qc-orange); }
.sheet td.is-focus { background:#FFE3CC!important;box-shadow:inset 0 0 0 1px #FF9C69; }
.sheet td.numeric { text-align:right;font-variant-numeric:tabular-nums; }
/* Same product anatomy as V2. Two quiet examples reinforce the first. */
.component-stack { display:grid;gap:10px; }
.component-card { padding:14px 15px;background:white;border:1px solid var(--qc-line);border-radius:14px;position:relative;min-width:0; }
.component-card .component-title { padding-right:103px;gap:5px; }
.component-card .component-title h3 { font-size:14px;letter-spacing:-.15px; }
.component-card .pill.code { font-size:10px; }
.component-card .component-sub { margin-top:6px;gap:5px; }
.component-card .pill.main { font-size:10px; }
.component-card .measure { font-size:10px; }
.card-costs { display:flex;flex-wrap:wrap;gap:3px 9px;font-size:11px;color:var(--qc-muted);margin-top:8px;line-height:1.5; }
.card-costs b { font-weight:500;color:var(--qc-text); }
.card-notes { font-style:italic;font-size:10px;line-height:1.5;color:var(--qc-muted);margin-top:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
.card-actions { position:absolute;top:12px;right:12px;display:flex; }
.card-action { display:inline-flex;align-items:center;justify-content:center;gap:5px;min-height:30px;border:1px solid var(--qc-control);border-radius:9px;padding:5px 8px;font-size:10px;font-weight:550; }
.card-action .icon { width:12px;height:12px; }
.card-action.delete { display:none; }
.companion-card .card-notes { display:none; }
.companion-card .component-title { padding-right:0; }
.companion-card .card-actions { display:none; }
.companion-card { padding-block:12px; }
.component-card.is-linked { border-color:#F0B185; }
.target { border-radius:3px;box-decoration-break:clone;-webkit-box-decoration-break:clone; }
.target.is-focus { background:var(--qc-tint);box-shadow:0 0 0 3px var(--qc-tint);color:var(--qc-orange-ink); }
.connections { position:absolute;inset:0;z-index:3;pointer-events:none;width:100%;height:100%;overflow:visible; }
/* Import is an aside, not another scene or a simulated upload. */
.import-note { position:absolute;top:calc(100% + 25px);left:0;right:0;display:flex;gap:12px;align-items:flex-start;padding:17px;background:white;border:1px solid var(--qc-line);border-radius:12px;opacity:0; }
.import-icon { width:32px;height:37px;display:grid;place-items:center;background:var(--qc-wash);border-radius:8px;color:var(--qc-orange-ink);flex:none; }
.import-icon .icon { width:19px;height:19px; }
.import-note p { color:var(--qc-muted);font-size:12px;line-height:1.55; }
.import-note p:first-child { color:var(--qc-ink);margin-bottom:5px;font-size:13px; }
.import-note b { color:var(--qc-text);font-weight:600; }
/* Only playback below the image: no numbered captions, tabs or timers. */
.transport { height:54px;padding:5px 14px;display:flex;align-items:center;gap:10px;border-top:1px solid var(--qc-line);background:white; }
.icon-btn { width:42px;height:42px;min-width:42px;border-radius:10px; }
.icon-btn .icon { width:17px;height:17px; }
.timeline { --progress:0%;width:100%;min-width:30px;margin:0;height:32px;background:transparent;appearance:none;-webkit-appearance:none;cursor:pointer;border:0; }
.timeline::-webkit-slider-runnable-track { height:3px;border-radius:2px;background:linear-gradient(to right,var(--qc-orange) 0 var(--progress),#E3E7EC var(--progress) 100%); }
.timeline::-moz-range-track { height:3px;border-radius:2px;background:linear-gradient(to right,var(--qc-orange) 0 var(--progress),#E3E7EC var(--progress) 100%); }
.timeline::-webkit-slider-thumb { -webkit-appearance:none;width:9px;height:9px;margin-top:-3px;background:var(--qc-orange);border:0;border-radius:50%; }
.timeline::-moz-range-thumb { width:9px;height:9px;background:var(--qc-orange);border:0;border-radius:50%; }
.timeline:focus-visible { outline-offset:0; }
.continue-story { flex:none; }
@container (max-width:1050px) and (min-width:841px) {
 .scene { inset:18px; }.two-up { gap:22px; }.editor-card,.test-card { padding:17px; }
 .sheet-layout { gap:26px; }.price-grid { gap:8px; }.number-shell input { font-size:17px; }
 .component-card .component-title { padding-right:0; }.card-actions { display:none; }
 .editor-note { max-width:122px; }.geometry { gap:8px; }.roof { width:115px; }
 .panel-label .subtle { font-size:10px; }.card-costs { gap:3px 7px; }
}
/* Mobile composition shares the timeline, not the desktop dimensions. */
@container (max-width:840px) {
 .story-heading { height:106px;padding:18px 18px 15px;gap:7px; }
 .caption-title { font-size:22px;letter-spacing:-.5px; }.caption-description { font-size:12px; }
 .stage { height:554px; }.scene { inset:14px; }
 .two-up { grid-template-columns:minmax(0,1fr);gap:12px;align-content:start;align-items:start;max-width:600px;margin:0 auto; }
 .editor-card { height:191px;padding:14px; }
 .editor-head { margin-bottom:12px;padding-right:112px; }
 .component-title h3 { font-size:16px; }.editor-head .component-sub { margin-top:6px; }
 .editor-head .measure { display:none; }
 .open-test { position:absolute;top:14px;right:14px;min-height:42px;font-size:11px;padding:8px 10px; }
 .editor-note { display:none; }.editor-bottom { margin:0; }
 .price-grid { gap:9px;margin-bottom:11px; }
 .field-label { font-size:11px;margin-bottom:5px; }
 .number-shell { height:39px;border-radius:9px; }.number-shell input { font-size:18px; }
 .settings-grid { grid-template-columns:1fr 1fr;gap:8px; }
 .settings-line { padding:6px 9px;min-height:34px;gap:5px; }
 .settings-line .label>span { display:none; }.settings-line strong { font-size:10px; }
 .settings-line .label .icon { width:13px;height:13px; }
 .test-card { height:323px;padding:15px; }
 .test-top { margin-bottom:11px; }.test-top .btn { min-height:40px;font-size:11px; }.test-top h3 { font-size:15px; }
 .test-fields { gap:10px; }.test-fields .number-shell { height:38px; }
 .geometry { height:59px;margin-top:10px;padding:6px 0;gap:12px; }.roof { width:115px;height:54px; }
 .geometry-copy p { font-size:11px; }
 .result { margin-top:12px;min-height:110px; }.total { font-size:35px;letter-spacing:-1.1px; }
 .result-kicker { font-size:11px; }.result-meta { font-size:9px;margin-top:4px; }
 .live-badge { font-size:10px; }.live-badge .icon { width:12px;height:12px; }
 .cost-parts { margin-top:11px;padding-top:9px;gap:12px;font-size:10px; }
 .cost-part + .cost-part { padding-left:12px; }.previous-result { font-size:9px;top:-3px; }
 .sheet-layout { gap:23px;padding:0; }.sheet-layout .panel-label { height:18px;margin-bottom:9px; }
 .sheet { width:482px; }.sheet th,.sheet td { height:36px; }.sheet .headers th { height:32px!important; }
 .sheet .letters th,.sheet .letters td { height:24px; }
 .component-stack { gap:8px; }.component-card { padding:12px 14px; }
 .mapping-target { min-height:123px; }
 .component-card .component-title h3 { font-size:14px; }
 .component-card .component-sub { margin-top:7px; }
 .card-notes { margin-top:7px; }.card-costs { margin-top:8px; }
 .companion-card { padding:10px 14px;min-height:63px; }
 .companion-card .card-costs { display:none; }
 .import-note { top:26px;bottom:0;align-items:center;padding:18px;gap:13px; }
 .import-note p { font-size:12px; }.import-note p:first-child { font-size:14px; }
 .frame.closing .sheet-viewport,.frame.closing .sheet-section>.panel-label { opacity:calc(1 - var(--close-reveal,0)); }
 .transport { padding:5px 9px;height:54px;gap:8px; }
 .transport .icon-btn { min-width:44px;min-height:44px; }
 .exploring .test-card { height:323px; }
 .exploring .open-test { display:none; }.exploring .editor-head { padding-right:0; }
 .continue-story { font-size:10px;padding:7px 9px;min-height:40px; }
}
@container (max-width:500px) {
 .frame { border-radius:16px; }.stage { height:553px; }.scene { inset:12px; }
 .caption-title { font-size:20px; }.caption-description { font-size:11px; }
 .component-card .component-title { padding-right:92px; }
 .companion-card .component-title { padding-right:0; }
 .card-action { font-size:9px;padding:5px 7px; }.card-actions { top:11px;right:11px; }
 .card-costs { font-size:10px;gap:4px 7px; }.component-card .measure { font-size:10px; }
}
@container (max-width:360px) {
 .story-heading { height:116px;padding:16px 12px; }
 .caption-title { font-size:19px; }.caption-description { max-width:265px;align-self:center; }
 .scene { inset:10px; }.stage { height:561px; }.editor-card { padding:12px;height:189px; }
 .editor-head { padding-right:95px; }.component-title h3 { font-size:14px; }
 .editor-head .pill { font-size:9px; }.open-test { right:11px;top:12px;font-size:10px;padding:7px;gap:5px; }.open-test .icon { width:14px; }
 .price-grid { gap:6px; }.number-shell .prefix { padding-left:8px; }.number-shell .unit { padding-right:7px;font-size:10px; }
 .number-shell input { font-size:16px; }.settings-line { padding:6px; }.settings-line strong { font-size:9px; }
 .test-card { padding:12px;height:329px; }.test-top h3 { font-size:13px; }.test-top .btn { font-size:10px;padding:7px 8px;gap:5px; }
 .geometry { gap:8px; }.geometry-copy p { font-size:10px; }.roof { width:99px; }
 .cost-part { font-size:10px;gap:5px; }.cost-parts { gap:9px; }.cost-part + .cost-part { padding-left:9px; }
 .total { font-size:32px; }.live-badge { font-size:9px; }
 .component-card { padding:11px 12px; }.component-card .component-title { padding-right:0; }.card-actions { display:none; }
 .component-card .component-title h3 { font-size:13px; }.component-card .measure { font-size:9px; }
 .companion-card { min-height:65px; }.import-note { padding:15px;gap:9px; }
}
@media (prefers-reduced-motion:reduce) {
 .scene,.settings-panel,.test-panel { will-change:auto; }.btn:active { transform:none; }.connections { display:none!important; }
}
@media (forced-colors:active) {
 .btn,.pill,.icon-btn,.number-shell { border:1px solid ButtonText; }
 .target.is-focus,.sheet td.is-focus { outline:2px solid Highlight; }
 .timeline { forced-color-adjust:none; }
}

/* Final spacing pass: retain breathing room below the cost breakdown. */
.geometry { height:60px; margin-top:11px; }
.result { margin-top:11px; }
.cost-parts { margin-top:10px;padding-top:9px; }
@container (max-width:840px) {
 .open-test,.test-top .btn,.continue-story { min-height:44px; }
 .geometry { height:52px; margin-top:9px; }
 .result { margin-top:9px; }
 .cost-parts { margin-top:8px;padding-top:7px; }
}

.card-action { background:white; color:var(--qc-ink); cursor:pointer; }
@container (max-width:840px) { .card-action { min-height:44px; } }

/* V4 — restore the demonstration, keep the quiet V3 composition.
   Decorative changes are deliberately small and never add another narration layer. */
.frame { box-shadow:0 8px 30px rgba(25,27,32,.045),0 1px 3px rgba(25,27,32,.025); }
.stage { background:radial-gradient(ellipse at 8% 4%,rgba(255,230,210,.21),transparent 52%),var(--qc-canvas); }
.card,.component-card { box-shadow:0 2px 8px rgba(25,27,32,.025); }
.story-heading { background:linear-gradient(180deg,#fff 80%,#FFFDFA); }
.caption-title { font-size:26px;letter-spacing:-.7px; }
.editor-card { overflow:visible; }
.focus-settings .editor-card,.focus-test .test-card {
 border-color:#E9AF8D;box-shadow:0 3px 16px rgba(25,27,32,.04),inset 0 2px 0 rgba(255,100,31,.12);
}
.settings-panel { z-index:2; }
.test-panel { z-index:1; }
.number-shell { background:linear-gradient(180deg,#FAFBFC,#F6F7F9); }
.number-shell input::placeholder { color:#9DA5B1;opacity:1;font-weight:400; }
.field.is-focus .number-shell,.settings-line.is-focus {
 background:#FFF8F2;border-color:#FF9B64;box-shadow:0 0 0 3px rgba(255,100,31,.065);
}
.settings-line { position:relative;isolation:auto; }
.setting-control { display:flex;align-items:center;justify-content:flex-end;gap:8px;min-width:0; }
.setting-control>.icon { width:13px;height:13px;color:#7C8798; }
.selection-value { white-space:nowrap; }
.settings-line:not(.has-value) .selection-value { font-weight:400;color:#828B99; }
.selection-menu { position:absolute;top:calc(100% + 5px);right:0;z-index:10;width:205px;padding:5px;border:1px solid var(--qc-line);background:white;border-radius:10px;box-shadow:0 8px 24px rgba(25,27,32,.10);opacity:0;visibility:hidden;pointer-events:none; }
.settings-line.is-open { z-index:5; }
.settings-line.is-open .selection-menu { visibility:visible; }
.selection-option { display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:12px;line-height:1.4;padding:7px 9px;min-height:30px;border-radius:6px;color:var(--qc-text); }
.selection-option>.icon { width:13px;height:13px;opacity:0; }
.selection-menu.has-selection .chosen { background:var(--qc-wash);color:var(--qc-orange-ink); }
.selection-menu.has-selection .chosen>.icon { opacity:1; }
.btn:disabled { cursor:default;transform:none;background:#F0F2F5!important;border-color:var(--qc-line)!important;box-shadow:none!important;color:#768091; }
.open-test.is-cued,.calculate.is-cued { box-shadow:0 0 0 4px rgba(255,100,31,.1),0 4px 12px rgba(255,100,31,.1); }
.live-badge { padding:4px 7px;background:#FFF5EC;border-radius:7px;border:1px solid #FFE8D4;font-size:10px; }
.result-main { border-radius:10px;background:rgba(255,230,210,calc(var(--result-emphasis,0) * .24)); }
.total { letter-spacing:-1.5px; }
.sheet-layout { grid-template-columns:minmax(0,1.38fr) minmax(0,1fr);gap:38px; }
.sheet { width:100%;min-width:696px; }
.sheet th,.sheet td { padding-inline:9px; }
.sheet .headers th:not(.row-num) { background:linear-gradient(180deg,#FFEBDB,#FFE6D2); }
.sheet td[data-cell$="-measure"],.sheet td[data-cell$="-pitch"] { font-size:11px; }
.sheet td.is-transferring>span { opacity:.38; }
.sheet td.is-focus { box-shadow:inset 0 0 0 1.5px #FF9B64; }
.component-card { border-radius:14px; }
.component-card.is-linked { border-color:#F0AC80;box-shadow:0 2px 10px rgba(255,100,31,.045); }
.target { display:inline-block;vertical-align:baseline; }
.target.is-pending { color:transparent!important;background:#EDF0F3;border-radius:4px;box-shadow:none;user-select:none; }
.target.is-pending.is-focus { background:#FFE5CE;box-shadow:0 0 0 2px #FFE5CE; }
.target.is-focus:not(.is-pending) { background:#FFF0E2;box-shadow:0 0 0 3px #FFF0E2; }
.flying-value { position:absolute;z-index:5;top:0;left:0;transform:translate(-50%,-50%);pointer-events:none;display:flex;align-items:center;gap:8px;max-width:calc(100% - 20px);padding:7px 10px 7px 6px;background:#FFFDFC;border:1px solid #FFA369;border-radius:9px;box-shadow:0 4px 14px rgba(25,27,32,.09),0 1px 3px rgba(255,100,31,.08);opacity:0;white-space:nowrap;font-size:12px;line-height:1.3;font-weight:550;will-change:transform,opacity,left,top; }
.flight-letter { display:grid;place-items:center;width:22px;height:22px;background:#FFE6D2;border-radius:5px;color:var(--qc-orange-ink);font-size:10px;font-weight:650;flex:none; }
.flight-text { overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums; }
.card-action:disabled { cursor:default; }
.import-note { background:linear-gradient(110deg,#FFFCF9,white);box-shadow:0 2px 8px rgba(25,27,32,.02); }
@container (max-width:1050px) and (min-width:841px) {
 .sheet-layout { gap:26px;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr); }
 .settings-line { padding:10px 9px;gap:7px; }
 .settings-line .label { gap:5px;font-size:11px; }
 .settings-line strong { font-size:11px; }.setting-control { gap:4px; }
 .live-badge { font-size:9px;gap:3px;padding:4px 5px; }
}
@container (max-width:840px) {
 .caption-title { font-size:22px;letter-spacing:-.5px; }
 .sheet-layout { grid-template-columns:minmax(0,1fr);gap:23px; }
 .sheet { width:696px; }
 .setting-control { gap:4px; }.setting-control>.icon { width:11px;height:11px; }
 .settings-line { gap:4px; }.settings-line strong { font-size:10px; }
 .selection-menu { width:185px; }.selection-option { font-size:11px;padding:7px 8px; }
 .selection-menu .icon { width:12px; }.settings-line[data-setting="measure"] .selection-menu { left:0;right:auto; }
 .mapping-target { min-height:138px; }
 .component-card .component-sub { gap:4px 5px; }
 .flying-value { font-size:11px;padding:6px 8px 6px 5px;gap:6px; }
 .flight-letter { width:21px;height:21px; }
 .live-badge { font-size:9px;padding:3px 5px; }
}
@container (max-width:500px) {
 .caption-title { font-size:20px; }
 .component-card .component-title { padding-right:0; }
 .mapping-target .component-title { padding-right:94px; }
 .component-card .component-sub { gap:4px; }
}
@container (max-width:360px) {
 .caption-title { font-size:19px; }
 .setting-control { gap:3px; }.setting-control>.icon { width:9px; }
 .settings-line .label .icon { width:11px; }.settings-line { padding:6px 5px; }
 .settings-line strong { font-size:9px; }
 .selection-menu { width:174px; }
 .mapping-target .component-title { padding-right:0; }
}
@media (prefers-reduced-motion:reduce) {
 .connections,.flying-value,.selection-menu { display:none!important; }
 .flying-value { will-change:auto; }
}
/* Keep the two rule names readable on phones, not icon-only. The stage reserves
   these extra 22–24 px for the whole loop, so no chapter changes the page height. */
@container (max-width:840px) {
 .stage { height:576px; }
 .editor-card { height:213px; }
 .settings-line { flex-direction:column;align-items:stretch;justify-content:center;min-height:50px;padding:5px 8px;gap:3px; }
 .settings-line .label { gap:4px;font-size:9px;line-height:12px; }
 .settings-line .label>span { display:inline; }
 .settings-line .label .icon { width:11px;height:11px; }
 .setting-control { width:100%;justify-content:space-between;gap:4px; }
 .selection-value { line-height:14px; }
 .settings-grid { gap:8px; }
}
@container (max-width:500px) { .stage { height:575px; } }
@container (max-width:360px) {
 .stage { height:585px; }.editor-card { height:213px; }
 .settings-line { padding:5px 7px; }.settings-line .label { font-size:9px; }
 .settings-line strong { font-size:9px; }
}

/* Website edition: Dark Focus chrome, unchanged light application surfaces. */
:host {
  --qc-focus-canvas:#0B0D10;
  --qc-focus-surface:#12151A;
  --qc-focus-raised:#181C22;
  --qc-focus-text:#F7F8FA;
  --qc-focus-muted:#A8B0BC;
}
.frame { border:0;border-radius:0;box-shadow:none;background:transparent; }
.story-heading {
  height:106px;padding:20px 28px 25px;gap:9px;
  background:transparent;color:var(--qc-focus-text);
}
.caption-title { text-wrap:balance;font-size:26px;font-weight:600;letter-spacing:-.65px;line-height:1.2; }
.caption-description { color:#B6BDC8;font-size:13px;line-height:1.5; }
.tm { font-size:.62em;line-height:0;vertical-align:super;margin-left:.06em;font-weight:550;letter-spacing:0; }
.stage {
  margin-inline:10px;border:1px solid rgba(255,255,255,.14);border-radius:14px;
  background:radial-gradient(ellipse at 2% 0%,rgba(255,230,210,.38),transparent 57%),linear-gradient(145deg,#FAFAFB 0%,#F6F7F9 100%);
}
.editor-card,.test-card,.component-card {
  box-shadow:0 5px 18px rgba(25,27,32,.035),0 1px 2px rgba(25,27,32,.025);
}
.focus-settings .editor-card,.focus-test .test-card {
  border-color:#E5AB86;
  box-shadow:0 4px 20px rgba(25,27,32,.04),inset 0 2px 0 rgba(255,138,61,.2);
}
.empty-symbol { background:linear-gradient(145deg,#FFF4EB,#FFFFFF 78%);border-color:#E8DDD4; }
.empty-symbol .icon { color:var(--qc-orange-ink); }
.btn.primary { background:linear-gradient(135deg,#FF641F 0%,#FF8A3D 55%,#FFB36B 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.38),0 3px 8px rgba(255,100,31,.12); }
.import-note { background:linear-gradient(120deg,#FFF4EB 0%,#FFFDFA 62%,#FFFFFF 100%);border-color:#E8DDD4; }
.transport { height:56px;padding:6px 16px;gap:12px;background:var(--qc-focus-surface);border:0;color:var(--qc-focus-text); }
.transport .icon-btn { min-height:44px;width:44px;min-width:44px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.045);border-radius:11px; }
.transport .icon-btn:hover { background:rgba(255,255,255,.10);border-color:rgba(255,179,107,.55); }
.transport .icon-btn:focus-visible,.transport .timeline:focus-visible,.transport .continue-story:focus-visible { outline:2px solid #FFB36B;outline-offset:3px; }
.transport .timeline { height:44px; }
.transport .timeline::-webkit-slider-runnable-track { height:3px;background:linear-gradient(to right,#FF8A3D 0 var(--progress),#505762 var(--progress) 100%); }
.transport .timeline::-moz-range-track { height:3px;background:linear-gradient(to right,#FF8A3D 0 var(--progress),#505762 var(--progress) 100%); }
.transport .timeline::-webkit-slider-thumb { background:#FFB36B;width:10px;height:10px;margin-top:-3.5px; }
.transport .timeline::-moz-range-thumb { background:#FFB36B;width:10px;height:10px; }
.transport .continue-story { border-color:rgba(255,255,255,.22);background:rgba(255,255,255,.065);color:var(--qc-focus-text);min-height:44px; }
.transport .continue-story:hover { background:rgba(255,255,255,.1);border-color:rgba(255,179,107,.55); }
.playback-time { font-size:10px;color:var(--qc-focus-muted);white-space:nowrap;font-variant-numeric:tabular-nums;letter-spacing:.15px; }
.exploring .playback-time { display:none; }
@container (max-width:840px) {
 .story-heading { height:106px;padding:18px 20px 20px;gap:8px; }
 .caption-title { font-size:23px; }
 .stage { margin-inline:6px;border-radius:12px; }
 .transport { padding:6px 10px;gap:10px; }
}
@container (max-width:500px) {
 .story-heading { height:128px;padding:18px 20px 22px;gap:8px; }
 .caption-title { font-size:22px;line-height:1.17; }
 .caption-description { font-size:12px;line-height:1.55;max-width:300px;margin-inline:auto; }
 .stage { margin:0;border-inline:0;border-radius:0; }
 .transport { height:56px;padding:6px 9px;gap:8px; }
 .playback-time { font-size:9px; }
 .transport .continue-story { padding-inline:9px;gap:6px;font-size:10px; }
}
@container (max-width:340px) {
 .caption-title { font-size:20px; }
 .caption-description { font-size:11px; }
 .scene { inset:10px; }
 .editor-card { padding:11px; }
 .open-test { right:11px;top:12px;padding:7px 8px;font-size:10px;gap:5px; }
 .editor-head { padding-right:105px; }
 .component-title h3 { font-size:15px; }
 .price-grid { gap:7px; }
 .number-shell input { font-size:16px; }
 .number-shell .prefix { padding-left:6px;font-size:13px; }
 .number-shell .unit { padding-right:6px;font-size:10px; }
 .settings-line { padding:5px 6px; }
 .panel-label h3 { font-size:12px; }
 .panel-label .subtle { font-size:9px; }
 .transport .playback-time { display:none; }
}
@media (prefers-reduced-motion:reduce) {
 .story-heading { opacity:1!important; }
}
@media (prefers-contrast:more) {
 .caption-description { color:var(--qc-focus-text); }
 .transport .icon-btn { border-color:var(--qc-focus-text); }
}
@media (forced-colors:active) {
 .story-heading,.frame,.transport { background:Canvas;color:CanvasText; }
 .caption-description,.playback-time { color:CanvasText; }
 .transport .icon-btn,.transport .continue-story { background:ButtonFace;color:ButtonText;border:1px solid ButtonText; }
 .stage { border:1px solid CanvasText;background:Canvas; }
 .transport .timeline { forced-color-adjust:auto; }
 .transport .timeline::-webkit-slider-runnable-track { background:GrayText; }
 .transport .timeline::-webkit-slider-thumb { background:Highlight; }
}

.story-heading:focus-visible { outline:2px solid #FFB36B;outline-offset:-4px; }

/* Glint on play and replay controls. */
.transport .icon-btn { position:relative;overflow:hidden;isolation:isolate; }
.transport .icon-btn::after { content:"";position:absolute;top:-55%;bottom:-55%;left:-65%;width:46%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.34),transparent);transform:skewX(-25deg);pointer-events:none;opacity:0; }
.transport .icon-btn:hover::after,.transport .icon-btn:focus-visible::after { opacity:1;animation:qc-transport-glint .72s ease-out both; }
@keyframes qc-transport-glint { from {left:-65%;} to {left:145%;} }
@media (prefers-reduced-motion:reduce) { .transport .icon-btn::after { animation:none!important;opacity:0!important; } }
</style>
  <div class="frame">
    <header class="story-heading" tabindex="-1">
      <h2 class="caption-title">Your pricing. Our calculations.</h2>
      <p class="caption-description">Bring your knowledge. Smart Components™ do the maths.</p>
    </header>
    <div class="stage" aria-label="Smart Components™ interactive demonstration">
      <section class="scene scene-intro" aria-label="Create and test a Smart Component™">
        <div class="two-up intro-layout">
          <div class="panel settings-panel">
            <div class="card editor-card">
              <header class="editor-head"><div class="component-title"><h3>Barge Flashing</h3></div><div class="component-sub"><span class="pill code">BAR-001</span><span class="pill main">main</span><span class="measure">Your pricing, your settings</span></div></header>
              <div class="price-grid">${numericField('materialRate','Materials','/m','$')}${numericField('labourRate','Labour','/m','$')}${numericField('wastePercent','Waste','%')}</div>
              <div class="settings-grid">
                ${settingMarkup('measure','Measurement','ruler','Choose type…',['Area (m²)','Linear: Single (m)','Quantity'],'Linear: Single (m)')}
                ${settingMarkup('pitch','Pitch rule','roof','Choose rule…',['None','Rafter Pitch','Valley/Hip Pitch'],'Rafter Pitch')}
              </div>
              <div class="editor-bottom"><p class="editor-note">Your rates. Your allowances.</p><button type="button" class="btn primary open-test" aria-label="Open and test this example">${icon('edit')}<span>Open &amp; test</span></button></div>
            </div>
          </div>
          <div class="panel test-panel">
            <div class="card test-card">
              <div class="test-empty" aria-hidden="true"><div class="empty-symbol">${icon('calculator')}</div><h3>Test and fine-tune</h3><p>Try a measurement before using it on a job.</p></div>
              <div class="test-content">
                <div class="test-top"><h3>Test and fine-tune</h3><button type="button" class="btn primary small calculate">${icon('calculator')}<span>Calculate</span></button></div>
                <div class="test-fields">${numericField('length','Test length · plan','m')}${numericField('pitchDegrees','Rafter pitch','°')}</div>
                <div class="extra-lengths"></div>
                <div class="basis-row"><select class="basis-select" aria-label="Measurement basis" tabindex="-1" disabled><option value="plan">Plan measurement · apply pitch</option><option value="surface">Already measured on the slope</option></select><button type="button" class="add-length" tabindex="-1">+ Add a length</button></div>
                <div class="geometry" aria-hidden="true">
                  <svg class="roof" viewBox="0 0 150 78"><path class="roof-fill" d="M14 57L108 57L108 11Z" fill="#FFF4EB"/><path class="roof-base" d="M14 57H108" fill="none" stroke="#9CA5B3" stroke-width="1.1" stroke-dasharray="3 3"/><path class="roof-rise" d="M108 57V11" fill="none" stroke="#DDE1E7" stroke-width="1.1"/><path class="roof-slope" d="M14 57L108 11" fill="none" stroke="#FF641F" stroke-width="3" stroke-linecap="round"/><circle cx="14" cy="57" r="3" fill="#FF641F"/><circle class="roof-end" cx="108" cy="11" r="3" fill="#FF641F"/><text class="roof-plan-label" x="61" y="73" text-anchor="middle">10 m plan</text><text class="roof-angle" x="36" y="50">25°</text></svg>
                  <div class="geometry-copy"><p class="geometry-main">Plan length <strong>→ on-slope length</strong></p><p class="geometry-note">The pitch rule handles the difference.</p></div>
                </div>
                <div class="result-empty">Enter a measurement, then calculate.</div>
                <div class="result"><p class="previous-result" aria-hidden="true">Previously <s>$341.77</s></p>
                  <div class="result-main"><div><p class="result-kicker">Component cost</p><p class="total">$341.77</p><p class="result-meta">Example cost · before margin &amp; tax</p></div><span class="live-badge">${icon('check')}<span>Calculated</span></span></div>
                  <div class="required"><span class="required-label">With 5% waste</span><strong class="required-value">11.585 m required</strong></div>
                  <div class="cost-parts"><div class="cost-part"><span>Materials</span><strong class="material-total">$278.05</strong></div><div class="cost-part"><span>Labour</span><strong class="labour-total">$63.72</strong></div></div>
                </div>
                <div class="errors" role="status" hidden></div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section class="scene scene-sheet" aria-label="Three pricing rows, three Smart Components™" inert>
        <div class="two-up sheet-layout">
          <div class="sheet-section">
            <div class="panel-label"><h3>Spreadsheet</h3><span class="subtle">One item per row</span></div>
            <div class="sheet-viewport" tabindex="0" aria-label="Spreadsheet with three horizontal pricing rows. Scroll horizontally for more columns.">
              <table class="sheet"><colgroup><col style="width:28px">${QC_FIELDS.map(f=>`<col style="width:${f.width}px">`).join('')}</colgroup>
                <thead><tr class="letters"><td class="row-num"></td>${QC_FIELDS.map(f=>`<th scope="col">${f.letter}</th>`).join('')}</tr>
                <tr class="headers"><th class="row-num" scope="row">1</th>${QC_FIELDS.map(f=>`<th scope="col">${f.heading}</th>`).join('')}</tr></thead>
                <tbody>${QC_DATA.map((row,i)=>`<tr data-row="${i}"><th scope="row" class="row-num">${i+2}</th>${QC_FIELDS.map(f=>`<td data-cell="${i}-${f.key}" class="${['material','labour','waste'].includes(f.key)?'numeric':''}" title="${esc(rowValue(row,f.key))}"><span>${esc(rowValue(row,f.key))}</span></td>`).join('')}</tr>`).join('')}</tbody>
              </table>
            </div>
            <aside class="import-note" aria-label="Optional spreadsheet import" hidden>
              <span class="import-icon" aria-hidden="true">${icon('file')}</span>
              <div><p><strong>Already have a spreadsheet?</strong></p><p>Import up to <b>20 rows</b> to pre-fill components.<br>Then finish their settings.</p></div>
            </aside>
          </div>
          <div class="component-section">
            <div class="panel-label"><h3>Smart Components™</h3><span class="subtle">Calculations built in</span></div>
            <div class="component-stack">
              ${QC_DATA.map((row,i)=>`<article class="component-card ${i===0?'mapping-target':'companion-card'}" data-card="${i}" aria-label="${esc(row.name)}">${cardMarkup(row,i,i===0?28:undefined)}</article>`).join('')}
            </div>
          </div>
        </div>
      </section>
      <svg class="connections" aria-hidden="true"><path class="connection-path" fill="none" stroke="#FF641F" stroke-width="1.7" stroke-linecap="round" opacity="0"/><circle class="connection-dot" r="3.5" fill="#FF641F" opacity="0"/></svg>
      <div class="flying-value" aria-hidden="true"><span class="flight-letter"></span><span class="flight-text"></span></div>
    </div>
    <div class="transport" aria-label="Animation playback">
      <button type="button" class="icon-btn play-toggle" aria-label="Pause animation">${icon('pause')}</button>
      <input type="range" class="timeline" min="0" max="37.5" step="0.05" value="0" aria-label="Animation position" aria-valuetext="0 seconds of 37.5 seconds"/>
      <span class="playback-time" aria-hidden="true">0:00 / 0:38</span>
      <button type="button" class="icon-btn replay" aria-label="Replay from the beginning">${icon('replay')}</button>
      <button type="button" class="btn small continue-story" hidden>Continue story ${icon('arrow')}</button>
    </div>
    <p class="sr-only transcript">A Smart Component™ is a reusable pricing item. Enter material and labour rates, choose measurement, waste and pitch settings, and test it with a job measurement. This demonstration uses a 10 metre plan length, 25 degree rafter pitch and 5 percent waste. Changing the material rate updates the test. A spreadsheet row holds similar information across its columns; Smart Components™ handle the calculation rather than requiring you to create formulas. You can also import up to 20 spreadsheet rows at a time to pre-fill components. Review measurement, purchasing, waste and pitch before quoting. This is a local example, not a live import, save, quote or production pricing engine.</p>
    <p class="sr-only announcer" aria-live="polite" aria-atomic="true"></p>
  </div>`;
}

class QuoteCoreSmartComponents extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode:'open'});
    this.shadowRoot.innerHTML=template();
    styleBrandMarks(this.shadowRoot);
    this.$ = selector => this.shadowRoot.querySelector(selector);
    this.$$ = selector => [...this.shadowRoot.querySelectorAll(selector)];
    this.t=0;this.speed=1;this.playRequested=false;this.inView=true;this.parentVisible=true;
    this.exploring=false;this._raf=0;this._last=0;this._lastRow=-1;this._lastRate=-1;this._lastChapter=-1;
    this._lastCaption='';this._scrollManual=false;this._connected=false;this._readyResolved=false;
    this._reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
    this.reducedMotion=this._reduced.matches;
    this.ready=new Promise(resolve=>{this._resolveReady=resolve;});
    this.r={};
    const selectors={frame:'.frame',stage:'.stage',intro:'.scene-intro',sheetScene:'.scene-sheet',
      heading:'.story-heading',settingsPanel:'.settings-panel',testPanel:'.test-panel',
      openTest:'.open-test',calculate:'.calculate',editorNote:'.editor-note',testContent:'.test-content',testEmpty:'.test-empty',
      basis:'.basis-select',addLength:'.add-length',extras:'.extra-lengths',result:'.result',resultEmpty:'.result-empty',errors:'.errors',
      total:'.total',materialTotal:'.material-total',labourTotal:'.labour-total',required:'.required-value',requiredLabel:'.required-label',
      geometryMain:'.geometry-main',geometryNote:'.geometry-note',geometry:'.geometry',liveBadge:'.live-badge span',
      source:'.sheet-viewport',table:'.sheet',target:'.mapping-target',
      svg:'.connections',path:'.connection-path',dot:'.connection-dot',importNote:'.import-note',
      flight:'.flying-value',flightLetter:'.flight-letter',flightText:'.flight-text',
      captionTitle:'.caption-title',captionDescription:'.caption-description',continueButton:'.continue-story',
      play:'.play-toggle',replay:'.replay',range:'.timeline',announce:'.announcer'};
    Object.entries(selectors).forEach(([k,v])=>this.r[k]=this.$(v));
    this.inputs=Object.fromEntries(this.$$('[data-input]').map(el=>[el.dataset.input,el]));
    this.cells=QC_DATA.map((_,i)=>QC_FIELDS.map(f=>this.$(`[data-cell="${i}-${f.key}"]`)));
    this.rows=this.$$('[data-row]');
    this.cards=this.$$('[data-card]');
    this.targetFields=QC_FIELDS.map(f=>this.r.target.querySelector(`[data-target="${f.key}"]`));
    this._onVisibility=()=>{this._syncPlayback();};
    this._onMotion=e=>{this.reducedMotion=e.matches;if(e.matches){this.pause();this.seek(QC_TIMING.staticIntro);}this.render();};
    this._wire();
  }
  connectedCallback() {
    if(this._connected)return;
    this._connected=true;
    if(!this._readyResolved) {
      const start=Number(this.getAttribute('start-at'));
      this.t=this.reducedMotion?QC_TIMING.staticIntro:(Number.isFinite(start)?clamp(start,0,QC_TIMING.duration):0);
      this.playRequested=this.hasAttribute('autoplay')&&!this.reducedMotion;
    }
    document.addEventListener('visibilitychange',this._onVisibility);
    this._reduced.addEventListener('change',this._onMotion);
    this._resize=new ResizeObserver(()=>{this.render();this._emitResize();});
    this._resize.observe(this);
    this._intersection=new IntersectionObserver(entries=>{
      this.inView=entries[0].isIntersecting&&entries[0].intersectionRatio>=0.5;
      this._syncPlayback();
    },{threshold:[0,.25,.5,.75]});
    this._intersection.observe(this.r.stage);
    requestAnimationFrame(()=>{
      if(!this._connected)return;
      this.render();this._syncPlayback();this._emitResize();
      if(!this._readyResolved){this._readyResolved=true;this._resolveReady(this);}
    });
  }
  disconnectedCallback() {
    this._connected=false;cancelAnimationFrame(this._raf);this._raf=0;this._last=0;
    this._resize?.disconnect();this._intersection?.disconnect();
    document.removeEventListener('visibilitychange',this._onVisibility);
    this._reduced.removeEventListener('change',this._onMotion);
  }
  _wire() {
    this.r.play.addEventListener('click',()=>{if(this.exploring)this.exitExplore();else if(this.playRequested)this.pause();else this.play();});
    this.r.replay.addEventListener('click',()=>this.replay());
    this.r.range.addEventListener('input',()=>this.seek(Number(this.r.range.value)));
    this.r.continueButton.addEventListener('click',()=>this.exitExplore());
    this.r.openTest.addEventListener('click',()=>this.enterExplore());
    this.$('[data-card="0"] [data-open-card]').addEventListener('click',()=>this.enterExplore());
    this.r.calculate.addEventListener('click',()=>{
      if(!this.exploring)this.enterExplore();
      this._renderManual();this._announceCalculation();
    });
    Object.entries(this.inputs).forEach(([key,el])=>{
      el.addEventListener('focus',()=>{if(!this.exploring)this.enterExplore(false);});
      el.addEventListener('input',()=>{
        if(!this.exploring)return;
        if(key==='length')this.manual.lengths[0]=el.value;else this.manual[key]=el.value;
        this._renderManual();
      });
      el.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();this._renderManual();this._announceCalculation();}});
    });
    this.r.basis.addEventListener('change',()=>{if(this.exploring){this.manual.basis=this.r.basis.value;this._renderManual();}});
    this.r.addLength.addEventListener('click',()=>{
      if(!this.exploring)this.enterExplore(false);
      if(this.manual.lengths.length>=5)return;
      this.manual.lengths.push('5');this._renderExtras();this._renderManual();
      const extra=[...this.r.extras.querySelectorAll('input')].at(-1);extra?.focus({preventScroll:true});
    });
    this.r.extras.addEventListener('input',e=>{
      if(e.target.matches('input[data-length-index]')){this.manual.lengths[Number(e.target.dataset.lengthIndex)]=e.target.value;this._renderManual();}
    });
    this.r.extras.addEventListener('click',e=>{
      const b=e.target.closest('[data-remove]');if(!b)return;
      this.manual.lengths.splice(Number(b.dataset.remove),1);this._renderExtras();this._renderManual();
    });
    const stopScroll=()=>{this._scrollManual=true;this.pause();};
    this.r.source.addEventListener('wheel',stopScroll,{passive:true});
    this.r.source.addEventListener('touchstart',stopScroll,{passive:true});
  }
  _announceCalculation() {
    const value=this.exploring?calculateLinearExample(this.manual):this._demoOutcome(this.t);
    text(this.r.announce,value.ok?`Example component cost ${money(value.result.total)}, before quote margins and tax.`:Object.values(value.errors).join(' '));
  }
  _emitResize() {
    const h=Math.ceil(this.getBoundingClientRect().height);
    if(h===this._lastHeight)return;this._lastHeight=h;
    this.dispatchEvent(new CustomEvent('quotecore-resize',{bubbles:true,composed:true,detail:{height:h}}));
  }
  _emitState() {
    this.dispatchEvent(new CustomEvent('quotecore-state',{bubbles:true,composed:true,detail:this.getState()}));
  }
  get duration(){return QC_TIMING.duration;}
  get playing(){return this.playRequested&&this.inView&&this.parentVisible&&!document.hidden&&!this.exploring&&this._connected;}
  get chapter(){return this.t<QC_TIMING.sheetMessage?0:1;}
  _syncPlayback() {
    cancelAnimationFrame(this._raf);this._raf=0;this._last=0;
    if(this.playing)this._raf=requestAnimationFrame(now=>this._tick(now));
    this._renderTransport();
  }
  _tick(now) {
    if(!this.playing){this._raf=0;return;}
    if(this._last) this.t+=Math.min((now-this._last)/1000,.15)*this.speed;
    this._last=now;
    if(this.t>=this.duration){
      if(this.hasAttribute('loop')){this.t%=this.duration;this._scrollManual=false;}
      else{this.t=this.duration;this.playRequested=false;}
    }
    this.render();
    this._raf=this.playing?requestAnimationFrame(n=>this._tick(n)):0;
  }
  play() {
    if(this.exploring){this.exitExplore();return;}
    if(this.t>=this.duration)this.t=0;
    this.playRequested=true;this._scrollManual=false;this._syncPlayback();this._emitState();
  }
  pause() {this.playRequested=false;this._syncPlayback();this._emitState();}
  replay() {this._leaveExplore();this.t=0;this._scrollManual=false;this.playRequested=true;this.render();this._syncPlayback();this._emitState();}
  seek(seconds,options={}) {
    if(!Number.isFinite(Number(seconds)))return;
    this._leaveExplore();this.t=clamp(Number(seconds),0,this.duration);this._scrollManual=false;
    this.playRequested=options.play===true;this.render();this._syncPlayback();this._emitState();
  }
  jumpTo(chapter) {
    if(![0,1].includes(chapter))return;
    this.seek(QC_TIMING.chapters[chapter],{play:!this.reducedMotion});
    if(this.reducedMotion){this.seek([QC_TIMING.staticIntro,32.6][chapter]);}
    text(this.r.announce,`Chapter ${chapter+1}. ${['Your pricing, our calculations','Like a spreadsheet, without the formulas'][chapter]}.`);
  }
  setSpeed(speed) {
    if(!Number.isFinite(speed)||speed<.25||speed>2)return;
    this.speed=speed;this._last=0;this._emitState();
  }
  setVisibility(visible) {this.parentVisible=!!visible;this._syncPlayback();}
  enterExplore(focus=true) {
    if(this.exploring)return;
    const rate=this.t>=QC_TIMING.rateChange?28:24;
    this.pause();this.t=QC_TIMING.staticIntro;this.exploring=true;this._scrollManual=false;
    this._roofKey='';
    this.manual={materialRate:String(rate),labourRate:'5.50',wastePercent:'5',lengths:['10'],pitchDegrees:'25',basis:'plan'};
    this.r.frame.classList.add('exploring');this._renderExtras();this.render();
    text(this.r.announce,'Interactive example. Change the rates, length or pitch. Nothing is saved.');
    if(focus)this.inputs.materialRate.focus({preventScroll:true});
    this._emitState();
  }
  _leaveExplore() {
    if(!this.exploring)return;
    this.exploring=false;this._roofKey='';this.r.frame.classList.remove('exploring');this.r.extras.innerHTML='';
    this.r.errors.hidden=true;this.inputs.pitchDegrees.disabled=false;
  }
  exitExplore() {this._leaveExplore();this.seek(QC_TIMING.sheetMessage,{play:!this.reducedMotion});this.r.play.focus({preventScroll:true});}
  _renderExtras() {
    this.r.extras.innerHTML=this.manual.lengths.slice(1).map((v,i)=>`<div class="extra-length"><label class="number-shell"><input type="number" inputmode="decimal" min="0" step="any" value="${esc(v)}" data-length-index="${i+1}" aria-label="Test length ${i+2}, metres"/><span class="unit">m</span></label><button type="button" data-remove="${i+1}" aria-label="Remove length ${i+2}">${icon('trash')}</button></div>`).join('');
  }
  _setInput(key,value) {if(this.inputs[key].value!==String(value))this.inputs[key].value=String(value);}
  _demoOutcome(t) {return calculateLinearExample({materialRate:t>=QC_TIMING.updatedResult?28:24,labourRate:5.5,wastePercent:5,lengths:[10],pitchDegrees:25,basis:'plan'});}
  _focusPanels(t) {
    if(this.exploring||this.reducedMotion){
      for(const el of [this.r.settingsPanel,this.r.testPanel]){el.style.opacity=1;el.style.filter='none';}
      flag(this.r.frame,'focus-settings',false);flag(this.r.frame,'focus-test',false);return;
    }
    // Shift attention before changing a number. No panels move, shrink, or jump.
    let testFocus=smooth(prog(t,QC_TIMING.testFocus,.4));
    testFocus*=1-smooth(prog(t,QC_TIMING.editFocus,.4));
    testFocus=Math.max(testFocus,smooth(prog(t,QC_TIMING.resultFocus,.4)));
    // With no action happening during the reading lead, keep both areas quiet.
    const engaged=smooth(prog(t,QC_TIMING.readLead,.45));
    const neutral=smooth(prog(t,QC_TIMING.sheetMessage-.5,.5));
    const dim=.48;
    const settings=mix(1,mix(1,dim,testFocus),engaged*(1-neutral));
    const test=mix(.58,mix(dim,1,testFocus),engaged);
    this.r.settingsPanel.style.opacity=settings;
    this.r.testPanel.style.opacity=mix(test,1,neutral);
    this.r.settingsPanel.style.filter=`saturate(${mix(1,.25,testFocus)})`;
    this.r.testPanel.style.filter=`saturate(${mix(.25,1,testFocus)})`;
    flag(this.r.frame,'focus-settings',engaged>.8&&testFocus<.1&&neutral<.1);
    flag(this.r.frame,'focus-test',testFocus>.9&&neutral<.1);
  }
  _setupValue(step,t) {
    if(t<step.start+.18)return '';
    if(t>=step.entered)return step.value;
    // Deliberate, short input entry. Never interpolate fake prices for many seconds.
    if(step.key==='materialRate')return t<step.start+.34?'2':'24';
    if(step.key==='labourRate')return t<step.start+.34?'5':'5.5';
    return '5';
  }
  _renderIntro(t) {
    this._focusPanels(t);
    if(this.exploring){this._renderManual();return;}
    const T=QC_TIMING;
    const opened=smooth(prog(t,T.testOpen,.45));
    this.r.testContent.style.opacity=opened;this.r.testEmpty.style.opacity=1-opened;
    this.r.testContent.inert=opened<.8;
    this.r.openTest.disabled=t<T.setupComplete;
    this.setupStep=-1;
    QC_SETUP.forEach((step,index)=>{
      const active=t>=step.start&&t<(index===4?T.setupComplete:QC_SETUP[index+1].start-.12);
      if(active)this.setupStep=index;
      const complete=t>=step.entered;
      if(index<3){
        const field=this.$(`[data-field="${step.key}"]`);
        let value=this._setupValue(step,t);
        if(step.key==='materialRate'&&t>=T.rateChange)value=t<T.rateChange+.17?'2':'28.00';
        this._setInput(step.key,value);
        flag(field,'is-focus',active||(step.key==='materialRate'&&t>=T.editFocus+.45&&t<T.resultFocus));
        flag(field,'has-value',complete);
      } else {
        const line=this.$(`[data-setting="${step.key}"]`);
        text(line.querySelector('.selection-value'),complete?step.value:step.key==='measure'?'Choose type…':'Choose rule…');
        flag(line,'has-value',complete);flag(line,'is-focus',active);
        const start=step.start+.12,end=step.entered+.2;
        const alpha=smooth(prog(t,start,.15))*(1-smooth(prog(t,step.entered,.2)));
        const menu=line.querySelector('.selection-menu');
        menu.style.opacity=this.reducedMotion?0:alpha;
        menu.style.transform=`translateY(${3*(1-alpha)}px)`;
        flag(line,'is-open',!this.reducedMotion&&t>=start&&t<end);
        flag(menu,'has-selection',t>=step.start+.4);
      }
    });
    // Test inputs start empty too; length then roof angle, with one focus at a time.
    const length=t<T.lengthEntry?'':t<T.lengthEntry+.15?'1':'10';
    const pitch=t<T.pitchEntry?'':t<T.pitchEntry+.15?'2':'25';
    this._setInput('length',length);this._setInput('pitchDegrees',pitch);
    Object.values(this.inputs).forEach(el=>{el.readOnly=true;el.tabIndex=-1;el.disabled=false;el.setAttribute('aria-invalid','false');});
    flag(this.$('[data-field="length"]'),'is-focus',t>=T.lengthEntry-.25&&t<T.pitchEntry-.25);
    flag(this.$('[data-field="pitchDegrees"]'),'is-focus',t>=T.pitchEntry-.25&&t<T.firstResult-.55);
    this.r.basis.value='plan';this.r.basis.disabled=true;this.r.basis.tabIndex=-1;this.r.addLength.tabIndex=-1;
    this.r.errors.hidden=true;this.r.extras.innerHTML='';
    flag(this.r.openTest,'is-cued',t>=T.openCue&&t<T.testOpen);
    flag(this.r.calculate,'is-cued',(t>=T.firstResult-.6&&t<T.firstResult)||(t>=T.updatedResult-.45&&t<T.updatedResult));
    text(this.r.calculate.querySelector('span'),t>=T.firstResult?'Calculate again':'Calculate');
    text(this.r.editorNote,'Your rates. Your allowances.');
    const outcome=this._demoOutcome(t);this.lastOutcome=outcome;
    const reveal=smooth(prog(t,T.firstResult,.5));
    this.r.result.style.opacity=reveal;this.r.resultEmpty.hidden=t>=T.firstResult;
    this.r.result.hidden=false;this.r.result.setAttribute('aria-hidden',String(reveal<.5));
    let display=outcome.result;
    if(t>=T.updatedResult&&t<T.updatedResult+.6){
      const old=this._demoOutcome(0).result,p=smooth(prog(t,T.updatedResult,.6));
      display={...display,total:mix(old.total,display.total,p),materialCost:mix(old.materialCost,display.materialCost,p)};
    }
    this._paintResult(display,t>=T.updatedResult);
    this.$('.previous-result').style.opacity=smooth(prog(t,T.updatedResult+.65,.35));
    text(this.r.liveBadge,t>=T.rateChange&&t<T.updatedResult?'Previous test':t>=T.updatedResult?'Updated':'Calculated');
    const pop=smooth(prog(t,T.updatedResult,.2))*(1-smooth(prog(t,T.updatedResult+.8,.4)));
    this.r.result.style.setProperty('--result-emphasis',pop);
    this.r.geometry.style.opacity=smooth(prog(t,T.pitchEntry+.35,.35));
    this._paintRoof(25,10,'plan',t>=T.firstResult?outcome.result:null);
    this.r.geometryMain.innerHTML='Pitch + 5% waste <strong>included</strong>';
  }
  _renderManual() {
    if(!this.exploring)return;
    const m=this.manual;
    this.r.openTest.disabled=false;this.r.geometry.style.opacity=1;
    this.r.result.style.setProperty('--result-emphasis',0);
    this.$$('[data-setting]').forEach(el=>{
      flag(el,'is-open',false);flag(el,'has-value',true);
      el.querySelector('.selection-menu').style.opacity=0;
    });
    text(this.$('[data-setting="measure"] .selection-value'),'Linear: Single (m)');
    this.r.testContent.inert=false;this.r.testContent.style.opacity=1;this.r.testEmpty.style.opacity=0;
    Object.entries(this.inputs).forEach(([k,el])=>{
      el.readOnly=false;el.tabIndex=0;
      this._setInput(k,k==='length'?m.lengths[0]:m[k]);
    });
    this.inputs.pitchDegrees.disabled=m.basis==='surface';
    this.r.basis.disabled=false;this.r.basis.tabIndex=0;this.r.basis.value=m.basis;this.r.addLength.tabIndex=0;
    this.r.addLength.disabled=m.lengths.length>=5;
    this.r.addLength.textContent=m.lengths.length>=5?'5 lengths in this demo':'+ Add a length';
    text(this.$('.pitch-rule'),'Rafter Pitch');
    this.$$('[data-field],.settings-line').forEach(el=>flag(el,'is-focus',false));
    flag(this.r.openTest,'is-cued',false);flag(this.r.calculate,'is-cued',false);
    text(this.r.editorNote,'Explore this example. No component or quote is saved.');
    text(this.r.calculate.querySelector('span'),'Calculate again');
    const outcome=calculateLinearExample(m);this.lastOutcome=outcome;
    this.r.resultEmpty.hidden=true;this.r.errors.hidden=outcome.ok;this.r.result.hidden=!outcome.ok;this.r.result.style.opacity=1;this.r.result.setAttribute('aria-hidden',String(!outcome.ok));
    Object.entries(this.inputs).forEach(([k,el])=>el.setAttribute('aria-invalid',String(!outcome.ok&&!!outcome.errors[k==='length'?'length-0':k])));
    this.r.extras.querySelectorAll('input').forEach(el=>el.setAttribute('aria-invalid',String(!outcome.ok&&!!outcome.errors[`length-${el.dataset.lengthIndex}`])));
    if(outcome.ok){this._paintResult(outcome.result,true);this._paintRoof(outcome.result.pitchDegrees,outcome.result.entered,m.basis,outcome.result);}
    else{this.r.errors.innerHTML=Object.values(outcome.errors).map(e=>`<p>${esc(e)}</p>`).join('');this._paintRoof(0,0,m.basis,null);}
    this.$('.previous-result').style.opacity=0;
  }
  _paintResult(r,updated=false) {
    text(this.r.total,money(r.total));text(this.r.materialTotal,money(r.materialCost));text(this.r.labourTotal,money(r.labourCost));
    text(this.r.required,`${qty(r.required)} m required`);text(this.r.requiredLabel,`With ${qty(r.wastePercent)}% waste`);
    text(this.r.liveBadge,updated?'Updates automatically':'Calculated');
    flag(this.r.total,'is-updated',updated);
  }
  _paintRoof(pitch,length,basis,result) {
    const angle=clamp(Number(pitch)||0,0,89.99);
    const key=[angle,length,basis,result?.required].join('|');if(key===this._roofKey)return;this._roofKey=key;
    const theta=angle*Math.PI/180;const width=angle>0?Math.min(104,43/Math.tan(theta)):104;
    const x=14+width,y=57-width*Math.tan(theta);
    this.$('.roof-fill').setAttribute('d',`M14 57L${x} 57L${x} ${y}Z`);
    this.$('.roof-base').setAttribute('d',`M14 57H${x}`);
    this.$('.roof-rise').setAttribute('d',`M${x} 57V${y}`);
    this.$('.roof-slope').setAttribute('d',`M14 57L${x} ${y}`);
    this.$('.roof-end').setAttribute('cx',x);this.$('.roof-end').setAttribute('cy',y);
    this.$('.roof-plan-label').setAttribute('x',14+width/2);
    text(this.$('.roof-plan-label'),`${qty(length)} m${basis==='plan'?' plan':''}`);
    text(this.$('.roof-angle'),basis==='plan'&&angle>0?`${qty(angle)}°`:'');
    if(result){
      this.r.geometryMain.innerHTML=`${qty(result.entered)} m ${basis==='plan'?'plan':'measured'} <strong>→ ${qty(result.afterPitch)} m</strong>`;
      text(this.r.geometryNote,basis==='plan'?`On the slope · waste adds ${qty(result.wasteAdded)} m`:`No extra pitch · waste adds ${qty(result.wasteAdded)} m`);
    } else {
      this.r.geometryMain.innerHTML=basis==='plan'?'Plan length <strong>→ on-slope length</strong>':'Already measured <strong>on the slope</strong>';
      text(this.r.geometryNote,basis==='plan'?'The pitch rule handles the difference.':'Pitch is not added a second time.');
    }
  }
  _setStageVisibility(t) {
    // The old, motionless view stays on screen while the new message lands.
    // Only after the 1.6 s reading lead do the scenes crossfade.
    const p=this.exploring?0:this.reducedMotion?(t>=QC_TIMING.sheetMessage?1:0):smooth(prog(t,QC_TIMING.sheetReveal,.5));
    [this.r.intro,this.r.sheetScene].forEach((el,i)=>{
      const opacity=i===0?1-p:p;
      el.style.opacity=opacity;el.style.transform='none';
      const active=i===(p>.5?1:0);
      flag(el,'is-active',active);el.inert=!active;el.setAttribute('aria-hidden',String(!active));
    });
  }
  _fieldCue(t) {
    const T=QC_TIMING;
    for(let i=0;i<QC_FIELDS.length;i++){
      const start=T.fieldStart+i*T.fieldGap;
      if(t>=start-.14&&t<start+T.flight+.15)return {index:i,start};
    }
    return null;
  }
  _renderSheet(t) {
    const T=QC_TIMING;
    const rate=t>=T.rateChange?28:24;
    if(this._lastRate!==rate){
      text(this.cells[0][1].querySelector('span'),rowValue(QC_DATA[0],'material',rate));
      this.cells[0][1].title=rowValue(QC_DATA[0],'material',rate);
      text(this.r.target.querySelector('[data-target="material"]'),rowValue(QC_DATA[0],'material',rate));
      this._lastRate=rate;
    }
    let activeRow=0;
    T.otherRows.forEach(e=>{if(t>=e.time)activeRow=e.row;});
    this.activeRow=activeRow;
    const cue=this._fieldCue(t);
    this.activeField=cue?.index??-1;
    this.rows.forEach((r,i)=>flag(r,'is-selected',t>=T.rowFocus&&t<T.comparisonHold&&i===activeRow));
    this.cells.forEach((r,i)=>r.forEach((c,f)=>{
      flag(c,'is-focus',i===0&&f===this.activeField);
      flag(c,'is-transferring',i===0&&f===this.activeField&&t>=(cue?.start??Infinity)&&t<(cue?.start??Infinity)+T.flight);
    }));
    this.cards.forEach((card,i)=>{
      const start=i===0?T.sheetReveal:T.otherRows[i-1].time;
      const entered=this.reducedMotion||t>=start;
      const p=this.reducedMotion?1:smooth(prog(t,start,.5));
      card.style.opacity=i===0?1:p;card.style.transform='none';
      card.setAttribute('aria-hidden',String(!entered));card.inert=!entered;
      flag(card,'is-linked',t>=T.rowFocus&&t<T.comparisonHold&&i===activeRow);
      QC_FIELDS.forEach((f,idx)=>{
        const el=card.querySelector(`[data-target="${f.key}"]`);
        const landed=i>0||this.reducedMotion||t>=T.fieldStart+idx*T.fieldGap+T.flight-.03;
        flag(el,'is-pending',!landed);
        el.setAttribute('aria-hidden',String(!landed));
        flag(el,'is-focus',i===0&&idx===this.activeField);
      });
    });
    // Code, description and the action are supplementary UI, not invented sheet columns.
    const identity=this.reducedMotion||t>=T.fieldStart+T.flight;
    const finished=this.reducedMotion||t>=T.detailComplete;
    this.r.target.querySelector('.pill.code').style.opacity=identity?1:0;
    this.r.target.querySelector('.card-notes').style.opacity=finished?1:0;
    this.r.target.querySelector('.card-actions').style.opacity=finished?1:.32;
    this.r.target.querySelector('[data-open-card]').disabled=!finished;
    flag(this.r.target,'is-complete',finished);
    this.r.importNote.hidden=t<T.closing;
    flag(this.r.frame,'closing',t>=T.closing&&!this.exploring);
    const close=this.reducedMotion?(t>=T.closing?1:0):smooth(prog(t,T.importNote,.5));
    this.r.frame.style.setProperty('--close-reveal',close);
    this.r.importNote.style.opacity=close;
    if(!this._scrollManual)this._positionSheet(t);
    this._drawConnection(t);
  }
  _positionSheet(t) {
    const T=QC_TIMING,vp=this.r.source;
    const maxX=Math.max(0,vp.scrollWidth-vp.clientWidth);
    let x=0;
    // On narrow layouts, bring the next real column into view BEFORE its value travels.
    // All rows and cells keep their dimensions and horizontal relationship.
    QC_FIELDS.forEach((f,i)=>{
      const cell=this.cells[0][i];
      const desired=clamp(cell.offsetLeft-(vp.clientWidth-cell.offsetWidth)/2-8,0,maxX);
      x=mix(x,desired,smooth(prog(t,T.fieldStart+i*T.fieldGap-.35,.24)));
    });
    x=mix(x,0,smooth(prog(t,T.detailComplete,.4)));
    if(t<T.sheetReveal)x=0;
    if(this.reducedMotion)x=0;
    vp.scrollLeft=x;vp.scrollTop=0;
  }
  _drawConnection(t) {
    this._hideConnection();
    const T=QC_TIMING;
    if(this.reducedMotion||this.exploring||t<T.sheetReveal||t>=T.comparisonHold)return;
    const cue=this._fieldCue(t);
    let field=-1,start=0,row=0,duration=T.flight;
    if(cue&&t>=cue.start&&t<cue.start+T.flight){field=cue.index;start=cue.start;}
    if(field<0){
      const ev=T.otherRows.find(e=>t>=e.time+.1&&t<e.time+.8);
      if(!ev)return;row=ev.row;start=ev.time+.1;duration=.7;
    }
    const p=prog(t,start,duration),alpha=smooth(prog(t,start,.11))*(1-smooth(prog(t,start+duration-.13,.13)));
    const stage=this.r.stage.getBoundingClientRect(),vp=this.r.source.getBoundingClientRect();
    const mobile=this.getBoundingClientRect().width<=840;
    const cell=this.cells[row][field<0?0:field].getBoundingClientRect();
    const dest=field<0?this.cards[row].getBoundingClientRect():this.targetFields[field].getBoundingClientRect();
    const card=this.cards[row].getBoundingClientRect();
    let a,d;
    if(field>=0){
      const srect=this.cells[0][field].querySelector('span').getBoundingClientRect();
      a={x:clamp(srect.left+Math.min(srect.width,cell.width-18)/2,vp.left+34,vp.right-12)-stage.left,
        y:cell.top+cell.height/2-stage.top};
      d={x:dest.left+dest.width/2-stage.left,y:dest.top+dest.height/2-stage.top};
      text(this.r.flightLetter,QC_FIELDS[field].letter);
      text(this.r.flightText,rowValue(QC_DATA[0],QC_FIELDS[field].key,28));
    } else {
      a={x:(mobile?vp.left+vp.width*.5:vp.right)-stage.left,y:(mobile?vp.bottom:cell.top+cell.height/2)-stage.top};
      d={x:(mobile?card.left+card.width*.5:card.left)-stage.left,y:(mobile?card.top:card.top+card.height*.5)-stage.top};
    }
    const k=mobile?Math.max(24,(d.y-a.y)*.4):Math.max(32,(d.x-a.x)*.4);
    const b=mobile?{x:a.x,y:a.y+k}:{x:a.x+k,y:a.y-9};
    const c=mobile?{x:d.x,y:d.y-k}:{x:d.x-k,y:d.y-9};
    this.r.svg.setAttribute('viewBox',`0 0 ${stage.width} ${stage.height}`);
    this.r.path.setAttribute('d',`M${a.x},${a.y} C${b.x},${b.y} ${c.x},${c.y} ${d.x},${d.y}`);
    this.r.path.setAttribute('opacity',String(alpha*(field>=0?.3:.6)));
    const q=smooth(p),u=1-q;
    const point={x:u*u*u*a.x+3*u*u*q*b.x+3*u*q*q*c.x+q*q*q*d.x,
      y:u*u*u*a.y+3*u*u*q*b.y+3*u*q*q*c.y+q*q*q*d.y};
    this.r.dot.setAttribute('cx',point.x);this.r.dot.setAttribute('cy',point.y);
    this.r.dot.setAttribute('opacity',String(field>=0?0:alpha));
    if(field>=0){
      this.r.flight.style.opacity=alpha;
      const half=Math.min(this.r.flight.offsetWidth/2,stage.width/2-10);
      this.r.flight.style.left=clamp(point.x,half+8,stage.width-half-8)+'px';
      this.r.flight.style.top=point.y+'px';
      this.r.flight.style.transform=`translate(-50%,-50%) scale(${.97+.03*Math.sin(Math.PI*p)})`;
    }
  }
  _hideConnection(){
    this.r.path.setAttribute('opacity','0');this.r.dot.setAttribute('opacity','0');this.r.flight.style.opacity=0;
  }
  _caption(t) {
    const T=QC_TIMING;
    let title='Your pricing. Our calculations.';
    let description='Bring your knowledge. Smart Components™ do the maths.';
    let cue=0;
    if(t>=T.sheetMessage){
      title='Like a spreadsheet. Without the formulas.';
      description='One pricing row. One Smart Component™. Calculations built in.';cue=T.sheetMessage;
    }
    if(t>=T.closing){
      title='Your pricing. Calculated for you.';
      description='Set it up once. Test it. Use it on your jobs.';cue=T.closing;
    }
    if(this.exploring){title='Try your numbers.';description='Change a rate, length or pitch. Nothing is saved.';}
    text(this.r.captionTitle,title);text(this.r.captionDescription,description);
    // Crossfade only the words; never a second explanatory panel below the action.
    this.r.heading.style.opacity=this.exploring||this.reducedMotion?1:.65+.35*smooth(prog(t,cue,.3));
  }
  _renderTransport() {
    const paused=!this.playRequested||this.exploring;
    const playIcon=paused?'play':'pause';
    if(this._playIcon!==playIcon){this.r.play.innerHTML=icon(playIcon);this._playIcon=playIcon;}
    this.r.play.setAttribute('aria-label',this.exploring?'Continue the animation':paused?'Play animation':'Pause animation');
    this.r.play.setAttribute('aria-pressed',String(!paused));
    const clock=this.$('.playback-time');
    if(clock)text(clock,`0:${String(Math.floor(this.t)).padStart(2,'0')} / 0:38`);
    this.r.range.value=String(this.t);this.r.range.style.setProperty('--progress',`${this.t/this.duration*100}%`);
    this.r.range.setAttribute('aria-valuetext',`${Math.round(this.t*10)/10} seconds of ${this.duration} seconds`);
    this.r.continueButton.hidden=!this.exploring;
  }
  render() {
    const t=this.t;
    this._setStageVisibility(t);
    if(t<QC_TIMING.sheetReveal+.5||this.exploring)this._renderIntro(Math.min(t,QC_TIMING.sheetMessage));
    this._renderSheet(t);
    this._caption(t);this._renderTransport();
    if(this.exploring)this._hideConnection();
    if(this.chapter!==this._lastChapter){this._lastChapter=this.chapter;this._emitState();}
  }
  getState() {
    return {version:'4.1.0',time:this.t,duration:this.duration,speed:this.speed,chapter:this.exploring?0:this.chapter,
      phase:this.t>=QC_TIMING.closing?'closing-note':this.chapter===1?'spreadsheet':'create-test',
      playing:this.playing,playRequested:this.playRequested,exploring:this.exploring,reducedMotion:this.reducedMotion,
      inView:this.inView,parentVisible:this.parentVisible,layout:this.getBoundingClientRect().width<=840?'mobile':'desktop',
      activeRow:this.activeRow??0,activeField:this.activeField??-1,setupStep:this.setupStep??-1,
      result:(this.exploring?calculateLinearExample(this.manual):this._demoOutcome(this.t)),
      exampleCount:3,simulationOnly:true};
  }
  getMappings() {
    const row=this.activeRow||0;
    return QC_FIELDS.map((f,i)=>({key:f.key,letter:f.letter,componentField:f.destination,source:this.cells[row][i].textContent,
      target:this.cards[row].querySelector(`[data-target="${f.key}"]`)?.textContent||'',row:row+2}));
  }
  calculate(input) {return calculateLinearExample(input);}
}
if(!customElements.get('qc-pricing-animation'))customElements.define('qc-pricing-animation',QuoteCoreSmartComponents);

/** Public website section. Shadow-scoped and dependency-free.
 * The V4 animation is retained in <qc-pricing-animation>; only its premium
 * theme, trademark treatment and closing timing are refined.
 * No account, tracking, upload, font, network or save API is used.
 */
class QuoteCorePricingSection extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode:'open'});
    this.shadowRoot.innerHTML=`<style>/* QuoteCore+ / Smart Components™ website section / Website edition 1.0
   Values follow UX 2.15's core light + additive Dark Focus palette.
   Scoped by the section's shadow root; no global reset, font or image assets. */
:host {
 --qc-section-canvas:#F6F7F9;
 --qc-ink:#191B20;--qc-text:#303641;--qc-muted:#596273;
 --qc-orange:#FF641F;--qc-bright:#FF8A3D;--qc-light:#FFB36B;
 --qc-orange-ink:#B63D0A;--qc-wash:#FFF4EB;--qc-border:#DDE1E7;
 --qc-dark:#0B0D10;--qc-dark-panel:#12151A;--qc-dark-raised:#181C22;
 --qc-on-dark:#F7F8FA;--qc-muted-dark:#A8B0BC;
 --qc-font:var(--quotecore-font,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);
 display:block;min-width:0;container-type:inline-size;
 color:var(--qc-ink);font-family:var(--qc-font);font-size:16px;line-height:1.5;
 -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;
 color-scheme:light;
}
*,*::before,*::after { box-sizing:border-box; }
h2,h3,p { margin:0; }
button,a { -webkit-tap-highlight-color:transparent; }
button { font:inherit;cursor:pointer; }
a { color:inherit; }
svg { display:block;width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;flex:none; }
button:focus-visible,a:focus-visible,[tabindex]:focus-visible { outline:2px solid var(--qc-orange-ink);outline-offset:5px; }
[hidden] { display:none!important; }
.sr-only { position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0; }
.tm { font-size:.62em;line-height:0;vertical-align:super;margin-left:.04em;letter-spacing:0;font-weight:500; }
.brand { white-space:nowrap; }
.pricing-section {
 background:var(--qc-section-canvas);padding:76px 40px 80px;position:relative;isolation:isolate;
}
.section-inner { max-width:1224px;margin-inline:auto; }
.section-intro { display:grid;grid-template-columns:minmax(0,1fr) 304px;column-gap:68px;align-items:end;margin-bottom:20px; }
.eyebrow { display:flex;align-items:center;gap:14px;font-size:10px;letter-spacing:2.1px;line-height:1.5;font-weight:650;text-transform:uppercase;color:var(--qc-orange-ink);margin-bottom:22px; }
.eyebrow::before { content:'';width:34px;height:1px;background:linear-gradient(90deg,var(--qc-orange),#FFB36B);flex:none; }
.section-title { font-size:46px;line-height:1.17;letter-spacing:-1.85px;font-weight:650;overflow:visible;padding-bottom:.12em; }
.section-title .title-line { display:block; }
.section-title .accent {
 display:block;margin-top:6px;padding-bottom:.09em;color:var(--qc-orange);text-wrap:balance;
 background:none;-webkit-background-clip:initial;background-clip:initial;-webkit-text-fill-color:currentColor;
}
.intro-copy { padding:0 0 3px; }
.intro-copy p { color:var(--qc-muted);font-size:15px;line-height:1.75; }
.watch-link {
 display:inline-flex;align-items:center;gap:11px;min-height:46px;padding:0;margin-top:20px;
 border:0;border-radius:4px;background:none;color:var(--qc-ink);font-weight:600;font-size:13px;line-height:1.4;text-align:left;
}
.watch-symbol { display:grid;place-items:center;width:32px;height:32px;border:1px solid #DBCABD;border-radius:50%;background:linear-gradient(150deg,#FFFCF9,#FFF4EB);color:var(--qc-orange-ink);transition:border-color 180ms,background 180ms; }
.watch-symbol svg { width:13px;height:13px;fill:currentColor;stroke-width:1.2;margin-left:1px; }
.watch-link:hover .watch-symbol { border-color:var(--qc-orange);background:#FFE6D2; }
.watch-link .down-arrow { width:15px;height:15px;color:var(--qc-muted);margin-left:3px; }
.showcase {
 border:1px solid #D8DCE2;border-radius:22px;overflow:hidden;background:white;
 box-shadow:0 22px 58px -30px rgba(25,27,32,.22),0 4px 14px rgba(25,27,32,.025);
}
.player-shell {
 background:radial-gradient(ellipse at 88% -22%,rgba(255,100,31,.16),transparent 48%),var(--qc-dark-panel);
 color:var(--qc-on-dark);scroll-margin-top:var(--qc-sticky-header-offset,76px);
}
qc-pricing-animation { display:block;min-width:0; }
.inputs-grid { display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0;padding:10px 30px;background:linear-gradient(180deg,#FFFFFF,#FDFDFE); }
.input-item { display:flex;gap:13px;align-items:center;min-width:0;padding-inline:24px; }
.input-item:first-child { padding-left:0; }
.input-item:last-child { padding-right:0; }
.input-item+.input-item { border-left:1px solid #E4E7EC; }
.input-icon { width:28px;height:28px;border-radius:8px;display:grid;place-items:center;color:var(--qc-orange-ink);background:linear-gradient(140deg,#FFF4EB,#FFFFFF);border:1px solid #EFDFD2;flex:none; }
.input-icon svg { width:15px;height:15px;stroke-width:1.65; }
.input-item h3 { font-size:13px;font-weight:650;letter-spacing:-.1px;margin-bottom:2px; }
.input-item p { font-size:11px;line-height:1.45;color:var(--qc-muted); }
.closing {
 position:relative;display:flex;align-items:center;gap:24px;min-height:0;padding:16px 42px;
 background:radial-gradient(ellipse at 4% 150%,rgba(255,100,31,.16),transparent 57%),linear-gradient(125deg,var(--qc-dark-panel),var(--qc-dark));
 color:var(--qc-on-dark);border-top:1px solid rgba(255,255,255,.12);
}
.closing::before { content:'';position:absolute;left:42px;top:0;width:66px;height:1px;background:linear-gradient(90deg,var(--qc-bright),transparent); }
.knowledge-icon { display:grid;place-items:center;width:44px;height:44px;flex:none;border-radius:11px;color:var(--qc-light);background:linear-gradient(145deg,rgba(255,255,255,.075),rgba(255,255,255,.02));border:1px solid rgba(255,255,255,.16);box-shadow:inset 0 1px 0 rgba(255,255,255,.08); }
.knowledge-icon svg { width:21px;height:21px;stroke-width:1.45; }
.closing h3 { font-size:27px;line-height:1.15;font-weight:550;letter-spacing:-.6px;margin-bottom:5px; }
.closing p { font-size:16px;line-height:1.5;color:#BCC3CD; }
.closing p .brand { color:var(--qc-on-dark); }
.closing .closing-detail { margin-left:auto;border-left:1px solid rgba(255,255,255,.14);padding-left:28px;flex:none;font-size:11px;line-height:1.75;color:var(--qc-muted-dark); }
.closing-detail span { display:block;color:var(--qc-light);font-weight:550; }
.fallback { padding:24px;background:white;color:var(--qc-text);font-size:15px;line-height:1.75; }
@container (min-width:1500px) {
 .pricing-section { padding-top:88px;padding-bottom:88px; }
}
@container (max-width:1150px) {
 .pricing-section { padding:60px 28px 64px; }
 .section-intro { grid-template-columns:minmax(0,1fr) 280px;gap:40px;margin-bottom:17px; }
 .section-title { font-size:39px;letter-spacing:-1.45px; }
 .intro-copy p { font-size:14px; }
 .eyebrow { font-size:9px;letter-spacing:1.8px; }
 .inputs-grid { padding:10px 24px; }
 .input-item { padding-inline:18px;gap:10px; }
 .input-item p { font-size:10px; }
 .closing { padding:16px;gap:20px; }
 .closing::before { left:30px; }
 .closing h3 { font-size:26px; }
 .closing p { font-size:15px; }
 .closing-detail { display:none; }
}
@container (max-width:850px) {
 .pricing-section { padding:48px 24px 56px; }
 .section-intro { grid-template-columns:1fr;gap:22px;margin-bottom:14px; }
 .section-title { font-size:42px;max-width:660px; }
 .intro-copy { display:flex;align-items:center;gap:28px; }
 .intro-copy p { max-width:445px;font-size:14px;line-height:1.65; }
 .watch-link { flex:none;margin:0;font-size:12px; }
 .inputs-grid { padding:10px 18px; }
 .input-item { align-items:flex-start;gap:9px;padding-inline:14px; }
 .input-icon { width:29px;height:29px;border-radius:8px; }
 .input-icon svg { width:15px;height:15px; }
 .input-item h3 { font-size:12px; }
 .input-item p { font-size:10px; }
}
@container (max-width:600px) {
 .pricing-section { padding:40px 16px 40px; }
 .section-intro { gap:19px;margin-bottom:12px; }
 .eyebrow { font-size:8px;letter-spacing:1.6px;gap:10px;margin-bottom:18px; }
 .eyebrow::before { width:24px; }
 .section-title { font-size:34px;line-height:1.1;letter-spacing:-1.3px; }
 .section-title .title-line { display:inline; }
 .section-title .accent { margin-top:6px; }
 .intro-copy { display:block; }
 .intro-copy p { font-size:14px;line-height:1.65;max-width:none; }
 .watch-link { margin-top:12px;font-size:12px;min-height:44px; }
 .showcase { border-radius:18px;box-shadow:0 16px 35px -24px rgba(25,27,32,.22); }
 .inputs-grid { grid-template-columns:1fr;padding:6px 22px; }
 .input-item,.input-item:first-child,.input-item:last-child { padding:9px 0;gap:13px;align-items:center; }
 .input-item+.input-item { border-left:0;border-top:1px solid #E4E7EC; }
 .input-icon { width:34px;height:34px;border-radius:10px; }
 .input-icon svg { width:17px;height:17px; }
 .input-item h3 { font-size:13px;margin-bottom:3px; }
 .input-item p { font-size:11px; }
 .closing { display:block;padding:13px 24px 15px;min-height:0; }
 .closing::before { left:24px; }
 .knowledge-icon { width:38px;height:38px;border-radius:10px;margin-bottom:10px; }
 .knowledge-icon svg { width:20px;height:20px; }
 .closing h3 { font-size:25px;letter-spacing:-.6px;line-height:1.15;margin-bottom:6px; }
 .closing p { font-size:14px;line-height:1.6; }
}
@container (max-width:360px) {
 .pricing-section { padding:30px 12px 32px; }
 .section-title { font-size:30px;letter-spacing:-1.1px; }
 .eyebrow { font-size:7.5px;letter-spacing:1.3px;gap:8px; }
 .intro-copy p { font-size:13px; }
 .closing { padding-inline:20px; }
 .closing h3 { font-size:22px; }
 .closing p { font-size:13px; }
}
@media (prefers-reduced-motion:reduce) {
 *,*::before,*::after { scroll-behavior:auto!important;transition:none!important; }
}
@media (prefers-contrast:more) {
 .intro-copy p,.input-item p { color:var(--qc-text); }
 .closing p,.closing .closing-detail { color:var(--qc-on-dark); }
 .showcase { border-color:var(--qc-ink); }
}
@media (forced-colors:active) {
 .pricing-section,.showcase,.player-shell,.closing,.inputs-grid { background:Canvas;color:CanvasText;box-shadow:none; }
 .section-title .accent { background:none;-webkit-text-fill-color:CanvasText;color:CanvasText; }
 .eyebrow,.input-item p,.intro-copy p,.closing p,.closing p .brand,.closing .closing-detail,.closing-detail span { color:CanvasText; }
 .showcase,.input-icon,.knowledge-icon,.watch-symbol { border:1px solid CanvasText; }
 .input-icon,.knowledge-icon,.watch-symbol { color:ButtonText;background:ButtonFace; }
 .closing { border-top:1px solid CanvasText; }
}

/* Final polish: safe glyph descenders, generous heading clearance and button glint. */
.section-intro { margin-bottom:max(22px,1.75vw); }
.section-title .accent { overflow:visible; }
.watch-symbol { position:relative;overflow:hidden;isolation:isolate; }
.watch-symbol::after { content:"";position:absolute;inset:-55% auto -55% -70%;width:48%;transform:skewX(-24deg);background:linear-gradient(90deg,transparent,rgba(255,255,255,.85),transparent);pointer-events:none;opacity:0; }
.watch-link:hover .watch-symbol::after,.watch-link:focus-visible .watch-symbol::after { opacity:1;animation:qc-button-glint .7s ease-out both; }
@keyframes qc-button-glint { from {left:-70%;} to {left:140%;} }
@media (prefers-reduced-motion:reduce) { .watch-symbol::after { animation:none!important;opacity:0!important; } }
</style>\n<section class="pricing-section" part="section" aria-labelledby="pricing-title">
  <div class="section-inner">
    <header class="section-intro">
      <div class="intro-title">
        <p class="eyebrow">The thinking behind your quote</p>
        <h2 class="section-title" part="headline" id="pricing-title">
          <span class="title-line">Most software remembers</span>
          <span class="title-line">what you charged.</span>
          <span class="accent">We remember how you work.</span>
        </h2>
      </div>
      <div class="intro-copy">
        <p>Your materials. Your labour. Your pricing rules. <span class="brand">Smart Components<sup class="tm" aria-hidden="true">™</sup></span> bring it all together and handle the calculations for you.</p>
        <button class="watch-link" type="button" aria-controls="pricing-demo" aria-label="Watch how Smart Components™ work, from the beginning">
          <span class="watch-symbol" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m9 5 11 7-11 7z"/></svg></span>
          <span>Watch how simple it is</span>
          <svg class="down-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v15m-5-5 5 5 5-5"/></svg>
        </button>
      </div>
    </header>
    <div class="showcase">
      <div class="player-shell" part="player" id="pricing-demo" role="group" aria-label="Smart Components™ interactive demonstration">
        <qc-pricing-animation aria-label="Create, test and understand Smart Components™"></qc-pricing-animation>
      </div>
      <div class="inputs-grid" part="benefits" role="list" aria-label="The information you bring">
        <div class="input-item" role="listitem">
          <span class="input-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9Z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9M8 5.25l8 4.5"/></svg></span>
          <div><h3>Your materials</h3><p>Products, quantities and costs.</p></div>
        </div>
        <div class="input-item" role="listitem">
          <span class="input-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/></svg></span>
          <div><h3>Your labour</h3><p>Rates and time that reflect your work.</p></div>
        </div>
        <div class="input-item" role="listitem">
          <span class="input-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 4v16M12 4v16M19 4v16M2 9h6m1 6h6m1-7h6"/></svg></span>
          <div><h3>Your pricing rules</h3><p>Measurement types, waste and pitch.</p></div>
        </div>
      </div>
      <footer class="closing" part="closing">
        <div class="knowledge-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5Z"/><path d="M7 3v6h9V3M7 21v-8h10v8m-7-4 1.5 1.5L15 15"/></svg></div>
        <div class="closing-copy"><h3>You bring the knowledge.</h3><p><span class="brand">Smart Components<sup class="tm" aria-hidden="true">™</sup></span> save it and handle the calculations.</p></div>
        <p class="closing-detail"><span>Set it up once.</span>Reuse it on every quote.</p>
      </footer>
    </div>
  </div>
</section>
`;
    this.animation=this.shadowRoot.querySelector('qc-pricing-animation');
    this._reduced=matchMedia('(prefers-reduced-motion: reduce)');
    this._connected=false;
    this._firstReady=false;
    this._raf=0;
    this.ready=new Promise(resolve=>{this._resolve=resolve;});
    this.shadowRoot.querySelector('.watch-link').addEventListener('click',()=>{
      const player=this.shadowRoot.querySelector('.player-shell');
      player.scrollIntoView({behavior:this._reduced.matches?'auto':'smooth',block:'start'});
      this.animation.replay();
      this.animation.r.heading.focus({preventScroll:true});
    });
  }
  connectedCallback() {
    if(this._connected)return;
    this._connected=true;
    this.animation.toggleAttribute('loop',this.hasAttribute('loop'));
    this._resize=new ResizeObserver(()=>{
      cancelAnimationFrame(this._raf);
      this._raf=requestAnimationFrame(()=>{
        const height=Math.ceil(this.getBoundingClientRect().height);
        if(height===this._height)return;
        this._height=height;
        this.dispatchEvent(new CustomEvent('quotecore-section-resize',{bubbles:true,composed:true,detail:{height}}));
      });
    });
    this._resize.observe(this);
    this.animation.ready.then(()=>{
      if(!this._connected)return;
      if(!this._firstReady){
        this._firstReady=true;
        if(this.hasAttribute('autoplay')&&!this.animation.reducedMotion)this.animation.play();
        this._resolve(this);
      }
    });
  }
  disconnectedCallback() {
    this._connected=false;
    this._resize?.disconnect();
    cancelAnimationFrame(this._raf);
  }
  play(){this.animation.play();}
  pause(){this.animation.pause();}
  replay(){this.animation.replay();}
  seek(time,options){this.animation.seek(time,options);}
  setVisibility(visible){this.animation.setVisibility(visible);}
}
if(!customElements.get('qc-smart-pricing-section'))customElements.define('qc-smart-pricing-section',QuoteCorePricingSection);

})();
