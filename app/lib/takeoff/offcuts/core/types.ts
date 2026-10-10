/** All input polygons are unclosed rings in unzoomed SCENE coordinates (y down).
 * Material regions use a face-local coordinate frame, in millimetres on the
 * roof surface. Effective cover and physical width are deliberately distinct. */
export interface Point { x: number; y: number }
export type Ring = Point[];
export type EdgeKind = 'ridge' | 'hip' | 'valley' | 'broken_hip' | 'barge' | 'spouting' | 'unknown';
export interface RoofEdge { id: string; a: Point; b: Point; kind: EdgeKind }
export interface Outline { id: string; name: string; polygon: Ring; suggestedPitchDeg?: number }
export interface RoofInput {
  schemaVersion: 1;
  quoteId: string; pageId: string; areaScopeId: string | null;
  imageRevision: string; sceneWidth: number; sceneHeight: number;
  /** Display only: never included in saved exports (signed URLs expire). */
  imageUrl?: string;
  mmPerSceneUnit: number;
  calibrationConfirmed: boolean;
  outlines: Outline[]; edges: RoofEdge[];
  sourceRevision: string;
  /** Face-review only; physical cut tolerances are unchanged. */
  draftingTolerance?: 'tight' | 'balanced' | 'relaxed';
  faceDetectionIgnoredEdgeIds?: string[];
  /** Review-only exception: keep these original measurements as distinct boundaries. */
  geometryKeepSeparateEdgeIds?: string[];
  /** Explicit recovery/reset tool; absent means automatic canonical linework. */
  geometryCleanupMode?: 'auto' | 'raw';
}
export interface Issue {
  severity: 'error' | 'warning'; code: string; message: string;
  faceId?: string; objectId?: string;
  location?: Point; suggestionId?: string;
}
export type Lap = -1 | 1; // relative to +u = {flow.y, -flow.x}: right when water points down
export interface RoofFace {
  id: string; name: string; polygon: Ring;
  boundary: RoofEdge[];
  flow: Point | null;
  lap: Lap; lapLocked: boolean;
  pitchDeg: number | null;
  /** Origin of the displayed vector; approval below is bound to exact reviewed geometry. */
  flowSource?: 'inferred' | 'manual';
  flowSuggestionBasis?: 'spouting-hint' | 'outer-boundary' | 'geometry-topology' | 'needs-review';
  /** Explicit review acknowledgement. Invalidated by changes to polygon/vector/labels. */
  directionApproval?: string;
  /** Phase measured from the local minimum cross-slope coordinate. */
  laneOffsetMm: number;
  /** Manual registration locks are respected by the bank search. */
  laneOffsetLocked?: boolean;
  confirmed: boolean; provenance: 'derived' | 'edited' | 'manual';
}
/** Exact linear upper/lower boundaries on one cross-sheet interval.
 * Regions consist of non-overlapping trapezoids, not a raster or bounding box.
 * This representation handles concavity, holes and disconnected Boolean output. */
export interface Band { x0: number; x1: number; top0: number; top1: number; bottom0: number; bottom1: number }
export type Region = Band[];
export interface Profile {
  id: string; coverMm: number;
  /** Additional physical metal on each side of the effective-cover cell. */
  leftLapMm: number; rightLapMm: number;
  /** Longitudinal trimming clearance, not a manufacturer-specific blade kerf. */
  cutGapMm: number;
  endAllowanceMm: number;
  maxLengthMm: number;
  lengthIncrementMm: number;
  allowEndForEnd: boolean;
  /** Must reflect a roofer/manufacturer-approved profile rule, not AI inference. */
  rulesConfirmed: boolean;
}
export interface SolveSettings {
  /** Additional bounded donor portfolios; missing enables opportunity-triggered search. */
  globalBankSearch?: boolean;
  globalBankMaxMilliseconds?: number;
  stockMode: 'bank-first' | 'per-lane' | 'face-envelope';
  /** Bounded, explicitly reported extra stock at the upstream end of cut lanes. */
  maxBankExtensionMm?: number;
  /** Maximum distinct original cutting blocks on an automatic destination.
   * One coherent source is preferred; two separated sets are allowed. */
  maxSourceBlocksPerFace?: number;
  /** Requested overlap into the valley for a self-fill donor run. Not spares. */
  selfFillTransitionMm?: number;
  /** Quoting sensitivity: one COMMON cross-sheet phase band per valley parent.
   * Fixed registration is an explicit site-setout assumption, not a silent default. */
  receiverPhaseMode?: 'quote-safe' | 'fixed-registration';
  /** Total source phase band as a fraction of one effective cover (0..1).
   * The default is +/- half a cover, not two unrelated full-cover allowances. */
  receiverPhaseCoverFraction?: number;
  /** Conservative destination-only replay. Missing = enabled; false keeps the V2.15 search. */
  provisionalReuse?: boolean;
  /** Additional replay budget, 0..20000 ms. Does not enlarge the bank-search budget. */
  provisionalMaxMilliseconds?: number;
  optimiseLapDirections: boolean;
  maxTrials: number; maxMilliseconds: number; maxSheets: number;
}
export const DEFAULT_PROFILE: Profile = {
  id: 'unverified-profile', coverMm: 760, leftLapMm: 0, rightLapMm: 0,
  cutGapMm: 5, endAllowanceMm: 0, maxLengthMm: 18000,
  lengthIncrementMm: 1, allowEndForEnd: true, rulesConfirmed: false,
};
export const DEFAULT_SETTINGS: SolveSettings = {
  stockMode: 'bank-first', optimiseLapDirections: true, maxBankExtensionMm: 100,
  maxSourceBlocksPerFace: 2, selfFillTransitionMm: 100, receiverPhaseMode: 'quote-safe', receiverPhaseCoverFraction: 1,
  maxTrials: 32, maxMilliseconds: 4000, maxSheets: 600,
};
export interface FaceFrame {
  origin: Point; u: Point; v: Point; mmPerSceneUnit: number; pitchCos: number;
}
export interface Demand {
  id: string; faceId: string; laneIndex: number; lap: Lap;
  widthMm: number; origin: Point; frame: FaceFrame;
  /** Physical footprint includes configured side overlaps and end allowances. */
  required: Region;
  /** Non-overlapping net roof cover, for checking complete roof coverage. */
  cover: Region;
  blank: Region;
  stockRole?: 'primary-cut' | 'filler' | 'supplement';
  /** Only hip/valley/broken-hip cuts enter reusable inventory. */
  reusableCut?: boolean;
  /** Canonically verified removal of nonproductive square stock, never a shorter offcut family. */
  stockEndProof?: import('./stockEnds').StockEndProof;
  /** Shape-derived upper/lower cuts in this physical sheet's local millimetres. */
  cutEdges?: RoofEdge[];
  materialBankId?: string;
  /** Planning role is independent of whether the final sheet has angled cuts. */
  zoneRole?: 'ridge-fill' | 'cut-zone';
  ridgeOverlapMm?: number;
  /** Portion of this cover cell lying on the face's actual spouting run. */
  eaveOverlapMm?: number;
}

export interface Offcut {
  id: string; sourceDemandId: string; sourceFaceId: string; region: Region;
  widthMm: number; lap: Lap;
  /** Immediate cutting operation; root identity survives subsequent reuse. */
  rootDemandId?: string;
  rootBankId?: string;
  parentOffcutId?: string;
  generation?: number;
  cutSetId?: string;
  cutKind?: 'hip' | 'valley' | 'broken_hip';
  sourceLaneIndex?: number;
  sourceCrossMm?: number;
  /** Geometric arm of the lower cut, in the source's local sheet frame.
   * An apex-spanning physical piece remains ONE piece, not two ideal triangles. */
  cutArm?: 'negative' | 'positive' | 'apex';
}
export interface Placement {
  demandId: string;
  kind: 'new' | 'reuse';
  offcutId?: string;
  /** Only material-valid transformations are searched. No mirror or scaling. */
  rotation: 0 | 180;
  translateY: number;
  /** Geometric prototype edits are kept and visibly invalidated, never hidden. */
  manual?: boolean;
}
/** A purchasing/planning family, NOT a union of the physical roof polygons.
 * Separate runs stay separate; no area is removed by projection/occlusion. */
export interface MaterialBank {
  id: string; faceIds: string[]; flow: Point; pitchDeg: number;
  cutLengthMm: number; crossMinMm: number; crossMaxMm: number;
}
export interface BankLayout {
  /** Only IDs, never user-supplied blank dimensions. Canonical regeneration recomputes every shorter blank.
   * Missing retains historical bank-envelope behaviour for existing saved plans. */
  stockEndRefinement?: { model: 'preserve-cut-ends-v1'; demandIds: string[] };
  primaryFaceIds: string[];
  laneOffsetByFace: Record<string, number>;
  /** Extra length applies to angled primary cuts, not short straight fillers. */
  extraLengthByFace: Record<string, number>;
  materialBanks?: MaterialBank[];
  cutLengthByFace?: Record<string, number>;
  /** Geometry-derived donor-zone choices, reported instead of hidden allowances. */
  selfFillFaceIds?: string[];
  /** Downstream stock extension is shared by every angled lane in the cutting block. */
  tailExtensionByFace?: Record<string, number>;
  primarySequence?: string[];
  /** Dedicated local receiver starter length; not a new main elevation bank. */
  receiverStockLengthByFace?: Record<string, number>;
  /** Real common-grid purchasing operations; not every parallel face is joined. */
  primaryOperations?: { id: string; bankId: string; faceIds: string[]; phaseMm: number; stockLengthMm: number; coverStations?: import('./bankLanes').CoverStationPlan; oneRootPerColumn?: boolean }[];
}
export interface Solution {
  schemaVersion: 1; sourceRevision: string; facesRevision: string;
  engineVersion?: '2.4' | '2.5' | '2.6' | '2.7' | '2.8' | '2.9' | '2.10' | '2.11' | '2.12' | '2.13' | '2.14' | '2.15' | '2.16' | '2.17' | '2.18' | '2.19' | '2.20' | '2.21' | '2.22' | '2.23';
  layoutId?: string;
  layoutLabel?: string;
  objective?: PlanObjective;
  comparison?: PlanComparison;
  decisionTrace?: DecisionTrace;
  profile: Profile; settings: SolveSettings;
  demands: Demand[]; offcuts: Offcut[]; placements: Placement[];
  lapByFace: Record<string, Lap>;
  /** Selected geometric stock/registration model; revalidated on draft review. */
  bankLayout?: BankLayout;
  metrics: {
    newMaterialMm2: number; baselineNewMaterialMm2: number;
    netRoofMm2: number; installedPhysicalMm2: number; wasteMm2: number;
    savedMm2: number; newSheetCount: number; reusedPieceCount: number;
  };
  search: { method: 'bounded-multistart' | 'bank-first' | 'material-banks'; completedTrials: number; elapsedMs: number; budgetReached: boolean; provenOptimal: false };
  issues: Issue[];
  status: 'prototype-review' | 'invalid';
  /** V1 never produces an approved manufacturing/order list. */
  orderReady: false;
  receiverSafety?: import('./receiverSafety').ReceiverSafetyReport;
  globalDonorSearch?: import('./globalBanks').GlobalBankReport;
  provisionalReuse?: import('./provisionalReuse').ProvisionalReuseReport;
  /** Post-plan purchasing audit; quantities/UI are independently derived from canonical demands. */
  stockLengthRefinement?: import('./stockLength').StockLengthReport;
  /** Optional terminal-filler substitutions; original plan remains a separate saved plan. */
  salvage?: import('./salvageModel').SalvageCertificate;
}
export interface SolveRequest { roof: RoofInput; faces: RoofFace[]; profile: Profile; settings: SolveSettings }
export interface Draft {
  schemaVersion: 1; roof: RoofInput; faces: RoofFace[];
  profile: Profile; settings: SolveSettings; solution: Solution | null;
  exportedAt?: string;
  reviewNotes?: Issue[];
  /** Diagnostic only. Geometry authority remains the reviewed polygons. */
  geometryReview?: import('./geometryPolicy').GeometryCleanupReport;
  /** UI acknowledgements, bound to geometry/rules; never bypass errors. */
  dismissedWarnings?: string[];
  /** Local review meanings, never written back to the component library. */
  componentBoundaryOverrides?: Record<string, EdgeKind | 'ignore'>;
}


/** Planner objectives, not AI confidence or manufacturing approval. */
export type PlanObjective = 'recommended' | 'simpler' | 'less-material';
export interface PlanQuality {
  suppliedMm2: number; newSheets: number; reusedPositions: number;
  sourceRelationships: number; reuseRuns: number; splitSets: number;
  recutOperations: number; fillerSeparators: number; primaryOperations: number;
  /** Explicit site-complexity proxy. Lower is simpler, not a measured labour time. */
  complexity: number;
}
/** V2.14 workflow proxy: repeated sheet cuts are grouped into runs.
 * These are observable operation groups, NOT measured labour time. */
export interface WorkflowQuality {
  model: 'site-workflow-v1' | 'coherent-workflow-v2';
  sourceRelationships: number; splitSets: number; reuseRuns: number;
  recutRuns: number; freshCutRuns: number; fillerSeparators: number;
  primaryOperations: number; stockLengthGroups: number; score: number;
}
export interface SimplerAssessment {
  accepted: boolean;
  reason: 'within-policy' | 'material-limit' | 'extra-sheet-limit' | 'no-workflow-benefit' | 'insufficient-workflow-improvement';
  baselineLayoutId: string;
  maxExtraPercent: number; maxExtraCoverAreaM2: number; maxExtraNewSheets: number;
  baselineLinealM: number; proposedLinealM: number; extraLinealM: number;
  extraCoverAreaM2: number; extraNewSheets: number;
  previousWorkflow: WorkflowQuality; proposedWorkflow: WorkflowQuality;
  minimumScoreReduction: number; scoreReduction: number;
  benefits: string[];
}
/** Bounded material saving is measured in effective-cover m², never prices or
 * percentage of the roof. These are product guardrails, not labour estimates. */
export type MaterialSavingTier = 'equivalent' | 'very-small' | 'small' | 'moderate';
export type WorkflowMetric = Exclude<keyof WorkflowQuality, 'model' | 'score'>;
export interface MaterialSavingAssessment {
  policy: 'material-trade-off-v1';
  accepted: boolean;
  reason: 'within-policy' | 'insufficient-material-saving' | 'workflow-budget' | 'workflow-limit' | 'reuse-depth-limit';
  baselineLayoutId: string;
  tier: MaterialSavingTier;
  baselineCoverAreaM2: number; proposedCoverAreaM2: number;
  baselineLinealM: number; proposedLinealM: number;
  savedCoverAreaM2: number; savedLinealM: number; newSheetDelta: number;
  minimumSavingM2: number; strongSavingM2: number;
  previousWorkflow: WorkflowQuality; proposedWorkflow: WorkflowQuality;
  workflowDelta: Record<WorkflowMetric, number>;
  previousReuseDepth: number; proposedReuseDepth: number;
  /** Increases cannot be cancelled out by improvements elsewhere. */
  addedWorkPoints: number; maxAddedWorkPoints: number;
  maxIncreases: Record<WorkflowMetric, number>;
  maxAdditionalReuseDepth: number; maximumReuseDepth: number;
  exceededLimits: string[];
}
export interface PlanComparison {
  objective: 'simpler' | 'less-material'; previousLayoutId: string;
  previous: PlanQuality; proposed: PlanQuality;
  suppliedDeltaMm2: number; newSheetDelta: number; complexityDelta: number;
  changedFaceIds: string[];
  /** Final, physically checked trade-off against Recommended, never an accumulating allowance. */
  simplification?: SimplerAssessment;
  materialSaving?: MaterialSavingAssessment;
}
export interface TraceEvent {
  step: number; action: string; message: string;
  faceIds?: string[];
  /** Measured values, rule outcomes and actual enumerated candidates only. */
  data?: Record<string, unknown>;
}
export interface TraceCandidate {
  trial: number; seedFaceId: string; objective: PlanObjective;
  signature: string; quality: PlanQuality; completed: boolean;
  selected: boolean; reason: string;
  evaluationStage?: 'bank-search' | 'final-physical';
  simplification?: SimplerAssessment;
  materialSaving?: MaterialSavingAssessment;
}
export interface DecisionTrace {
  schemaVersion: 1; engineVersion: '2.13' | '2.14' | '2.15' | '2.16' | '2.17' | '2.18' | '2.19' | '2.20' | '2.21' | '2.22' | '2.23'; requestFingerprint: string;
  objective: PlanObjective; selectedTrial: number | null;
  events: TraceEvent[]; candidates: TraceCandidate[];
  truncated: boolean; droppedEvents: number;
  budgetReached: boolean; elapsedMs: number;
  scope: 'actual-selected-search';
  /** A trace describes the generated plan; later manual edits make it historic. */
  historic?: boolean;
}
export interface AlternativePlanOptions {
  objective: 'simpler' | 'less-material';
  /** Compatible Recommended anchor for either objective, not the currently displayed alternative. */
  previous: Solution;
  /** Full solutions are not needed to exclude plans already shown. */
  excludedSignatures?: string[];
  attempt?: number;
  /** Optional tighter limit (0–3%). Also capped at 10 m² effective cover and a small sheet increase. */
  maxExtraMaterialPercent?: number;
}
export interface AlternativePlanResult {
  status: 'found' | 'no-better-distinct-plan';
  solution: Solution | null; comparison: PlanComparison | null;
  trace: DecisionTrace; message: string;
}
