import type { Draft, RoofFace } from '../core/types';
import { sharedNeighbours } from '../core/sharedEditing';
import { escapeHtml as esc } from './svg';

export function cleanupPanel(draft: Draft): string {
  const report = draft.geometryReview;
  if (!report?.enabled || !report.changes.length) return '';
  const counts = (kind: string) => report.changes.filter(c => c.kind === kind).length;
  return `<details id="qc-geometry-cleanup" class="qc-geometry-cleanup"><summary>Geometry cleaned · review changes</summary>
    <p>${counts('outline-alignment')} perimeter measurements aligned · ${counts('duplicate-line')} duplicate groups combined · ${counts('shared-junction')} junctions joined.</p>
    <p class="qc-muted">Your master outline and original takeoff measurements are unchanged. Only the offcut review is cleaned. A real narrow roof section can be kept separate below.</p>
    ${report.edited ? '<p class="qc-muted">You have edited this review. Rebuilding linework asks before replacing edits; Undo restores them.</p>' : ''}
    ${report.changes.filter(c => c.kind !== 'shared-junction').map(c => `<div class="qc-cleanup-row"><span>${c.kind === 'outline-alignment' ? 'Perimeter alignment' : 'Shared internal line'} · ${c.maxMoveMm.toFixed(1)} mm</span><div class="qc-actions"><button data-action="show-cleanup" data-id="${esc(c.id)}">Show</button><button data-action="keep-cleanup-separate" data-id="${esc(c.id)}">Keep separate</button></div></div>`).join('')}
    <button data-action="hide-cleanup">Hide comparison</button>
    ${report.keptSeparateIds.length ? '<button data-action="reset-cleanup-exceptions">Reset kept-separate exceptions</button>' : ''}</details>`;
}
export function sharedEditPanel(draft: Draft, face: RoofFace | undefined, editing: boolean, mode: 'split' | 'merge' | null): string {
  if (!face) return '';
  const adjacent = sharedNeighbours(draft.roof, draft.faces, face.id);
  return `<section id="qc-shared-edit" class="qc-shared-edit"><div class="qc-actions"><button data-action="edit-boundaries" aria-pressed="${editing}">${editing ? 'Done editing' : 'Edit boundaries'}</button><button data-action="split-on-plan" aria-pressed="${mode === 'split'}">Split on plan</button></div>
    ${editing ? '<p class="qc-muted">Drag a corner or a square edge handle. Neighbours follow the same shared boundary. Outer corners stay on your master outline. Alt temporarily bypasses snapping.</p>' : ''}
    ${adjacent.length && !editing && !mode ? '<button data-action="merge-on-plan">Join to neighbour</button>' : ''}
    ${mode ? `<p role="status">${mode === 'split' ? 'Click two points on this face’s boundary to split it.' : 'Click the neighbouring face to join.'}</p><button data-action="cancel-geometry-tool">Cancel</button>` : ''}
    ${adjacent.length && (editing || mode === 'merge') ? `<label class="qc-field">Join with neighbour<select id="qc-neighbour">${adjacent.map(id => `<option value="${esc(id)}">${esc(draft.faces.find(f => f.id === id)?.name ?? id)}</option>`).join('')}</select></label><div class="qc-actions"><button data-action="join-neighbour">Join selected neighbour</button><button data-action="merge-on-plan">Pick neighbour on plan</button></div>` : ''}
    <p class="qc-muted">Join removes a false division without leaving a hole. Undo restores any edit.</p></section>`;
}
export const geometryStyles = `
.qc-geometry-cleanup{border:1px solid #cdd4db;border-radius:10px;padding:10px;margin:10px 0;background:#f6f8fa}
.qc-geometry-cleanup summary{font-weight:650;cursor:pointer;font-size:12px}
.qc-cleanup-row{padding:9px 0;border-top:1px solid #e1e5e9;font-size:12px}
.qc-cleanup-row .qc-actions{margin-top:7px}
.qc-shared-edit{margin:10px 0;border-top:1px solid #d8dfe5;padding-top:10px}
.qc-shared-edit p{font-size:12px;line-height:1.5}
.qc-canvas[data-review-tool="split"],.qc-canvas[data-review-tool="merge"]{cursor:crosshair}
[data-review-edge]{cursor:move}[data-vertex]{cursor:grab}[data-fixed-node="true"]{cursor:not-allowed}
`;
