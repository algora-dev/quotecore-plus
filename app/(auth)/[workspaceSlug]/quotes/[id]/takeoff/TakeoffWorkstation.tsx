'use client';
import { useState, useRef, useEffect, useCallback, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Canvas, FabricImage, Line, Circle, Polygon, Triangle, Rect } from 'fabric';
import type { QuoteRow } from '@/app/lib/types';
import { normalizeMeasurementSystem } from '@/app/lib/types';
import { saveTakeoffMeasurements, createTakeoffPage, createTakeoffPageForArea, initializeTakeoffPage, finalizeTakeoffPageImage, getFirstRoofAreaId, createNewTakeoffArea, renameTakeoffArea, deleteTakeoffArea, getTakeoffSessionVersion, batchCreateAiRoofAreas } from './actions';
import { toolForMeasurementType } from '@/app/lib/takeoff/tool-for-measurement-type';
import { useStateHistory } from '@/app/lib/takeoff/useStateHistory';
import { applyAiResults, computeLineValue, computeAreaValue, type AiScanData, type ApplyAiResult, type AiMeasurement, type AiRoofAreaResult, type PlaceholderType, validateMeasurementConsistency } from '@/app/lib/takeoff/applyAiResults';
import { AI_COMPONENT_REGISTRY, ALL_SEMANTIC_KEYS, type SemanticKey, getSemanticColour, getLineOptions, buildSystemComponentIds, resolveSemanticKey } from '@/app/lib/takeoff/aiComponentRegistry';
import { AiResultsModal, type AiResultsData, type AiResultsArea } from './modals/AiResultsModal';
import { AiAreaReviewModal } from './modals/AiAreaReviewModal';
import { PitchInput } from '@/app/components/PitchInput';
import { reconstructCanvas } from '@/app/lib/takeoff/reconstructCanvas';
import type { TakeoffHydrationData } from './actions';
import { uploadCanvasImage } from './uploadCanvasImage';
import { AlertModal } from '@/app/components/AlertModal';
import { ConfirmModal } from '@/app/components/ConfirmModal';
import { StorageBlockedModal } from '@/app/components/billing/StorageBlockedModal';
import { getTradeLabels } from '@/app/lib/trades/labels';
import { createClient as createSupabaseBrowserClient } from '@/app/lib/supabase/client';
import { checkStorageQuota, saveFileMetadata } from '@/app/lib/files/storage-actions';
import { mintQuoteDocumentUploadUrl } from '@/app/lib/files/signed-upload';
import { convertLinearToMetric, convertAreaFt2ToMetric } from '@/app/lib/measurements/conversions';
// F-15: Extracted modal components
import { AreaNameModal } from './modals/AreaNameModal';
import { PointMeasurementModal } from './modals/PointMeasurementModal';
import { LineMeasurementModal } from './modals/LineMeasurementModal';
import { CalibrationModal } from './modals/CalibrationModal';

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
  measurement_type?: string; // matches ComponentLibraryRow field name
  /** Named library (component_collections.id) this component belongs to. Null = unfiled. */
  collection_id?: string | null;
  /** @deprecated alias kept for any callers that used the old name */
  default_measurement_type?: string;
  /** System placeholder components (AI Takeoff) — hidden from manual add selector. */
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
   *  time (freestyle L×H height, volume_3d custom depth). READ-ONLY display
   *  reference — `value` is already the final product. Persisted via
   *  entry_inputs so re-entry doesn't wipe it. */
  entryInputs?: { height_m?: number | null; depth_m?: number | null } | null;
  /** AI Takeoff: true if this measurement was created by the AI scan. */
  aiOrigin?: boolean;
}

interface ComponentWithMeasurements {
  componentId: string;
  measurements: ComponentMeasurement[];
  expanded: boolean;
}

interface Props {
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
  /** P1-1b: pre-created page ID for new-area entries. Skips initializeTakeoffPage. */
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
  /** AI Takeoff: when true, the post-calibration popup shows the "Use AI Assist" button. */
  aiTakeoffAvailable?: boolean;
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

/** Serializable undo/redo snapshot. Contains only plain data — no Fabric refs.
 *  The canvas is rebuilt from this via redrawCanvasFromState(). */
interface TakeoffSnapshot {
  componentMeasurements: { componentId: string; expanded: boolean; measurements: { id: string; type: ComponentMeasurement['type']; value: number; points?: { x: number; y: number }[]; visible: boolean; fromPageId?: string | null; entryInputs?: { height_m?: number | null; depth_m?: number | null } | null }[] }[];
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
}: Props) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const [zoom, setZoom] = useState(1);
  
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

  // Dynamic canvas dimensions — canvas matches the processed image dimensions.
  // No more fixed 800×600 with letterboxing. AI coordinates = canvas coordinates.
  const [canvasDims, setCanvasDims] = useState({ width: 800, height: 600 });

  // AI Takeoff state
  const [aiScanning, setAiScanning] = useState(false);
  const [aiResults, setAiResults] = useState<AiResultsData | null>(null);
  const [aiScanError, setAiScanError] = useState<string | null>(null);
  const [aiScanRaw, setAiScanRaw] = useState<AiScanData | null>(null);
  const [aiOutlineData, setAiOutlineData] = useState<AiScanData | null>(null);
  const [aiOutlineAreas, setAiOutlineAreas] = useState<AiResultsArea[] | null>(null);
  const [aiAnalysisImage, setAiAnalysisImage] = useState<{ dataUrl: string; width: number; height: number } | null>(null);
  const [aiScanStage, setAiScanStage] = useState<'outline' | 'components' | 'skeleton' | 'classify'>('outline');
  // V2 skeleton state (AI_TAKEOFF_SKELETON_V2)
  const [aiV2Skeleton, setAiV2Skeleton] = useState<{
    nodes: Array<{ id: string; area_index: number; kind: string; x: number; y: number; confidence: number }>;
    segments: Array<{ id: string; area_index: number; start_node_id: string; end_node_id: string; confidence: number; inferred: boolean }>;
  } | null>(null);
  // Once the user dismisses the "Calibration complete" popup, never show it again
  // for the current session. Prevents the popup re-appearing every time areaMode
  // toggles (which happens on every component add/finish when no roof area exists).
  const roofAreaInstructionsDismissedRef = useRef(false);

  // Phase 7: multi-page takeoff state.
  // P1-1b: when initialPageId is provided (new-area mode), seed pages with that page
  // instead of page-1; the initializeTakeoffPage effect is skipped.
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
  // (2026-07-05) Assign-Area-Measurement modal REMOVED — all roof-area draws
  // now route to the pitch-only modal or AreaNameModal. See RC-1/RC-5 fix.

  // P1-3 (multi-page Save & Upload another plan): modal state.
  // - target = 'existing' attaches the new page to the FIRST existing roof area
  //   (mirrors FilesManager Option B: new page, same area target).
  // - target = 'new' creates a new roof area + new page with the uploaded plan
  //   (mirrors FilesManager Option C: new area, new plan).
  const [showUploadAnotherModal, setShowUploadAnotherModal] = useState(false);
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
    setSessionVersion(prev => {
      const next = updater(prev);
      sessionVersionRef.current = next;
      return next;
    });
  }, []);
  // Sync ref whenever sessionVersion state changes from external sources
  // (e.g. hydration, getTakeoffSessionVersion sync).
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

  // Volume (L × W × D) - depth prompt state.
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
        // Check if this is a system component — if so, use registry colour
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
  // initializeTakeoffPage is idempotent so repeated mounts are safe.
  // P1-1b: skipped when initialPageId is provided (new-area flow already created the page).
  useEffect(() => {
    if (initialPageId) return; // page already exists - skip
    let cancelled = false;
    async function ensurePage1() {
      try {
        const result = await initializeTakeoffPage(quote.id);
        if (!cancelled && result.ok && result.pageId) {
          setPages(prev => {
            const updated = [...prev];
            if (updated[0] && !updated[0].id) {
              updated[0] = { ...updated[0], id: result.pageId };
            }
            return updated;
          });
          // Duplicate-areas fix (2026-07-05): anything drawn BEFORE this id
          // resolved has fromPageId=null (currentPageIdRef was null). Those
          // rows were drawn on page-1 by definition — retro-stamp them now so
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
        console.warn('[TakeoffWorkstation] initializeTakeoffPage failed:', err);
      }
    }
    ensurePage1();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote.id, initialPageId]);

  // ─── State-only Undo/Redo system ───────────────────────────────────────
  // Stores plain serializable data snapshots — no Fabric.js canvas JSON.
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
  // before storing — they are rebuilt by redrawCanvasFromState().
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
          // canvasObjects stripped — rebuilt on redraw
        })),
      })),
      roofAreas: roofAreas.map(ra => ({
        id: ra.id,
        name: ra.name,
        points: ra.points.map(p => ({ x: p.x, y: p.y })),
        area: ra.area,
        pitch: ra.pitch,
        visible: ra.visible,
        // polygon + markers stripped — rebuilt on redraw
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
      // multiLinealSegmentObjects are Fabric objects — stripped, rebuilt on redraw
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
          // Preserve the draw-time area stamp through redraws — dropping it
          // reverted measurements to the save-time fallback area.
          quoteRoofAreaId: m.quoteRoofAreaId,
          // v8 fix (2026-07-08): redraw REPLACES state with reconstructCanvas
          // output — omitting entryInputs here stripped user H/D from state on
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

  // P1-1a C-01: One-shot hydration from server-loaded DB state.
  // Restores componentMeasurements panel data + pages list from the last saved session.
  // Canvas shapes are NOT reconstructed here (P1-1b); values show in the panel.
  useEffect(() => {
    if (hydrationAppliedRef.current) return;
    if (!hydrationData || hydrationData.measurements.length === 0) return;
    hydrationAppliedRef.current = true;

    // Restore pages list from DB (preserves IDs needed for scoped save).
    if (hydrationData.pages.length > 0) {
      setPages(
        hydrationData.pages.map(p => ({
          id: p.id,
          url: p.imageUrl ?? planUrl, // fall back to route-level planUrl if signed URL failed
          name: p.pageName ?? `Page ${p.pageOrder}`,
          order: p.pageOrder,
        }))
      );
    }

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
    hydrationData.pages.forEach(p => {
      const cal = p.scaleCalibration;
      if (Array.isArray(cal) && cal.length > 0) {
        pageCalibrationsRef.current.set(p.id, cal as Calibration[]);
      }
    });

    // Display active area's data.
    // Fix (2026-07-04): if the initially-selected area has no saved data
    // (e.g. it was an empty/ghost area), fall back to the first area that
    // actually has measurements — otherwise re-entry showed a blank panel
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
    // takeoff_pages.scale_calibration — restore the ACTIVE page's scale, not
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
    // already has saved areas — they can use "+ New Area" or upload a plan.
    if (hydrationData && hydrationData.measurements.length > 0) return;
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

    // Discard any in-progress drawing before switching areas
    discardInProgressDrawing();

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
      // Non-blocking on failure — we still switch areas, but alert the user.
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
          const switchSaveResult = await saveTakeoffMeasurements(
            quote.id, allMeasurements,
            calibrations[0]?.unit || 'feet',
            undefined, undefined, // no canvas snapshot on auto-save
            currentPageDbId, sessionVersionRef.current,
            activeAreaId, // target the outgoing area
            // Fix (2026-07-05): persist the outgoing page's calibration —
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
    // componentMeasurements/roofAreas/pageIds — calibration fields are
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
      // Fresh area — clear components/areas but KEEP calibrations (same plan = same scale)
      setComponentMeasurements([]);
      setRoofAreas([]);
      setActiveComponentIds([]);
      setSelectedComponentId(null);
    }

    setActiveAreaId(targetAreaId);
    activeAreaIdRef.current = targetAreaId; // sync ref for canvas handlers
    setActiveSaveRoofAreaId(targetAreaId);

    // Parent/child plans (2026-07-05): resolve the target page — explicit
    // child slot when supplied, else the area's first plan (areaPages index,
    // falling back to cached pageIds). Swap ONLY the background image. NEVER
    // call loadPageImage here — it wiped the state restored above, which is
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
        } else if (calibrations.length > 0) {
          // Fix (2026-07-05): inherit current scale for legacy pages with no
          // stored calibration (see handleSwitchPage).
          pageCalibrationsRef.current.set(pid, calibrations.map(c => ({ ...c })));
          setCalibrationConfirmed(true);
          setShowCalibrationHelp(false);
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
  // (child slots 1, 2, 3…). All measurements stay in state — the redraw
  // filter draws only the target page's shapes. Each plan has its own scale.
  const handleSwitchPage = useCallback(async (targetPageId: string) => {
    const targetIndex = pages.findIndex(p => p.id === targetPageId);
    if (targetIndex < 0 || targetIndex === currentPageIndex) return;

    // Discard any in-progress drawing before switching pages
    discardInProgressDrawing();

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
      // before switching — same pattern as handleSwitchArea. Without this,
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
          const pageSaveResult = await saveTakeoffMeasurements(
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
    } else if (calibrations.length > 0) {
      // Fix (2026-07-05): no stored scale for this page (legacy data whose
      // calibration was never persisted). Inherit the current plan's scale
      // instead of forcing a recalibration — the user can still hit
      // "Recalibrate" if the plans genuinely differ.
      pageCalibrationsRef.current.set(targetPageId, calibrations.map(c => ({ ...c })));
      setCalibrationPoints([]);
      setCalibrationConfirmed(true);
      setShowCalibrationHelp(false);
      console.info('[SwitchPage] No stored calibration for page', targetPageId, '- inherited current scale');
    } else {
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
    // RC-2 fix (2026-07-05): do NOT clear activeComponentIds here — that wiped
    // the entire left-panel component list. Deselecting is enough.
    setSelectedComponentId(null);
    activeAreaComponentIdRef.current = null;
    setPendingComponentId(null);

    if (areaList.length === 0) {
      // No areas — go straight to drawing mode for a new area
      setPendingNewAreaIsExisting(false);
      setPendingNewAreaTargetId(null);
      // RC-1/RC-5: sync refs synchronously — canvas handlers read refs, not state.
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
    // RC-2 fix (2026-07-05): do NOT clear activeComponentIds — keep the panel intact.
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
      // RC-1: sync refs SYNCHRONOUSLY — the canvas handler reads refs, not state.
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
  // boundary right away — no second "+ New Area" click (the double-work
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

  // Phase 5: Area delete — opens ConfirmModal, then calls deleteTakeoffArea server action.
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
      const result = await deleteTakeoffArea(pendingDeleteAreaId);
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
          // No areas left — clear state
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
  // vertex markers, preview shapes, calibration lines) — committed objects
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

  const handleSaveArea = (name: string, pitch?: number) => {
    pushHistorySnapshot();
    const calculatedArea = calculatePolygonArea(pendingAreaPoints);

    // Route by pendingComponentId first (captured at polygon-close time).
    // This is immune to selectedComponentId being cleared by canvas deselection.
    const capturedComponentId = pendingComponentId; // save before consuming
    const isComponentArea = !!capturedComponentId;
    setPendingComponentId(null); // consume it

    // Roof area: explicit pitch OR no component attached
    if (!isComponentArea && pitch !== undefined) {
      // Remove in-progress vertex markers before adding the committed polygon.
      cleanupInProgressObjects();
      const areaId = `area-${Date.now()}`;
      // Create polygon on canvas
      const polygon = new Polygon(pendingAreaPoints, {
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
        points: pendingAreaPoints,
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
        fromPageId: currentPageIdRef.current, // stamp page at draw time (ref — stale-closure fix)
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
            const result = await createNewTakeoffArea(quote.id, name || undefined);
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
                    const persistResult = await saveTakeoffMeasurements(
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
              // state is cached above — show only the new polygon. If this is
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
        // the current page — register the child slot.
        {
          const targetPagePid = pages[currentPageIndex]?.id ?? null;
          if (targetPagePid) {
            setAreaPages(prev => prev[targetId]?.includes(targetPagePid)
              ? prev
              : { ...prev, [targetId]: [...(prev[targetId] ?? []), targetPagePid] });
          }
        }
        // Reset Phase 6 state — but keep isExistingAreaMode=true so the save
        // only includes NEWLY drawn areas (client-side IDs), not hydrated ones.
        // This prevents duplicating hydrated areas on re-entry saves.
        setPendingNewAreaIsExisting(false);
        setPendingNewAreaTargetId(null);
        viaNewAreaFlowRef.current = false; // RC-5: consume the flow flag
        // Do NOT reset isExistingAreaMode here — it stays true so the save
        // filter at `!isExistingAreaMode` includes only new polygon areas.
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
        fromPageId: currentPageIdRef.current, // stamp page at draw time (ref — stale-closure fix)
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

    const avgScale = currentCalibrations.reduce((s, cal) => s + cal.scale, 0) / currentCalibrations.length;

    // Sum all segment lengths in real-world units.
    let totalLength = 0;
    for (let i = 1; i < currentPoints.length; i++) {
      const dx = currentPoints[i].x - currentPoints[i - 1].x;
      const dy = currentPoints[i].y - currentPoints[i - 1].y;
      totalLength += Math.sqrt(dx * dx + dy * dy) * avgScale;
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
      fromPageId: currentPageIdRef.current, // stamp page at draw time (ref — stale-closure fix)
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
  // switching between areas/child plans — the caller is responsible for
  // clearing drawn objects (redrawCanvasFromState does that) and restoring the
  // page's calibration.
  const setPageBackgroundImage = (imageUrl: string) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const imgElement = new Image();
    imgElement.crossOrigin = 'anonymous';
    imgElement.onload = () => {
      // Dynamic canvas sizing: canvas = processed image dimensions, flush top-left.
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

      // Auto-fit on page switch
      const container = canvasRef.current?.parentElement?.parentElement;
      if (container) {
        const cw = container.clientWidth - 32;
        const ch = container.clientHeight - 32;
        const fitScale = Math.min(cw / dims.width, ch / dims.height, 1);
        canvas.setZoom(fitScale);
        canvas.viewportTransform = [fitScale, 0, 0, fitScale, 0, 0];
        setZoom(fitScale);
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
    // EXISTING area — the wipe below destroyed every area's panel data (the
    // "Garage and Main Roof went blank" bug). Canvas objects are already
    // cleared above; the redraw filter keeps other pages' shapes off-canvas.
    if (!opts?.preserveMeasurements) {
      setComponentMeasurements([]);
      setRoofAreas([]);
      setSelectedComponentId(null);
      // Fix (2026-07-05): also clear the ACTIVE component panel — leaving it
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
      fromPageId: currentPageIdRef.current, // stamp page at draw time (ref — stale-closure fix)
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
      fromPageId: currentPageIdRef.current, // stamp page at draw time (ref — stale-closure fix)
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
  const persistTakeoffData = async (): Promise<boolean> => {
    return await handleSaveTakeoffCore(false);
  };

  const handleSaveTakeoff = async () => {
    await handleSaveTakeoffCore(true);
  };

  const handleSaveTakeoffCore = async (navigateAfter: boolean): Promise<boolean> => {
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
      
      // Add area measurements.
      // RC-6 fix (2026-07-05): the RPC now scopes its delete by page_id, so we
      // must re-send ALL current-page roof areas (hydrated + newly drawn).
      // Hydrated areas from OTHER pages are filtered out by fromPageId — they
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
          // hydrated areas, not a quote_roof_areas.id — using it fails RPC
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
      //  – We do NOT advance the session version (no RPC call).
      //  – We do NOT clear isDirty (no data was actually committed here).
      //  – We only navigate if the caller explicitly requests it.
      //  – This branch must NEVER be used when there are local unsaved changes
      //    (those would have a null/undefined fromPageId and would NOT be filtered).
      if (allMeasurements.length === 0) {
        console.log('[SaveTakeoff] Safe skip - no new measurements for current page. Not a full save.');
        // navigateAfter=false means this was called from persistTakeoffData()
        // before an upload - fine to skip silently.
        // navigateAfter=true means the user clicked "Save & Continue" with no
        // new data drawn - also fine to navigate, but we do NOT mark dirty=false.
        if (navigateAfter) {
          router.push(`/${workspaceSlug}/quotes/${quote.id}/build?step=roof-areas`);
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
          const uploadResult = await uploadCanvasImage(quote.id, fullDataUrl);
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
          const linesResult = await uploadCanvasImage(quote.id, linesDataUrl, 'lines');
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
      const saveResult = await saveTakeoffMeasurements(
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
            const authoritativeVersion = await getTakeoffSessionVersion(quote.id);
            if (authoritativeVersion != null) {
              updateSessionVersion(() => authoritativeVersion);
              // Retry the save with the correct version.
              const retryResult = await saveTakeoffMeasurements(
                quote.id,
                allMeasurements,
                calibrations[0]?.unit || 'feet',
                canvasImagePath,
                linesImagePath,
                currentPageDbId,
                authoritativeVersion,
                activeSaveRoofAreaId,
                calibrations.length > 0 ? calibrations : null,
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
            const flushResult = await saveTakeoffMeasurements(
              quote.id, group, flushUnit,
              undefined, undefined,
              pid,
              versionCursor, cachedAreaId,
              // Fix (2026-07-05): persist the flushed page's calibration when
              // we have it (cached per page); fall back to null (no change).
              (pid ? pageCalibrationsRef.current.get(pid) : null) ?? cachedState.calibrations ?? null,
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
      // the DB instead of trusting a local cursor — cursor drift caused the
      // false "Takeoff edited in another tab" (STALE_TAKEOFF_VERSION) errors.
      try {
        const authoritativeVersion = await getTakeoffSessionVersion(quote.id);
        updateSessionVersion(() => authoritativeVersion ?? versionCursor);
      } catch {
        updateSessionVersion(() => versionCursor);
      }
      // Parent/child plans (2026-07-05): DO NOT clear the cache. It mirrors
      // DB state and drives every non-active area's panel/canvas — clearing
      // it here blanked all other areas after any save (the "Garage and Main
      // Roof went blank" bug).
      
      // P1-3: only navigate to Quote Builder when the user clicked the
      // primary "Save & Continue to Components" CTA. The multi-page upload
      // flow stays inside the workstation and reloads to the new page.
      if (navigateAfter) {
        console.log('[SaveTakeoff] Save complete, navigating to:', `/${workspaceSlug}/quotes/${quote.id}/build?step=roof-areas`);
        router.push(`/${workspaceSlug}/quotes/${quote.id}/build?step=roof-areas`);
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
    // Phase 7: no name validation for 'new' — name collected after drawing
    setIsUploadingPage(true);
    try {
      // 1. Persist current measurements without navigating away.
      if (componentMeasurements.length > 0 || roofAreas.length > 0) {
        const saved = await persistTakeoffData();
        if (!saved) return;
      }
      const companyId = quote.company_id;
      // 2. Storage quota check.
      const hasQuota = await checkStorageQuota(companyId, uploadAnotherFile.size);
      if (!hasQuota) { setUploadAnotherError('Storage quota exceeded. Please upgrade your plan.'); return; }
      // 3. Mint signed upload URL and upload new plan file.
      const mint = await mintQuoteDocumentUploadUrl({
        scope: { kind: 'quote', quoteId: quote.id },
        filename: uploadAnotherFile.name,
        contentType: uploadAnotherFile.type || 'application/octet-stream',
        claimedSize: uploadAnotherFile.size,
      });
      if (!mint.ok) { setUploadAnotherError(mint.message || 'Failed to prepare upload.'); return; }
      const supabase = createSupabaseBrowserClient();
      const { error: uploadStorageError } = await supabase.storage
        .from(mint.bucket)
        .uploadToSignedUrl(mint.storagePath, mint.token, uploadAnotherFile, {
          contentType: uploadAnotherFile.type || undefined,
        });
      if (uploadStorageError) { setUploadAnotherError(uploadStorageError.message); return; }
      // 4. Register in quote_files so it appears in Files & Documents.
      await saveFileMetadata({
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
        // Phase 7: create page only (no area row yet — area created after drawing)
        const pageName = `Plan ${pages.length + 1}`;
        const pageResult = await createTakeoffPage(quote.id, pageName);
        if (!pageResult.ok || !pageResult.pageId) { setUploadAnotherError(pageResult.error || 'Failed to create page.'); return; }
        newPageId = pageResult.pageId; newPageName = pageName;
        newRoofAreaId = null; // will be set after user draws + names the area
      } else {
        // Existing area: create only the page row, link to selected area
        const pageName = `Plan ${pages.length + 1}`;
        const pageResult = await createTakeoffPage(quote.id, pageName);
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
      await finalizeTakeoffPageImage(newPageId, mint.storagePath);
      // 7+8. Parent/child plans (2026-07-05): switch canvas client-side.
      // createObjectURL is immediate and doesn't require re-signing.
      const objectUrl = URL.createObjectURL(uploadAnotherFile);
      const newPage = { id: newPageId, url: objectUrl, name: newPageName, order: pages.length + 1 };
      const updatedPages = [...pages, newPage];

      // Stash the outgoing page's calibration before leaving it.
      const priorPageId = pages[currentPageIndex]?.id ?? null;
      if (priorPageId && calibrations.length > 0) {
        pageCalibrationsRef.current.set(priorPageId, calibrations.map(c => ({ ...c })));
      }

      // Cross-page leak fix (2026-07-08): stamp any un-paged shapes with the
      // page they were drawn on BEFORE switching — same pattern as
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
      console.warn('[calculatePolygonArea] No calibrations available — returning 0');
      return 0;
    }

    // Convert to real-world units using calibration scale
    const avgScale = currentCalibrations.reduce((s, cal) => s + cal.scale, 0) / currentCalibrations.length;
    const realArea = pixelArea * avgScale * avgScale; // scale² for area
    
    // Guard against NaN/Infinity (shouldn't happen with the empty check above, but belt-and-braces)
    if (!isFinite(realArea) || isNaN(realArea)) {
      console.warn('[calculatePolygonArea] Calculated area is NaN/Infinity — returning 0');
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
  // refs. These two were read as raw state — permanently false/null inside the
  // handler — which broke every "+ New Area" route.
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
  // where pages[0].id was undefined (fetched async by initializeTakeoffPage).
  // So fromPageId at draw time was always null. This ref stays in sync so
  // draw-time handlers can read the real current page id.
  const currentPageIdRef = useRef<string | null>(null);
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
  }, [calibrationMode, calibrationPoints, calibrations, areaMode, areaPoints, areaSubTool, lineMode, linePoints, pointMode, multiLinealMode, multiLinealPoints, selectedComponentId, componentColors, isExistingAreaMode, pendingNewAreaIsExisting, pendingNewAreaTargetId, activeAreaId]);

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

    // Start with default dimensions — will be resized once the image loads
    // to match the image's natural dimensions (dynamic canvas sizing).
    const canvas = new Canvas(canvasRef.current, {
      width: 800,
      height: 600,
      backgroundColor: '#1e293b', // slate-800
    });

    fabricRef.current = canvas;

    // Load roof plan image using native Image (handles CORS automatically)
    const imgElement = new Image();
    imgElement.crossOrigin = 'anonymous';
    imgElement.onload = () => {
      // Dynamic canvas sizing: canvas = processed image dimensions, flush top-left.
      const dims = computeCanvasDimensions(imgElement.naturalWidth, imgElement.naturalHeight);
      canvas.setDimensions({ width: dims.width, height: dims.height });
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

      // Image is the canvas background — never selectable, never draggable,
      // never in undo snapshots. Pan/zoom via viewportTransform still works.
      canvas.backgroundImage = fabricImg;
      canvas.renderAll();

      // Auto-fit: scale the canvas to fit the container on initial load.
      // The canvas dimensions = image dimensions (dynamic sizing), so we
      // need to zoom out if the image is larger than the viewport.
      const container = canvasRef.current?.parentElement?.parentElement;
      if (container) {
        const containerWidth = container.clientWidth - 32;
        const containerHeight = container.clientHeight - 32;
        const fitScale = Math.min(containerWidth / dims.width, containerHeight / dims.height, 1);
        if (fitScale < 1) {
          canvas.setZoom(fitScale);
          canvas.viewportTransform = [fitScale, 0, 0, fitScale, 0, 0];
          setZoom(fitScale);
        }
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
      
      // No snapshot here — snapshots are pushed at commit points in React
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
          const currentCalibrations = calibrationsRef.current;
          const avgScale = currentCalibrations.reduce((s, cal) => s + cal.scale, 0) / currentCalibrations.length;
          const realDistance = pixelDistance * avgScale;
          
          console.log('[Line] Calculated:', { pixelDistance, avgScale, realDistance, calibrationCount: currentCalibrations.length });
          
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
            // via refs — this handler is a stale one-shot closure. Priority:
            //   1. component selected          → component-area flow (else-branch below)
            //   2. +New Area → add-to-existing → pitch-only modal
            //   3. +New Area → create new      → AreaNameModal (name + pitch)
            //   4. new-page first boundary     → pitch-only modal
            //   5. upload-to-existing plan     → pitch-only modal (target pre-chosen)
            //   6. first area, fresh takeoff   → AreaNameModal
            //   7. otherwise                   → "Select a component first" alert
            //      ("+ New Area" is the ONLY way to add a roof area without a component)
            if (!currentSelectedId && viaNewAreaFlowRef.current && pendingNewAreaIsExistingRef.current && pendingNewAreaTargetIdRef.current) {
              // "+ New Area" → add to existing — pitch-only modal (shows measured area)
              setPitchOnlyInput('');
              setShowPitchOnlyPrompt(true);
            } else if (!currentSelectedId && viaNewAreaFlowRef.current) {
              // "+ New Area" → create new — AreaNameModal (name + pitch + measured area)
              setShowAreaNamePrompt(true);
            } else if (!currentSelectedId && takeoffMode === 'new-page' && currentRoofAreas.length === 0) {
              // Boundary drawing for a new page - show pitch-only prompt.
              setPitchOnlyInput('');
              setShowPitchOnlyPrompt(true);
            } else if (!currentSelectedId && isExistingAreaModeRef.current) {
              // Upload-to-existing plan: the target area was chosen in the upload
              // modal — pitch-only modal adds this measurement to it.
              setPitchOnlyInput('');
              setShowPitchOnlyPrompt(true);
            } else if (!currentSelectedId && currentRoofAreas.length === 0) {
              // First area on a fresh takeoff — AreaNameModal.
              setShowAreaNamePrompt(true);
            } else if (!currentSelectedId) {
              // Area tool used directly with no component — not allowed.
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

        // Ignore tiny drags (accidental clicks) — under 5px in either dimension.
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
          // "+ New Area" → add to existing — pitch-only modal (shows measured area)
          setPendingComponentId(null);
          setPitchOnlyInput('');
          setShowPitchOnlyPrompt(true);
        } else if (!currentSelectedId && viaNewAreaFlowRef.current) {
          // "+ New Area" → create new — AreaNameModal (name + pitch + measured area)
          setPendingComponentId(null);
          setShowAreaNamePrompt(true);
        } else if (!currentSelectedId && takeoffMode === 'new-page' && currentRoofAreas.length === 0) {
          // Boundary drawing for a new page — pitch-only prompt.
          setPendingComponentId(null);
          setPitchOnlyInput('');
          setShowPitchOnlyPrompt(true);
        } else if (!currentSelectedId && isExistingAreaModeRef.current) {
          // Upload-to-existing plan: target pre-chosen — pitch-only modal.
          setPendingComponentId(null);
          setPitchOnlyInput('');
          setShowPitchOnlyPrompt(true);
        } else if (!currentSelectedId && currentRoofAreas.length === 0) {
          // First area on a fresh takeoff — AreaNameModal.
          setPendingComponentId(null);
          setShowAreaNamePrompt(true);
        } else if (!currentSelectedId) {
          // Area tool used directly with no component — not allowed.
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

    return () => {
      canvas.dispose();
      // Reset the init guard on unmount so re-mounting the component
      // (e.g. a Next route remount) gets a fresh canvas. We don't reset on
      // re-renders - those are exactly what we're guarding against.
      canvasInitedRef.current = false;
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
    return () => { canvas.off('mouse:dblclick', handleDblClick); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [multiLinealMode]);
  
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

  // Zoom controls
  const handleZoomIn = () => {
    if (!fabricRef.current) return;
    const newZoom = Math.min(zoom + 0.1, 5);
    fabricRef.current.setZoom(newZoom);
    setZoom(newZoom);
  };

  const handleZoomOut = () => {
    if (!fabricRef.current) return;
    const newZoom = Math.max(zoom - 0.1, 0.1);
    fabricRef.current.setZoom(newZoom);
    setZoom(newZoom);
  };

  const handleResetZoom = () => {
    if (!fabricRef.current) return;
    fabricRef.current.setZoom(1);
    fabricRef.current.viewportTransform = [1, 0, 0, 1, 0, 0];
    fabricRef.current.requestRenderAll();
    setZoom(1);
  };

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
                  // parent area pitch when the entry had none — never clobber
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

          // Also reset zoom
          canvas.setZoom(1);
          canvas.viewportTransform = [1, 0, 0, 1, 0, 0];
          setZoom(1);

          setIsDirty(false);
          history.clear();
          console.info('[ResetCanvas] Reset to saved takeoff state (reconstructed from DB)');
        };
        imgElement.src = currentPage.url;
      } else {
        // No page URL — just reset zoom
        canvas.setZoom(1);
        canvas.viewportTransform = [1, 0, 0, 1, 0, 0];
        setZoom(1);
      }
    }
  };

  const handleFitToScreen = () => {
    if (!fabricRef.current) return;
    const img = fabricRef.current.backgroundImage;
    if (!img) return;

    // Fit the canvas (which equals image dimensions) into the viewport
    const container = canvasRef.current?.parentElement;
    if (!container) return;
    const containerWidth = container.clientWidth - 32; // padding
    const containerHeight = container.clientHeight - 32;
    const scaleX = containerWidth / canvasDims.width;
    const scaleY = containerHeight / canvasDims.height;
    const scale = Math.min(scaleX, scaleY, 1); // never zoom in beyond 100%

    fabricRef.current.setZoom(scale);
    fabricRef.current.viewportTransform = [scale, 0, 0, scale, 0, 0];
    fabricRef.current.requestRenderAll();
    setZoom(scale);
  };

  // ── AI Takeoff: scan handler ──────────────────────────────────────
  const handleAiScan = async () => {
    const canvas = fabricRef.current;
    if (!canvas || !quote) return;

    const bgImage = canvas.backgroundImage;
    if (!bgImage) {
      setAiScanError('No plan image loaded.');
      return;
    }

    const pageId = pages[currentPageIndex]?.id ?? null;
    if (!pageId) {
      setAiScanError('No active page.');
      return;
    }

    setAiScanning(true);
    setAiScanStage('outline');
    setAiScanError(null);

    try {
      // Send the ORIGINAL plan image to the AI — not a canvas screenshot.
      // The canvas now matches the image dimensions (dynamic sizing), so
      // AI coordinates = canvas coordinates. No letterboxing, no mapping.
      const currentPage = pages[currentPageIndex];
      const imageUrl = currentPage?.url ?? planUrlRef.current;
      if (!imageUrl) {
        setAiScanError('No plan image URL available.');
        return;
      }

      // Fetch the image and convert to base64 data URL
      const imgResponse = await fetch(imageUrl);
      if (!imgResponse.ok) {
        setAiScanError('Failed to load plan image for AI scan.');
        return;
      }
      const imgBlob = await imgResponse.blob();
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(imgBlob);
      });

      const response = await fetch('/api/takeoff/ai-scan-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage: 'outline_skeleton',
          image: dataUrl,
          imageMime: imgBlob.type || 'image/png',
          quoteId: quote.id,
          pageId,
          canvasDimensions: canvasDims,
        }),
      });

      const result = await response.json().catch(() => ({ success: false, error: `Server returned HTTP ${response.status}` }));

      if (!response.ok || !result.success) {
        const errMsg = result.error || `AI scan failed (HTTP ${response.status}).`;
        console.error('[AI Takeoff V2] scan error:', errMsg, result);
        setAiScanError(errMsg);
        return;
      }

      if (result.summary?.unreadable || !result.data?.roof_areas?.length) {
        setAiScanError(result.summary?.notes?.[0] || 'No usable roof outline was detected.');
        return;
      }
      setAiOutlineData(result.data);
      setAiAnalysisImage({ dataUrl, width: canvasDims.width, height: canvasDims.height });
      // Store V2 skeleton data for Scan 2
      if (result.data?.internal_nodes && result.data?.segments) {
        setAiV2Skeleton({
          nodes: result.data.internal_nodes,
          segments: result.data.segments,
        });
      }
      const areaInfos: AiResultsArea[] = (result.data?.roof_areas ?? []).map((area: { name?: string; points?: unknown[]; pitch_degrees?: number | null }, idx: number) => ({
        index: idx,
        name: area.name || `Area ${idx + 1}`,
        pitch: area.pitch_degrees ?? result.data?.pitch?.global_degrees ?? null,
        vertexCount: area.points?.length ?? 0,
      }));
      setAiOutlineAreas(areaInfos);
    } catch (err) {
      console.error('[AI Takeoff] scan failed:', err);
      const msg = err instanceof Error ? err.message : 'Network error.';
      setAiScanError(`Scan failed: ${msg}`);
    } finally {
      setAiScanning(false);
    }
  };

  const handleConfirmAiAreas = async (areaOverrides: Record<number, { name: string; pitch: number }>) => {
    if (!quote || !aiOutlineData || !aiAnalysisImage) return;
    const pageId = pages[currentPageIndex]?.id ?? null;
    if (!pageId) {
      setAiScanError('No active page.');
      return;
    }

    const confirmedAreas = aiOutlineData.roof_areas.map((area, index) => ({
      ...area,
      name: areaOverrides[index]?.name || area.name || `Area ${index + 1}`,
      pitch_degrees: areaOverrides[index]?.pitch ?? area.pitch_degrees ?? 0,
    }));

    setAiScanning(true);
    setAiScanStage('classify');
    setAiScanError(null);
    try {
      const response = await fetch('/api/takeoff/ai-scan-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage: 'classify',
          image: aiAnalysisImage.dataUrl,
          imageMime: 'image/png',
          canvasDimensions: canvasDims,
          quoteId: quote.id,
          pageId,
          confirmedAreas,
          skeletonData: aiV2Skeleton ? {
            nodes: aiV2Skeleton.nodes,
            segments: aiV2Skeleton.segments,
            roof_areas: confirmedAreas,
            unresolved_geometry: [],
            notes: [],
            rejected_segments: [],
          } : null,
          originalImage: aiAnalysisImage.dataUrl,
        }),
      });
      const result = await response.json().catch(() => ({ success: false, error: `Server returned HTTP ${response.status}` }));
      if (!response.ok || !result.success) {
        const violations = Array.isArray(result.topologyViolations)
          ? ` ${result.topologyViolations.join(' ')}` : '';
        setAiScanError(`${result.error || `AI scan failed (HTTP ${response.status}).`}${violations}`);
        return;
      }

      setAiScanRaw(result.data);
      setAiResults({
        summary: result.summary,
        scaleCheck: result.data?.scaleCheck ?? null,
        droppedCount: 0,
        areas: confirmedAreas.map((area, index) => ({
          index,
          name: area.name,
          pitch: area.pitch_degrees,
          vertexCount: area.points.length,
        })),
      });
      setAiOutlineAreas(null);
    } catch (error) {
      setAiScanError(`Component scan failed: ${error instanceof Error ? error.message : 'Network error.'}`);
    } finally {
      setAiScanning(false);
    }
  };

  // V2: Manual components — apply confirmed areas to canvas without AI components
  const handleManualComponents = async (areaOverrides: Record<number, { name: string; pitch: number }>) => {
    const canvas = fabricRef.current;
    if (!canvas || !aiOutlineData || !quote) return;

    const bgImage = canvas.backgroundImage as unknown as { width?: number; height?: number } | null;
    if (!bgImage || !bgImage.width || !bgImage.height) {
      setAiScanError('Plan image not available.');
      return;
    }

    // Build the confirmed areas with overrides
    const confirmedAreas = aiOutlineData.roof_areas.map((area, idx) => ({
      ...area,
      name: areaOverrides[idx]?.name || area.name || `Area ${idx + 1}`,
      pitch_degrees: areaOverrides[idx]?.pitch ?? area.pitch_degrees ?? 0,
    }));

    // Create real DB roof areas
    const areaInputs = confirmedAreas.map(area => ({
      name: area.name,
      pitch: area.pitch_degrees ?? 0,
    }));

    let realAreaIds: string[];
    if (areaInputs.length > 0) {
      const createResult = await batchCreateAiRoofAreas(quote.id, areaInputs);
      if (!createResult.ok || !createResult.areaIds) {
        setAiScanError(createResult.error || 'Failed to create roof areas.');
        return;
      }
      realAreaIds = createResult.areaIds;
    } else {
      realAreaIds = [];
    }

    const areaIdMap = new Map<number, string>();
    realAreaIds.forEach((id, idx) => areaIdMap.set(idx, id));

    // Add roof areas to React state + canvas (same logic as handleApplyAiResults but no components)
    const newRoofAreas: RoofArea[] = confirmedAreas.map((ra, idx: number) => {
      const realId = areaIdMap.get(idx) ?? `ai-area-${idx}`;
      const canvasPoints = ra.points.map(p => ({ x: p.x, y: p.y }));

      const polygon = new Polygon(
        canvasPoints.map(p => ({ x: p.x, y: p.y })),
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

      const markers = canvasPoints.map(p => {
        const marker = new Circle({
          left: p.x, top: p.y, radius: 3,
          fill: '#3b82f6', stroke: '#000', strokeWidth: 1,
          originX: 'center', originY: 'center',
          selectable: false, hasControls: false, hasBorders: false,
        });
        (marker as unknown as { measurementId: string }).measurementId = realId;
        canvas.add(marker);
        return marker;
      });

      // Compute area
      const area = computeAreaValue(canvasPoints, calibrations);

      return {
        id: realId,
        name: ra.name,
        points: canvasPoints,
        area,
        pitch: ra.pitch_degrees ?? 0,
        visible: true,
        polygon,
        markers,
        fromPageId: pages[currentPageIndex]?.id ?? null,
        quoteRoofAreaId: realId,
      } as RoofArea;
    });

    if (newRoofAreas.length > 0) {
      setRoofAreas(prev => [...prev, ...newRoofAreas]);
      setAreaList(prev => [
        ...prev,
        ...newRoofAreas.map(ra => ({
          id: ra.id, label: ra.name, pitch: ra.pitch, area: ra.area,
        })),
      ]);

      // Set the first created area as active so manually-drawn components
      // are stamped with the correct quoteRoofAreaId. Without this, components
      // get stamped with null/old area ID, and clicking the AI area in the
      // sidebar wipes them from the canvas (cache restore loads empty state).
      const firstArea = newRoofAreas[0];
      setActiveAreaId(firstArea.id);
      activeAreaIdRef.current = firstArea.id;
      setActiveSaveRoofAreaId(firstArea.id);
    }

    canvas.renderAll();
    setIsDirty(true);

    // Close modal and clean up
    setAiOutlineAreas(null);
    setAiOutlineData(null);
    setAiAnalysisImage(null);
    setAiV2Skeleton(null);
    setShowRoofAreaInstructions(false);
    roofAreaInstructionsDismissedRef.current = true;
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

    // Determine the target component's colour:
    // - If already active, use its existing colour
    // - If new, assign the next available palette colour
    const existingTargetColour = componentColors.find(c => c.componentId === targetComponentId)?.color;
    const targetColour = existingTargetColour || (() => {
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

  // ── AI Takeoff: apply results to canvas ───────────────────────────
  const handleApplyAiResults = async (areaOverrides: Record<number, { name: string; pitch: number }>) => {
    const canvas = fabricRef.current;
    if (!canvas || !aiScanRaw) return;

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
      aiData: aiScanRaw,
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

    let realAreaIds: string[];
    if (areaInputs.length > 0) {
      const createResult = await batchCreateAiRoofAreas(quote.id, areaInputs);
      if (!createResult.ok || !createResult.areaIds) {
        setAiScanError(createResult.error || 'Failed to create roof areas.');
        return;
      }
      realAreaIds = createResult.areaIds;
    } else {
      realAreaIds = [];
    }

    // Build a mapping: AI area index → real DB area ID
    const areaIdMap = new Map<number, string>();
    realAreaIds.forEach((id, idx) => areaIdMap.set(idx, id));

    // 1. Add roof areas to React state + canvas, using REAL DB IDs
    const newRoofAreas: RoofArea[] = applied.roofAreas.map((ra: AiRoofAreaResult, idx: number) => {
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

      // Vertex markers
      const markers = ra.canvasPoints.map(p => {
        const marker = new Circle({
          left: p.x, top: p.y, radius: 3,
          fill: '#3b82f6', stroke: '#000', strokeWidth: 1,
          originX: 'center', originY: 'center',
          selectable: false, hasControls: false, hasBorders: false,
        });
        (marker as unknown as { measurementId: string }).measurementId = realId;
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

    // 2. Add component measurements to React state + canvas
    // Group by semanticKey → componentId
    const byComponent = new Map<string, { measurements: typeof applied.measurements; semanticKey: SemanticKey }>();
    for (const m of applied.measurements) {
      const existing = byComponent.get(m.componentId);
      if (existing) {
        existing.measurements.push(m);
      } else {
        byComponent.set(m.componentId, { measurements: [m], semanticKey: m.semanticKey });
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
    setAiOutlineData(null);
    setAiAnalysisImage(null);
    setShowRoofAreaInstructions(false);
    roofAreaInstructionsDismissedRef.current = true;
  };

  const handleStartCalibration = () => {
    cleanupBoxDrag();
    // If recalibrating, clear confirmation
    if (calibrationConfirmed) {
      setCalibrationConfirmed(false);
      setCalibrations([]);
    }
    setCalibrationMode(true);
    setCalibrationPoints([]);
    setAreaMode(false);
    setAreaPoints([]);
  };

  const handleConfirmCalibration = () => {
    pushHistorySnapshot();
    console.log('[Calibration] Confirming... current state:', { calibrationConfirmed, showConfirmedFlash });
    setCalibrationConfirmed(true);
    setShowConfirmedFlash(true);
    setCalibrationMode(false); // Turn off calibration mode!
    
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
    
    const updatedCalibrations = [...calibrations, newCalibration];
    setCalibrations(updatedCalibrations);
    
    // Calculate average scale
    const _avgScale = updatedCalibrations.reduce((sum, cal) => sum + cal.scale, 0) / updatedCalibrations.length;
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

  return (
    <>
    <StorageBlockedModal open={storageBlocked} onClose={() => setStorageBlocked(false)} />
    <div className="-my-8 h-[calc(100vh-116px)] bg-gray-50 text-gray-900 flex flex-col p-2 md:p-4 overflow-hidden">
      {/* Back link sits above the canvas card so it never crowds the header */}
      <Link
        href={`/${workspaceSlug}/quotes/${quote.id}`}
        className="mb-2 text-sm text-slate-500 hover:text-slate-800 self-start"
      >
        <svg className="w-4 h-4 inline -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" /></svg> Back to quote
      </Link>
      <div className="flex-1 flex flex-col bg-white rounded-xl shadow-lg overflow-hidden min-h-0">
        {/* Header: title + action buttons only - no nav links */}
        <div className="bg-white border-b border-gray-200 px-2 md:px-6 py-2 md:py-3 flex items-center justify-between">
          <h1 className="text-xl font-semibold">{quote.customer_name} - Digital Takeoff</h1>
        <div className="flex items-center gap-2">
          {/* P1-3: Save current takeoff + upload another plan image. */}
          <button
            onClick={openSaveAndUploadAnotherPlan}
            disabled={isSaving || isUploadingPage}
            className="px-3 py-2 bg-black hover:bg-slate-900 text-white rounded-full text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-[0_0_12px_rgba(249,115,22,0.45)]"
            title={isSaving || isUploadingPage ? 'Please wait — saving in progress' : 'Save current measurements, then upload a new plan to keep measuring'}
          >
            {isSaving || isUploadingPage ? 'Saving…' : 'Upload another plan or image'}
          </button>
          <button
            onClick={handleSaveTakeoff}
            disabled={calibrations.length === 0 || isSaving}
            data-copilot="takeoff-save"
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-[0_0_12px_rgba(249,115,22,0.5)]"
            title={calibrations.length === 0 ? 'Calibrate the plan first' : ''}
          >
            {isSaving ? 'Saving...' : 'Finish and Save'}
          </button>
        </div>
      </div>

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
              guidance = 'Create a custom box shape area, click and hold, drag then release to set the area';
            } else if (selCompType === 'volume_3d') {
              guidance = 'Click and drag to draw the footprint (L × W). Release to set the area, then enter the depth.';
            } else {
              guidance = 'Create a custom box shape area, click and hold, drag then release to set the area.';
            }
          } else {
            if (!selectedComponentId) {
              guidance = 'Draw the area point by point (at least 3 points), to close the area - click back on the first point';
            } else if (selCompType === 'volume_3d') {
              guidance = 'Draw the footprint (L × W). Close the shape on the first point, then enter the depth in the prompt.';
            } else {
              guidance = 'Draw the area point by point (at least 3 points), to close the area - click back on the first point.';
            }
          }
        } else if (lineMode) {
          guidance = 'Click two points to measure a length - confirm. Add multiple lines for the same component.';
        } else if (multiLinealMode) {
          guidance = 'Click to trace a path with multiple segments. Double-click or press Finish to complete.';
        } else if (pointMode) {
          guidance = 'Click on the plan to count this item. Each click adds one.';
        }
        if (!guidance && pages.length <= 1) return null;
        return (
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-50">
            {pages.length > 1 && (
              <>
                <span className="text-xs text-slate-500">Plan</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-500 text-white">
                  {currentPageIndex + 1} of {pages.length}
                </span>
                <span className="text-xs text-slate-400 mr-1">{pages[currentPageIndex]?.name}</span>
                {guidance && <span className="text-xs text-slate-300">·</span>}
              </>
            )}
            {guidance && (
              <span className="text-xs text-slate-500 italic flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-orange-400">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="16" x2="12" y2="12"/>
                  <line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
                {guidance}
              </span>
            )}
          </div>
        );
      })()}

      {/* P1-3: Save & Upload another plan modal.
          Mirrors FilesManager Options B (existing area) and C (new area)
          but stays inside the workstation - saves current measurements,
          uploads the new plan, then reloads to mode=new-page with the new page.*/}
      {showUploadAnotherModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
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
                      This plan becomes a numbered slot under the selected area. Just calibrate and measure — everything rolls into that area.
                    </p>
                    {uploadAnotherTarget === 'existing' && (
                      <select
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

              {/* Option 2: new area (no name upfront — collected after drawing) */}
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
                      Calibrate the new plan, then draw the area boundary — you'll name it when you close the shape. No extra clicks needed.
                    </p>
                  </div>
                </div>
              </label>

                            <div className="mb-3">
                <label className="block text-xs font-medium text-slate-700 mb-1">Plan / image</label>
                {uploadAnotherFile ? (
                  <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-xs text-slate-700 flex-1 truncate">{uploadAnotherFile.name}</span>
                    <button
                      type="button"
                      onClick={() => setUploadAnotherFile(null)}
                      className="text-xs text-red-500 hover:text-red-700 flex-shrink-0"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 w-full px-3 py-2 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-orange-400 transition-colors">
                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs text-slate-500">Choose plan (PDF or image, max 10 MB)</span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0] || null;
                        if (f && f.size > 10485760) {
                          setUploadAnotherError('File exceeds 10 MB limit.');
                          return;
                        }
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
                <button
                  type="button"
                  onClick={() => setShowUploadAnotherModal(false)}
                  disabled={isUploadingPage}
                  className="flex-1 py-2.5 text-sm font-medium text-slate-700 border border-slate-300 rounded-full hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSaveAndUploadAnother}
                  disabled={isUploadingPage}
                  className="flex-1 py-2.5 text-sm font-medium text-white bg-black rounded-full hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  {isUploadingPage ? 'Saving…' : 'Upload plan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-hidden min-h-0 grid grid-cols-[320px_1fr]">
        {/* Left Sidebar - Calibration, Roof Areas & Components */}
        <div className="bg-white border-r border-gray-200 overflow-y-auto flex flex-col min-h-0" data-copilot="takeoff-sidebar">
          <div className="p-4 space-y-5">

          {/* Calibration Section - Show if: not confirmed, calibration mode, or showing flash */}
          {(!calibrationConfirmed || calibrationMode || showConfirmedFlash) && (
            <div>
              <h2 className="text-sm font-bold mb-3 text-gray-900 uppercase tracking-wide">Calibration</h2>
              {calibrations.length === 0 ? (
                <div className="text-sm text-gray-700 font-medium bg-amber-50 border border-amber-200 rounded-xl p-3">
                  ⚠️ Calibrate first to continue
                </div>
              ) : showConfirmedFlash ? (
                /* Flash green confirmation briefly */
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 animate-pulse">
                  <div className="text-green-400 font-bold mb-2 flex items-center gap-1"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m4.5 12.75 6 6 9-13.5" /></svg> Confirmed</div>
                  <div className="text-xs text-gray-600 mb-1">Scale</div>
                  <div className="font-bold text-green-400">
                    {(calibrations.reduce((sum, cal) => sum + cal.scale, 0) / calibrations.length).toFixed(4)} {calibrations[0].unit}/px
                  </div>
                </div>
              ) : (
              /* Not confirmed - Show details + Confirm button */
              <div className="space-y-2">
                {/* Average Scale Display */}
                <div className="p-3 rounded-xl bg-white border border-orange-400">
                  <div className="text-xs text-gray-600 mb-1">Average Scale</div>
                  <div className="font-bold text-gray-700">
                    {(calibrations.reduce((sum, cal) => sum + cal.scale, 0) / calibrations.length).toFixed(4)} {calibrations[0].unit}/px
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    Based on {calibrations.length} measurement{calibrations.length > 1 ? 's' : ''}
                  </div>
                </div>

                {/* Individual Calibrations */}
                {calibrations.map((cal, idx) => (
                  <div key={cal.id} className="p-2 rounded-xl text-sm bg-gray-100">
                    <div className="font-medium">#{idx + 1}: {cal.actualDistance} {cal.unit}</div>
                    <div className="text-xs text-gray-600">{cal.scale.toFixed(4)} {cal.unit}/px</div>
                  </div>
                ))}

                {/* Confirm Button */}
                <button
                  onClick={handleConfirmCalibration}
                  className="w-full px-3 py-2 bg-black hover:bg-slate-800 text-white rounded-full text-sm font-medium transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
                >
                  <svg className="w-4 h-4 inline -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m4.5 12.75 6 6 9-13.5" /></svg> Confirm Calibration
                </button>
              </div>
              )}
            </div>
          )}

          {/* Batch 3: Area Switcher — left panel shows all areas for the quote.
              Click an area to switch the canvas + component list. */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-900">{quoteIsGeneric ? 'Areas' : 'Roof Areas'}</h2>
                <button
                  onClick={handleCreateNewArea}
                  disabled={false}
                  className="text-xs font-medium text-[#FF6B35] hover:text-orange-600"
                  title="Create a new area"
                >
                  + New Area
                </button>
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
                    <div
                      key={area.id}
                      onClick={() => handleSwitchArea(area.id)}
                      className={`w-full text-left px-3 py-2 rounded-xl border transition-all cursor-pointer ${
                        isActive ? 'border-[#FF6B35] bg-orange-50 shadow-[0_0_0_1px_rgba(255,107,53,0.15)]' : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900 truncate">{area.label}</span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {isActive && <span className="w-2 h-2 rounded-full bg-[#FF6B35]" />}
                          {matchingAreas.length > 0 && (
                            <>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleToggleAreaVisibility(area.id); }}
                                className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                                title={matchingAreas[0].visible ? 'Hide' : 'Show'}
                              >
                                {matchingAreas[0].visible ? (
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                ) : (
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"/></svg>
                                )}
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteArea(area.id); }}
                                className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                                title="Delete area"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" /></svg>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      {displayValue > 0 && <span className="text-xs text-gray-500">{displayValue.toFixed(2)} {displayUnit}</span>}
                      {/* Parent/child plans (2026-07-05): numbered chips, one
                          per plan attached to this area. Click = view that
                          plan's image + drawings. Components stay parent-level. */}
                      {(areaPages[area.id]?.length ?? 0) > 1 && (
                        <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mr-0.5">Plans</span>
                          {areaPages[area.id].map((pid, i) => {
                            const pIdx = pages.findIndex(p => p.id === pid);
                            const isCurrentChip = isActive && pIdx === currentPageIndex;
                            return (
                              <button
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
                                title={`View plan ${i + 1} for ${area.label}`}
                              >
                                {i + 1}
                              </button>
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
              <h2 className="text-sm font-bold mb-4 text-gray-900" data-copilot="takeoff-components-heading">Components</h2>
              {displayComponents.length === 0 ? (
                <div className="text-sm text-gray-500">No components in library</div>
              ) : (
                <div className="space-y-5">

                  {/* Active Components */}
                  {activeComponentIds.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Active Components</span>
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
                          const typeLabel = mt === 'line' ? 'Line' : mt === 'area' ? 'Area' : mt === 'point' ? 'Count' : mt === 'multi_lineal' ? 'Multi-line' : mt === 'multi_lineal_lxh' ? 'Multi-line ×H' : mt === 'volume_3d' ? 'Volume' : mt === 'length_x_height_freestyle' ? 'Length ×H' : mt === 'multi_lineal_lxh_freestyle' ? 'Multi-line ×H' : mt || '';
                          return (
                            <div
                              key={comp.id}
                              className={`bg-white rounded-xl border overflow-hidden transition-all ${
                                isSelected
                                  ? 'border-[#FF6B35] shadow-[0_0_0_1px_rgba(255,107,53,0.2),0_0_8px_rgba(255,107,53,0.1)]'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <div className="flex">
                                {/* Colored left bar - full height */}
                                <div
                                  className="w-1.5 flex-shrink-0"
                                  style={{ backgroundColor: assignment?.color || '#94a3b8' }}
                                />
                                {/* Card body */}
                                <div className="flex-1 min-w-0 p-3">
                                  {/* Header row */}
                                  <div
                                    className="flex items-start gap-2 cursor-pointer"
                                    onClick={() => {
                                      setSelectedComponentId(comp.id);
                                      // P1-2: auto-switch tool when clicking an active component.
                                      // Pass comp.id so activeAreaComponentIdRef is set synchronously.
                                      applyToolForType(mt, comp.id);
                                    }}
                                  >
                                    <div className="flex-1 min-w-0">
                                      <div className="text-sm text-gray-900">{comp.name}</div>
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                                      {/* Measurement count badge */}
                                      {compData && compData.measurements.length > 0 && (
                                        <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 font-medium tabular-nums">{compData.measurements.length}</span>
                                      )}
                                      {compData && compData.measurements.length > 0 && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setComponentMeasurements(componentMeasurements.map(c =>
                                              c.componentId === id ? { ...c, expanded: !c.expanded } : c
                                            ));
                                          }}
                                          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                                          title={compData?.expanded ? 'Collapse' : 'Expand'}
                                        >
                                          {compData?.expanded
                                            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="18 15 12 9 6 15"/></svg>
                                            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="6 9 12 15 18 9"/></svg>
                                          }
                                        </button>
                                      )}
                                      {/* Trash - remove component */}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleRemoveComponent(comp.id);
                                        }}
                                        className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                                        title="Remove component"
                                      >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                                      </button>
                                    </div>
                                  </div>

                                  {/* AI Placeholder: Attach real component */}
                                  {comp.is_system && compData && compData.measurements.length > 0 && (() => {
                                    const semanticKey = resolveSemanticKey(comp.name);
                                    if (!semanticKey) return null;
                                    // Show ALL non-system components so the user has full library access
                                    const compatibleComps = displayComponents
                                      .filter(c => !c.is_system);
                                    if (compatibleComps.length === 0) return null;
                                    return (
                                      <div className="mt-2 mb-1">
                                        <div className="text-[10px] font-semibold text-orange-600 uppercase tracking-wider mb-1">
                                          ⚡ AI Placeholder — attach a real component
                                        </div>
                                        <select
                                          onChange={(e) => {
                                            if (e.target.value) {
                                              handleReplacePlaceholder(comp.id, e.target.value);
                                              e.target.value = '';
                                            }
                                          }}
                                          defaultValue=""
                                          className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300 focus:border-orange-500 focus:outline-none bg-white text-gray-700"
                                        >
                                          <option value="">Attach component…</option>
                                          {compatibleComps.map(c => (
                                            <option key={c.id} value={c.id}>
                                              {c.name}{activeComponentIds.includes(c.id) ? ' (already active — merge)' : ''}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    );
                                  })()}

                                  {/* Measurements list (expanded) */}
                                  {compData && compData.expanded && compData.measurements.length > 0 && (
                                    <div className="mt-2 pt-2 border-t border-gray-100">
                                      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Measurements{typeLabel ? ` (${typeLabel})` : ''}</div>
                                      <div className="space-y-1">
                                        {compData.measurements.map((m) => (
                                          <div
                                            key={m.id}
                                            className="flex items-center gap-1.5 text-xs text-gray-700"
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
                                              {m.type === 'multi_lineal_lxh' && `${m.value.toFixed(2)} ${calibrations[0]?.unit || 'ft'} ×h`}
                                              {m.type === 'area' && `${m.value.toFixed(2)} sq ${calibrations[0]?.unit || 'ft'}`}
                                              {m.type === 'point' && `1 item`}
                                              {(m.type === 'length_x_height_freestyle' || m.type === 'multi_lineal_lxh_freestyle') && `${m.value.toFixed(2)} ${calibrations[0]?.unit || 'ft'} ×h`}
                                              {m.type === 'volume_3d' && `${m.value.toFixed(2)} sq ${calibrations[0]?.unit || 'ft'}`}
                                            </span>
                                            <button
                                              onClick={() => handleToggleMeasurementVisibility(id, m.id)}
                                              className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
                                              title={m.visible ? 'Hide' : 'Show'}
                                            >
                                              {m.visible ? (
                                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                              ) : (
                                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"/></svg>
                                              )}
                                            </button>
                                            <button
                                              onClick={() => handleDeleteMeasurement(id, m.id)}
                                              className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors text-base leading-none"
                                              title="Delete measurement"
                                            >
                                              ×
                                            </button>
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

                  {/* Add Components */}
                  <div>
                    <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3 block">Add Components</span>

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
                        placeholder="Search components..."
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
                            <button
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
                            </button>
                          ))}
                        </div>
                      );
                    })()}

                    {/* Info tip */}
                    <div className="mt-4 p-3 bg-blue-50 rounded-xl flex items-start gap-2">
                      <svg className="flex-shrink-0 mt-0.5 text-blue-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                      <p className="text-xs text-gray-500 italic">Click on the plan to count this item. Each click adds one.</p>
                    </div>
                  </div>

                </div>
              )}
            </div>
          )}

          </div>
        </div>
        {/* Center - Canvas */}
        <div className="flex flex-col relative bg-gray-50 overflow-hidden min-h-0">
          {/* Hidden marker: copilot only starts after first roof area created */}
          {roofAreas.length > 0 && <div data-copilot="takeoff-ready" className="hidden" />}

          {/* Top Toolbar */}
          <div className="flex-shrink-0 mx-4 mt-1 mb-0 flex items-center justify-between bg-white border border-gray-200 rounded-xl p-2 shadow-sm" data-copilot="takeoff-toolbar">
            {/* Tools - Fix 7: Calibrate, Area, Line, Point. Sub-tools conditional. */}
            <div className="flex gap-2 items-center">
              <button
                onClick={handleStartCalibration}
                data-copilot="takeoff-tool-calibrate"
                className={`px-3 py-2 rounded-full text-sm flex items-center gap-2 ${
                  calibrationMode ? 'bg-orange-100 hover:bg-orange-200 text-orange-700 border border-orange-500'
                  : calibrationConfirmed ? 'bg-gray-200 hover:bg-gray-300' : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                {calibrationConfirmed ? 'Recalibrate' : 'Calibrate'}
              </button>
              <button
                onClick={() => {
                  if (areaMode) { cleanupBoxDrag(); setAreaMode(false); setAreaPoints([]); }
                  else { setAreaMode(true); setLineMode(false); setPointMode(false); setMultiLinealMode(false); setMultiLinealPoints([]); setMultiLinealSegmentObjects([]); setAreaPoints([]); }
                }}
                disabled={calibrationMode || calibrations.length === 0}
                data-copilot="takeoff-tool-area"
                className={`px-3 py-2 rounded-full text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                  areaMode ? 'bg-orange-100 border border-orange-500 text-orange-700' : 'bg-gray-100 hover:bg-gray-200 border-2 border-transparent'
                }`}
                title={calibrations.length === 0 ? 'Calibrate first' : 'Measure roof area'}
              >Area</button>
              {areaMode && (
                <div className="flex items-center rounded-full bg-gray-100 p-0.5">
                  <button onClick={() => { cleanupBoxDrag(); setAreaSubTool('polygon'); setAreaPoints([]); }}
                    className={`px-2 py-1 rounded-full text-xs font-medium ${areaSubTool === 'polygon' ? 'bg-slate-900 text-white' : 'text-gray-500 hover:text-gray-700'}`}
                    title="Point by point, click first point to close"
                  >Polygon</button>
                  <button onClick={() => { cleanupBoxDrag(); setAreaSubTool('rect'); setAreaPoints([]); }}
                    className={`px-2 py-1 rounded-full text-xs font-medium ${areaSubTool === 'rect' ? 'bg-slate-900 text-white' : 'text-gray-500 hover:text-gray-700'}`}
                    title="Click and drag to create box"
                  >Rectangle</button>
                </div>
              )}
              <button
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
                className={`px-3 py-2 rounded-full text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                  (lineMode || multiLinealMode) ? 'bg-orange-100 border border-orange-500 text-orange-700' : 'bg-gray-100 hover:bg-gray-200 border-2 border-transparent'
                }`}
                title="Measure line or polyline"
              >Line</button>
              {(lineMode || multiLinealMode) && (
                <div className="flex items-center rounded-full bg-gray-100 p-0.5">
                  <button onClick={() => { setLineSubTool('single'); if (multiLinealMode) { handleCancelMultiLineal(); setLineMode(true); } }}
                    className={`px-2 py-1 rounded-full text-xs font-medium ${lineSubTool === 'single' ? 'bg-slate-900 text-white' : 'text-gray-500 hover:text-gray-700'}`}
                    title="Two-point line"
                  >Single</button>
                  <button onClick={() => { setLineSubTool('multi'); if (lineMode) { setLineMode(false); setLinePoints([]); setMultiLinealMode(true); } }}
                    className={`px-2 py-1 rounded-full text-xs font-medium ${lineSubTool === 'multi' ? 'bg-slate-900 text-white' : 'text-gray-500 hover:text-gray-700'}`}
                    title="Multi-point polyline"
                  >Multi</button>
                </div>
              )}
              <button
                onClick={() => {
                  if (!quoteIsGeneric) { const h = roofAreas.length > 0 && roofAreas.some(a => a.pitch > 0); if (!h) { showAlert('Roof area required', 'Create a roof area with pitch first.', 'info'); return; } }
                  if (!selectedComponentId) { showAlert('Select a component first', 'Pick a component from the list.', 'info'); return; }
                  setPointMode(!pointMode); cleanupBoxDrag(); setLineMode(false); setAreaMode(false); setMultiLinealMode(false); setMultiLinealPoints([]); setMultiLinealSegmentObjects([]);
                }}
                disabled={calibrationMode || calibrations.length === 0 || (!quoteIsGeneric && (roofAreas.length === 0 || !roofAreas.some(a => a.pitch > 0)))}
                data-copilot="takeoff-tool-point"
                className={`px-3 py-2 rounded-full text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                  pointMode ? 'bg-orange-100 border border-orange-500 text-orange-700' : 'bg-gray-100 hover:bg-gray-200 border-2 border-transparent'
                }`}
                title="Add point marker"
              >Point</button>
                        </div>

            {/* Phase 7: Multi-lineal in-progress readout floats below the toolbar
                (see banner block further down) so it never reflows the tool buttons
                or zoom controls when the user is mid-polyline. */}

            {/* Zoom Controls - Right Side */}
            <div className="flex items-center gap-1">
              <button
                onClick={handleZoomOut}
                className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm"
              >
                −
              </button>
              <span className="px-1 py-1 text-sm tabular-nums">{Math.round(zoom * 100)}%</span>
              <button
                onClick={handleZoomIn}
                className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-sm"
              >
                +
              </button>
              <button
                onClick={() => setShowResetConfirm(true)}
                className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-sm"
                title="Reset canvas to starting state"
              >
                Reset
              </button>
              {/* Canvas-rework: Undo/Redo buttons */}
              <div className="w-px h-5 bg-gray-300 mx-1" />
              <button
                onClick={handleUndo}
                disabled={!history.canUndo}
                className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-sm disabled:opacity-30 disabled:cursor-not-allowed"
                title="Undo"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" /></svg>
              </button>
              <button
                onClick={handleRedo}
                disabled={!history.canRedo}
                className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-sm disabled:opacity-30 disabled:cursor-not-allowed"
                title="Redo"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m15 15 6-6m0 0-6-6m6 6H9a6 6 0 0 0 0 12h3" /></svg>
              </button>
            </div>
          </div>

          {/* Phase 7: Multi-lineal in-progress floating banner. DRAGGABLE so it
              never blocks the canvas where the user needs to click. Drag from
              the grip handle on the left; buttons remain clickable. */}
          {multiLinealMode && multiLinealPoints.length >= 1 && (() => {
            const avgScale = calibrations.reduce((s, cal) => s + cal.scale, 0) / (calibrations.length || 1);
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
                  className="flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-300 rounded-full text-sm shadow-md cursor-grab active:cursor-grabbing select-none"
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
                  <button
                    onClick={handleFinishMultiLineal}
                    disabled={multiLinealPoints.length < 2}
                    className="px-3 py-1 bg-orange-500 text-white rounded-full text-xs font-medium hover:bg-orange-600 disabled:opacity-40"
                  >
                    Finish
                  </button>
                  <button
                    onClick={handleCancelMultiLineal}
                    className="px-2 py-1 bg-gray-200 text-gray-700 rounded-full text-xs hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Canvas */}
          <div className="flex-1 flex flex-col items-start justify-start p-2 md:p-6 md:pt-4 overflow-auto min-h-0">
            <div className="border-2 border-gray-200 rounded-lg">
              <canvas ref={canvasRef} />
            </div>
            <p className="mt-2 text-center text-xs text-slate-400">
              {calibrationMode
                ? `Click ${calibrationPoints.length === 0 ? 'first' : 'second'} point to calibrate`
                : 'Hold Alt + Drag to pan'}
            </p>
          </div>
        </div>
      </div>

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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-4 md:p-6 max-w-sm border border-gray-200 shadow-xl">
            <h2 className="text-lg font-semibold mb-1">Calibration complete</h2>
            {takeoffMode === 'new-page' && initialPageName ? (
              <p className="text-sm text-slate-500 mb-4">
                You can draw and measure the area boundary for &ldquo;{initialPageName}&rdquo;, or skip
                and go straight to adding components. You can always add dimensions manually
                in the area step of the quote builder.
              </p>
            ) : (
              <p className="text-sm text-slate-500 mb-4">
                You can draw and measure an area now, or skip and go straight to adding
                components. You can always add area dimensions manually in the quote builder.
              </p>
            )}
            {tradeConfig.toolGuidanceNote && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                {tradeConfig.toolGuidanceNote}
              </div>
            )}
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <button
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
                  title="Draw the area point by point (at least 3 points), to close the area - click back on the first point"
                >
                  Draw Area · Polygon
                </button>
                <button
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
                  title="Create a custom box shape area, click and hold, drag then release to set the area"
                >
                  Draw Area · Rectangle
                </button>
              </div>
              {aiTakeoffAvailable && (
                <button
                  onClick={() => {
                    setShowRoofAreaInstructions(false);
                    roofAreaInstructionsDismissedRef.current = true;
                    handleAiScan();
                  }}
                  className="py-2.5 text-sm font-medium text-white bg-[#FF6B35] rounded-full hover:bg-[#E55A2B] transition-colors flex items-center justify-center gap-1.5"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a4 4 0 0 1 4 4c0 1.95-1.4 3.58-3.25 3.93L12 10l-.75-.07C9.4 9.58 8 7.95 8 6a4 4 0 0 1 4-4z"/><path d="M2 22v-2a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v2"/><path d="M12 13v3"/></svg>
                  Use AI Assist
                </button>
              )}
              <button
                onClick={() => {
                  setShowRoofAreaInstructions(false);
                  roofAreaInstructionsDismissedRef.current = true;
                }}
                className="py-2.5 text-sm font-medium text-slate-700 border border-slate-300 rounded-full hover:bg-slate-50 transition-colors"
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Initial Calibration Help */}
      {showCalibrationHelp && calibrations.length === 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-4 md:p-6 max-w-md border border-gray-200">
            <h2 className="text-xl font-semibold mb-4">📐 Calibrate Your Plan</h2>
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
            <button
              onClick={() => {
                setShowCalibrationHelp(false);
                // Auto-start calibration mode
                setCalibrationMode(true);
              }}
              className="mt-6 w-full px-4 py-2 bg-black hover:bg-slate-800 text-white rounded-full font-medium transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
            >
              Got it, let&apos;s calibrate!
            </button>
          </div>
        </div>
      )}

      {/* Volume (L × W × D) depth prompt - fires after area polygon is closed for a volume_3d component */}
      {showVolumeDepthPrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-4 md:p-6 w-80 border border-gray-200 shadow-xl">
            <h2 className="text-lg font-semibold mb-1">Enter Depth</h2>
            <p className="text-sm text-slate-500 mb-4">
              Footprint drawn. Now enter the depth to calculate volume ({calibrations[0]?.unit === 'feet' ? 'ft' : 'm'}).
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Depth ({calibrations[0]?.unit === 'feet' ? 'ft' : 'm'})
              </label>
              <input
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
              <button
                onClick={handleConfirmVolumeDepth}
                disabled={!volumeDepthInput || parseFloat(volumeDepthInput) <= 0}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-black rounded-full hover:bg-slate-800 disabled:opacity-40 transition-colors"
              >
                {volumeDepthInput && parseFloat(volumeDepthInput) > 0
                  ? `Confirm ${parseFloat(volumeDepthInput).toFixed(2)} ${calibrations[0]?.unit === 'feet' ? 'ft' : 'm'} depth`
                  : 'Enter a depth'}
              </button>
              <button
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
              </button>
            </div>
          </div>
        </div>
      )}

      {/* P1-1b pitch-only prompt for new-page mode (first area boundary drawn) */}
      {showPitchOnlyPrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
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
              <PitchInput
                degrees={pitchOnlyDegrees}
                onSave={(deg) => setPitchOnlyDegrees(deg)}
                label={tradeConfig.pitchRequired ? 'Pitch' : 'Slope / Angle'}
                required={tradeConfig.pitchRequired}
                autoFocus
                className="block"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowPitchOnlyPrompt(false);
                  const pitch = pitchOnlyDegrees ?? 0;
                  handleSaveArea(isExistingAreaMode ? existingAreaLabel : (initialPageName || 'New Area'), pitch);
                }}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-black rounded-full hover:bg-slate-800 transition-colors"
              >
                {pitchOnlyDegrees != null ? `Save at ${pitchOnlyDegrees.toFixed(1).replace(/\.0$/, '')}°` : 'Save (0° flat)'}
              </button>
              <button
                onClick={() => {
                  setShowPitchOnlyPrompt(false);
                  setPendingAreaPoints([]);
                  setAreaPoints([]);
                  viaNewAreaFlowRef.current = false; // RC-5: cancel resets the flow flag
                }}
                className="flex-1 py-2.5 text-sm font-medium text-slate-700 border border-slate-300 rounded-full hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
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
                      <select
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
                <button
                  type="button"
                  onClick={() => setShowNewAreaChoiceModal(false)}
                  className="flex-1 py-2.5 text-sm font-medium text-slate-700 border border-slate-300 rounded-full hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmNewAreaChoice}
                  className="flex-1 py-2.5 text-sm font-medium text-white bg-black rounded-full hover:bg-slate-800 transition-colors"
                >
                  Draw Area
                </button>
              </div>
            </div>
          </div>
        </div>
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
              fromPageId: currentPageIdRef.current, // stamp page at draw time (ref — stale-closure fix)
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
              fromPageId: currentPageIdRef.current, // stamp page at draw time (ref — stale-closure fix)
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
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
              <input
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
              <button
                onClick={handleConfirmFreestyleHeight}
                disabled={!freestyleHeightInput || parseFloat(freestyleHeightInput) <= 0}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-black rounded-full hover:bg-slate-800 disabled:opacity-40 transition-colors"
              >
                {freestyleHeightInput && parseFloat(freestyleHeightInput) > 0
                  ? `Confirm ${parseFloat(freestyleHeightInput).toFixed(2)} ${calibrations[0]?.unit === 'feet' ? 'ft' : 'm'} height`
                  : 'Enter a height'}
              </button>
              <button
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
              </button>
            </div>
          </div>
        </div>
      )}

      {/* App-style alert replaces native alert() across this workstation. */}
      {/* Reset Canvas confirm modal */}
        <ConfirmModal
          open={showResetConfirm}
          title="Reset Canvas?"
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
          open={showAreaDeleteConfirm}
          title={`Delete "${pendingDeleteAreaLabel}"?`}
          description="This deletes the area and all its components and measurements. This cannot be undone."
          confirmLabel={isDeletingArea ? 'Deleting…' : 'Delete'}
          destructive={true}
          onCancel={() => { setShowAreaDeleteConfirm(false); setPendingDeleteAreaId(null); }}
          onConfirm={handleConfirmDeleteArea}
        />
        <AlertModal
        open={alertState.open}
        title={alertState.title}
        description={alertState.description}
        variant={alertState.variant}
        onClose={closeAlert}
      />

      {/* AI Takeoff: scanning overlay */}
      {aiScanning && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/40 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-2xl p-6 max-w-sm border border-gray-200 shadow-xl text-center">
            <div className="inline-block w-8 h-8 border-3 border-slate-200 border-t-[#FF6B35] rounded-full animate-spin mb-3" />
            <h3 className="text-sm font-semibold text-slate-900">
              {aiScanStage === 'outline' ? 'Finding roof areas…' : 'Finding connected roof components…'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">This may take a few moments.</p>
          </div>
        </div>
      )}

      {/* AI Takeoff: error toast */}
      {aiScanError && !aiScanning && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] bg-red-600 text-white text-xs px-4 py-2 rounded-full shadow-lg animate-fade-in">
          {aiScanError}
          <button
            onClick={() => setAiScanError(null)}
            className="ml-2 underline opacity-80 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {aiOutlineAreas && aiOutlineData && aiAnalysisImage && !aiResults && (
        <AiAreaReviewModal
          areas={aiOutlineAreas}
          notes={aiOutlineData.notes}
          previewImage={aiAnalysisImage.dataUrl}
          outlines={aiOutlineData.roof_areas}
          canvasWidth={canvasDims.width}
          canvasHeight={canvasDims.height}
          onConfirm={handleConfirmAiAreas}
          onDiscard={() => {
            setAiOutlineAreas(null);
            setAiOutlineData(null);
            setAiAnalysisImage(null);
            setAiV2Skeleton(null);
          }}
          onManualComponents={handleManualComponents}
        />
      )}

      {/* AI Takeoff: results modal */}
      {aiResults && aiScanRaw && (
        <AiResultsModal
          data={{ ...aiResults, droppedCount: aiResults.droppedCount }}
          onApply={(areaOverrides) => handleApplyAiResults(areaOverrides)}
          onDiscard={() => {
            setAiResults(null);
            setAiScanRaw(null);
            setAiOutlineData(null);
            setAiAnalysisImage(null);
          }}
        />
      )}
    </div>
    </div>
    </>
  );
}

// Area Name Modal - isRoofing controls whether pitch is shown/required.
// modalTitle + namePlaceholder are trade-config-driven.
