import type { PortfolioReport } from '../core/portfolio';
export const EXPORT_PROTOCOL='qc-offcuts-export-v223';
import type { Draft, Issue, RoofInput, Solution, DecisionTrace } from '../core/types';
import type { LiveInputCapture } from '../adapters/liveSnapshot';
import { exportLiveCapture } from '../adapters/liveSnapshot';
import { exportDraft } from '../core/codec';
import { auditFaceBehaviour, FACE_GEOMETRY_MODEL } from '../core/faceGeometry';
import { draftingPolicy, type BoundaryRepair, type DrawingAdjustment } from '../core/drafting';
import { quantitySummary, type QuantitySummary } from '../core/quantities';
import { bankLaneAudit, purchaseOperations } from '../core/bankLanes';
import { rootSheetLedger } from '../core/purchaseLedger';
import { stockLengthRows } from '../core/stockLength';
import type { SalvageResult, SalvageSearchReport } from '../core/salvageModel';
import type { SaveState } from '../persistence/reviews';
import type { CalculationJournal } from './protocol';
export interface DiagnosticInput {
  phase: 'faces'|'solution'; draft: Draft; sourceRoof: RoofInput; capture?: LiveInputCapture;
  persistence: { kind: string; state: SaveState|null; takeoffCheckpoint?: unknown };
  calculation: CalculationJournal|null; initialDetection: unknown; selectedPlanIndex: number;
  issues: Issue[]; repairs: BoundaryRepair[]; drawingAdjustments: DrawingAdjustment[]; stale: boolean;
  selectedSectionId: string; lastSearchTrace: DecisionTrace|null; layouts: Solution[];
  lastSalvageSearch: SalvageSearchReport|null;
  salvagePreview: { previewOnly: true; result: SalvageResult; baseLayoutId?: string; viewingBase: boolean }|null;
  uiPerformance: unknown;
  portfolio?:PortfolioReport|null;
}
/** Called in the export worker. This is a report of a captured state, never
 * permission to apply a result or bypass validation. Signed URLs are stripped. */
export function buildDiagnosticData(input: DiagnosticInput) {
  const source = structuredClone(input.sourceRoof); delete source.imageUrl;
  const d = input.draft, s = d.solution;
  const cache = new Map<Solution, QuantitySummary>();
  const q = (plan: Solution) => { let value=cache.get(plan); if(!value){value=quantitySummary(plan);cache.set(plan,value);}return value; };
  return { schemaVersion: 1, kind: 'quotecore-offcut-debug', engineVersion: '2.23', phase: input.phase, planningModel: FACE_GEOMETRY_MODEL,
    boundaryBehaviour: auditFaceBehaviour(d.faces), liveInputSnapshot: input.capture ? JSON.parse(exportLiveCapture(input.capture)) : null,
    persistence: input.persistence, calculation: input.calculation, uiPerformance: input.uiPerformance,
    sourceRoofAtOpen: source, initialDetection: input.initialDetection,
    inputEvidence: input.capture ? 'live-workspace-capture' : 'direct-roof-input; host adapter evidence not supplied',
    selectedPlanIndex: input.selectedPlanIndex, approvedDraft: JSON.parse(exportDraft(d)),
    reviewDiagnostics: { issues: input.issues, repairs: input.repairs, drawingAdjustments: input.drawingAdjustments,
      ignoredWarnings: d.dismissedWarnings??[], componentBoundaryOverrides: d.componentBoundaryOverrides??{}, policy: draftingPolicy(d.roof), stale: input.stale },
    quantitySummary: s?q(s):null, bankCoverage:s?bankLaneAudit(s):null,purchaseOperations:s?purchaseOperations(s):null,
    purchaseLedger:s?rootSheetLedger(s):null, receiverSafety:s?.receiverSafety??null, selectedSectionId:input.selectedSectionId,
    selectedTrace:s?.decisionTrace??null,lastAlternativeSearch:input.lastSearchTrace,
    portfolio:input.portfolio??null,globalDonorSearch:s?.globalDonorSearch??null,stockLengthRefinement:s?.stockLengthRefinement??null,stockEndRows:s?stockLengthRows(s):[],
    lastSalvageSearch:input.lastSalvageSearch,salvagePreview:input.salvagePreview,
    sessionPlans:input.layouts.map(p=>({layoutId:p.layoutId,objective:p.objective,metrics:p.metrics,
      quantities:{purchasedLinealM:q(p).purchasedLinealM,suppliedCoverAreaM2:q(p).suppliedCoverAreaM2},
      comparison:p.comparison,salvage:p.salvage,solution:p,decisionTrace:p.decisionTrace??null})) };
}
