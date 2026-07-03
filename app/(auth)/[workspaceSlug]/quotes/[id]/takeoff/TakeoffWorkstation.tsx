'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Canvas, FabricImage, Line, Circle, Polygon, Triangle, Rect } from 'fabric';
import type { QuoteRow } from '@/app/lib/types';
import { normalizeMeasurementSystem } from '@/app/lib/types';
import { saveTakeoffMeasurements, createTakeoffPage, createTakeoffPageForArea, initializeTakeoffPage, finalizeTakeoffPageImage, getFirstRoofAreaId } from './actions';
import { toolForMeasurementType } from '@/app/lib/takeoff/tool-for-measurement-type';
import { useStateHistory } from '@/app/lib/takeoff/useStateHistory';
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
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

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
  componentMeasurements: { componentId: string; expanded: boolean; measurements: { id: string; type: ComponentMeasurement['type']; value: number; points?: { x: number; y: number }[]; visible: boolean; fromPageId?: string | null }[] }[];
  roofAreas: { id: string; name: string; points: { x: number; y: number }[]; area: number; pitch: number; visible: boolean }[];
  calibrations: Calibration[];
  calibrationPoints: CalibrationPoint[];
  calibrationConfirmed: boolean;
  calibrationMode: boolean;
  areaMode: boolean;
  areaPoints: { x: number; y: number }[];
  areaSubTool: 'polygon' | 'rect';
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

  // Issue 4+5: Area-assignment modal for new roof areas drawn in mode=add.
  // When the user closes a new area polygon while editing an existing plan,
  // this modal lets them pick which existing area to add the measurement to,
  // or create a new area.
  const [showAreaAssignmentModal, setShowAreaAssignmentModal] = useState(false);
  const [pendingNewArea, setPendingNewArea] = useState<{ points: { x: number; y: number }[]; area: number } | null>(null);
  const [areaAssignmentChoice, setAreaAssignmentChoice] = useState<string>('');
  const [areaAssignmentNewName, setAreaAssignmentNewName] = useState('');

  // P1-3 (multi-page Save & Upload another plan): modal state.
  // - target = 'existing' attaches the new page to the FIRST existing roof area
  //   (mirrors FilesManager Option B: new page, same area target).
  // - target = 'new' creates a new roof area + new page with the uploaded plan
  //   (mirrors FilesManager Option C: new area, new plan).
  const [showUploadAnotherModal, setShowUploadAnotherModal] = useState(false);
  const [uploadAnotherTarget, setUploadAnotherTarget] = useState<'existing' | 'new'>('existing');
  const [uploadAnotherAreaName, setUploadAnotherAreaName] = useState('');
  const [uploadAnotherFile, setUploadAnotherFile] = useState<File | null>(null);
  const [uploadAnotherError, setUploadAnotherError] = useState<string | null>(null);
  const [storageBlocked, setStorageBlocked] = useState(false);
  // Reset canvas confirm modal
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isUploadingPage, setIsUploadingPage] = useState(false);
  // H-03: track unsaved changes so we can warn before switching pages.
  const [isDirty, setIsDirty] = useState(false);

  // P1-1a: session version for optimistic concurrency guard.
  const [sessionVersion, setSessionVersion] = useState<number | null>(
    hydrationData?.sessionVersion ?? null,
  );
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
  const [areaPoints, setAreaPoints] = useState<{ x: number; y: number }[]>([]);
  const [_tempAreaPolygon, _setTempAreaPolygon] = useState<any>(null);
  const [showAreaNamePrompt, setShowAreaNamePrompt] = useState(false);
  // P1-1b new-page mode: pitch-only prompt after drawing the first area boundary.
  // Bypasses AreaNameModal entirely so the name never has to be re-typed.
  const [showPitchOnlyPrompt, setShowPitchOnlyPrompt] = useState(false);
  const [pitchOnlyInput, setPitchOnlyInput] = useState('');

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
  
  // Assign colors ONLY to active components (when activeComponentIds changes)
  useEffect(() => {
    const colors = activeComponentIds.map((id, idx) => ({
      componentId: id,
      color: COLOR_PALETTE[idx % COLOR_PALETTE.length],
    }));
    setComponentColors(colors);
    console.log('[Components] Colors assigned to', activeComponentIds.length, 'active components');
  }, [activeComponentIds]);
  
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
        })),
      })),
      roofAreas: roofAreas.map(ra => ({
        id: ra.id,
        name: ra.name,
        points: ra.points,
        area: ra.area,
        pitch: ra.pitch,
        visible: ra.visible,
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
    const snapshot = history.undo(captureSnapshot());
    if (!snapshot) return;
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
    const snapshot = history.redo(captureSnapshot());
    if (!snapshot) return;
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

    // Group measurements by component and restore componentMeasurements state.
    const grouped = new Map<string, ComponentWithMeasurements>();
    // Also collect roof area measurements (componentId = null, type = 'area')
    // so we can reconstruct their boundary polygons on the canvas.
    const hydratedRoofAreas: RoofArea[] = [];
    hydrationData.measurements
      .forEach(m => {
        if (m.componentId === null && m.type === 'area') {
          // Roof area boundary measurement — restore to roofAreas state.
          hydratedRoofAreas.push({
            id: m.id,
            name: `Area ${hydratedRoofAreas.length + 1}`,
            points: m.points ?? [],
            area: m.value,
            pitch: 0, // pitch is in quote_roof_areas, not on this measurement row
            visible: m.visible,
          });
          return;
        }
        if (m.componentId === null) return;
        const cid = m.componentId!;
        if (!grouped.has(cid)) {
          grouped.set(cid, { componentId: cid, measurements: [], expanded: false });
        }
        grouped.get(cid)!.measurements.push({
          id: m.id,
          type: m.type as ComponentMeasurement['type'],
          value: m.value,
          points: m.points ?? undefined,
          visible: m.visible,
          fromPageId: m.pageId ?? null,
        });
      });

    if (grouped.size > 0) {
      setComponentMeasurements(Array.from(grouped.values()));
      setActiveComponentIds(Array.from(grouped.keys()));
      console.info('[Hydration] Restored', grouped.size, 'components from DB');
    }

    // Restore roof area boundary polygons from DB (componentId = null, type = 'area').
    // Merge in pitch from existingRoofAreas prop (fetched from quote_roof_areas table).
    if (hydratedRoofAreas.length > 0) {
      // If we have existingRoofAreas from the server, use their pitch + label.
      if (existingRoofAreas.length > 0) {
        hydratedRoofAreas.forEach((ra, i) => {
          const match = existingRoofAreas[i];
          if (match) {
            ra.pitch = match.pitch ?? 0;
            ra.name = match.label;
          }
        });
      }
      setRoofAreas(hydratedRoofAreas);
      console.info('[Hydration] Restored', hydratedRoofAreas.length, 'roof areas from DB');
    }

    // Canvas-rework: restore calibrations from DB so the scale is available
    // for new measurements on re-entry. Calibrations are stored per-page in
    // takeoff_pages.scale_calibration.
    const firstPage = hydrationData.pages[0];
    if (firstPage?.scaleCalibration) {
      try {
        const restored = (firstPage.scaleCalibration as Calibration[]);
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
    if (calibrationConfirmed && calibrations.length > 0 && roofAreas.length === 0) {
      // Delay slightly to show after calibration flash
      const timer = setTimeout(() => {
        setShowRoofAreaInstructions(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [calibrationConfirmed, calibrations.length, roofAreas.length, takeoffMode, isExistingAreaMode]);
  
  const handleDeleteArea = (areaId: string) => {
    pushHistorySnapshot();
    const area = roofAreas.find(a => a.id === areaId);
    if (area && fabricRef.current) {
      if (area.polygon) fabricRef.current.remove(area.polygon);
      area.markers?.forEach(marker => fabricRef.current!.remove(marker));
    }
    setRoofAreas(roofAreas.filter(a => a.id !== areaId));
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
      };
      
      setRoofAreas([...roofAreas, newArea]);
      setShowAreaNamePrompt(false);
      setPendingAreaPoints([]);
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

  // Issue 5: Handle area-assignment modal confirmation.
  // When the user draws a new area polygon in mode=add (editing existing plan),
  // they choose which existing area to add the measurement to, or create a new area.
  const handleConfirmAreaAssignment = () => {
    if (!pendingNewArea) return;
    pushHistorySnapshot();
    cleanupInProgressObjects();
    const areaId = `area-${Date.now()}`;

    // Draw the polygon on canvas (tagged with measurementId)
    const polygon = new Polygon(pendingNewArea.points, {
      fill: 'rgba(59, 130, 246, 0.2)',
      stroke: '#3b82f6',
      strokeWidth: 1.25,
      selectable: false,
      evented: false,
    });
    (polygon as unknown as { measurementId: string }).measurementId = areaId;
    fabricRef.current?.add(polygon);

    if (areaAssignmentChoice === '__new__') {
      // Create a new roof area with the user-provided name
      const newName = areaAssignmentNewName.trim() || `Area ${roofAreas.length + 1}`;
      const newArea: RoofArea = {
        id: areaId,
        name: newName,
        points: pendingNewArea.points,
        area: pendingNewArea.area,
        pitch: 0,
        visible: true,
        polygon,
        markers: [],
      };
      setRoofAreas([...roofAreas, newArea]);
    } else {
      // Add to an existing area: create a new roof area entry that will be saved
      // as an additional area measurement linked to the same quote_roof_areas row.
      // The save logic (Issue 5 fix below) routes this to the existing area via
      // activeSaveRoofAreaId, and the measurement row stores canvas_points for
      // reconstruction on next edit.
      const existingArea = existingRoofAreas.find(a => a.id === areaAssignmentChoice);
      const newName = existingArea?.label || 'Existing Area';
      const newArea: RoofArea = {
        id: areaId,
        name: newName,
        points: pendingNewArea.points,
        area: pendingNewArea.area,
        pitch: existingArea?.pitch ?? 0,
        visible: true,
        polygon,
        markers: [],
      };
      setRoofAreas([...roofAreas, newArea]);
    }

    // Reset state
    setShowAreaAssignmentModal(false);
    setPendingNewArea(null);
    setPendingAreaPoints([]);
    setAreaPoints([]);
    setAreaMode(false);
    setAreaAssignmentChoice('');
    setAreaAssignmentNewName('');
  };
  
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

  const applyToolForType = (measurementType: string, forComponentId?: string) => {
    cleanupBoxDrag();
    setLineMode(false);
    setAreaMode(false);
    setPointMode(false);
    setMultiLinealMode(false);
    setMultiLinealPoints([]);
    setMultiLinealSegmentObjects([]);
    const tool = toolForMeasurementType(measurementType);
    if (tool === 'line') {
      setLineMode(true);
      activeAreaComponentIdRef.current = null; // clear area ref when switching away
    } else if (tool === 'multi_line') {
      setMultiLinealMode(true);
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
  };

  // Phase 7: load a new image onto the canvas. Used when switching pages.
  // Clears all drawn objects first (areas, lines, markers) then loads the
  // new image as the canvas background.
  const loadPageImage = (imageUrl: string) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    // Remove all objects (measurements, calibration lines, etc.).
    canvas.clear();
    canvas.backgroundColor = '#1e293b';
    const imgElement = new Image();
    imgElement.crossOrigin = 'anonymous';
    imgElement.onload = () => {
      const fabricImg = new FabricImage(imgElement);
      const scaleX = CANVAS_WIDTH / imgElement.width;
      const scaleY = CANVAS_HEIGHT / imgElement.height;
      const scale = Math.min(scaleX, scaleY);
      fabricImg.set({
        scaleX: scale, scaleY: scale,
        left: (CANVAS_WIDTH - imgElement.width * scale) / 2,
        top: (CANVAS_HEIGHT - imgElement.height * scale) / 2,
        originX: 'left', originY: 'top',
        selectable: false, evented: false,
      });
      // Image is the canvas background — structurally outside the object list,
      // so it can never be selected, dragged, or captured in undo snapshots.
      // Only viewportTransform (pan/zoom) moves the view, not the image.
      canvas.backgroundImage = fabricImg;
      canvas.renderAll();
    };
    imgElement.src = imageUrl;
    // Reset ALL tool modes + calibration + measurements for the fresh page.
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
    setComponentMeasurements([]);
    setRoofAreas([]);
    setSelectedComponentId(null);
    // P1-3: reset existing-area mode so a fresh plan doesn't inherit the constraint.
    setIsExistingAreaMode(false);
    setExistingAreaLabel('');
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
          });
        });
      });
      
      // Add area measurements.
      // Issue 4+5 fix: In existing-area mode, skip HYDRATED areas (they're already
      // in the DB — re-inserting them causes duplication). But DO include newly
      // drawn areas (client-side IDs like `area-${Date.now()}`) so the user's
      // new work is saved. Hydrated areas have DB UUIDs; new ones have timestamp IDs.
      // Trade-agnostic: applies to roofing and generic trades.
      if (!isExistingAreaMode) {
        roofAreas.forEach(area => {
          allMeasurements.push({
            componentId: null,
            type: 'area' as const,
            value: area.area,
            pitch: area.pitch,
            name: area.name,
            points: area.points,
            visible: area.visible,
          });
        });
      } else {
        // Existing-area mode: only include NEWLY drawn areas (client-side IDs).
        // Hydrated areas (DB UUIDs) are skipped to prevent duplication.
        roofAreas.forEach(area => {
          if (area.id.startsWith('area-')) {
            // Newly drawn area — include it.
            // If it was assigned to an existing area, it adds to that area's total
            // via the measurement row. If it was created as a new area, it creates
            // a new quote_roof_areas row.
            allMeasurements.push({
              componentId: null,
              type: 'area' as const,
              value: area.area,
              pitch: area.pitch,
              name: area.name,
              points: area.points,
              visible: area.visible,
            });
          }
        });
      }
      
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
          canvasImagePath = await uploadCanvasImage(quote.id, fullDataUrl);
          console.log('[SaveTakeoff] Full canvas image uploaded (path):', canvasImagePath);
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
          linesImagePath = await uploadCanvasImage(quote.id, linesDataUrl, 'lines');
          console.log('[SaveTakeoff] Lines-only image uploaded (path):', linesImagePath);
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
        sessionVersion, // P1-1a: optimistic version guard
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
      setSessionVersion(prev => (prev != null ? prev + 1 : 1));
      setIsDirty(false);
      
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
    setUploadAnotherAreaName('');
    setUploadAnotherFile(null);
    setUploadAnotherError(null);
    setShowUploadAnotherModal(true);
  };

  // P1-3: confirm flow for Save & Upload another plan.
  // Fully client-side: saves measurements, uploads image, switches canvas in-place.
  // No router.push avoids the bug where the original plan + measurements reappeared.
  const handleConfirmSaveAndUploadAnother = async () => {
    setUploadAnotherError(null);
    if (!uploadAnotherFile) { setUploadAnotherError('Please choose a plan image to upload.'); return; }
    if (uploadAnotherTarget === 'new' && !uploadAnotherAreaName.trim()) {
      setUploadAnotherError('Please enter a name for the new area.'); return;
    }
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
        const areaName = uploadAnotherAreaName.trim();
        const result = await createTakeoffPageForArea(quote.id, areaName, mint.storagePath);
        if (!result.ok || !result.pageId) { setUploadAnotherError(result.error || 'Failed to create page.'); return; }
        newPageId = result.pageId; newRoofAreaId = result.roofAreaId ?? null; newPageName = areaName;
      } else {
        // Existing area: create only the page row - reuse the current working area.
        const pageName = `Plan ${pages.length + 1}`;
        const pageResult = await createTakeoffPage(quote.id, pageName);
        if (!pageResult.ok || !pageResult.pageId) { setUploadAnotherError(pageResult.error || 'Failed to create page.'); return; }
        newPageId = pageResult.pageId; newPageName = pageName;
        // Issue 3 fix: use activeSaveRoofAreaId if already set (e.g. mode=new-page
        // for a non-first area). getFirstRoofAreaId always returns the lowest
        // sort_order area which is wrong when the current session targets a later area.
        if (activeSaveRoofAreaId) {
          newRoofAreaId = activeSaveRoofAreaId;
          resolvedFirstArea = { id: activeSaveRoofAreaId, label: existingAreaLabel || initialPageName || 'Current Area' };
        } else {
          resolvedFirstArea = await getFirstRoofAreaId(quote.id);
          newRoofAreaId = resolvedFirstArea?.id ?? null;
        }
      }
      // 6. Persist image path on the new page row.
      await finalizeTakeoffPageImage(newPageId, mint.storagePath);
      // 7. Switch canvas client-side: loadPageImage clears ALL canvas state.
      // createObjectURL is immediate and doesn't require re-signing.
      const objectUrl = URL.createObjectURL(uploadAnotherFile);
      const newPage = { id: newPageId, url: objectUrl, name: newPageName, order: pages.length + 1 };
      const updatedPages = [...pages, newPage];
      setPages(updatedPages);
      setCurrentPageIndex(updatedPages.length - 1);
      loadPageImage(objectUrl);
      // 8. Update save routing target, existing-area mode flag, and version.
      setActiveSaveRoofAreaId(newRoofAreaId);
      // P1-3: existing-area mode blocks the area name modal and skips area rows
      // in the save payload. Works for roofing and generic trades.
      if (uploadAnotherTarget === 'existing') {
        setIsExistingAreaMode(true);
        setExistingAreaLabel(resolvedFirstArea?.label ?? 'Existing Area');
      } else {
        setIsExistingAreaMode(false);
        setExistingAreaLabel('');
      }
      setSessionVersion(null);
      // Close modal and reset upload state.
      setShowUploadAnotherModal(false);
      setUploadAnotherFile(null);
      setUploadAnotherAreaName('');
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
    
    // Convert to real-world units using calibration scale
    const avgScale = calibrations.reduce((s, cal) => s + cal.scale, 0) / calibrations.length;
    const realArea = pixelArea * avgScale * avgScale; // scale² for area
    
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
    // Fallback: sync activeAreaComponentIdRef from state after render.
    // applyToolForType sets this synchronously (M-01 Gerald audit 2026-05-29),
    // but this effect serves as a safety net and handles the clear-on-mode-off case.
    if (!areaMode) {
      activeAreaComponentIdRef.current = null;
    } else if (areaMode && selectedComponentId && !activeAreaComponentIdRef.current) {
      // Only set if not already set synchronously (avoid overwriting with stale state).
      activeAreaComponentIdRef.current = selectedComponentId;
    }
  }, [calibrationMode, calibrationPoints, calibrations, areaMode, areaPoints, areaSubTool, lineMode, linePoints, pointMode, multiLinealMode, multiLinealPoints, selectedComponentId, componentColors, isExistingAreaMode]);

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

    const canvas = new Canvas(canvasRef.current, {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      backgroundColor: '#1e293b', // slate-800
    });

    fabricRef.current = canvas;

    // Load roof plan image using native Image (handles CORS automatically)
    const imgElement = new Image();
    imgElement.crossOrigin = 'anonymous';
    imgElement.onload = () => {
      const fabricImg = new FabricImage(imgElement);

      // Scale to fit canvas
      const scaleX = CANVAS_WIDTH / imgElement.width;
      const scaleY = CANVAS_HEIGHT / imgElement.height;
      const scale = Math.min(scaleX, scaleY);

      fabricImg.set({
        scaleX: scale,
        scaleY: scale,
        left: (CANVAS_WIDTH - imgElement.width * scale) / 2,
        top: (CANVAS_HEIGHT - imgElement.height * scale) / 2,
        // Fabric 7 changed default origin to center/center. The left/top
        // math above is designed to place the image's top-left at the
        // centring offset, so we lock the origin back to v6 semantics to
        // preserve the layout.
        originX: 'left',
        originY: 'top',
        selectable: false,
        evented: false,
      });

      // Image is the canvas background — never selectable, never draggable,
      // never in undo snapshots. Pan/zoom via viewportTransform still works.
      canvas.backgroundImage = fabricImg;
      canvas.renderAll();

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
          // Issue B: push snapshot before first point
          pushHistorySnapshot();
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
          // Issue B: push snapshot before second point
          pushHistorySnapshot();
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
        // Issue B: push snapshot before each point
        pushHistorySnapshot();
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
            // Capture the component ID NOW before any canvas deselection fires.
            // Without this, selectedComponentId may be null by the time the
            // modal renders, causing the area to be treated as a roof area.
            setPendingComponentId(currentSelectedId);
            // Guard: if a roof area already exists and no component is selected,
            // the user is drawing a second boundary without attaching it to a
            // component. Warn and cancel the polygon.
            if (currentRoofAreas.length > 0 && !currentSelectedId) {
              setPendingAreaPoints([]);
              setAreaPoints([]);
              setPendingComponentId(null);
              showAlert(
                'Select a component first',
                'To measure an area for a component, select it from the panel on the left before drawing.',
                'info'
              );
              return;
            }
            // P1-1b: new-page first area → pitch-only (clear component; this is the boundary).
            // P1-3 existing-area + NO component selected → warn instead of silently
            //   creating a spurious roof-area boundary (isExistingAreaMode means no new
            //   boundaries should be created client-side).
            // P1-3 existing-area + component IS selected → normal area modal.
            if (takeoffMode === 'new-page' && currentRoofAreas.length === 0 && !currentSelectedId) {
              // Boundary drawing for a new page - show pitch-only prompt.
              setPendingComponentId(null);
              setPitchOnlyInput('');
              setShowPitchOnlyPrompt(true);
            } else if (isExistingAreaModeRef.current && !currentSelectedId) {
              // Issue 5: Existing-area mode + no component → the user drew a NEW area
              // polygon. Show the area-assignment modal so they can pick which existing
              // area to add this measurement to, or create a new area.
              const calculatedArea = calculatePolygonArea(currentPoints);
              setPendingNewArea({ points: [...currentPoints], area: calculatedArea });
              setAreaAssignmentChoice(existingRoofAreas[0]?.id ?? '');
              setAreaAssignmentNewName('');
              setShowAreaAssignmentModal(true);
            } else {
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
        
        // Issue B: push snapshot before each point so undo steps back click-by-click
        pushHistorySnapshot();
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

        // Same guards as polygon close:
        if (currentRoofAreas.length > 0 && !currentSelectedId) {
          setPendingAreaPoints([]);
          setPendingComponentId(null);
          showAlert(
            'Select a component first',
            'To measure an area for a component, select it from the panel on the left before drawing.',
            'info'
          );
          return;
        }

        if (takeoffMode === 'new-page' && currentRoofAreas.length === 0 && !currentSelectedId) {
          // Boundary drawing for a new page — pitch-only prompt.
          setPendingComponentId(null);
          setPitchOnlyInput('');
          setShowPitchOnlyPrompt(true);
        } else if (isExistingAreaModeRef.current && !currentSelectedId) {
          setPendingAreaPoints([]);
          setPendingComponentId(null);
          showAlert(
            'Select a component first',
            'You are adding measurements to an existing area. Select a component from the panel before drawing.',
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
          const fabricImg = new FabricImage(imgElement);
          const scaleX = CANVAS_WIDTH / imgElement.width;
          const scaleY = CANVAS_HEIGHT / imgElement.height;
          const scale = Math.min(scaleX, scaleY);
          fabricImg.set({
            scaleX: scale, scaleY: scale,
            left: (CANVAS_WIDTH - imgElement.width * scale) / 2,
            top: (CANVAS_HEIGHT - imgElement.height * scale) / 2,
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
          const fabricImg = new FabricImage(imgElement);
          const scaleX = CANVAS_WIDTH / imgElement.width;
          const scaleY = CANVAS_HEIGHT / imgElement.height;
          const scale = Math.min(scaleX, scaleY);
          fabricImg.set({
            scaleX: scale, scaleY: scale,
            left: (CANVAS_WIDTH - imgElement.width * scale) / 2,
            top: (CANVAS_HEIGHT - imgElement.height * scale) / 2,
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
          const hydratedRoofAreas: { id: string; name: string; points: { x: number; y: number }[]; area: number; pitch: number; visible: boolean }[] = [];
          hydrationData.measurements.forEach(m => {
            if (m.componentId === null && m.type === 'area') {
              hydratedRoofAreas.push({
                id: m.id,
                name: 'Area ' + (hydratedRoofAreas.length + 1),
                points: m.points || [],
                area: m.value,
                pitch: 0,
                visible: m.visible,
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
                  ra.pitch = match.pitch || 0;
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

    const scaleX = CANVAS_WIDTH / (img.width! * img.scaleX!);
    const scaleY = CANVAS_HEIGHT / (img.height! * img.scaleY!);
    const scale = Math.min(scaleX, scaleY);

    fabricRef.current.setZoom(scale);
    fabricRef.current.viewportTransform = [scale, 0, 0, scale, 0, 0];
    fabricRef.current.requestRenderAll();
    setZoom(scale);
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
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col p-4">
      {/* Back link sits above the canvas card so it never crowds the header */}
      <Link
        href={`/${workspaceSlug}/quotes/${quote.id}`}
        className="mb-2 text-sm text-slate-500 hover:text-slate-800 self-start"
      >
        <svg className="w-4 h-4 inline -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" /></svg> Back to quote
      </Link>
      <div className="flex-1 flex flex-col bg-white rounded-xl shadow-lg overflow-hidden">
        {/* Header: title + action buttons only - no nav links */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">{quote.customer_name} - Digital Takeoff</h1>
        <div className="flex items-center gap-2">
          {/* P1-3: Save current takeoff + upload another plan image. */}
          <button
            onClick={openSaveAndUploadAnotherPlan}
            disabled={isSaving || isUploadingPage}
            className="px-3 py-2 bg-black hover:bg-slate-900 text-white rounded-full text-sm disabled:opacity-50 transition-all hover:shadow-[0_0_12px_rgba(249,115,22,0.45)]"
            title="Save current measurements, then upload a new plan to keep measuring"
          >
            Save & Upload another plan
          </button>
          <button
            onClick={handleSaveTakeoff}
            disabled={calibrations.length === 0 || isSaving}
            data-copilot="takeoff-save"
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-[0_0_12px_rgba(249,115,22,0.5)]"
            title={calibrations.length === 0 ? 'Calibrate the plan first' : ''}
          >
            {isSaving ? 'Saving...' : 'Save & Continue to Components'}
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
            <div className="p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-1">Save & upload another plan</h2>
              <p className="text-sm text-slate-500 mb-5">
                We’ll save your current measurements first, then load the new plan so you can keep measuring.
              </p>

              {/* Option 1: attach to original area(s) */}
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
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Add takeoff data to original area</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      New measurements from this plan flow into the first roof area on this quote.
                    </p>
                  </div>
                </div>
              </label>

              {/* Option 2: new area */}
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
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">Create new area for this upload</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Adds a separate roof area for everything you measure on this plan.
                    </p>
                  </div>
                </div>
              </label>

              {uploadAnotherTarget === 'new' && (
                <div className="ml-4 mb-3">
                  <label className="block text-xs font-medium text-slate-700 mb-1">Area name</label>
                  <input
                    type="text"
                    placeholder="e.g. Garage Roof"
                    value={uploadAnotherAreaName}
                    onChange={e => setUploadAnotherAreaName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              )}

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
                  {isUploadingPage ? 'Saving…' : 'Save & start new takeoff'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Calibration, Roof Areas & Components */}
        <div className="w-80 bg-white border-r border-gray-200 overflow-y-auto flex flex-col" data-copilot="takeoff-sidebar">
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

          {/* Roof Areas */}
          <div className={(!calibrationConfirmed || calibrationMode || showConfirmedFlash) ? 'border-t border-gray-200 pt-4' : ''}>
            <h2 className="text-sm font-bold mb-3 text-gray-900">{quoteIsGeneric ? 'Areas' : 'Roof Areas'}</h2>
            {roofAreas.length === 0 && takeoffMode === 'add' && existingRoofAreas.length > 0 ? (
              // P1-1b mode=add: show existing areas read-only (canvas not reconstructed).
              <div className="space-y-2">
                {existingRoofAreas.map(area => (
                  <div key={area.id} className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-2">
                    <div className="flex-1">
                      <div className="font-semibold text-sm text-gray-900">{area.label}</div>
                      <div className="text-xs text-gray-500">Existing area</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : roofAreas.length === 0 ? (
              <div className="text-sm text-gray-500">
                {calibrationConfirmed ? 'Click "Area" to draw' : 'Calibrate first'}
              </div>
            ) : (
              <div className="space-y-2">
                {roofAreas.map((area) => {
                  // The on-canvas value is already in the calibration's units
                  // (sq ft when calibrated in feet, sq m when calibrated in meters).
                  // For imperial_rs quotes we still want to surface the value in
                  // Roofing Squares so the user sees the unit they price in.
                  const calibUnit = calibrations[0]?.unit || 'feet';
                  const sys = normalizeMeasurementSystem(quote.measurement_system);
                  let displayValue = area.area;
                  let displayUnit: string;
                  if (calibUnit === 'feet' && sys === 'imperial_rs') {
                    // sq ft → RS  (1 RS = 100 ft²)
                    displayValue = area.area / 100;
                    displayUnit = 'RS';
                  } else if (calibUnit === 'feet') {
                    displayUnit = 'ft²';
                  } else {
                    displayUnit = 'm²';
                  }
                  return (
                    <div key={area.id} className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-gray-900 truncate">{area.name}</div>
                        <div className="text-xs text-gray-500">{displayValue.toFixed(2)} {displayUnit}</div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          onClick={() => handleToggleAreaVisibility(area.id)}
                          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                          title={area.visible ? 'Hide area' : 'Show area'}
                        >
                          {area.visible ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"/></svg>
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteArea(area.id)}
                          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors text-lg leading-none"
                          title="Delete area"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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

                                  {/* Measurements list (expanded) */}
                                  {compData && compData.expanded && compData.measurements.length > 0 && (
                                    <div className="mt-2 pt-2 border-t border-gray-100">
                                      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Measurements{typeLabel ? ` (${typeLabel})` : ''}</div>
                                      <div className="space-y-1">
                                        {compData.measurements.map((m) => (
                                          <div key={m.id} className="flex items-center gap-1.5 text-xs text-gray-700">
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
        <div className="flex-1 flex flex-col relative bg-gray-50">
          {/* Hidden marker: copilot only starts after first roof area created */}
          {roofAreas.length > 0 && <div data-copilot="takeoff-ready" className="hidden" />}

          {/* Top Toolbar */}
          <div className="flex-shrink-0 mx-4 mt-2 mb-0 flex items-center justify-between bg-white border border-gray-200 rounded-xl p-3 shadow-sm" data-copilot="takeoff-toolbar">
            {/* Tools - Left Side */}
            <div className="flex gap-2">
              <button
                onClick={handleStartCalibration}
                data-copilot="takeoff-tool-calibrate"
                className={`px-3 py-2 rounded-full text-sm flex items-center gap-2 ${
                  calibrationMode
                    ? 'bg-orange-100 hover:bg-orange-200 text-orange-700 border border-orange-500'
                    : calibrationConfirmed
                    ? 'bg-gray-200 hover:bg-gray-300'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                {calibrationConfirmed ? 'Recalibrate' : 'Calibrate'}
              </button>
              <button
                onClick={() => {
                  // Generic-trade quotes: no area required. Roofing: area with pitch required.
                  if (!quoteIsGeneric) {
                    const hasRoofAreaWithPitch = roofAreas.length > 0 && roofAreas.some(a => a.pitch > 0);
                    if (!hasRoofAreaWithPitch) {
                      showAlert(
                        'Roof area required',
                        'Create a roof area with pitch first - components are calculated against the roof pitch.',
                        'info'
                      );
                      return;
                    }
                  }
                  if (!selectedComponentId) {
                    showAlert('Select a component first', 'Pick a component from the list before measuring.', 'info');
                    return;
                  }
                  setLineMode(!lineMode);
                  cleanupBoxDrag();
                  setAreaMode(false);
                  setPointMode(false);
                  setMultiLinealMode(false);
                  setMultiLinealPoints([]);
                  setMultiLinealSegmentObjects([]);
                  setLinePoints([]);
                }}
                disabled={calibrationMode || calibrations.length === 0 || (!quoteIsGeneric && (roofAreas.length === 0 || !roofAreas.some(a => a.pitch > 0)))}
                data-copilot="takeoff-tool-line"
                className={`px-3 py-2 rounded-full text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                  lineMode ? 'bg-orange-100 border border-orange-500 text-orange-700' : 'bg-gray-100 hover:bg-gray-200 border-2 border-transparent'
                }`}
                title={calibrations.length === 0 ? 'Calibrate first' : (!quoteIsGeneric && (roofAreas.length === 0 || !roofAreas.some(a => a.pitch > 0))) ? 'Create roof area with pitch first' : selectedComponentId ? 'Measure line' : 'Select component first'}
              >
                Line
              </button>
              {/* Area tool — compact segmented sub-tool selector when active */}
              <button
                onClick={() => {
                  // Toggle area mode. If turning on, keep current sub-tool.
                  // If turning off, clean up everything.
                  if (areaMode) {
                    cleanupBoxDrag();
                    setAreaMode(false);
                    setAreaPoints([]);
                  } else {
                    setAreaMode(true);
                    setLineMode(false);
                    setPointMode(false);
                    setMultiLinealMode(false);
                    setMultiLinealPoints([]);
                    setMultiLinealSegmentObjects([]);
                    setAreaPoints([]);
                  }
                }}
                disabled={calibrationMode || calibrations.length === 0}
                data-copilot="takeoff-tool-area"
                className={`px-3 py-2 rounded-full text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                  areaMode ? 'bg-orange-100 border border-orange-500 text-orange-700' : 'bg-gray-100 hover:bg-gray-200 border-2 border-transparent'
                }`}
                title={calibrations.length === 0 ? 'Calibrate first' : selectedComponentId ? 'Measure area for component' : quoteIsGeneric ? 'Measure area' : 'Measure roof area (required first!)'}
              >
                Area
              </button>
              {/* Compact segmented sub-tool toggle: always rendered to prevent
                  toolbar layout shift. Uses invisible (not hidden) when area mode
                  is inactive so the space is reserved. */}
              <div className={`flex items-center rounded-full bg-gray-100 p-0.5 ${areaMode ? '' : 'invisible'}`}>
                  <button
                    onClick={() => {
                      cleanupBoxDrag();
                      setAreaSubTool('polygon');
                      setAreaPoints([]);
                    }}
                    className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                      areaSubTool === 'polygon'
                        ? 'bg-slate-900 text-white'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                    title="Draw the area point by point (at least 3 points), to close the area - click back on the first point"
                  >
                    Polygon
                  </button>
                  <button
                    onClick={() => {
                      cleanupBoxDrag();
                      setAreaSubTool('rect');
                      setAreaPoints([]);
                    }}
                    className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                      areaSubTool === 'rect'
                        ? 'bg-slate-900 text-white'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                    title="Create a custom box shape area, click and hold, drag then release to set the area"
                  >
                    Rectangle
                  </button>
                </div>
              <button
                onClick={() => {
                  // Generic-trade quotes: no area required for point measurements.
                  if (!quoteIsGeneric) {
                    const hasRoofAreaWithPitch = roofAreas.length > 0 && roofAreas.some(a => a.pitch > 0);
                    if (!hasRoofAreaWithPitch) {
                      showAlert(
                        'Roof area required',
                        'Create a roof area with pitch first - components are calculated against the roof pitch.',
                        'info'
                      );
                      return;
                    }
                  }
                  if (!selectedComponentId) {
                    showAlert('Select a component first', 'Pick a component from the list before measuring.', 'info');
                    return;
                  }
                  setPointMode(!pointMode);
                  cleanupBoxDrag();
                  setLineMode(false);
                  setAreaMode(false);
                  setMultiLinealMode(false);
                  setMultiLinealPoints([]);
                  setMultiLinealSegmentObjects([]);
                }}
                disabled={calibrationMode || calibrations.length === 0 || (!quoteIsGeneric && (roofAreas.length === 0 || !roofAreas.some(a => a.pitch > 0)))}
                data-copilot="takeoff-tool-point"
                className={`px-3 py-2 rounded-full text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                  pointMode ? 'bg-orange-100 border border-orange-500 text-orange-700' : 'bg-gray-100 hover:bg-gray-200 border-2 border-transparent'
                }`}
                title={calibrations.length === 0 ? 'Calibrate first' : (!quoteIsGeneric && (roofAreas.length === 0 || !roofAreas.some(a => a.pitch > 0))) ? 'Create roof area with pitch first' : selectedComponentId ? 'Add point marker' : 'Select component first'}
              >
                Point
              </button>
              {/* Phase 7: multi-lineal tool button */}
              <button
                onClick={() => {
                  if (!selectedComponentId) {
                    showAlert('Select a component first', 'Pick a multi-line component from the list before measuring.', 'info');
                    return;
                  }
                  if (multiLinealMode) {
                    // Toggling off - cancel in-progress polyline.
                    handleCancelMultiLineal();
                  } else {
                    setMultiLinealMode(true);
                    cleanupBoxDrag();
                    setLineMode(false);
                    setAreaMode(false);
                    setPointMode(false);
                  }
                }}
                disabled={calibrationMode || calibrations.length === 0}
                className={`px-3 py-2 rounded-full text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                  multiLinealMode ? 'bg-orange-100 border border-orange-500 text-orange-700' : 'bg-gray-100 hover:bg-gray-200 border-2 border-transparent'
                }`}
                title={calibrations.length === 0 ? 'Calibrate first' : 'Multi-line: click multiple points, double-click or Finish to commit as one total length'}
              >
                Multi-Line
              </button>
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
              <button
                onClick={handleFitToScreen}
                className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-sm"
              >
                Fit
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

          {/* Phase 7: Multi-lineal in-progress floating banner. Lives BELOW the
              toolbar instead of inside it so the tool buttons + zoom controls
              never shift around when the user starts a polyline. Absolute-
              positioned so it overlays the canvas top edge without consuming
              its own layout row. */}
          {multiLinealMode && multiLinealPoints.length >= 1 && (() => {
            const avgScale = calibrations.reduce((s, cal) => s + cal.scale, 0) / (calibrations.length || 1);
            let runningTotal = 0;
            for (let i = 1; i < multiLinealPoints.length; i++) {
              const dx = multiLinealPoints[i].x - multiLinealPoints[i - 1].x;
              const dy = multiLinealPoints[i].y - multiLinealPoints[i - 1].y;
              runningTotal += Math.sqrt(dx * dx + dy * dy) * avgScale;
            }
            const segCount = multiLinealPoints.length - 1;
            return (
              <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-[96px] z-10">
                <div className="pointer-events-auto flex items-center gap-3 px-4 py-2 bg-orange-50 border border-orange-300 rounded-full text-sm shadow-md">
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
          <div className="flex-1 flex flex-col items-center justify-start p-6 pt-4 overflow-auto">
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
          <div className="bg-white rounded-2xl p-6 max-w-sm border border-gray-200 shadow-xl">
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
              <button
                onClick={() => setShowRoofAreaInstructions(false)}
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
          <div className="bg-white rounded-lg p-6 max-w-md border border-gray-200">
            <h2 className="text-xl font-semibold mb-4">📐 Calibrate Your Plan</h2>
            <div className="space-y-3 text-sm">
              <p>Before you can measure, you need to set the scale:</p>
              <ol className="list-decimal list-inside space-y-2 text-gray-900">
                <li>Click the <span className="font-bold text-gray-700">&quot;Calibrate&quot;</span> button</li>
                <li>Click <span className="font-bold">two points</span> on the plan with a known distance</li>
                <li>Enter the <span className="font-bold">actual distance</span> between those points</li>
                <li>Add 2-3 calibrations for best accuracy</li>
                <li>Click <span className="font-bold text-orange-600">&quot;Confirm Calibration&quot;</span> when done</li>
              </ol>
              <p className="text-gray-600 text-xs mt-4">
                Tip: Use existing dimensions on your image, we suggest using the longest lengths to calibrate from.
              </p>
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
          <div className="bg-white rounded-2xl p-6 w-80 border border-gray-200 shadow-xl">
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
          <div className="bg-white rounded-2xl p-6 w-80 border border-gray-200 shadow-xl">
            <h2 className="text-lg font-semibold mb-1">
              {isExistingAreaMode ? `Adding to: ${existingAreaLabel}` : `"${initialPageName || 'New Area'}"`}
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              {tradeConfig.pitchRequired
                ? 'Enter the roof pitch for this area, or skip to use 0°.'
                : 'Enter the slope or angle if applicable, or skip.'}
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {tradeConfig.pitchRequired ? 'Pitch (degrees)' : 'Slope / angle (degrees)'}
                {!tradeConfig.pitchRequired && <span className="text-slate-400 font-normal ml-1">(optional)</span>}
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="90"
                value={pitchOnlyInput}
                onChange={(e) => setPitchOnlyInput(e.target.value)}
                placeholder={tradeConfig.pitchRequired ? 'e.g. 25' : 'e.g. 10 - or leave blank for flat'}
                autoFocus
                className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded text-sm"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowPitchOnlyPrompt(false);
                  const pitch = pitchOnlyInput.trim() ? Number(pitchOnlyInput) : 0;
                  handleSaveArea(isExistingAreaMode ? existingAreaLabel : (initialPageName || 'New Area'), pitch);
                }}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-black rounded-full hover:bg-slate-800 transition-colors"
              >
                {pitchOnlyInput.trim() ? `Save at ${pitchOnlyInput}°` : 'Save (0° flat)'}
              </button>
              <button
                onClick={() => {
                  setShowPitchOnlyPrompt(false);
                  setPendingAreaPoints([]);
                  setAreaPoints([]);
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
          }}
        />
      )}

      {/* Issue 5: Area Assignment Modal — shown when user draws a new area
          polygon while editing an existing plan (mode=add). Lets them pick
          which existing area to add the measurement to, or create a new area. */}
      {showAreaAssignmentModal && pendingNewArea && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-1">Assign Area Measurement</h2>
              <p className="text-sm text-slate-500 mb-4">
                You drew a new area measuring {pendingNewArea.area.toFixed(2)} {calibrations[0]?.unit === 'feet' ? 'ft²' : 'm²'}.
                Choose which area to add it to, or create a new one.
              </p>
              <div className="space-y-2 mb-4">
                {existingRoofAreas.map(area => (
                  <label
                    key={area.id}
                    className={`w-full text-left p-3 rounded-xl border-2 transition-colors cursor-pointer flex items-center gap-3 ${
                      areaAssignmentChoice === area.id
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="areaAssignment"
                      checked={areaAssignmentChoice === area.id}
                      onChange={() => setAreaAssignmentChoice(area.id)}
                      className="w-4 h-4 accent-orange-500"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-900">{area.label}</p>
                      {area.area != null && area.area > 0 && (
                        <p className="text-xs text-slate-500">Current: {area.area.toFixed(2)} {calibrations[0]?.unit === 'feet' ? 'ft²' : 'm²'}</p>
                      )}
                    </div>
                  </label>
                ))}
                <label
                  className={`w-full text-left p-3 rounded-xl border-2 transition-colors cursor-pointer flex items-center gap-3 ${
                    areaAssignmentChoice === '__new__'
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="areaAssignment"
                    checked={areaAssignmentChoice === '__new__'}
                    onChange={() => setAreaAssignmentChoice('__new__')}
                    className="w-4 h-4 accent-orange-500"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">New Area</p>
                    <p className="text-xs text-slate-500">Create a separate area for this measurement</p>
                  </div>
                </label>
              </div>
              {areaAssignmentChoice === '__new__' && (
                <div className="mb-4">
                  <label className="block text-xs font-medium text-slate-700 mb-1">Area name</label>
                  <input
                    type="text"
                    placeholder="e.g. Garage Roof"
                    value={areaAssignmentNewName}
                    onChange={e => setAreaAssignmentNewName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAreaAssignmentModal(false);
                    setPendingNewArea(null);
                    setPendingAreaPoints([]);
                    setAreaPoints([]);
                    setAreaMode(false);
                  }}
                  className="flex-1 py-2.5 text-sm font-medium text-slate-700 border border-slate-300 rounded-full hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAreaAssignment}
                  disabled={!areaAssignmentChoice || (areaAssignmentChoice === '__new__' && !areaAssignmentNewName.trim())}
                  className="flex-1 py-2.5 text-sm font-medium text-white bg-black rounded-full hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Confirm
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
          <div className="bg-white rounded-2xl p-6 w-80 border border-gray-200 shadow-xl">
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
        <AlertModal
        open={alertState.open}
        title={alertState.title}
        description={alertState.description}
        variant={alertState.variant}
        onClose={closeAlert}
      />
      </div>
    </div>
    </>
  );
}

// Area Name Modal - isRoofing controls whether pitch is shown/required.
// modalTitle + namePlaceholder are trade-config-driven.
