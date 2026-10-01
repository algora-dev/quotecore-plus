'use client';
import { useState, useRef, useEffect, useCallback, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { QcHostedButton, QcHostedDialog, QcHostedDialogScope } from '@/app/components/ui/v2/QcHostedDialog';
import { QcCanvasToolbar, QcCanvasToolGroup, QcToolButton } from '@/app/components/ui/v2/QcCanvasChrome';
import { QcIcon } from '@/app/components/ui/v2/QcIcon';
import { QcStatusBadge } from '@/app/components/ui/v2/QcSurface';
import { Canvas, FabricImage, Line, Circle, Polygon, Triangle, Rect } from 'fabric';
import type { QuoteRow } from '@/app/lib/types';
import { normalizeMeasurementSystem } from '@/app/lib/types';
import { toolForMeasurementType } from '@/app/lib/takeoff/tool-for-measurement-type';
import { useStateHistory } from '@/app/lib/takeoff/useStateHistory';
import { applyAiResults, computeAreaValue, type AiScanData, type AiMeasurement, type AiRoofAreaResult } from '@/app/lib/takeoff/applyAiResults';
import { type SemanticKey, getSemanticColour, getLineOptions, buildSystemComponentIds, resolveSemanticKey, AI_COMPONENT_REGISTRY } from '@/app/lib/takeoff/aiComponentRegistry';
import { getAiScanPointCost } from '@/app/lib/takeoff/pointCost';
import { AiResultsModal, type AiResultsData, type AiResultsArea } from './modals/AiResultsModal';
import { createSingleFlight } from '@/app/lib/takeoff/precision/touchSaveFlight';
import type { TouchOutlineAdapter, TouchCreateResult } from '@/app/lib/takeoff/precision/TouchOutlineEditor';
import type {
  AiOutlineScanInfo,
  AiOutlineScanResult,
} from '@/app/lib/takeoff/precision/touchAiOutline';
import { outlineDependentRecompute, type SavedOutlineRecord } from '@/app/lib/takeoff/precision/touchOutlines';
import { cornerTotalsAcross, cornerSelection, cornerValueBasis, isCornerValueBasis, type CornerBasis } from '@/app/lib/takeoff/cornerCount';

/** Measurement types whose entries are counts (draw mode = single-tap
 *  point). Corner counting applies to these (2026-09-30). */
const POINT_LIKE_MT = new Set(['count', 'quantity', 'fixed', 'hours_days', 'point']);
import { drawModeForMeasurementType, groupsFromEntries, polygonAreaCanvas, type TouchComponentEntry, type TouchComponentGroup, type TouchComponentScanResult, type TouchComponentScanStage, type TouchComponentTarget } from '@/app/lib/takeoff/precision/touchComponents';
import type { RecomputeMeasurementRecord } from '@/app/lib/takeoff/calibrationRecompute';
import { usePdfPagePicker } from '@/app/components/PdfPagePicker';
import { PitchInput } from '@/app/components/PitchInput';
import { reconstructCanvas } from '@/app/lib/takeoff/reconstructCanvas';
import type { TakeoffHydrationData } from './actions';
import { useTakeoffActions } from '@/app/lib/takeoff/actionsContext';
import type { TakeoffFinishPayload } from '@/app/lib/takeoff/finishPayload';
// Offcuts V1: isolated review module; no quote/persistence changes.
import type { QuoteCoreSnapshot } from '@/app/lib/takeoff/offcuts/adapters/quotecore';
import type { WorkbenchHandle } from '@/app/lib/takeoff/offcuts/ui/workbench';
import { fingerprint as offcutFingerprint } from '@/app/lib/takeoff/offcuts/core/math';
import { AlertModal } from '@/app/components/AlertModal';
import { ConfirmModal } from '@/app/components/ConfirmModal';
import { StorageBlockedModal } from '@/app/components/billing/StorageBlockedModal';
import { getTradeLabels } from '@/app/lib/trades/labels';
import { convertLinearToMetric, convertAreaFt2ToMetric } from '@/app/lib/measurements/conversions';
import { rafterPitchFactor } from '@/app/lib/pricing/engine';
// F-15: Extracted modal components
import { AreaNameModal } from './modals/AreaNameModal';
import { PointMeasurementModal } from './modals/PointMeasurementModal';
import { LineMeasurementModal } from './modals/LineMeasurementModal';
import { CalibrationModal } from './modals/CalibrationModal';
import { RoofPitchEstimatorModal } from './modals/RoofPitchEstimatorModal';
// Viewport pattern (2026-09-26): shared zoom/pan math for the takeoff canvas.
import { computeFitVpt, clampVpt, panVpt, zoomVptAtPoint, isSceneClipped, type Vpt } from './canvasViewport';
// P2/P6 AI-assisted calibration (flag-gated, live search via /api/takeoff/calibration)
import { CalibrationReviewPanel } from './calibration/CalibrationReviewPanel';
import type { CalibrationStartMode } from './calibration/useCalibrationController';
import type { WorkingUnit, CalibrationImageDescriptor, AcceptedReferenceDraft } from '@/app/lib/takeoff/calibrationTypes';
import { convertToWorkingUnit } from '@/app/lib/takeoff/calibrationCandidates';
import { buildSourceToScene } from '@/app/lib/takeoff/calibrationCoordinates';
// P3: unit-normalised effective scale + deterministic recalibration recompute.
import {
  computeEffectiveCalibration,
  effectiveScaleFromLegacyCalibrations,
  type CalibrationReferenceInput,
} from '@/app/lib/takeoff/calibration';
import { computeCalibrationRecompute } from '@/app/lib/takeoff/calibrationRecompute';
// Phase B (calibration hardening audit 2026-09-20): explicit commit contract,
// metadata cache rollback, draft-until-commit recalibration, provenance stamping.
import {
  applyDraftCalibration,
  cancelDraftRecalibration,
  commitFailed,
  commitSucceeded,
  restoreMetadataEntry,
  snapshotMetadataEntry,
  stampSourceProvenance,
  startDraftRecalibration,
  type CalibrationCommitResult,
  type DraftCalibrationState,
} from '@/app/lib/takeoff/calibrationCommit';
// P0-1/P0-5 (calibration hardening audit 2026-09-20): pure per-page
// calibration resolution - a page only ever restores its OWN stored scale.
import { resolvePageCalibration, shouldTrustCalibrationMetadata } from '@/app/lib/takeoff/calibrationPageState';
// P0-2: overlay teardown when the AI calibration session is aborted on page switch.
import { disposeCalibrationOverlay } from './calibration/calibrationOverlay';
// P4: versioned calibration persistence codec (takeoff_pages.calibration_metadata).
import {
  decodeCalibrationMetadata,
  encodeCalibrationMetadata,
  type CalibrationMetadataV1,
} from '@/app/lib/takeoff/calibrationCodec';

// Extend Fabric.js Canvas type with custom properties
declare module 'fabric' {
  interface Canvas {
    isDragging?: boolean;
    lastPosX?: number;
    lastPosY?: number;
  }
}

interface Component {
  id: string;
  name: string;
  measurement_type?: string | null; // matches ComponentLibraryRow field name (nullable in DB)
  /** Named library (component_collections.id) this component belongs to. Null = unfiled. */
  collection_id?: string | null;
  /** @deprecated alias kept for any callers that used the old name */
  default_measurement_type?: string;
  /** System placeholder components (AI Takeoff) - hidden from manual add selector. */
  is_system?: boolean;
}

interface ComponentCollection {
  id: string;
  name: string;
}

/** Sentinel for the "All components" option in the library selector. */
const ALL_LIBRARIES = '__all__';

interface ComponentColor {
  componentId: string;
  color: string;
}

interface RoofArea {
  id: string;
  name: string;
  points: { x: number; y: number }[];
  area: number; // in square feet or meters
  pitch: number; // in degrees
  visible: boolean;
  polygon?: any; // fabric.js polygon object
  markers?: any[]; // fabric.js marker objects
  /** RC-6 (2026-07-05): DB page_id this area came from (hydration). Undefined
   *  for newly drawn areas (they belong to the current page). Used to filter
   *  cross-page areas out of saves, mirroring ComponentMeasurement.fromPageId. */
  fromPageId?: string | null;
  /** Area-ownership fix (2026-07-05): DB quote_roof_areas.id this polygon
   *  belongs to, stamped at DRAW time (not save time). Prevents polygons
   *  being re-stamped to whatever area is active when the save fires. */
  quoteRoofAreaId?: string | null;
}

interface ComponentMeasurement {
  id: string;
  type: 'line' | 'area' | 'point' | 'multi_lineal' | 'multi_lineal_lxh' | 'volume_3d' | 'length_x_height_freestyle' | 'multi_lineal_lxh_freestyle';
  value: number; // length (ft/m) or area (sq ft/m)
  points?: { x: number; y: number }[];
  visible: boolean;
  canvasObjects?: any[]; // fabric.js objects
  /** The DB page_id this measurement came from. Set during hydration so that
   *  cross-page saves don't re-save other pages' measurements under the wrong
   *  page. Undefined for newly drawn measurements (they get the current page). */
  fromPageId?: string | null;
  /** Area-ownership fix (2026-07-05): DB quote_roof_areas.id this measurement
   *  belongs to, stamped at DRAW time via activeAreaIdRef. Save paths use this
   *  instead of the save-time activeAreaId, so creating a new area no longer
   *  re-assigns earlier measurements to it. */
  quoteRoofAreaId?: string | null;
  /** v8 (2026-07-08): user-entered height/depth (metric) captured at draw
   *  time (freestyle L×-H height, volume_3d custom depth). READ-ONLY display
   *  reference - `value` is already the final product. Persisted via
   *  entry_inputs so re-entry doesn't wipe it. */
  entryInputs?: {
    height_m?: number | null;
    depth_m?: number | null;
    /** P3 (spec 10.3): attached-entry provenance. value_basis + plan_value
     *  snapshot and the source-polygon link participate in calibration
     *  recompute - these are NOT display-only fields. */
    value_basis?: 'plan' | 'pitched' | 'corner_all' | 'corner_external' | 'corner_internal';
    plan_value?: number;
    pitch_applied?: boolean;
    source_geometry_id?: string;
    /** Corner-derived point entries (2026-09-30): count snapshot at attach
     *  time - verification reference, the value IS the count. */
    corner_count?: number;
  } | null;
  /** AI Takeoff: true if this measurement was created by the AI scan. */
  aiOrigin?: boolean;
}

interface ComponentWithMeasurements {
  componentId: string;
  measurements: ComponentMeasurement[];
  expanded: boolean;
}

interface Props {
  /** Presentation only. False for the mounted desktop owner under touch. */
  desktopAppearance?: boolean;
  workspaceSlug: string;
  quote: QuoteRow;
  planUrl: string;
  components: Component[];
  /** Named component libraries for the add-component selector (with an "All" option). */
  collections?: ComponentCollection[];
  /** P1-1a C-01: Hydrated state from DB, loaded server-side. Null = fresh takeoff. */
  hydrationData: TakeoffHydrationData | null;
  /** P1-1b: re-entry mode. 'add' = continue on page-1; 'new-page' = fresh area. */
  takeoffMode?: 'add' | 'new-page';
  /** P1-1b: pre-created page ID for new-area entries. Skips takeoffActions.initializeTakeoffPage. */
  initialPageId?: string;
  /** P1-1b: human-readable label for the new page. */
  initialPageName?: string;
  /** P1-1b mode=add: existing roof areas loaded from DB, shown read-only in the panel. */
  existingRoofAreas?: { id: string; label: string; pitch?: number; area?: number }[];
  /** P1-1b mode=new-page: pre-created quote_roof_areas ID. Passed as target_roof_area_id
   *  to save_takeoff_atomic so components route to the correct area. */
  initialRoofAreaId?: string;
  /** When true the company is over storage - block plan-image uploads. */
  isOverStorage?: boolean;
  /** All roof areas for this quote (loaded server-side). Used by the left-panel area switcher. */
  allRoofAreas?: { id: string; label: string; pitch?: number; area?: number }[];
  /** AI Takeoff: when true, the post-calibration popup shows the AI Assist button. */
  aiTakeoffAvailable?: boolean;
  /** AI Assist points: current usage for UI display. */
  aiAssistPoints?: { used: number; limit: number; remaining: number; isBlocked: boolean } | null;
  /** P2/P6 AI-assisted calibration: per-company flag read server-side. */
  aiCalibrationEnabled?: boolean;
  /** M5: registers the touch-outline bridge adapter (single data owner stays
   *  this workstation — the touch presentation only reads/calls back, R14). */
  /** Free-tool / MCP-plugin mode: emit the completed takeoff as data instead
   *  of navigating into the app quote-build step. Absent = app behaviour. */
  onFreeFinish?: (payload: TakeoffFinishPayload) => void;
  /** Free-tool mode: replaces the app back-link target. */
  onExitFree?: () => void;
  onTouchOutlineAdapter?: (adapter: TouchOutlineAdapter) => void;
  /** M7 (O16, closing the M5 deviation-4 gap): when provided (touch view
   *  active with a live outline editor), user-initiated page/area switches
   *  and upload-another consult this guard so a dirty touch draft is never
   *  silently invalidated by a page change. Undefined = legacy behaviour,
   *  bit-for-bit (L09). */
  touchExitGuard?: {
    isDirty: () => boolean;
    request: (label: string, proceed: () => void) => void;
  };
  /** U0 N1/N2 fix: reports the page-1 id once ensurePage1 resolves it, so the
   *  touch calibration phase can use the page on first-ever entry when the
   *  server render had no takeoff_pages row yet. Never called on re-entries
   *  where hydrationData already provided the id. */
  onPage1Resolved?: (pageId: string) => void;
}

const MAX_CANVAS_DIM = 2000; // Max longest edge for dynamic canvas sizing

/** Process image dimensions: cap longest edge at MAX_CANVAS_DIM, preserve aspect ratio. */
function computeCanvasDimensions(naturalWidth: number, naturalHeight: number): { width: number; height: number; scale: number } {
  const longest = Math.max(naturalWidth, naturalHeight);
  if (longest <= MAX_CANVAS_DIM) {
    return { width: naturalWidth, height: naturalHeight, scale: 1 };
  }
  const scale = MAX_CANVAS_DIM / longest;
  return {
    width: Math.round(naturalWidth * scale),
    height: Math.round(naturalHeight * scale),
    scale,
  };
}

// Color palette for components (10 highly distinct colors)
const COLOR_PALETTE = [
  '#ef4444', // red
  '#3b82f6', // blue
  '#10b981', // emerald-green
  '#eab308', // yellow
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#14b8a6', // teal
  '#fb923c', // bright orange
  '#6366f1', // indigo
  '#a855f7', // vibrant purple
];

interface CalibrationPoint {
  x: number;
  y: number;
}

interface Calibration {
  id: string;
  point1: CalibrationPoint;
  point2: CalibrationPoint;
  pixelDistance: number;
  actualDistance: number;
  unit: 'feet' | 'meters';
  scale: number;
}

/** Serializable undo/redo snapshot. Contains only plain data - no Fabric refs.
 *  The canvas is rebuilt from this via redrawCanvasFromState(). */
interface TakeoffSnapshot {
  componentMeasurements: { componentId: string; expanded: boolean; measurements: { id: string; type: ComponentMeasurement['type']; value: number; points?: { x: number; y: number }[]; visible: boolean; fromPageId?: string | null; entryInputs?: ComponentMeasurement['entryInputs'] }[] }[];
  roofAreas: { id: string; name: string; points: { x: number; y: number }[]; area: number; pitch: number; visible: boolean }[];
  calibrations: Calibration[];
  calibrationPoints: CalibrationPoint[];
  calibrationConfirmed: boolean;
  calibrationMode: boolean;
  areaMode: boolean;
  areaPoints: { x: number; y: number }[];
  areaSubTool: 'polygon' | 'rect';
  lineSubTool: 'single' | 'multi';
  lineMode: boolean;
  linePoints: { x: number; y: number }[];
  pointMode: boolean;
  multiLinealMode: boolean;
  multiLinealPoints: { x: number; y: number }[];
  activeComponentIds: string[];
  selectedComponentId: string | null;
  activeSaveRoofAreaId: string | null;
}

export function TakeoffWorkstation({
  desktopAppearance = true,
  workspaceSlug,
  quote,
  planUrl,
  components,
  collections = [],
  hydrationData,
  takeoffMode,
  initialPageId,
  initialPageName,
  existingRoofAreas = [],
  initialRoofAreaId,
  isOverStorage,
  allRoofAreas = [],
  aiTakeoffAvailable = false,
  aiAssistPoints = null,
  aiCalibrationEnabled = false,
  onFreeFinish,
  onExitFree,
  onTouchOutlineAdapter,
  touchExitGuard,
  onPage1Resolved,
}: Props) {
  const router = useRouter();
  // Free-tool / MCP-plugin seam: persistence resolves through context.
  // No provider mounted = exactly the real server actions, unchanged.
  const takeoffActions = useTakeoffActions();
  const [componentLibraryOpen, setComponentLibraryOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Zoom ownership: when set, the zoom was applied by auto-fit (initial load,
  // page switch, Fit to Screen or window resize) and the window-resize
  // listener may re-fit. Manual zoom controls null it so resize never
  // overrides the user's chosen zoom level.
  const lastAutoFitZoom = useRef<number | null>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const [zoom, setZoom] = useState(1);
  // Viewport pattern (2026-09-26): pan-hint state. The hint appears the first
  // time the plan is zoomed in enough that part of it is off-screen and the
  // user has not panned yet (owner request 2026-09-26).
  const [viewClipped, setViewClipped] = useState(false);
  const [hasPanned, setHasPanned] = useState(false);
  const [panHintDismissed, setPanHintDismissed] = useState(false);
  // Scene-space plan dims, kept in a ref so event handlers/async callbacks
  // always read fresh values without re-binding.
  const sceneDimsRef = useRef({ width: 0, height: 0 });
  
  // Calibration state
  const [calibrationMode, setCalibrationMode] = useState(false);
  const [calibrationPoints, setCalibrationPoints] = useState<CalibrationPoint[]>([]);
  const [calibrations, setCalibrations] = useState<Calibration[]>([]);
  const [_activeCalibrationId, setActiveCalibrationId] = useState<string | null>(null);
  const [showCalibrationModal, setShowCalibrationModal] = useState(false);
  const [tempCalibrationLine, setTempCalibrationLine] = useState<any>(null);
  const [calibrationConfirmed, setCalibrationConfirmed] = useState(false);
  const [showConfirmedFlash, setShowConfirmedFlash] = useState(false);
  const [showCalibrationHelp, setShowCalibrationHelp] = useState(true);
  const [showRoofAreaInstructions, setShowRoofAreaInstructions] = useState(false);

  // === P2/P6 AI-assisted calibration (flag-gated, live search via the calibration API) ===
  // Owner decision 2026-09-25: the AI-vs-manual CHOOSER is removed from the
  // flow entirely - calibration is always manual (both desktop and touch).
  // The AI review-session plumbing below stays mounted-capable but has no
  // user entry point anymore.
  const [aiCalReviewOpen, setAiCalReviewOpen] = useState(false);
  // 6.1: how the next AI review session starts (new / replace / edit) and a
  // nonce that remounts the controller/panel for each deliberate session start.
  const [aiCalStartMode, setAiCalStartMode] = useState<CalibrationStartMode>({ kind: 'new' });
  const [aiCalSessionNonce, setAiCalSessionNonce] = useState(0);
  // P6: the review panel stays MOUNTED (hidden) once opened, so closing and
  // reopening it within the session never resets decisions or the rescan
  // budget (spec 7.1/7.2). Unmounted only on commit, explicit session end or
  // switching to manual.
  const [aiCalSessionLive, setAiCalSessionLive] = useState(false);
  // P4: versioned calibration envelope (codec v1) per page DB id, created on
  // AI-finish and persisted alongside the legacy array; restored on hydration.
  const aiCalMetadataRef = useRef<Map<string, CalibrationMetadataV1>>(new Map());
  // 6.2 (calibration hardening audit 2026-09-20): active manual recalibration
  // draft. Non-null only while recalibrating a confirmed page; holds the
  // committed set for cancel-restore and tracks whether the first draft save
  // already replaced it on screen.
  const draftCalibrationRef = useRef<DraftCalibrationState<Calibration> | null>(null);

  // P0-2 (calibration hardening audit 2026-09-20): abort/close the active AI
  // calibration session before ANY page/area/image change. Overlay marker
  // objects are removed by tag; review UI state is cleared; candidates never
  // cross images (the controller's unmount also aborts any in-flight fetch).
  const abortAiCalibrationSession = useCallback(() => {
    disposeCalibrationOverlay(fabricRef.current);
    setAiCalReviewOpen(false);
    setAiCalSessionLive(false);
  }, []);

  // Dynamic canvas dimensions - canvas matches the processed image dimensions.
  // No more fixed 800×-600 with letterboxing. AI coordinates = canvas coordinates.
  const [canvasDims, setCanvasDims] = useState({ width: 800, height: 600 });

  // AI Takeoff state
  const [aiScanning, setAiScanning] = useState(false);
  const [aiResults, setAiResults] = useState<AiResultsData | null>(null);
  const [aiScanError, setAiScanError] = useState<string | null>(null);
  const [aiScanRaw, setAiScanRaw] = useState<AiScanData | null>(null);
  const [aiScanStage, setAiScanStage] = useState<'outline' | 'lines' | 'classify'>('outline');
  // M10 P5: staged AI scan - scan1 applies the outline for review and
  // mouse correction before scans 2+3 run on the corrected points
  // (desktop parity with the touch flow).
  const [aiStagedPageId, setAiStagedPageId] = useState<string | null>(null);
  // Owner 2026-09-25: guided desktop outline review - point tools alongside
  // drag. 'add' inserts a vertex on the nearest outline edge (click),
  // 'remove' deletes a clicked vertex (minimum 3 kept). Armed only while the
  // review card is visible; mirrored into a ref for the once-bound canvas
  // mouse handler.
  const [outlineTool, setOutlineTool] = useState<null | 'add' | 'remove'>(null);
  const [outlineSelectedVertex, setOutlineSelectedVertex] = useState<{ areaId: string; vertexIndex: number } | null>(null);
  const [outlineHistory, setOutlineHistory] = useState<{ areaId: string; stack: Array<Array<{ x: number; y: number }>>; index: number } | null>(null);
  const outlineToolRef = useRef<null | 'add' | 'remove'>(null);
  const outlineSelectedRef = useRef<{ areaId: string; vertexIndex: number } | null>(null);
  const outlineReviewActiveRef = useRef(false);
  const outlineHighlightRef = useRef<Array<Line>>([]);
  useEffect(() => { outlineToolRef.current = outlineTool; }, [outlineTool]);
  useEffect(() => { outlineSelectedRef.current = outlineSelectedVertex; }, [outlineSelectedVertex]);
  useEffect(() => { outlineReviewActiveRef.current = aiStagedPageId != null && !aiResults; }, [aiStagedPageId, aiResults]);
  useEffect(() => { if (aiStagedPageId == null) { setOutlineTool(null); setOutlineSelectedVertex(null); setOutlineHistory(null); } }, [aiStagedPageId]);
  const aiAbortRef = useRef<AbortController | null>(null);
  const [aiQualityLevel, setAiQualityLevel] = useState<'low' | 'medium' | 'high'>('medium');
  // AI Assist points: track locally so we can update after a scan without a page reload.
  const [aiPoints, setAiPoints] = useState(aiAssistPoints);
  // Owner 2026-09-25 (13:20): which uncertain row currently shows its
  // "assign to component" dropdown.
  const [uncertainAssignOpenFor, setUncertainAssignOpenFor] = useState<string | null>(null);
  // V3: 3-scan pipeline (outline → line detection → classification)
  const aiScanEndpoint = '/api/takeoff/ai-scan-v3';
  // Once the user dismisses the "Calibration complete" popup, never show it again
  // for the current session. Prevents the popup re-appearing every time areaMode
  // toggles (which happens on every component add/finish when no roof area exists).
  const roofAreaInstructionsDismissedRef = useRef(false);

  // Phase 7: multi-page takeoff state.
  // P1-1b: when initialPageId is provided (new-area mode), seed pages with that page
  // instead of page-1; the takeoffActions.initializeTakeoffPage effect is skipped.
  const [pages, setPages] = useState<Array<{ id?: string; url: string; name: string; order: number }>>(
    initialPageId
      ? [{ id: initialPageId, url: planUrl, name: initialPageName || 'New Area', order: 1 }]
      : [{ url: planUrl, name: 'Plan 1', order: 1 }]
  );
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  // P1-3: tracks the quote_roof_areas DB ID to route component measurements
  // to on the NEXT save. For initial mode=new-page load this is initialRoofAreaId;
  // updated client-side whenever the user switches to a new uploaded plan page.
  const [activeSaveRoofAreaId, setActiveSaveRoofAreaId] = useState<string | null>(
    initialRoofAreaId ?? null,
  );

  // P1-3: when true the user is adding measurements to an EXISTING area.
  // Suppresses the area name modal (pitch-only instead) and skips writing
  // new area rows to the DB on save. Trade-agnostic.
  const [isExistingAreaMode, setIsExistingAreaMode] = useState(false);
  const [existingAreaLabel, setExistingAreaLabel] = useState<string>('');

  // Batch 3: Area switcher state. activeAreaId tracks which area is selected
  // in the left panel. areaCanvasStates stores per-area canvas state so
  // switching areas preserves undo/drawings without a DB round-trip.
  const [activeAreaId, setActiveAreaId] = useState<string | null>(
    initialRoofAreaId ?? allRoofAreas[0]?.id ?? null
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const areaCanvasStatesRef = useRef<Map<string, any>>(new Map());
  // Track all areas (can grow when user creates new areas via the button)
  const [areaList, setAreaList] = useState(allRoofAreas);
  // Parent/child plans (2026-07-05): each parent area can hold MULTIPLE plans.
  // areaPages maps areaId → ordered list of takeoff_pages ids ("child slots").
  // Rendered as numbered chips (1, 2, 3…) under each area card in the left
  // panel. Populated at hydration, on upload-to-existing, and on area create.
  const [areaPages, setAreaPages] = useState<Record<string, string[]>>({});
  // Per-page calibrations: each plan keeps its own scale. Keyed by page DB id.
  const pageCalibrationsRef = useRef<Map<string, Calibration[]>>(new Map());
  // Option A upload flow: after uploading a plan for a NEW area the user
  // calibrates first; when calibration confirms we auto-arm the new-area
  // drawing flow (no second "+ New Area" click).
  const armNewAreaAfterCalibrationRef = useRef(false);
  // Phase 6: New Area choice modal state.
  const [showNewAreaChoiceModal, setShowNewAreaChoiceModal] = useState(false);
  const [newAreaChoice, setNewAreaChoice] = useState<'existing' | 'new'>('new');
  const [newAreaExistingId, setNewAreaExistingId] = useState<string>('');
  // Phase 6: when user chose 'add to existing', we arm drawing mode for that area.
  const [pendingNewAreaTargetId, setPendingNewAreaTargetId] = useState<string | null>(null);
  const [pendingNewAreaIsExisting, setPendingNewAreaIsExisting] = useState(false);

  // Issue 4+5: Area-assignment modal for new roof areas drawn in mode=add.
  // When the user closes a new area polygon while editing an existing plan,
  // this modal lets them pick which existing area to add the measurement to,
  // or create a new area.
  // (2026-07-05) Assign-Area-Measurement modal REMOVED - all roof-area draws
  // now route to the pitch-only modal or AreaNameModal. See RC-1/RC-5 fix.

  // P1-3 (multi-page Save & Upload another plan): modal state.
  // - target = 'existing' attaches the new page to the FIRST existing roof area
  //   (mirrors FilesManager Option B: new page, same area target).
  // - target = 'new' creates a new roof area + new page with the uploaded plan
  //   (mirrors FilesManager Option C: new area, new plan).
  const [showUploadAnotherModal, setShowUploadAnotherModal] = useState(false);
  const pdfPicker = usePdfPagePicker();
  const [uploadAnotherTarget, setUploadAnotherTarget] = useState<'existing' | 'new'>('existing');
  const [uploadAnotherAreaId, setUploadAnotherAreaId] = useState<string>('');
  const [uploadAnotherFile, setUploadAnotherFile] = useState<File | null>(null);
  const [uploadAnotherError, setUploadAnotherError] = useState<string | null>(null);
  const [storageBlocked, setStorageBlocked] = useState(false);
  // Reset canvas confirm modal
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  // Phase 5: area delete confirmation
  const [showAreaDeleteConfirm, setShowAreaDeleteConfirm] = useState(false);
  const [pendingDeleteAreaId, setPendingDeleteAreaId] = useState<string | null>(null);
  const [pendingDeleteAreaLabel, setPendingDeleteAreaLabel] = useState<string>('');
  const [isDeletingArea, setIsDeletingArea] = useState(false);
  const [isUploadingPage, setIsUploadingPage] = useState(false);
  // H-03: track unsaved changes so we can warn before switching pages.
  const [isDirty, setIsDirty] = useState(false);

  // P1-1a: session version for optimistic concurrency guard.
  const [sessionVersion, setSessionVersion] = useState<number | null>(
    hydrationData?.sessionVersion ?? null,
  );
  // Version ref (2026-07-06): React state is async/batched, so concurrent
  // saves (page-switch auto-save + main save, or multiple area creates) can
  // read a stale sessionVersion from closure. The ref is always current.
  const sessionVersionRef = useRef<number | null>(hydrationData?.sessionVersion ?? null);
  const updateSessionVersion = useCallback((updater: (prev: number | null) => number | null) => {
    // Publish synchronously before another awaited save reads the version.
    // A React state updater may run later or be replayed in Strict Mode.
    const next = updater(sessionVersionRef.current);
    sessionVersionRef.current = next;
    setSessionVersion(next);
  }, []);
  // Sync ref whenever sessionVersion state changes from external sources
  // (e.g. hydration, takeoffActions.getTakeoffSessionVersion sync).
  useEffect(() => { sessionVersionRef.current = sessionVersion; }, [sessionVersion]);
  // Guard so the one-shot hydration effect only fires on first mount.
  const hydrationAppliedRef = useRef<boolean>(false);
  // Canvas-rework: track when the canvas background image has loaded so
  // reconstruction can run after both canvas + hydration data are ready.
  const [canvasReady, setCanvasReady] = useState(false);

  // Component colors (auto-assign on mount)
  const [componentColors, setComponentColors] = useState<ComponentColor[]>([]);
  const [activeComponentIds, setActiveComponentIds] = useState<string[]>([]);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);

  // Component-library filter for the Available list. Defaults to the quote's
  // pinned library if it still exists, otherwise "All components". "All" shows
  // every company component regardless of which named library it belongs to.
  const [selectedLibraryId, setSelectedLibraryId] = useState<string>(() => {
    const pinned = (quote as { component_collection_id?: string | null }).component_collection_id ?? null;
    if (pinned && collections.some((c) => c.id === pinned)) return pinned;
    return ALL_LIBRARIES;
  });

  // Sidebar UI state
  const [componentSearch, setComponentSearch] = useState('');

  // Roof Areas
  const [roofAreas, setRoofAreas] = useState<RoofArea[]>([]);
  // Keep roofAreasRef in sync for canvas event handlers (stale closures).
  const roofAreasRef = useRef<RoofArea[]>([]);
  roofAreasRef.current = roofAreas;
  const [areaMode, setAreaMode] = useState(false);
  // Sub-tool selection for area mode: 'polygon' (click points) or 'rect' (click-drag box).
  const [areaSubTool, setAreaSubTool] = useState<'polygon' | 'rect'>('polygon');
  // Fix #3: sub-tool selection for line mode: 'single' (2-point line) or
  // 'multi' (N-point polyline, formerly the standalone Multi-Line button).
  const [lineSubTool, setLineSubTool] = useState<'single' | 'multi'>('single');
  const [areaPoints, setAreaPoints] = useState<{ x: number; y: number }[]>([]);
  const [_tempAreaPolygon, _setTempAreaPolygon] = useState<any>(null);
  const [showAreaNamePrompt, setShowAreaNamePrompt] = useState(false);
  // P1-1b new-page mode: pitch-only prompt after drawing the first area boundary.
  // Bypasses AreaNameModal entirely so the name never has to be re-typed.
  const [showPitchOnlyPrompt, setShowPitchOnlyPrompt] = useState(false);
  const [pitchOnlyInput, setPitchOnlyInput] = useState('');
  const [pitchOnlyDegrees, setPitchOnlyDegrees] = useState<number | null>(null);
  // Roof Pitch Estimator: opened from the toolbar or the pitch prompts.
  const [showPitchEstimator, setShowPitchEstimator] = useState(false);
  // Area-to-component attach chooser: which value basis to attach (plan vs
  // pitched). Fixes the 2026-09-03 stale-pitch bug: the basis + plan value
  // are stored on the entry so the save path recomputes from LIVE pitch.
  const [areaAttachChoice, setAreaAttachChoice] = useState<null | {
    componentId: string;
    roofAreaId: string;
    plan: number;
    pitched: number;
    pitch: number;
    basis: 'pitched' | 'plan';
  }>(null);

  // Volume (L ×- W ×- D) - depth prompt state.
  // Fires after the area polygon is closed for a volume_3d component.
  const [showVolumeDepthPrompt, setShowVolumeDepthPrompt] = useState(false);
  const [volumeDepthInput, setVolumeDepthInput] = useState('');

  // Freestyle height prompt - fires after a line/polyline is drawn for a
  // length_x_height_freestyle / multi_lineal_lxh_freestyle component.
  const [showFreestyleHeightPrompt, setShowFreestyleHeightPrompt] = useState(false);
  const [freestyleHeightInput, setFreestyleHeightInput] = useState('');
  const [pendingFreestyleLength, setPendingFreestyleLength] = useState<number>(0);
  const [pendingFreestyleComponentId, setPendingFreestyleComponentId] = useState<string | null>(null);
  const [pendingFreestylePoints, setPendingFreestylePoints] = useState<{x:number;y:number}[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pendingFreestyleCanvasObjects, setPendingFreestyleCanvasObjects] = useState<any[]>([]);
  const [pendingFreestyleIsMultiLineal, setPendingFreestyleIsMultiLineal] = useState(false);
  const [pendingVolumeComponentId, setPendingVolumeComponentId] = useState<string | null>(null);
  const [pendingVolumeCalibratedArea, setPendingVolumeCalibratedArea] = useState<number>(0);
  const [pendingVolumePoints, setPendingVolumePoints] = useState<{x:number;y:number}[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pendingVolumePolygon, setPendingVolumePolygon] = useState<any | null>(null);
  const [pendingAreaPoints, setPendingAreaPoints] = useState<{ x: number; y: number }[]>([]);
  // Captures selectedComponentId at polygon-close time so it survives any
  // canvas deselection that fires before the modal renders.
  const [pendingComponentId, setPendingComponentId] = useState<string | null>(null);
  
  // Component measurements
  const [componentMeasurements, setComponentMeasurements] = useState<ComponentWithMeasurements[]>([]);
  const [lineMode, setLineMode] = useState(false);
  const [linePoints, setLinePoints] = useState<{ x: number; y: number }[]>([]);
  const [pointMode, setPointMode] = useState(false);
  // Phase 7: multi-lineal mode - N connected points summed into one length measurement.
  const [multiLinealMode, setMultiLinealMode] = useState(false);
  const [multiLinealPoints, setMultiLinealPoints] = useState<{ x: number; y: number }[]>([]);
  const [multiLinealSegmentObjects, setMultiLinealSegmentObjects] = useState<any[]>([]); // fabric objects drawn so far
  // Draggable multi-lineal popup position (null = default top-center).
  const [popupPos, setPopupPos] = useState<{ x: number; y: number } | null>(null);
  const popupDragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const popupContainerRef = useRef<HTMLDivElement>(null);
  const [showLineMeasurementPrompt, setShowLineMeasurementPrompt] = useState(false);
  const [pendingLineMeasurement, setPendingLineMeasurement] = useState<{ points: { x: number; y: number }[], length: number } | null>(null);
  const [_showAreaMeasurementPrompt, _setShowAreaMeasurementPrompt] = useState(false);
  const [_pendingAreaMeasurement, _setPendingAreaMeasurement] = useState<{ points: { x: number; y: number }[], area: number } | null>(null);
  const [showPointMeasurementPrompt, setShowPointMeasurementPrompt] = useState(false);
  const [pendingPointLocation, setPendingPointLocation] = useState<{ x: number; y: number } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // Replaces native alert() across this workstation. `error` flips the modal
  // to red styling so problems read clearly.
  const [alertState, setAlertState] = useState<{
    open: boolean;
    title: string;
    description?: string;
    variant?: 'info' | 'success' | 'error';
  }>({ open: false, title: '' });
  const showAlert = (title: string, description?: string, variant: 'info' | 'success' | 'error' = 'info') =>
    setAlertState({ open: true, title, description, variant });
  const closeAlert = () => setAlertState((s) => ({ ...s, open: false }));
  
  // Component display state (may include test components)
  const [displayComponents, setDisplayComponents] = useState<Component[]>([]);
  
  // Auto-assign colors to components
  useEffect(() => {
    console.log('[Components] Raw prop received:', components);
    console.log('[Components] Count:', components.length);
    console.log('[Components] Calibration confirmed:', calibrationConfirmed);
    if (components.length > 0) {
      console.log('[Components] Sample component:', components[0]);
    } else {
      console.warn('[Components] No components found in component library for this company');
    }
    
    setDisplayComponents(components);
  }, [components, calibrationConfirmed]);
  
  // Assign colors to active components (when activeComponentIds changes)
  // NOTE: AI system placeholder components keep their registry colour,
  // they do NOT receive palette-by-order colours.
  useEffect(() => {
    setComponentColors(prevColors => {
      const colorMap = new Map(prevColors.map(c => [c.componentId, c.color]));
      const colors = activeComponentIds.map((id) => {
        // Check if this is a system component - if so, use registry colour
        const comp = components.find(c => c.id === id);
        if (comp?.is_system) {
          const key = resolveSemanticKey(comp.name);
          if (key) {
            return { componentId: id, color: getSemanticColour(key) };
          }
        }
        // Preserve existing colour if already assigned (not a system component)
        const existing = colorMap.get(id);
        if (existing) return { componentId: id, color: existing };
        // Otherwise assign from palette
        const idx = activeComponentIds.indexOf(id);
        return { componentId: id, color: COLOR_PALETTE[idx % COLOR_PALETTE.length] };
      });
      return colors;
    });
  }, [activeComponentIds, components]);
  
  // H-03: mark dirty whenever measurements or areas change.
  useEffect(() => {
    if (componentMeasurements.length > 0 || roofAreas.length > 0) setIsDirty(true);
  }, [componentMeasurements, roofAreas]);

  // M-04 (Gerald round-5): ensure page-1 has a real DB row on mount.
  // takeoffActions.initializeTakeoffPage is idempotent so repeated mounts are safe.
  // P1-1b: skipped when initialPageId is provided (new-area flow already created the page).
  useEffect(() => {
    if (initialPageId) return; // page already exists - skip
    let cancelled = false;
    async function ensurePage1() {
      try {
        const result = await takeoffActions.initializeTakeoffPage(quote.id);
        if (!cancelled && result.ok && result.pageId) {
          onPage1ResolvedRef.current?.(result.pageId);
          setPages(prev => {
            const updated = [...prev];
            if (updated[0] && !updated[0].id) {
              updated[0] = { ...updated[0], id: result.pageId };
            }
            return updated;
          });
          // Duplicate-areas fix (2026-07-05): anything drawn BEFORE this id
          // resolved has fromPageId=null (currentPageIdRef was null). Those
          // rows were drawn on page-1 by definition - retro-stamp them now so
          // later saves can never re-home them onto a different plan (the
          // "duplicate areas in first parent" bug).
          const resolvedPageId = result.pageId;
          setComponentMeasurements(prev => prev.map(c => ({
            ...c,
            measurements: c.measurements.map(m => m.fromPageId ? m : { ...m, fromPageId: resolvedPageId }),
          })));
          setRoofAreas(prev => prev.map(ra => ra.fromPageId ? ra : { ...ra, fromPageId: resolvedPageId }));
        }
      } catch (err) {
        // Non-fatal: single-page save still works via quote-wide delete.
        console.warn('[TakeoffWorkstation] takeoffActions.initializeTakeoffPage failed:', err);
      }
    }
    ensurePage1();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote.id, initialPageId]);

  // ─── State-only Undo/Redo system ───────────────────────────────────────
  // Stores plain serializable data snapshots - no Fabric.js canvas JSON.
  // The canvas is redrawn from React state after every undo/redo via
  // redrawCanvasFromState(). This fixes:
  // - Stale closures in once-bound canvas listeners (undo jumped to start)
  // - Lost measurementId during toJSON/loadFromJSON round-trip
  // - Async loadFromJSON races causing the image to flash/disappear
  // - Orphan markers persisting on canvas after undo
  const history = useStateHistory<TakeoffSnapshot>(2);

  // Bump this to trigger a canvas redraw after state restoration.
  const [redrawNonce, setRedrawNonce] = useState(0);

  // Capture all relevant React state for an undo snapshot.
  // Strips non-serializable Fabric refs (canvasObjects, polygon, markers)
  // before storing - they are rebuilt by redrawCanvasFromState().
  const captureSnapshot = useCallback((): TakeoffSnapshot => {
    return {
      componentMeasurements: componentMeasurements.map(c => ({
        componentId: c.componentId,
        expanded: c.expanded,
        measurements: c.measurements.map(m => ({
          id: m.id,
          type: m.type,
          value: m.value,
          points: m.points ? m.points.map(p => ({ x: p.x, y: p.y })) : undefined,
          visible: m.visible,
          fromPageId: m.fromPageId,
          entryInputs: m.entryInputs,
          // canvasObjects stripped - rebuilt on redraw
        })),
      })),
      roofAreas: roofAreas.map(ra => ({
        id: ra.id,
        name: ra.name,
        points: ra.points.map(p => ({ x: p.x, y: p.y })),
        area: ra.area,
        pitch: ra.pitch,
        visible: ra.visible,
        // polygon + markers stripped - rebuilt on redraw
      })),
      calibrations: calibrations.map(c => ({ ...c })),
      calibrationPoints: calibrationPoints.map(p => ({ ...p })),
      calibrationConfirmed,
      calibrationMode,
      areaMode,
      areaPoints: areaPoints.map(p => ({ ...p })),
      areaSubTool,
      lineSubTool,
      lineMode,
      linePoints: linePoints.map(p => ({ ...p })),
      pointMode,
      multiLinealMode,
      multiLinealPoints: multiLinealPoints.map(p => ({ ...p })),
      // multiLinealSegmentObjects are Fabric objects - stripped, rebuilt on redraw
      activeComponentIds: [...activeComponentIds],
      selectedComponentId,
      activeSaveRoofAreaId,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [componentMeasurements, roofAreas, calibrations, calibrationPoints,
      calibrationConfirmed, calibrationMode, areaMode, areaPoints, areaSubTool,
      lineMode, linePoints, pointMode, multiLinealMode, multiLinealPoints,
      activeComponentIds, selectedComponentId, activeSaveRoofAreaId]);

  // Push a snapshot before a committed action. Called from React handlers
  // (NOT from the once-bound canvas mouse:down listener) so closures are fresh.
  const pushHistorySnapshot = useCallback(() => {
    history.pushSnapshot(captureSnapshot());
  }, [history, captureSnapshot]);

  // Fix #5a: the canvas mouse handlers are bound ONCE on mount ([] deps), so
  // any pushHistorySnapshot they reference is a mount-time closure that
  // captures EMPTY state. Every snapshot pushed from a canvas click was the
  // initial blank state, which is why undo "reset" the whole canvas.
  // The ref is refreshed every render so listeners always get the latest.
  const pushHistorySnapshotRef = useRef(pushHistorySnapshot);
  useEffect(() => { pushHistorySnapshotRef.current = pushHistorySnapshot; });

  // Fix #5b: rapid undo/redo clicks can fire before React re-renders, so
  // captureSnapshot() would read pre-undo state and corrupt the redo stack.
  // liveStateRef mirrors the latest committed state (refreshed every render) and
  // is updated SYNCHRONOUSLY inside undo/redo.
  const liveStateRef = useRef<TakeoffSnapshot | null>(null);
  useEffect(() => { liveStateRef.current = captureSnapshot(); });

  // Clear all non-background objects and rebuild from current React state.
  // The background image (canvas.backgroundImage) survives because it is
  // not in canvas.getObjects().
  const redrawCanvasFromState = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    // Remove every object (background image is NOT in getObjects()).
    const objects = canvas.getObjects();
    objects.slice().forEach((obj) => canvas.remove(obj));

    // Rebuild from state using reconstructCanvas.
    const result = reconstructCanvas(canvas, {
      componentMeasurements: componentMeasurements.map(c => ({
        componentId: c.componentId,
        measurements: c.measurements.map(m => ({
          id: m.id,
          type: m.type,
          value: m.value,
          points: m.points,
          visible: m.visible,
          fromPageId: m.fromPageId,
          // Preserve the draw-time area stamp through redraws - dropping it
          // reverted measurements to the save-time fallback area.
          quoteRoofAreaId: m.quoteRoofAreaId,
          // v8 fix (2026-07-08): redraw REPLACES state with reconstructCanvas
          // output - omitting entryInputs here stripped user H/D from state on
          // every redraw (area create/switch), so saves sent null.
          entryInputs: m.entryInputs,
        })),
      })),
      roofAreas: roofAreas.map(ra => ({
        id: ra.id,
        name: ra.name,
        points: ra.points,
        area: ra.area,
        pitch: ra.pitch,
        visible: ra.visible,
        // Parent/child plans (2026-07-05): the redraw filter needs the page
        // stamp or every page's polygons render on every plan.
        fromPageId: ra.fromPageId,
        quoteRoofAreaId: ra.quoteRoofAreaId,
      })),
      componentColors,
      currentPageId: pages[currentPageIndex]?.id ?? null,
    });

    // Update React state with fresh canvasObjects refs.
    setComponentMeasurements(result.componentMeasurements as ComponentWithMeasurements[]);
    setRoofAreas(result.roofAreas as RoofArea[]);

    // Redraw in-progress drawing buffers if a tool is active.
    if (areaMode && areaPoints.length > 0) {
      areaPoints.forEach(p => {
        const marker = new Circle({
          left: p.x, top: p.y, radius: 4,
          fill: '#f59e0b', stroke: '#000', strokeWidth: 1,
          originX: 'center', originY: 'center',
          selectable: false, evented: false, hasControls: false, hasBorders: false,
        });
        (marker as any).isInProgressMarker = true;
      canvas.add(marker);
      });
    }
    if (lineMode && linePoints.length > 0) {
      linePoints.forEach(p => {
        const marker = new Circle({
          left: p.x, top: p.y, radius: 4,
          fill: '#f59e0b', stroke: '#000', strokeWidth: 1,
          originX: 'center', originY: 'center',
          selectable: false, evented: false, hasControls: false, hasBorders: false,
        });
        (marker as any).isInProgressMarker = true;
      canvas.add(marker);
      });
    }
    if (multiLinealMode && multiLinealPoints.length > 0) {
      multiLinealPoints.forEach(p => {
        const marker = new Circle({
          left: p.x, top: p.y, radius: 4,
          fill: '#f59e0b', stroke: '#000', strokeWidth: 1,
          originX: 'center', originY: 'center',
          selectable: false, evented: false, hasControls: false, hasBorders: false,
        });
        (marker as any).isInProgressMarker = true;
      canvas.add(marker);
      });
    }

    canvas.requestRenderAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [componentMeasurements, roofAreas, componentColors, pages, currentPageIndex,
      areaMode, areaPoints, lineMode, linePoints, multiLinealMode, multiLinealPoints]);

  // Trigger redraw after state has been committed by undo/redo.
  useEffect(() => {
    if (redrawNonce > 0) {
      redrawCanvasFromState();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [redrawNonce]);

  const handleUndo = useCallback(() => {
    // Owner 2026-09-25 (12:30 pass): main undo/redo is BLOCKED while the
    // outline review card is open - it restores a pre-AI snapshot, wipes the
    // staged outline off the canvas and leaves the area row live (state
    // desync). Undo/redo for outline edits lives in the review card.
    if (outlineReviewActiveRef.current) return;
    // Fix #5b: use the live ref (synchronously updated) - rapid clicks fire
    // before React re-renders and captureSnapshot() would read stale state.
    const snapshot = history.undo(liveStateRef.current ?? captureSnapshot());
    if (!snapshot) return;
    liveStateRef.current = snapshot;
    // Restore plain state values.
    setComponentMeasurements(snapshot.componentMeasurements.map(c => ({
      ...c,
      measurements: c.measurements.map(m => ({ ...m, canvasObjects: [] })),
    })));
    setRoofAreas(snapshot.roofAreas.map(ra => ({ ...ra, polygon: undefined, markers: [] })));
    setCalibrations(snapshot.calibrations);
    setCalibrationPoints(snapshot.calibrationPoints);
    setCalibrationConfirmed(snapshot.calibrationConfirmed);
    setCalibrationMode(snapshot.calibrationMode);
    setAreaMode(snapshot.areaMode);
    setAreaPoints(snapshot.areaPoints);
    setAreaSubTool(snapshot.areaSubTool);
    setLineSubTool(snapshot.lineSubTool);
    setLineMode(snapshot.lineMode);
    setLinePoints(snapshot.linePoints);
    setPointMode(snapshot.pointMode);
    setMultiLinealMode(snapshot.multiLinealMode);
    setMultiLinealPoints(snapshot.multiLinealPoints);
    setMultiLinealSegmentObjects([]);
    setActiveComponentIds(snapshot.activeComponentIds);
    setSelectedComponentId(snapshot.selectedComponentId);
    setActiveSaveRoofAreaId(snapshot.activeSaveRoofAreaId);
    // Trigger canvas redraw after state commits.
    setRedrawNonce(n => n + 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, captureSnapshot]);

  const handleRedo = useCallback(() => {
    // Owner 2026-09-25 (12:30 pass): blocked during outline review (see undo).
    if (outlineReviewActiveRef.current) return;
    // Fix #5b: same live-ref pattern as handleUndo.
    const snapshot = history.redo(liveStateRef.current ?? captureSnapshot());
    if (!snapshot) return;
    liveStateRef.current = snapshot;
    // Restore plain state values (same as undo).
    setComponentMeasurements(snapshot.componentMeasurements.map(c => ({
      ...c,
      measurements: c.measurements.map(m => ({ ...m, canvasObjects: [] })),
    })));
    setRoofAreas(snapshot.roofAreas.map(ra => ({ ...ra, polygon: undefined, markers: [] })));
    setCalibrations(snapshot.calibrations);
    setCalibrationPoints(snapshot.calibrationPoints);
    setCalibrationConfirmed(snapshot.calibrationConfirmed);
    setCalibrationMode(snapshot.calibrationMode);
    setAreaMode(snapshot.areaMode);
    setAreaPoints(snapshot.areaPoints);
    setAreaSubTool(snapshot.areaSubTool);
    setLineSubTool(snapshot.lineSubTool);
    setLineMode(snapshot.lineMode);
    setLinePoints(snapshot.linePoints);
    setPointMode(snapshot.pointMode);
    setMultiLinealMode(snapshot.multiLinealMode);
    setMultiLinealPoints(snapshot.multiLinealPoints);
    setMultiLinealSegmentObjects([]);
    setActiveComponentIds(snapshot.activeComponentIds);
    setSelectedComponentId(snapshot.selectedComponentId);
    setActiveSaveRoofAreaId(snapshot.activeSaveRoofAreaId);
    // Trigger canvas redraw after state commits.
    setRedrawNonce(n => n + 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, captureSnapshot]);

  // P0-5 (calibration hardening audit 2026-09-20): page/calibration metadata
  // hydration runs whenever the session has saved pages, even with ZERO
  // measurements - a calibration-only page must still restore its pages, its
  // per-page calibration arrays and the versioned metadata envelope on
  // reload, and show as calibrated. Measurement/area hydration (the effect
  // below) still requires measurements to exist.
  const pageHydrationAppliedRef = useRef(false);
  useEffect(() => {
    if (pageHydrationAppliedRef.current) return;
    if (!hydrationData || hydrationData.pages.length === 0) return;
    pageHydrationAppliedRef.current = true;

    // Restore pages list from DB (preserves IDs needed for scoped save).
    setPages(
      hydrationData.pages.map(p => ({
        id: p.id,
        url: p.imageUrl ?? planUrl,
        name: p.pageName ?? `Page ${p.pageOrder}`,
        order: p.pageOrder,
      }))
    );

    // Per-page calibration store + P4 (spec 11) versioned metadata envelope.
    hydrationData.pages.forEach(p => {
      const cal = p.scaleCalibration;
      if (Array.isArray(cal) && cal.length > 0) {
        pageCalibrationsRef.current.set(p.id, cal as Calibration[]);
      }
      if (p.calibrationMetadata != null) {
        const decoded = decodeCalibrationMetadata(p.calibrationMetadata);
        if (decoded.kind === 'v1' && decoded.status === 'valid') {
          // P0-6: never silently trust an envelope whose revision does not
          // match the page's authoritative server revision - it was computed
          // against a different source image.
          if (shouldTrustCalibrationMetadata(decoded.metadata.imageRevision, p.imageRevision ?? null)) {
            aiCalMetadataRef.current.set(p.id, decoded.metadata);
          } else if (process.env.NODE_ENV !== 'production') {
            console.info(
              '[Hydration] Ignoring stale AI calibration metadata for page', p.id,
              '- envelope revision', decoded.metadata.imageRevision,
              '!= page revision', p.imageRevision,
            );
          }
        }
        if (process.env.NODE_ENV !== 'production' && decoded.diagnostics.length > 0) {
          console.info('[Hydration] P4 calibration metadata diagnostics for page', p.id, decoded.diagnostics);
        }
      }
    });

    // Restore the initially-active page's OWN calibration (page index 0 at
    // mount; the measurement-hydration effect below may retarget the active
    // page and override this with that page's own stored calibration).
    const initial = resolvePageCalibration(pageCalibrationsRef.current, hydrationData.pages[0]?.id ?? null);
    if (initial.source === 'page') {
      setCalibrations(initial.calibrations);
      setCalibrationConfirmed(true);
      setShowCalibrationHelp(false);
      console.info('[Hydration] Restored', initial.calibrations.length, 'calibrations for initial page');
    }
  // Intentionally only runs once on mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // U1 (2026-09-22): sync a touch-committed calibration into local state.
  // The touch calibration path persists via takeoffActions.persistPageCalibration +
  // router.refresh(); the server re-hydrates this component with the saved
  // calibration, but the one-shot effect above never re-runs, so `calibrations`
  // stayed empty and the desktop presentation wrongly showed the first-time
  // "Calibrate Your Plan" help modal over an already-calibrated page (and
  // covered the only way back to the touch view on a phone). Guarded adoption:
  // only when there is NO local calibration state to clobber (the user's
  // in-progress desktop calibration always wins over the server copy).
  useEffect(() => {
    if (!hydrationData || hydrationData.pages.length === 0) return;
    if (calibrations.length > 0 || calibrationPoints.length > 0) return;
    const activeId = currentPageIdRef.current ?? hydrationData.pages[0]?.id ?? null;
    const p = hydrationData.pages.find(pg => pg.id === activeId) ?? hydrationData.pages[0];
    const cal = p?.scaleCalibration;
    if (Array.isArray(cal) && cal.length > 0) {
      pageCalibrationsRef.current.set(p.id, cal as Calibration[]);
      setCalibrations(cal as Calibration[]);
      setCalibrationConfirmed(true);
      setShowCalibrationHelp(false);
    }
  }, [hydrationData, calibrations.length, calibrationPoints.length]);

  // P1-1a C-01: One-shot hydration from server-loaded DB state.
  // Restores componentMeasurements panel data + pages list from the last saved session.
  // Canvas shapes are NOT reconstructed here (P1-1b); values show in the panel.
  useEffect(() => {
    if (hydrationAppliedRef.current) return;
    if (!hydrationData || hydrationData.measurements.length === 0) return;
    hydrationAppliedRef.current = true;

    // Fix 2: Group measurements by quoteRoofAreaId for per-area restore.
    // Pre-Batch-5 data (null quoteRoofAreaId) goes to first area.
    const firstAreaId = allRoofAreas[0]?.id ?? null;
    const byArea = new Map<string, { components: Map<string, ComponentWithMeasurements>; areas: RoofArea[]; pageIds: Set<string> }>();
    
    hydrationData.measurements.forEach(m => {
      const areaKey = m.quoteRoofAreaId ?? firstAreaId ?? '__no_area__';
      if (!byArea.has(areaKey)) byArea.set(areaKey, { components: new Map(), areas: [], pageIds: new Set() });
      const ad = byArea.get(areaKey)!;
      
      // Track which page this area's measurements belong to
      if (m.pageId) ad.pageIds.add(m.pageId);
      
      if (m.componentId === null && m.type === 'area') {
        const idx = ad.areas.length;
        const label = allRoofAreas.find(a => a.id === areaKey)?.label ?? existingRoofAreas[idx]?.label ?? `Area ${idx + 1}`;
        // Per-entry pitch fix (2026-07-06): use the pitch this polygon was
        // SAVED with (from quote_roof_area_entries via hydration), falling
        // back to the parent area pitch only for legacy rows. Using the
        // parent pitch here caused re-saves to overwrite entry pitches.
        ad.areas.push({ id: m.id, name: label, points: m.points ?? [], area: m.value, pitch: m.pitch ?? allRoofAreas.find(a => a.id === areaKey)?.pitch ?? existingRoofAreas[idx]?.pitch ?? 0, visible: m.visible, fromPageId: m.pageId ?? null, quoteRoofAreaId: areaKey === '__no_area__' ? null : areaKey });
        return;
      }
      if (m.componentId === null) return;
      const cid = m.componentId!;
      if (!ad.components.has(cid)) ad.components.set(cid, { componentId: cid, measurements: [], expanded: false });
      ad.components.get(cid)!.measurements.push({ id: m.id, type: m.type as ComponentMeasurement['type'], value: m.value, points: m.points ?? undefined, visible: m.visible, fromPageId: m.pageId ?? null, quoteRoofAreaId: areaKey === '__no_area__' ? null : areaKey, entryInputs: m.entryInputs ?? null });
    });

    // Cache per-area state for handleSwitchArea
    byArea.forEach((ad, aid) => {
      areaCanvasStatesRef.current.set(aid, {
        componentMeasurements: Array.from(ad.components.values()).map(comp => ({
          componentId: comp.componentId, expanded: false,
          measurements: comp.measurements.map(m => ({ id: m.id, type: m.type, value: m.value, points: m.points, visible: m.visible, fromPageId: m.fromPageId, quoteRoofAreaId: m.quoteRoofAreaId, entryInputs: m.entryInputs ?? null })),
        })),
        roofAreas: ad.areas.map(ra => ({ id: ra.id, name: ra.name, points: ra.points, area: ra.area, pitch: ra.pitch, visible: ra.visible, fromPageId: ra.fromPageId, quoteRoofAreaId: ra.quoteRoofAreaId })),
        pageIds: ad.pageIds,
      });
    });

    // Parent/child plans (2026-07-05): build the areaPages index (areaId →
    // ordered pageIds) for the left-panel child chips, and stash every page's
    // calibration so each plan restores its own scale on switch.
    const pageOrderIndex = new Map(hydrationData.pages.map(p => [p.id, p.pageOrder] as const));
    const nextAreaPages: Record<string, string[]> = {};
    byArea.forEach((ad, aid) => {
      if (aid === '__no_area__') return;
      nextAreaPages[aid] = Array.from(ad.pageIds).sort(
        (a, b) => (pageOrderIndex.get(a) ?? 0) - (pageOrderIndex.get(b) ?? 0)
      );
    });
    setAreaPages(nextAreaPages);

    // Display active area's data.
    // Fix (2026-07-04): if the initially-selected area has no saved data
    // (e.g. it was an empty/ghost area), fall back to the first area that
    // actually has measurements - otherwise re-entry showed a blank panel
    // and "Save & Continue" failed with "no measurements to save".
    let dispId = activeAreaId ?? firstAreaId;
    let disp = byArea.get(dispId ?? '__no_area__');
    if (!disp || (disp.components.size === 0 && disp.areas.length === 0)) {
      for (const [aid, ad] of byArea) {
        if (ad.components.size > 0 || ad.areas.length > 0) {
          dispId = aid;
          disp = ad;
          if (aid !== '__no_area__') {
            setActiveAreaId(aid);
            setActiveSaveRoofAreaId(aid);
          }
          break;
        }
      }
    }
    if (disp) {
      if (disp.components.size > 0) {
        setComponentMeasurements(Array.from(disp.components.values()));
        setActiveComponentIds(Array.from(disp.components.keys()));
      }
      if (disp.areas.length > 0) setRoofAreas(disp.areas);
    }

    // Parent/child plans: point the canvas at the active area's FIRST plan
    // (child slot 1) so re-entry shows that area's own plan image, not
    // whatever page happened to be index 0.
    let activePageForCalibration = hydrationData.pages[0] ?? null;
    if (dispId && dispId !== '__no_area__') {
      const dispPageIds = nextAreaPages[dispId];
      if (dispPageIds && dispPageIds.length > 0) {
        const idx = hydrationData.pages.findIndex(p => p.id === dispPageIds[0]);
        if (idx >= 0) {
          setCurrentPageIndex(idx);
          activePageForCalibration = hydrationData.pages[idx];
        }
      }
    }

    // Canvas-rework: restore calibrations from DB so the scale is available
    // for new measurements on re-entry. Calibrations are stored per-page in
    // takeoff_pages.scale_calibration - restore the ACTIVE page's scale, not
    // blindly page 1's (parent/child plans fix, 2026-07-05).
    if (activePageForCalibration?.scaleCalibration) {
      try {
        const restored = (activePageForCalibration.scaleCalibration as Calibration[]);
        if (Array.isArray(restored) && restored.length > 0) {
          setCalibrations(restored);
          setCalibrationConfirmed(true);
          setShowCalibrationHelp(false);
          console.info('[Hydration] Restored', restored.length, 'calibrations from DB');
        }
      } catch (err) {
        console.warn('[Hydration] Failed to restore calibrations:', err);
      }
    }

    // Issue 4 fix: In mode=add, set isExistingAreaMode=true and route saves to
    // the first existing roof area. Without this, the save logic re-inserts all
    // hydrated roof areas as NEW rows → duplication.
    if (takeoffMode === 'add' && existingRoofAreas.length > 0) {
      setIsExistingAreaMode(true);
      setActiveSaveRoofAreaId(existingRoofAreas[0].id);
      setExistingAreaLabel(existingRoofAreas[0].label);
      console.info('[Hydration] mode=add: set isExistingAreaMode=true, activeSaveRoofAreaId=', existingRoofAreas[0].id);
    }
  // Intentionally only runs once on mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Canvas-rework: Reconstruct canvas shapes from DB on re-entry ────────
  // Runs once after both canvasReady and hydrationData are available.
  // Rebuilds all Fabric.js objects (polygons, lines, markers) from stored
  // canvas_points so the user can visually edit existing measurements.
  useEffect(() => {
    if (reconstructAppliedRef.current) return;
    if (!canvasReady || !fabricRef.current) return;
    if (!hydrationData || hydrationData.measurements.length === 0) return;

    // Only reconstruct if there are measurements with points to restore.
    const hasPoints = hydrationData.measurements.some(m => m.points && m.points.length > 0);
    if (!hasPoints) return;

    reconstructAppliedRef.current = true;
    console.info('[Reconstruct] Starting canvas reconstruction from DB data');

    const result = reconstructCanvas(fabricRef.current, {
      componentMeasurements: componentMeasurements.map(c => ({
        componentId: c.componentId,
        measurements: c.measurements,
      })),
      roofAreas,
      componentColors,
      currentPageId: pages[currentPageIndex]?.id ?? null,
    });

    // Update state with reconstructed canvasObjects.
    setComponentMeasurements(result.componentMeasurements);
    setRoofAreas(result.roofAreas);

    // Parent/child plans (2026-07-05): canvas-init loaded the route-level
    // planUrl; if hydration pointed us at a different plan (the active area's
    // first child slot), swap the background to the correct page image.
    const activePage = pages[currentPageIndex];
    if (activePage?.url && activePage.url !== planUrl) {
      setPageBackgroundImage(activePage.url);
    }
    console.info('[Reconstruct] Canvas reconstruction complete:',
      result.componentMeasurements.reduce((sum, c) => sum + c.measurements.length, 0),
      'measurements restored');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasReady]);

  // Trade-aware labels + config. Single source of truth for all copy that
  // varies by trade (roofing / cladding / generic). Replaces the old
  // quoteIsGeneric boolean - check tradeConfig.pitchRequired / .areaIsOptional
  // instead of checking the trade string directly.
  const tradeConfig = getTradeLabels((quote as { trade?: string }).trade);
  // Keep this alias for any existing code that still references it; prefer
  // tradeConfig properties in new code.
  const quoteIsGeneric = !tradeConfig.pitchRequired;
  useEffect(() => {
    // P1-1b: suppress in mode=add - user is continuing on an existing area, not creating a new one.
    if (takeoffMode === 'add') return;
    // P1-3: suppress in isExistingAreaMode - the user chose "add to existing area" via
    // Save & Upload another plan. The "draw an area boundary" prompt is irrelevant here;
    // showing it caused users to think they needed to draw a boundary and then go directly
    // to component area drawing, which broke the polygon-close routing (deselection gotcha).
    if (isExistingAreaMode) return;
    // Fix (2026-07-04): never show on re-entry to a saved takeoff. The user
    // already has saved areas - they can use "+ New Area" or upload a plan.
    // P0-5 (audit 2026-09-20): also suppress for calibration-only saved pages
    // (pages exist, zero measurements) - reload must not re-show this popup.
    if (hydrationData && (hydrationData.measurements.length > 0 || hydrationData.pages.length > 0)) return;
    // RC-3 fix (2026-07-05): if the user already started drawing, never pop
    // this modal on top of their drawing (or on top of the AreaNameModal).
    // areaMode in the deps means the cleanup cancels the pending timer the
    // moment drawing starts.
    if (areaMode) return;
    // Once dismissed, never re-show the "Calibration complete" popup this session.
    if (roofAreaInstructionsDismissedRef.current) return;
    if (calibrationConfirmed && calibrations.length > 0 && roofAreas.length === 0) {
      // Delay slightly to show after calibration flash
      const timer = setTimeout(() => {
        setShowRoofAreaInstructions(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [calibrationConfirmed, calibrations.length, roofAreas.length, takeoffMode, isExistingAreaMode, hydrationData, areaMode]);
  
  // Save current canvas state to the area cache, then load the target area.
  // If the target area has cached state, restore it. Otherwise, clear the
  // canvas for a fresh start (the user will calibrate + draw on the new area).
  const handleSwitchArea = useCallback(async (targetAreaId: string, targetPageId?: string) => {
    if (targetAreaId === activeAreaId) return;

    // M7 (O16): a dirty touch outline draft is resolved through the shared
    // guard BEFORE the page/area context changes under it.
    if (touchExitGuardRef.current?.isDirty()) {
      touchExitGuardRef.current.request('Switch roof area', () => {
        void handleSwitchArea(targetAreaId, targetPageId);
      });
      return;
    }

    // Discard any in-progress drawing before switching areas
    discardInProgressDrawing();

    // P0-2 (audit 2026-09-20): the active AI calibration session cannot
    // follow the area/page switch - close it and strip its overlay markers.
    abortAiCalibrationSession();

    // Parent/child plans (2026-07-05): stamp un-stamped (freshly drawn)
    // measurements with the page they were drawn on before caching, and
    // preserve the cache entry's pageIds (hydration wrote them; a plain
    // .set() replacement dropped them, breaking the child-chip index).
    const outgoingPageId = pages[currentPageIndex]?.id ?? null;

    // Phase 4: Auto-persist outgoing area's data to DB before switching.
    // This prevents data loss when switching between areas.
    if (activeAreaId && (componentMeasurements.length > 0 || roofAreas.length > 0)) {
      const prevCached = areaCanvasStatesRef.current.get(activeAreaId);
      const mergedPageIds = new Set<string>(prevCached?.pageIds ?? []);
      componentMeasurements.forEach(c => c.measurements.forEach(m => {
        const pid = m.fromPageId ?? outgoingPageId;
        if (pid) mergedPageIds.add(pid);
      }));
      roofAreas.forEach(ra => {
        const pid = ra.fromPageId ?? outgoingPageId;
        if (pid) mergedPageIds.add(pid);
      });
      // Save current area's data to the areaCanvasStatesRef cache
      areaCanvasStatesRef.current.set(activeAreaId, {
        componentMeasurements: componentMeasurements.map(c => ({
          componentId: c.componentId,
          expanded: c.expanded,
          measurements: c.measurements.map(m => ({
            id: m.id, type: m.type, value: m.value, points: m.points,
            visible: m.visible, fromPageId: m.fromPageId ?? outgoingPageId,
            quoteRoofAreaId: m.quoteRoofAreaId ?? activeAreaId,
            entryInputs: m.entryInputs ?? null,
          })),
        })),
        roofAreas: roofAreas.map(ra => ({
          id: ra.id, name: ra.name, points: ra.points, area: ra.area,
          pitch: ra.pitch, visible: ra.visible, fromPageId: ra.fromPageId ?? outgoingPageId,
          quoteRoofAreaId: ra.quoteRoofAreaId ?? activeAreaId,
        })),
        calibrations: calibrations.map(cal => ({ ...cal })),
        calibrationPoints: calibrationPoints.map(p => ({ ...p })),
        calibrationConfirmed,
        activeComponentIds: [...activeComponentIds],
        selectedComponentId,
        pageIds: mergedPageIds,
      });

      // Best-effort auto-save: persist outgoing area's measurements to DB.
      // Non-blocking on failure - we still switch areas, but alert the user.
      try {
        const currentPageDbId = pages[currentPageIndex]?.id ?? null;
        const allMeasurements: Array<{
          componentId: string | null; type: any; value: number;
          points?: { x: number; y: number }[]; visible: boolean;
          pitch?: number; name?: string; pageId?: string | null;
          quoteRoofAreaId?: string | null;
          entryInputs?: { height_m?: number | null; depth_m?: number | null } | null;
        }> = [];

        componentMeasurements.forEach(comp => {
          comp.measurements.forEach(m => {
            if (m.fromPageId && currentPageDbId && m.fromPageId !== currentPageDbId) return;
            allMeasurements.push({
              componentId: comp.componentId, type: m.type, value: m.value,
              points: m.points, visible: m.visible,
              pageId: currentPageDbId,
              quoteRoofAreaId: m.quoteRoofAreaId ?? activeAreaId,
              entryInputs: m.entryInputs ?? null,
            });
          });
        });

        roofAreas.forEach(area => {
          // Fix (2026-07-06): mirror the fromPageId filter that component
          // measurements already use (line ~1004). Without this, hydrated
          // areas from OTHER pages get re-saved onto the current page on
          // every area switch, creating duplicate area entries.
          if (area.fromPageId && currentPageDbId && area.fromPageId !== currentPageDbId) return;
          allMeasurements.push({
            componentId: null, type: 'area' as const, value: area.area,
            pitch: area.pitch, name: area.name, points: area.points,
            visible: area.visible, pageId: currentPageDbId,
            quoteRoofAreaId: area.quoteRoofAreaId ?? activeAreaId,
          });
        });

        if (allMeasurements.length > 0) {
          const switchSaveResult = await takeoffActions.saveTakeoffMeasurements(
            quote.id, allMeasurements,
            calibrations[0]?.unit || 'feet',
            undefined, undefined, // no canvas snapshot on auto-save
            currentPageDbId, sessionVersionRef.current,
            activeAreaId, // target the outgoing area
            // Fix (2026-07-05): persist the outgoing page's calibration -
            // dropping it here left pages with scale_calibration=NULL, which
            // forced a pointless recalibration on every re-entry/page switch.
            calibrations.length > 0 ? calibrations : null,
          );
          // Only bump local version if the save actually succeeded.
          // If it failed (e.g. STALE_VERSION), bumping causes further drift.
          if (switchSaveResult.success) {
            updateSessionVersion(prev => (prev != null ? prev + 1 : 1));
          } else {
            console.warn('[SwitchArea] Auto-save rejected:', (switchSaveResult as { error?: string }).error);
          }
        }
      } catch (err) {
        console.warn('[SwitchArea] Auto-save failed, continuing with switch:', err);
      }
    }

    // Load target area state from cache.
    // Fix (2026-07-04): hydration-built cache entries only contain
    // componentMeasurements/roofAreas/pageIds - calibration fields are
    // page-level and may be absent. Restoring `undefined` into calibrations
    // crashed the render (`calibrations.length` on undefined → error page).
    // Restore defensively: only overwrite fields the cache actually has.
    const cached = areaCanvasStatesRef.current.get(targetAreaId);
    if (cached) {
      setComponentMeasurements(cached.componentMeasurements ?? []);
      setRoofAreas(cached.roofAreas ?? []);
      if (Array.isArray(cached.calibrations) && cached.calibrations.length > 0) {
        setCalibrations(cached.calibrations);
        setCalibrationPoints(cached.calibrationPoints ?? []);
        setCalibrationConfirmed(cached.calibrationConfirmed ?? true);
      }
      // If the cache lacks activeComponentIds (hydration path), derive them
      // from the cached component measurements so the panel stays populated.
      setActiveComponentIds(
        cached.activeComponentIds
          ?? (cached.componentMeasurements ?? []).map((c: { componentId: string }) => c.componentId)
      );
      setSelectedComponentId(cached.selectedComponentId ?? null);
    } else {
      // Fresh area - clear components/areas but KEEP calibrations (same plan = same scale)
      setComponentMeasurements([]);
      setRoofAreas([]);
      setActiveComponentIds([]);
      setSelectedComponentId(null);
    }

    setActiveAreaId(targetAreaId);
    activeAreaIdRef.current = targetAreaId; // sync ref for canvas handlers
    setActiveSaveRoofAreaId(targetAreaId);

    // Parent/child plans (2026-07-05): resolve the target page - explicit
    // child slot when supplied, else the area's first plan (areaPages index,
    // falling back to cached pageIds). Swap ONLY the background image. NEVER
    // call loadPageImage here - it wiped the state restored above, which is
    // exactly the "every area shows the newest plan, panel empty" bug.
    if (outgoingPageId && calibrations.length > 0) {
      pageCalibrationsRef.current.set(outgoingPageId, calibrations.map(c => ({ ...c })));
    }
    const cachedState = areaCanvasStatesRef.current.get(targetAreaId);
    const candidatePids: string[] = targetPageId
      ? [targetPageId]
      : (areaPages[targetAreaId]
          ?? (cachedState?.pageIds ? Array.from(cachedState.pageIds as Set<string>) : []));
    for (const pid of candidatePids) {
      const pageIndex = pages.findIndex(p => p.id === pid);
      if (pageIndex < 0) continue;
      if (pageIndex !== currentPageIndex) {
        setCurrentPageIndex(pageIndex);
        if (pages[pageIndex]?.url) setPageBackgroundImage(pages[pageIndex].url);
        // Per-plan calibration: restore the target page's own scale.
        const pageCal = pageCalibrationsRef.current.get(pid);
        if (pageCal && pageCal.length > 0) {
          setCalibrations(pageCal.map(c => ({ ...c })));
          setCalibrationPoints([]);
          setCalibrationConfirmed(true);
          setShowCalibrationHelp(false);
        } else {
          // P0-1 (audit 2026-09-20): the target page has NO stored calibration
          // - never inherit the outgoing page's scale and never write another
          // page's calibration into pageCalibrationsRef. Enter the
          // uncalibrated state; the user picks manual or AI calibration here.
          setCalibrations([]);
          setCalibrationPoints([]);
          setCalibrationConfirmed(false);
          setShowCalibrationHelp(true);
        }
      }
      break;
    }

    // Trigger canvas redraw
    setRedrawNonce(n => n + 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAreaId, componentMeasurements, roofAreas, calibrations,
      calibrationPoints, calibrationConfirmed, activeComponentIds,
      selectedComponentId, pages, currentPageIndex, sessionVersion, quote.id, areaPages]);

  // Parent/child plans (2026-07-05): switch between the ACTIVE area's plans
  // (child slots 1, 2, 3…). All measurements stay in state - the redraw
  // filter draws only the target page's shapes. Each plan has its own scale.
  const handleSwitchPage = useCallback(async (targetPageId: string) => {
    const targetIndex = pages.findIndex(p => p.id === targetPageId);
    if (targetIndex < 0 || targetIndex === currentPageIndex) return;

    // M7 (O16): guard the touch dirty draft before the page context (and
    // with it the edit context epoch) changes under an open draft.
    if (touchExitGuardRef.current?.isDirty()) {
      touchExitGuardRef.current.request('Switch plan page', () => {
        void handleSwitchPage(targetPageId);
      });
      return;
    }

    // Discard any in-progress drawing before switching pages
    discardInProgressDrawing();

    // P0-2 (audit 2026-09-20): abort the active AI calibration session before
    // the image changes - in-flight fetch, overlay markers and review state.
    abortAiCalibrationSession();

    const currentPid = pages[currentPageIndex]?.id ?? null;
    // Stamp fresh drawings with the page they were drawn on so the redraw
    // filter doesn't carry them onto the target page.
    if (currentPid) {
      setComponentMeasurements(prev => prev.map(c => ({
        ...c,
        measurements: c.measurements.map(m => m.fromPageId ? m : { ...m, fromPageId: currentPid }),
      })));
      setRoofAreas(prev => prev.map(ra => ra.fromPageId ? ra : { ...ra, fromPageId: currentPid }));
      if (calibrations.length > 0) {
        pageCalibrationsRef.current.set(currentPid, calibrations.map(c => ({ ...c })));
      }

      // Fix (2026-07-06): auto-save the current page's measurements to DB
      // before switching - same pattern as handleSwitchArea. Without this,
      // measurements drawn on the current page are silently lost when the
      // user switches pages and then saves from a different page (the main
      // save filters by fromPageId, and the flush skips the active area).
      try {
        const allMeasurements: Array<{
          componentId: string | null; type: any; value: number;
          points?: { x: number; y: number }[]; visible: boolean;
          pitch?: number; name?: string; pageId?: string | null;
          quoteRoofAreaId?: string | null;
          entryInputs?: { height_m?: number | null; depth_m?: number | null } | null;
        }> = [];

        componentMeasurements.forEach(comp => {
          comp.measurements.forEach(m => {
            if (m.fromPageId && currentPid && m.fromPageId !== currentPid) return;
            allMeasurements.push({
              componentId: comp.componentId, type: m.type, value: m.value,
              points: m.points, visible: m.visible,
              pageId: currentPid,
              quoteRoofAreaId: m.quoteRoofAreaId ?? activeAreaId,
              entryInputs: m.entryInputs ?? null,
            });
          });
        });

        roofAreas.forEach(area => {
          if (area.fromPageId && currentPid && area.fromPageId !== currentPid) return;
          allMeasurements.push({
            componentId: null, type: 'area' as const, value: area.area,
            pitch: area.pitch, name: area.name, points: area.points,
            visible: area.visible, pageId: currentPid,
            quoteRoofAreaId: area.quoteRoofAreaId ?? activeAreaId,
          });
        });

        if (allMeasurements.length > 0) {
          const pageSaveResult = await takeoffActions.saveTakeoffMeasurements(
            quote.id, allMeasurements,
            calibrations[0]?.unit || 'feet',
            undefined, undefined,
            currentPid, sessionVersionRef.current,
            activeAreaId,
            calibrations.length > 0 ? calibrations : null,
          );
          if (pageSaveResult.success) {
            updateSessionVersion(prev => (prev != null ? prev + 1 : 1));
            setIsDirty(false);
          } else {
            console.warn('[SwitchPage] Auto-save rejected:', (pageSaveResult as { error?: string }).error);
          }
        }
      } catch (err) {
        console.warn('[SwitchPage] Auto-save failed, continuing with switch:', err);
      }
    }
    setCurrentPageIndex(targetIndex);
    if (pages[targetIndex]?.url) setPageBackgroundImage(pages[targetIndex].url);
    // Restore the target page's own calibration.
    const pageCal = pageCalibrationsRef.current.get(targetPageId);
    if (pageCal && pageCal.length > 0) {
      setCalibrations(pageCal.map(c => ({ ...c })));
      setCalibrationPoints([]);
      setCalibrationConfirmed(true);
      setShowCalibrationHelp(false);
    } else {
      // P0-1 (audit 2026-09-20): no stored calibration for the target page -
      // never inherit the outgoing page's scale. Calibration restore must
      // only ever come from this page's own stored calibration (the resolver
      // semantics; see calibrationPageState.ts). Start uncalibrated instead.
      console.info('[SwitchPage] No stored calibration for page', targetPageId, '- starting uncalibrated');
      setCalibrations([]);
      setCalibrationPoints([]);
      setCalibrationConfirmed(false);
      setShowCalibrationHelp(true);
    }
    // Reset in-progress drawing buffers/modes for the page swap.
    setAreaMode(false);
    setLineMode(false);
    setPointMode(false);
    setMultiLinealMode(false);
    setCalibrationMode(false);
    setAreaPoints([]);
    setLinePoints([]);
    setMultiLinealPoints([]);
    setMultiLinealSegmentObjects([]);
    setRedrawNonce(n => n + 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages, currentPageIndex, calibrations, componentMeasurements, roofAreas, activeAreaId, sessionVersion, quote.id]);

  // Phase 6: "+ New Area" opens a choice modal.
  // - If no areas exist, go straight to drawing mode for a new area.
  // - If areas exist, show: Option A (add to existing) or Option B (create new).
  const handleCreateNewArea = useCallback(() => {
    // RULE: "+ New Area" always deselects any active component so the
    // drawn polygon is routed as a roof area, not a component measurement.
    // RC-2 fix (2026-07-05): do NOT clear activeComponentIds here - that wiped
    // the entire left-panel component list. Deselecting is enough.
    setSelectedComponentId(null);
    activeAreaComponentIdRef.current = null;
    setPendingComponentId(null);

    if (areaList.length === 0) {
      // No areas - go straight to drawing mode for a new area
      setPendingNewAreaIsExisting(false);
      setPendingNewAreaTargetId(null);
      // RC-1/RC-5: sync refs synchronously - canvas handlers read refs, not state.
      pendingNewAreaIsExistingRef.current = false;
      pendingNewAreaTargetIdRef.current = null;
      viaNewAreaFlowRef.current = true;
      setAreaMode(true);
      setAreaSubTool('polygon');
      setLineMode(false);
      setPointMode(false);
      setMultiLinealMode(false);
      setAreaPoints([]);
      return;
    }
    // Show choice modal
    setNewAreaChoice('new');
    setNewAreaExistingId(areaList[0]?.id ?? '');
    setShowNewAreaChoiceModal(true);
  }, [areaList]);

  // Phase 6: confirm the choice modal → arm drawing mode
  const handleConfirmNewAreaChoice = () => {
    // Defensive: clear component selection again (in case state didn't flush yet)
    // RC-2 fix (2026-07-05): do NOT clear activeComponentIds - keep the panel intact.
    setSelectedComponentId(null);
    activeAreaComponentIdRef.current = null;
    setPendingComponentId(null);
    // RC-5: mark this draw as authorised via the "+ New Area" flow.
    viaNewAreaFlowRef.current = true;

    if (newAreaChoice === 'existing' && newAreaExistingId) {
      // Add to existing: arm drawing mode, set target area
      const targetArea = areaList.find(a => a.id === newAreaExistingId);
      setPendingNewAreaIsExisting(true);
      setPendingNewAreaTargetId(newAreaExistingId);
      // RC-1: sync refs SYNCHRONOUSLY - the canvas handler reads refs, not state.
      pendingNewAreaIsExistingRef.current = true;
      pendingNewAreaTargetIdRef.current = newAreaExistingId;
      setExistingAreaLabel(targetArea?.label ?? '');
      setIsExistingAreaMode(true);
      isExistingAreaModeRef.current = true;
      setShowNewAreaChoiceModal(false);
      setAreaMode(true);
      setAreaSubTool('polygon');
      setLineMode(false);
      setPointMode(false);
      setMultiLinealMode(false);
      setAreaPoints([]);
    } else {
      // Create new: arm drawing mode, name will be collected after polygon close
      setPendingNewAreaIsExisting(false);
      setPendingNewAreaTargetId(null);
      pendingNewAreaIsExistingRef.current = false;
      pendingNewAreaTargetIdRef.current = null;
      setIsExistingAreaMode(false);
      isExistingAreaModeRef.current = false;
      setShowNewAreaChoiceModal(false);
      setAreaMode(true);
      setAreaSubTool('polygon');
      setLineMode(false);
      setPointMode(false);
      setMultiLinealMode(false);
      setAreaPoints([]);
    }
  };

  // Option A (2026-07-05): after "Save & Upload another plan" → new area,
  // the user calibrates the fresh plan first. The moment calibration is
  // confirmed, arm the new-area drawing flow automatically so they draw the
  // boundary right away - no second "+ New Area" click (the double-work
  // complaint).
  useEffect(() => {
    if (!armNewAreaAfterCalibrationRef.current) return;
    if (!calibrationConfirmed) return;
    armNewAreaAfterCalibrationRef.current = false;
    setSelectedComponentId(null);
    activeAreaComponentIdRef.current = null;
    setPendingComponentId(null);
    setPendingNewAreaIsExisting(false);
    setPendingNewAreaTargetId(null);
    pendingNewAreaIsExistingRef.current = false;
    pendingNewAreaTargetIdRef.current = null;
    viaNewAreaFlowRef.current = true;
    setAreaMode(true);
    setAreaSubTool('polygon');
    setLineMode(false);
    setPointMode(false);
    setMultiLinealMode(false);
    setAreaPoints([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calibrationConfirmed]);

  // Fix (2026-07-04): auto-create-first-area REMOVED. It minted a ghost
  // "Area 1" quote_roof_areas row on page load, before the user calibrated
  // or drew anything. Areas are now created only when the user draws their
  // first area (named via AreaNameModal) or via the "+ New Area" flow.

  // Phase 5: Area delete - opens ConfirmModal, then calls takeoffActions.deleteTakeoffArea server action.
  const handleDeleteArea = (areaId: string) => {
    const area = areaList.find(a => a.id === areaId);
    if (!area) return;
    setPendingDeleteAreaId(areaId);
    setPendingDeleteAreaLabel(area.label);
    setShowAreaDeleteConfirm(true);
  };

  const handleConfirmDeleteArea = async () => {
    if (!pendingDeleteAreaId) return;
    setIsDeletingArea(true);
    try {
      const result = await takeoffActions.deleteTakeoffArea(pendingDeleteAreaId);
      if (!result.ok) {
        showAlert('Failed to delete area', result.error || 'Unknown error', 'error');
        return;
      }
      // Remove from client state
      const deletedId = pendingDeleteAreaId;
      setAreaList(prev => prev.filter(a => a.id !== deletedId));
      // Remove canvas objects for this area
      if (fabricRef.current) {
        const toRemove = fabricRef.current.getObjects().filter((obj: any) =>
          obj.measurementId && roofAreas.find(ra => ra.id === deletedId && ra.polygon === obj)
        );
        toRemove.forEach(obj => fabricRef.current!.remove(obj));
        fabricRef.current?.renderAll();
      }
      setRoofAreas(prev => prev.filter(ra => ra.id !== deletedId));
      // Clear cached state for this area
      areaCanvasStatesRef.current.delete(deletedId);
      // If the deleted area was active, switch to the first remaining area
      if (activeAreaId === deletedId) {
        const remaining = areaList.filter(a => a.id !== deletedId);
        if (remaining.length > 0) {
          setActiveAreaId(remaining[0].id);
          setActiveSaveRoofAreaId(remaining[0].id);
          setRedrawNonce(n => n + 1);
        } else {
          // No areas left - clear state
          setActiveAreaId(null);
          setActiveSaveRoofAreaId(null);
          setComponentMeasurements([]);
          setActiveComponentIds([]);
          setSelectedComponentId(null);
        }
      }
    } finally {
      setIsDeletingArea(false);
      setShowAreaDeleteConfirm(false);
      setPendingDeleteAreaId(null);
      setPendingDeleteAreaLabel('');
    }
  };
  // Remove all canvas objects that don't have a measurementId (i.e. in-progress
  // vertex markers, preview shapes, calibration lines) - committed objects
  // are tagged with measurementId by reconstructCanvas or handleSaveArea.
  const cleanupInProgressObjects = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.getObjects().slice().forEach((obj: any) => {
      // Issue C: skip objects tagged as in-progress markers - these are
      // active drawing vertex points that must survive cleanup at commit time.
      if (!obj.measurementId && !obj.isInProgressMarker) {
        canvas.remove(obj);
      }
    });
    canvas.requestRenderAll();
  }, []);

  const handleSaveArea = (
    name: string,
    pitch?: number,
    pointsOverride?: { x: number; y: number }[],
    onResult?: (r: TouchCreateResult) => void,
  ) => {
    // M5: pointsOverride lets the touch outline editor hand a completed manual
    // outline to the EXISTING create flow (owner fields/name/pitch unchanged).
    const sourcePoints = pointsOverride ?? pendingAreaPoints;
    pushHistorySnapshot();
    const calculatedArea = calculatePolygonArea(sourcePoints);

    // Route by pendingComponentId first (captured at polygon-close time).
    // This is immune to selectedComponentId being cleared by canvas deselection.
    const capturedComponentId = onResult ? null : pendingComponentId; // Touch creates a roof, not a stale desktop component.
    const isComponentArea = !!capturedComponentId;
    setPendingComponentId(null); // consume it

    // Roof area: explicit pitch OR no component attached
    if (!isComponentArea && pitch !== undefined) {
      // Remove in-progress vertex markers before adding the committed polygon.
      cleanupInProgressObjects();
      const areaId = `area-${Date.now()}`;
      // Create polygon on canvas
      const polygon = new Polygon(sourcePoints, {
        fill: 'rgba(59, 130, 246, 0.2)',
        stroke: '#3b82f6',
        strokeWidth: 1.25,
        selectable: false,
        evented: false,
      });
      (polygon as unknown as { measurementId: string }).measurementId = areaId;
      fabricRef.current?.add(polygon);
      
      // Area-ownership fix (2026-07-05): resolve the owning DB area id at
      // DRAW time. Add-to-existing → the chosen target; upload-to-existing
      // plan mode → the pre-chosen save area; create-new → stamped in the
      // async callback below once the DB row exists.
      const drawTimeAreaId = (pendingNewAreaIsExisting && pendingNewAreaTargetId)
        ? pendingNewAreaTargetId
        : (isExistingAreaMode ? (activeSaveRoofAreaId ?? activeAreaId) : null);

      // Store roof area with pitch
      const newArea: RoofArea = {
        id: areaId,
        name: name || 'Area',
        points: sourcePoints,
        area: calculatedArea,
        pitch: pitch,
        visible: true,
        polygon,
        markers: [],
        quoteRoofAreaId: drawTimeAreaId,
        // Parent/child plans (2026-07-05): stamp the page at draw time so
        // the save filter can exclude this area when the user uploads a
        // second plan for the same parent. Without this, un-stamped areas
        // pass through the filter and get duplicated onto the new page.
        fromPageId: currentPageIdRef.current, // stamp page at draw time (ref - stale-closure fix)
      };
      
      // Touch Save & finish must also acknowledge pre-created/existing-area
      // branches. Keep the original page/area snapshot; never replace another
      // page's measurements or create a second parent row on a retry.
      const persistTouchArea = (targetAreaId: string, prior: Parameters<typeof takeoffActions.saveTakeoffMeasurements>[1]) => {
        const pageAtStart = newArea.fromPageId;
        const sourceUrl = touchOutlineLiveRef.current?.currentImageUrl;
        const perform = async (nextName: string, nextPitch: number, nextPoints: { x: number; y: number }[]): Promise<TouchCreateResult> => {
          if (!pageAtStart || currentPageIdRef.current !== pageAtStart || sourceUrl !== touchOutlineLiveRef.current?.currentImageUrl) {
            return { ok: false, message: 'The plan changed while saving. Reopen this roof before continuing.', retryable: false };
          }
          try {
            const value = calculatePolygonArea(nextPoints);
            if (!(value > 0)) return { ok: false, message: 'A valid calibrated roof area is required.', retryable: true };
            const result = await takeoffActions.saveTakeoffMeasurements(quote.id, [...prior, {
              componentId: null, type: 'area', value, pitch: nextPitch, name: nextName,
              points: nextPoints, visible: true, pageId: pageAtStart, quoteRoofAreaId: targetAreaId,
            }], calibrationsRef.current[0]?.unit ?? 'meters', undefined, undefined,
            pageAtStart, sessionVersionRef.current, targetAreaId, calibrationsRef.current,
            false, aiCalMetadataRef.current.get(pageAtStart));
            if (!result.success) return { ok: false, message: result.error, retryable: true };
            updateSessionVersion(prev => (prev ?? 0) + 1);
            setRoofAreas(prev => prev.map(area => area.id === newArea.id
              ? { ...area, name: nextName, pitch: nextPitch, points: nextPoints, area: value, quoteRoofAreaId: targetAreaId } : area));
            return { ok: true, geometryId: newArea.id, quoteRoofAreaId: targetAreaId };
          } catch (error) {
            return { ok: false, message: error instanceof Error ? error.message : 'The roof could not be saved.', retryable: true };
          }
        };
        touchCreateRetryRef.current = perform;
        return perform(name, pitch, sourcePoints);
      };

      setRoofAreas([...roofAreas, newArea]);
      setShowAreaNamePrompt(false);
      setPendingAreaPoints([]);
      viaNewAreaFlowRef.current = false; // RC-5: consume the flow flag

      // Phase 6: If this is a new area from the choice modal flow,
      // create the DB row now and add to areaList.
      if (!pendingNewAreaIsExisting && !isExistingAreaMode) {
        // Phase B (2026-07-05): capture the OUTGOING area's state BEFORE the
        // async gap. Creating a new area switches activeAreaId, and without
        // caching first the old area's canvas/panel appeared empty and its
        // measurements were re-stamped to the new area on save.
        const outgoingAreaId = activeAreaId;
        const outgoingComponentMeasurements = componentMeasurements;
        const outgoingRoofAreas = roofAreas; // WITHOUT newArea
        const outgoingActiveComponentIds = activeComponentIds;
        const outgoingCalibrations = calibrations;
        const outgoingCalibrationPoints = calibrationPoints;
        const outgoingCalibrationConfirmed = calibrationConfirmed;
        (async () => {
          try {
            const result = await takeoffActions.createNewTakeoffArea(quote.id, name || undefined);
            if (!(result.ok && result.areaId)) {
              // U4: surfaced, never a silent hang - the touch create awaits
              // this outcome.
              if (onResult) {
                setRoofAreas(prev => prev.filter(area => area.id !== newArea.id));
                fabricRef.current?.remove(polygon);
              }
              onResult?.({ ok: false, message: result.error ?? 'Could not create the roof area row.', retryable: true });
              return;
            }
            if (result.ok && result.areaId) {
              const finalLabel = result.label || name || 'Area';
              const newDbAreaId = result.areaId;

              if (outgoingAreaId && (outgoingComponentMeasurements.length > 0 || outgoingRoofAreas.length > 0)) {
                // 1. Cache the outgoing area's state so switching back restores it.
                areaCanvasStatesRef.current.set(outgoingAreaId, {
                  componentMeasurements: outgoingComponentMeasurements.map(c => ({
                    componentId: c.componentId,
                    expanded: c.expanded,
                    measurements: c.measurements.map(m => ({
                      id: m.id, type: m.type, value: m.value, points: m.points,
                      visible: m.visible, fromPageId: m.fromPageId,
                      quoteRoofAreaId: m.quoteRoofAreaId ?? outgoingAreaId,
                      entryInputs: m.entryInputs ?? null,
                    })),
                  })),
                  roofAreas: outgoingRoofAreas.map(ra => ({
                    id: ra.id, name: ra.name, points: ra.points, area: ra.area,
                    pitch: ra.pitch, visible: ra.visible, fromPageId: ra.fromPageId,
                    quoteRoofAreaId: ra.quoteRoofAreaId ?? outgoingAreaId,
                  })),
                  calibrations: outgoingCalibrations.map(cal => ({ ...cal })),
                  calibrationPoints: outgoingCalibrationPoints.map(p => ({ ...p })),
                  calibrationConfirmed: outgoingCalibrationConfirmed,
                  activeComponentIds: [...outgoingActiveComponentIds],
                  selectedComponentId: null,
                });

                // 2. Best-effort persist of the outgoing area to the DB.
                try {
                  const currentPageDbId = pages[currentPageIndex]?.id ?? null;
                  const outgoingMeasurements: Array<{
                    componentId: string | null; type: any; value: number;
                    points?: { x: number; y: number }[]; visible: boolean;
                    pitch?: number; name?: string; pageId?: string | null;
                    quoteRoofAreaId?: string | null;
                    entryInputs?: { height_m?: number | null; depth_m?: number | null } | null;
                  }> = [];
                  outgoingComponentMeasurements.forEach(comp => {
                    comp.measurements.forEach(m => {
                      if (m.fromPageId && currentPageDbId && m.fromPageId !== currentPageDbId) return;
                      outgoingMeasurements.push({
                        componentId: comp.componentId, type: m.type, value: m.value,
                        points: m.points, visible: m.visible, pageId: currentPageDbId,
                        quoteRoofAreaId: m.quoteRoofAreaId ?? outgoingAreaId,
                        entryInputs: m.entryInputs ?? null,
                      });
                    });
                  });
                  outgoingRoofAreas.forEach(area => {
                    if (area.fromPageId && currentPageDbId && area.fromPageId !== currentPageDbId) return;
                    outgoingMeasurements.push({
                      componentId: null, type: 'area' as const, value: area.area,
                      pitch: area.pitch, name: area.name, points: area.points,
                      visible: area.visible, pageId: currentPageDbId,
                      quoteRoofAreaId: area.quoteRoofAreaId ?? (area.id.startsWith('area-') ? outgoingAreaId : area.id),
                    });
                  });
                  if (outgoingMeasurements.length > 0) {
                    const persistResult = await takeoffActions.saveTakeoffMeasurements(
                      quote.id, outgoingMeasurements,
                      outgoingCalibrations[0]?.unit || 'feet',
                      undefined, undefined, currentPageDbId, sessionVersionRef.current,
                      outgoingAreaId,
                      // Fix (2026-07-05): persist calibration on this path too.
                      outgoingCalibrations.length > 0 ? outgoingCalibrations : null,
                    );
                    if (persistResult.success) {
                      updateSessionVersion(prev => (prev != null ? prev + 1 : 1));
                    }
                  }
                } catch (persistErr) {
                  console.warn('[handleSaveArea] Outgoing-area auto-save failed (state cached, will flush on save):', persistErr);
                }
              }

              setAreaList(prev => [...prev, { id: newDbAreaId, label: finalLabel }]);

              // Parent/child plans (2026-07-05): register this area's first
              // plan slot so the left-panel child chips stay accurate.
              const newAreaPageId = pages[currentPageIndex]?.id ?? null;
              if (newAreaPageId) {
                setAreaPages(prev => prev[newDbAreaId]?.includes(newAreaPageId)
                  ? prev
                  : { ...prev, [newDbAreaId]: [...(prev[newDbAreaId] ?? []), newAreaPageId] });
              }

              // 3. Start the NEW area's view. If there was a previous area, its
              // state is cached above - show only the new polygon. If this is
              // the FIRST area (no outgoing), keep whatever is on screen and
              // just stamp the polygon (its measurements belong here anyway).
              const stampedNewArea = { ...newArea, name: finalLabel, quoteRoofAreaId: newDbAreaId };
              if (outgoingAreaId) {
                setComponentMeasurements([]);
                setActiveComponentIds([]);
                setSelectedComponentId(null);
                setRoofAreas([stampedNewArea]);
              } else {
                setRoofAreas(prev => prev.map(ra => ra.id === newArea.id ? { ...ra, name: finalLabel, quoteRoofAreaId: newDbAreaId } : ra));
              }

              setActiveAreaId(newDbAreaId);
              activeAreaIdRef.current = newDbAreaId; // sync ref for canvas handlers
              setActiveSaveRoofAreaId(newDbAreaId);
              if (onResult) {
                const result = await persistTouchArea(newDbAreaId, []);
                onResult(result);
              } else {
                // Preserve the desktop new-area immediate-persist path.
                try {
                  const pageDbId = pages[currentPageIndex]?.id ?? null;
                  const persisted = await takeoffActions.saveTakeoffMeasurements(quote.id, [{
                    componentId: null, type: 'area', value: stampedNewArea.area,
                    pitch: stampedNewArea.pitch, name: stampedNewArea.name,
                    points: stampedNewArea.points, visible: true, pageId: pageDbId,
                    quoteRoofAreaId: newDbAreaId,
                  }], outgoingCalibrations[0]?.unit || 'feet', undefined, undefined,
                  pageDbId, sessionVersionRef.current, newDbAreaId,
                  outgoingCalibrations.length > 0 ? outgoingCalibrations : null);
                  if (persisted.success) updateSessionVersion(prev => (prev ?? 0) + 1);
                } catch (error) {
                  console.warn('[handleSaveArea] New-area immediate persist failed:', error);
                }
              }
              // Reset Phase 6 state
              setPendingNewAreaIsExisting(false);
              setPendingNewAreaTargetId(null);
              viaNewAreaFlowRef.current = false; // RC-5: consume the flow flag
              // Rebuild canvas from the new state (old area's shapes removed).
              if (outgoingAreaId) {
                setRedrawNonce(n => n + 1);
              }
            }
          } catch (err) {
            console.warn('[handleSaveArea] Failed to create DB area row:', err);
            const uncertain: TouchCreateResult = { ok: false,
              message: 'Could not confirm the roof creation. Check the quote after reloading before creating another roof.', retryable: false };
            if (onResult && !touchCreateRetryRef.current) touchCreateRetryRef.current = async () => uncertain;
            onResult?.(uncertain);
          }
        })();
      } else if (pendingNewAreaIsExisting && pendingNewAreaTargetId) {
        const targetId = pendingNewAreaTargetId;
        // Add-to-existing where the target is NOT the on-screen area: cache the
        // outgoing area's state (without the new polygon), then switch the view
        // to the target area with the polygon appended to its cached state.
        if (activeAreaId && targetId !== activeAreaId) {
          // Parent/child plans (2026-07-05): preserve the cache entry's
          // pageIds and stamp un-paged rows with the current page.
          const cachePageFallback = pages[currentPageIndex]?.id ?? null;
          const prevCachedEntry = areaCanvasStatesRef.current.get(activeAreaId);
          const mergedCachePageIds = new Set<string>(prevCachedEntry?.pageIds ?? []);
          componentMeasurements.forEach(c => c.measurements.forEach(m => {
            const pid = m.fromPageId ?? cachePageFallback; if (pid) mergedCachePageIds.add(pid);
          }));
          roofAreas.forEach(ra => { const pid = ra.fromPageId ?? cachePageFallback; if (pid) mergedCachePageIds.add(pid); });
          areaCanvasStatesRef.current.set(activeAreaId, {
            componentMeasurements: componentMeasurements.map(c => ({
              componentId: c.componentId,
              expanded: c.expanded,
              measurements: c.measurements.map(m => ({
                id: m.id, type: m.type, value: m.value, points: m.points,
                visible: m.visible, fromPageId: m.fromPageId ?? cachePageFallback,
                quoteRoofAreaId: m.quoteRoofAreaId ?? activeAreaId,
                entryInputs: m.entryInputs ?? null,
              })),
            })),
            roofAreas: roofAreas.map(ra => ({
              id: ra.id, name: ra.name, points: ra.points, area: ra.area,
              pitch: ra.pitch, visible: ra.visible, fromPageId: ra.fromPageId ?? cachePageFallback,
              quoteRoofAreaId: ra.quoteRoofAreaId ?? activeAreaId,
            })),
            calibrations: calibrations.map(cal => ({ ...cal })),
            calibrationPoints: calibrationPoints.map(p => ({ ...p })),
            calibrationConfirmed,
            activeComponentIds: [...activeComponentIds],
            selectedComponentId: null,
            pageIds: mergedCachePageIds,
          });
          const cached = areaCanvasStatesRef.current.get(targetId);
          setComponentMeasurements(cached?.componentMeasurements ?? []);
          setActiveComponentIds(
            cached?.activeComponentIds
              ?? (cached?.componentMeasurements ?? []).map((c: { componentId: string }) => c.componentId)
          );
          setSelectedComponentId(null);
          setRoofAreas([...(cached?.roofAreas ?? []), newArea]);
          setRedrawNonce(n => n + 1);
        }
        // Set the active area to the target
        setActiveAreaId(targetId);
        activeAreaIdRef.current = targetId; // sync ref for canvas handlers
        setActiveSaveRoofAreaId(targetId);
        // Parent/child plans (2026-07-05): the target area now has content on
        // the current page - register the child slot.
        {
          const targetPagePid = pages[currentPageIndex]?.id ?? null;
          if (targetPagePid) {
            setAreaPages(prev => prev[targetId]?.includes(targetPagePid)
              ? prev
              : { ...prev, [targetId]: [...(prev[targetId] ?? []), targetPagePid] });
          }
        }
        // Reset Phase 6 state - but keep isExistingAreaMode=true so the save
        // only includes NEWLY drawn areas (client-side IDs), not hydrated ones.
        // This prevents duplicating hydrated areas on re-entry saves.
        setPendingNewAreaIsExisting(false);
        setPendingNewAreaTargetId(null);
        viaNewAreaFlowRef.current = false; // RC-5: consume the flow flag
        // Do NOT reset isExistingAreaMode here - it stays true so the save
        // filter at `!isExistingAreaMode` includes only new polygon areas.
      }

      if (onResult && (pendingNewAreaIsExisting || isExistingAreaMode)) {
        if (!drawTimeAreaId) {
          onResult({ ok: false, message: 'No target roof area was selected. Reopen the takeoff.', retryable: false });
        } else {
          const cache = drawTimeAreaId !== activeAreaId ? areaCanvasStatesRef.current.get(drawTimeAreaId) : null;
          const priorComponents = cache?.componentMeasurements ?? (drawTimeAreaId === activeAreaId ? componentMeasurements : []);
          const priorAreas = cache?.roofAreas ?? (drawTimeAreaId === activeAreaId ? roofAreas : []);
          const pageId = newArea.fromPageId;
          const owns = (row: { fromPageId?: string | null; quoteRoofAreaId?: string | null }) =>
            (!row.fromPageId || row.fromPageId === pageId) && (!row.quoteRoofAreaId || row.quoteRoofAreaId === drawTimeAreaId);
          const prior: Parameters<typeof takeoffActions.saveTakeoffMeasurements>[1] = [];
          priorComponents.forEach((component: ComponentWithMeasurements) => component.measurements.filter(owns).forEach(m => prior.push({
            componentId: component.componentId, type: m.type, value: m.value, points: m.points,
            visible: m.visible, pageId, quoteRoofAreaId: drawTimeAreaId, entryInputs: m.entryInputs ?? null,
          })));
          priorAreas.filter(owns).filter((area: RoofArea) => area.id !== newArea.id).forEach((area: RoofArea) => prior.push({
            componentId: null, type: 'area', value: area.area, pitch: area.pitch, name: area.name,
            points: area.points, visible: area.visible, pageId, quoteRoofAreaId: drawTimeAreaId,
          }));
          void persistTouchArea(drawTimeAreaId, prior).then(onResult);
        }
      }

      // Signal copilot that a roof area was created
      if (roofAreas.length === 0) {
        setTimeout(() => window.dispatchEvent(new CustomEvent('copilot-redetect')), 500);
      }
      setAreaPoints([]);
      setAreaMode(false);
    } else {
      // Component area: use the ID captured at polygon-close time (immune to Fabric
      // deselection). capturedComponentId was read before setPendingComponentId(null).
      const componentId = capturedComponentId || selectedComponentId;
      if (!componentId) return;

      const componentColor = componentColors.find(c => c.componentId === componentId)?.color || '#3b82f6';
      
      // Remove in-progress vertex markers before adding the committed polygon.
      cleanupInProgressObjects();
      const measurementId = `area-${Date.now()}`;
      const polygon = new Polygon(pendingAreaPoints, {
        fill: `${componentColor}33`,
        stroke: componentColor,
        strokeWidth: 1.25,
        selectable: false,
        evented: false,
      });
      (polygon as unknown as { measurementId: string }).measurementId = measurementId;
      fabricRef.current?.add(polygon);
      
      const newMeasurement: ComponentMeasurement = {
        id: measurementId,
        type: 'area',
        value: calculatedArea,
        points: pendingAreaPoints,
        visible: true,
        canvasObjects: [polygon],
        quoteRoofAreaId: activeAreaIdRef.current, // stamp ownership at draw time
        fromPageId: currentPageIdRef.current, // stamp page at draw time (ref - stale-closure fix)
      };
      
      const compData = componentMeasurements.find(c => c.componentId === componentId);
      if (compData) {
        setComponentMeasurements(componentMeasurements.map(c =>
          c.componentId === componentId
            ? { ...c, measurements: [...c.measurements, newMeasurement] }
            : c
        ));
      } else {
        setComponentMeasurements([
          ...componentMeasurements,
          { componentId, measurements: [newMeasurement], expanded: true }
        ]);
      }
      
      setShowAreaNamePrompt(false);
      setPendingAreaPoints([]);
      setAreaPoints([]);
      // Deactivate area mode after saving a component area so the canvas
      // cursor returns to default and the user doesn't accidentally keep drawing.
      setAreaMode(false);
    }
  };

  // (2026-07-05) handleConfirmAreaAssignment REMOVED with the Assign-Area modal.
  
  const handleToggleAreaVisibility = (areaId: string) => {
    pushHistorySnapshot();
    setRoofAreas(roofAreas.map(area => {
      if (area.id === areaId) {
        const newVisible = !area.visible;
        if (area.polygon) {
          area.polygon.set('visible', newVisible);
        }
        area.markers?.forEach(marker => marker.set('visible', newVisible));
        fabricRef.current?.renderAll();
        return { ...area, visible: newVisible };
      }
      return area;
    }));
  };
  
  // P1-2: Central tool-switching helper. Uses the canonical toolForMeasurementType
  // helper so both handleAddComponent and active-component panel clicks stay in sync.
  // M-01 (Gerald audit 2026-05-29): accepts an optional componentId and sets
  // activeAreaComponentIdRef SYNCHRONOUSLY when switching to the area tool.
  // Relying solely on the post-render useEffect left a narrow window where a
  // canvas event could fire before the ref was updated.
  const cleanupBoxDrag = () => {
    isBoxDraggingRef.current = false;
    boxDragStartRef.current = null;
    if (tempBoxRectRef.current && fabricRef.current) {
      fabricRef.current.remove(tempBoxRectRef.current);
      fabricRef.current.renderAll();
    }
    tempBoxRectRef.current = null;
  };

  // Discard any in-progress drawing buffers + remove their preview dots from canvas.
  // Called on every tool switch, component switch, and area switch.
  // Committed measurements (tagged with measurementId) are never touched.
  const discardInProgressDrawing = useCallback(() => {
    setLinePoints([]);
    setAreaPoints([]);
    setMultiLinealPoints([]);
    setMultiLinealSegmentObjects(prev => {
      if (fabricRef.current) {
        prev.forEach((obj: any) => {
          if (obj && !obj.measurementId) fabricRef.current!.remove(obj);
        });
        fabricRef.current.requestRenderAll();
      }
      return [];
    });
    // Remove in-progress vertex markers (yellow dots) from canvas
    const canvas = fabricRef.current;
    if (canvas) {
      canvas.getObjects().slice().forEach((obj: any) => {
        if (obj.isInProgressMarker) canvas.remove(obj);
      });
      canvas.requestRenderAll();
    }
  }, []);

  const applyToolForType = (measurementType: string, forComponentId?: string) => {
    cleanupBoxDrag();
    discardInProgressDrawing();
    setLineMode(false);
    setAreaMode(false);
    setPointMode(false);
    setMultiLinealMode(false);
    const tool = toolForMeasurementType(measurementType);
    if (tool === 'line') {
      setLineMode(true);
      setLineSubTool('single');
      activeAreaComponentIdRef.current = null; // clear area ref when switching away
    } else if (tool === 'multi_line') {
      setMultiLinealMode(true);
      setLineSubTool('multi');
      activeAreaComponentIdRef.current = null;
    } else if (tool === 'area') {
      setAreaMode(true);
      // Synchronously capture which component this area tool is for.
      if (forComponentId) activeAreaComponentIdRef.current = forComponentId;
    } else if (tool === 'point') {
      setPointMode(true);
      activeAreaComponentIdRef.current = null;
    } else {
      // null → manual entry only; no tool active.
      activeAreaComponentIdRef.current = null;
    }
  };

  const handleAddComponent = (componentId: string) => {
    // Add to active list
    setActiveComponentIds([...activeComponentIds, componentId]);
    // Collapse the picker so the freshly added (active) component list is
    // immediately visible under the Add component button (owner UX 2026-09-25:
    // pick -> collapse -> draw; reopen the button to add more).
    setComponentLibraryOpen(false);
    setComponentSearch('');
    
    // Auto-select the newly added component
    setSelectedComponentId(componentId);
    
    // P1-2: Auto-select tool via central helper, passing componentId so the
    // area ref is set synchronously when the tool is 'area'.
    const component = components.find(c => c.id === componentId);
    if (component) {
      const mt = (component.measurement_type ?? component.default_measurement_type ?? '').toLowerCase();
      applyToolForType(mt, componentId);
    }
  };
  
  /** Apply an existing (already-drawn) roof area to an area-type component:
 *  adds the area's plan area as a normal entry stamped with that area, so
 *  downstream pitch/pricing logic treats it exactly like a hand-drawn entry.
 *  2026-08-30 (ported from free roof takeoff): lets users measure an area
 *  once and reuse it for every area-based component (e.g. underlay, wrap,
 *  battens) without re-drawing the same area each time. */
const handleApplyRoofAreaToComponent = (componentId: string, roofAreaId: string) => {
    // Match by UNIQUE row id (sibling areas under one parent can share a
    // quoteRoofAreaId stamp - never resolve by the shared stamp).
    const ra = roofAreas.find(a => a.id === roofAreaId);
    if (!ra || !(ra.area > 0)) return;
    // 2026-09-03: ask the user WHICH value to attach (plan vs pitched) instead
    // of silently snapshotting the pitched value. The choice + plan value are
    // stored on the entry so the save path recomputes from the LIVE pitch -
    // fixing the stale-snapshot bug where pitch was set after attaching.
    const pitched = ra.area * (ra.pitch ? rafterPitchFactor(ra.pitch) : 1);
    setAreaAttachChoice({
      componentId,
      roofAreaId,
      plan: ra.area,
      pitched,
      pitch: ra.pitch || 0,
      basis: 'pitched',
    });
  };

  const handleConfirmAreaAttach = () => {
    const choice = areaAttachChoice;
    if (!choice) return;
    const ra = roofAreas.find(a => a.id === choice.roofAreaId);
    if (!ra || !(ra.area > 0)) { setAreaAttachChoice(null); return; }
    pushHistorySnapshot();
    const value = choice.basis === 'pitched' ? choice.pitched : choice.plan;
    const newMeasurement: ComponentMeasurement = {
      id: `apply-${Date.now()}`,
      type: 'area' as ComponentMeasurement['type'],
      value,
      points: [],
      visible: true,
      canvasObjects: [], // derived entry - no canvas geometry of its own
      // Stamp the DB area id (UUID) - the save flow sends quoteRoofAreaId to
      // Postgres, so a client row id ("area-...") fails with invalid uuid.
      quoteRoofAreaId: ra.quoteRoofAreaId ?? ra.id,
      fromPageId: currentPageIdRef.current,
      // 2026-09-03: value basis + plan snapshot. takeoffActions.saveTakeoffMeasurements
      // recomputes from the LIVE area pitch at save time:
      //   basis 'pitched' -> plan x pitch factor   (roof sheets etc.)
      //   basis 'plan'    -> plan, no pitch        (flat/plan takeoff)
      // P3 (spec 10.3): durable source-polygon link so recalibration can
      // refresh this entry when its source area rescales.
      entryInputs: {
        value_basis: choice.basis,
        plan_value: choice.plan,
        source_geometry_id: ra.id,
      },
    };
    const compData = componentMeasurements.find(c => c.componentId === choice.componentId);
    if (compData) {
      setComponentMeasurements(componentMeasurements.map(c =>
        c.componentId === choice.componentId
          ? { ...c, measurements: [...c.measurements, newMeasurement], expanded: true }
          : c
      ));
    } else {
      setComponentMeasurements([
        ...componentMeasurements,
        { componentId: choice.componentId, measurements: [newMeasurement], expanded: true },
      ]);
    }
    setAreaAttachChoice(null);
    setIsDirty(true);
  };

  /** Corner counting (owner 2026-09-30): apply detected corner counts to a
   *  count-based (point/quantity) component as one entry. Value = the live
   *  count, points = the counted vertices (rendered as markers for visual
   *  verification), provenance on entryInputs so the corner-derived basis
   *  survives save/load. Mirrors the area-attach flow above. */
  const handleApplyCornerCountToComponent = (componentId: string, basis: CornerBasis) => {
    const selection = cornerSelection(cornerTotalsAcross(roofAreas), basis);
    if (!selection.count) return;
    const outlines = roofAreas.filter(ra => Array.isArray(ra.points) && ra.points.length >= 3);
    const singleArea = outlines.length === 1 ? outlines[0] : null;
    pushHistorySnapshot();
    const newMeasurement: ComponentMeasurement = {
      id: `corner-${typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Date.now()}`,
      type: 'point',
      value: selection.count,
      points: selection.points,
      visible: true,
      canvasObjects: [], // derived entry - markers render from points
      // Stamp the DB area id when all corners come from ONE outline so the
      // save path routes this group to its owning roof area (multi-outline
      // totals stay unassigned, like any cross-area component).
      quoteRoofAreaId: singleArea ? (singleArea.quoteRoofAreaId ?? singleArea.id) : null,
      fromPageId: currentPageIdRef.current,
      entryInputs: {
        value_basis: cornerValueBasis(basis),
        corner_count: selection.count,
        ...(singleArea ? { source_geometry_id: singleArea.id } : {}),
      },
    };
    const compData = componentMeasurements.find(c => c.componentId === componentId);
    if (compData) {
      setComponentMeasurements(componentMeasurements.map(c =>
        c.componentId === componentId
          ? { ...c, measurements: [...c.measurements, newMeasurement], expanded: true }
          : c
      ));
    } else {
      setComponentMeasurements([
        ...componentMeasurements,
        { componentId, measurements: [newMeasurement], expanded: true },
      ]);
    }
    setIsDirty(true);
  };

  const handleRemoveComponent = (componentId: string) => {
    pushHistorySnapshot();
    // Discard any in-progress drawing when removing a component
    discardInProgressDrawing();
    // Remove from active list
    setActiveComponentIds(activeComponentIds.filter(id => id !== componentId));
    
    // Remove all measurements for this component from canvas
    const compData = componentMeasurements.find(c => c.componentId === componentId);
    if (compData && fabricRef.current) {
      compData.measurements.forEach(m => {
        m.canvasObjects?.forEach(obj => fabricRef.current!.remove(obj));
      });
      fabricRef.current.renderAll();
    }
    
    // Remove from measurements state
    setComponentMeasurements(componentMeasurements.filter(c => c.componentId !== componentId));
    
    // Deselect if this was selected
    if (selectedComponentId === componentId) {
      setSelectedComponentId(null);
    }
  };
  
  const handleDeleteMeasurement = (componentId: string, measurementId: string) => {
    pushHistorySnapshot();
    setComponentMeasurements(componentMeasurements.map(comp => {
      if (comp.componentId === componentId) {
        const measurement = comp.measurements.find(m => m.id === measurementId);
        
        // Remove from canvas
        if (measurement && fabricRef.current) {
          measurement.canvasObjects?.forEach(obj => fabricRef.current!.remove(obj));
          fabricRef.current.renderAll();
        }
        
        return {
          ...comp,
          measurements: comp.measurements.filter(m => m.id !== measurementId),
        };
      }
      return comp;
    }));
  };
  
  const handleToggleMeasurementVisibility = (componentId: string, measurementId: string) => {
    pushHistorySnapshot();
    setComponentMeasurements(componentMeasurements.map(comp => {
      if (comp.componentId === componentId) {
        return {
          ...comp,
          measurements: comp.measurements.map(m => {
            if (m.id === measurementId) {
              const newVisible = !m.visible;
              // Toggle canvas objects
              m.canvasObjects?.forEach(obj => obj.set('visible', newVisible));
              fabricRef.current?.renderAll();
              return { ...m, visible: newVisible };
            }
            return m;
          }),
        };
      }
      return comp;
    }));
  };
  
  const handleToggleComponentVisibility = (componentId: string) => {
    setComponentMeasurements(componentMeasurements.map(comp => {
      if (comp.componentId === componentId) {
        // Check if all measurements are visible
        const allVisible = comp.measurements.every(m => m.visible);
        const newVisible = !allVisible;
        
        return {
          ...comp,
          measurements: comp.measurements.map(m => {
            // Toggle canvas objects
            m.canvasObjects?.forEach(obj => obj.set('visible', newVisible));
            fabricRef.current?.renderAll();
            return { ...m, visible: newVisible };
          }),
        };
      }
      return comp;
    }));
  };
  
  // Phase 7: commit the multi-lineal polyline as one measurement. Called by
  // double-click on canvas OR the "Finish" button in the toolbar readout.
  // Sums all segment lengths using the calibration scale and adds a single
  // 'multi_lineal' measurement to the selected component.
  const handleFinishMultiLineal = () => {
    pushHistorySnapshot();
    const currentPoints = multiLinealPointsRef.current;
    if (currentPoints.length < 2) return;

    const canvas = fabricRef.current;
    const currentCalibrations = calibrationsRef.current;
    if (!currentCalibrations.length || !canvas) return;

    // P3: unit-normalised effective scale (identical to a single calibration's
    // own scale in the common case; correct for mixed feet/meters sets).
    const effectiveScale = effectiveScaleFromLegacyCalibrations(currentCalibrations);

    // Sum all segment lengths in real-world units.
    let totalLength = 0;
    for (let i = 1; i < currentPoints.length; i++) {
      const dx = currentPoints[i].x - currentPoints[i - 1].x;
      const dy = currentPoints[i].y - currentPoints[i - 1].y;
      totalLength += Math.sqrt(dx * dx + dy * dy) * effectiveScale;
    }

    const compId = selectedComponentIdRef.current;
    if (!compId) return;

    // Use the component's actual measurement_type so multi_lineal_lxh
    // is stored correctly and the save layer applies height conversion.
    const compForType = components.find(c => c.id === compId);
    const compMeasType = (compForType?.measurement_type ?? compForType?.default_measurement_type) as string;

    // Freestyle: intercept multi_lineal_lxh_freestyle - show height prompt instead of committing.
    if (compMeasType === 'multi_lineal_lxh_freestyle') {
      const canvasObjs = [...multiLinealSegmentObjects];
      setPendingFreestyleLength(totalLength);
      setPendingFreestyleComponentId(compId);
      setPendingFreestylePoints([...currentPoints]);
      setPendingFreestyleCanvasObjects(canvasObjs);
      setPendingFreestyleIsMultiLineal(true);
      setFreestyleHeightInput('');
      setShowFreestyleHeightPrompt(true);
      setMultiLinealPoints([]);
      setMultiLinealSegmentObjects([]);
      return;
    }

    const resolvedType: 'multi_lineal' | 'multi_lineal_lxh' =
      compMeasType === 'multi_lineal_lxh'
        ? 'multi_lineal_lxh'
        : 'multi_lineal';

    const mlId = `ml-${Date.now()}`;
    // Tag segment objects with measurementId so cleanupInProgressObjects won't remove them.
    multiLinealSegmentObjects.forEach((obj: any) => { obj.measurementId = mlId; });

    const newMeasurement: ComponentMeasurement = {
      id: mlId,
      type: resolvedType,
      value: totalLength,
      points: currentPoints,
      visible: true,
      canvasObjects: multiLinealSegmentObjects,
      quoteRoofAreaId: activeAreaIdRef.current, // stamp ownership at draw time
      fromPageId: currentPageIdRef.current, // stamp page at draw time (ref - stale-closure fix)
    };

    // Add measurement to state. Mirrors the create-or-update pattern used by
    // Line / Area / Point handlers so the first measurement for a component
    // doesn't get silently dropped when no prior entry exists. (Phase 7 bug:
    // earlier version used prev.map only, which lost the very first
    // multi_lineal measurement on a component and produced empty
    // quote_components rows in the quote builder.)
    setComponentMeasurements(prev => {
      const exists = prev.some(c => c.componentId === compId);
      if (exists) {
        return prev.map(c =>
          c.componentId === compId
            ? { ...c, measurements: [...c.measurements, newMeasurement] }
            : c
        );
      }
      return [
        ...prev,
        { componentId: compId, measurements: [newMeasurement], expanded: true },
      ];
    });

    // Reset multi-lineal state (keep objects on canvas, they're captured above).
    setMultiLinealPoints([]);
    setMultiLinealSegmentObjects([]);
    setPopupPos(null); // reset popup position on finish
  };

  const handleCancelMultiLineal = () => {
    pushHistorySnapshot();
    // Remove all drawn segment objects from canvas.
    if (fabricRef.current) {
      multiLinealSegmentObjects.forEach(obj => fabricRef.current!.remove(obj));
      fabricRef.current.renderAll();
    }
    setMultiLinealPoints([]);
    setMultiLinealSegmentObjects([]);
    setMultiLinealMode(false);
    setPopupPos(null); // reset popup position on cancel
  };

  // Phase 7: load a new image onto the canvas. Used when switching pages.
  // Clears all drawn objects first (areas, lines, markers) then loads the
  // new image as the canvas background.
  // Parent/child plans (2026-07-05): background-image-only loader. Swaps the
  // plan image WITHOUT touching measurements/areas/components state. Used when
  // switching between areas/child plans - the caller is responsible for
  // clearing drawn objects (redrawCanvasFromState does that) and restoring the
  // page's calibration.
  const setPageBackgroundImage = (imageUrl: string) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const imgElement = new Image();
    imgElement.crossOrigin = 'anonymous';
    imgElement.onload = () => {
      // Dynamic canvas sizing: the SCENE keeps the processed image dims; the
      // ELEMENT is sized to the viewport instead (viewport pattern 2026-09-26).
      const dims = computeCanvasDimensions(imgElement.naturalWidth, imgElement.naturalHeight);
      sceneDimsRef.current = { width: dims.width, height: dims.height };
      setCanvasDims({ width: dims.width, height: dims.height });

      const fabricImg = new FabricImage(imgElement);
      fabricImg.set({
        scaleX: dims.scale, scaleY: dims.scale,
        left: 0, top: 0,
        originX: 'left', originY: 'top',
        selectable: false, evented: false,
      });
      canvas.backgroundImage = fabricImg;
      canvas.renderAll();

      // Auto-fit on page switch (viewport pattern): element tracks the
      // viewport, plan fits + centres via the transform.
      const viewportWrapper = canvasRef.current?.parentElement;
      if (viewportWrapper) {
        canvas.setDimensions({
          width: Math.max(160, viewportWrapper.clientWidth),
          height: Math.max(160, viewportWrapper.clientHeight),
        });
        const fit = computeFitVpt(dims.width, dims.height, canvas.getWidth(), canvas.getHeight());
        canvas.setViewportTransform(fit.vpt);
        canvas.renderAll();
        setZoom(fit.scale);
        setViewClipped(isSceneClipped(fit.vpt, dims.width, dims.height, canvas.getWidth(), canvas.getHeight()));
        lastAutoFitZoom.current = fit.scale;
      }
    };
    imgElement.src = imageUrl;
  };

  const loadPageImage = (imageUrl: string, opts?: { preserveMeasurements?: boolean }) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    // Remove all objects (measurements, calibration lines, etc.).
    canvas.clear();
    canvas.backgroundColor = '#1e293b';
    setPageBackgroundImage(imageUrl);
    // Reset ALL tool modes + calibration for the fresh page.
    // CRITICAL: mode resets must come first. Without them the canvas click
    // handler routes to the wrong tool after the page switch (e.g. areaMode)
    // so calibration points are silently dropped, leaving the user stuck.
    setAreaMode(false);
    setLineMode(false);
    setPointMode(false);
    setMultiLinealMode(false);
    setCalibrationMode(false);
    setCalibrationPoints([]);
    setShowCalibrationModal(false);
    setShowCalibrationHelp(true);
    setShowConfirmedFlash(false);
    setCalibrations([]);
    setCalibrationConfirmed(false);
    setAreaPoints([]);
    setLinePoints([]);
    setMultiLinealPoints([]);
    setMultiLinealSegmentObjects([]);
    // Parent/child plans (2026-07-05): preserveMeasurements keeps the parent
    // area's measurements/components in state when attaching a new plan to an
    // EXISTING area - the wipe below destroyed every area's panel data (the
    // "Garage and Main Roof went blank" bug). Canvas objects are already
    // cleared above; the redraw filter keeps other pages' shapes off-canvas.
    if (!opts?.preserveMeasurements) {
      setComponentMeasurements([]);
      setRoofAreas([]);
      setSelectedComponentId(null);
      // Fix (2026-07-05): also clear the ACTIVE component panel - leaving it
      // populated made a brand-new area show the previous area's components.
      setActiveComponentIds([]);
      // P1-3: reset existing-area mode so a fresh plan doesn't inherit the constraint.
      setIsExistingAreaMode(false);
      setExistingAreaLabel('');
    }
    setIsDirty(false);
  };

  // switchToPage removed (Issue 1): plan tabs are now a read-only visual
  // indicator. Tabs were non-functional (no canvas re-hydration on switch)
  // and the window.confirm was replaced with a Plan X of Y display.

  /** Confirm handler for the volume_3d depth prompt. */
  const handleConfirmVolumeDepth = () => {
    const depth = parseFloat(volumeDepthInput);
    if (!depth || depth <= 0 || !pendingVolumeComponentId) return;
    pushHistorySnapshot();
    const unit = calibrations[0]?.unit ?? 'meters';
    const areaM2 = unit === 'feet'
      ? convertAreaFt2ToMetric(pendingVolumeCalibratedArea)
      : pendingVolumeCalibratedArea;
    const depthM = unit === 'feet' ? convertLinearToMetric(depth) : depth;
    const volumeM3 = areaM2 * depthM;
    const componentId = pendingVolumeComponentId;
    const volId = `meas-${Date.now()}`;
    // Tag polygon with measurementId.
    if (pendingVolumePolygon) (pendingVolumePolygon as any).measurementId = volId;
    const newMeasurement: ComponentMeasurement = {
      id: volId,
      type: 'volume_3d',
      value: volumeM3,
      points: pendingVolumePoints,
      visible: true,
      canvasObjects: pendingVolumePolygon ? [pendingVolumePolygon] : [],
      quoteRoofAreaId: activeAreaIdRef.current, // stamp ownership at draw time
      fromPageId: currentPageIdRef.current, // stamp page at draw time (ref - stale-closure fix)
      entryInputs: { depth_m: depthM }, // v8: user-entered depth (display only)
    };
    // Solid polygon (remove dash preview)
    if (pendingVolumePolygon) {
      pendingVolumePolygon.set({ strokeDashArray: null });
      fabricRef.current?.renderAll();
    }
    const compData = componentMeasurements.find(c => c.componentId === componentId);
    if (compData) {
      setComponentMeasurements(componentMeasurements.map(c =>
        c.componentId === componentId
          ? { ...c, measurements: [...c.measurements, newMeasurement] }
          : c
      ));
    } else {
      setComponentMeasurements([
        ...componentMeasurements,
        { componentId, measurements: [newMeasurement], expanded: true },
      ]);
    }
    setShowVolumeDepthPrompt(false);
    setPendingVolumePolygon(null);
    setPendingVolumeComponentId(null);
    setVolumeDepthInput('');
    setAreaMode(false);
    setIsDirty(true);
  };

  /** Confirm handler for the freestyle height prompt (length_x_height_freestyle / multi_lineal_lxh_freestyle). */
  const handleConfirmFreestyleHeight = () => {
    pushHistorySnapshot();
    const height = parseFloat(freestyleHeightInput);
    if (!height || height <= 0 || !pendingFreestyleComponentId) return;
    const unit = calibrations[0]?.unit ?? 'meters';
    const lengthM = unit === 'feet' ? convertLinearToMetric(pendingFreestyleLength) : pendingFreestyleLength;
    const heightM = unit === 'feet' ? convertLinearToMetric(height) : height;
    const areaM2 = lengthM * heightM;
    const measType = pendingFreestyleIsMultiLineal ? 'multi_lineal_lxh_freestyle' : 'length_x_height_freestyle';
    const componentId = pendingFreestyleComponentId;
    const fsId = `fs-${Date.now()}`;
    // Tag canvas objects with measurementId.
    pendingFreestyleCanvasObjects.forEach((obj: any) => { obj.measurementId = fsId; });
    const newMeasurement: ComponentMeasurement = {
      id: fsId,
      type: measType as ComponentMeasurement['type'],
      value: areaM2,
      points: pendingFreestylePoints,
      visible: true,
      canvasObjects: pendingFreestyleCanvasObjects,
      quoteRoofAreaId: activeAreaIdRef.current, // stamp ownership at draw time
      fromPageId: currentPageIdRef.current, // stamp page at draw time (ref - stale-closure fix)
      entryInputs: { height_m: heightM }, // v8: user-entered height (display only)
    };
    setComponentMeasurements(prev => {
      const exists = prev.some(c => c.componentId === componentId);
      if (exists) {
        return prev.map(c =>
          c.componentId === componentId
            ? { ...c, measurements: [...c.measurements, newMeasurement] }
            : c
        );
      }
      return [...prev, { componentId, measurements: [newMeasurement], expanded: true }];
    });
    setShowFreestyleHeightPrompt(false);
    setFreestyleHeightInput('');
    setPendingFreestyleComponentId(null);
    setPendingFreestylePoints([]);
    setPendingFreestyleCanvasObjects([]);
    setIsDirty(true);
  };

  // P1-3: persist current measurements + canvas snapshots without navigating.
  // Returns true on success so the multi-page "Save & Upload another plan"
  // flow can chain the next step. The existing handleSaveTakeoff wraps this
  // and navigates to the Quote Builder on success.
  // P3: opts.requireCalibrationCommit makes the calibration persistence fatal
  // (COMMIT_FAILED) instead of non-fatal - used by the AI calibration finish path.
  const persistTakeoffData = async (opts: { requireCalibrationCommit?: boolean; extraMeasurements?: Array<ComponentMeasurement & { componentId: string }> } = {}): Promise<boolean> => {
    return await handleSaveTakeoffCore(false, opts);
  };

  const handleSaveTakeoff = async () => {
    await handleSaveTakeoffCore(true);
  };

  const handleSaveTakeoffCore = async (navigateAfter: boolean, opts: { requireCalibrationCommit?: boolean; extraMeasurements?: Array<ComponentMeasurement & { componentId: string }> } = {}): Promise<boolean> => {
    console.log('[SaveTakeoff] Starting save for quote:', quote.id);
    console.log('[SaveTakeoff] Component measurements:', componentMeasurements.length);
    console.log('[SaveTakeoff] Roof areas:', roofAreas.length);
    
    if (componentMeasurements.length === 0 && roofAreas.length === 0) {
      showAlert('No measurements to save', 'Please add some measurements first.', 'info');
      return false;
    }
    
    setIsSaving(true);
    
    try {
      // Flatten component measurements
      const allMeasurements: any[] = [];
      
      // Determine the current page's DB id before the measurement loop so
      // we can scope the save correctly.
      const currentPageDbIdEarly = pages[currentPageIndex]?.id ?? null;

      // Add component measurements.
      // IMPORTANT: only include measurements that belong to the current page.
      // Hydrated measurements from OTHER pages (fromPageId != currentPage) must
      // be excluded here - they are already in the DB under their correct pages.
      // Including them causes H-01 to double-count: H-01 fetches the same data
      // from the DB AND we include it again in allMeasurements, resulting in
      // duplicate quote_component_entries (the P1-3 regression Shaun saw).
      componentMeasurements.forEach(comp => {
        comp.measurements.forEach(m => {
          // fromPageId is set for hydrated measurements. Exclude any that belong
          // to a different page so we don't re-save them as this page's data.
          if (m.fromPageId && currentPageDbIdEarly && m.fromPageId !== currentPageDbIdEarly) {
            return; // skip - belongs to a different page, already in DB
          }
          allMeasurements.push({
            componentId: comp.componentId,
            type: m.type,
            value: m.value,
            points: m.points,
            visible: m.visible,
            // Area-ownership fix (2026-07-05): use the DRAW-time stamp; only
            // fall back to the save-time active area for legacy/unstamped rows.
            quoteRoofAreaId: m.quoteRoofAreaId ?? activeAreaId ?? activeSaveRoofAreaId,
            // v8: user-entered H/D reference (display only).
            entryInputs: m.entryInputs ?? null,
          });
        });
      });
      
      // F3: touch component rows go STRAIGHT into the payload - React state
      // timing cannot drop them (the race that emptied the Parts phase in
      // iPhone testing: setComponentMeasurements + immediate persist read
      // the PREVIOUS render's state).
      for (const m of opts.extraMeasurements ?? []) {
        allMeasurements.push({
          componentId: m.componentId,
          type: m.type,
          value: m.value,
          points: m.points,
          visible: m.visible,
          quoteRoofAreaId: m.quoteRoofAreaId ?? activeAreaId ?? activeSaveRoofAreaId,
          entryInputs: m.entryInputs ?? null,
        });
      }

      // Add area measurements.
      // RC-6 fix (2026-07-05): the RPC now scopes its delete by page_id, so we
      // must re-send ALL current-page roof areas (hydrated + newly drawn).
      // Hydrated areas from OTHER pages are filtered out by fromPageId - they
      // are already in the DB under their own page and the page-scoped delete
      // won't touch them.
      const currentPageDbIdForAreas = pages[currentPageIndex]?.id ?? null;
      roofAreas.forEach(area => {
        // Skip hydrated areas that belong to a different page.
        if (area.fromPageId && currentPageDbIdForAreas && area.fromPageId !== currentPageDbIdForAreas) {
          return;
        }
        allMeasurements.push({
          componentId: null,
          type: 'area' as const,
          value: area.area,
          pitch: area.pitch,
          name: area.name,
          points: area.points,
          visible: area.visible,
          // Area-ownership fix (2026-07-05): draw-time stamp first; fallback
          // to active area. NEVER use area.id (that's a measurement id for
          // hydrated areas, not a quote_roof_areas.id - using it fails RPC
          // validation: "quote_roof_area_id does not belong to quote").
          quoteRoofAreaId: area.quoteRoofAreaId ?? activeAreaId ?? activeSaveRoofAreaId,
        });
      });
      
      // After filtering, if there's nothing to save for the current page,
      // treat this as a SAFE SKIP - not a full save. This happens in mode=add
      // when the user hasn't drawn anything new in the current session; all
      // componentMeasurements are hydrated from other pages and excluded above.
      //
      // Contract (M-02 Gerald audit 2026-05-29):
      //  - We do NOT advance the session version (no RPC call).
      //  - We do NOT clear isDirty (no data was actually committed here).
      //  - We only navigate if the caller explicitly requests it.
      //  - This branch must NEVER be used when there are local unsaved changes
      //    (those would have a null/undefined fromPageId and would NOT be filtered).
      if (allMeasurements.length === 0) {
        console.log('[SaveTakeoff] Safe skip - no new measurements for current page. Not a full save.');
        // navigateAfter=false means this was called from persistTakeoffData()
        // before an upload - fine to skip silently.
        // navigateAfter=true means the user clicked "Save & Continue" with no
        // new data drawn - also fine to navigate, but we do NOT mark dirty=false.
        if (navigateAfter) {
          if (onFreeFinish) onFreeFinish(buildFinishPayload()); else router.push(`/${workspaceSlug}/quotes/${quote.id}/build?step=roof-areas`);
        }
        return true;
      }

      console.log('[SaveTakeoff] Saving', allMeasurements.length, 'measurements to quote:', quote.id);
      
      // Export canvas as PNG (2 images: full canvas + lines-only).
      // We persist STORAGE PATHS, not URLs, so render sites can sign on render
      // with a short TTL (Gerald audit pass 2 fix).
      let canvasImagePath: string | undefined;
      let linesImagePath: string | undefined;
      if (fabricRef.current) {
        const canvas = fabricRef.current;
        
        // 1. Export FULL canvas (plan image + drawings)
        console.log('[SaveTakeoff] Exporting full canvas image...');
        const fullDataUrl = canvas.toDataURL({
          format: 'png',
          quality: 0.9,
          multiplier: 1,
        });
        
        try {
          const uploadResult = await takeoffActions.uploadCanvasImage(quote.id, fullDataUrl);
          if (uploadResult.ok) {
            canvasImagePath = uploadResult.path;
            console.log('[SaveTakeoff] Full canvas image uploaded (path):', canvasImagePath);
          } else {
            console.error('[SaveTakeoff] Failed to upload full canvas image:', uploadResult.error);
          }
        } catch (uploadError) {
          console.error('[SaveTakeoff] Failed to upload full canvas image:', uploadError);
        }
        
        // 2. Export LINES-ONLY (hide bg image + area fills, convert all to black)
        console.log('[SaveTakeoff] Exporting lines-only image...');
        try {
          const objects = canvas.getObjects();
          const bgImage = canvas.backgroundImage;
          
          // Store original state for all objects
          const originalBg = canvas.backgroundColor;
          const originalStates: { obj: any; fill: any; stroke: any; visible: boolean }[] = [];
          
          objects.forEach((obj: any) => {
            originalStates.push({
              obj,
              fill: obj.fill,
              stroke: obj.stroke,
              visible: obj.visible !== false,
            });
          });
          
          // Hide background image
          const originalBgVisible = bgImage ? (bgImage as any).visible : true;
          if (bgImage) (bgImage as any).set('visible', false);
          canvas.backgroundColor = '#ffffff';
          
          // Convert all drawable objects to black, remove area fills
          objects.forEach((obj: any) => {
            if (obj === bgImage) return;
            
            // Polygons: remove fill overlay, black stroke
            if (obj.type === 'polygon') {
              obj.set({ fill: 'transparent', stroke: '#000000' });
            }
            // Lines: black stroke
            else if (obj.type === 'line') {
              obj.set({ stroke: '#000000' });
            }
            // Circles (markers): black fill and stroke
            else if (obj.type === 'circle') {
              obj.set({ fill: '#000000', stroke: '#000000' });
            }
            // Triangles (arrow markers): black
            else if (obj.type === 'triangle') {
              obj.set({ fill: '#000000', stroke: '#000000' });
            }
            // Any other drawn object: try black
            else if (obj !== bgImage) {
              if (obj.stroke) obj.set({ stroke: '#000000' });
              if (obj.fill && obj.fill !== 'transparent') obj.set({ fill: '#000000' });
            }
          });
          
          canvas.renderAll();
          
          // Export
          const linesDataUrl = canvas.toDataURL({
            format: 'png',
            quality: 0.9,
            multiplier: 1,
          });
          
          // Restore ALL original states
          originalStates.forEach(({ obj, fill, stroke, visible }) => {
            obj.set({ fill, stroke, visible });
          });
          if (bgImage) (bgImage as any).set('visible', originalBgVisible);
          canvas.backgroundColor = originalBg as string;
          canvas.renderAll();
          
          // Upload lines-only image
          const linesResult = await takeoffActions.uploadCanvasImage(quote.id, linesDataUrl, 'lines');
          if (linesResult.ok) {
            linesImagePath = linesResult.path;
            console.log('[SaveTakeoff] Lines-only image uploaded (path):', linesImagePath);
          } else {
            console.error('[SaveTakeoff] Failed to upload lines-only image:', linesResult.error);
          }
        } catch (linesError) {
          console.error('[SaveTakeoff] Failed to export lines-only image:', linesError);
        }
      }
      
      // Phase 7 scoped-delete: pass the current page's DB id so the RPC
      // only clears this page's measurements. Falls back to quote-wide
      // delete when no page id exists (single-page / legacy flow).
      // C-01: include pageId on every measurement so scoped delete works.
      const currentPageDbId = pages[currentPageIndex]?.id ?? null;
      if (currentPageDbId) {
        allMeasurements.forEach(m => { m.pageId = currentPageDbId; });
      }
      const saveResult = await takeoffActions.saveTakeoffMeasurements(
        quote.id,
        allMeasurements,
        calibrations[0]?.unit || 'feet',
        canvasImagePath,
        linesImagePath,
        currentPageDbId,
        sessionVersionRef.current, // P1-1a: optimistic version guard (ref: always current, never stale)
        // P1-3: activeSaveRoofAreaId tracks the target area for the current
        // page. Starts as initialRoofAreaId (for mode=new-page entries) and
        // is updated client-side when the user uploads another plan.
        activeSaveRoofAreaId,
        // Canvas-rework: persist calibrations so re-entry can restore scale.
        calibrations.length > 0 ? calibrations : null,
        // P3: AI-finish recalibration requires a verified calibration commit.
        opts.requireCalibrationCommit === true,
        // P4: versioned calibration envelope for this page (codec v1), when the
        // active calibration came from the AI-assisted flow. Null otherwise.
        (currentPageDbId ? aiCalMetadataRef.current.get(currentPageDbId) : undefined) ?? undefined,
      );

      if (!saveResult.success) {
        // Surface the actual error message - not hidden by Next.js production mode
        // since we return errors rather than throwing.
        const msg = saveResult.error;
        if (msg.includes('STALE_TAKEOFF_VERSION')) {
          // Recovery: fetch the authoritative version from DB and retry once.
          // The version drift is usually caused by a prior auto-save that
          // bumped the DB version without the client knowing (e.g. a
          // page-switch save that succeeded but whose response was lost).
          try {
            const authoritativeVersion = await takeoffActions.getTakeoffSessionVersion(quote.id);
            if (authoritativeVersion != null) {
              updateSessionVersion(() => authoritativeVersion);
              // Retry the save with the correct version.
              const retryResult = await takeoffActions.saveTakeoffMeasurements(
                quote.id,
                allMeasurements,
                calibrations[0]?.unit || 'feet',
                canvasImagePath,
                linesImagePath,
                currentPageDbId,
                authoritativeVersion,
                activeSaveRoofAreaId,
                calibrations.length > 0 ? calibrations : null,
                opts.requireCalibrationCommit === true,
                // P4: same versioned envelope on the stale-version retry.
                (currentPageDbId ? aiCalMetadataRef.current.get(currentPageDbId) : undefined) ?? undefined,
              );
              if (retryResult.success) {
                updateSessionVersion(prev => (prev != null ? prev + 1 : 1));
                setIsDirty(false);
                // Continue with post-save logic (stamping, cache, etc.)
                if (currentPageDbId) {
                  setComponentMeasurements(prev => prev.map(c => ({
                    ...c,
                    measurements: c.measurements.map(m => ({ ...m, fromPageId: currentPageDbId }))
                  })));
                  pageCalibrationsRef.current.set(currentPageDbId, calibrations.map(c => ({ ...c })));
                }
                return true;
              }
            }
          } catch (retryErr) {
            console.warn('[SaveTakeoff] STALE_VERSION retry failed:', retryErr);
          }
          // If retry didn't succeed, show the error.
          showAlert(
            'Takeoff edited in another tab',
            'Your takeoff was saved from another browser tab. Reload this page to see the latest version, then continue measuring.',
            'error',
          );
        } else {
          showAlert('Failed to save measurements', msg, 'error');
        }
        return false;
      }

      // P1-1a: increment local version to match what the RPC wrote.
      updateSessionVersion(prev => (prev != null ? prev + 1 : 1));
      setIsDirty(false);

      // Parent/child plans (2026-07-05): stamp fresh drawings with the page
      // they were saved under, and persist this page's calibration, so page
      // switches keep shapes and scale on the right plan.
      if (currentPageDbId) {
        setComponentMeasurements(prev => prev.map(c => ({
          ...c,
          measurements: c.measurements.map(m => m.fromPageId ? m : { ...m, fromPageId: currentPageDbId }),
        })));
        setRoofAreas(prev => prev.map(ra => ra.fromPageId ? ra : { ...ra, fromPageId: currentPageDbId }));
        if (calibrations.length > 0) {
          pageCalibrationsRef.current.set(currentPageDbId, calibrations.map(c => ({ ...c })));
        }
      }

      // Version cursor fix (2026-07-05): the main save above bumped the DB
      // version, and every flush below bumps it again. Passing the stale
      // `sessionVersion` made every flush fail STALE_TAKEOFF_VERSION silently
      // (caught + warn-logged), losing other areas' data on Save & Continue.
      let versionCursor = (sessionVersionRef.current ?? 0) + 1;

      // Phase 4: flush any dirty cached areas from areaCanvasStatesRef.
      // Each cached area's measurements are saved with their own quote_roof_area_id.
      // Best-effort: failures are logged but don't fail the overall save.
      // Parent/child plans (2026-07-05): group each cached area's rows by the
      // page they were DRAWN on (fromPageId) and flush per (area, page). The
      // old code stamped everything with the CURRENT page id, silently
      // re-homing other pages' drawings onto whatever plan was open.
      type FlushMeasurement = {
        componentId: string | null; type: any; value: number;
        points?: { x: number; y: number }[]; visible: boolean;
        pitch?: number; name?: string; pageId?: string | null;
        quoteRoofAreaId?: string | null;
        entryInputs?: { height_m?: number | null; depth_m?: number | null } | null;
      };
      for (const [cachedAreaId, cachedState] of areaCanvasStatesRef.current.entries()) {
        if (cachedAreaId === activeAreaId) continue; // already saved above
        const byPage = new Map<string | null, FlushMeasurement[]>();
        const pushTo = (pid: string | null, m: FlushMeasurement) => {
          if (!byPage.has(pid)) byPage.set(pid, []);
          byPage.get(pid)!.push(m);
        };
        cachedState.componentMeasurements.forEach((comp: any) => {
          comp.measurements.forEach((m: any) => {
            const pid = m.fromPageId ?? null;
            pushTo(pid, {
              componentId: comp.componentId, type: m.type, value: m.value,
              points: m.points, visible: m.visible,
              pageId: pid,
              quoteRoofAreaId: m.quoteRoofAreaId ?? cachedAreaId,
              entryInputs: m.entryInputs ?? null,
            });
          });
        });
        cachedState.roofAreas.forEach((area: any) => {
          const pid = area.fromPageId ?? null;
          pushTo(pid, {
            componentId: null, type: 'area' as const, value: area.area,
            pitch: area.pitch, name: area.name, points: area.points,
            visible: area.visible, pageId: pid,
            quoteRoofAreaId: area.quoteRoofAreaId ?? cachedAreaId,
          });
        });
        const flushUnit = cachedState.calibrations?.[0]?.unit || calibrations[0]?.unit || 'feet';
        for (const [pid, group] of byPage.entries()) {
          if (group.length === 0) continue;
          try {
            const flushResult = await takeoffActions.saveTakeoffMeasurements(
              quote.id, group, flushUnit,
              undefined, undefined,
              pid,
              versionCursor, cachedAreaId,
              // Fix (2026-07-05): persist the flushed page's calibration when
              // we have it (cached per page); fall back to null (no change).
              // P0-1 (audit 2026-09-20): for a KNOWN page id use only that
              // page's own stored calibration - never the area cache's array
              // (it may belong to a different page). The cache fallback is
              // kept only for legacy unstamped rows (pid == null).
              (pid
                ? (pageCalibrationsRef.current.get(pid) ?? null)
                : (cachedState.calibrations ?? null)),
            );
            if (flushResult.success) {
              versionCursor += 1; // each successful flush bumps the DB version
            } else {
              console.warn(`[SaveTakeoff] Flush for cached area ${cachedAreaId} page ${pid} rejected:`, (flushResult as { error?: string }).error);
            }
          } catch (err) {
            console.warn(`[SaveTakeoff] Failed to flush cached area ${cachedAreaId} page ${pid}:`, err);
          }
        }
      }
      // Authoritative version sync (2026-07-05): read the REAL version from
      // the DB instead of trusting a local cursor - cursor drift caused the
      // false "Takeoff edited in another tab" (STALE_TAKEOFF_VERSION) errors.
      try {
        const authoritativeVersion = await takeoffActions.getTakeoffSessionVersion(quote.id);
        updateSessionVersion(() => authoritativeVersion ?? versionCursor);
      } catch {
        updateSessionVersion(() => versionCursor);
      }
      // Parent/child plans (2026-07-05): DO NOT clear the cache. It mirrors
      // DB state and drives every non-active area's panel/canvas - clearing
      // it here blanked all other areas after any save (the "Garage and Main
      // Roof went blank" bug).
      
      // P1-3: only navigate to Quote Builder when the user clicked the
      // primary "Save & Continue to Components" CTA. The multi-page upload
      // flow stays inside the workstation and reloads to the new page.
      if (navigateAfter) {
        console.log('[SaveTakeoff] Save complete, navigating to:', `/${workspaceSlug}/quotes/${quote.id}/build?step=roof-areas`);
        if (onFreeFinish) onFreeFinish(buildFinishPayload()); else router.push(`/${workspaceSlug}/quotes/${quote.id}/build?step=roof-areas`);
      } else {
        console.log('[SaveTakeoff] Save complete (no navigation).');
      }
      return true;
    } catch (error) {
      console.error('[SaveTakeoff] Unexpected error:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      showAlert('Failed to save measurements', message, 'error');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // P1-3: "Save & Upload another plan" - open the chooser modal.
  // Pre-selects "existing" + pre-fills area name with the first roof area's
  // label so the user can confirm-and-go without retyping when adding to it.
  const openSaveAndUploadAnotherPlan = () => {
    if (isOverStorage) { setStorageBlocked(true); return; }
    setUploadAnotherTarget('existing');
    setUploadAnotherAreaId(areaList[0]?.id ?? '');
    setUploadAnotherFile(null);
    setUploadAnotherError(null);
    setShowUploadAnotherModal(true);
  };

  // Parent/child plans (2026-07-05): snapshot the CURRENT on-screen area's
  // state into the per-area cache. pageIdFallback stamps un-paged (freshly
  // drawn) rows with the page they were drawn on. Preserves cached pageIds.
  const cacheCurrentAreaState = (areaId: string, pageIdFallback: string | null) => {
    const prevCached = areaCanvasStatesRef.current.get(areaId);
    const mergedPageIds = new Set<string>(prevCached?.pageIds ?? []);
    componentMeasurements.forEach(c => c.measurements.forEach(m => {
      const pid = m.fromPageId ?? pageIdFallback; if (pid) mergedPageIds.add(pid);
    }));
    roofAreas.forEach(ra => { const pid = ra.fromPageId ?? pageIdFallback; if (pid) mergedPageIds.add(pid); });
    areaCanvasStatesRef.current.set(areaId, {
      componentMeasurements: componentMeasurements.map(c => ({
        componentId: c.componentId, expanded: c.expanded,
        measurements: c.measurements.map(m => ({
          id: m.id, type: m.type, value: m.value, points: m.points,
          visible: m.visible, fromPageId: m.fromPageId ?? pageIdFallback,
          quoteRoofAreaId: m.quoteRoofAreaId ?? areaId,
          entryInputs: m.entryInputs ?? null,
        })),
      })),
      roofAreas: roofAreas.map(ra => ({
        id: ra.id, name: ra.name, points: ra.points, area: ra.area,
        pitch: ra.pitch, visible: ra.visible, fromPageId: ra.fromPageId ?? pageIdFallback,
        quoteRoofAreaId: ra.quoteRoofAreaId ?? areaId,
      })),
      calibrations: calibrations.map(cal => ({ ...cal })),
      calibrationPoints: calibrationPoints.map(p => ({ ...p })),
      calibrationConfirmed,
      activeComponentIds: [...activeComponentIds],
      selectedComponentId,
      pageIds: mergedPageIds,
    });
  };

  // P1-3: confirm flow for Save & Upload another plan.
  // Fully client-side: saves measurements, uploads image, switches canvas in-place.
  // No router.push avoids the bug where the original plan + measurements reappeared.
  const handleConfirmSaveAndUploadAnother = async () => {
    setUploadAnotherError(null);
    if (!uploadAnotherFile) { setUploadAnotherError('Please choose a plan image to upload.'); return; }
    if (uploadAnotherTarget === 'existing' && !uploadAnotherAreaId) {
      setUploadAnotherError('Please select an area to add measurements to.'); return;
    }
    // M7 (O16): uploading another plan switches the active page afterwards —
    // resolve a dirty touch draft through the shared guard first.
    if (touchExitGuardRef.current?.isDirty()) {
      touchExitGuardRef.current.request('Upload another plan', () => {
        void handleConfirmSaveAndUploadAnother();
      });
      return;
    }
    // Phase 7: no name validation for 'new' - name collected after drawing
    setIsUploadingPage(true);
    try {
      // 1. Persist current measurements without navigating away.
      if (componentMeasurements.length > 0 || roofAreas.length > 0) {
        const saved = await persistTakeoffData();
        if (!saved) return;
      }
      const companyId = quote.company_id;
      // 2. Storage quota check.
      const hasQuota = await takeoffActions.checkStorageQuota(companyId, uploadAnotherFile.size);
      if (!hasQuota) { setUploadAnotherError('Storage quota exceeded. Please upgrade your plan.'); return; }
      // 3. Mint signed upload URL and upload new plan file.
      const mint = await takeoffActions.mintQuoteDocumentUploadUrl({
        scope: { kind: 'quote', quoteId: quote.id },
        filename: uploadAnotherFile.name,
        contentType: uploadAnotherFile.type || 'application/octet-stream',
        claimedSize: uploadAnotherFile.size,
      });
      if (!mint.ok) { setUploadAnotherError(mint.message || 'Failed to prepare upload.'); return; }
      const storageUpload = await takeoffActions.uploadToStorageFromBlob({
        bucket: mint.bucket,
        storagePath: mint.storagePath,
        token: mint.token,
        file: uploadAnotherFile,
        contentType: uploadAnotherFile.type || undefined,
      });
      if (!storageUpload.ok) { setUploadAnotherError(storageUpload.error || 'Upload failed.'); return; }
      // 4. Register in quote_files so it appears in Files & Documents.
      await takeoffActions.saveFileMetadata({
        companyId, quoteId: quote.id, fileType: 'plan',
        fileName: uploadAnotherFile.name, fileSize: uploadAnotherFile.size,
        mimeType: uploadAnotherFile.type || 'image/png', storagePath: mint.storagePath,
      });
      // 5. Create takeoff page row and resolve target area ID.
      let newPageId: string;
      let newRoofAreaId: string | null = null;
      let newPageName: string;
      let resolvedFirstArea: { id: string; label: string } | null = null;
      if (uploadAnotherTarget === 'new') {
        // Phase 7: create page only (no area row yet - area created after drawing)
        const pageName = `Plan ${pages.length + 1}`;
        const pageResult = await takeoffActions.createTakeoffPage(quote.id, pageName);
        if (!pageResult.ok || !pageResult.pageId) { setUploadAnotherError(pageResult.error || 'Failed to create page.'); return; }
        newPageId = pageResult.pageId; newPageName = pageName;
        newRoofAreaId = null; // will be set after user draws + names the area
      } else {
        // Existing area: create only the page row, link to selected area
        const pageName = `Plan ${pages.length + 1}`;
        const pageResult = await takeoffActions.createTakeoffPage(quote.id, pageName);
        if (!pageResult.ok || !pageResult.pageId) { setUploadAnotherError(pageResult.error || 'Failed to create page.'); return; }
        newPageId = pageResult.pageId; newPageName = pageName;
        // Phase 7: use the selected area from the dropdown
        newRoofAreaId = uploadAnotherAreaId;
        const selectedArea = areaList.find(a => a.id === uploadAnotherAreaId);
        resolvedFirstArea = selectedArea
          ? { id: selectedArea.id, label: selectedArea.label }
          : null;
      }
      // 6. Persist image path on the new page row.
      await takeoffActions.finalizeTakeoffPageImage(newPageId, mint.storagePath);
      // 7+8. Parent/child plans (2026-07-05): switch canvas client-side.
      // createObjectURL is immediate and doesn't require re-signing.
      // P0-2 (audit 2026-09-20): the AI calibration session belongs to the
      // outgoing image - close it and strip overlay markers before the swap.
      abortAiCalibrationSession();
      const objectUrl = URL.createObjectURL(uploadAnotherFile);
      const newPage = { id: newPageId, url: objectUrl, name: newPageName, order: pages.length + 1 };
      const updatedPages = [...pages, newPage];

      // Stash the outgoing page's calibration before leaving it.
      const priorPageId = pages[currentPageIndex]?.id ?? null;
      if (priorPageId && calibrations.length > 0) {
        pageCalibrationsRef.current.set(priorPageId, calibrations.map(c => ({ ...c })));
      }

      // Cross-page leak fix (2026-07-08): stamp any un-paged shapes with the
      // page they were drawn on BEFORE switching - same pattern as
      // handleSwitchPage. reconstructCanvas treats fromPageId=null as
      // "draw on every page", so unstamped plan-1 shapes were reappearing on
      // the freshly uploaded plan's canvas.
      if (priorPageId) {
        setComponentMeasurements(prev => prev.map(c => ({
          ...c,
          measurements: c.measurements.map(m => m.fromPageId ? m : { ...m, fromPageId: priorPageId }),
        })));
        setRoofAreas(prev => prev.map(ra => ra.fromPageId ? ra : { ...ra, fromPageId: priorPageId }));
      }

      setPages(updatedPages);
      setCurrentPageIndex(updatedPages.length - 1);
      setActiveSaveRoofAreaId(newRoofAreaId);

      if (uploadAnotherTarget === 'existing' && newRoofAreaId) {
        // ── Child slot under an existing parent area (Option A) ──
        // No second dialog, no "+ New Area" click: the new plan is attached
        // to the chosen parent immediately. User calibrates and measures;
        // everything rolls up to the parent.
        if (newRoofAreaId !== activeAreaId && activeAreaId) {
          // Parent is not the on-screen area: cache the outgoing area (already
          // persisted to DB by persistTakeoffData above) and restore the
          // parent's cached state so its components stay in the left panel.
          if (componentMeasurements.length > 0 || roofAreas.length > 0) {
            cacheCurrentAreaState(activeAreaId, priorPageId);
          }
          const parentCached = areaCanvasStatesRef.current.get(newRoofAreaId);
          setComponentMeasurements(parentCached?.componentMeasurements ?? []);
          setRoofAreas(parentCached?.roofAreas ?? []);
          setActiveComponentIds(
            parentCached?.activeComponentIds
              ?? (parentCached?.componentMeasurements ?? []).map((c: { componentId: string }) => c.componentId)
          );
          setSelectedComponentId(null);
        }
        // Swap the canvas: keep parent-level measurements, reset tools +
        // calibration for the fresh plan (each plan has its own scale).
        loadPageImage(objectUrl, { preserveMeasurements: true });
        setActiveAreaId(newRoofAreaId);
        activeAreaIdRef.current = newRoofAreaId;
        setIsExistingAreaMode(true);
        isExistingAreaModeRef.current = true;
        setExistingAreaLabel(resolvedFirstArea?.label ?? 'Existing Area');
        // Register the child slot so the numbered chip appears immediately.
        setAreaPages(prev => ({
          ...prev,
          [newRoofAreaId as string]: [...(prev[newRoofAreaId as string] ?? []), newPageId],
        }));
      } else {
        // ── New parent area (Option A) ── cache the outgoing area first so
        // switching back later restores it, then full-reset for the fresh
        // plan. After calibration the new-area drawing flow arms itself.
        if (activeAreaId && (componentMeasurements.length > 0 || roofAreas.length > 0)) {
          cacheCurrentAreaState(activeAreaId, priorPageId);
        }
        loadPageImage(objectUrl);
        setIsExistingAreaMode(false);
        isExistingAreaModeRef.current = false;
        setPendingNewAreaIsExisting(false);
        setPendingNewAreaTargetId(null);
        pendingNewAreaIsExistingRef.current = false;
        pendingNewAreaTargetIdRef.current = null;
        setActiveAreaId(null);
        activeAreaIdRef.current = null;
        armNewAreaAfterCalibrationRef.current = true;
      }
      // Cross-page leak fix (2026-07-08): rebuild the canvas through the
      // page filter so only the new (blank) page's shapes render. Without
      // this the canvas relied on staying blank until the next redraw, and
      // any redraw trigger re-drew other pages' unstamped shapes here.
      setRedrawNonce(n => n + 1);
      // Version fix (2026-07-05): persistTakeoffData already synced the
      // authoritative version from the DB. Nulling it here caused the false
      // "Takeoff edited in another tab" error on the next save.
      // Close modal and reset upload state.
      setShowUploadAnotherModal(false);
      setUploadAnotherFile(null);
      setUploadAnotherAreaId('');
      setUploadAnotherError(null);
      setIsDirty(false);
    } catch (err) {
      console.error('[SaveAndUploadAnother] Failed:', err);
      setUploadAnotherError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsUploadingPage(false);
    }
  };

  // Calculate area using Shoelace formula
  const calculatePolygonArea = (points: { x: number; y: number }[]) => {
    let sum = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      sum += points[i].x * points[j].y;
      sum -= points[j].x * points[i].y;
    }
    const pixelArea = Math.abs(sum / 2);
    
    // RC-4 fix (2026-07-05): read calibrations via REF, not state. This
    // function is called from canvas mouse handlers bound once at mount
    // (stale closures) where the `calibrations` state variable is permanently
    // []. That made every area measure 0.00 while line tools (which already
    // used calibrationsRef) worked fine.
    const currentCalibrations = calibrationsRef.current;
    if (currentCalibrations.length === 0) {
      console.warn('[calculatePolygonArea] No calibrations available - returning 0');
      return 0;
    }

    // Convert to real-world units using calibration scale
    // P3: unit-normalised effective scale (replaces the raw mean).
    const effectiveScale = effectiveScaleFromLegacyCalibrations(currentCalibrations);
    const realArea = pixelArea * effectiveScale * effectiveScale; // scale² for area
    
    // Guard against NaN/Infinity (shouldn't happen with the empty check above, but belt-and-braces)
    if (!isFinite(realArea) || isNaN(realArea)) {
      console.warn('[calculatePolygonArea] Calculated area is NaN/Infinity - returning 0');
      return 0;
    }
    
    return realArea;
  };
  
  // handleSaveArea moved to line ~185 with pitch parameter
  
  // Refs to access current state in event handlers
  const calibrationModeRef = useRef(calibrationMode);
  const calibrationPointsRef = useRef(calibrationPoints);
  const calibrationsRef = useRef(calibrations);
  const areaModeRef = useRef(areaMode);
  const areaPointsRef = useRef(areaPoints);
  const areaSubToolRef = useRef(areaSubTool);
  // Box-drag refs: start point + dragging flag + temp Fabric rect object.
  const boxDragStartRef = useRef<{ x: number; y: number } | null>(null);
  const isBoxDraggingRef = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tempBoxRectRef = useRef<any>(null);
  const lineModeRef = useRef(lineMode);
  const linePointsRef = useRef(linePoints);
  const pointModeRef = useRef(pointMode);
  const multiLinealModeRef = useRef(multiLinealMode);
  const multiLinealPointsRef = useRef(multiLinealPoints);
  const selectedComponentIdRef = useRef(selectedComponentId);
  const componentColorsRef = useRef(componentColors);
  const isExistingAreaModeRef = useRef(isExistingAreaMode);
  // RC-1 fix (2026-07-05): the canvas mouse handlers are bound ONCE (one-shot
  // init effect) and never re-bound, so any state they read must go through
  // refs. These two were read as raw state - permanently false/null inside the
  // handler - which broke every "+ New Area" route.
  const pendingNewAreaIsExistingRef = useRef(pendingNewAreaIsExisting);
  const pendingNewAreaTargetIdRef = useRef(pendingNewAreaTargetId);
  // RC-5 fix (2026-07-05): true only while an area-draw armed via the
  // "+ New Area" flow is in flight. Distinguishes "+ New Area" (roof area
  // allowed, no component needed) from a direct Area-tool click (component
  // required). Set synchronously in the flow handlers, cleared on save/cancel.
  const viaNewAreaFlowRef = useRef(false);
  // Area-ownership fix (2026-07-05): canvas handlers are stale closures, so
  // measurement commit points MUST read the active area via this ref, never
  // from activeAreaId state directly.
  const activeAreaIdRef = useRef<string | null>(null);
  // Stale-closure fix (2026-07-05): the canvas mouse:down handler is bound
  // ONCE on mount and never re-binds. It captured the initial `pages` state
  // where pages[0].id was undefined (fetched async by takeoffActions.initializeTakeoffPage).
  // So fromPageId at draw time was always null. This ref stays in sync so
  // draw-time handlers can read the real current page id.
  const currentPageIdRef = useRef<string | null>(null);

  // ── M5: touch-outline bridge adapter ─────────────────────────────────────
  // The workstation stays the SINGLE data owner (R14): the touch outline
  // editor reads state through this adapter and calls back. No parallel
  // measurement data path exists. The adapter object is stable; every method
  // reads the latest committed state through touchOutlineLiveRef.
  const touchOutlineLiveRef = useRef<{
    pageId: string | null;
    roofAreas: RoofArea[];
    componentMeasurements: ComponentWithMeasurements[];
    calibrations: Calibration[];
    canvasDims: { width: number; height: number };
    pageImageRevision: string | null;
    currentImageUrl: string | null;
    ai: { available: boolean; blocked: boolean; qualityLevel: 'low' | 'medium' | 'high' } | null;
    handleSaveArea: (
      name: string,
      pitch?: number,
      pointsOverride?: { x: number; y: number }[],
      onResult?: (r: TouchCreateResult) => void,
    ) => void;
  } | null>(null);
  // U4 (plan 6.4): partial-success retry - when a touch create made the DB
  // area row but the immediate measurement persist failed, the retry
  // re-persists with the SAME ids instead of creating a duplicate area.
  const touchCreateRetryRef = useRef<((name: string, pitch: number, points: { x: number; y: number }[]) => Promise<TouchCreateResult>) | null>(null);
  const touchCreateFlight = useRef(createSingleFlight<TouchCreateResult>());
  const touchBridgeListeners = useRef(new Set<() => void>());
  // M6 (O11): touch context epoch — bumped on page switch / image-revision
  // change / touch-scan cancellation so stale client/AI work is discarded
  // rather than silently applied. Safe for M5 saves: it only changes in
  // situations that already invalidate the M1 stale-context boundary.
  const touchContextEpochRef = useRef(0);
  const touchEpochKeyRef = useRef<string | null>(null);
  const touchOutlineScanAbortRef = useRef<AbortController | null>(null);
  // M10 P2: AI component scan (touch). The overlay is a dedicated fabric
  // layer grouped by semantic key - desktop componentMeasurements state
  // stays untouched until the P4 save wiring.
  const touchComponentScanAbortRef = useRef<AbortController | null>(null);
  // Per-entry overlay records (P3 review granularity: hide, delete and
  // highlight operate on individual lineal entries; groups derive live).
  const touchComponentEntriesRef = useRef<TouchComponentEntry[]>([]);
  // F4: stable palette colour per custom component (session-scoped).
  const touchComponentColoursRef = useRef<Map<string, string>>(new Map());
  // P4: latest-ref to the persist function (recreated each render) so the
  // stable adapter always calls the fresh closure over component state.
  const touchPersistTakeoffRef = useRef(persistTakeoffData);
  touchPersistTakeoffRef.current = persistTakeoffData;

  // M7 (O16): the touch dirty-draft guard supplied by TakeoffPage. Kept in a
  // ref so the guarded handlers (page switch, area switch, upload-another)
  // always consult the latest guard object without re-creating callbacks.
  const touchExitGuardRef = useRef<
    { isDirty: () => boolean; request: (label: string, proceed: () => void) => void } | null
  >(null);
  touchExitGuardRef.current = touchExitGuard ?? null;

  // U0 N1/N2: page-1 resolution callback supplied by TakeoffPage. Ref pattern
  // matches touchExitGuardRef so the mount effect below never re-runs for it.
  const onPage1ResolvedRef = useRef<((pageId: string) => void) | null>(null);
  onPage1ResolvedRef.current = onPage1Resolved ?? null;

  /** Ported from the free-tool output contract: merges live + cached area
   *  state into the finish payload (dedupes restored measurements, remaps
   *  shared roof-area stamps to unique report ids). */
  const buildFinishPayload = (): TakeoffFinishPayload => {
    const mergedByComponent = new Map<string, typeof componentMeasurements[number]>();
    const pushGroup = (g: typeof componentMeasurements[number]) => {
      const existing = mergedByComponent.get(g.componentId);
      if (existing) {
        for (const m of g.measurements) {
          if (m.id && existing.measurements.some(x => x.id === m.id)) continue;
          existing.measurements.push(m);
        }
      } else {
        mergedByComponent.set(g.componentId, { ...g, measurements: [...g.measurements] });
      }
    };
    componentMeasurements.forEach(pushGroup);
    areaCanvasStatesRef.current.forEach((cached, areaId) => {
      if (areaId === activeAreaId) return;
      cached.componentMeasurements.forEach(pushGroup);
    });

    const mergedRoofAreas: { id: string; name: string; area: number; pitch: number }[] = [];
    const seenAreaIds = new Set<string>();
    const stampToFirstId = new Map<string, string>();
    const pushArea = (ra: { id: string; name: string; area: number; pitch: number; quoteRoofAreaId?: string | null }) => {
      if (seenAreaIds.has(ra.id)) return;
      seenAreaIds.add(ra.id);
      const stamp = ra.quoteRoofAreaId ?? ra.id;
      if (!stampToFirstId.has(stamp)) stampToFirstId.set(stamp, ra.id);
      mergedRoofAreas.push({ id: ra.id, name: ra.name, area: ra.area, pitch: ra.pitch });
    };
    areaCanvasStatesRef.current.forEach((cached, areaId) => {
      if (areaId === activeAreaId) return;
      cached.roofAreas.forEach((ra: any) => pushArea(ra));
    });
    roofAreas.forEach(ra => pushArea(ra));

    return {
      roofAreas: mergedRoofAreas,
      componentGroups: [...mergedByComponent.values()].map(g => {
        const comp = components.find(c => c.id === g.componentId);
        return {
          componentId: g.componentId,
          name: comp?.name ?? g.componentId,
          isSystem: !!comp?.is_system,
          semantic: comp ? resolveSemanticKey(comp.name) : null,
          count: g.measurements.length,
          total: g.measurements.reduce((s, m) => s + m.value, 0),
          measurementType: comp?.measurement_type ?? undefined,
          measurements: g.measurements.map(m => ({ value: m.value, quoteRoofAreaId: m.quoteRoofAreaId ? (stampToFirstId.get(m.quoteRoofAreaId) ?? m.quoteRoofAreaId) : null })),
        };
      }),
      calibrationUnit: calibrations[0]?.unit ?? 'meters',
    };
  };
  const touchOutlineAdapterRef = useRef<TouchOutlineAdapter | null>(null);
  // M7: hydration snapshot for the adapter's scale fallback — a calibration
  // saved by the touch calibration layer updates the SERVER data (and, via
  // router.refresh, this prop) even though the workstation's own `calibrations`
  // state only restores on mount/reload.
  const touchHydrationRef = useRef<typeof hydrationData>(hydrationData);
  touchHydrationRef.current = hydrationData;
  if (touchOutlineAdapterRef.current == null) {
    touchOutlineAdapterRef.current = {
      subscribe: (listener) => { touchBridgeListeners.current.add(listener); return () => { touchBridgeListeners.current.delete(listener); }; },
      applyConfirmedCalibration: (pageId, payload) => {
        if (currentPageIdRef.current !== pageId) return false;
        const refs = payload.legacy.map(ref => ({ ...ref })) as Calibration[];
        pageCalibrationsRef.current.set(pageId, refs);
        aiCalMetadataRef.current.set(pageId, payload.metadata);
        calibrationsRef.current = refs;
        setCalibrations(refs); setCalibrationConfirmed(true); setShowCalibrationHelp(false);
        // Keyboardless fix (2026-09-22): the desktop "Calibration complete"
        // instructions modal auto-opens once calibrationConfirmed flips true
        // (effect above). When calibration came from the TOUCH ACK the user
        // already has the touch rail guidance, and the modal would otherwise
        // cover the portal-mounted Switch-to-touch button on desktop.
        setShowRoofAreaInstructions(false);
        roofAreaInstructionsDismissedRef.current = true;
        setCalibrationPoints([]); setCalibrationMode(false); setShowCalibrationModal(false);
        const revision = payload.metadata.imageRevision || null;
        const key = `${pageId}|${revision ?? 'none'}`;
        if (touchEpochKeyRef.current !== key) { touchEpochKeyRef.current = key; touchContextEpochRef.current += 1; }
        if (touchOutlineLiveRef.current) touchOutlineLiveRef.current = { ...touchOutlineLiveRef.current, pageId, calibrations: refs, pageImageRevision: revision };
        touchBridgeListeners.current.forEach(listener => listener());
        return true;
      },
      buildFinishPayload: () => buildFinishPayload(),
      getAreas: () => {
        const live = touchOutlineLiveRef.current;
        const pageId = currentPageIdRef.current;
        if (!live) return [];
        // Page-scoped: only THIS page's polygons are selectable/editable
        // (multi-page ownership, O09).
        return live.roofAreas
          .filter((ra) => !ra.fromPageId || !pageId || ra.fromPageId === pageId)
          .map((ra) => ({
            geometryId: ra.id,
            name: ra.name,
            pitch: ra.pitch,
            quoteRoofAreaId: ra.quoteRoofAreaId ?? null,
            fromPageId: ra.fromPageId ?? null,
            points: ra.points.map((p) => ({ ...p })),
          }));
      },
      getEditContext: () => {
        const pageId = currentPageIdRef.current;
        if (!pageId) return null;
        return {
          quoteId: quote.id,
          pageId,
          imageRevision: touchOutlineLiveRef.current?.pageImageRevision ?? null,
          coordinateFrame: 'takeoff-scene-v1' as const,
          sessionVersion: sessionVersionRef.current ?? 0,
          contextEpoch: touchContextEpochRef.current,
        };
      },
      getScale: () => {
        const activePage = currentPageIdRef.current;
        const calibrations = activePage ? pageCalibrationsRef.current.get(activePage)
          ?? (touchOutlineLiveRef.current?.pageId === activePage ? touchOutlineLiveRef.current.calibrations : []) : [];
        if (calibrations.length > 0) {
          try {
            return {
              scale: effectiveScaleFromLegacyCalibrations(calibrations),
              unit: calibrations[0]?.unit ?? 'feet',
            };
          } catch {
            return null;
          }
        }
        // M7 fallback: read the page's OWN hydrated calibration so a scale
        // saved in THIS session (touch calibration → router.refresh) is
        // visible to outline saves without a full reload.
        const pageId = currentPageIdRef.current;
        const hp = touchHydrationRef.current?.pages?.find((p) => p.id === pageId) ?? null;
        const legacy = hp?.scaleCalibration;
        if (Array.isArray(legacy) && legacy.length > 0) {
          try {
            return {
              scale: effectiveScaleFromLegacyCalibrations(legacy),
              unit: legacy[0]?.unit ?? 'feet',
            };
          } catch {
            return null;
          }
        }
        return null;
      },
      getScene: () => {
        const dims = touchOutlineLiveRef.current?.canvasDims ?? { width: 2000, height: 1700 };
        return {
          width: dims.width,
          height: dims.height,
          imageRevision: touchOutlineLiveRef.current?.pageImageRevision ?? null,
        };
      },
      // M7: the touch overlay renders its own plan raster at its own camera.
      getImageUrl: () => touchOutlineLiveRef.current?.currentImageUrl ?? null,
      updateOutline: async (intent) => {
        const live = touchOutlineLiveRef.current;
        const pageId = currentPageIdRef.current;
        if (!live || !pageId) return { ok: false, error: 'No page selected.' };
        const target = live.roofAreas.find((ra) => ra.id === intent.geometryId);
        const result = await takeoffActions.updateTakeoffAreaGeometry({
          quoteId: quote.id,
          measurementId: intent.geometryId,
          pageId,
          points: intent.points.map((p) => ({ x: p.x, y: p.y })),
          sessionVersion: sessionVersionRef.current,
        });
        if (!result.success) {
          return { ok: false, error: result.error, staleVersion: result.staleVersion ?? false };
        }
        const serverValue = result.value;
        const serverVersion = result.sessionVersion;
        // Acknowledged save: apply the server-derived values to OUR state so
        // the next full save (delete+insert per page) rewrites exactly what
        // the RPC committed — no silent rollback of the approved checkpoint.
        setRoofAreas((prev) =>
          prev.map((ra) =>
            ra.id === intent.geometryId
              ? { ...ra, points: intent.points.map((p) => ({ ...p })), area: serverValue }
              : ra,
          ),
        );
        // O07 client mirror: source-linked dependent entries follow the new
        // polygon; independent entries untouched (server recomputed the same
        // values — this keeps the local panel consistent until the next save).
        const scale = touchOutlineAdapterRef.current?.getScale();
        if (scale && target) {
          const deps: RecomputeMeasurementRecord[] = [];
          live.componentMeasurements.forEach((comp) => {
            comp.measurements.forEach((m) => {
              if (m.fromPageId && pageId && m.fromPageId !== pageId) return;
              deps.push({
                id: m.id,
                type: m.type as RecomputeMeasurementRecord['type'],
                value: m.value,
                points: m.points ?? null,
                quoteRoofAreaId: m.quoteRoofAreaId ?? null,
                entryInputs: (m.entryInputs as RecomputeMeasurementRecord['entryInputs']) ?? null,
              });
            });
          });
          const rec = outlineDependentRecompute({
            edited: {
              geometryId: intent.geometryId,
              points: intent.points,
              pitch: target.pitch,
              quoteRoofAreaId: target.quoteRoofAreaId ?? null,
            },
            scale,
            dependents: { measurements: deps },
          });
          if (rec.ok) {
            const byId = new Map(rec.measurementUpdates.map((u) => [u.id, u]));
            setComponentMeasurements((prev) =>
              prev.map((comp) => ({
                ...comp,
                measurements: comp.measurements.map((m) => {
                  const u = byId.get(m.id);
                  if (!u) return m;
                  return {
                    ...m,
                    value: u.value,
                    entryInputs: {
                      ...(m.entryInputs ?? {}),
                      value_basis: m.entryInputs?.value_basis ?? 'plan',
                      plan_value: u.planValue ?? m.entryInputs?.plan_value,
                    },
                  };
                }),
              })),
            );
          }
        }
        if (serverVersion != null) {
          updateSessionVersion(() => serverVersion);
        } else {
          updateSessionVersion((prev) => (prev != null ? prev + 1 : 1));
        }
        setRedrawNonce((n) => n + 1); // rebuild canvas polygons from state
        return { ok: true };
      },
      createOutline: (name, pitch, points): Promise<TouchCreateResult> => touchCreateFlight.current.run(async () => {
        const live = touchOutlineLiveRef.current;
        if (!live || !currentPageIdRef.current || live.calibrations.length === 0) {
          return { ok: false, message: 'The calibrated plan is not ready.', retryable: true };
        }
        const retry = touchCreateRetryRef.current;
        // A retry keeps the SAME parent id but uses the user's current edit.
        const result = retry ? await retry(name, pitch, points) : await new Promise<TouchCreateResult>((resolve, reject) => {
          try { live.handleSaveArea(name, pitch, points, resolve); } catch (error) { reject(error); }
        });
        if (result.ok) touchCreateRetryRef.current = null;
        return result;
      }),
      // ── M6: AI outline scan (touch) — scan1 ONLY (O10), same billing as
      // desktop (owner decision 2026-09-21: full scan1 charge, no cheaper
      // outline-only variant). Client orchestration only: the same
      // authorised endpoint, entitlement gating and server-side ledger as
      // the desktop pipeline — this path just STOPS after the outline stage
      // and never converts AI internal lines/classification into data.
      getAiOutlineScanInfo: (): AiOutlineScanInfo | null => {
        const ai = touchOutlineLiveRef.current?.ai ?? null;
        if (!ai || !ai.available) return null; // unentitled: manual journey only (R01/O17)
        return {
          available: true,
          blocked: ai.blocked,
          cost: getAiScanPointCost('low'),
          qualityLevel: 'low',
        };
      },
      startOutlineOnlyScan: async (): Promise<AiOutlineScanResult> => {
        const live = touchOutlineLiveRef.current;
        const pageId = currentPageIdRef.current;
        if (!quote) return { ok: false, error: 'Quote unavailable.' };
        if (!pageId) return { ok: false, error: 'No active page.' };
        if (!fabricRef.current?.backgroundImage) {
          return { ok: false, error: 'No plan image loaded.' };
        }
        const imageUrl = live?.currentImageUrl ?? null;
        if (!imageUrl) return { ok: false, error: 'No plan image URL available.' };
        const qualityLevel = 'low' as const; // Touch outline-only default; desktop choice is unchanged.
        const dims = live?.canvasDims ?? { width: 2000, height: 1700 };

        const abortController = new AbortController();
        touchOutlineScanAbortRef.current = abortController;
        try {
          const imgResponse = await fetch(imageUrl, { signal: abortController.signal });
          if (!imgResponse.ok) {
            return { ok: false, error: 'Failed to load plan image for AI scan.' };
          }
          const imgBlob = await imgResponse.blob();
          const reader = new FileReader();
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const handleAbort = () => reader.abort();
            abortController.signal.addEventListener('abort', handleAbort, { once: true });
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.onabort = () => reject(new DOMException('Scan cancelled.', 'AbortError'));
            reader.readAsDataURL(imgBlob);
          });
          const compressed = await compressImageForAiScan(dataUrl);
          // O10: the touch action requests ONLY the existing authorised scan1
          // (outline) stage — scan2/scan3 never auto-run here.
          const response = await fetch(aiScanEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              stage: 'scan1',
              image: compressed.dataUrl,
              imageMime: compressed.mime,
              quoteId: quote.id,
              pageId,
              canvasDimensions: dims,
              qualityLevel,
            }),
            signal: abortController.signal,
          });
          const result = await response
            .json()
            .catch(() => ({ success: false, error: `Server returned HTTP ${response.status}` }));
          if (!response.ok || !result.success) {
            if (response.status === 402 && result.pointsExhausted) {
              setAiPoints(prev =>
                prev ? { ...prev, remaining: result.pointsRemaining ?? 0, isBlocked: true } : null,
              );
              return { ok: false, error: 'Out of AI points — draw the outline manually.', pointsExhausted: true };
            }
            let errMsg = result.error || `AI scan failed (HTTP ${response.status}).`;
            if (response.status === 413) {
              errMsg = 'Your plan image is too large for AI Assist. Please try a smaller or compressed image, or draw the outline manually.';
            }
            return { ok: false, error: errMsg };
          }
          if (!result.data?.roof_areas?.length) {
            return {
              ok: false,
              error: result.summary?.notes?.[0] || 'No usable roof outline was detected.',
            };
          }
          // Billing identical to desktop: mirror the server-side scan1
          // deduction locally with the SAME canonical cost (O10).
          const cost = getAiScanPointCost(qualityLevel);
          setAiPoints(prev =>
            prev
              ? { ...prev, used: prev.used + cost, remaining: Math.max(prev.remaining - cost, 0) }
              : null,
          );
          return { ok: true, data: result.data };
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') {
            return { ok: false, error: 'cancelled', cancelled: true };
          }
          return { ok: false, error: err instanceof Error ? err.message : 'Network error.' };
        } finally {
          if (touchOutlineScanAbortRef.current === abortController) {
            touchOutlineScanAbortRef.current = null;
          }
        }
      },
      cancelOutlineOnlyScan: () => {
        touchOutlineScanAbortRef.current?.abort();
        touchOutlineScanAbortRef.current = null;
        // The touch editor invalidates its scan token. Cancelling a scan
        // must not invalidate the existing human draft's edit context.
      },
      // ── M10 P2: AI component scan (touch) ───────────────────────────
      // scan2 (line detection) + scan3 (classification) continuations of
      // the ALREADY-PAID scan1 session (the route deducts once on scan1;
      // scans 2+3 are free continuations). The user-corrected SAVED
      // outline feeds scan2, so line detection runs on the human-verified
      // polygon - better input than the desktop raw-outline feed.
      getComponentGroups: (): TouchComponentGroup[] => groupsFromEntries(touchComponentEntriesRef.current),
      getComponentEntries: (): TouchComponentEntry[] => touchComponentEntriesRef.current.map(e => ({ ...e })),
      // F4: resolve ANY library component into an openable/drawable target -
      // system types keep registry name/colour; customs get a stable palette
      // colour. This is what makes the dropdown open every component's page.
      getComponentTarget: (componentId: string): TouchComponentTarget | null => {
        const comp = components.find(c => c.id === componentId);
        if (!comp) return null;
        const semantic = comp.is_system ? resolveSemanticKey(comp.name) : null;
        if (semantic) {
          return { componentId, key: semantic, displayName: AI_COMPONENT_REGISTRY[semantic].displayName, colour: getSemanticColour(semantic), measurementType: comp.measurement_type ?? null, isSystem: !!comp.is_system };
        }
        let colour = touchComponentColoursRef.current.get(componentId);
        if (!colour) {
          colour = COLOR_PALETTE[touchComponentColoursRef.current.size % COLOR_PALETTE.length];
          touchComponentColoursRef.current.set(componentId, colour);
        }
        return { componentId, key: null, displayName: comp.name, colour, measurementType: comp.measurement_type ?? null, isSystem: !!comp.is_system };
      },
      setEntryHidden: (id: string, hidden: boolean) => {
        const e = touchComponentEntriesRef.current.find(entry => entry.id === id);
        if (!e) return;
        // F1: data-only - the touch overlay canvas renders the grey state.
        e.hidden = hidden;
        touchBridgeListeners.current.forEach(listener => listener());
      },
      deleteComponentEntry: (id: string) => {
        const idx = touchComponentEntriesRef.current.findIndex(entry => entry.id === id);
        if (idx < 0) return;
        touchComponentEntriesRef.current.splice(idx, 1);
        touchBridgeListeners.current.forEach(listener => listener());
      },
      // F1/P3b/F4 + M11: add a drawn entry for ANY component target. The
      // point count follows the component's measurement type: two points =
      // lineal length, 3+ points = polygon area, one point = item count.
      // Data-only: the touch overlay canvas renders it.
      addComponentEntry: (target: TouchComponentTarget, pts: { x: number; y: number }[]): TouchComponentEntry | null => {
        const scale = touchOutlineAdapterRef.current?.getScale() ?? null;
        const id = crypto.randomUUID();
        const round2 = (n: number) => Math.round(n * 100) / 100;
        const mode = drawModeForMeasurementType(target.measurementType);
        let kind: TouchComponentEntry['kind'] = 'line';
        let value = 0;
        let points: { x: number; y: number }[];
        if (mode === 'point') {
          if (!pts.length) return null;
          kind = 'point';
          value = 1;
          points = [{ x: pts[0].x, y: pts[0].y }];
        } else if (mode === 'polygon') {
          if (pts.length < 3) return null;
          kind = 'area';
          value = scale ? round2(polygonAreaCanvas(pts) * scale.scale * scale.scale) : 0;
          points = pts.map(p => ({ x: p.x, y: p.y }));
        } else {
          if (pts.length < 2) return null;
          kind = 'line';
          value = scale ? round2(Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) * scale.scale) : 0;
          points = [{ x: pts[0].x, y: pts[0].y }, { x: pts[1].x, y: pts[1].y }];
        }
        const entry: TouchComponentEntry = {
          id,
          key: target.componentId,
          componentId: target.componentId,
          displayName: target.displayName,
          colour: target.colour,
          value,
          kind,
          hidden: false,
          points,
        };
        touchComponentEntriesRef.current.push(entry);
        touchBridgeListeners.current.forEach(listener => listener());
        return { ...entry };
      },
      // M11: attach a real product - re-key every entry of the AI
      // placeholder group to the chosen component (name/colour follow;
      // the persist path then writes the REAL component id, priced in the
      // builder). Desktop parity with handleReplacePlaceholder.
      reassignComponentGroup: (fromComponentId: string, toComponentId: string): void => {
        const target = touchOutlineAdapterRef.current?.getComponentTarget?.(toComponentId);
        if (!target) return;
        let changed = false;
        for (const e of touchComponentEntriesRef.current) {
          if (e.componentId !== fromComponentId) continue;
          e.key = toComponentId;
          e.componentId = toComponentId;
          e.displayName = target.displayName;
          e.colour = target.colour;
          changed = true;
        }
        if (changed) touchBridgeListeners.current.forEach(listener => listener());
      },
      // M11: attach a SAVED roof area to an area component - no redraw on
      // mobile. Mirrors the desktop area-attach persist shape: the entry
      // carries no canvas geometry, entryInputs hold the basis + plan
      // snapshot + source link, and takeoffActions.saveTakeoffMeasurements recomputes the
      // value from the LIVE pitch at save time.
      addRoofAreaEntry: (target: TouchComponentTarget, area: SavedOutlineRecord): TouchComponentEntry | null => {
        const scale = touchOutlineAdapterRef.current?.getScale() ?? null;
        if (!scale || !area.quoteRoofAreaId) return null;
        const round2 = (n: number) => Math.round(n * 100) / 100;
        const plan = polygonAreaCanvas(area.points.map(p => ({ x: p.x, y: p.y }))) * scale.scale * scale.scale;
        const pitched = plan * (area.pitch ? rafterPitchFactor(area.pitch) : 1);
        const entry: TouchComponentEntry = {
          id: crypto.randomUUID(),
          key: target.componentId,
          componentId: target.componentId,
          displayName: target.displayName,
          colour: target.colour,
          value: round2(pitched),
          kind: 'area',
          hidden: false,
          points: area.points.map(p => ({ x: p.x, y: p.y })),
          fromRoofAreaId: area.geometryId ?? undefined,
          quoteRoofAreaId: area.quoteRoofAreaId,
          planValue: round2(plan),
        };
        touchComponentEntriesRef.current.push(entry);
        touchBridgeListeners.current.forEach(listener => listener());
        return { ...entry };
      },
      // Corner counting (2026-09-30): apply detected corner counts to a
      // count-based component. The entry carries every counted vertex so
      // the plan highlights exactly what was counted; provenance rides
      // cornerBasis/cornerCount/sourceGeometryId into persist.
      addCornerCountEntry: (target: TouchComponentTarget, basis: 'all' | 'external' | 'internal'): TouchComponentEntry | null => {
        const areas = (touchOutlineAdapterRef.current?.getAreas() ?? [])
          .filter(a => a.points && a.points.length >= 3);
        if (!areas.length) return null;
        const selection = cornerSelection(cornerTotalsAcross(areas), basis);
        if (!selection.count) return null;
        const singleArea = areas.length === 1 ? areas[0] : null;
        const entry: TouchComponentEntry = {
          id: crypto.randomUUID(),
          key: target.componentId,
          componentId: target.componentId,
          displayName: target.displayName,
          colour: target.colour,
          value: selection.count,
          kind: 'point',
          hidden: false,
          points: selection.points,
          cornerBasis: basis,
          cornerCount: selection.count,
          sourceGeometryId: singleArea?.geometryId ?? null,
          ...(singleArea?.quoteRoofAreaId ? { quoteRoofAreaId: singleArea.quoteRoofAreaId } : {}),
        };
        touchComponentEntriesRef.current.push(entry);
        touchBridgeListeners.current.forEach(listener => listener());
        return { ...entry };
      },
      clearComponentOverlay: () => {
        touchComponentEntriesRef.current = [];
        touchBridgeListeners.current.forEach(listener => listener());
      },
      // P4/F3: persist the reviewed entries through the standard save path.
      // Rows go STRAIGHT into the save payload (extraMeasurements) - the
      // P4 state-timing race sent an empty components list to the RPC.
      // Hidden entries persist with visible=false (excluded from the quote);
      // deletions never reach the DB.
      persistReviewedComponents: async (): Promise<{ ok: true } | { ok: false; error: string }> => {
        try {
          const pageId = currentPageIdRef.current;
          const savedArea = [...(touchOutlineAdapterRef.current?.getAreas() ?? [])]
            .filter(a => a.quoteRoofAreaId)
            .pop();
          const areaId = savedArea?.quoteRoofAreaId ?? null;
          const extraMeasurements: Array<ComponentMeasurement & { componentId: string }> = [];
          for (const e of touchComponentEntriesRef.current) {
            if (!e.componentId) continue; // uncertain detections: review-only
            // M11: rows follow the entry kind. Attached roof-area entries
            // persist exactly like the desktop area-attach flow (no canvas
            // geometry, entryInputs basis + plan snapshot + source link) so
            // the save path recomputes from the LIVE pitch.
            if (e.kind === 'area' && e.fromRoofAreaId) {
              extraMeasurements.push({
                componentId: e.componentId,
                id: e.id,
                type: 'area' as const,
                value: e.value,
                points: [],
                visible: !e.hidden,
                fromPageId: pageId,
                quoteRoofAreaId: e.quoteRoofAreaId ?? areaId,
                entryInputs: {
                  value_basis: 'pitched',
                  plan_value: e.planValue ?? e.value,
                  source_geometry_id: e.fromRoofAreaId,
                },
              });
            } else if (e.kind === 'area') {
              extraMeasurements.push({
                componentId: e.componentId,
                id: e.id,
                type: 'area' as const,
                value: e.value,
                points: e.points.map(p => ({ x: p.x, y: p.y })),
                visible: !e.hidden,
                fromPageId: pageId,
                quoteRoofAreaId: areaId,
              });
            } else if (e.kind === 'point') {
              extraMeasurements.push({
                componentId: e.componentId,
                id: e.id,
                type: 'point' as const,
                value: e.value,
                points: e.points.map(p => ({ x: p.x, y: p.y })),
                visible: !e.hidden,
                fromPageId: pageId,
                quoteRoofAreaId: areaId,
                // Corner-derived entries (2026-09-30) keep their provenance so
                // hydration + the builder can show the corner basis.
                ...(e.cornerBasis ? {
                  entryInputs: {
                    value_basis: cornerValueBasis(e.cornerBasis),
                    corner_count: e.cornerCount ?? e.value,
                    ...(e.sourceGeometryId ? { source_geometry_id: e.sourceGeometryId } : {}),
                  },
                } : {}),
              });
            } else {
              extraMeasurements.push({
                componentId: e.componentId,
                id: e.id,
                type: 'line' as const,
                value: e.value,
                points: e.points.map(p => ({ x: p.x, y: p.y })),
                visible: !e.hidden,
                fromPageId: pageId,
                quoteRoofAreaId: areaId,
              });
            }
          }
          const saved = await touchPersistTakeoffRef.current?.({ extraMeasurements });
          if (saved === false) return { ok: false, error: 'The save did not complete. Check your connection and try again.' };
          touchBridgeListeners.current.forEach(listener => listener());
          return { ok: true };
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : 'The save failed.' };
        }
      },
      cancelComponentScan: () => {
        touchComponentScanAbortRef.current?.abort();
        touchComponentScanAbortRef.current = null;
      },
      startComponentScan: async (onStage?: (stage: TouchComponentScanStage) => void): Promise<TouchComponentScanResult> => {
        const live = touchOutlineLiveRef.current;
        const pageId = currentPageIdRef.current;
        if (!quote) return { ok: false, error: 'Quote unavailable.' };
        if (!pageId) return { ok: false, error: 'No active page.' };
        const canvas = fabricRef.current;
        if (!canvas?.backgroundImage) return { ok: false, error: 'No plan image loaded.' };
        const calibrationsNow = live?.calibrations ?? null;
        if (!calibrationsNow) return { ok: false, error: 'Calibrate the plan before scanning components.' };
        // Corrected outline: the most recent saved outline on the bridge.
        const saved = [...(touchOutlineAdapterRef.current?.getAreas() ?? [])]
          .filter(a => a.points.length >= 3)
          .pop();
        if (!saved) return { ok: false, error: 'Save the roof outline before scanning components.' };
        const outlinePoints = saved.points.map(p => ({ x: p.x, y: p.y }));
        const imageUrl = live?.currentImageUrl ?? null;
        if (!imageUrl) return { ok: false, error: 'No plan image URL available.' };
        const qualityLevel = 'low' as const; // Touch default; desktop choice unchanged.
        const dims = live?.canvasDims ?? { width: 2000, height: 1700 };
        const abortController = new AbortController();
        touchComponentScanAbortRef.current = abortController;
        try {
          const imgResponse = await fetch(imageUrl, { signal: abortController.signal });
          if (!imgResponse.ok) return { ok: false, error: 'Failed to load plan image for AI scan.' };
          const imgBlob = await imgResponse.blob();
          const reader = new FileReader();
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const handleAbort = () => reader.abort();
            abortController.signal.addEventListener('abort', handleAbort, { once: true });
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.onabort = () => reject(new DOMException('Scan cancelled.', 'AbortError'));
            reader.readAsDataURL(imgBlob);
          });
          const compressed = await compressImageForAiScan(dataUrl);
          // scan2: line detection on the corrected outline (canvas space).
          onStage?.('lines');
          const scan2Response = await fetch(aiScanEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              stage: 'scan2',
              image: compressed.dataUrl,
              imageMime: 'image/png',
              canvasDimensions: dims,
              quoteId: quote.id,
              pageId,
              outlinePoints,
              analysisDimensions: dims,
              qualityLevel,
            }),
            signal: abortController.signal,
          });
          const scan2Result = await scan2Response.json().catch(() => ({ success: false, error: `Server returned HTTP ${scan2Response.status}` }));
          if (!scan2Response.ok || !scan2Result.success) {
            return { ok: false, error: scan2Result.error || `Line detection failed (HTTP ${scan2Response.status}).` };
          }
          const detectedLines = scan2Result.data?.lines ?? [];
          // scan3: classification of the detected lines.
          onStage?.('classify');
          const scan3Response = await fetch(aiScanEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              stage: 'scan3',
              image: compressed.dataUrl,
              imageMime: 'image/png',
              canvasDimensions: dims,
              quoteId: quote.id,
              pageId,
              outlinePoints,
              lines: detectedLines,
              analysisDimensions: dims,
              qualityLevel,
            }),
            signal: abortController.signal,
          });
          const scan3Result = await scan3Response.json().catch(() => ({ success: false, error: `Server returned HTTP ${scan3Response.status}` }));
          if (!scan3Response.ok || !scan3Result.success) {
            const violations = Array.isArray(scan3Result.topologyViolations) ? ` ${scan3Result.topologyViolations.join(' ')}` : '';
            return { ok: false, error: `${scan3Result.error || `AI scan failed (HTTP ${scan3Response.status}).`}${violations}` };
          }
          // Shared post-processing (perimeter accounting, snapping,
          // clustering, calibration lengths) then a dedicated overlay
          // layer grouped by semantic key.
          const systemComponentIds = buildSystemComponentIds(components);
          const applied = applyAiResults({
            aiData: scan3Result.data,
            calibrations: calibrationsNow,
            systemComponentIds,
            canvasWidth: dims.width,
            canvasHeight: dims.height,
          });
          // F1: data-only records - the touch overlay canvas renders them.
          // The fabric canvas is invisible in touch presentation and is
          // never drawn to from the touch flow.
          touchComponentEntriesRef.current = applied.measurements.map(m => ({
            id: m.id,
            key: m.componentId ?? 'uncertain',
            componentId: m.componentId ?? null,
            displayName: AI_COMPONENT_REGISTRY[m.semanticKey].displayName,
            colour: getSemanticColour(m.semanticKey),
            value: m.value,
            kind: 'line' as const,
            hidden: false,
            points: m.canvasPoints.map(p => ({ x: p.x, y: p.y })),
          }));
          touchBridgeListeners.current.forEach(listener => listener());
          return { ok: true, data: scan3Result.data };
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') {
            return { ok: false, error: 'cancelled', cancelled: true };
          }
          return { ok: false, error: err instanceof Error ? err.message : 'Network error.' };
        } finally {
          if (touchComponentScanAbortRef.current === abortController) {
            touchComponentScanAbortRef.current = null;
          }
        }
      },
    };
  }
  // Keep the live-state mirror current and re-register the (stable) adapter
  // every render so the presentation always reaches the latest owner state.
  useEffect(() => {
    const pageId = currentPageIdRef.current;
    const hydratedPage = hydrationData?.pages.find((p) => p.id === pageId) ?? null;
    const pageImageRevision = (pageId ? aiCalMetadataRef.current.get(pageId)?.imageRevision : null) || hydratedPage?.imageRevision || null;
    // M6 (O11): bump the touch context epoch when the page identity or the
    // immutable image revision changes — in-flight scan results and open
    // drafts are invalidated instead of silently applied. The first
    // observation seeds the key without bumping.
    const epochKey = `${pageId ?? 'none'}|${pageImageRevision ?? 'none'}`;
    if (touchEpochKeyRef.current == null) {
      touchEpochKeyRef.current = epochKey;
    } else if (touchEpochKeyRef.current !== epochKey) {
      touchEpochKeyRef.current = epochKey;
      touchContextEpochRef.current += 1;
    }
    const priorLive = touchOutlineLiveRef.current;
    const currentImageUrl = pages[currentPageIndex]?.url ?? planUrlRef.current;
    const changed = !priorLive || priorLive.pageId !== pageId || priorLive.roofAreas !== roofAreas ||
      priorLive.componentMeasurements !== componentMeasurements || priorLive.calibrations !== calibrations ||
      priorLive.canvasDims !== canvasDims || priorLive.pageImageRevision !== pageImageRevision || priorLive.currentImageUrl !== currentImageUrl ||
      !!priorLive.ai !== !!aiTakeoffAvailable || !!priorLive.ai?.blocked !== (aiTakeoffAvailable ? !!aiPoints?.isBlocked : false);
    touchOutlineLiveRef.current = {
      pageId,
      roofAreas,
      componentMeasurements,
      calibrations,
      canvasDims,
      pageImageRevision,
      currentImageUrl,
      ai: aiTakeoffAvailable
        ? {
            available: true,
            blocked: aiPoints?.isBlocked ?? false,
            qualityLevel: aiQualityLevel,
          }
        : null,
      handleSaveArea,
    };
    if (onTouchOutlineAdapter) onTouchOutlineAdapter(touchOutlineAdapterRef.current!);
    if (changed) touchBridgeListeners.current.forEach(listener => listener());
  });
  // Captures the component ID at the moment area mode is activated for a component.
  // Unlike selectedComponentIdRef, this is NOT cleared by Fabric canvas deselection
  // events that fire on the same click that closes the polygon.
  const activeAreaComponentIdRef = useRef<string | null>(null);
  
  useEffect(() => {
    calibrationModeRef.current = calibrationMode;
    calibrationPointsRef.current = calibrationPoints;
    calibrationsRef.current = calibrations;
    areaModeRef.current = areaMode;
    areaPointsRef.current = areaPoints;
    areaSubToolRef.current = areaSubTool;
    lineModeRef.current = lineMode;
    linePointsRef.current = linePoints;
    pointModeRef.current = pointMode;
    multiLinealModeRef.current = multiLinealMode;
    multiLinealPointsRef.current = multiLinealPoints;
    selectedComponentIdRef.current = selectedComponentId;
    componentColorsRef.current = componentColors;
    isExistingAreaModeRef.current = isExistingAreaMode;
    pendingNewAreaIsExistingRef.current = pendingNewAreaIsExisting;
    pendingNewAreaTargetIdRef.current = pendingNewAreaTargetId;
    activeAreaIdRef.current = activeAreaId;
    // Stale-closure fix (2026-07-05): keep currentPageIdRef in sync so
    // canvas handlers (bound once) always see the real current page id.
    // Keyboardless fix (2026-09-22): pages/currentPageIndex MUST be deps - in
    // the touch flow none of the other deps change, so after ensurePage1 fills
    // the page id this effect never re-ran and currentPageIdRef stayed null,
    // which rejected applyConfirmedCalibration and stranded the flow.
    currentPageIdRef.current = pages[currentPageIndex]?.id ?? null;
    // Fallback: sync activeAreaComponentIdRef from state after render.
    // applyToolForType sets this synchronously (M-01 Gerald audit 2026-05-29),
    // but this effect serves as a safety net and handles the clear-on-mode-off case.
    if (!areaMode) {
      activeAreaComponentIdRef.current = null;
    } else if (areaMode && selectedComponentId && !activeAreaComponentIdRef.current) {
      // Only set if not already set synchronously (avoid overwriting with stale state).
      activeAreaComponentIdRef.current = selectedComponentId;
    }
  }, [calibrationMode, calibrationPoints, calibrations, areaMode, areaPoints, areaSubTool, lineMode, linePoints, pointMode, multiLinealMode, multiLinealPoints, selectedComponentId, componentColors, isExistingAreaMode, pendingNewAreaIsExisting, pendingNewAreaTargetId, activeAreaId, pages, currentPageIndex]);

  // Stable ref for the signed plan URL. The signed URL is regenerated on
  // every server render (it embeds a fresh JWT), so reading it directly
  // would tie the Fabric init effect to a value that changes on every
  // parent re-render - which is exactly the bug we're fixing here.
  // Reading it through a ref means the closure always sees the latest URL
  // for the initial image load, but the effect's dep array stays stable.
  const planUrlRef = useRef(planUrl);
  useEffect(() => {
    planUrlRef.current = planUrl;
  }, [planUrl]);

  // Initialize Fabric canvas. ONE-SHOT per mount, no deps.
  //
  // Previously this effect was keyed on `[planUrl]`, which meant any parent
  // re-render that regenerated the signed URL on the server (a refresh, a
  // tab focus, a child state cascade) tore down and rebuilt the canvas -
  // wiping every line, area, marker, and calibration the user had drawn.
  // The signed URL changes string-identity on every render even when the
  // underlying storage path is identical, so the effect kept firing.
  //
  // Fix: ref-guard so the canvas is created exactly once per mount, regardless
  // of how many times the parent re-renders. Following the same one-shot
  // hydration pattern used on the customer quote / blank-quote editors.
  const canvasInitedRef = useRef(false);
  // Canvas-rework: reconstruction runs once, after canvas is ready + hydration applied.
  const reconstructAppliedRef = useRef(false);
  useEffect(() => {
    if (canvasInitedRef.current) return;
    if (!canvasRef.current) return;
    canvasInitedRef.current = true;

    // Start with default dimensions - will be resized once the image loads
    // to match the image's natural dimensions (dynamic canvas sizing).
    const canvas = new Canvas(canvasRef.current, {
      width: 800,
      height: 600,
      backgroundColor: '#1e293b', // slate-800
    });

    fabricRef.current = canvas;

    // M7 local-dev fix: React StrictMode (dev only) unmounts/remounts the
    // component once on mount. Without cleanup the remount created a SECOND
    // Canvas on the same DOM element; the orphaned first instance then threw
    // ("Cannot destructure property 'el' of 'this.lower'") inside its image
    // onload, breaking every later fabricRef call — including the touch
    // adapter's handleSaveArea — for the whole local session. Disposing on
    // unmount + a disposed guard restores the one-instance invariant.
    let canvasDisposed = false;

    // Load roof plan image using native Image (handles CORS automatically)
    const imgElement = new Image();
    imgElement.crossOrigin = 'anonymous';
    imgElement.onload = () => {
      if (canvasDisposed) return;
      // Dynamic canvas sizing: the SCENE keeps the processed image dims; the
      // ELEMENT is sized to the viewport instead (viewport pattern 2026-09-26).
      const dims = computeCanvasDimensions(imgElement.naturalWidth, imgElement.naturalHeight);
      sceneDimsRef.current = { width: dims.width, height: dims.height };
      setCanvasDims({ width: dims.width, height: dims.height });

      const fabricImg = new FabricImage(imgElement);
      fabricImg.set({
        scaleX: dims.scale,
        scaleY: dims.scale,
        left: 0,
        top: 0,
        originX: 'left',
        originY: 'top',
        selectable: false,
        evented: false,
      });

      // Image is the canvas background - never selectable, never draggable,
      // never in undo snapshots. Pan/zoom via viewportTransform still works.
      canvas.backgroundImage = fabricImg;
      canvas.renderAll();

      // Auto-fit (viewport pattern): size the element to the visible area,
      // then fit + centre the plan via the viewport transform.
      const viewportWrapper = canvasRef.current?.parentElement;
      if (viewportWrapper) {
        canvas.setDimensions({
          width: Math.max(160, viewportWrapper.clientWidth),
          height: Math.max(160, viewportWrapper.clientHeight),
        });
        const fit = computeFitVpt(dims.width, dims.height, canvas.getWidth(), canvas.getHeight());
        canvas.setViewportTransform(fit.vpt);
        canvas.renderAll();
        setZoom(fit.scale);
        setViewClipped(isSceneClipped(fit.vpt, dims.width, dims.height, canvas.getWidth(), canvas.getHeight()));
        lastAutoFitZoom.current = fit.scale;
      }

      // Canvas-rework: canvas is now ready for reconstruction.
      setCanvasReady(true);
    };
    // Read the latest URL from the ref so we always use the most
    // recent signed URL even though the init effect is dep-less.
    imgElement.src = planUrlRef.current;

    // Pan on drag OR calibration click OR area click OR line click
    canvas.on('mouse:down', (opt) => {
      const evt = opt.e;
      
      // No snapshot here - snapshots are pushed at commit points in React
      // handlers (handleSaveArea, handleConfirmCalibration, etc.) where
      // closures are fresh. The old per-click snapshot caused stale-closure
      // bugs (undo jumped to start) and wrong granularity (per-click, not
      // per-logical-action).
      
      // Line mode: measure distance (2 points)
      if (lineModeRef.current && !evt.altKey) {
        // Fabric 7 split getPointer() into getViewportPoint() (HTML
        // coordinates) and getScenePoint() (canvas coordinates, post
        // viewport transform). The takeoff workstation always wants the
        // canvas-space point so we can compare against stored geometry.
        const pointer = canvas.getScenePoint(opt.e);
        const newPoint = { x: pointer.x, y: pointer.y };
        const currentPoints = linePointsRef.current;
        
        // Get component color
        const componentColor = componentColorsRef.current.find(c => c.componentId === selectedComponentIdRef.current)?.color || '#10b981';
        
        if (currentPoints.length === 0) {
          // First point
          console.log('[Line] First point');
          // Issue B: push snapshot before first point (via ref - see Fix #5a)
          pushHistorySnapshotRef.current();
          setLinePoints([newPoint]);
          
          // Draw marker (component color)
          const marker = new Circle({
            left: newPoint.x,
            top: newPoint.y,
            radius: 3,
            fill: componentColor,
            stroke: '#000',
            strokeWidth: 1,
            originX: 'center',
            originY: 'center',
            selectable: false,
            evented: false,
          });
          (marker as any).isInProgressMarker = true;
          canvas.add(marker);
        } else if (currentPoints.length === 1) {
          // Second point - draw line, calculate length, prompt
          console.log('[Line] Second point');
          const firstPoint = currentPoints[0];
          
          // Draw marker (component color)
          const marker = new Circle({
            left: newPoint.x,
            top: newPoint.y,
            radius: 3,
            fill: componentColor,
            stroke: '#000',
            strokeWidth: 1,
            originX: 'center',
            originY: 'center',
            selectable: false,
            evented: false,
          });
          (marker as any).isInProgressMarker = true;
          canvas.add(marker);
          
          // Draw line (component color)
          const line = new Line([firstPoint.x, firstPoint.y, newPoint.x, newPoint.y], {
            stroke: componentColor,
            strokeWidth: 1.25,
            selectable: false,
            evented: false,
          });
          canvas.add(line);
          
          // Calculate pixel distance
          const pixelDistance = Math.sqrt(
            Math.pow(newPoint.x - firstPoint.x, 2) + 
            Math.pow(newPoint.y - firstPoint.y, 2)
          );
          
          // Convert to real-world using calibration scale (use ref to avoid stale closure)
          // P3: unit-normalised effective scale (replaces the raw mean).
          const currentCalibrations = calibrationsRef.current;
          const effectiveScale = effectiveScaleFromLegacyCalibrations(currentCalibrations);
          const realDistance = pixelDistance * effectiveScale;
          
          console.log('[Line] Calculated:', { pixelDistance, effectiveScale, realDistance, calibrationCount: currentCalibrations.length });
          
          // Show confirmation modal
          setPendingLineMeasurement({ 
            points: [firstPoint, newPoint], 
            length: realDistance 
          });
          setShowLineMeasurementPrompt(true);
          // Issue B: push snapshot before second point (via ref - see Fix #5a)
          pushHistorySnapshotRef.current();
          setLinePoints([firstPoint, newPoint]);
        }
        
        return;
      }
      
      // Multi-lineal mode: click to add points forming an open polyline.
      // Each click adds a segment; double-click or the "Finish" button commits.
      if (multiLinealModeRef.current && !evt.altKey) {
        const pointer = canvas.getScenePoint(opt.e);
        const newPoint = { x: pointer.x, y: pointer.y };
        const currentPoints = multiLinealPointsRef.current;
        const componentColor = componentColorsRef.current.find(c => c.componentId === selectedComponentIdRef.current)?.color || '#10b981';

        // Draw dot marker for this point.
        const isFirst = currentPoints.length === 0;
        const marker = new Circle({
          left: newPoint.x,
          top: newPoint.y,
          radius: 3,
          fill: isFirst ? '#f97316' : componentColor, // orange for first, component color for rest
          stroke: '#000',
          strokeWidth: 1,
          originX: 'center',
          originY: 'center',
          selectable: false,
          evented: false,
        });
        (marker as any).isInProgressMarker = true;
        canvas.add(marker);
        const newObjects: any[] = [marker];

        // Draw segment line from previous point if this isn’t the first.
        if (currentPoints.length > 0) {
          const prev = currentPoints[currentPoints.length - 1];
          const segLine = new Line([prev.x, prev.y, newPoint.x, newPoint.y], {
            stroke: componentColor,
            strokeWidth: 1.25,
            selectable: false,
            evented: false,
          });
          canvas.add(segLine);
          newObjects.push(segLine);
        }

        canvas.renderAll();
        // Issue B: push snapshot before each point (via ref - see Fix #5a)
        pushHistorySnapshotRef.current();
        setMultiLinealPoints([...currentPoints, newPoint]);
        setMultiLinealSegmentObjects(prev => [...prev, ...newObjects]);
        return;
      }

      // Point mode: add single-click marker
      if (pointModeRef.current && !evt.altKey) {
        const pointer = canvas.getScenePoint(opt.e);
        const componentColor = componentColorsRef.current.find(c => c.componentId === selectedComponentIdRef.current)?.color || '#8b5cf6';
        
        // Draw larger triangle marker
        const marker = new Triangle({
          left: pointer.x,
          top: pointer.y,
          width: 12,
          height: 12,
          fill: componentColor,
          stroke: '#000',
          strokeWidth: 1,
          originX: 'center',
          originY: 'center',
          selectable: false,
          evented: false,
        });
        (marker as any).isInProgressMarker = true;
        canvas.add(marker);
        
        // Show confirmation
        setPendingPointLocation({ x: pointer.x, y: pointer.y });
        setShowPointMeasurementPrompt(true);
        
        return;
      }
      
      // Area mode: add polygon points OR start box drag
      if (areaModeRef.current && !evt.altKey) {
        const pointer = canvas.getScenePoint(opt.e);
        const newPoint = { x: pointer.x, y: pointer.y };

        // ── Box (rect) sub-tool: click-drag to define a rectangle ──
        // On mouse:down we capture the start corner and begin dragging.
        // mouse:move draws a live preview; mouse:up finalises into 4 points.
        if (areaSubToolRef.current === 'rect') {
          boxDragStartRef.current = newPoint;
          isBoxDraggingRef.current = true;
          // Create a preview rect (will be updated on mouse:move).
          const componentColor = componentColorsRef.current.find(c => c.componentId === (activeAreaComponentIdRef.current ?? selectedComponentIdRef.current))?.color || '#3b82f6';
          const rect = new Rect({
            left: newPoint.x,
            top: newPoint.y,
            width: 0,
            height: 0,
            fill: `${componentColor}22`,
            stroke: componentColor,
            strokeWidth: 1.5,
            strokeDashArray: [5, 4],
            selectable: false,
            evented: false,
            originX: 'left',
            originY: 'top',
          });
          canvas.add(rect);
          tempBoxRectRef.current = rect;
          return;
        }

        // ── Polygon sub-tool (default): click to add points ──
        const currentPoints = areaPointsRef.current;
        
        // Check if click is near start point (close polygon)
        if (currentPoints.length >= 3) {
          const startPoint = currentPoints[0];
          const distance = Math.sqrt(
            Math.pow(newPoint.x - startPoint.x, 2) + 
            Math.pow(newPoint.y - startPoint.y, 2)
          );
          
          if (distance < 15) {
            // Close polygon
            console.log('[Area] Closing polygon with', currentPoints.length, 'points');
            setPendingAreaPoints(currentPoints);
            // Use refs for current state - canvas handlers are stale closures
            // and won't see state updated after the handler was set up.
            // Read current values via refs - canvas handlers capture stale closures.
            const currentRoofAreas = roofAreasRef.current;
            // IMPORTANT: read from activeAreaComponentIdRef, NOT selectedComponentIdRef.
            // Fabric.js fires canvas deselection events on the same click that closes the
            // polygon, clearing selectedComponentIdRef.current before we read it here.
            // activeAreaComponentIdRef is set when area mode is activated for a component
            // and is only cleared when area mode is explicitly turned off - it is immune
            // to Fabric deselection side-effects.
            const currentSelectedId = activeAreaComponentIdRef.current ?? selectedComponentIdRef.current;
            // Default: clear pendingComponentId. It will only be set in the
            // explicit component-area branch below. This prevents drawn areas
            // from being misrouted to a component that was selected before the
            // user clicked "+ New Area".
            setPendingComponentId(null);
            // ── Routing rewrite (2026-07-05, RC-1/RC-5): all flow flags are read
            // via refs - this handler is a stale one-shot closure. Priority:
            //   1. component selected          → component-area flow (else-branch below)
            //   2. +New Area → add-to-existing → pitch-only modal
            //   3. +New Area → create new      → AreaNameModal (name + pitch)
            //   4. new-page first boundary     → pitch-only modal
            //   5. upload-to-existing plan     → pitch-only modal (target pre-chosen)
            //   6. first area, fresh takeoff   → AreaNameModal
            //   7. otherwise                   → "Select a component first" alert
            //      ("+ New Area" is the ONLY way to add a roof area without a component)
            if (!currentSelectedId && viaNewAreaFlowRef.current && pendingNewAreaIsExistingRef.current && pendingNewAreaTargetIdRef.current) {
              // "+ New Area" → add to existing - pitch-only modal (shows measured area)
              setPitchOnlyInput('');
              setShowPitchOnlyPrompt(true);
            } else if (!currentSelectedId && viaNewAreaFlowRef.current) {
              // "+ New Area" → create new - AreaNameModal (name + pitch + measured area)
              setShowAreaNamePrompt(true);
            } else if (!currentSelectedId && takeoffMode === 'new-page' && currentRoofAreas.length === 0) {
              // Boundary drawing for a new page - show pitch-only prompt.
              setPitchOnlyInput('');
              setShowPitchOnlyPrompt(true);
            } else if (!currentSelectedId && isExistingAreaModeRef.current) {
              // Upload-to-existing plan: the target area was chosen in the upload
              // modal - pitch-only modal adds this measurement to it.
              setPitchOnlyInput('');
              setShowPitchOnlyPrompt(true);
            } else if (!currentSelectedId && currentRoofAreas.length === 0) {
              // First area on a fresh takeoff - AreaNameModal.
              setShowAreaNamePrompt(true);
            } else if (!currentSelectedId) {
              // Area tool used directly with no component - not allowed.
              setPendingAreaPoints([]);
              setAreaPoints([]);
              showAlert(
                'Select a component first',
                'To measure an area for a component, select it from the panel on the left before drawing. To add a new roof area, use the "+ New Area" button.',
                'info'
              );
              return;
            } else {
              // Component area:
              // This is the ONLY branch that should set pendingComponentId.
              setPendingComponentId(currentSelectedId);
              // volume_3d: skip area name modal, go straight to depth prompt.
              const compForArea = components.find(c => c.id === currentSelectedId);
              if ((compForArea?.measurement_type as string) === 'volume_3d') {
                const areaCalibrated = calculatePolygonArea(currentPoints);
                setPendingVolumeCalibratedArea(areaCalibrated);
                setPendingVolumeComponentId(currentSelectedId);
                setPendingVolumePoints([...currentPoints]);
                // Draw a dashed preview polygon so the user sees the shape.
                const compColor = componentColors.find(c => c.componentId === currentSelectedId)?.color || '#3b82f6';
                const previewPoly = new Polygon(currentPoints, {
                  fill: `${compColor}22`,
                  stroke: compColor,
                  strokeWidth: 1.5,
                  strokeDashArray: [5, 4],
                  selectable: false,
                  evented: false,
                });
                fabricRef.current?.add(previewPoly);
                fabricRef.current?.renderAll();
                setPendingVolumePolygon(previewPoly);
                setVolumeDepthInput('');
                setShowVolumeDepthPrompt(true);
              } else {
                setShowAreaNamePrompt(true);
              }
            }
          }
        }
        
        // Issue B: push snapshot before each point so undo steps back click-by-click (via ref - see Fix #5a)
        pushHistorySnapshotRef.current();
        // Add point
        console.log('[Area] Added point', currentPoints.length + 1);
        setAreaPoints([...currentPoints, newPoint]);
        
        // Draw marker (green for first point, blue for rest)
        const isFirstPoint = currentPoints.length === 0;
        const marker = new Circle({
          left: newPoint.x,
          top: newPoint.y,
          radius: 3,
          fill: isFirstPoint ? '#10b981' : '#3b82f6', // green first, blue rest
          stroke: '#000',
          strokeWidth: 1,
          originX: 'center',
          originY: 'center',
          selectable: false,
          evented: false,
        });
        (marker as any).isInProgressMarker = true;
        canvas.add(marker);
        
        return;
      }
      
      // Calibration mode: capture points
      if (calibrationModeRef.current && !evt.altKey) {
        const pointer = canvas.getScenePoint(opt.e);
        const newPoint = { x: pointer.x, y: pointer.y };
        
        if (calibrationPointsRef.current.length === 0) {
          // First point - add visual marker
          console.log('[Calibration] First point:', newPoint);
          const marker = new Circle({
            left: newPoint.x,
            top: newPoint.y,
            radius: 3.75,
            fill: '#facc15',
            stroke: '#000',
            strokeWidth: 1,
            originX: 'center',
            originY: 'center',
            selectable: false,
            evented: false,
          });
          (marker as any).isInProgressMarker = true;
          canvas.add(marker);
          setCalibrationPoints([newPoint]);
        } else if (calibrationPointsRef.current.length === 1) {
          // Second point - add marker, draw line, and show modal
          const point1 = calibrationPointsRef.current[0];
          const point2 = newPoint;
          console.log('[Calibration] Second point:', newPoint);
          
          // Add marker for second point
          const marker2 = new Circle({
            left: newPoint.x,
            top: newPoint.y,
            radius: 3.75,
            fill: '#facc15',
            stroke: '#000',
            strokeWidth: 1,
            originX: 'center',
            originY: 'center',
            selectable: false,
            evented: false,
          });
          canvas.add(marker2);
          
          // Draw calibration line
          const line = new Line([point1.x, point1.y, point2.x, point2.y], {
            stroke: '#facc15', // yellow-400
            strokeWidth: 1.875,
            selectable: false,
            evented: false,
          });
          canvas.add(line);
          setTempCalibrationLine(line);
          
          // Calculate pixel distance
          const dx = point2.x - point1.x;
          const dy = point2.y - point1.y;
          const _pixelDistance = Math.sqrt(dx * dx + dy * dy);
          
          // Store for modal
          setCalibrationPoints([point1, point2]);
          setShowCalibrationModal(true);
        }
        return;
      }
      
      // Pan mode
      if (evt.altKey) {
        canvas.isDragging = true;
        canvas.selection = false;
        const clientX = 'clientX' in evt ? evt.clientX : (evt as TouchEvent).touches?.[0]?.clientX ?? 0;
        const clientY = 'clientY' in evt ? evt.clientY : (evt as TouchEvent).touches?.[0]?.clientY ?? 0;
        canvas.lastPosX = clientX;
        canvas.lastPosY = clientY;
      }
    });

    canvas.on('mouse:move', (opt) => {
      // Box-drag live preview: update rect size as user drags.
      if (isBoxDraggingRef.current && boxDragStartRef.current && tempBoxRectRef.current) {
        const pointer = canvas.getScenePoint(opt.e);
        const start = boxDragStartRef.current;
        const left = Math.min(start.x, pointer.x);
        const top = Math.min(start.y, pointer.y);
        const width = Math.abs(pointer.x - start.x);
        const height = Math.abs(pointer.y - start.y);
        tempBoxRectRef.current.set({ left, top, width, height });
        canvas.requestRenderAll();
        return;
      }

      if (canvas.isDragging) {
        const e = opt.e;
        const vpt = canvas.viewportTransform!;
        const clientX = 'clientX' in e ? e.clientX : (e as TouchEvent).touches?.[0]?.clientX ?? 0;
        const clientY = 'clientY' in e ? e.clientY : (e as TouchEvent).touches?.[0]?.clientY ?? 0;
        vpt[4] += clientX - (canvas.lastPosX ?? 0);
        vpt[5] += clientY - (canvas.lastPosY ?? 0);
        canvas.requestRenderAll();
        canvas.lastPosX = clientX;
        canvas.lastPosY = clientY;
      }
    });

    canvas.on('mouse:up', (opt) => {
      // Box-drag finalise: convert drag rect into 4 polygon points.
      if (isBoxDraggingRef.current && boxDragStartRef.current) {
        isBoxDraggingRef.current = false;
        const start = boxDragStartRef.current;
        boxDragStartRef.current = null;

        const pointer = canvas.getScenePoint(opt.e);
        const x1 = Math.min(start.x, pointer.x);
        const y1 = Math.min(start.y, pointer.y);
        const x2 = Math.max(start.x, pointer.x);
        const y2 = Math.max(start.y, pointer.y);
        const dragWidth = x2 - x1;
        const dragHeight = y2 - y1;

        // Remove the preview rect.
        if (tempBoxRectRef.current) {
          canvas.remove(tempBoxRectRef.current);
          tempBoxRectRef.current = null;
          canvas.renderAll();
        }

        // Ignore tiny drags (accidental clicks) - under 5px in either dimension.
        if (dragWidth < 5 || dragHeight < 5) {
          return;
        }

        // Build 4 corner points (clockwise from top-left).
        const boxPoints = [
          { x: x1, y: y1 }, // top-left
          { x: x2, y: y1 }, // top-right
          { x: x2, y: y2 }, // bottom-right
          { x: x1, y: y2 }, // bottom-left
        ];

        console.log('[Area:Box] Drag complete', { width: dragWidth, height: dragHeight, points: boxPoints });

        // Run the 4 points through the exact same flow as polygon close.
        setPendingAreaPoints(boxPoints);
        const currentRoofAreas = roofAreasRef.current;
        const currentSelectedId = activeAreaComponentIdRef.current ?? selectedComponentIdRef.current;
        setPendingComponentId(currentSelectedId);

        // ── Routing (2026-07-05, RC-1/RC-5): identical chain to polygon close. ──
        if (!currentSelectedId && viaNewAreaFlowRef.current && pendingNewAreaIsExistingRef.current && pendingNewAreaTargetIdRef.current) {
          // "+ New Area" → add to existing - pitch-only modal (shows measured area)
          setPendingComponentId(null);
          setPitchOnlyInput('');
          setShowPitchOnlyPrompt(true);
        } else if (!currentSelectedId && viaNewAreaFlowRef.current) {
          // "+ New Area" → create new - AreaNameModal (name + pitch + measured area)
          setPendingComponentId(null);
          setShowAreaNamePrompt(true);
        } else if (!currentSelectedId && takeoffMode === 'new-page' && currentRoofAreas.length === 0) {
          // Boundary drawing for a new page - pitch-only prompt.
          setPendingComponentId(null);
          setPitchOnlyInput('');
          setShowPitchOnlyPrompt(true);
        } else if (!currentSelectedId && isExistingAreaModeRef.current) {
          // Upload-to-existing plan: target pre-chosen - pitch-only modal.
          setPendingComponentId(null);
          setPitchOnlyInput('');
          setShowPitchOnlyPrompt(true);
        } else if (!currentSelectedId && currentRoofAreas.length === 0) {
          // First area on a fresh takeoff - AreaNameModal.
          setPendingComponentId(null);
          setShowAreaNamePrompt(true);
        } else if (!currentSelectedId) {
          // Area tool used directly with no component - not allowed.
          setPendingAreaPoints([]);
          setPendingComponentId(null);
          showAlert(
            'Select a component first',
            'To measure an area for a component, select it from the panel on the left before drawing. To add a new roof area, use the "+ New Area" button.',
            'info'
          );
          return;
        } else {
          // volume_3d: skip area name modal, go straight to depth prompt.
          const compForArea = components.find(c => c.id === currentSelectedId);
          if ((compForArea?.measurement_type as string) === 'volume_3d') {
            const areaCalibrated = calculatePolygonArea(boxPoints);
            setPendingVolumeCalibratedArea(areaCalibrated);
            setPendingVolumeComponentId(currentSelectedId);
            setPendingVolumePoints([...boxPoints]);
            const compColor = componentColorsRef.current.find(c => c.componentId === currentSelectedId)?.color || '#3b82f6';
            const previewPoly = new Polygon(boxPoints, {
              fill: `${compColor}22`,
              stroke: compColor,
              strokeWidth: 1.5,
              strokeDashArray: [5, 4],
              selectable: false,
              evented: false,
            });
            canvas.add(previewPoly);
            canvas.renderAll();
            setPendingVolumePolygon(previewPoly);
            setVolumeDepthInput('');
            setShowVolumeDepthPrompt(true);
          } else {
            setShowAreaNamePrompt(true);
          }
        }
        return;
      }

      canvas.setViewportTransform(canvas.viewportTransform!);
      canvas.isDragging = false;
      canvas.selection = true;
    });

    // ── Viewport pan/zoom input (2026-09-26, owner: "can't move around when
    // zoomed"). Input paths, all vpt-based (the element never scrolls):
    //   1. middle-mouse drag - grab and pan
    //   2. hold Space + left-drag - same, for trackpads / mice without a
    //      middle button
    //   3. hold Alt + left-drag - same (owner 2026-09-26; Alt+Space works too)
    //   4. wheel: ctrl (trackpad pinch) or discrete mouse notches zoom at the
    //      cursor; small continuous pixel deltas (trackpad two-finger) pan.
    // Alt + left-drag is intercepted here, BEFORE Fabric, so drawing tools
    // never see it (the Fabric alt-pan above stays as an unreachable
    // fallback).
    const panCleanups: Array<() => void> = [];
    const panWrapper = canvasRef.current?.parentElement;
    if (panWrapper) {
      let spaceHeld = false;
      let altHeld = false;
      let panning = false;
      let lastX = 0;
      let lastY = 0;

      const isEditableTarget = (t: EventTarget | null) => {
        const el = t as HTMLElement | null;
        if (!el || typeof el.tagName !== 'string') return false;
        const tag = el.tagName.toLowerCase();
        return tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'button' || el.isContentEditable;
      };
      const updatePanCursor = () => {
        panWrapper.style.cursor = panning ? 'grabbing' : (spaceHeld || altHeld ? 'grab' : '');
      };
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.code === 'Space' && !e.repeat && !isEditableTarget(e.target)) {
          // Stop the page itself scrolling while the user holds Space to pan.
          e.preventDefault();
          spaceHeld = true;
          updatePanCursor();
        } else if (e.key === 'Alt' && !isEditableTarget(e.target)) {
          // Alt + left-drag pans too (owner 2026-09-26); show the hand while
          // Alt is held so the modifier is discoverable.
          altHeld = true;
          updatePanCursor();
        }
      };
      const onKeyUp = (e: KeyboardEvent) => {
        if (e.code === 'Space') {
          spaceHeld = false;
          updatePanCursor();
        } else if (e.key === 'Alt') {
          altHeld = false;
          updatePanCursor();
        }
      };
      // Alt+Tab and window switches never deliver keyup - never stick in
      // grab mode.
      const onBlur = () => {
        spaceHeld = false;
        altHeld = false;
        updatePanCursor();
      };
      const onPointerDown = (e: PointerEvent) => {
        const wantsPan = e.button === 1 || (e.button === 0 && (spaceHeld || e.altKey));
        if (!wantsPan) return;
        // preventDefault on pointerdown also suppresses the compatibility
        // mousedown, so Fabric never sees it: no stray lines/points while
        // panning, and no middle-click autoscroll either.
        e.preventDefault();
        e.stopPropagation();
        panning = true;
        lastX = e.clientX;
        lastY = e.clientY;
        panWrapper.setPointerCapture(e.pointerId);
        panWrapper.style.cursor = 'grabbing';
      };
      const onPointerMove = (e: PointerEvent) => {
        if (!panning) return;
        const vpt = (canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0]) as Vpt;
        const next = panVpt(vpt, e.clientX - lastX, e.clientY - lastY, sceneDimsRef.current.width, sceneDimsRef.current.height, canvas.getWidth(), canvas.getHeight());
        canvas.setViewportTransform(next);
        canvas.requestRenderAll();
        lastX = e.clientX;
        lastY = e.clientY;
        lastAutoFitZoom.current = null; // user owns the view now
        setHasPanned(true);
      };
      const onPointerUp = (e: PointerEvent) => {
        if (!panning) return;
        panning = false;
        updatePanCursor();
        try { panWrapper.releasePointerCapture(e.pointerId); } catch { /* already released */ }
      };
      const onWheel = (e: WheelEvent) => {
        // The page never scrolls while the cursor is over the canvas.
        e.preventDefault();
        const vw = canvas.getWidth();
        const vh = canvas.getHeight();
        const { width: sw, height: sh } = sceneDimsRef.current;
        const vpt = (canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0]) as Vpt;
        const discrete = e.deltaMode === 1 || Math.abs(e.deltaY) >= 40;
        if (e.ctrlKey || discrete) {
          // Zoom at the cursor (ctrl = trackpad pinch gesture).
          const rect = (canvasRef.current as HTMLCanvasElement).getBoundingClientRect();
          const factor = e.ctrlKey
            ? (e.deltaY < 0 ? 1.06 : 1 / 1.06)
            : (e.deltaY < 0 ? 1.15 : 1 / 1.15);
          const zoomed = zoomVptAtPoint(vpt, factor, e.clientX - rect.left, e.clientY - rect.top);
          const clamped = clampVpt(zoomed, sw, sh, vw, vh);
          canvas.setViewportTransform(clamped);
          canvas.requestRenderAll();
          setZoom(clamped[0]);
          setViewClipped(isSceneClipped(clamped, sw, sh, vw, vh));
          lastAutoFitZoom.current = null;
        } else {
          // Trackpad two-finger scroll pans the view.
          const next = panVpt(vpt, -e.deltaX, -e.deltaY, sw, sh, vw, vh);
          canvas.setViewportTransform(next);
          canvas.requestRenderAll();
          lastAutoFitZoom.current = null;
          setHasPanned(true);
        }
      };

      panWrapper.addEventListener('pointerdown', onPointerDown, true);
      panWrapper.addEventListener('pointermove', onPointerMove);
      panWrapper.addEventListener('pointerup', onPointerUp);
      panWrapper.addEventListener('pointercancel', onPointerUp);
      panWrapper.addEventListener('wheel', onWheel, { passive: false });
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      window.addEventListener('blur', onBlur);
      panCleanups.push(() => {
        panWrapper.removeEventListener('pointerdown', onPointerDown, true);
        panWrapper.removeEventListener('pointermove', onPointerMove);
        panWrapper.removeEventListener('pointerup', onPointerUp);
        panWrapper.removeEventListener('pointercancel', onPointerUp);
        panWrapper.removeEventListener('wheel', onWheel);
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        window.removeEventListener('blur', onBlur);
      });
    }

    return () => {
      panCleanups.forEach((fn) => fn());
      canvas.dispose();
      // Reset the init guard on unmount so re-mounting the component
      // (e.g. a Next route remount) gets a fresh canvas. We don't reset on
      // re-renders - those are exactly what we're guarding against.
      canvasInitedRef.current = false;
      // M7 local-dev fix (StrictMode): dispose the Fabric instance so a dev
      // remount never stacks a second Canvas on the same DOM element.
      canvasDisposed = true;
      if (fabricRef.current === canvas) fabricRef.current = null;
      try { void canvas.dispose(); } catch { /* already gone */ }
      // Clean up AI scan on unmount
      if (aiAbortRef.current) aiAbortRef.current.abort();
    };
     
  }, []); // intentionally empty: see comment above the effect

  // Update cursor when calibration/area/line/point/multiLineal mode changes
  useEffect(() => {
    if (fabricRef.current) {
      const cursor = (calibrationMode || areaMode || lineMode || pointMode || multiLinealMode) ? 'crosshair' : 'default';
      fabricRef.current.defaultCursor = cursor;
      fabricRef.current.hoverCursor = cursor;
    }
  }, [calibrationMode, areaMode, lineMode, pointMode, multiLinealMode]);

  // Double-click on canvas commits the multi-lineal polyline (mirrors closing the area tool).
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const handleDblClick = () => {
      if (!multiLinealModeRef.current) return;
      if (multiLinealPointsRef.current.length < 2) return; // need at least 2 points
      handleFinishMultiLineal();
    };
    canvas.on('mouse:dblclick', handleDblClick);
    // M10 P5: AI outline vertex correction - dragging an AI area vertex
    // rebuilds its polygon and updates state, so the staged component scan
    // runs on the corrected points.
    const handleVertexModified = (opt: { target?: unknown }) => {
      const target = opt.target as unknown as { measurementId?: string; vertexIndex?: number } | null;
      if (!target || target.vertexIndex == null || !target.measurementId) return;
      const areaId = target.measurementId;
      const siblingMarkers = canvas.getObjects().filter(o => {
        const tagged = o as unknown as { measurementId?: string; vertexIndex?: number };
        return tagged.measurementId === areaId && tagged.vertexIndex != null;
      }) as unknown as Array<{ left?: number; top?: number; vertexIndex: number }>;
      const points = [...siblingMarkers]
        .sort((a, b) => a.vertexIndex - b.vertexIndex)
        .map(m => ({ x: m.left ?? 0, y: m.top ?? 0 }));
      if (points.length < 3) return;
      const old = canvas.getObjects().find(o => {
        const tagged = o as unknown as { measurementId?: string; type?: string };
        return tagged.measurementId === areaId && tagged.type === 'polygon';
      });
      if (old) canvas.remove(old);
      const polygon = new Polygon(points, {
        fill: 'rgba(59, 130, 246, 0.2)',
        stroke: '#3b82f6',
        strokeWidth: 1.25,
        selectable: false,
        evented: false,
      });
      (polygon as unknown as { measurementId: string }).measurementId = areaId;
      canvas.add(polygon);
      canvas.sendObjectToBack(polygon);
      canvas.renderAll();
      setRoofAreas(prev => prev.map(ra => ra.id === areaId || ra.quoteRoofAreaId === areaId
        ? { ...ra, points, polygon, area: calculatePolygonArea(points) }
        : ra));
      setAreaList(prev => prev.map(a => a.id === areaId ? { ...a, area: calculatePolygonArea(points) } : a));
      setIsDirty(true);
      recordOutlineHistory(areaId, points);
    };
    canvas.on('object:modified', handleVertexModified as never);
    // Owner 2026-09-25 (12:30 pass), mobile parity: the outline follows the
    // dragged vertex LIVE (polygon rebuilt + orange highlights stretch) so
    // the shape visibly drags instead of snapping only on mouse release.
    const handleVertexMoving = (opt: { target?: unknown }) => {
      const target = opt.target as { measurementId?: string; vertexIndex?: number } | null;
      if (!target || target.vertexIndex == null || !target.measurementId) return;
      const areaId = target.measurementId;
      const tagged = canvas.getObjects() as unknown as Array<{ measurementId?: string; vertexIndex?: number; left?: number; top?: number; type?: string }>;
      const siblings = [...tagged.filter(o => o.measurementId === areaId && o.vertexIndex != null)]
        .sort((a, b) => (a.vertexIndex ?? 0) - (b.vertexIndex ?? 0))
        .map(o => ({ x: o.left ?? 0, y: o.top ?? 0 }));
      if (siblings.length < 3) return;
      const oldPoly = tagged.find(o => o.measurementId === areaId && o.type === 'polygon');
      if (oldPoly) canvas.remove(oldPoly as never);
      const polygon = new Polygon(siblings, {
        fill: 'rgba(59, 130, 246, 0.2)',
        stroke: '#3b82f6',
        strokeWidth: 1.25,
        selectable: false,
        evented: false,
      });
      (polygon as unknown as { measurementId: string }).measurementId = areaId;
      canvas.add(polygon);
      canvas.sendObjectToBack(polygon);
      // Stretch the selected vertex's orange edge highlights live.
      const sel = outlineSelectedRef.current;
      if (sel && sel.areaId === areaId && outlineHighlightRef.current.length >= 4) {
        const i = Math.min(sel.vertexIndex, siblings.length - 1);
        const cur = siblings[i];
        const prevP = siblings[(i - 1 + siblings.length) % siblings.length];
        const nextP = siblings[(i + 1) % siblings.length];
        const [hlA, hlB, rlH, rlV] = outlineHighlightRef.current;
        hlA.set({ x1: prevP.x, y1: prevP.y, x2: cur.x, y2: cur.y });
        hlA.setCoords();
        hlB.set({ x1: cur.x, y1: cur.y, x2: nextP.x, y2: nextP.y });
        hlB.setCoords();
        // Crosshair reticle follows the selected vertex live while dragging.
        const rr = 14;
        rlH.set({ x1: cur.x - rr, y1: cur.y, x2: cur.x + rr, y2: cur.y });
        rlH.setCoords();
        rlV.set({ x1: cur.x, y1: cur.y - rr, x2: cur.x, y2: cur.y + rr });
        rlV.setCoords();
      }
      canvas.requestRenderAll();
    };
    canvas.on('object:moving', handleVertexMoving as never);
    return () => { canvas.off('mouse:dblclick', handleDblClick); canvas.off('object:modified', handleVertexModified as never); canvas.off('object:moving', handleVertexMoving as never); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [multiLinealMode]);

  // ── Owner 2026-09-25: desktop AI-outline review tools ──────────────────
  // Rebuild a staged AI area's polygon + vertex markers from an explicit
  // points array (used by add/remove point; drag keeps the object:modified
  // path above). Mirrors the same tagging contract: measurementId = area id,
  // vertexIndex = sequential position.
  const applyStagedAreaPoints = useCallback((areaId: string, pts: Array<{ x: number; y: number }>) => {
    const canvas = fabricRef.current;
    if (!canvas || pts.length < 3) return;
    canvas.getObjects()
      .filter(o => {
        const t = o as unknown as { measurementId?: string; vertexIndex?: number; type?: string };
        return t.measurementId === areaId && (t.vertexIndex != null || t.type === 'polygon');
      })
      .forEach(o => canvas.remove(o));
    const polygon = new Polygon(pts.map(p => ({ x: p.x, y: p.y })), {
      fill: 'rgba(59, 130, 246, 0.2)',
      stroke: '#3b82f6',
      strokeWidth: 2,
      selectable: false,
      objectCaching: false,
    });
    (polygon as unknown as { measurementId: string }).measurementId = areaId;
    canvas.add(polygon);
    canvas.sendObjectToBack(polygon);
    const markers = pts.map((p, i) => {
      const marker = new Circle({
        left: p.x, top: p.y, radius: 4,
        fill: '#3b82f6', stroke: '#000', strokeWidth: 1,
        originX: 'center', originY: 'center',
        selectable: true, evented: true, hasControls: false, hasBorders: false,
        hoverCursor: 'pointer', moveCursor: 'grabbing',
      });
      (marker as unknown as { measurementId: string }).measurementId = areaId;
      (marker as unknown as { measurementId: string; vertexIndex: number }).vertexIndex = i;
      canvas.add(marker);
      return marker;
    });
    canvas.renderAll();
    setRoofAreas(prev => prev.map(ra => ra.id === areaId || ra.quoteRoofAreaId === areaId
      ? { ...ra, points: pts, polygon, markers, area: calculatePolygonArea(pts) }
      : ra));
    setAreaList(prev => prev.map(a => a.id === areaId ? { ...a, area: calculatePolygonArea(pts) } : a));
    setIsDirty(true);
  }, []);

  // ── Owner 2026-09-25: outline vertex selection (mobile parity) ──────────
  // The selected vertex renders larger/orange and its two adjacent edges are
  // highlighted; the prev/next stepper in the review card walks the ring
  // clockwise / anti-clockwise. (outlineHighlightRef / outlineSelectedRef are
  // declared with the outline state up top so the once-bound canvas
  // handlers can read them without rebinding.)
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.getObjects().forEach(o => {
      const t = o as unknown as { measurementId?: string; vertexIndex?: number };
      if (t.measurementId == null || t.vertexIndex == null) return;
      const isSel = outlineSelectedVertex != null
        && t.measurementId === outlineSelectedVertex.areaId
        && t.vertexIndex === outlineSelectedVertex.vertexIndex;
      o.set(isSel
        ? { radius: 8, fill: 'rgba(255,107,53,0.12)', strokeWidth: 2, stroke: '#FF6B35' }
        : { radius: 4, fill: '#3b82f6', strokeWidth: 1, stroke: '#000' });
    });
    outlineHighlightRef.current.forEach(l => canvas.remove(l));
    outlineHighlightRef.current = [];
    if (outlineSelectedVertex) {
      const ra = roofAreas.find(r => r.id === outlineSelectedVertex.areaId || r.quoteRoofAreaId === outlineSelectedVertex.areaId);
      const pts = ra?.points;
      if (pts && pts.length >= 3) {
        const i = Math.min(outlineSelectedVertex.vertexIndex, pts.length - 1);
        const cur = pts[i];
        const prevP = pts[(i - 1 + pts.length) % pts.length];
        const nextP = pts[(i + 1) % pts.length];
        for (const other of [prevP, nextP]) {
          const hl = new Line([other.x, other.y, cur.x, cur.y], {
            stroke: '#FF6B35', strokeWidth: 3, selectable: false, evented: false, objectCaching: false,
          });
          outlineHighlightRef.current.push(hl);
          canvas.add(hl);
        }
        // Crosshair reticle (owner 13:20): see-through hollow centre with
        // ticks extending past the ring, so the plan intersection stays
        // visible for precise placement.
        const rr = 14;
        for (const coords of [[cur.x - rr, cur.y, cur.x + rr, cur.y], [cur.x, cur.y - rr, cur.x, cur.y + rr]] as const) {
          const rl = new Line([...coords], {
            stroke: '#FF6B35', strokeWidth: 1.5, selectable: false, evented: false, objectCaching: false,
          });
          outlineHighlightRef.current.push(rl);
          canvas.add(rl);
        }
      }
    }
    canvas.requestRenderAll();
  }, [outlineSelectedVertex, roofAreas]);

  // Auto-select the first staged vertex once the outline is on the canvas so
  // the stepper always has a live selection to walk.
  useEffect(() => {
    if (aiStagedPageId == null || outlineSelectedVertex) return;
    const ra = roofAreas.find(r => r.fromPageId === aiStagedPageId && r.quoteRoofAreaId && r.points.length >= 3);
    if (ra) setOutlineSelectedVertex({ areaId: ra.quoteRoofAreaId ?? ra.id, vertexIndex: 0 });
  }, [aiStagedPageId, roofAreas, outlineSelectedVertex]);

  const stepOutlineSelection = useCallback((dir: 1 | -1) => {
    setOutlineSelectedVertex(sel => {
      if (!sel) return sel;
      const ra = roofAreas.find(r => r.id === sel.areaId || r.quoteRoofAreaId === sel.areaId);
      const n = ra?.points.length ?? 0;
      if (n < 3) return sel;
      return { areaId: sel.areaId, vertexIndex: (sel.vertexIndex + dir + n) % n };
    });
  }, [roofAreas]);

  const recordOutlineHistory = useCallback((areaId: string, pts: Array<{ x: number; y: number }>) => {
    setOutlineHistory(h => {
      if (!h || h.areaId !== areaId) return h;
      const stack = h.index < h.stack.length - 1 ? [...h.stack.slice(0, h.index + 1), pts] : [...h.stack, pts];
      return { areaId, stack, index: stack.length - 1 };
    });
  }, []);

  // Remove the SELECTED vertex (minimum 3 kept) - mobile-parity behaviour.
  const handleRemoveSelectedOutlineVertex = useCallback(() => {
    const sel = outlineSelectedVertex;
    if (!sel) return;
    const ra = roofAreas.find(r => r.id === sel.areaId || r.quoteRoofAreaId === sel.areaId);
    if (!ra || ra.points.length <= 3) return;
    const pts = ra.points
      .filter((_, i) => i !== sel.vertexIndex)
      .map(p => ({ x: p.x, y: p.y }));
    applyStagedAreaPoints(ra.quoteRoofAreaId ?? ra.id, pts);
    recordOutlineHistory(ra.quoteRoofAreaId ?? ra.id, pts);
    setOutlineSelectedVertex({ areaId: sel.areaId, vertexIndex: Math.min(sel.vertexIndex, pts.length - 1) });
  }, [outlineSelectedVertex, roofAreas, applyStagedAreaPoints, recordOutlineHistory]);

  // ── Owner 2026-09-25 (12:30 pass): outline-edit history (undo/redo) ─────
  // Baseline snapshot is captured as soon as the staged outline lands on
  // the canvas; every add/remove/drag pushes onto the stack. Undo/redo
  // lives in the review card only - the MAIN canvas undo/redo is disabled
  // while the outline review is open (it would restore a pre-AI snapshot
  // and wipe the outline while the area row stays live).
  useEffect(() => {
    if (aiStagedPageId == null) return;
    const ra = roofAreas.find(r => r.fromPageId === aiStagedPageId && r.quoteRoofAreaId && r.points.length >= 3);
    if (!ra) return;
    const areaId = ra.quoteRoofAreaId ?? ra.id;
    setOutlineHistory(h => (h && h.areaId === areaId)
      ? h
      : { areaId, stack: [ra.points.map(p => ({ x: p.x, y: p.y }))], index: 0 });
  }, [aiStagedPageId, roofAreas]);

  const handleOutlineUndo = useCallback(() => {
    if (!outlineHistory || outlineHistory.index <= 0) return;
    const targetIndex = outlineHistory.index - 1;
    const pts = outlineHistory.stack[targetIndex];
    applyStagedAreaPoints(outlineHistory.areaId, pts);
    setOutlineHistory({ ...outlineHistory, index: targetIndex });
    setOutlineSelectedVertex(sel => sel && sel.areaId === outlineHistory.areaId
      ? { ...sel, vertexIndex: Math.min(sel.vertexIndex, pts.length - 1) }
      : sel);
  }, [outlineHistory, applyStagedAreaPoints]);

  const handleOutlineRedo = useCallback(() => {
    if (!outlineHistory || outlineHistory.index >= outlineHistory.stack.length - 1) return;
    const targetIndex = outlineHistory.index + 1;
    const pts = outlineHistory.stack[targetIndex];
    applyStagedAreaPoints(outlineHistory.areaId, pts);
    setOutlineHistory({ ...outlineHistory, index: targetIndex });
    setOutlineSelectedVertex(sel => sel && sel.areaId === outlineHistory.areaId
      ? { ...sel, vertexIndex: Math.min(sel.vertexIndex, pts.length - 1) }
      : sel);
  }, [outlineHistory, applyStagedAreaPoints]);

  // One-shot click handling for the add/remove point tools. Bound once; the
  // armed tool is read through outlineToolRef so no rebinding is needed.
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const handleToolDown = (opt: { e: MouseEvent; target?: unknown }) => {
      const tool = outlineToolRef.current;
      if (!tool) {
        // Owner 2026-09-25, mobile parity: clicking a blue vertex selects it.
        // The selection drives the enlarged orange vertex, the adjacent-edge
        // highlight and the prev/next stepper in the review card.
        const t = opt.target as { measurementId?: string; vertexIndex?: number } | undefined;
        if (t && t.vertexIndex != null && t.measurementId) {
          setOutlineSelectedVertex({ areaId: t.measurementId, vertexIndex: t.vertexIndex });
        }
        return;
      }
      if (tool === 'remove') {
        const target = opt.target as { measurementId?: string; vertexIndex?: number } | undefined;
        if (!target || target.vertexIndex == null || !target.measurementId) return;
        const siblings = canvas.getObjects()
          .filter(o => {
            const t = o as unknown as { measurementId?: string; vertexIndex?: number };
            return t.measurementId === target.measurementId && t.vertexIndex != null;
          }) as unknown as Array<{ left: number; top: number; vertexIndex: number }>;
        if (siblings.length <= 3) return; // never below a triangle
        const pts = [...siblings]
          .sort((a, b) => a.vertexIndex - b.vertexIndex)
          .filter((_, i) => i !== target.vertexIndex)
          .map(m => ({ x: m.left, y: m.top }));
        applyStagedAreaPoints(target.measurementId as string, pts);
        recordOutlineHistory(target.measurementId as string, pts);
        setOutlineTool(null);
        return;
      }
      // 'add': insert a vertex on the nearest staged outline edge.
      const pointer = canvas.getScenePoint(opt.e);
      const groups = new Map<string, Array<{ i: number; x: number; y: number }>>();
      canvas.getObjects().forEach(o => {
        const t = o as unknown as { measurementId?: string; vertexIndex?: number; left?: number; top?: number };
        if (!t.measurementId || t.vertexIndex == null || t.left == null || t.top == null) return;
        const list = groups.get(t.measurementId) ?? [];
        list.push({ i: t.vertexIndex, x: t.left, y: t.top });
        groups.set(t.measurementId, list);
      });
      let best: { areaId: string; insertAt: number; dist: number; pts: Array<{ x: number; y: number }> } | null = null;
      for (const [areaId, raw] of groups) {
        const pts = [...raw].sort((a, b) => a.i - b.i).map(p => ({ x: p.x, y: p.y }));
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i];
          const b = pts[(i + 1) % pts.length];
          const abx = b.x - a.x, aby = b.y - a.y;
          const lenSq = abx * abx + aby * aby;
          if (lenSq === 0) continue;
          const t = Math.min(1, Math.max(0, ((pointer.x - a.x) * abx + (pointer.y - a.y) * aby) / lenSq));
          const px = a.x + abx * t, py = a.y + aby * t;
          const dist = Math.hypot(pointer.x - px, pointer.y - py);
          if (!best || dist < best.dist) best = { areaId, insertAt: i + 1, dist, pts };
        }
      }
      if (best && best.dist <= 24) {
        best.pts.splice(best.insertAt, 0, { x: pointer.x, y: pointer.y });
        applyStagedAreaPoints(best.areaId, best.pts);
        recordOutlineHistory(best.areaId, best.pts);
        setOutlineTool(null);
      }
    };
    const listener = (opt: unknown) => handleToolDown(opt as { e: MouseEvent; target?: unknown });
    canvas.on('mouse:down', listener as never);
    return () => { canvas.off('mouse:down', listener as never); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyStagedAreaPoints]);
  
  // Update cursor when hovering near first point (to close loop)
  useEffect(() => {
    if (!fabricRef.current || !areaMode || areaSubTool !== 'polygon' || areaPoints.length < 3) return;
    
    const canvas = fabricRef.current;
    const handleMouseMove = (opt: any) => {
      const pointer = canvas.getScenePoint(opt.e);
      const firstPoint = areaPoints[0];
      const distance = Math.sqrt(
        Math.pow(pointer.x - firstPoint.x, 2) + 
        Math.pow(pointer.y - firstPoint.y, 2)
      );
      
      // Change cursor when near first point (to close polygon)
      if (distance < 15) {
        canvas.defaultCursor = 'alias'; // connecting/link cursor
        canvas.hoverCursor = 'alias';
      } else {
        canvas.defaultCursor = 'crosshair';
        canvas.hoverCursor = 'crosshair';
      }
    };
    
    canvas.on('mouse:move', handleMouseMove);
    return () => {
      canvas.off('mouse:move', handleMouseMove);
    };
  }, [areaMode, areaSubTool, areaPoints]);

  // ── Viewport pattern helpers (2026-09-26, owner: "can't move around when
  // zoomed"). The canvas element is sized to the visible viewport and the
  // plan is placed entirely by the viewportTransform, so every zoom/pan path
  // shares the same clamping rules (see ./canvasViewport).
  const sizeCanvasToViewport = () => {
    const canvas = fabricRef.current;
    const wrapper = canvasRef.current?.parentElement;
    if (!canvas || !wrapper) return;
    const w = Math.max(160, wrapper.clientWidth);
    const h = Math.max(160, wrapper.clientHeight);
    if (Math.abs(canvas.getWidth() - w) > 1 || Math.abs(canvas.getHeight() - h) > 1) {
      canvas.setDimensions({ width: w, height: h });
    }
  };

  const syncViewportState = (canvas: Canvas, vpt: Vpt, userDriven: boolean, panned = false) => {
    const { width: sw, height: sh } = sceneDimsRef.current;
    const clamped = clampVpt(vpt, sw, sh, canvas.getWidth(), canvas.getHeight());
    canvas.setViewportTransform(clamped);
    canvas.requestRenderAll();
    setZoom(clamped[0]);
    setViewClipped(isSceneClipped(clamped, sw, sh, canvas.getWidth(), canvas.getHeight()));
    if (userDriven) lastAutoFitZoom.current = null;
    if (panned) setHasPanned(true);
  };

  const fitPlanToViewport = (markAutoFit = true) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const { width: sw, height: sh } = sceneDimsRef.current;
    if (!sw || !sh) return;
    sizeCanvasToViewport();
    const fit = computeFitVpt(sw, sh, canvas.getWidth(), canvas.getHeight());
    canvas.setViewportTransform(fit.vpt);
    canvas.requestRenderAll();
    setZoom(fit.scale);
    setViewClipped(isSceneClipped(fit.vpt, sw, sh, canvas.getWidth(), canvas.getHeight()));
    if (markAutoFit) lastAutoFitZoom.current = fit.scale;
  };

  // Zoom controls - zoom around the viewport centre, preserving the pan.
  const handleZoomIn = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const vpt = (canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0]) as Vpt;
    syncViewportState(canvas, zoomVptAtPoint(vpt, 1.2, canvas.getWidth() / 2, canvas.getHeight() / 2), true);
  };

  const handleZoomOut = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const vpt = (canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0]) as Vpt;
    syncViewportState(canvas, zoomVptAtPoint(vpt, 1 / 1.2, canvas.getWidth() / 2, canvas.getHeight() / 2), true);
  };

  const handleResetZoom = () => {
    // Reset = back to the fitted view; auto-fit owns the zoom again.
    fitPlanToViewport(true);
  };

  // 2026-08-30: dynamic fit-to-screen. Re-fit the plan to the viewport when the
  // window resizes (browser maximize/restore, sidebar toggles, zoom changes the
  // CSS pixel size) - but ONLY while auto-fit still owns the zoom. Once the
  // user zooms manually, resizes never override their chosen level.
  // Viewport pattern (2026-09-26): the element also tracks the new viewport
  // size, and a user-owned view is re-clamped into the new bounds.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const canvas = fabricRef.current;
        if (!canvas || sceneDimsRef.current.width === 0) return;
        sizeCanvasToViewport();
        if (lastAutoFitZoom.current != null) {
          const { width: sw, height: sh } = sceneDimsRef.current;
          const fit = computeFitVpt(sw, sh, canvas.getWidth(), canvas.getHeight());
          if (Math.abs(fit.scale - lastAutoFitZoom.current) < 0.005) return;
          canvas.setViewportTransform(fit.vpt);
          canvas.requestRenderAll();
          setZoom(fit.scale);
          lastAutoFitZoom.current = fit.scale;
        } else {
          const vpt = (canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0]) as Vpt;
          syncViewportState(canvas, vpt, false);
        }
      }, 150);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      clearTimeout(timer);
    };
  }, [canvasDims]);

  // Reset Canvas: replaces the old Reset Zoom button.
  // New takeoff (no hydration) → wipe to blank canvas + calibrate step.
  // Saved takeoff (has hydration) → re-run reconstructCanvas from DB state.
  const handleResetCanvas = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    setShowResetConfirm(false);

    if (!hydrationData || hydrationData.measurements.length === 0) {
      // New takeoff: wipe everything, back to calibrate step.
      // Reuse the same state-reset sequence from loadPageImage.
      canvas.clear();
      canvas.backgroundColor = '#1e293b';

      // Reload the plan image as background
      const currentPage = pages[currentPageIndex];
      if (currentPage?.url) {
        const imgElement = new Image();
        imgElement.crossOrigin = 'anonymous';
        imgElement.onload = () => {
          const dims = computeCanvasDimensions(imgElement.naturalWidth, imgElement.naturalHeight);
          sceneDimsRef.current = { width: dims.width, height: dims.height };
          setCanvasDims({ width: dims.width, height: dims.height });
          const fabricImg = new FabricImage(imgElement);
          fabricImg.set({
            scaleX: dims.scale, scaleY: dims.scale,
            left: 0, top: 0,
            originX: 'left', originY: 'top',
            selectable: false, evented: false,
          });
          canvas.backgroundImage = fabricImg;
          // Viewport pattern: element tracks the viewport, plan fits + centres.
          const viewportWrapper = canvasRef.current?.parentElement;
          if (viewportWrapper) {
            canvas.setDimensions({
              width: Math.max(160, viewportWrapper.clientWidth),
              height: Math.max(160, viewportWrapper.clientHeight),
            });
          }
          const fit = computeFitVpt(dims.width, dims.height, canvas.getWidth(), canvas.getHeight());
          canvas.setViewportTransform(fit.vpt);
          canvas.renderAll();
          setZoom(fit.scale);
          setViewClipped(isSceneClipped(fit.vpt, dims.width, dims.height, canvas.getWidth(), canvas.getHeight()));
          lastAutoFitZoom.current = fit.scale;
        };
        imgElement.src = currentPage.url;
      }

      // Reset all tool modes + state
      setAreaMode(false);
      setLineMode(false);
      setPointMode(false);
      setMultiLinealMode(false);
      setCalibrationMode(false);
      setCalibrationPoints([]);
      setShowCalibrationModal(false);
      setShowCalibrationHelp(true);
      setShowConfirmedFlash(false);
      setCalibrations([]);
      setCalibrationConfirmed(false);
      setAreaPoints([]);
      setLinePoints([]);
      setMultiLinealPoints([]);
      setMultiLinealSegmentObjects([]);
      setComponentMeasurements([]);
      setRoofAreas([]);
      setSelectedComponentId(null);
      setIsExistingAreaMode(false);
      setExistingAreaLabel('');
      setIsDirty(false);
      // Clear undo history
      history.clear();
      console.info('[ResetCanvas] Reset to fresh takeoff (calibrate step)');
    } else {
      // Saved takeoff: re-run reconstruction from DB state.
      // Clear canvas and reload the plan image, then reconstruct.
      canvas.clear();
      canvas.backgroundColor = '#1e293b';

      const currentPage = pages[currentPageIndex];
      if (currentPage?.url) {
        const imgElement = new Image();
        imgElement.crossOrigin = 'anonymous';
        imgElement.onload = () => {
          const dims = computeCanvasDimensions(imgElement.naturalWidth, imgElement.naturalHeight);
          canvas.setDimensions({ width: dims.width, height: dims.height });
          setCanvasDims({ width: dims.width, height: dims.height });
          const fabricImg = new FabricImage(imgElement);
          fabricImg.set({
            scaleX: dims.scale, scaleY: dims.scale,
            left: 0, top: 0,
            originX: 'left', originY: 'top',
            selectable: false, evented: false,
          });
          canvas.backgroundImage = fabricImg;
          canvas.renderAll();

          // Re-hydrate from original DB data
          hydrationAppliedRef.current = false;
          reconstructAppliedRef.current = false;
          setCanvasReady(false);

          // Re-trigger hydration by setting canvasReady after image loads
          // The hydration effect + reconstruct effect will fire again.
          // We need to reset the refs and re-apply hydration data.
          const grouped = new Map<string, { componentId: string; measurements: any[]; expanded: boolean }>();
          const hydratedRoofAreas: { id: string; name: string; points: { x: number; y: number }[]; area: number; pitch: number; visible: boolean; fromPageId?: string | null }[] = [];
          hydrationData.measurements.forEach(m => {
            if (m.componentId === null && m.type === 'area') {
              hydratedRoofAreas.push({
                id: m.id,
                name: 'Area ' + (hydratedRoofAreas.length + 1),
                points: m.points || [],
                area: m.value,
                // Per-entry pitch fix (2026-07-06): restore the pitch this
                // polygon was saved with, not 0 / the parent's pitch.
                pitch: m.pitch ?? 0,
                visible: m.visible,
                fromPageId: m.pageId || null,
              });
              return;
            }
            if (m.componentId === null) return;
            const cid = m.componentId;
            if (!grouped.has(cid)) {
              grouped.set(cid, { componentId: cid, measurements: [], expanded: false });
            }
            const g = grouped.get(cid); if (g) g.measurements.push({
              id: m.id,
              type: m.type,
              value: m.value,
              points: m.points || undefined,
              visible: m.visible,
              fromPageId: m.pageId || null,
              entryInputs: m.entryInputs ?? null,
            });
          });

          if (grouped.size > 0) {
            setComponentMeasurements(Array.from(grouped.values()));
            setActiveComponentIds(Array.from(grouped.keys()));
          }

          if (hydratedRoofAreas.length > 0) {
            if (existingRoofAreas.length > 0) {
              hydratedRoofAreas.forEach((ra, i) => {
                const match = existingRoofAreas[i];
                if (match) {
                  // Per-entry pitch fix (2026-07-06): only fall back to the
                  // parent area pitch when the entry had none - never clobber
                  // a real per-entry pitch with the parent's.
                  if (!ra.pitch) ra.pitch = match.pitch || 0;
                  ra.name = match.label;
                }
              });
            }
            setRoofAreas(hydratedRoofAreas);
          }

          // Restore calibrations
          const firstPage = hydrationData.pages[0];
          if (firstPage && firstPage.scaleCalibration) {
            try {
              const restored = firstPage.scaleCalibration;
              if (Array.isArray(restored) && restored.length > 0) {
                setCalibrations(restored);
                setCalibrationConfirmed(true);
                setShowCalibrationHelp(false);
              }
            } catch (err) {
              console.warn('[ResetCanvas] Failed to restore calibrations:', err);
            }
          }

          // Re-run canvas reconstruction
          const result = reconstructCanvas(canvas, {
            componentMeasurements: Array.from(grouped.values()).map(c => ({
              componentId: c.componentId,
              measurements: c.measurements,
            })),
            roofAreas: hydratedRoofAreas,
            componentColors,
            currentPageId: currentPage?.id || null,
          });
          setComponentMeasurements(result.componentMeasurements);
          setRoofAreas(result.roofAreas);

          // Reset tool modes
          setAreaMode(false);
          setLineMode(false);
          setPointMode(false);
          setMultiLinealMode(false);
          setCalibrationMode(false);
          setAreaPoints([]);
          setLinePoints([]);
          setMultiLinealPoints([]);
          setMultiLinealSegmentObjects([]);

          // Issue 4 fix: re-apply existing area mode
          if (takeoffMode === 'add' && existingRoofAreas.length > 0) {
            setIsExistingAreaMode(true);
            setActiveSaveRoofAreaId(existingRoofAreas[0].id);
            setExistingAreaLabel(existingRoofAreas[0].label);
          }

          // Also reset zoom (viewport pattern: back to the fitted view)
          if (sceneDimsRef.current.width > 0) {
            const resetFit = computeFitVpt(sceneDimsRef.current.width, sceneDimsRef.current.height, canvas.getWidth(), canvas.getHeight());
            canvas.setViewportTransform(resetFit.vpt);
            canvas.requestRenderAll();
            setZoom(resetFit.scale);
            lastAutoFitZoom.current = resetFit.scale;
          }

          setIsDirty(false);
          history.clear();
          console.info('[ResetCanvas] Reset to saved takeoff state (reconstructed from DB)');
        };
        imgElement.src = currentPage.url;
      } else {
        // No page URL - just reset zoom
        canvas.setZoom(1);
        canvas.viewportTransform = [1, 0, 0, 1, 0, 0];
        setZoom(1);
      }
    }
  };

  const handleFitToScreen = () => {
    // Viewport pattern (2026-09-26): fit + centre via the shared helper.
    fitPlanToViewport(true);
  };

  // ── AI Takeoff: in-browser downscale before upload ────────────
  // Vercel caps request bodies at 4.5MB (base64 inflates ~33%), so large
  // phone/drone photos 413 before the server resize ever runs. Downscaling
  // to 2000px JPEG here mirrors the server-side resize, so scan quality
  // is unchanged. Fallback: return the original on any failure.
  const compressImageForAiScan = async (rawDataUrl: string): Promise<{ dataUrl: string; mime: string }> => {
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new window.Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('decode failed'));
        el.src = rawDataUrl;
      });
      const MAX_PX = 2000;
      const longest = Math.max(img.naturalWidth, img.naturalHeight);
      // Already small enough (~3.4MB raw payload limit) - send as-is
      if (longest <= MAX_PX && rawDataUrl.length < 2_500_000) {
        return { dataUrl: rawDataUrl, mime: 'image/png' };
      }
      const scale = Math.min(1, MAX_PX / longest);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) return { dataUrl: rawDataUrl, mime: 'image/png' };
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return { dataUrl: canvas.toDataURL('image/jpeg', 0.85), mime: 'image/jpeg' };
    } catch {
      return { dataUrl: rawDataUrl, mime: 'image/png' };
    }
  };

  // ── AI Takeoff: scan handler (direct 3-scan pipeline) ──────────
  const handleAiScan = async () => {
    const canvas = fabricRef.current;
    if (!canvas || !quote) return;

    const bgImage = canvas.backgroundImage;
    if (!bgImage) { setAiScanError('No plan image loaded.'); return; }

    const pageId = pages[currentPageIndex]?.id ?? null;
    if (!pageId) { setAiScanError('No active page.'); return; }

    // Set up abort controller so cancel works at any stage
    const abortController = new AbortController();
    aiAbortRef.current = abortController;

    setAiScanning(true);
    setAiScanStage('outline');
    setAiScanError(null);
    setAiResults(null);
    setAiScanRaw(null);
    setAiStagedPageId(null);
    let scanCompleted = false;

    try {
      const currentPage = pages[currentPageIndex];
      const imageUrl = currentPage?.url ?? planUrlRef.current;
      if (!imageUrl) { setAiScanError('No plan image URL available.'); return; }

      const imgResponse = await fetch(imageUrl, { signal: abortController.signal });
      if (!imgResponse.ok) { setAiScanError('Failed to load plan image for AI scan.'); return; }
      const imgBlob = await imgResponse.blob();
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const handleAbort = () => reader.abort();
        abortController.signal.addEventListener('abort', handleAbort, { once: true });
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.onabort = () => reject(new DOMException('Scan cancelled.', 'AbortError'));
        reader.readAsDataURL(imgBlob);
      });

      const compressed = await compressImageForAiScan(dataUrl);
      const scanImage = compressed.dataUrl;
      const scanImageMime = compressed.mime;

      // ── Scan 1: Outline ──
      const response = await fetch(aiScanEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage: 'scan1',
          image: scanImage,
          imageMime: scanImageMime,
          quoteId: quote.id,
          pageId,
          canvasDimensions: canvasDims,
          qualityLevel: aiQualityLevel,
        }),
        signal: abortController.signal,
      });

      const result = await response.json().catch(() => ({ success: false, error: `Server returned HTTP ${response.status}` }));

      if (!response.ok || !result.success) {
        let errMsg = result.error || `AI scan failed (HTTP ${response.status}).`;
        if (response.status === 413) {
          errMsg = 'Your plan image is too large for AI Assist even after automatic compression. Please try a smaller or compressed image, or use Manual Measure, which accepts larger images.';
        }
        console.error('[AI Takeoff V3] scan1 error:', errMsg, result);
        if (response.status === 402 && result.pointsExhausted) {
          setAiPoints(prev => prev ? { ...prev, remaining: result.pointsRemaining ?? 0, isBlocked: true } : null);
        }
        setAiScanError(errMsg);
        return;
      }

      if (!result.data?.roof_areas?.length) {
        setAiScanError(result.summary?.notes?.[0] || 'No usable roof outline was detected.');
        return;
      }

      const areaInfos: AiResultsArea[] = (result.data?.roof_areas ?? []).map((area: { name?: string; points?: Array<{ x: number; y: number }>; pitch_degrees?: number | null }, idx: number) => {
        // Owner 2026-09-25: the results card leads with the measured size -
        // same calibration maths as the eventual apply, so the number the
        // user sees here is the number that lands on the canvas.
        const sizeValue = computeAreaValue((area.points ?? []).map(p => ({ x: p.x, y: p.y })), calibrations);
        return {
          index: idx,
          name: area.name || `Area ${idx + 1}`,
          pitch: area.pitch_degrees ?? result.data?.pitch?.global_degrees ?? null,
          vertexCount: area.points?.length ?? 0,
          sizeLabel: sizeValue > 0
            ? `${sizeValue >= 100 ? Math.round(sizeValue).toLocaleString() : sizeValue.toFixed(1)} ${quote.measurement_system === 'metric' ? 'm²' : 'ft²'}`
            : null,
        };
      });

      // Points were deducted server-side on scan1; update local state.
      // Costs come from the shared canonical constant (2/6/12).
      const cost = getAiScanPointCost(aiQualityLevel);
      setAiPoints(prev => prev ? { ...prev, used: prev.used + cost, remaining: Math.max(prev.remaining - cost, 0) } : null);

      // M10 P5: STAGED pipeline - scan1 completes the scan action and opens
      // the results modal with the outline (components empty). The user
      // reviews and corrects the outline on the canvas, then "Detect
      // components" continues with scans 2+3 on the CORRECTED points
      // (handleContinueAiScan).
      setAiScanRaw(result.data);
      setAiResults({
        // Stage 1 returns outline-only counts; normalise to the full summary
        // shape the results modal renders (component counts legitimately 0
        // until "Detect components" runs scans 2+3).
        summary: {
          areas: result.summary?.areas ?? result.data?.roof_areas?.length ?? 0,
          components: 0,
          ridges: 0,
          hips: 0,
          valleys: 0,
          broken_hips: 0,
          barges: 0,
          spouting: 0,
          uncertain: 0,
          notes: Array.isArray(result.summary?.notes) ? result.summary.notes : [],
          unreadable: false,
        },
        scaleCheck: result.data?.scaleCheck ?? null,
        droppedCount: 0,
        areas: areaInfos,
      });
      setAiStagedPageId(pageId);
      scanCompleted = true;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // User cancelled - no error message needed
        return;
      }
      console.error('[AI Takeoff] scan failed:', err);
      const msg = err instanceof Error ? err.message : 'Network error.';
      setAiScanError(`Scan failed: ${msg}`);
    } finally {
      if (aiAbortRef.current === abortController) {
        setAiScanning(false);
        aiAbortRef.current = null;
        if (!scanCompleted) {
          roofAreaInstructionsDismissedRef.current = false;
          setShowRoofAreaInstructions(true);
        }
      }
    }
  };

  // ── AI Takeoff: run scan 2 + scan 3 ──────────────────────────────
  const runRemainingAiScans = async ({
    outlineData,
    areas,
    imageDataUrl,
    analysisDimensions,
    pageId,
    qualityLevel,
    abortController,
    silent = false,
  }: {
    outlineData: Pick<AiScanData, 'roof_areas'>;
    areas: AiResultsArea[];
    imageDataUrl: string;
    analysisDimensions: { width: number; height: number };
    pageId: string;
    qualityLevel: 'low' | 'medium' | 'high';
    abortController: AbortController;
    /** P5 staged continuation: skip the results modal, return the scan3 data. */
    silent?: boolean;
  }): Promise<{ completed: boolean; data?: AiScanData }> => {
    if (!quote) return { completed: false };

    const confirmedAreas = outlineData.roof_areas;
    setAiScanStage('lines');
    try {
      // ── Scan 2: Internal line detection ──
      const scan2Response = await fetch(aiScanEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage: 'scan2',
          image: imageDataUrl,
          imageMime: 'image/png',
          canvasDimensions: canvasDims,
          quoteId: quote.id,
          pageId,
          outlinePoints: confirmedAreas[0]?.points ?? [],
          analysisDimensions,
          qualityLevel,
        }),
        signal: abortController.signal,
      });
      const scan2Result = await scan2Response.json().catch(() => ({ success: false, error: `Server returned HTTP ${scan2Response.status}` }));
      if (!scan2Response.ok || !scan2Result.success) {
        setAiScanError(scan2Result.error || `Line detection failed (HTTP ${scan2Response.status}).`);
        return { completed: false };
      }

      const detectedLines = scan2Result.data?.lines ?? [];
      const outlinePoints = scan2Result.data?.outlinePoints ?? confirmedAreas[0]?.points ?? [];
      console.log(`[AI Takeoff V3] scan2 complete: ${detectedLines.length} lines detected (raw=${scan2Result.summary?.rawLines}, rejected=${scan2Result.summary?.angleRejected}, floating=${scan2Result.summary?.floating})`);

      // ── Scan 3: Classification ──
      setAiScanStage('classify');
      const scan3Response = await fetch(aiScanEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage: 'scan3',
          image: imageDataUrl,
          imageMime: 'image/png',
          canvasDimensions: canvasDims,
          quoteId: quote.id,
          pageId,
          outlinePoints: outlinePoints,
          lines: detectedLines,
          analysisDimensions,
          qualityLevel,
        }),
        signal: abortController.signal,
      });
      const result = await scan3Response.json().catch(() => ({ success: false, error: `Server returned HTTP ${scan3Response.status}` }));
      if (!scan3Response.ok || !result.success) {
        const violations = Array.isArray(result.topologyViolations)
          ? ` ${result.topologyViolations.join(' ')}` : '';
        setAiScanError(`${result.error || `AI scan failed (HTTP ${scan3Response.status}).`}${violations}`);
        return { completed: false };
      }

      if (!silent) {
        setAiScanRaw(result.data);
        setAiResults({
          summary: result.summary,
          scaleCheck: result.data?.scaleCheck ?? null,
          droppedCount: 0,
          areas,
        });
      }
      return { completed: true, data: result.data as AiScanData };
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return { completed: false };
      }
      setAiScanError(`Classification failed: ${error instanceof Error ? error.message : 'Network error.'}`);
      return { completed: false };
    }
  };

  // ── M10 P5: staged continuation - detect components on the corrected outline ──
  const handleContinueAiScan = async () => {
    if (aiScanning || !quote) return;
    setOutlineTool(null);
    const canvas = fabricRef.current;
    if (!canvas) return;
    const pageId = pages[currentPageIndex]?.id ?? null;
    if (!pageId || aiStagedPageId !== pageId) return;
    // Corrected outline: the staged AI areas' CURRENT canvas points (the
    // user may have dragged vertices after applying the outline).
    const stagedAreas = roofAreas.filter(ra => ra.fromPageId === pageId && ra.quoteRoofAreaId);
    if (stagedAreas.length === 0) { setAiScanError('The AI outline is no longer on this page.'); return; }
    const outlineData = {
      roof_areas: stagedAreas.map(ra => ({
        name: ra.name,
        pitch_degrees: ra.pitch ?? null,
        points: ra.points.map(p => ({ x: p.x, y: p.y })),
      })),
    };
    const currentPage = pages[currentPageIndex];
    const imageUrl = currentPage?.url ?? planUrlRef.current;
    if (!imageUrl) { setAiScanError('No plan image URL available.'); return; }
    const abortController = new AbortController();
    aiAbortRef.current = abortController;
    setAiScanning(true);
    setAiScanStage('lines');
    setAiScanError(null);
    try {
      const imgResponse = await fetch(imageUrl, { signal: abortController.signal });
      if (!imgResponse.ok) { setAiScanError('Failed to load plan image for AI scan.'); return; }
      const imgBlob = await imgResponse.blob();
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const handleAbort = () => reader.abort();
        abortController.signal.addEventListener('abort', handleAbort, { once: true });
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.onabort = () => reject(new DOMException('Scan cancelled.', 'AbortError'));
        reader.readAsDataURL(imgBlob);
      });
      const compressed = await compressImageForAiScan(dataUrl);
      const areasForRun: AiResultsArea[] = stagedAreas.map((ra, idx) => ({
        index: idx,
        name: ra.name,
        pitch: ra.pitch ?? null,
        vertexCount: ra.points.length,
      }));
      const outcome = await runRemainingAiScans({
        outlineData,
        areas: areasForRun,
        imageDataUrl: compressed.dataUrl,
        analysisDimensions: { width: canvasDims.width, height: canvasDims.height },
        pageId,
        qualityLevel: aiQualityLevel,
        abortController,
        silent: true,
      });
      if (!outcome.completed || !outcome.data) return; // errors set inside
      // Apply ONLY the components: the outline areas are already applied.
      await handleApplyAiResults({}, { areasAlreadyApplied: true, aiDataOverride: outcome.data });
      setAiStagedPageId(null);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setAiScanError(err instanceof Error ? err.message : 'Network error.');
    } finally {
      if (aiAbortRef.current === abortController) {
        setAiScanning(false);
        aiAbortRef.current = null;
      }
    }
  };

  // ── AI Takeoff: cancel running scan ──────────────────────────────
  const handleCancelAiScan = () => {
    if (aiAbortRef.current) {
      aiAbortRef.current.abort();
      aiAbortRef.current = null;
    }
    setAiScanning(false);
    setAiScanStage('outline');

    // Reopen the calibration-complete popup so user can choose AI Assist / Draw / Skip
    roofAreaInstructionsDismissedRef.current = false;
    setShowRoofAreaInstructions(true);
  };

  // Owner 2026-09-25: outline-review "Finish & save" - identical to the main
  // header action: keep the area measured so far and go straight to the
  // quote builder (Measurements & Pricing).
  const handleOutlineFinishAndSave = async () => {
    setAiStagedPageId(null);
    setOutlineTool(null);
    setOutlineSelectedVertex(null);
    await handleSaveTakeoff();
  };


  // ── AI Takeoff: Replace placeholder with real component ────────────
  const handleReplacePlaceholder = (placeholderComponentId: string, targetComponentId: string) => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    // Find the placeholder's measurements
    const placeholderGroup = componentMeasurements.find(c => c.componentId === placeholderComponentId);
    if (!placeholderGroup || placeholderGroup.measurements.length === 0) return;

    // Find the placeholder component to get its semantic key
    const placeholderComp = components.find(c => c.id === placeholderComponentId);
    if (!placeholderComp?.is_system) return;
    const semanticKey = resolveSemanticKey(placeholderComp.name);
    if (!semanticKey) return;

    // Find the target component
    const targetComp = components.find(c => c.id === targetComponentId);
    if (!targetComp) return;

    // Determine the target component's colour. Owner 2026-09-25 (13:20):
    // colour stability on attach - a freshly-attached user component
    // INHERITS the AI default's existing colour instead of being assigned
    // the next palette colour (colour changes between the plan and the
    // panel were confusing). If the target is already active with its own
    // colour, that colour is kept.
    const existingTargetColour = componentColors.find(c => c.componentId === targetComponentId)?.color;
    const placeholderColour = componentColors.find(c => c.componentId === placeholderComponentId)?.color
      ?? (semanticKey ? getSemanticColour(semanticKey) : undefined);
    const targetColour = existingTargetColour || placeholderColour || (() => {
      const activeCount = activeComponentIds.filter(id => {
        const comp = components.find(c => c.id === id);
        return comp && !comp.is_system;
      }).length;
      return COLOR_PALETTE[activeCount % COLOR_PALETTE.length];
    })();

    // Recolour all canvas objects from the placeholder to the target's colour
    // so the sidebar bar colour matches the canvas stroke colour
    for (const m of placeholderGroup.measurements) {
      if (m.canvasObjects) {
        for (const obj of m.canvasObjects) {
          if (obj.type === 'line') {
            obj.set({ stroke: targetColour });
          } else if (obj.type === 'circle') {
            obj.set({ fill: targetColour });
          }
        }
      }
    }
    canvas.renderAll();

    // Move measurements from placeholder group to target component group
    setComponentMeasurements(prev => {
      const updated = [...prev];

      const targetIdx = updated.findIndex(c => c.componentId === targetComponentId);
      const placeholderIdx = updated.findIndex(c => c.componentId === placeholderComponentId);

      if (placeholderIdx < 0) return prev;

      const measurementsToMove = updated[placeholderIdx].measurements;

      if (targetIdx >= 0) {
        updated[targetIdx] = {
          ...updated[targetIdx],
          measurements: [...updated[targetIdx].measurements, ...measurementsToMove],
          expanded: true,
        };
      } else {
        updated.push({
          componentId: targetComponentId,
          measurements: measurementsToMove,
          expanded: true,
        });
      }

      updated.splice(placeholderIdx, 1);
      return updated;
    });

    // Update active component IDs: remove placeholder, add target
    setActiveComponentIds(prev => {
      const set = new Set(prev);
      set.delete(placeholderComponentId);
      set.add(targetComponentId);
      return Array.from(set);
    });

    // Update component colours: remove placeholder colour, set target colour
    setComponentColors(prev => {
      const updated = prev.filter(c => c.componentId !== placeholderComponentId);
      // Ensure target has the correct colour
      const targetExisting = updated.findIndex(c => c.componentId === targetComponentId);
      if (targetExisting >= 0) {
        updated[targetExisting] = { componentId: targetComponentId, color: targetColour };
      } else {
        updated.push({ componentId: targetComponentId, color: targetColour });
      }
      return updated;
    });

    setIsDirty(true);
  };

  // ── Owner 2026-09-25 (13:20): assign an uncertain AI line to a component.
  // Behaves exactly as if the user had selected the target component and
  // drawn the line themselves: the pink dashed line turns solid in the
  // component's colour and the measurement becomes a normal entry under it.
  const handleAssignUncertainToComponent = (measurementId: string, targetComponentId: string) => {
    const canvas = fabricRef.current;
    const group = componentMeasurements.find(c => c.componentId === '__review__uncertain');
    const m = group?.measurements.find(x => x.id === measurementId);
    const targetComp = components.find(c => c.id === targetComponentId);
    if (!canvas || !m || !targetComp) return;

    // Activate the component if it isn't already.
    if (!activeComponentIds.includes(targetComponentId)) {
      setActiveComponentIds(prev => [...prev, targetComponentId]);
    }

    // Resolve the target colour (system = registry colour; user = palette).
    const existingColour = componentColors.find(c => c.componentId === targetComponentId)?.color;
    const targetColour = existingColour ?? (targetComp.is_system
      ? (resolveSemanticKey(targetComp.name) ? getSemanticColour(resolveSemanticKey(targetComp.name)!) : '#3b82f6')
      : COLOR_PALETTE[activeComponentIds.filter(id => {
          const c = components.find(x => x.id === id);
          return c && !c.is_system;
        }).length % COLOR_PALETTE.length]);
    if (!existingColour) {
      const assigned = targetColour;
      setComponentColors(prev => prev.some(c => c.componentId === targetComponentId)
        ? prev
        : [...prev, { componentId: targetComponentId, color: assigned }]);
    }

    // Pink dashed line -> solid line in the component's colour.
    m.canvasObjects?.forEach((obj: any) => {
      obj.set({ stroke: targetColour, strokeDashArray: null });
    });
    canvas.renderAll();

    // Move the measurement out of the review group into the component group.
    setComponentMeasurements(prev => {
      const updated = [...prev];
      const srcIdx = updated.findIndex(c => c.componentId === '__review__uncertain');
      if (srcIdx < 0) return prev;
      const measurement = updated[srcIdx].measurements.find(x => x.id === measurementId);
      if (!measurement) return prev;
      const rest = updated[srcIdx].measurements.filter(x => x.id !== measurementId);
      if (rest.length === 0) updated.splice(srcIdx, 1);
      else updated[srcIdx] = { ...updated[srcIdx], measurements: rest };
      const tgtIdx = updated.findIndex(c => c.componentId === targetComponentId);
      if (tgtIdx >= 0) {
        updated[tgtIdx] = { ...updated[tgtIdx], measurements: [...updated[tgtIdx].measurements, { ...measurement, visible: true }], expanded: true };
      } else {
        updated.push({ componentId: targetComponentId, measurements: [{ ...measurement, visible: true }], expanded: true });
      }
      return updated;
    });
    setUncertainAssignOpenFor(null);
    setIsDirty(true);
  };

  // ── AI Takeoff: apply results to canvas ───────────────────────────
  const handleApplyAiResults = async (areaOverrides: Record<number, { name: string; pitch: number }>, opts: { areasAlreadyApplied?: boolean; aiDataOverride?: AiScanData } = {}) => {
    const canvas = fabricRef.current;
    const rawAiData = opts.aiDataOverride ?? aiScanRaw;
    if (!canvas || !rawAiData) return;

    const bgImage = canvas.backgroundImage as unknown as { width?: number; height?: number } | null;
    if (!bgImage || !bgImage.width || !bgImage.height) {
      setAiScanError('Plan image not available.');
      return;
    }

    // Build system component id map from registry
    const systemComponentIds = buildSystemComponentIds(components);

    // Check all 5 placeholder types have system components
    if (Object.keys(systemComponentIds).length < 5) {
      setAiScanError('System components not fully seeded. Please reload the page.');
      return;
    }

    const applied = applyAiResults({
      aiData: rawAiData,
      calibrations,
      systemComponentIds,
      canvasWidth: canvasDims.width,
      canvasHeight: canvasDims.height,
    });

    // ── Step 5: Create real DB parent areas ────────────────────────────
    // Build the area list with confirmed names and pitches from the modal
    const areaInputs = applied.roofAreas.map((ra, idx) => {
      const override = areaOverrides[idx];
      return {
        name: override?.name || ra.name || `Area ${idx + 1}`,
        pitch: override?.pitch ?? ra.pitch ?? 0,
      };
    });

    // Build a mapping: AI area index -> real DB area ID (hoisted: the P5
    // staged-continuation branch below also writes into it)
    const areaIdMap = new Map<number, string>();
    let newRoofAreas: RoofArea[] = [];
    if (!opts.areasAlreadyApplied) {
    let realAreaIds: string[];
    if (areaInputs.length > 0) {
      const createResult = await takeoffActions.batchCreateAiRoofAreas(quote.id, areaInputs);
      if (!createResult.ok || !createResult.areaIds) {
        setAiScanError(createResult.error || 'Failed to create roof areas.');
        return;
      }
      realAreaIds = createResult.areaIds;
    } else {
      realAreaIds = [];
    }

    realAreaIds.forEach((id, idx) => areaIdMap.set(idx, id));

    // 1. Add roof areas to React state + canvas, using REAL DB IDs
    newRoofAreas = applied.roofAreas.map((ra: AiRoofAreaResult, idx: number) => {
      const realId = areaIdMap.get(idx) ?? ra.id;
      const override = areaOverrides[idx];
      const pitch = override?.pitch ?? ra.pitch;
      const name = override?.name || ra.name;

      // Create Fabric polygon for the roof area
      const polygon = new Polygon(
        ra.canvasPoints.map(p => ({ x: p.x, y: p.y })),
        {
          fill: 'rgba(59, 130, 246, 0.2)',
          stroke: '#3b82f6',
          strokeWidth: 2,
          selectable: false,
          objectCaching: false,
        },
      );
      (polygon as unknown as { measurementId: string }).measurementId = realId;
      canvas.add(polygon);

      // Vertex markers - M10 P5: draggable so the user can correct the AI
      // outline with the mouse between the outline scan and the component
      // scans (the object:modified handler rebuilds the polygon).
      const markers = ra.canvasPoints.map((p, vertexIndex) => {
        const marker = new Circle({
          left: p.x, top: p.y, radius: 4,
          fill: '#3b82f6', stroke: '#000', strokeWidth: 1,
          originX: 'center', originY: 'center',
          selectable: true, evented: true, hasControls: false, hasBorders: false,
          hoverCursor: 'pointer', moveCursor: 'grabbing',
        });
        (marker as unknown as { measurementId: string }).measurementId = realId;
        (marker as unknown as { measurementId: string; vertexIndex: number }).vertexIndex = vertexIndex;
        canvas.add(marker);
        return marker;
      });

      return {
        id: realId,
        name,
        points: ra.canvasPoints,
        area: ra.area,
        pitch,
        visible: true,
        polygon,
        markers,
        fromPageId: pages[currentPageIndex]?.id ?? null,
        quoteRoofAreaId: realId, // Real DB ID
      };
    });

    if (newRoofAreas.length > 0) {
      setRoofAreas(prev => [...prev, ...newRoofAreas]);
      // Update areaList for the left-panel area switcher
      setAreaList(prev => [
        ...prev,
        ...newRoofAreas.map(ra => ({
          id: ra.id,
          label: ra.name,
          pitch: ra.pitch,
          area: ra.area,
        })),
      ]);
    }
    } else {
      // M10 P5 staged continuation: areas are already on the canvas - map AI
      // area indices to the EXISTING DB area ids so components attach right.
      const stagedAreas = roofAreas.filter(ra => ra.fromPageId === (pages[currentPageIndex]?.id ?? null) && ra.quoteRoofAreaId);
      stagedAreas.forEach((ra, idx) => { if (ra.quoteRoofAreaId) areaIdMap.set(idx, ra.quoteRoofAreaId); });
    }

    // 2. Add component measurements to React state + canvas
    // Group by semanticKey → componentId
    const byComponent = new Map<string, { measurements: typeof applied.measurements; semanticKey: SemanticKey }>();
    for (const m of applied.measurements) {
      // Uncertain AI detections have a null componentId (review items, not
      // quote components) - group them under an explicit review key.
      const groupKey = m.componentId ?? `__review__${m.semanticKey}`;
      const existing = byComponent.get(groupKey);
      if (existing) {
        existing.measurements.push(m);
      } else {
        byComponent.set(groupKey, { measurements: [m], semanticKey: m.semanticKey });
      }
    }

    setComponentMeasurements(prev => {
      const updated = [...prev];

      for (const [componentId, { measurements, semanticKey }] of byComponent) {
        const existingIdx = updated.findIndex(c => c.componentId === componentId);
        const colour = getSemanticColour(semanticKey);
        const lineOpts = getLineOptions(semanticKey);

        // Create canvas objects for each measurement
        const newMeasurements: ComponentMeasurement[] = measurements.map((m: AiMeasurement) => {
          const [p1, p2] = m.canvasPoints;
          const marker1 = new Circle({
            left: p1.x, top: p1.y, radius: 3,
            fill: colour, stroke: '#000', strokeWidth: 1,
            originX: 'center', originY: 'center',
            selectable: false, hasControls: false, hasBorders: false,
          });
          (marker1 as unknown as { measurementId: string }).measurementId = m.id;

          const marker2 = new Circle({
            left: p2.x, top: p2.y, radius: 3,
            fill: colour, stroke: '#000', strokeWidth: 1,
            originX: 'center', originY: 'center',
            selectable: false, hasControls: false, hasBorders: false,
          });
          (marker2 as unknown as { measurementId: string }).measurementId = m.id;

          const line = new Line(
            [p1.x, p1.y, p2.x, p2.y],
            {
              stroke: lineOpts.stroke,
              strokeWidth: lineOpts.strokeWidth,
              ...(lineOpts.strokeDashArray ? { strokeDashArray: lineOpts.strokeDashArray } : {}),
              selectable: false,
              hasControls: false,
              hasBorders: false,
            },
          );
          (line as unknown as { measurementId: string }).measurementId = m.id;

          canvas.add(marker1, marker2, line);

          // Map the measurement's quoteRoofAreaId from AI client ID to real DB ID
          // The AI measurement's quoteRoofAreaId was set to the roofAreaResults[idx].id
          // We need to find which AI area index it belongs to and map to the real ID
          let resolvedAreaId = m.quoteRoofAreaId;
          if (resolvedAreaId) {
            // Find the AI area index whose client UUID matches
            const aiAreaIdx = applied.roofAreas.findIndex(ra => ra.id === resolvedAreaId);
            if (aiAreaIdx >= 0) {
              resolvedAreaId = areaIdMap.get(aiAreaIdx) ?? resolvedAreaId;
            }
          }

          return {
            id: m.id,
            type: 'line' as const,
            value: m.value,
            points: m.canvasPoints,
            visible: true,
            canvasObjects: [marker1, marker2, line],
            fromPageId: pages[currentPageIndex]?.id ?? null,
            quoteRoofAreaId: resolvedAreaId,
            aiOrigin: true,
          } as ComponentMeasurement & { aiOrigin?: boolean };
        });

        if (existingIdx >= 0) {
          updated[existingIdx] = {
            ...updated[existingIdx],
            measurements: [...updated[existingIdx].measurements, ...newMeasurements],
            expanded: true,
          };
        } else {
          updated.push({
            componentId,
            measurements: newMeasurements,
            expanded: true,
          });
        }
      }

      return updated;
    });

    // Activate all component IDs that now have measurements so they appear in the sidebar
    // Also assign colours from the registry (NOT from the palette)
    const newComponentIds = Array.from(byComponent.keys());
    if (newComponentIds.length > 0) {
      setActiveComponentIds(prev => {
        const set = new Set(prev);
        for (const id of newComponentIds) set.add(id);
        return Array.from(set);
      });

      // Assign registry colours to AI placeholder components
      // (overrides the palette-by-order colour assignment)
      setComponentColors(prev => {
        const updated = [...prev];
        for (const [componentId, { semanticKey }] of byComponent) {
          const colour = getSemanticColour(semanticKey);
          const existingIdx = updated.findIndex(c => c.componentId === componentId);
          if (existingIdx >= 0) {
            updated[existingIdx] = { componentId, color: colour };
          } else {
            updated.push({ componentId, color: colour });
          }
        }
        return updated;
      });
    }

    // Update the results modal with dropped count
    if (applied.droppedCount > 0 && aiResults) {
      setAiResults({ ...aiResults, droppedCount: applied.droppedCount });
    }

    // Set the first created area as active so manually-drawn components
    // are stamped with the correct quoteRoofAreaId.
    if (newRoofAreas.length > 0) {
      const firstArea = newRoofAreas[0];
      setActiveAreaId(firstArea.id);
      activeAreaIdRef.current = firstArea.id;
      setActiveSaveRoofAreaId(firstArea.id);
    }

    canvas.renderAll();
    setIsDirty(true);

    // Close modal
    setAiResults(null);
    setAiScanRaw(null);
    setShowRoofAreaInstructions(false);
    roofAreaInstructionsDismissedRef.current = true;
  };

  // === P2/P6 AI-assisted calibration handlers (flag-gated) ===
  const aiCalPageKey = pages[currentPageIndex]?.id ?? pages[currentPageIndex]?.url ?? String(currentPageIndex);
  const aiCalWorkingUnit: WorkingUnit = quote.measurement_system === 'metric' ? 'meters' : 'feet';
  // P0-6 (audit 2026-09-20): the descriptor separates the two identities that
  // were previously conflated into a fabricated revision string:
  // - imageRevision: the AUTHORITATIVE server content-digest revision, taken
  //   from the hydrated takeoff_pages row when known (null otherwise - the
  //   search response carries it and the controller tracks it).
  // - frameKey: the client render-frame identity (page + canvas raster), used
  //   only for client-side mapping and reducer context guards.
  // The metadata envelope written on commit always carries the server revision
  // from the search response, never a client value.
  const aiCalPageId = pages[currentPageIndex]?.id ?? `local-${currentPageIndex}`;
  const aiCalPageServerRevision =
    hydrationData?.pages.find((p) => p.id === aiCalPageId)?.imageRevision ?? null;
  const aiCalImage: CalibrationImageDescriptor = {
    pageId: aiCalPageId,
    imageRevision: aiCalPageServerRevision,
    frameKey: `client-${aiCalPageKey}`,
    sourceWidth: canvasDims.width,
    sourceHeight: canvasDims.height,
    sceneWidth: buildSourceToScene(canvasDims.width, canvasDims.height).sceneWidth,
    sceneHeight: buildSourceToScene(canvasDims.width, canvasDims.height).sceneHeight,
    sourceToScene: [1, 0, 0, 1, 0, 0],
    coordinateFrame: 'takeoff-scene-v1',
    geometryVersion: 1,
  };

  // 6.1: build the start mode for an AI session opened from the toolbar
  // (Calibrate/Recalibrate) on the CURRENT page. Uncalibrated page -> new.
  // Calibrated page with a trusted, revision-matching metadata envelope ->
  // edit (committed references preloaded as drafts; committed calibration
  // stays active until the replacement commit succeeds). Calibrated page
  // without usable metadata -> replace (draft-until-commit from scratch).
  const buildAiCalStartMode = (): CalibrationStartMode => {
    const pageId = pages[currentPageIndex]?.id ?? null;
    const calibrated = calibrationConfirmed && calibrations.length > 0;
    if (!pageId || !calibrated) return { kind: 'new' };
    const meta = aiCalMetadataRef.current.get(pageId);
    if (
      meta &&
      shouldTrustCalibrationMetadata(
        meta.imageRevision,
        hydrationData?.pages.find((p) => p.id === pageId)?.imageRevision ?? null,
      )
    ) {
      const initialAccepted: AcceptedReferenceDraft[] = meta.references.map((ref) => ({
        id: ref.id,
        source: ref.source,
        candidateId: ref.candidateId,
        referenceId: ref.referenceId,
        candidateRevision: ref.candidateRevision,
        sceneP1: { ...ref.sceneP1 },
        sceneP2: { ...ref.sceneP2 },
        confirmedDistance: ref.confirmedDistance,
        confirmedUnit: ref.confirmedUnit,
        originalLabelText: ref.originalLabelText,
        valueCorrected: ref.valueCorrected,
      }));
      if (initialAccepted.length > 0) return { kind: 'edit', initialAccepted };
    }
    return { kind: 'replace' };
  };

  // 6.1: open a fresh AI review session (remounting the controller via the
  // nonce key so each deliberate start gets a clean reducer state).
  const openAiReviewSession = useCallback((mode: CalibrationStartMode) => {
    setAiCalStartMode(mode);
    setAiCalSessionNonce((n) => n + 1);
    setAiCalReviewOpen(true);
    setAiCalSessionLive(true);
  }, []);

  // (Removed 2026-09-25) the auto-popup chooser effect is gone: calibration
  // is always the manual flow now, per owner decision. No AI-vs-manual popup.

  // P3: accepted AI references -> EffectiveCalibration -> deterministic recompute
  // of every scale-dependent value on THIS page (spec 10.1 finish sequence),
  // then commit via the existing save mechanism. Any failure (preflight errors
  // or COMMIT_FAILED persistence) restores the prior state - a failed
  // calibration save is never reported as success.
  const handleAiCalibrationComplete = useCallback(async (
    accepted: readonly AcceptedReferenceDraft[],
    workingUnit: WorkingUnit,
    commitContext: { serverImageRevision: string | null },
  ): Promise<CalibrationCommitResult> => {
    // 1. New effective calibration from the accepted references.
    const refs: CalibrationReferenceInput[] = accepted.map((ref) => ({
      id: ref.id,
      sceneP1: ref.sceneP1,
      sceneP2: ref.sceneP2,
      confirmedDistance: ref.confirmedDistance,
      confirmedUnit: ref.confirmedUnit,
    }));
    if (refs.length === 0) { setAiCalReviewOpen(false); return commitSucceeded(); }
    const newEff = computeEffectiveCalibration(refs, workingUnit);

    // 2. Old effective scale the current materialised values were drawn with.
    const oldScale = calibrations.length > 0 ? effectiveScaleFromLegacyCalibrations(calibrations) : null;

    // 3. Collect THIS page's records only (same hydration filter as the save path).
    const pageId = pages[currentPageIndex]?.id ?? null;
    const pageMeasurements = componentMeasurements.flatMap((c) => c.measurements)
      .filter((m) => !m.fromPageId || !pageId || m.fromPageId === pageId);
    const pageRoofAreas = roofAreas.filter((a) => !a.fromPageId || !pageId || a.fromPageId === pageId);

    // 4. Deterministic recompute. Preflight errors block - never a partial apply.
    const result = computeCalibrationRecompute({
      measurements: pageMeasurements.map((m) => ({
        id: m.id,
        type: m.type,
        value: m.value,
        points: m.points ?? null,
        entryInputs: m.entryInputs ?? null,
        quoteRoofAreaId: m.quoteRoofAreaId ?? null,
      })),
      roofAreas: pageRoofAreas.map((a) => ({
        id: a.id,
        points: a.points,
        area: a.area,
        pitch: a.pitch,
        quoteRoofAreaId: a.quoteRoofAreaId ?? null,
      })),
      oldScale,
      newCalibration: newEff,
    });
    if (!result.ok) {
      showAlert(
        'Calibration not applied',
        `${result.errors.length} measurement(s) on this page could not be rescaled. First issue: ${result.errors[0].message}. Resolve or remove them, then try again.`,
        'error',
      );
      return commitFailed('RECOMPUTE_BLOCKED', 'One or more measurements could not be rescaled, so the calibration was not applied.');
    }

    // 5. Snapshot prior state for rollback, then apply in one in-session update.
    const prevCalibrations = calibrations;
    const prevConfirmed = calibrationConfirmed;
    const prevComponents = componentMeasurements;
    const prevRoofAreas = roofAreas;
    // P0-7: snapshot the durable in-memory metadata entry BEFORE staging the
    // new one, so a failed commit can restore it. Without this, a later
    // ordinary save would persist metadata from a calibration the user was
    // told had failed.
    const prevMetaSnapshot = pageId ? snapshotMetadataEntry(aiCalMetadataRef.current, pageId) : null;
    pushHistorySnapshot();
    const legacy = accepted.map((ref) => {
      const pixelDistance = Math.hypot(ref.sceneP2.x - ref.sceneP1.x, ref.sceneP2.y - ref.sceneP1.y);
      const dist = convertToWorkingUnit(ref.confirmedDistance, ref.confirmedUnit, workingUnit);
      return {
        id: ref.id,
        point1: { ...ref.sceneP1 },
        point2: { ...ref.sceneP2 },
        pixelDistance,
        actualDistance: dist,
        unit: (workingUnit === 'meters' ? 'meters' : 'feet') as 'feet' | 'meters',
        scale: dist / pixelDistance,
      };
    });
    // P4 (spec 11.1): versioned envelope for takeoff_pages.calibration_metadata,
    // persisted alongside the legacy array on commit. P0-6: imageRevision is
    // ALWAYS the authoritative server content-digest revision (from the search
    // response; fallback to the hydrated row). The server independently
    // re-stamps takeoff_pages.image_revision on save - a client-fabricated
    // revision is never written. The non-empty fallback only applies if a
    // commit somehow runs without any server response and the row has no
    // stored revision (pre-migration); it is clearly marked, and the hydration
    // trust gate ignores such envelopes once a real revision is known.
    const envelopeRevision =
      commitContext?.serverImageRevision ?? aiCalPageServerRevision ?? 'server-revision-unavailable';
    const calMetadata = encodeCalibrationMetadata({
      accepted,
      workingUnit,
      imageRevision: envelopeRevision,
      savedAt: new Date().toISOString(),
    });
    if (pageId) aiCalMetadataRef.current.set(pageId, calMetadata);
    // P0-4: the review panel stays open until persistence succeeds; on
    // failure COMMIT_FAILED returns the reducer to reviewing with the
    // accepted references preserved (retry save without a new AI search).
    setCalibrations(legacy);
    setCalibrationConfirmed(true);
    setShowCalibrationHelp(false);
    const updateById = new Map(result.measurementUpdates.map((u) => [u.id, u]));
    // 6.4: persist recomputation provenance - where the recompute resolved a
    // dependent entry to a unique source geometry, stamp source_geometry_id
    // onto entryInputs so it rides entry_inputs into the atomic save and the
    // native column, and future recalibrations need not re-infer it.
    const provenanceById = new Map(result.provenance.map((p) => [p.measurementId, p]));
    setComponentMeasurements(componentMeasurements.map((c) => ({
      ...c,
      measurements: c.measurements.map((m) => {
        const u = updateById.get(m.id);
        if (!u) return m;
        // Attached entries: refresh the plan_value snapshot too (spec 10.3).
        const withPlan = u.planValue !== undefined && m.entryInputs
          ? { ...m, value: u.value, entryInputs: { ...m.entryInputs, plan_value: u.planValue } }
          : { ...m, value: u.value };
        return stampSourceProvenance(withPlan, provenanceById.get(m.id));
      }),
    })));
    setRoofAreas(roofAreas.map((ra) => {
      const u = result.roofAreaUpdates.find((x) => x.id === ra.id);
      return u ? { ...ra, area: u.area } : ra;
    }));
    setIsDirty(true);

    // 6. Persist via the existing save mechanism with a REQUIRED calibration
    // commit; a failure surfaces COMMIT_FAILED and rolls the session back.
    const rollback = (reason: string): CalibrationCommitResult => {
      setCalibrations(prevCalibrations);
      setCalibrationConfirmed(prevConfirmed);
      setComponentMeasurements(prevComponents);
      setRoofAreas(prevRoofAreas);
      setIsDirty(true);
      // P0-7: restore the previous durable metadata entry so a later ordinary
      // save persists the OLD metadata, never the failed calibration's.
      if (pageId && prevMetaSnapshot) restoreMetadataEntry(aiCalMetadataRef.current, prevMetaSnapshot);
      showAlert('Calibration not saved', reason, 'error');
      return commitFailed('COMMIT_FAILED', reason);
    };

    const closeReviewPanel = () => {
      setAiCalReviewOpen(false);
      setAiCalSessionLive(false);
    };

    if (pageMeasurements.length === 0 && pageRoofAreas.length === 0) {
      // Calibration-only commit: the measurement save path safe-skips empty
      // pages, so persist the page calibration directly (verified, fatal).
      if (!pageId) {
        return rollback('COMMIT_FAILED: no takeoff page exists for this plan yet. Draw the calibration again after the page is created.');
      }
      const res = await takeoffActions.persistPageCalibration(quote.id, pageId, legacy, calMetadata);
      if (!res.success) {
        return rollback(`COMMIT_FAILED: ${res.error}`);
      }
      pageCalibrationsRef.current.set(pageId, legacy.map((c) => ({ ...c })));
      closeReviewPanel();
      return commitSucceeded();
    }

    const saved = await persistTakeoffData({ requireCalibrationCommit: true });
    if (!saved) {
      return rollback('COMMIT_FAILED: the takeoff could not be saved with the new calibration. Prior measurements and scale were restored - try saving again.');
    }
    if (pageId) {
      pageCalibrationsRef.current.set(pageId, legacy.map((c) => ({ ...c })));
    }
    closeReviewPanel();
    return commitSucceeded();
  }, [calibrations, calibrationConfirmed, componentMeasurements, roofAreas, pages, currentPageIndex, quote.id, aiCalPageServerRevision]);

  const handleStartCalibration = () => {
    cleanupBoxDrag();
    // 6.2 draft-until-commit: recalibrating no longer destroys the committed
    // calibration, its confirmation or its metadata envelope up front. The
    // committed set stays authoritative for display and measurements until a
    // new draft is confirmed; Cancel discards the draft only.
    if (calibrationConfirmed) {
      draftCalibrationRef.current = startDraftRecalibration(calibrations);
    }
    setCalibrationMode(true);
    setCalibrationPoints([]);
    setAreaMode(false);
    setAreaPoints([]);
  };

  const handleConfirmCalibration = () => {
    pushHistorySnapshot();
    // 6.2: confirming promotes the draft to committed (calibrations in state
    // already hold the draft set) and invalidates any stale versioned metadata
    // envelope for this page - a fresh commit writes a new one.
    if (draftCalibrationRef.current) {
      draftCalibrationRef.current = null;
      const pid = pages[currentPageIndex]?.id;
      if (pid) aiCalMetadataRef.current.delete(pid);
    }
    console.log('[Calibration] Confirming... current state:', { calibrationConfirmed, showConfirmedFlash });
    setCalibrationConfirmed(true);
    setShowConfirmedFlash(true);
    setCalibrationMode(false); // Turn off calibration mode!
    // UX-2: exact pixels-per-unit stays in the debug console only.
    console.debug(
      '[Calibration] effective scale (debug)',
      effectiveScaleFromLegacyCalibrations(calibrations).toFixed(6),
      `${calibrations[0]?.unit ?? 'm'}/px from`,
      calibrations.length,
      'measurement(s)',
    );
    
    // Remove all calibration lines and markers from canvas
    if (fabricRef.current) {
      const objects = fabricRef.current.getObjects();
      const calibrationObjects = objects.filter(obj => 
        obj.stroke === '#facc15' || // Yellow lines
        (obj.fill === '#facc15' && obj.get('type') === 'circle') // Yellow markers
      );
      console.log('[Calibration] Removing', calibrationObjects.length, 'calibration objects');
      calibrationObjects.forEach(obj => fabricRef.current!.remove(obj));
      fabricRef.current.renderAll();
    }
    
    console.log('[Calibration] State updated to confirmed, lines removed');
    // Hide calibration section after 0.5s flash
    setTimeout(() => {
      console.log('[Calibration] Hiding flash, confirmed should stay true');
      setShowConfirmedFlash(false);
    }, 500);
  };

  const handleCancelCalibration = () => {
    // 6.2: cancel discards the DRAFT only; the committed calibration (never
    // cleared when recalibration started) remains authoritative.
    if (draftCalibrationRef.current) {
      setCalibrations(cancelDraftRecalibration(draftCalibrationRef.current) as Calibration[]);
      draftCalibrationRef.current = null;
    }
    setCalibrationMode(false);
    setCalibrationPoints([]);
    setShowCalibrationModal(false);
    
    // Remove temp line + calibration markers (yellow objects without measurementId)
    if (fabricRef.current) {
      if (tempCalibrationLine) {
        fabricRef.current.remove(tempCalibrationLine);
        setTempCalibrationLine(null);
      }
      // Remove calibration markers (yellow circles without measurementId)
      fabricRef.current.getObjects().slice().forEach((obj: any) => {
        if (!obj.measurementId && obj.fill === '#facc15') {
          fabricRef.current!.remove(obj);
        }
      });
      fabricRef.current.requestRenderAll();
    }
  };

  const handleSaveCalibration = (actualDistance: number, unit: 'feet' | 'meters', addAnother: boolean) => {
    pushHistorySnapshot();
    if (calibrationPoints.length !== 2) return;
    
    const [point1, point2] = calibrationPoints;
    const dx = point2.x - point1.x;
    const dy = point2.y - point1.y;
    const pixelDistance = Math.sqrt(dx * dx + dy * dy);
    const scale = actualDistance / pixelDistance;
    
    const newCalibration: Calibration = {
      id: `cal-${Date.now()}`,
      point1,
      point2,
      pixelDistance,
      actualDistance,
      unit,
      scale,
    };
    
    let updatedCalibrations: Calibration[];
    if (draftCalibrationRef.current) {
      // 6.2: the first draft save replaces the committed set on screen;
      // further drafts append, matching the original manual flow.
      const applied = applyDraftCalibration(draftCalibrationRef.current, calibrations, newCalibration);
      draftCalibrationRef.current = applied.draft;
      updatedCalibrations = applied.calibrations;
    } else {
      updatedCalibrations = [...calibrations, newCalibration];
    }
    setCalibrations(updatedCalibrations);
    
    setActiveCalibrationId(newCalibration.id);
    
    setCalibrationPoints([]);
    setShowCalibrationModal(false);
    
    // Prompt for another calibration if < 3 and user wants
    if (addAnother && updatedCalibrations.length < 3) {
      setCalibrationMode(true);
    } else {
      setCalibrationMode(false);
    }
  };

  // Offcuts V1 snapshots the same live scene geometry as the workstation.
  // Null page stamps are legacy/current-page rows; the adapter rejects explicit
  // foreign page/area stamps. Scope is the ACTIVE estimating area only in V1.
  // (Integration note 2026-09-29: assignment runs in a no-deps effect so the
  // ref stays current after every render while honouring react-hooks/refs.)
  const offcutsLiveSnapshotRef = useRef<QuoteCoreSnapshot | null>(null);
  const offcutsModalRef = useRef<WorkbenchHandle | null>(null);
  useEffect(() => {
    offcutsLiveSnapshotRef.current = {
      quoteId: quote.id,
      pageId: pages[currentPageIndex]?.id ?? '',
      areaScopeId: activeAreaId,
      imageRevision: touchOutlineLiveRef.current?.pageImageRevision ?? offcutFingerprint({
        pageId: pages[currentPageIndex]?.id,
        image: pages[currentPageIndex]?.url ?? planUrl,
        dimensions: canvasDims,
      }),
      imageUrl: pages[currentPageIndex]?.url ?? planUrl,
      width: canvasDims.width,
      height: canvasDims.height,
      calibrationConfirmed,
      calibrations,
      roofAreas,
      components,
      componentMeasurements,
      // Exact registry resolution only. Custom library components that do not
      // retain their semantic meaning need an explicit map in the main repo.
      semanticByComponentId: Object.fromEntries(components.flatMap(component => {
        const key = resolveSemanticKey(component.name);
        if (!key) return [];
        const singular = {
          ridges: 'ridge', hips: 'hip', valleys: 'valley', broken_hips: 'broken_hip',
          barges: 'barge', spouting: 'spouting', uncertain: 'unknown',
        } as const;
        return [[component.id, singular[key]]];
      })),
    };
  });
  useEffect(() => () => {
    offcutsModalRef.current?.destroy();
    offcutsModalRef.current = null;
  }, [pages[currentPageIndex]?.id, activeAreaId]);

  return (
    <QcHostedDialogScope enabled={desktopAppearance}>
    <StorageBlockedModal open={storageBlocked} onClose={() => setStorageBlocked(false)} />
    <div data-qc-ui={desktopAppearance ? 'v2' : undefined}
      data-qc-component={desktopAppearance ? 'C54' : undefined}
      data-qc-takeoff={desktopAppearance ? 'desktop' : 'legacy-hidden'}
      className={`-my-8 h-[calc(120vh-116px)] bg-gray-50 text-gray-900 flex flex-col p-2 md:p-4 overflow-hidden ${desktopAppearance ? 'qc-takeoff-workstation' : ''}`}>
      <div className="qc-takeoff-surface flex-1 flex flex-col bg-white rounded-xl shadow-lg overflow-hidden min-h-0">
        <header className="qc-takeoff-header">
          <div className="qc-takeoff-identity">
            <Link href={`/${workspaceSlug}/quotes/${quote.id}`} className="qc-takeoff-back"
              aria-label="Back to quote" title="Back to quote"><QcIcon name="back" /></Link>
            <div>
              <span className="qc-takeoff-eyebrow">Digital takeoff</span>
              <h1>{quote.customer_name}</h1>
            </div>
          </div>
          <div className="qc-takeoff-header-actions">
            <QcHostedButton onClick={openSaveAndUploadAnotherPlan}
              disabled={isSaving || isUploadingPage} size="sm" className="qc-takeoff-upload"
              title={isSaving || isUploadingPage ? 'Please wait - saving in progress' : 'Save current measurements, then upload a new plan to keep measuring'}>
              <QcIcon name="upload" />{isSaving || isUploadingPage ? 'Saving…' : 'Upload another plan'}
            </QcHostedButton>
            <div className="qc-takeoff-finish">
              <QcHostedButton onClick={handleSaveTakeoff}
                disabled={calibrations.length === 0 || isSaving}
                data-copilot="takeoff-save" variant="primary" size="sm" aria-busy={isSaving}
                className="qc-takeoff-finish-btn"
                title={calibrations.length === 0 ? 'Calibrate the plan first' : 'Save and continue to Measurements & Pricing'}>
                <span className="qc-takeoff-finish-main">{isSaving ? 'Saving…' : 'Finish & save'}<QcIcon name="arrow" /></span>
                <span className="qc-takeoff-finish-next">Next: Measurements &amp; Pricing</span>
              </QcHostedButton>
            </div>
          </div>
        </header>

      {/* Plan indicator + dynamic tool guidance bar */}
      {(() => {
        const selCompType = selectedComponentId
          ? (components.find(c => c.id === selectedComponentId)?.measurement_type as string ?? null)
          : null;
        let guidance: string | null = null;
        if (calibrationMode) {
          guidance = 'Click two points that represent a known distance, then enter that distance.';
        } else if (areaMode) {
          if (areaSubTool === 'rect') {
            if (!selectedComponentId && roofAreas.length > 0) {
              guidance = 'Click and drag a rectangle. Release to set the area';
            } else if (selCompType === 'volume_3d') {
              guidance = 'Click and drag to draw the footprint (L × W). Release to set the area, then enter the depth.';
            } else {
              guidance = 'Click and drag a rectangle. Release to set the area.';
            }
          } else {
            if (!selectedComponentId) {
              guidance = 'Click at least three points. Click the first point again to close the area';
            } else if (selCompType === 'volume_3d') {
              guidance = 'Draw the footprint (L × W). Close the shape on the first point, then enter the depth in the prompt.';
            } else {
              guidance = 'Click at least three points. Click the first point again to close the area.';
            }
          }
        } else if (lineMode) {
          guidance = 'Click two points to measure a length - confirm. Add multiple lines for the same component.';
        } else if (multiLinealMode) {
          guidance = 'Click to trace a path with multiple segments. Double-click or press Finish to complete.';
        } else if (pointMode) {
          guidance = 'Click on the plan to count this item. Each click adds one.';
        }
        // Owner 2026-09-25 (13:20): stage-aware next-step tips whenever no
        // drawing tool is armed - each phase hints what to do next.
        if (!guidance) {
          if (aiStagedPageId != null && !aiResults) {
            guidance = 'Drag the blue points to correct the AI outline, then choose your next step in the card.';
          } else if (!calibrationConfirmed && calibrations.length >= 1) {
            guidance = 'Add another calibration reference for best accuracy, or use this one to start measuring.';
          } else if (!calibrationConfirmed) {
            guidance = 'Set a known distance before measuring this plan.';
          } else if (roofAreas.length === 0 && activeComponentIds.length === 0) {
            guidance = 'Calibrated - trace the roof area next: AI Assist or draw it manually.';
          } else if (activeComponentIds.length === 0) {
            guidance = 'Area measured - now add components: AI scan for components or add them manually.';
          } else {
            guidance = "Add more components, or Finish & save when you're ready for Measurements & Pricing.";
          }
        }
        // Stable status row: never resize the canvas when a drawing tool changes.
        return (
          <div className="qc-takeoff-context">
            <div className="qc-takeoff-plan-context">
              <QcIcon name="file" />
              <span title={pages[currentPageIndex]?.name || 'Current plan'}>{pages[currentPageIndex]?.name || 'Current plan'}</span>
              {pages.length > 1 && <span className="qc-takeoff-page-count">{currentPageIndex + 1} of {pages.length}</span>}
              <QcStatusBadge tone={calibrationMode ? 'warning' : calibrationConfirmed ? 'success' : 'neutral'}>
                {calibrationMode ? 'Calibrating' : calibrationConfirmed ? 'Calibrated' : 'Needs calibration'}
              </QcStatusBadge>
            </div>
            <p className="qc-takeoff-guidance">{guidance}</p>
          </div>
        );
      })()}

      {/* P1-3: Save & Upload another plan modal.
          Mirrors FilesManager Options B (existing area) and C (new area)
          but stays inside the workstation - saves current measurements,
          uploads the new plan, then reloads to mode=new-page with the new page.*/}
      {showUploadAnotherModal && (
        <QcHostedDialog label="Upload another plan or image" size="md" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-2 md:p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-1">Upload another plan or image</h2>
              <p className="text-sm text-slate-500 mb-5">
                We’ll save your current measurements first, then load the new plan so you can keep measuring.
              </p>

              {/* Option 1: attach to existing area (dropdown) */}
              <label
                className={`w-full text-left p-4 rounded-xl border-2 mb-3 transition-colors cursor-pointer block ${
                  uploadAnotherTarget === 'existing'
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="uploadAnotherTarget"
                    checked={uploadAnotherTarget === 'existing'}
                    onChange={() => setUploadAnotherTarget('existing')}
                    className="mt-0.5 w-4 h-4 accent-orange-500"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">Add to existing area</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Keep the new plan with this area. Calibrate it before adding measurements.
                    </p>
                    {uploadAnotherTarget === 'existing' && (
                      <select aria-label="Area for the new plan"
                        value={uploadAnotherAreaId}
                        onChange={e => setUploadAnotherAreaId(e.target.value)}
                        className="mt-2 w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      >
                        <option value="">Select an area…</option>
                        {areaList.map(a => (
                          <option key={a.id} value={a.id}>{a.label}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              </label>

              {/* Option 2: new area (no name upfront - collected after drawing) */}
              <label
                className={`w-full text-left p-4 rounded-xl border-2 mb-3 transition-colors cursor-pointer block ${
                  uploadAnotherTarget === 'new'
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="uploadAnotherTarget"
                    checked={uploadAnotherTarget === 'new'}
                    onChange={() => setUploadAnotherTarget('new')}
                    className="mt-0.5 w-4 h-4 accent-orange-500"
                  />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Create new area for this upload</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Calibrate this plan, then draw and name its area.
                    </p>
                  </div>
                </div>
              </label>

                            <div className="mb-3">
                <label className="block text-xs font-medium text-slate-700 mb-1">Plan / image</label>
                {uploadAnotherFile ? (
                  <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-xs text-slate-700 flex-1 truncate">{uploadAnotherFile.name}</span>
                    <QcHostedButton variant="ghost"
                      type="button"
                      onClick={() => setUploadAnotherFile(null)}
                      className="text-xs text-red-500 hover:text-red-700 flex-shrink-0"
                    >
                      Remove
                    </QcHostedButton>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 w-full px-3 py-2 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-orange-400 transition-colors">
                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs text-slate-500">Choose plan (PDF up to 50 MB or image up to 10 MB)</span>
                    <input aria-label="Choose another plan or image"
                      type="file"
                      accept="image/*,application/pdf"
                      className="sr-only"
                      onChange={async e => {
                        const raw = e.target.files?.[0] || null;
                        e.target.value = '';
                        if (!raw) return;
                        const isPdf = raw.type === 'application/pdf' || /\.pdf$/i.test(raw.name);
                        const limit = isPdf ? 52428800 : 10485760; // PDFs 50 MB, images 10 MB
                        if (raw.size > limit) {
                          setUploadAnotherError(isPdf ? 'PDF exceeds 50 MB limit.' : 'File exceeds 10 MB limit.');
                          return;
                        }
                        const f = await pdfPicker.convertIfNeeded(raw);
                        if (!f) return;
                        setUploadAnotherFile(f);
                        setUploadAnotherError(null);
                      }}
                    />
                  </label>
                )}
              </div>

              {uploadAnotherError && (
                <p className="text-xs text-red-600 mb-3">{uploadAnotherError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <QcHostedButton variant="ghost"
                  type="button"
                  onClick={() => setShowUploadAnotherModal(false)}
                  disabled={isUploadingPage}
                  className="flex-1 py-2.5 text-sm font-medium text-slate-700 border border-slate-300 rounded-full hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </QcHostedButton>
                <QcHostedButton variant="secondary"
                  type="button"
                  onClick={handleConfirmSaveAndUploadAnother}
                  disabled={isUploadingPage}
                  className="flex-1 py-2.5 text-sm font-medium text-white bg-black rounded-full hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  {isUploadingPage ? 'Saving…' : 'Upload plan'}
                </QcHostedButton>
              </div>
            </div>
          </div>
        </QcHostedDialog>
      )}

      <div className="qc-takeoff-body flex-1 overflow-hidden min-h-0 grid grid-cols-[320px_1fr]">
        {/* Left Sidebar - Calibration, Roof Areas & Components */}
        <aside aria-label="Areas and components" className="qc-takeoff-panel bg-white border-r border-gray-200 overflow-y-auto flex flex-col min-h-0" data-copilot="takeoff-sidebar">
          <div className="p-4 space-y-5">

          {/* Calibration Section - Show if: not confirmed, calibration mode, or showing flash */}
          {(!calibrationConfirmed || calibrationMode || showConfirmedFlash) && (
            <div>
              <h2 className="text-sm font-bold mb-3 text-gray-900 uppercase tracking-wide">Calibrate this plan</h2>
              {calibrations.length === 0 ? (
                <div className="qc-takeoff-calibration-hint">
                  Set a known distance to start measuring.
                </div>
              ) : showConfirmedFlash ? (
                /* Flash green confirmation briefly */
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300">
                  <div className="text-green-400 font-bold mb-2 flex items-center gap-1"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m4.5 12.75 6 6 9-13.5" /></svg> Confirmed</div>
                  <div className="text-xs text-gray-600 mb-1">Scale</div>
                  <div className="font-bold text-green-400">
                    Calibration ready
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    Based on {calibrations.length} measurement{calibrations.length > 1 ? 's' : ''}
                  </div>
                </div>
              ) : (
              /* Not confirmed - Show details + Confirm button */
              <div className="space-y-2">
                {/* Average Scale Display */}
                <div className="p-3 rounded-xl bg-white border border-orange-400">
                  <div className="text-xs text-gray-600 mb-1">Scale</div>
                  <div className="font-bold text-gray-700">Calibration ready</div>
                  <div className="text-xs text-gray-600 mt-1">
                    Based on {calibrations.length} measurement{calibrations.length > 1 ? 's' : ''}
                  </div>
                </div>

                {/* Individual Calibrations */}
                {calibrations.map((cal, idx) => (
                  <div key={cal.id} className="p-2 rounded-xl text-sm bg-gray-100">
                    <div className="font-medium">#{idx + 1}: {cal.actualDistance} {cal.unit}</div>
                  </div>
                ))}

                {/* Confirm Button */}
                <QcHostedButton variant="secondary"
                  onClick={handleConfirmCalibration}
                  className="w-full px-3 py-2 bg-black hover:bg-slate-800 text-white rounded-full text-sm font-medium transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
                >
                  <svg className="w-4 h-4 inline -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m4.5 12.75 6 6 9-13.5" /></svg> Confirm Calibration
                </QcHostedButton>
              </div>
              )}
            </div>
          )}

          {/* Batch 3: Area Switcher - left panel shows all areas for the quote.
              Click an area to switch the canvas + component list. */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-900">{quoteIsGeneric ? 'Areas' : 'Roof Areas'}</h2>
                <QcHostedButton variant="ghost"
                  onClick={handleCreateNewArea}
                  disabled={false}
                  className="qc-takeoff-new-area" size="sm"
                  title="Create a new area"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                  New area
                </QcHostedButton>
              </div>
              <div className="space-y-2">
                {areaList.map(area => {
                  const calibUnit = calibrations[0]?.unit || 'feet';
                  const sys = normalizeMeasurementSystem(quote.measurement_system);
                  // Sum ALL roofAreas matching this area so the displayed total
                  // reflects multiple drawn polygons for one area. Match by the
                  // draw-time quoteRoofAreaId stamp first (2026-07-05 fix);
                  // id/label matching kept as legacy fallback.
                  const matchingAreas = roofAreas.filter(ra => ra.quoteRoofAreaId === area.id || ra.id === area.id || ra.name === area.label);
                  const totalArea = matchingAreas.reduce((sum, ra) => sum + (ra.area || 0), 0);
                  let displayValue = totalArea || area.area || 0;
                  let displayUnit: string;
                  if (calibUnit === 'feet' && sys === 'imperial_rs') { displayValue = displayValue / 100; displayUnit = 'RS'; }
                  else if (calibUnit === 'feet') { displayUnit = 'ft'+'\u00b2'; }
                  else { displayUnit = 'm'+'\u00b2'; }
                  const isActive = area.id === activeAreaId;
                  return (
                    <div key={area.id} className="qc-takeoff-area" data-selected={isActive}>
                      <div className="qc-takeoff-area-row">
                        <button type="button" onClick={() => handleSwitchArea(area.id)}
                          className="qc-takeoff-area-select" aria-pressed={isActive} title={area.label}>
                          <span className="qc-takeoff-area-name">{area.label}</span>
                          <span className="qc-takeoff-area-meta">
                            {displayValue > 0 && <span>{displayValue.toFixed(2)} {displayUnit}</span>}
                            {(() => {
                              // Corner readout (2026-09-30): detected external/internal
                              // corner counts for this area's outlines.
                              const ct = cornerTotalsAcross(matchingAreas);
                              return ct.totalCount > 0
                                ? <span>{ct.totalCount} corners: {ct.externalCount} ext / {ct.internalCount} int</span>
                                : null;
                            })()}
                            {isActive && <span className="qc-takeoff-selected-label"><QcIcon name="check" />Active</span>}
                          </span>
                        </button>
                        <div className="qc-takeoff-row-actions">
                          {matchingAreas.length > 0 && <>
                            <button type="button"
                              onClick={(e) => { e.stopPropagation(); handleToggleAreaVisibility(area.id); }}
                              className="qc-takeoff-icon-action" aria-label={`${matchingAreas[0].visible ? 'Hide' : 'Show'} ${area.label}`}
                              aria-pressed={matchingAreas[0].visible} title={matchingAreas[0].visible ? 'Hide area' : 'Show area'}>
                              <QcIcon name="eye" />
                            </button>
                            <button type="button"
                              onClick={(e) => { e.stopPropagation(); handleDeleteArea(area.id); }}
                              className="qc-takeoff-icon-action qc-takeoff-danger" aria-label={`Delete ${area.label}`} title="Delete area">
                              <QcIcon name="trash" />
                            </button>
                          </>}
                        </div>
                      </div>
                      {/* Parent/child plans (2026-07-05): numbered chips, one
                          per plan attached to this area. Click = view that
                          plan's image + drawings. Components stay parent-level. */}
                      {(areaPages[area.id]?.length ?? 0) > 1 && (
                        <div className="qc-takeoff-plan-chips flex items-center gap-1 mt-1.5 flex-wrap">
                          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mr-0.5">Plans</span>
                          {areaPages[area.id].map((pid, i) => {
                            const pIdx = pages.findIndex(p => p.id === pid);
                            const isCurrentChip = isActive && pIdx === currentPageIndex;
                            return (
                              <QcHostedButton variant={isCurrentChip ? 'secondary' : 'ghost'}
                                key={pid}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!isActive) {
                                    handleSwitchArea(area.id, pid);
                                  } else {
                                    handleSwitchPage(pid);
                                  }
                                }}
                                className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold border transition-all ${
                                  isCurrentChip
                                    ? 'bg-slate-900 text-white border-slate-900'
                                    : 'bg-white text-gray-600 border-gray-300 hover:border-orange-300 hover:text-orange-600'
                                }`}
                                aria-pressed={isCurrentChip}
                                aria-label={`View plan ${i + 1} for ${area.label}`}
                                title={`View plan ${i + 1} for ${area.label}`}
                              >
                                {i + 1}
                              </QcHostedButton>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
                {areaList.length === 0 && (
                  <div className="text-sm text-gray-500">
                    {calibrationConfirmed ? 'Click "+ New Area" or draw an area' : 'Calibrate first, then create areas'}
                  </div>
                )}
              </div>
            </div>

          {calibrationConfirmed && (
            <div className="border-t border-gray-200 pt-4">
              <div className="qc-takeoff-section-header">
                <h2 data-copilot="takeoff-components-heading">Components</h2>
                {displayComponents.length > 0 && <QcHostedButton size="sm"
                  className="qc-takeoff-add-component"
                  aria-controls="qc-takeoff-component-library"
                  aria-expanded={componentLibraryOpen}
                  onClick={() => setComponentLibraryOpen(!componentLibraryOpen)}>
                  <QcIcon name="plus" />{componentLibraryOpen ? 'Close' : 'Add component'}
                </QcHostedButton>}
              </div>
              {displayComponents.length === 0 ? (
                <div className="text-sm text-gray-500">No components in library</div>
              ) : (
                <div className="space-y-5">

                  {/* Add Components */}
                  <div id="qc-takeoff-component-library" className="qc-takeoff-library"
                    onFocusCapture={() => setComponentLibraryOpen(true)}
                    hidden={!componentLibraryOpen}>

                    {/* Library selector */}
                    {collections.length > 0 && (
                      <div className="mb-3">
                        <p className="text-[11px] font-medium text-gray-500 mb-1.5">Select Library</p>
                        <select
                          value={selectedLibraryId}
                          onChange={(e) => setSelectedLibraryId(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:border-[#FF6B35] focus:outline-none bg-white text-gray-700"
                          aria-label="Filter components by library"
                        >
                           <option value={ALL_LIBRARIES}>All Components</option>
                          {collections.map((c) => (
                             <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Search field */}
                    <div className="relative mb-3">
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                      <input
                        type="text"
                        aria-label="Search components"
                        placeholder="Search components…"
                        value={componentSearch}
                        onChange={(e) => setComponentSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:border-[#FF6B35] focus:outline-none bg-white text-gray-700 placeholder-gray-400"
                      />
                    </div>

                    {/* Available component list */}
                    {(() => {
                      const available = displayComponents
                        .filter(comp => !activeComponentIds.includes(comp.id))
                        .filter(comp => !comp.is_system)
                        .filter(comp =>
                          selectedLibraryId === ALL_LIBRARIES
                            ? true
                            : (comp.collection_id ?? null) === selectedLibraryId,
                        )
                        .filter(comp =>
                          componentSearch.trim() === ''
                            ? true
                            : comp.name.toLowerCase().includes(componentSearch.toLowerCase()),
                        );
                      if (available.length === 0) {
                        return (
                          <p className="text-xs text-gray-400 py-2">
                            {componentSearch.trim() !== ''
                              ? 'No matches.'
                              : selectedLibraryId === ALL_LIBRARIES
                              ? 'All components are already active.'
                              : 'No components in this library.'}
                          </p>
                        );
                      }
                      return (
                        <div className="space-y-1">
                          {available.map((comp) => (
                            <QcHostedButton variant="ghost"
                              key={comp.id}
                              type="button"
                              onClick={() => handleAddComponent(comp.id)}
                              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-100 hover:border-gray-200 bg-white transition-all group text-left"
                              aria-label={`Add ${comp.name}`}
                            >
                              <div className="flex-1 min-w-0">
                                <span className="text-sm text-gray-700 group-hover:text-gray-900 block">{comp.name}</span>
                                {selectedLibraryId === ALL_LIBRARIES && comp.collection_id && (
                                  <span className="text-xs text-gray-400">{collections.find(c => c.id === comp.collection_id)?.name ?? ''}</span>
                                )}
                              </div>
                              <span
                                className="w-6 h-6 flex items-center justify-center rounded-full text-sm font-bold transition-all flex-shrink-0 border-2 border-[#FF6B35] text-[#FF6B35] group-hover:bg-[#FF6B35] group-hover:text-white"
                                aria-hidden="true"
                              >
                                +
                              </span>
                            </QcHostedButton>
                          ))}
                        </div>
                      );
                    })()}

                    {/* Info tip */}
                    <div className="mt-4 p-3 bg-blue-50 rounded-xl flex items-start gap-2">
                      <svg className="flex-shrink-0 mt-0.5 text-blue-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                      <p className="text-xs text-gray-500 italic">Choose a component, then measure on the plan. The matching tool is selected for you.</p>
                    </div>
                  </div>

                  {/* Active Components */}
                  {activeComponentIds.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="qc-takeoff-section-caption">Active in this area</span>
                        <span className="text-[11px] font-bold bg-gray-200 text-gray-600 rounded-full px-2 py-0.5">{activeComponentIds.length}</span>
                      </div>
                      <div className="space-y-2">
                        {activeComponentIds.map((id) => {
                          const comp = displayComponents.find(c => c.id === id);
                          if (!comp) return null;
                          const assignment = componentColors.find(c => c.componentId === id);
                          const compData = componentMeasurements.find(c => c.componentId === id);
                          const isSelected = selectedComponentId === comp.id;
                          const mt = (comp.measurement_type ?? comp.default_measurement_type ?? '').toLowerCase();
                          const typeLabel = mt === 'line' ? 'Line' : mt === 'area' ? 'Area' : mt === 'point' ? 'Count' : mt === 'multi_lineal' ? 'Multi-line' : mt === 'multi_lineal_lxh' ? 'Multi-line × height' : mt === 'volume_3d' ? 'Volume' : mt === 'length_x_height_freestyle' ? 'Length × height' : mt === 'multi_lineal_lxh_freestyle' ? 'Multi-line × height' : mt || '';
                          if (!isSelected) {
                            // Owner 2026-09-25 (12:34): unselected active
                            // components collapse to ONE faded line - colour
                            // + name + type/count. Click selects + expands to
                            // the full card; only the selected one dominates.
                            return (
                              <button type="button" key={comp.id} className="qc-takeoff-component-compact"
                                onClick={() => { setSelectedComponentId(comp.id); applyToolForType(mt, comp.id); }}
                                aria-label={`Select ${comp.name}`}>
                                <span className="qc-takeoff-component-compact-dot" style={{ backgroundColor: assignment?.color || '#94a3b8' }} />
                                <span className="qc-takeoff-component-compact-name">{comp.name}</span>
                                <span className="qc-takeoff-component-compact-meta">
                                  {typeLabel || 'Measurement'}
                                  {compData && compData.measurements.length > 0 ? ` · ${compData.measurements.length} measurement${compData.measurements.length === 1 ? '' : 's'}` : ''}
                                </span>
                              </button>
                            );
                          }
                          return (
                            <div key={comp.id} className="qc-takeoff-component" data-selected={isSelected}>
                              <div className="flex">
                                <div className="qc-takeoff-component-colour w-1.5 flex-shrink-0" style={{ backgroundColor: assignment?.color || '#94a3b8' }} />
                                <div className="qc-takeoff-component-body flex-1 min-w-0 p-3">
                                  <div className="qc-takeoff-component-header">
                                    <button type="button" className="qc-takeoff-component-select" aria-pressed={isSelected}
                                      onClick={() => {
                                      // Owner 2026-09-25 (12:34): clicking the selected header
                                      // collapses it back to the compact row (deselect).
                                      if (isSelected) { setSelectedComponentId(null); return; }
                                      setSelectedComponentId(comp.id);
                                      // P1-2: auto-switch tool when clicking an active component.
                                      // Pass comp.id so activeAreaComponentIdRef is set synchronously.
                                      applyToolForType(mt, comp.id);
                                    }}>
                                      <span className="qc-takeoff-component-name">{comp.name}
                                        {isSelected && <span className="qc-takeoff-selected-label"><QcIcon name="check" />Selected</span>}
                                      </span>
                                      <span className="qc-takeoff-component-meta">{typeLabel || 'Measurement'}
                                        {compData && compData.measurements.length > 0 && <> · {compData.measurements.length} measurement{compData.measurements.length === 1 ? '' : 's'}</>}
                                      </span>
                                    </button>
                                    <button type="button"
                                      onClick={(e) => {
                                          e.stopPropagation();
                                          handleRemoveComponent(comp.id);
                                        }}
                                      className="qc-takeoff-icon-action qc-takeoff-danger" aria-label={`Remove ${comp.name}`} title="Remove component">
                                      <QcIcon name="trash" />
                                    </button>
                                  </div>
                                  {compData && compData.measurements.length > 0 && (
                                    <button type="button"
                                      onClick={(e) => {
                                            e.stopPropagation();
                                            setComponentMeasurements(componentMeasurements.map(c =>
                                              c.componentId === id ? { ...c, expanded: !c.expanded } : c
                                            ));
                                          }}
                                      className="qc-takeoff-measurement-disclosure" aria-expanded={compData.expanded}
                                      aria-controls={`takeoff-measurements-${comp.id}`}>
                                      {compData.expanded ? 'Hide measurements' : 'Show measurements'}
                                      <QcIcon name="chevron" />
                                    </button>
                                  )}

                                  {/* Use an existing roof area as this component's entry
                                      (area-type components only; requires at least
                                      one drawn roof area). Adds the area's plan area
                                      as a normal entry stamped with that area - the
                                      report pitches/prices it like a hand-drawn one.
                                      Ported from free roof takeoff 2026-08-30. */}
                                  {mt === 'area' && roofAreas.length > 0 && (
                                    <div className="mt-2">
                                      <select
                                        onChange={(e) => {
                                          if (e.target.value) {
                                            handleApplyRoofAreaToComponent(comp.id, e.target.value);
                                            e.target.value = '';
                                          }
                                        }}
                                        defaultValue=""
                                        aria-label={`Use an existing area for ${comp.name}`}
                                        className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300 focus:border-orange-500 focus:outline-none bg-white text-gray-700"
                                      >
                                        <option value="">Use an existing area…</option>
                                        {roofAreas.map(ra => (
                                          <option key={ra.id} value={ra.id}>
                                            {ra.name} · {(ra.area * (ra.pitch ? rafterPitchFactor(ra.pitch) : 1)).toFixed(1)} {calibrations[0]?.unit === 'feet' ? 'ft²' : 'm²'}{ra.pitch ? ` (pitch ${Math.round(ra.pitch)}°)` : ''}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  )}

                                  {/* Corner counting (2026-09-30): count-based
                                      components reuse detected corner counts
                                      (all / external / internal) - one pick,
                                      one entry, priced rate x count. */}
                                  {POINT_LIKE_MT.has(mt) && roofAreas.length > 0 && (() => {
                                    const ct = cornerTotalsAcross(roofAreas);
                                    if (ct.totalCount === 0) return null;
                                    return (
                                      <div className="mt-2">
                                        <select
                                          onChange={(e) => {
                                            if (e.target.value) {
                                              handleApplyCornerCountToComponent(comp.id, e.target.value as CornerBasis);
                                              e.target.value = '';
                                            }
                                          }}
                                          defaultValue=""
                                          aria-label={`Use roof corners for ${comp.name}`}
                                          className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300 focus:border-orange-500 focus:outline-none bg-white text-gray-700"
                                        >
                                          <option value="">Use roof corners...</option>
                                          <option value="all">All corners ({ct.totalCount})</option>
                                          <option value="external">External corners ({ct.externalCount})</option>
                                          <option value="internal">Internal corners ({ct.internalCount})</option>
                                        </select>
                                      </div>
                                    );
                                  })()}

                                  {/* AI Placeholder: Attach real component */}
                                  {comp.is_system && compData && compData.measurements.length > 0 && (
                                    <div className="qc-takeoff-needs-component mt-2">AI measurement · Needs component</div>
                                  )}
                                  {comp.is_system && compData && compData.measurements.length > 0 && (() => {
                                    const semanticKey = resolveSemanticKey(comp.name);
                                    if (!semanticKey) return null;
                                    // Show ALL non-system components so the user has full library access
                                    const compatibleComps = displayComponents
                                      .filter(c => !c.is_system);
                                    if (compatibleComps.length === 0) return <p className="text-xs text-gray-500 mt-2">No library components are available to attach. Add a component to your library, then return here.</p>;
                                    return (
                                      <div className="mt-2 mb-1">
                                        <select
                                          onChange={(e) => {
                                            if (e.target.value) {
                                              handleReplacePlaceholder(comp.id, e.target.value);
                                              e.target.value = '';
                                            }
                                          }}
                                          defaultValue=""
                                          aria-label={`Attach a component to ${comp.name}`}
                                          className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300 focus:border-orange-500 focus:outline-none bg-white text-gray-700"
                                        >
                                          <option value="">Attach component…</option>
                                          {compatibleComps.map(c => (
                                            <option key={c.id} value={c.id}>
                                              {c.name}{activeComponentIds.includes(c.id) ? ' (already active - merge)' : ''}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    );
                                  })()}

                                  {/* Measurements list (expanded) */}
                                  {compData && compData.expanded && compData.measurements.length > 0 && (
                                    <div id={`takeoff-measurements-${comp.id}`} className="qc-takeoff-measurement-details mt-2 pt-2 border-t border-gray-100">
                                      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Measurements{typeLabel ? ` (${typeLabel})` : ''}</div>
                                      <div className="space-y-1">
                                        {compData.measurements.map((m) => (
                                          <div
                                            key={m.id}
                                            className="qc-takeoff-measurement-row flex items-center gap-1.5 text-xs text-gray-700"
                                            onMouseEnter={() => {
                                              const canvas = fabricRef.current;
                                              if (!canvas || !m.canvasObjects) return;
                                              m.canvasObjects.forEach((obj: any) => {
                                                if (!obj.visible) return;
                                                obj._origStrokeWidth = obj.strokeWidth;
                                                obj.set('strokeWidth', (obj.strokeWidth || 2) + 4);
                                                if (obj.selectable !== false) {
                                                  obj._origBorderColor = obj.borderColor;
                                                  obj.set('borderColor', '#FF6B35');
                                                }
                                              });
                                              canvas.renderAll();
                                            }}
                                            onMouseLeave={() => {
                                              const canvas = fabricRef.current;
                                              if (!canvas || !m.canvasObjects) return;
                                              m.canvasObjects.forEach((obj: any) => {
                                                if (obj._origStrokeWidth !== undefined) {
                                                  obj.set('strokeWidth', obj._origStrokeWidth);
                                                  delete obj._origStrokeWidth;
                                                }
                                                if (obj._origBorderColor !== undefined) {
                                                  obj.set('borderColor', obj._origBorderColor);
                                                  delete obj._origBorderColor;
                                                }
                                              });
                                              canvas.renderAll();
                                            }}
                                          >
                                            <span className="flex-1">
                                              {(m.type === 'line' || m.type === 'multi_lineal') && `${m.value.toFixed(2)} ${calibrations[0]?.unit || 'ft'}`}
                                              {m.type === 'multi_lineal_lxh' && `${m.value.toFixed(2)} ${calibrations[0]?.unit || 'ft'} ×-h`}
                                              {m.type === 'area' && `${m.value.toFixed(2)} sq ${calibrations[0]?.unit || 'ft'}`}
                                              {m.type === 'point' && `${m.value.toFixed(0)} item${Math.abs(m.value - 1) > 0.001 ? 's' : ''}${isCornerValueBasis(m.entryInputs?.value_basis) ? ' - corners' : ''}`}
                                              {(m.type === 'length_x_height_freestyle' || m.type === 'multi_lineal_lxh_freestyle') && `${m.value.toFixed(2)} ${calibrations[0]?.unit || 'ft'} ×-h`}
                                              {m.type === 'volume_3d' && `${m.value.toFixed(2)} sq ${calibrations[0]?.unit || 'ft'}`}
                                            </span>
                                            <QcHostedButton aria-label={m.visible ? 'Hide measurement' : 'Show measurement'} aria-pressed={m.visible} variant="ghost"
                                              onClick={() => handleToggleMeasurementVisibility(id, m.id)}
                                              className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
                                              title={m.visible ? 'Hide' : 'Show'}
                                            >
                                              {m.visible ? (
                                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                              ) : (
                                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"/></svg>
                                              )}
                                            </QcHostedButton>
                                            <QcHostedButton variant="ghost"
                                              onClick={() => handleDeleteMeasurement(id, m.id)}
                                              className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors text-base leading-none"
                                              aria-label={`Delete measurement for ${comp.name}`}
                                              title="Delete measurement"
                                            >
                                              <QcIcon name="close" />
                                            </QcHostedButton>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Uncertain AI detections - pink, deletable, for manual review */}
                  {(() => {
                    // Uncertain AI detections now carry componentId === null and are
                    // grouped under the explicit '__review__uncertain' key.
                    const uncertainData = componentMeasurements.find(c => c.componentId === '__review__uncertain');
                    if (!uncertainData || uncertainData.measurements.length === 0) return null;
                    return (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-[11px] font-semibold text-pink-600 uppercase tracking-wider">Uncertain (AI - needs review)</span>
                          <span className="text-[11px] font-bold bg-pink-100 text-pink-700 rounded-full px-2 py-0.5">{uncertainData.measurements.length}</span>
                        </div>
                        <div className="bg-white rounded-xl border border-pink-200 overflow-hidden">
                          <div className="flex">
                            <div className="w-1.5 flex-shrink-0" style={{ backgroundColor: '#EC4899' }} />
                            <div className="flex-1 min-w-0 p-3">
                              <div className="text-[10px] text-pink-600 mb-1.5">Lines the AI could not confidently classify. Check the plan, delete any that are wrong, and draw the correct component manually.</div>
                              <div className="space-y-1">
                                {uncertainData.measurements.map((m) => (
                                  <div key={m.id}>
                                  <div
                                    className="flex items-center gap-1.5 text-xs text-gray-700 rounded-lg px-1.5 -mx-1.5 hover:bg-pink-50 transition-colors cursor-default"
                                    onMouseEnter={() => {
                                      const canvas = fabricRef.current;
                                      if (!canvas || !m.canvasObjects) return;
                                      m.canvasObjects.forEach((obj: any) => {
                                        if (!obj.visible) return;
                                        obj._origStrokeWidth = obj.strokeWidth;
                                        obj.set('strokeWidth', (obj.strokeWidth || 2) + 4);
                                        if (obj.selectable !== false) {
                                          obj._origBorderColor = obj.borderColor;
                                          obj.set('borderColor', '#EC4899');
                                        }
                                      });
                                      canvas.renderAll();
                                    }}
                                    onMouseLeave={() => {
                                      const canvas = fabricRef.current;
                                      if (!canvas || !m.canvasObjects) return;
                                      m.canvasObjects.forEach((obj: any) => {
                                        if (obj._origStrokeWidth !== undefined) {
                                          obj.set('strokeWidth', obj._origStrokeWidth);
                                          delete obj._origStrokeWidth;
                                        }
                                        if (obj._origBorderColor !== undefined) {
                                          obj.set('borderColor', obj._origBorderColor);
                                          delete obj._origBorderColor;
                                        }
                                      });
                                      canvas.renderAll();
                                    }}
                                  >
                                    <span className="flex-1">
                                      {m.type === 'line' && `${m.value.toFixed(2)} ${calibrations[0]?.unit || 'ft'}`}
                                      {m.type === 'area' && `${m.value.toFixed(2)} sq ${calibrations[0]?.unit || 'ft'}`}
                                      {m.type !== 'line' && m.type !== 'area' && '1 item'}
                                    </span>
                                    <QcHostedButton variant="ghost"
                                      onClick={() => setUncertainAssignOpenFor(open => open === m.id ? null : m.id)}
                                      className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-orange-50 text-gray-400 hover:text-orange-500 transition-colors text-base leading-none"
                                      aria-label="Add to a component"
                                      title="Add to a component"
                                    >
                                      +
                                    </QcHostedButton>
                                    <QcHostedButton aria-label={m.visible ? 'Hide measurement' : 'Show measurement'} aria-pressed={m.visible} variant="ghost"
                                      onClick={() => handleToggleMeasurementVisibility(uncertainData.componentId ?? '__review__uncertain', m.id)}
                                      className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
                                      title={m.visible ? 'Hide' : 'Show'}
                                    >
                                      {m.visible ? (
                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                      ) : (
                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"/></svg>
                                      )}
                                    </QcHostedButton>
                                    <QcHostedButton variant="ghost"
                                      onClick={() => handleDeleteMeasurement(uncertainData.componentId ?? '__review__uncertain', m.id)}
                                      className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors text-base leading-none"
                                      aria-label="Delete uncertain line"
                                      title="Delete uncertain line"
                                    >
                                      <QcIcon name="close" />
                                    </QcHostedButton>
                                  </div>
                                  {uncertainAssignOpenFor === m.id && (
                                    <select
                                      onChange={(e) => { if (e.target.value) { handleAssignUncertainToComponent(m.id, e.target.value); e.target.value = ''; } }}
                                      defaultValue=""
                                      aria-label="Assign this line to a component"
                                      className="w-full mt-1 px-2 py-1.5 text-xs rounded-lg border border-slate-300 focus:border-orange-500 focus:outline-none bg-white text-gray-700"
                                    >
                                      <option value="">Choose a component…</option>
                                      <optgroup label="AI default components">
                                        {displayComponents.filter(c => c.is_system).map(c => (
                                          <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                      </optgroup>
                                      {/* Owner 2026-09-26: uncertain lines can
                                          be assigned to any component in the
                                          currently selected library (the same
                                          selector used by Add component), not
                                          just the AI defaults. Options are
                                          filtered to components whose
                                          measurement type matches the line. */}
                                      {(() => {
                                        const libName = selectedLibraryId === ALL_LIBRARIES
                                          ? 'All your libraries'
                                          : (collections.find(c => c.id === selectedLibraryId)?.name ?? 'Selected library');
                                        // Owner 2026-09-26: library components
                                        // store 'lineal', never 'line' - the old
                                        // filter matched nothing. 'line' stays
                                        // only as a defensive fallback.
                                        const compatTypes = m.type === 'area' ? ['area', 'irregular_area'] : ['lineal', 'line'];
                                        const isCompat = (c: Component) => !c.is_system
                                          && compatTypes.includes(String(c.measurement_type ?? c.default_measurement_type ?? ''));
                                        const libSelected = displayComponents.filter(c => isCompat(c)
                                          && (selectedLibraryId === ALL_LIBRARIES || (c.collection_id ?? null) === selectedLibraryId));
                                        // Owner 2026-09-26: the selected library
                                        // can exist but hold no components (the
                                        // RS Roofing Standard Library does - the
                                        // real components live in 'My Components'
                                        // and unfiled). Never block the
                                        // assignment: fall back to every
                                        // compatible component the company has.
                                        const libComps = libSelected.length > 0
                                          ? libSelected
                                          : displayComponents.filter(c => isCompat(c));
                                        const shownLibName = libSelected.length > 0 ? libName : 'All your libraries';
                                        return (
                                          <optgroup label={`Your library: ${shownLibName}`}>
                                            {libComps.length === 0
                                              ? <option value="" disabled>No {m.type === 'area' ? 'area' : 'line'} components in this library</option>
                                              : libComps.map(c => (
                                                <option key={c.id} value={c.id}>{c.name}{activeComponentIds.includes(c.id) ? ' (active)' : ''}</option>
                                              ))}
                                          </optgroup>
                                        );
                                      })()}
                                    </select>
                                  )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}


                </div>
              )}
            </div>
          )}

          </div>
          <div className="qc-takeoff-panel-footer"><QcToolButton
onClick={() => setShowResetConfirm(true)}
className="qc-takeoff-reset" title="Discard unsaved changes or clear this takeoff">Reset takeoff…</QcToolButton>
            <span>Discards unsaved work. Confirmation required.</span>
          </div>
        </aside>
        {/* Center - Canvas */}
        <div className="qc-takeoff-canvas-column flex flex-col relative bg-gray-50 overflow-hidden min-h-0">
          {/* Hidden marker: copilot only starts after first roof area created */}
          {roofAreas.length > 0 && <div data-copilot="takeoff-ready" className="hidden" />}

          {/* Top Toolbar */}
              <QcCanvasToolbar className="qc-takeoff-toolbar" data-copilot="takeoff-toolbar">
                <div className="qc-takeoff-toolbar-main">
                  <QcCanvasToolGroup label="Measurement tools"><QcToolButton
                    onClick={() => {
                      if (areaMode) { cleanupBoxDrag(); setAreaMode(false); setAreaPoints([]); }
                      else { setAreaMode(true); setLineMode(false); setPointMode(false); setMultiLinealMode(false); setMultiLinealPoints([]); setMultiLinealSegmentObjects([]); setAreaPoints([]); }
                    }}
                    disabled={calibrationMode || calibrations.length === 0}
                    data-copilot="takeoff-tool-area"
                    title={calibrations.length === 0 ? 'Calibrate first' : 'Measure roof area'}
                    selected={areaMode}><QcIcon name="polygon" />Area</QcToolButton><QcToolButton
                      onClick={() => {
                        const isActive = lineMode || multiLinealMode;
                        if (isActive) { if (multiLinealMode) handleCancelMultiLineal(); cleanupBoxDrag(); setLineMode(false); setMultiLinealMode(false); setLinePoints([]); return; }
                        if (!quoteIsGeneric) { const h = roofAreas.length > 0 && roofAreas.some(a => a.pitch > 0); if (!h) { showAlert('Roof area required', 'Create a roof area with pitch first.', 'info'); return; } }
                        if (!selectedComponentId) { showAlert('Select a component first', 'Pick a component from the list.', 'info'); return; }
                        cleanupBoxDrag(); setAreaMode(false); setPointMode(false);
                        if (lineSubTool === 'multi') { setMultiLinealMode(true); setLineMode(false); setLinePoints([]); }
                        else { setLineMode(true); setMultiLinealMode(false); setMultiLinealPoints([]); setMultiLinealSegmentObjects([]); setLinePoints([]); }
                      }}
                      disabled={calibrationMode || calibrations.length === 0 || (!quoteIsGeneric && (roofAreas.length === 0 || !roofAreas.some(a => a.pitch > 0)))}
                      data-copilot="takeoff-tool-line"
                      title="Measure line or polyline"
                      selected={lineMode || multiLinealMode}><QcIcon name="line" />Line</QcToolButton><QcToolButton
                        onClick={() => {
                          if (!quoteIsGeneric) { const h = roofAreas.length > 0 && roofAreas.some(a => a.pitch > 0); if (!h) { showAlert('Roof area required', 'Create a roof area with pitch first.', 'info'); return; } }
                          if (!selectedComponentId) { showAlert('Select a component first', 'Pick a component from the list.', 'info'); return; }
                          setPointMode(!pointMode); cleanupBoxDrag(); setLineMode(false); setAreaMode(false); setMultiLinealMode(false); setMultiLinealPoints([]); setMultiLinealSegmentObjects([]);
                        }}
                        disabled={calibrationMode || calibrations.length === 0 || (!quoteIsGeneric && (roofAreas.length === 0 || !roofAreas.some(a => a.pitch > 0)))}
                        data-copilot="takeoff-tool-point"
                        title="Add point marker"
                        selected={pointMode}><QcIcon name="point" />Point</QcToolButton></QcCanvasToolGroup>
                  <QcCanvasToolGroup label="Plan setup" className="qc-takeoff-setup-tools"><QcToolButton
                    onClick={() => {
                      // 2026-09-25: chooser removed - Calibrate always starts the
                      // manual flow directly (owner decision).
                      handleStartCalibration();
                    }}
                    data-copilot="takeoff-tool-calibrate"
                    selected={calibrationMode}><QcIcon name="measure" />{calibrationConfirmed ? 'Recalibrate' : 'Calibrate'}</QcToolButton><QcToolButton
                      onClick={() => setShowPitchEstimator(true)}
                      data-copilot="takeoff-tool-pitch-estimator"
                      title="Estimate roof pitch from a photo"
                    ><QcIcon name="pitch" />Estimate pitch</QcToolButton>
                    {process.env.NEXT_PUBLIC_TAKEOFF_OFFCUTS_V1 === 'true' && (
                      <button
                        data-copilot="takeoff-tool-offcuts"
                        className="px-3 py-2 rounded-full text-sm bg-slate-900 text-white disabled:opacity-40"
                        disabled={!calibrationConfirmed || !pages[currentPageIndex]?.id || roofAreas.length === 0 || isSaving}
                        title="Review faces and prototype offcut reuse. Does not change pricing or saved takeoff measurements."
                        onClick={async () => {
                          try {
                            const { launchQuoteCoreOffcuts } = await import('@/app/lib/takeoff/offcuts/ui/launch');
                            offcutsModalRef.current?.destroy();
                            offcutsModalRef.current = launchQuoteCoreOffcuts(() => {
                              const snapshot = offcutsLiveSnapshotRef.current;
                              if (!snapshot) throw new Error('The takeoff workspace is not ready.');
                              // The existing touch bridge refreshes image metadata in
                              // an effect. Read its latest same-page revision at use
                              // time rather than freezing a previous-render revision.
                              const live = touchOutlineLiveRef.current;
                              return {
                                ...snapshot,
                                imageRevision: live?.pageId === snapshot.pageId && live.pageImageRevision
                                  ? live.pageImageRevision
                                  : snapshot.imageRevision,
                              };
                            });
                          } catch (error) {
                            window.alert(error instanceof Error ? error.message : String(error));
                          }
                        }}
                      >Find offcuts (V1)</button>
                    )}</QcCanvasToolGroup>
                </div>
                <div className="qc-takeoff-toolbar-context">
                  <div className="qc-takeoff-subtools">
                    {areaMode ? <QcCanvasToolGroup label="Area drawing mode"><QcToolButton
                      onClick={() => { cleanupBoxDrag(); setAreaSubTool('polygon'); setAreaPoints([]); }}
                      title="Point by point, click first point to close"
                      selected={areaSubTool === 'polygon'}>Polygon</QcToolButton><QcToolButton
                        onClick={() => { cleanupBoxDrag(); setAreaSubTool('rect'); setAreaPoints([]); }}
                        title="Click and drag to create box"
                        selected={areaSubTool === 'rect'}>Rectangle</QcToolButton></QcCanvasToolGroup>
                      : (lineMode || multiLinealMode) ? <QcCanvasToolGroup label="Line drawing mode"><QcToolButton
                        onClick={() => { setLineSubTool('single'); if (multiLinealMode) { handleCancelMultiLineal(); setLineMode(true); } }}
                        title="Two-point line"
                        selected={lineSubTool === 'single'}>Single</QcToolButton><QcToolButton
                          onClick={() => { setLineSubTool('multi'); if (lineMode) { setLineMode(false); setLinePoints([]); setMultiLinealMode(true); } }}
                          title="Multi-point polyline"
                          selected={lineSubTool === 'multi'}>Multi</QcToolButton></QcCanvasToolGroup>
                        : <span>{calibrationMode ? 'Mark a known distance on this plan' : pointMode ? 'Each click counts one item' : 'Choose a drawing tool to begin'}</span>}
                  </div>
                  <div className="qc-takeoff-view-tools">
                    <QcCanvasToolGroup label="History"><QcToolButton
                      onClick={handleUndo}
                      disabled={!history.canUndo || (aiStagedPageId != null && !aiResults)}
                      title="Undo"
                      aria-label="Undo" className="qc-canvas-icon-tool"><QcIcon name="undo" /></QcToolButton><QcToolButton
                        onClick={handleRedo}
                        disabled={!history.canRedo || (aiStagedPageId != null && !aiResults)}
                        title="Redo"
                        aria-label="Redo" className="qc-canvas-icon-tool"><QcIcon name="redo" /></QcToolButton></QcCanvasToolGroup>
                    <QcCanvasToolGroup label="Zoom" className="qc-takeoff-zoom"><QcToolButton
                      onClick={handleZoomOut}
                      aria-label="Zoom out" title="Zoom out" className="qc-canvas-icon-tool"><QcIcon name="minus" /></QcToolButton>
                      <span className="qc-takeoff-zoom-value" aria-label="Current zoom">{Math.round(zoom * 100)}%</span><QcToolButton
                        onClick={handleZoomIn}
                        aria-label="Zoom in" title="Zoom in" className="qc-canvas-icon-tool"><QcIcon name="plus" /></QcToolButton>
                    </QcCanvasToolGroup>
                  </div>
                </div>
              </QcCanvasToolbar>

          {/* Phase 7: Multi-lineal in-progress floating banner. DRAGGABLE so it
              never blocks the canvas where the user needs to click. Drag from
              the grip handle on the left; buttons remain clickable. */}
          {multiLinealMode && multiLinealPoints.length >= 1 && (() => {
            // 6.3: canonical unit-normalised effective scale (raw averaging is not the domain maths).
            const avgScale = effectiveScaleFromLegacyCalibrations(calibrations);
            let runningTotal = 0;
            for (let i = 1; i < multiLinealPoints.length; i++) {
              const dx = multiLinealPoints[i].x - multiLinealPoints[i - 1].x;
              const dy = multiLinealPoints[i].y - multiLinealPoints[i - 1].y;
              runningTotal += Math.sqrt(dx * dx + dy * dy) * avgScale;
            }
            const segCount = multiLinealPoints.length - 1;
            const style: CSSProperties = popupPos
              ? { left: popupPos.x, top: popupPos.y, transform: 'none' }
              : { left: '50%', transform: 'translateX(-50%)', top: 96 };
            return (
              <div
                ref={popupContainerRef}
                className="absolute z-20"
                style={style}
              >
                <div
                  className="qc-takeoff-multiline-banner flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-300 rounded-full text-sm shadow-md cursor-grab active:cursor-grabbing select-none"
                  onMouseDown={(e) => {
                    // Drag from anywhere on the toolbar EXCEPT the buttons.
                    if ((e.target as HTMLElement).closest('button')) return;
                    e.preventDefault();
                    const container = popupContainerRef.current;
                    if (!container) return;
                    const rect = container.getBoundingClientRect();
                    const parentRect = container.offsetParent?.getBoundingClientRect();
                    if (!parentRect) return;
                    const origX = rect.left - parentRect.left;
                    const origY = rect.top - parentRect.top;
                    popupDragRef.current = { startX: e.clientX, startY: e.clientY, origX, origY };
                    const onMove = (ev: MouseEvent) => {
                      if (!popupDragRef.current) return;
                      const dx = ev.clientX - popupDragRef.current.startX;
                      const dy = ev.clientY - popupDragRef.current.startY;
                      setPopupPos({ x: popupDragRef.current.origX + dx, y: popupDragRef.current.origY + dy });
                    };
                    const onUp = () => {
                      popupDragRef.current = null;
                      document.removeEventListener('mousemove', onMove);
                      document.removeEventListener('mouseup', onUp);
                    };
                    document.addEventListener('mousemove', onMove);
                    document.addEventListener('mouseup', onUp);
                  }}
                  title="Drag to move"
                >
                  {/* Drag handle (visual affordance; whole bar is draggable) */}
                  <div className="flex items-center text-orange-300 hover:text-orange-500">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 6h2v2H8V6zm0 5h2v2H8v-2zm0 5h2v2H8v-2zm6-10h2v2h-2V6zm0 5h2v2h-2v-2zm0 5h2v2h-2v-2z" /></svg>
                  </div>
                  <span className="text-orange-800 font-medium whitespace-nowrap">
                    Total: {runningTotal.toFixed(2)}m ({segCount} segment{segCount !== 1 ? 's' : ''})
                  </span>
                  <span className="text-orange-500 text-xs whitespace-nowrap">Double-click or</span>
                  <QcHostedButton variant="primary"
                    onClick={handleFinishMultiLineal}
                    disabled={multiLinealPoints.length < 2}
                    className="px-3 py-1 bg-orange-500 text-white rounded-full text-xs font-medium hover:bg-orange-600 disabled:opacity-40"
                  >
                    Finish
                  </QcHostedButton>
                  <QcHostedButton variant="ghost"
                    onClick={handleCancelMultiLineal}
                    className="px-2 py-1 bg-gray-200 text-gray-700 rounded-full text-xs hover:bg-gray-300"
                  >
                    Cancel
                  </QcHostedButton>
                </div>
              </div>
            );
          })()}

          {/* Canvas - viewport pattern (2026-09-26): the element fills the
              visible area; zoom/pan live in the viewportTransform, so the
              whole plan stays reachable at any zoom (no scrollbars). */}
          <div className="qc-takeoff-canvas-scroll relative flex-1 min-h-0 overflow-hidden p-2 md:p-6 md:pt-4">
            <div className="qc-takeoff-plan-border absolute left-2 right-2 top-2 bottom-2 md:left-6 md:right-6 md:top-4 md:bottom-6 border-2 border-gray-200 rounded-lg overflow-hidden">
              <canvas ref={canvasRef} className="block" />
            </div>
            {/* Pan hint (owner 2026-09-26): appears the first time the plan is
                zoomed in enough that part of it is off-screen and the user has
                not panned yet. Cleared by the first pan or the close button. */}
            {viewClipped && !hasPanned && !panHintDismissed && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-full bg-slate-900/90 px-4 py-2 text-xs text-white shadow-lg">
                <span>Zoomed in - hold <span className="font-bold">Space</span> + drag, or <span className="font-bold">middle-click</span> + drag to move around</span>
                <QcHostedButton variant="ghost" type="button" aria-label="Dismiss pan hint"
                  onClick={() => setPanHintDismissed(true)}
                  className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-white/20 leading-none"
                >✕</QcHostedButton>
              </div>
            )}
          </div>
          <div className="qc-takeoff-canvas-status">
            <span className="qc-takeoff-target" aria-live="polite">
              {calibrationMode ? `Calibration: click ${calibrationPoints.length === 0 ? 'first' : 'second'} point`
                : selectedComponentId ? `Selected: ${displayComponents.find(c => c.id === selectedComponentId)?.name || 'Component'}`
                : areaMode ? 'Drawing an area' : 'No component selected'}
            </span>
            <span>Space / Alt / middle-drag to pan · wheel to zoom</span>
          </div>
        </div>
      </div>

      {/* (Removed 2026-09-25) AI-vs-manual CalibrationChooser popups deleted:
          calibration is always the manual flow now (owner decision). The review
          panel below has no user entry point and stays unreachable. */}
      {aiCalibrationEnabled && aiCalSessionLive && (
        <div className={aiCalReviewOpen ? 'contents' : 'hidden'}>
          <CalibrationReviewPanel
            // P0-2 (audit 2026-09-20): key by page id so React can never reuse
            // a stale controller/panel instance across a page change. The
            // nonce additionally remounts per deliberate session start (6.1:
            // reopen from the toolbar always gets a fresh session).
            key={`${aiCalImage.pageId}:${aiCalSessionNonce}`}
            quoteId={quote.id}
            image={aiCalImage}
            workingUnit={aiCalWorkingUnit}
            startMode={aiCalStartMode}
            fabricRef={fabricRef}
            onComplete={handleAiCalibrationComplete}
            onCancel={() => setAiCalReviewOpen(false)}
            onSwitchToManual={() => { setAiCalReviewOpen(false); setAiCalSessionLive(false); handleStartCalibration(); }}
          />
        </div>
      )}

      {/* Calibration Modal */}
      {showCalibrationModal && (
        <CalibrationModal
          calibrationNumber={calibrations.length + 1}
          defaultUnit={quote.measurement_system === 'metric' ? 'meters' : 'feet'}
          onSave={handleSaveCalibration}
          onCancel={handleCancelCalibration}
        />
      )}

      {/* Area Instructions (after first calibration) - always optional, all trades, all modes */}
      {showRoofAreaInstructions && (
        <QcHostedDialog label="Calibration complete" size="md" className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-4 md:p-6 max-w-sm border border-gray-200 shadow-xl">
            <h2 className="text-lg font-semibold mb-1">Calibration complete</h2>
            {takeoffMode === 'new-page' && initialPageName ? (
              <p className="text-sm text-slate-500 mb-4">
                You can draw and measure the area boundary for &ldquo;{initialPageName}&rdquo;, or skip
                and go straight to adding components. You can always add dimensions manually
                in the area step of the quote builder.
              </p>
            ) : aiTakeoffAvailable ? (
              <p className="text-sm text-slate-500 mb-4">
                You can draw and measure an area manually via Polygon, or Rectangle, use our AI Assist system (Finds roof area and components for you), or skip straight to adding components without an area
              </p>
            ) : (
              <p className="text-sm text-slate-500 mb-4">
                You can draw and measure an area manually via Polygon, or Rectangle, or skip straight to adding components without an area
              </p>
            )}
            {tradeConfig.toolGuidanceNote && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                {tradeConfig.toolGuidanceNote}
              </div>
            )}
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <QcHostedButton variant="secondary"
                  onClick={() => {
                    setShowRoofAreaInstructions(false);
                    roofAreaInstructionsDismissedRef.current = true;
                    setAreaSubTool('polygon');
                    setAreaMode(true);
                    setLineMode(false);
                    setPointMode(false);
                    setMultiLinealMode(false);
                  }}
                  className="flex-1 py-2.5 text-sm font-medium text-white bg-black rounded-full hover:bg-slate-800 transition-colors"
                  title="Click at least three points. Click the first point again to close the area"
                >
                  Draw Area · Polygon
                </QcHostedButton>
                <QcHostedButton variant="secondary"
                  onClick={() => {
                    setShowRoofAreaInstructions(false);
                    roofAreaInstructionsDismissedRef.current = true;
                    setAreaSubTool('rect');
                    setAreaMode(true);
                    setLineMode(false);
                    setPointMode(false);
                    setMultiLinealMode(false);
                  }}
                  className="flex-1 py-2.5 text-sm font-medium text-white bg-black rounded-full hover:bg-slate-800 transition-colors"
                  title="Click and drag a rectangle. Release to set the area"
                >
                  Draw Area · Rectangle
                </QcHostedButton>
              </div>
              {aiTakeoffAvailable && (
                <div className="space-y-2 rounded-xl border-2 border-[#FF6B35]/30 p-3 bg-[#FF6B35]/5">
                  {/* Points display */}
                  {aiPoints && !aiPoints.isBlocked && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600">AI Assist points</span>
                      <span className={`font-semibold ${aiPoints.remaining <= 4 ? 'text-orange-600' : 'text-slate-900'}`}>
                        {aiPoints.remaining} / {aiPoints.limit} remaining
                      </span>
                    </div>
                  )}
                  {/* Blocked state: plan doesn't include AI Assist */}
                  {aiPoints?.isBlocked && (
                    <div className="rounded-lg bg-slate-100 border border-slate-200 px-3 py-2 text-xs text-slate-600 text-center">
                      AI Assist is not available on your current plan. Upgrade to Growth or Pro to unlock AI roof scanning.
                    </div>
                  )}
                  {/* AGENT-TODO(P4-AI-COST-01): the existing 2/6/12 cost hints differ
                      from the 2/4/8 affordability thresholds below. Gavin must reconcile
                      the guard with the owned point-cost contract. Values preserved here. */}
                  {/* Quality selector + scan button: hidden when blocked */}
                  {!aiPoints?.isBlocked && (
                    <>
                      <div className="flex gap-1.5">
                        {([
                          { value: 'low', label: 'Low', hint: 'Small, simple roofs · 2 points' },
                          { value: 'medium', label: 'Medium', hint: 'Medium size & complexity · 6 points' },
                          { value: 'high', label: 'High', hint: 'Larger, complex roofs · 12 points' },
                        ] as const).map(opt => {
                          const cost = opt.value === 'low' ? 2 : opt.value === 'medium' ? 4 : 8;
                          const canAfford = !aiPoints || aiPoints.remaining >= cost;
                          return (
                            <QcHostedButton aria-pressed={aiQualityLevel === opt.value} variant={aiQualityLevel === opt.value ? 'secondary' : 'ghost'}
                              key={opt.value}
                              onClick={() => setAiQualityLevel(opt.value)}
                              disabled={!canAfford}
                              className={`flex-1 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                                aiQualityLevel === opt.value
                                  ? 'bg-slate-900 text-white border-slate-900'
                                  : canAfford
                                    ? 'text-slate-600 border-slate-300 hover:bg-slate-50'
                                    : 'text-slate-300 border-slate-200 cursor-not-allowed'
                              }`}
                              title={opt.hint}
                            >
                              {opt.label}
                            </QcHostedButton>
                          );
                        })}
                      </div>
                      <QcHostedButton variant="primary"
                        onClick={() => {
                          setShowRoofAreaInstructions(false);
                          roofAreaInstructionsDismissedRef.current = true;
                          handleAiScan();
                        }}
                        className="w-full py-2.5 text-sm font-medium text-white bg-[#FF6B35] rounded-full hover:bg-[#E55A2B] transition-colors flex items-center justify-center gap-1.5"
                        title="AI Assist is still being developed, always check the result properly, don't assume its correct, this tool is improving constantly"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a4 4 0 0 1 4 4c0 1.95-1.4 3.58-3.25 3.93L12 10l-.75-.07C9.4 9.58 8 7.95 8 6a4 4 0 0 1 4-4z"/><path d="M2 22v-2a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v2"/><path d="M12 13v3"/></svg>
                        AI Assist (BETA)
                      </QcHostedButton>
                    </>
                  )}
                </div>
              )}
              <QcHostedButton variant="ghost"
                onClick={() => {
                  setShowRoofAreaInstructions(false);
                  roofAreaInstructionsDismissedRef.current = true;
                }}
                className="py-2.5 text-sm font-medium text-slate-700 border border-slate-300 rounded-full hover:bg-slate-50 transition-colors"
              >
                Skip
              </QcHostedButton>
            </div>
          </div>
        </QcHostedDialog>
      )}

      {/* Initial Calibration Help - manual flow is the only calibration path
          (chooser removed 2026-09-25). */}
      {showCalibrationHelp && calibrations.length === 0 && (
        <QcHostedDialog label="Set the scale of your plan" size="sm" className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-4 md:p-6 max-w-md border border-gray-200">
            <h2 className="text-xl font-semibold mb-4">Set the scale of your plan</h2>
            <div className="space-y-3 text-sm">
              <p>Before you can measure, you need to set the scale:</p>
              <ol className="list-decimal list-inside space-y-2 text-gray-900">
                <li>Click the <span className="font-bold text-gray-700">&quot;Calibrate&quot;</span> button</li>
                <li>Click <span className="font-bold">two points</span> on the plan with a known distance</li>
                <li>Enter the <span className="font-bold">actual distance</span> between those points</li>
                <li>Add 2-3 calibrations and use the longest known measurements for best accuracy</li>
                <li>Click <span className="font-bold text-orange-600">&quot;Confirm Calibration&quot;</span> when done</li>
              </ol>
            </div>
            <QcHostedButton variant="secondary"
              onClick={() => {
                setShowCalibrationHelp(false);
                // Auto-start calibration mode
                setCalibrationMode(true);
              }}
              className="mt-6 w-full px-4 py-2 bg-black hover:bg-slate-800 text-white rounded-full font-medium transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
            >
              Start calibration
            </QcHostedButton>
          </div>
        </QcHostedDialog>
      )}

      {/* Volume (L × W ×- D) depth prompt - fires after area polygon is closed for a volume_3d component */}
      {showVolumeDepthPrompt && (
        <QcHostedDialog label="Enter measurement depth" size="sm" className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-4 md:p-6 w-80 border border-gray-200 shadow-xl">
            <h2 className="text-lg font-semibold mb-1">Enter Depth</h2>
            <p className="text-sm text-slate-500 mb-4">
              Footprint drawn. Now enter the depth to calculate volume ({calibrations[0]?.unit === 'feet' ? 'ft' : 'm'}).
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Depth ({calibrations[0]?.unit === 'feet' ? 'ft' : 'm'})
              </label>
              <input aria-label="Measurement depth"
                type="number"
                step="0.01"
                min="0.001"
                value={volumeDepthInput}
                onChange={e => setVolumeDepthInput(e.target.value)}
                placeholder={calibrations[0]?.unit === 'feet' ? 'e.g. 1.0' : 'e.g. 0.3'}
                autoFocus
                className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded text-sm"
              />
              {volumeDepthInput && parseFloat(volumeDepthInput) > 0 && (
                <p className="text-xs text-slate-400 mt-1">
                  Volume ≈ {(
                    (calibrations[0]?.unit === 'feet'
                      ? convertAreaFt2ToMetric(pendingVolumeCalibratedArea)
                      : pendingVolumeCalibratedArea) *
                    (calibrations[0]?.unit === 'feet'
                      ? convertLinearToMetric(parseFloat(volumeDepthInput))
                      : parseFloat(volumeDepthInput))
                  ).toFixed(3)} m³
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <QcHostedButton variant="secondary"
                onClick={handleConfirmVolumeDepth}
                disabled={!volumeDepthInput || parseFloat(volumeDepthInput) <= 0}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-black rounded-full hover:bg-slate-800 disabled:opacity-40 transition-colors"
              >
                {volumeDepthInput && parseFloat(volumeDepthInput) > 0
                  ? `Confirm ${parseFloat(volumeDepthInput).toFixed(2)} ${calibrations[0]?.unit === 'feet' ? 'ft' : 'm'} depth`
                  : 'Enter a depth'}
              </QcHostedButton>
              <QcHostedButton variant="ghost"
                onClick={() => {
                  // Remove preview polygon from canvas
                  if (pendingVolumePolygon) {
                    fabricRef.current?.remove(pendingVolumePolygon);
                    fabricRef.current?.renderAll();
                  }
                  setShowVolumeDepthPrompt(false);
                  setPendingVolumePolygon(null);
                  setPendingVolumeComponentId(null);
                  setPendingVolumePoints([]);
                  setPendingAreaPoints([]);
                  setAreaPoints([]);
                  setVolumeDepthInput('');
                }}
                className="flex-1 py-2.5 text-sm font-medium text-slate-700 border border-slate-300 rounded-full hover:bg-slate-50 transition-colors"
              >
                Cancel
              </QcHostedButton>
            </div>
          </div>
        </QcHostedDialog>
      )}

      {/* Area-to-component attach chooser (2026-09-03): plan vs pitched.
          Default Pitched. Stores the basis + plan value so the save path
          recomputes from live pitch - never a stale snapshot again. */}
      {areaAttachChoice && (
        <QcHostedDialog label="Attach area to component" size="md" className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-5 w-96 border border-gray-200 shadow-xl">
            <h2 className="text-lg font-semibold mb-1">Attach area to component</h2>
            <p className="text-sm text-slate-500 mb-4">
              Choose which value to attach. The live pitch is re-applied on every save,
              so changing the area's pitch later updates this component automatically.
            </p>
            <div className="space-y-2 mb-4">
              <QcHostedButton aria-pressed={areaAttachChoice.basis === 'pitched'} data-qc-choice="true" variant="ghost"
                type="button"
                onClick={() => setAreaAttachChoice(c => c && { ...c, basis: 'pitched' })}
                className={`w-full text-left rounded-xl border px-4 py-3 transition ${
                  areaAttachChoice.basis === 'pitched'
                    ? 'border-orange-400 bg-orange-50/50 ring-1 ring-orange-300'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900">Pitched area</span>
                  <span className="text-sm font-bold text-slate-900 tabular-nums">
                    {areaAttachChoice.pitched.toFixed(2)} {calibrations[0]?.unit === 'feet' ? 'ft²' : 'm²'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {areaAttachChoice.pitch > 0
                    ? `Plan ${areaAttachChoice.plan.toFixed(2)} ×- pitch factor at ${areaAttachChoice.pitch.toFixed(1)}° - use for roof sheets, underlay, battens (recommended)`
                    : 'No pitch set on this area - same as plan. Set a pitch first for a pitched value.'}
                </p>
              </QcHostedButton>
              <QcHostedButton aria-pressed={areaAttachChoice.basis === 'plan'} data-qc-choice="true" variant="ghost"
                type="button"
                onClick={() => setAreaAttachChoice(c => c && { ...c, basis: 'plan' })}
                className={`w-full text-left rounded-xl border px-4 py-3 transition ${
                  areaAttachChoice.basis === 'plan'
                    ? 'border-orange-400 bg-orange-50/50 ring-1 ring-orange-300'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900">Plan (base) area</span>
                  <span className="text-sm font-bold text-slate-900 tabular-nums">
                    {areaAttachChoice.plan.toFixed(2)} {calibrations[0]?.unit === 'feet' ? 'ft²' : 'm²'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">No pitch applied - footprint measurement only.</p>
              </QcHostedButton>
            </div>
            <div className="flex gap-3">
              <QcHostedButton variant="secondary"
                onClick={handleConfirmAreaAttach}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-black rounded-full hover:bg-slate-800 transition-colors"
              >
                Attach {areaAttachChoice.basis === 'pitched' ? 'pitched' : 'plan'} ({(areaAttachChoice.basis === 'pitched' ? areaAttachChoice.pitched : areaAttachChoice.plan).toFixed(1)} {calibrations[0]?.unit === 'feet' ? 'ft²' : 'm²'})
              </QcHostedButton>
              <QcHostedButton variant="ghost"
                onClick={() => setAreaAttachChoice(null)}
                className="flex-1 py-2.5 text-sm font-medium text-slate-700 border border-slate-300 rounded-full hover:bg-slate-50 transition-colors"
              >
                Cancel
              </QcHostedButton>
            </div>
          </div>
        </QcHostedDialog>
      )}

      {/* Roof Pitch Estimator - opened from toolbar or pitch prompts.
          When a pitch prompt is open, result flows back into it; otherwise
          the result screen just shows the estimate + copy. */}
      {showPitchEstimator && (
        <RoofPitchEstimatorModal
          onClose={() => setShowPitchEstimator(false)}
          onApply={showPitchOnlyPrompt
            ? (deg) => { setPitchOnlyDegrees(deg); setShowPitchEstimator(false); }
            : undefined}
        />
      )}

      {/* P1-1b pitch-only prompt for new-page mode (first area boundary drawn) */}
      {showPitchOnlyPrompt && (
        <QcHostedDialog label="Area pitch" size="md" className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-4 md:p-6 w-80 border border-gray-200 shadow-xl">
            <h2 className="text-lg font-semibold mb-1">
              {isExistingAreaMode ? `Adding to: ${existingAreaLabel}` : `"${initialPageName || 'New Area'}"`}
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              {tradeConfig.pitchRequired
                ? 'Enter the roof pitch for this area, or skip to use 0°.'
                : 'Enter the slope or angle if applicable, or skip.'}
            </p>
            {/* Issue 1 fix (2026-07-05): show the measured area, same as AreaNameModal */}
            <div className="p-3 bg-gray-50 border border-orange-400 rounded-lg mb-4">
              <p className="text-xs text-gray-900 font-medium">
                Plan Area: {(pendingAreaPoints.length > 0 ? calculatePolygonArea(pendingAreaPoints) : 0).toFixed(2)} sq {calibrations[0]?.unit || 'feet'}{tradeConfig.pitchRequired ? ' (before pitch adjustment)' : ''}
              </p>
            </div>
            <div className="mb-4">
              <div className="flex items-end gap-2">
                <PitchInput
                  degrees={pitchOnlyDegrees}
                  onSave={(deg) => setPitchOnlyDegrees(deg)}
                  label={tradeConfig.pitchRequired ? 'Pitch' : 'Slope / Angle'}
                  required={tradeConfig.pitchRequired}
                  autoFocus
                  className="block"
                />
                <QcHostedButton variant="ghost"
                  type="button"
                  onClick={() => setShowPitchEstimator(true)}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-orange-400 hover:text-orange-600 hover:bg-orange-50/40 transition mb-0.5"
                  title="Estimate roof pitch from a photo"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
                  Estimate pitch
                </QcHostedButton>
              </div>
            </div>
            <div className="flex gap-3">
              <QcHostedButton variant="secondary"
                onClick={() => {
                  setShowPitchOnlyPrompt(false);
                  const pitch = pitchOnlyDegrees ?? 0;
                  handleSaveArea(isExistingAreaMode ? existingAreaLabel : (initialPageName || 'New Area'), pitch);
                }}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-black rounded-full hover:bg-slate-800 transition-colors"
              >
                {pitchOnlyDegrees != null ? `Save at ${pitchOnlyDegrees.toFixed(1).replace(/\.0$/, '')}°` : 'Save (0° flat)'}
              </QcHostedButton>
              <QcHostedButton variant="ghost"
                onClick={() => {
                  setShowPitchOnlyPrompt(false);
                  setPendingAreaPoints([]);
                  setAreaPoints([]);
                  viaNewAreaFlowRef.current = false; // RC-5: cancel resets the flow flag
                }}
                className="flex-1 py-2.5 text-sm font-medium text-slate-700 border border-slate-300 rounded-full hover:bg-slate-50 transition-colors"
              >
                Cancel
              </QcHostedButton>
            </div>
          </div>
        </QcHostedDialog>
      )}

      {/* Area Name Prompt */}
      {showAreaNamePrompt && (
        <AreaNameModal
          isRoofing={tradeConfig.pitchRequired}
          modalTitle={tradeConfig.createAreaModalTitle}
          namePlaceholder={tradeConfig.areaNamePlaceholder}
          componentName={pendingComponentId ? (displayComponents.find(c => c.id === pendingComponentId)?.name ?? null) : null}
          initialName={takeoffMode === 'new-page' ? (initialPageName ?? '') : ''}
          calculatedArea={pendingAreaPoints.length > 0 ? calculatePolygonArea(pendingAreaPoints) : 0}
          unit={calibrations[0]?.unit || 'feet'}
          onSave={handleSaveArea}
          onCancel={() => {
            setShowAreaNamePrompt(false);
            setPendingAreaPoints([]);
            setAreaPoints([]);
            viaNewAreaFlowRef.current = false; // RC-5: cancel resets the flow flag
          }}
        />
      )}

      {/* (2026-07-05) Assign Area Measurement modal REMOVED (RC-1/RC-5). */}

      {/* Phase 6: New Area choice modal */}
      {showNewAreaChoiceModal && (
        <QcHostedDialog label="Create a new area" size="md" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-2 md:p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-1">New Area</h2>
              <p className="text-sm text-slate-500 mb-5">
                Draw a new area measurement, then choose where to add it.
              </p>

              {/* Option A: Add to existing area */}
              <label
                className={`w-full text-left p-4 rounded-xl border-2 mb-3 transition-colors cursor-pointer block ${
                  newAreaChoice === 'existing'
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="newAreaChoice"
                    checked={newAreaChoice === 'existing'}
                    onChange={() => setNewAreaChoice('existing')}
                    className="mt-0.5 w-4 h-4 accent-orange-500"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">Add to existing area</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Draw a polygon that adds to an existing area’s total.
                    </p>
                    {newAreaChoice === 'existing' && (
                      <select aria-label="Existing area"
                        value={newAreaExistingId}
                        onChange={e => setNewAreaExistingId(e.target.value)}
                        className="mt-2 w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      >
                        {areaList.map(a => (
                          <option key={a.id} value={a.id}>{a.label}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              </label>

              {/* Option B: Create new area */}
              <label
                className={`w-full text-left p-4 rounded-xl border-2 mb-3 transition-colors cursor-pointer block ${
                  newAreaChoice === 'new'
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="newAreaChoice"
                    checked={newAreaChoice === 'new'}
                    onChange={() => setNewAreaChoice('new')}
                    className="mt-0.5 w-4 h-4 accent-orange-500"
                  />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Create new area</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Draw a polygon, then name the new area.
                    </p>
                  </div>
                </div>
              </label>

              <div className="flex gap-3 pt-2">
                <QcHostedButton variant="ghost"
                  type="button"
                  onClick={() => setShowNewAreaChoiceModal(false)}
                  className="flex-1 py-2.5 text-sm font-medium text-slate-700 border border-slate-300 rounded-full hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </QcHostedButton>
                <QcHostedButton variant="secondary"
                  type="button"
                  onClick={handleConfirmNewAreaChoice}
                  className="flex-1 py-2.5 text-sm font-medium text-white bg-black rounded-full hover:bg-slate-800 transition-colors"
                >
                  Draw Area
                </QcHostedButton>
              </div>
            </div>
          </div>
        </QcHostedDialog>
      )}

      {/* Point Measurement Prompt */}
      {showPointMeasurementPrompt && pendingPointLocation && selectedComponentId && (
        <PointMeasurementModal
          componentName={displayComponents.find(c => c.id === selectedComponentId)?.name || 'Component'}
          onConfirm={() => {
            pushHistorySnapshot();
            // Add point measurement
            const marker = fabricRef.current?.getObjects().slice(-1)[0]; // Last object added
            const pointId = `point-${Date.now()}`;
            if (marker) (marker as any).measurementId = pointId;
            
            const newMeasurement: ComponentMeasurement = {
              id: pointId,
              type: 'point',
              value: 1,
              points: [pendingPointLocation],
              visible: true,
              canvasObjects: marker ? [marker] : [],
              quoteRoofAreaId: activeAreaIdRef.current, // stamp ownership at draw time
              fromPageId: currentPageIdRef.current, // stamp page at draw time (ref - stale-closure fix)
            };
            
            const compData = componentMeasurements.find(c => c.componentId === selectedComponentId);
            if (compData) {
              setComponentMeasurements(componentMeasurements.map(c =>
                c.componentId === selectedComponentId
                  ? { ...c, measurements: [...c.measurements, newMeasurement] }
                  : c
              ));
            } else {
              setComponentMeasurements([
                ...componentMeasurements,
                { 
                  componentId: selectedComponentId, 
                  measurements: [newMeasurement],
                  expanded: true 
                }
              ]);
            }
            
            // Clear state (keep pointMode active for repeat)
            setShowPointMeasurementPrompt(false);
            setPendingPointLocation(null);
          }}
          onCancel={() => {
            pushHistorySnapshot();
            // Remove marker from canvas
            if (fabricRef.current) {
              const objects = fabricRef.current.getObjects();
              const marker = objects[objects.length - 1];
              fabricRef.current.remove(marker);
              fabricRef.current.renderAll();
            }
            
            setShowPointMeasurementPrompt(false);
            setPendingPointLocation(null);
          }}
        />
      )}

      {/* Line Measurement Prompt */}
      {showLineMeasurementPrompt && pendingLineMeasurement && (
        <LineMeasurementModal
          length={pendingLineMeasurement.length}
          unit={calibrations[0]?.unit || 'feet'}
          onConfirm={() => {
            if (!selectedComponentId) return;
            pushHistorySnapshot();

            // Freestyle intercept: length_x_height_freestyle - show height prompt.
            const selectedComp = components.find(c => c.id === selectedComponentId);
            if ((selectedComp?.measurement_type as string) === 'length_x_height_freestyle') {
              const objects = fabricRef.current?.getObjects() || [];
              const canvasObjs = objects.slice(-3);
              setPendingFreestyleLength(pendingLineMeasurement.length);
              setPendingFreestyleComponentId(selectedComponentId);
              setPendingFreestylePoints(pendingLineMeasurement.points);
              setPendingFreestyleCanvasObjects(canvasObjs);
              setPendingFreestyleIsMultiLineal(false);
              setFreestyleHeightInput('');
              setShowLineMeasurementPrompt(false);
              setPendingLineMeasurement(null);
              setLinePoints([]);
              setShowFreestyleHeightPrompt(true);
              return;
            }
            
            // Collect canvas objects (line + markers) - last 3 objects added
            const objects = fabricRef.current?.getObjects() || [];
            const canvasObjects = objects.slice(-3); // Last 3 objects (2 markers + 1 line)
            const lineId = `line-${Date.now()}`;
            // Tag objects with measurementId so cleanupInProgressObjects won't remove them.
            canvasObjects.forEach((obj: any) => { obj.measurementId = lineId; });
            
            // Create measurement
            const newMeasurement: ComponentMeasurement = {
              id: lineId,
              type: 'line',
              value: pendingLineMeasurement.length,
              points: pendingLineMeasurement.points,
              visible: true,
              canvasObjects,
              quoteRoofAreaId: activeAreaIdRef.current, // stamp ownership at draw time
              fromPageId: currentPageIdRef.current, // stamp page at draw time (ref - stale-closure fix)
            };
            
            // Add to component measurements
            const compData = componentMeasurements.find(c => c.componentId === selectedComponentId);
            if (compData) {
              setComponentMeasurements(componentMeasurements.map(c =>
                c.componentId === selectedComponentId
                  ? { ...c, measurements: [...c.measurements, newMeasurement] }
                  : c
              ));
            } else {
              setComponentMeasurements([
                ...componentMeasurements,
                { 
                  componentId: selectedComponentId, 
                  measurements: [newMeasurement],
                  expanded: true 
                }
              ]);
            }
            
            // Clear state (keep lineMode active for repeat)
            setShowLineMeasurementPrompt(false);
            setPendingLineMeasurement(null);
            setLinePoints([]);
          }}
          onCancel={() => {
            pushHistorySnapshot();
            // Remove line and markers from canvas (last 3 objects)
            if (fabricRef.current) {
              const objects = fabricRef.current.getObjects();
              const toRemove = objects.slice(-3); // Last 3: 2 markers + 1 line
              toRemove.forEach(obj => fabricRef.current!.remove(obj));
              fabricRef.current.renderAll();
            }
            
            // Clear state
            setShowLineMeasurementPrompt(false);
            setPendingLineMeasurement(null);
            setLinePoints([]);
          }}
        />
      )}

      {/* Freestyle height prompt - fires after line/polyline for length_x_height_freestyle / multi_lineal_lxh_freestyle */}
      {showFreestyleHeightPrompt && (
        <QcHostedDialog label="Enter measurement height" size="sm" className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-4 md:p-6 w-80 border border-gray-200 shadow-xl">
            <h2 className="text-lg font-semibold mb-1">Enter Height</h2>
            <p className="text-sm text-slate-500 mb-4">
              Length measured:{' '}
              {(calibrations[0]?.unit === 'feet'
                ? convertLinearToMetric(pendingFreestyleLength)
                : pendingFreestyleLength).toFixed(2)} m.
              Now enter the height to calculate area.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Height ({calibrations[0]?.unit === 'feet' ? 'ft' : 'm'})
              </label>
              <input aria-label="Measurement height"
                type="number"
                step="0.01"
                min="0.001"
                value={freestyleHeightInput}
                onChange={e => setFreestyleHeightInput(e.target.value)}
                placeholder={calibrations[0]?.unit === 'feet' ? 'e.g. 8.0' : 'e.g. 2.4'}
                autoFocus
                className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded text-sm"
              />
              {freestyleHeightInput && parseFloat(freestyleHeightInput) > 0 && (
                <p className="text-xs text-slate-400 mt-1">
                  Area ≈ {(
                    (calibrations[0]?.unit === 'feet'
                      ? convertLinearToMetric(pendingFreestyleLength)
                      : pendingFreestyleLength) *
                    (calibrations[0]?.unit === 'feet'
                      ? convertLinearToMetric(parseFloat(freestyleHeightInput))
                      : parseFloat(freestyleHeightInput))
                  ).toFixed(2)} m²
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <QcHostedButton variant="secondary"
                onClick={handleConfirmFreestyleHeight}
                disabled={!freestyleHeightInput || parseFloat(freestyleHeightInput) <= 0}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-black rounded-full hover:bg-slate-800 disabled:opacity-40 transition-colors"
              >
                {freestyleHeightInput && parseFloat(freestyleHeightInput) > 0
                  ? `Confirm ${parseFloat(freestyleHeightInput).toFixed(2)} ${calibrations[0]?.unit === 'feet' ? 'ft' : 'm'} height`
                  : 'Enter a height'}
              </QcHostedButton>
              <QcHostedButton variant="ghost"
                onClick={() => {
                  if (fabricRef.current) {
                    pendingFreestyleCanvasObjects.forEach(obj => fabricRef.current!.remove(obj));
                    fabricRef.current.renderAll();
                  }
                  setShowFreestyleHeightPrompt(false);
                  setFreestyleHeightInput('');
                  setPendingFreestyleComponentId(null);
                  setPendingFreestylePoints([]);
                  setPendingFreestyleCanvasObjects([]);
                  setLinePoints([]);
                }}
                className="flex-1 py-2.5 text-sm font-medium text-slate-700 border border-slate-300 rounded-full hover:bg-slate-50 transition-colors"
              >
                Cancel
              </QcHostedButton>
            </div>
          </div>
        </QcHostedDialog>
      )}

      {/* App-style alert replaces native alert() across this workstation. */}
      {/* Reset Canvas confirm modal */}
        <ConfirmModal
          appearance={desktopAppearance ? 'v2' : undefined}
          open={showResetConfirm}
          title="Reset takeoff?"
          description={hydrationData && hydrationData.measurements.length > 0
            ? 'This will discard all unsaved changes and restore the canvas to the last saved state.'
            : 'This will clear all measurements, calibrations, and drawings. You will start over from the calibration step.'}
          confirmLabel="Reset"
          destructive={true}
          onCancel={() => setShowResetConfirm(false)}
          onConfirm={handleResetCanvas}
        />
        {/* Phase 5: Area delete confirmation */}
        <ConfirmModal
          appearance={desktopAppearance ? 'v2' : undefined}
          open={showAreaDeleteConfirm}
          title={`Delete "${pendingDeleteAreaLabel}"?`}
          description="This deletes the area and all its components and measurements. This cannot be undone."
          confirmLabel={isDeletingArea ? 'Deleting…' : 'Delete'}
          destructive={true}
          onCancel={() => { setShowAreaDeleteConfirm(false); setPendingDeleteAreaId(null); }}
          onConfirm={handleConfirmDeleteArea}
        />
        <AlertModal
        appearance={desktopAppearance ? 'v2' : undefined}
        open={alertState.open}
        title={alertState.title}
        description={alertState.description}
        variant={alertState.variant}
        onClose={closeAlert}
      />

      {/* AI Takeoff: scanning overlay */}
      {aiScanning && (
        <QcHostedDialog label="AI scan in progress" size="sm" className="fixed inset-0 backdrop-blur-sm bg-black/40 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-2xl p-6 max-w-sm border border-gray-200 shadow-xl text-center">
            <div className="inline-block w-8 h-8 border-3 border-slate-200 border-t-[#FF6B35] rounded-full animate-spin mb-3" />
            <h3 className="text-sm font-semibold text-slate-900">
              {aiScanStage === 'outline' ? 'Tracing roof outline…' : aiScanStage === 'lines' ? 'Detecting and auditing roof lines…' : 'Classifying components…'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">This may take a few moments.</p>
            <QcHostedButton variant="ghost"
              onClick={handleCancelAiScan}
              className="mt-4 inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-colors"
            >
              Cancel scan
            </QcHostedButton>
          </div>
        </QcHostedDialog>
      )}

      {/* M10 P5 -> owner redo 2026-09-25: staged scan review. Desktop gets a
          guided, draggable, NON-modal card (canvas stays interactive so points
          can be dragged/added/removed while it is open); touch keeps the
          original bottom banner - the mobile flow is locked. */}
      {aiStagedPageId === (pages[currentPageIndex]?.id ?? null) && !aiScanning && !aiResults && (
        desktopAppearance ? (() => {
          const stagedAreas = roofAreas.filter(ra => ra.fromPageId === (pages[currentPageIndex]?.id ?? null) && ra.quoteRoofAreaId);
          const selArea = outlineSelectedVertex
            ? stagedAreas.find(ra => ra.id === outlineSelectedVertex.areaId || ra.quoteRoofAreaId === outlineSelectedVertex.areaId)
            : undefined;
          const selN = selArea?.points.length ?? 0;
          const selIdx = outlineSelectedVertex ? Math.min(outlineSelectedVertex.vertexIndex, Math.max(selN - 1, 0)) : 0;
          return (
            <QcHostedDialog label="Check the AI outline" modeless>
              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xl">
                <h2 className="text-base font-semibold mb-1 text-slate-900">Check the AI outline</h2>
                <p className="text-xs text-slate-500 mb-3">
                  Drag the blue points to fix the shape - your next step runs on the corrected outline.
                </p>
                {/* Vertex stepper (mobile parity): the selected point renders
                    enlarged in orange on the canvas with its two edges lit. */}
                {selN >= 3 && outlineSelectedVertex && (
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <QcHostedButton variant="ghost" size="sm" type="button"
                      onClick={() => stepOutlineSelection(-1)}
                      aria-label="Select previous point (anti-clockwise)"
                      className="w-9 h-9 justify-center rounded-full border border-slate-300 bg-white hover:bg-slate-50 text-slate-600">
                      ◀
                    </QcHostedButton>
                    <span className="text-xs font-medium text-slate-600">Point {selIdx + 1} of {selN}</span>
                    <QcHostedButton variant="ghost" size="sm" type="button"
                      onClick={() => stepOutlineSelection(1)}
                      aria-label="Select next point (clockwise)"
                      className="w-9 h-9 justify-center rounded-full border border-slate-300 bg-white hover:bg-slate-50 text-slate-600">
                      ▶
                    </QcHostedButton>
                  </div>
                )}
                <div className="flex gap-2 mb-2">
                  <QcHostedButton variant="ghost" size="sm" type="button"
                    aria-pressed={outlineTool === 'add'}
                    onClick={() => setOutlineTool(t => t === 'add' ? null : 'add')}
                    className="flex-1 justify-center text-xs">
                    + Add point
                  </QcHostedButton>
                  <QcHostedButton variant="ghost" size="sm" type="button"
                    onClick={handleRemoveSelectedOutlineVertex}
                    disabled={!outlineSelectedVertex || selN <= 3}
                    className="flex-1 justify-center text-xs">
                    − Remove point
                  </QcHostedButton>
                </div>
                {/* Owner 2026-09-25 (12:30 pass): outline-edit undo/redo,
                    greyed until the user actually changes something. */}
                <div className="flex gap-2 mb-2">
                  <QcHostedButton variant="ghost" size="sm" type="button"
                    onClick={handleOutlineUndo}
                    disabled={!outlineHistory || outlineHistory.index <= 0}
                    title="Undo the last outline edit"
                    className="flex-1 justify-center text-xs">
                    ↶ Undo
                  </QcHostedButton>
                  <QcHostedButton variant="ghost" size="sm" type="button"
                    onClick={handleOutlineRedo}
                    disabled={!outlineHistory || outlineHistory.index >= outlineHistory.stack.length - 1}
                    title="Redo an undone outline edit"
                    className="flex-1 justify-center text-xs">
                    ↷ Redo
                  </QcHostedButton>
                </div>
                <p className="text-[11px] text-slate-400 mb-3" data-live-hint>
                  {outlineTool === 'add'
                    ? 'Click on an outline edge to insert a point.'
                    : selN >= 3
                      ? 'The selected point shows as an orange crosshair with its two edges lit - drag it, or use the arrows to walk the outline.'
                      : 'Drag this card aside any time to see the plan behind it.'}
                </p>
                {/* Owner 2026-09-25 (12:46): component-scan quality. Defaults
                    to the level used for the area scan; the user can bump it
                    up or down before running (scans 2+3 are free
                    continuations - only scan1 charges points). */}
                <div className="mb-2">
                  <div className="text-[11px] font-medium text-slate-500 mb-1">Component scan quality</div>
                  <div className="flex gap-1.5">
                    {([
                      { value: 'low', label: 'Low' },
                      { value: 'medium', label: 'Medium' },
                      { value: 'high', label: 'High' },
                    ] as const).map(opt => (
                      <QcHostedButton aria-pressed={aiQualityLevel === opt.value} variant={aiQualityLevel === opt.value ? 'secondary' : 'ghost'}
                        key={opt.value}
                        type="button"
                        onClick={() => setAiQualityLevel(opt.value)}
                        className={`flex-1 justify-center py-1.5 text-xs font-medium rounded-full border transition-colors ${
                          aiQualityLevel === opt.value
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'text-slate-600 border-slate-300 hover:bg-slate-50'
                        }`}>
                        {opt.label}
                      </QcHostedButton>
                    ))}
                  </div>
                </div>
                {/* Owner 2026-09-25: three real next steps - scan components,
                    add them manually, or finish with the area measured so far. */}
                <QcHostedButton variant="primary" type="button"
                  onClick={handleContinueAiScan}
                  className="w-full justify-center rounded-full bg-[#FF6B35] px-4 py-2 text-sm font-semibold text-white hover:bg-[#e55a28] transition-colors">
                  AI scan for components
                </QcHostedButton>
                <div className="flex gap-2 mt-2">
                  <QcHostedButton variant="ghost" type="button"
                    onClick={() => { setAiStagedPageId(null); setOutlineTool(null); setOutlineSelectedVertex(null); }}
                    className="flex-1 justify-center rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                    Add components manually
                  </QcHostedButton>
                  <QcHostedButton variant="ghost" type="button"
                    onClick={handleOutlineFinishAndSave}
                    className="flex-1 justify-center rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                    Finish &amp; save
                  </QcHostedButton>
                </div>
              </div>
            </QcHostedDialog>
          );
        })() : (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] bg-white rounded-2xl border border-gray-200 shadow-xl px-4 py-3 max-w-sm text-center">
            <h3 className="text-sm font-semibold text-slate-900">AI outline applied</h3>
            <p className="text-xs text-slate-500 mt-1">Drag the blue points to correct the outline, then continue. Components are detected on your corrected outline.</p>
            <div className="mt-3 flex items-center justify-center gap-2">
              <QcHostedButton variant="primary"
                onClick={handleContinueAiScan}
                className="inline-flex items-center justify-center rounded-full bg-[#FF6B35] px-4 py-2 text-xs font-semibold text-white hover:bg-[#e55a28] transition-colors"
              >
                Detect components
              </QcHostedButton>
              <QcHostedButton variant="ghost"
                onClick={() => setAiStagedPageId(null)}
                className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Not now
              </QcHostedButton>
            </div>
          </div>
        )
      )}

      {/* AI Takeoff: error toast */}
      {aiScanError && !aiScanning && (
        <div role="alert" className="qc-takeoff-ai-error fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] bg-red-600 text-white text-xs px-4 py-2 rounded-full shadow-lg animate-fade-in">
          {aiScanError}
          <QcHostedButton variant="ghost"
            onClick={() => setAiScanError(null)}
            className="ml-2 underline opacity-80 hover:opacity-100"
          >
            Dismiss
          </QcHostedButton>
        </div>
      )}

      {/* PDF page picker modal (client-side pdfjs) */}
      {pdfPicker.modal}

      {/* AI Takeoff: results modal */}
      {aiResults && aiScanRaw && (
        <AiResultsModal
          data={{ ...aiResults, droppedCount: aiResults.droppedCount }}
          onApply={(areaOverrides) => handleApplyAiResults(areaOverrides)}
          onDiscard={() => {
            setAiResults(null);
            setAiScanRaw(null);
            setAiStagedPageId(null);
          }}
        />
      )}
    </div>
    </div>
    </QcHostedDialogScope>
  );
}

// Area Name Modal - isRoofing controls whether pitch is shown/required.
// modalTitle + namePlaceholder are trade-config-driven.
