/** A small dependency-free, UTF-8, STORE-mode ZIP. No executable content and
 * no account mutation. ZIP entries are bounded and cannot escape the archive. */
import { quoteQuantityProposal, quantitySummary } from './quantities';
import { rootSheetLedger, purchaseLedgerCsv } from './purchaseLedger';
import { installationInstructions } from './installationPlan';
import { exportDraft } from './codec';
import type { Draft } from './types';
const encoder = new TextEncoder();
function crc32(bytes: Uint8Array): number {
  let n = 0xffffffff;
  for (const byte of bytes) { n ^= byte; for (let b=0; b<8; b++) n = (n >>> 1) ^ ((n & 1) ? 0xedb88320 : 0); }
  return (n ^ 0xffffffff) >>> 0;
}
export function textZip(files: Record<string,string>): Uint8Array {
  const parts: Uint8Array[] = [], directory: Uint8Array[] = []; let offset=0, size=0;
  const entries=Object.entries(files); if (!entries.length || entries.length > 100) throw new Error('Invalid export file count.');
  for (const [name,text] of entries) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(name) || name.split('/').some(x=>x==='..')) throw new Error('Unsafe export path.');
    const path=encoder.encode(name), bytes=encoder.encode(text), crc=crc32(bytes);
    size+=bytes.length; if(size>32_000_000)throw new Error('The export is too large. Export diagnostics separately.');
    const local=new Uint8Array(30+path.length), v=new DataView(local.buffer);
    v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint16(12,33,true);
    v.setUint32(14,crc,true);v.setUint32(18,bytes.length,true);v.setUint32(22,bytes.length,true);v.setUint16(26,path.length,true);local.set(path,30);
    const central=new Uint8Array(46+path.length), c=new DataView(central.buffer);
    c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x800,true);c.setUint16(14,33,true);
    c.setUint32(16,crc,true);c.setUint32(20,bytes.length,true);c.setUint32(24,bytes.length,true);c.setUint16(28,path.length,true);c.setUint32(42,offset,true);central.set(path,46);
    parts.push(local,bytes);directory.push(central);offset+=local.length+bytes.length;
  }
  const directorySize=directory.reduce((n,a)=>n+a.length,0), end=new Uint8Array(22), e=new DataView(end.buffer);
  e.setUint32(0,0x06054b50,true);e.setUint16(8,entries.length,true);e.setUint16(10,entries.length,true);e.setUint32(12,directorySize,true);e.setUint32(16,offset,true);
  const result=new Uint8Array(offset+directorySize+22);let at=0;
  for(const part of [...parts,...directory,end]) { result.set(part,at);at+=part.length; }
  return result;
}
function escape(s: unknown):string { return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!)); }
export function cutPlanPackage(draft: Draft, svg: string): Uint8Array {
  const cover=quoteQuantityProposal(draft,'cover-square-metres'), lineal=quoteQuantityProposal(draft,'lineal-metres');
  const s=draft.solution!, q=quantitySummary(s), ledger=rootSheetLedger(s);
  // The host-rendered SVG may reference an authenticated/signed background image.
  // Omit background images from a portable package; retain canonical vector plan.
  const portableSvg=svg.replace(/<image\b[^>]*(?:\/>|>[\s\S]*?<\/image>)/gi,'');
  const guide=installationInstructions(draft,s);
  const heading=escape(s.layoutLabel || 'Selected cut plan');
  const summary=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>QuoteCore cut plan</title><style>body{font:16px system-ui;max-width:1000px;margin:32px auto;padding:0 20px;line-height:1.5}img{width:100%}table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:8px;border-bottom:1px solid #ddd}pre{white-space:pre-wrap}small{display:block}@media print{body{margin:0;font-size:11pt}img{max-height:65vh}pre{break-before:page}}</style><h1>${heading}</h1><p><strong>${q.newSheetCount} purchased sheets · ${q.purchasedLinealM.toFixed(3)} lm · ${q.suppliedCoverAreaM2.toFixed(3)} m² effective cover</strong><small>Net roof: ${q.netRoofAreaM2.toFixed(3)} m². Effective sheet cover: ${s.profile.coverMm} mm. Layout: ${escape(s.layoutId)} · Engine ${escape(s.engineVersion)}</small></p><p>Draft estimate only. Confirm profile, laps and site measurements before ordering. Pitch and configured cutting allowances are already included; no general spares are included.</p><img src="selected-plan.svg" alt="Selected physical sheet and offcut layout"><h2>Purchased stock</h2><table><thead><tr><th>Source</th><th>Sheets</th><th>Length (m)</th><th>Total (lm)</th></tr></thead><tbody>${ledger.stockSchedule.map(r=>`<tr><td>${escape(draft.faces.find(f=>f.id===r.faceId)?.name||r.faceId)}</td><td>${r.count}</td><td>${r.lengthM.toFixed(3)}</td><td>${r.linealM.toFixed(3)}</td></tr>`).join('')}</tbody></table><h2>Installation and source notes</h2><pre>${escape(guide)}</pre></html>`;
  return textZip({
    'READ-ME.txt':'Open cut-plan.html for the printable summary and selected-plan.svg for the drawing.\nThe ZIP contains only the selected plan, not alternative plans or quote prices.\nmaterial-quantities.json offers both effective-cover m² and purchased lm. Use the matching component rate; do not add pitch or configured waste again.\nselected-review.json preserves the selected plan and physical parent/child lineage. Importing a portable draft requires fresh face review; it does not silently approve saved cuts.\nThis package does not update the quote, upload a PDF, or approve a manufacturing order.\n',
    'cut-plan.html':summary, 'selected-plan.svg':portableSvg,
    'new-sheets.csv':purchaseLedgerCsv(ledger), 'purchase-ledger.json':JSON.stringify(ledger,null,2),
    'material-quantities.json':JSON.stringify({cover,lineal},null,2),
    'selected-review.json':exportDraft(draft), 'installation-notes.txt':guide,
  });
}
