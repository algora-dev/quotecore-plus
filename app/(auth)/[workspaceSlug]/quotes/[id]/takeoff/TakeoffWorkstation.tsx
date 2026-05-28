'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Canvas, FabricImage, Line, Circle, Polygon, Triangle } from 'fabric';
import type { QuoteRow } from '@/app/lib/types';
import { normalizeMeasurementSystem } from '@/app/lib/types';
import { saveTakeoffMeasurements, createTakeoffPage, createTakeoffPageForArea, initializeTakeoffPage, finalizeTakeoffPageImage, getFirstRoofAreaId } from './actions';
import { toolForMeasurementType } from '@/app/lib/takeoff/tool-for-measurement-type';
import type { TakeoffHydrationData } from './actions';
import { uploadCanvasImage } from './uploadCanvasImage';
import { AlertModal } from '@/app/components/AlertModal';
import { getTradeLabels } from '@/app/lib/trades/labels';
import { createClient as createSupabaseBrowserClient } from '@/app/lib/supabase/client';
import { checkStorageQuota, saveFileMetadata } from '@/app/lib/files/storage-actions';
import { mintQuoteDocumentUploadUrl } from '@/app/lib/files/signed-upload';

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
  /** @deprecated alias kept for any callers that used the old name */
  default_measurement_type?: string;
}

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
  type: 'line' | 'area' | 'point' | 'multi_lineal' | 'multi_lineal_lxh';
  value: number; // length (ft/m) or area (sq ft/m)
  points?: { x: number; y: number }[];
  visible: boolean;
  canvasObjects?: any[]; // fabric.js objects
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
  /** P1-1a C-01: Hydrated state from DB, loaded server-side. Null = fresh takeoff. */
  hydrationData: TakeoffHydrationData | null;
  /** P1-1b: re-entry mode. 'add' = continue on page-1; 'new-page' = fresh area. */
  takeoffMode?: 'add' | 'new-page';
  /** P1-1b: pre-created page ID for new-area entries. Skips initializeTakeoffPage. */
  initialPageId?: string;
  /** P1-1b: human-readable label for the new page. */
  initialPageName?: string;
  /** P1-1b mode=add: existing roof areas loaded from DB, shown read-only in the panel. */
  existingRoofAreas?: { id: string; label: string }[];
  /** P1-1b mode=new-page: pre-created quote_roof_areas ID. Passed as target_roof_area_id
   *  to save_takeoff_atomic so components route to the correct area. */
  initialRoofAreaId?: string;
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

export function TakeoffWorkstation({
  workspaceSlug,
  quote,
  planUrl,
  components,
  hydrationData,
  takeoffMode,
  initialPageId,
  initialPageName,
  existingRoofAreas = [],
  initialRoofAreaId,
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
  const [isUploadingPage, setIsUploadingPage] = useState(false);
  // H-03: track unsaved changes so we can warn before switching pages.
  const [isDirty, setIsDirty] = useState(false);

  // P1-1a: session version for optimistic concurrency guard.
  const [sessionVersion, setSessionVersion] = useState<number | null>(
    hydrationData?.sessionVersion ?? null,
  );
  // Guard so the one-shot hydration effect only fires on first mount.
  const hydrationAppliedRef = useRef<boolean>(false);

  // Component colors (auto-assign on mount)
  const [componentColors, setComponentColors] = useState<ComponentColor[]>([]);
  const [activeComponentIds, setActiveComponentIds] = useState<string[]>([]);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  
  // Roof Areas
  const [roofAreas, setRoofAreas] = useState<RoofArea[]>([]);
  // Keep roofAreasRef in sync for canvas event handlers (stale closures).
  const roofAreasRef = useRef<RoofArea[]>([]);
  roofAreasRef.current = roofAreas;
  const [areaMode, setAreaMode] = useState(false);
  const [areaPoints, setAreaPoints] = useState<{ x: number; y: number }[]>([]);
  const [_tempAreaPolygon, _setTempAreaPolygon] = useState<any>(null);
  const [showAreaNamePrompt, setShowAreaNamePrompt] = useState(false);
  // P1-1b new-page mode: pitch-only prompt after drawing the first area boundary.
  // Bypasses AreaNameModal entirely so the name never has to be re-typed.
  const [showPitchOnlyPrompt, setShowPitchOnlyPrompt] = useState(false);
  const [pitchOnlyInput, setPitchOnlyInput] = useState('');
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
    if (initialPageId) return; // page already exists — skip
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
    hydrationData.measurements
      .filter(m => m.componentId !== null)
      .forEach(m => {
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
          // canvasObjects intentionally empty: canvas shapes not yet reconstructed (P1-1b).
        });
      });

    if (grouped.size > 0) {
      setComponentMeasurements(Array.from(grouped.values()));
      setActiveComponentIds(Array.from(grouped.keys()));
      console.info('[Hydration] Restored', grouped.size, 'components from DB');
    }
  // Intentionally only runs once on mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Trade-aware labels + config. Single source of truth for all copy that
  // varies by trade (roofing / cladding / generic). Replaces the old
  // quoteIsGeneric boolean - check tradeConfig.pitchRequired / .areaIsOptional
  // instead of checking the trade string directly.
  const tradeConfig = getTradeLabels((quote as { trade?: string }).trade);
  // Keep this alias for any existing code that still references it; prefer
  // tradeConfig properties in new code.
  const quoteIsGeneric = !tradeConfig.pitchRequired;
  useEffect(() => {
    // P1-1b: suppress in mode=add — user is continuing on an existing area, not creating a new one.
    if (takeoffMode === 'add') return;
    if (calibrationConfirmed && calibrations.length > 0 && roofAreas.length === 0) {
      // Delay slightly to show after calibration flash
      const timer = setTimeout(() => {
        setShowRoofAreaInstructions(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [calibrationConfirmed, calibrations.length, roofAreas.length, takeoffMode]);
  
  const handleDeleteArea = (areaId: string) => {
    const area = roofAreas.find(a => a.id === areaId);
    if (area && fabricRef.current) {
      if (area.polygon) fabricRef.current.remove(area.polygon);
      area.markers?.forEach(marker => fabricRef.current!.remove(marker));
    }
    setRoofAreas(roofAreas.filter(a => a.id !== areaId));
  };
  
  const handleSaveArea = (name: string, pitch?: number) => {
    const calculatedArea = calculatePolygonArea(pendingAreaPoints);

    // Route by pendingComponentId first (captured at polygon-close time).
    // This is immune to selectedComponentId being cleared by canvas deselection.
    const isComponentArea = !!pendingComponentId;
    setPendingComponentId(null); // consume it

    // Roof area: explicit pitch OR no component attached
    if (!isComponentArea && pitch !== undefined) {
      // Create polygon on canvas
      const polygon = new Polygon(pendingAreaPoints, {
        fill: 'rgba(59, 130, 246, 0.2)',
        stroke: '#3b82f6',
        strokeWidth: 1.25,
        selectable: false,
        evented: false,
      });
      fabricRef.current?.add(polygon);
      
      // Store roof area with pitch
      const newArea: RoofArea = {
        id: `area-${Date.now()}`,
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
      // Component area: use the captured pendingComponentId (may already be consumed
      // above; fall back to current selectedComponentId for non-modal code paths).
      const componentId = selectedComponentId;
      if (!componentId) return;

      const componentColor = componentColors.find(c => c.componentId === componentId)?.color || '#3b82f6';
      
      const polygon = new Polygon(pendingAreaPoints, {
        fill: `${componentColor}33`,
        stroke: componentColor,
        strokeWidth: 1.25,
        selectable: false,
        evented: false,
      });
      fabricRef.current?.add(polygon);
      
      const newMeasurement: ComponentMeasurement = {
        id: `area-${Date.now()}`,
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
    }
  };
  
  const handleToggleAreaVisibility = (areaId: string) => {
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
  const applyToolForType = (measurementType: string) => {
    setLineMode(false);
    setAreaMode(false);
    setPointMode(false);
    setMultiLinealMode(false);
    setMultiLinealPoints([]);
    setMultiLinealSegmentObjects([]);
    const tool = toolForMeasurementType(measurementType);
    if (tool === 'line') setLineMode(true);
    else if (tool === 'multi_line') setMultiLinealMode(true);
    else if (tool === 'area') setAreaMode(true);
    else if (tool === 'point') setPointMode(true);
    // null → manual entry only; no tool active
  };

  const handleAddComponent = (componentId: string) => {
    // Add to active list
    setActiveComponentIds([...activeComponentIds, componentId]);
    
    // Auto-select the newly added component
    setSelectedComponentId(componentId);
    
    // P1-2: Auto-select tool via central helper.
    const component = components.find(c => c.id === componentId);
    if (component) {
      const mt = (component.measurement_type ?? component.default_measurement_type ?? '').toLowerCase();
      applyToolForType(mt);
    }
  };
  
  const handleRemoveComponent = (componentId: string) => {
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
    const resolvedType: 'multi_lineal' | 'multi_lineal_lxh' =
      ((compForType?.measurement_type ?? compForType?.default_measurement_type) as string) === 'multi_lineal_lxh'
        ? 'multi_lineal_lxh'
        : 'multi_lineal';

    const newMeasurement: ComponentMeasurement = {
      id: `ml-${Date.now()}`,
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
      canvas.add(fabricImg);
      canvas.sendObjectToBack(fabricImg);
      canvas.renderAll();
    };
    imgElement.src = imageUrl;
    // Also reset calibration + measurements for the fresh page.
    setCalibrations([]);
    setCalibrationConfirmed(false);
    setComponentMeasurements([]);
    setRoofAreas([]);
    setAreaPoints([]);
    setLinePoints([]);
    setMultiLinealPoints([]);
    setMultiLinealSegmentObjects([]);
  };

  // Switch the canvas to a different page by index.
  // H-03: warn before discarding unsaved work.
  const switchToPage = (idx: number) => {
    if (idx === currentPageIndex) return;
    const page = pages[idx];
    if (!page) return;
    if (isDirty) {
      const confirmed = window.confirm(
        'You have unsaved measurements on this page. Switch anyway? Unsaved work will be lost.'
      );
      if (!confirmed) return;
    }
    setCurrentPageIndex(idx);
    loadPageImage(page.url);
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
      
      // Add component measurements
      componentMeasurements.forEach(comp => {
        comp.measurements.forEach(m => {
          allMeasurements.push({
            componentId: comp.componentId,
            type: m.type,
            value: m.value,
            points: m.points,
            visible: m.visible,
          });
        });
      });
      
      // Add roof areas as measurements (with null componentId for informational areas)
      roofAreas.forEach(area => {
        allMeasurements.push({
          componentId: null,
          type: 'area' as const,
          value: area.area,
          pitch: area.pitch, // Include pitch for roof areas
          name: area.name, // Include user's name for roof area
          points: area.points,
          visible: area.visible,
        });
      });
      
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
          const bgImage = objects.find((obj: any) => 
            obj.type === 'image' && !obj.selectable
          );
          
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
          if (bgImage) bgImage.set('visible', false);
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
      );

      if (!saveResult.success) {
        // Surface the actual error message — not hidden by Next.js production mode
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

  // P1-3: "Save & Upload another plan" — open the chooser modal.
  // Pre-selects "existing" + pre-fills area name with the first roof area's
  // label so the user can confirm-and-go without retyping when adding to it.
  const openSaveAndUploadAnotherPlan = () => {
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
      if (uploadAnotherTarget === 'new') {
        const areaName = uploadAnotherAreaName.trim();
        const result = await createTakeoffPageForArea(quote.id, areaName, mint.storagePath);
        if (!result.ok || !result.pageId) { setUploadAnotherError(result.error || 'Failed to create page.'); return; }
        newPageId = result.pageId; newRoofAreaId = result.roofAreaId ?? null; newPageName = areaName;
      } else {
        // Existing area: create only the page row - reuse the first existing area.
        const pageName = `Plan ${pages.length + 1}`;
        const pageResult = await createTakeoffPage(quote.id, pageName);
        if (!pageResult.ok || !pageResult.pageId) { setUploadAnotherError(pageResult.error || 'Failed to create page.'); return; }
        newPageId = pageResult.pageId; newPageName = pageName;
        // Get the first roof area's DB ID so the next save routes to it.
        const firstArea = await getFirstRoofAreaId(quote.id);
        newRoofAreaId = firstArea?.id ?? null;
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
      // 8. Update save routing target + reset version for fresh page.
      setActiveSaveRoofAreaId(newRoofAreaId);
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
  const lineModeRef = useRef(lineMode);
  const linePointsRef = useRef(linePoints);
  const pointModeRef = useRef(pointMode);
  const multiLinealModeRef = useRef(multiLinealMode);
  const multiLinealPointsRef = useRef(multiLinealPoints);
  const selectedComponentIdRef = useRef(selectedComponentId);
  const componentColorsRef = useRef(componentColors);
  
  useEffect(() => {
    calibrationModeRef.current = calibrationMode;
    calibrationPointsRef.current = calibrationPoints;
    calibrationsRef.current = calibrations;
    areaModeRef.current = areaMode;
    areaPointsRef.current = areaPoints;
    lineModeRef.current = lineMode;
    linePointsRef.current = linePoints;
    pointModeRef.current = pointMode;
    multiLinealModeRef.current = multiLinealMode;
    multiLinealPointsRef.current = multiLinealPoints;
    selectedComponentIdRef.current = selectedComponentId;
    componentColorsRef.current = componentColors;
  }, [calibrationMode, calibrationPoints, calibrations, areaMode, areaPoints, lineMode, linePoints, pointMode, multiLinealMode, multiLinealPoints, selectedComponentId, componentColors]);

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

      canvas.add(fabricImg);
      canvas.sendObjectToBack(fabricImg);
      canvas.renderAll();
    };
    // Read the latest URL from the ref so we always use the most
    // recent signed URL even though the init effect is dep-less.
    imgElement.src = planUrlRef.current;

    // Pan on drag OR calibration click OR area click OR line click
    canvas.on('mouse:down', (opt) => {
      const evt = opt.e;
      
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
        canvas.add(marker);
        
        // Show confirmation
        setPendingPointLocation({ x: pointer.x, y: pointer.y });
        setShowPointMeasurementPrompt(true);
        
        return;
      }
      
      // Area mode: add polygon points
      if (areaModeRef.current && !evt.altKey) {
        const pointer = canvas.getScenePoint(opt.e);
        const newPoint = { x: pointer.x, y: pointer.y };
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
            // Use refs for current state — canvas handlers are stale closures
            // and won't see state updated after the handler was set up.
            // Read current values via refs — canvas handlers capture stale closures.
            const currentRoofAreas = roofAreasRef.current;
            const currentSelectedId = selectedComponentIdRef.current;
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
            // P1-1b: in new-page mode and no roof area yet, show pitch-only prompt.
            if (takeoffMode === 'new-page' && currentRoofAreas.length === 0) {
              setPendingComponentId(null); // first area is always a roof area
              setPitchOnlyInput('');
              setShowPitchOnlyPrompt(true);
            } else {
              setShowAreaNamePrompt(true);
            }
            return;
          }
        }
        
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

    canvas.on('mouse:up', () => {
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
    if (!fabricRef.current || !areaMode || areaPoints.length < 3) return;
    
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
  }, [areaMode, areaPoints]);

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

  const handleFitToScreen = () => {
    if (!fabricRef.current) return;
    const objects = fabricRef.current.getObjects();
    const img = objects.find(obj => obj.type === 'image');
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
    // If recalibrating, clear confirmation
    if (calibrationConfirmed) {
      setCalibrationConfirmed(false);
      setCalibrations([]);
    }
    setCalibrationMode(true);
    setCalibrationPoints([]);
  };

  const handleConfirmCalibration = () => {
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
    
    // Remove temp line
    if (tempCalibrationLine && fabricRef.current) {
      fabricRef.current.remove(tempCalibrationLine);
      setTempCalibrationLine(null);
    }
  };

  const handleSaveCalibration = (actualDistance: number, unit: 'feet' | 'meters', addAnother: boolean) => {
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
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col p-4">
      <div className="flex-1 flex flex-col bg-white rounded-xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/${workspaceSlug}/quotes/${quote.id}`}
            className="text-blue-400 hover:text-blue-300"
          >
            ← Back
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">{quote.customer_name} - Digital Takeoff</h1>
            {pages.length > 1 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                Plan {currentPageIndex + 1} of {pages.length}
              </span>
            )}
          </div>
        </div>
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

      {/* Phase 7: Page tabs - show when more than 1 page exists */}
      {pages.length > 1 && (
        <div className="flex gap-1 px-4 py-2 bg-slate-800 border-b border-slate-700">
          {pages.map((page, idx) => (
            <button
              key={idx}
              onClick={() => switchToPage(idx)}
              className={`px-3 py-1 rounded-full text-sm transition-all ${
                idx === currentPageIndex
                  ? 'bg-orange-500 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {page.name}
            </button>
          ))}
        </div>
      )}

      {/* P1-3: Save & Upload another plan modal.
          Mirrors FilesManager Options B (existing area) and C (new area)
          but stays inside the workstation — saves current measurements,
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
        <div className="w-80 bg-white border-r border-gray-200 p-4 overflow-y-auto space-y-6" data-copilot="takeoff-sidebar">
          {/* Calibration Section - Show if: not confirmed, calibration mode, or showing flash */}
          {(!calibrationConfirmed || calibrationMode || showConfirmedFlash) && (
            <div>
              <h2 className="text-sm font-semibold mb-3 text-gray-900 uppercase tracking-wide">Calibration</h2>
              {calibrations.length === 0 ? (
                <div className="text-sm text-gray-700 font-medium bg-amber-50 border border-amber-200 rounded-lg p-3">
                  ⚠️ Calibrate first to continue
                </div>
              ) : showConfirmedFlash ? (
                /* Flash green confirmation briefly */
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-300 animate-pulse">
                  <div className="text-green-400 font-bold mb-2">✓ Confirmed</div>
                  <div className="text-xs text-gray-600 mb-1">Scale</div>
                  <div className="font-bold text-green-400">
                    {(calibrations.reduce((sum, cal) => sum + cal.scale, 0) / calibrations.length).toFixed(4)} {calibrations[0].unit}/px
                  </div>
                </div>
              ) : (
              /* Not confirmed - Show details + Confirm button */
              <div className="space-y-2">
                {/* Average Scale Display */}
                <div className="p-3 rounded-lg bg-white border border-orange-400">
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
                  <div
                    key={cal.id}
                    className="p-2 rounded-lg text-sm bg-gray-100"
                  >
                    <div className="font-medium">
                      #{idx + 1}: {cal.actualDistance} {cal.unit}
                    </div>
                    <div className="text-xs text-gray-600">
                      {cal.scale.toFixed(4)} {cal.unit}/px
                    </div>
                  </div>
                ))}
                
                {/* Confirm Button */}
                <button
                  onClick={handleConfirmCalibration}
                  className="w-full px-3 py-2 bg-black hover:bg-slate-800 text-white rounded-full text-sm font-mediu transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
                >
                  ✓ Confirm Calibration
                </button>
              </div>
              )}
            </div>
          )}

          <div className="border-t border-gray-200 pt-4">
            <h2 className="text-sm font-semibold mb-3 text-gray-600">{quoteIsGeneric ? 'Areas' : 'Roof Areas'}</h2>
            {roofAreas.length === 0 && takeoffMode === 'add' && existingRoofAreas.length > 0 ? (
              // P1-1b mode=add: show existing areas read-only (canvas not reconstructed).
              <div className="space-y-2">
                {existingRoofAreas.map(area => (
                  <div
                    key={area.id}
                    className="p-2 rounded-lg bg-blue-50 border border-blue-300 flex items-center gap-2"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-sm">{area.label}</div>
                      <div className="text-xs text-slate-500">Existing area</div>
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
                    <div
                      key={area.id}
                      className="p-2 rounded-lg bg-blue-50 border border-blue-300 flex items-center gap-2"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-sm">{area.name}</div>
                        <div className="text-xs text-gray-900">
                          {displayValue.toFixed(2)} {displayUnit}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleToggleAreaVisibility(area.id)}
                          className={`w-6 h-6 flex items-center justify-center rounded-lg text-lg transition-colors ${
                            area.visible 
                              ? 'text-green-500 hover:bg-green-600/20' 
                              : 'text-green-500 hover:bg-green-600/20'
                          }`}
                          title={area.visible ? 'Hide area' : 'Show area'}
                        >
                          {area.visible ? '●' : '○'}
                        </button>
                        <button
                          onClick={() => handleDeleteArea(area.id)}
                          className="w-6 h-6 flex items-center justify-center text-red-400 hover:bg-red-600/20 rounded-full"
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
              <h2 className="text-sm font-semibold mb-3 text-gray-600" data-copilot="takeoff-components-heading">Components</h2>
              {displayComponents.length === 0 ? (
              <div className="text-sm text-gray-500">
                No components in library
              </div>
            ) : (
              <div className="space-y-4">
                {/* Active Components */}
                {activeComponentIds.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-orange-500 uppercase tracking-wide mb-2">Active ({activeComponentIds.length})</h3>
                    <div className="space-y-2">
                      {activeComponentIds.map((id) => {
                        const comp = displayComponents.find(c => c.id === id);
                        if (!comp) return null;
                        
                        const assignment = componentColors.find(c => c.componentId === id);
                        const compData = componentMeasurements.find(c => c.componentId === id);
                        const isSelected = selectedComponentId === comp.id;
                        
                        return (
                          <div key={comp.id}>
                            {/* Component header */}
                            <div
                              onClick={() => {
                                setSelectedComponentId(comp.id);
                                // P1-2: auto-switch tool when clicking an active component.
                                const mt = (comp.measurement_type ?? comp.default_measurement_type ?? '').toLowerCase();
                                applyToolForType(mt);
                              }}
                              className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-all ${
                                isSelected 
                                  ? 'bg-orange-100 ring-1 ring-orange-500' 
                                  : 'bg-orange-50 hover:bg-orange-100'
                              }`}
                            >
                              <div
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: assignment?.color || '#94a3b8' }}
                              />
                              <div className="flex-1 text-sm font-medium">{comp.name}</div>
                              
                              {/* Measurement count badge */}
                              {compData && compData.measurements.length > 0 && (
                                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-md">
                                  {compData.measurements.length}
                                </span>
                              )}
                              
                              {/* Hide/show all measurements button */}
                              {compData && compData.measurements.length > 0 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleComponentVisibility(id);
                                  }}
                                  className="text-green-500 hover:bg-green-600/20 rounded-full text-lg transition-colors"
                                  title={compData.measurements.every(m => m.visible) ? 'Hide all' : 'Show all'}
                                >
                                  {compData.measurements.every(m => m.visible) ? '●' : '○'}
                                </button>
                              )}
                              
                              {/* Expand/collapse button */}
                              {compData && compData.measurements.length > 0 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setComponentMeasurements(componentMeasurements.map(c =>
                                      c.componentId === id ? { ...c, expanded: !c.expanded } : c
                                    ));
                                  }}
                                  className="text-gray-600 hover:text-gray-900"
                                >
                                  {compData.expanded ? '▼' : '▶'}
                                </button>
                              )}
                              
                              {/* Remove component button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveComponent(comp.id);
                                }}
                                className="w-6 h-6 flex items-center justify-center text-red-400 hover:bg-red-600/20 rounded-full"
                              >
                                ×
                              </button>
                            </div>
                            
                            {/* Measurement list (expanded) */}
                            {compData && compData.expanded && compData.measurements.length > 0 && (
                              <div className="ml-8 mt-1 space-y-1">
                                {compData.measurements.map((m) => (
                                  <div
                                    key={m.id}
                                    className="flex items-center gap-2 p-1 text-xs text-gray-900 bg-white/50 rounded"
                                  >
                                    <span className="flex-1">
                                      {(m.type === 'line' || m.type === 'multi_lineal') && `${m.value.toFixed(2)} ${calibrations[0]?.unit || 'ft'}`}
                                      {m.type === 'multi_lineal_lxh' && `${m.value.toFixed(2)} ${calibrations[0]?.unit || 'ft'} ×h`}
                                      {m.type === 'area' && `${m.value.toFixed(2)} sq ${calibrations[0]?.unit || 'ft'}`}
                                      {m.type === 'point' && `1 item`}
                                    </span>
                                    <button
                                      onClick={() => handleToggleMeasurementVisibility(id, m.id)}
                                      className="text-green-500 hover:bg-green-600/20 rounded-full"
                                      title={m.visible ? 'Hide' : 'Show'}
                                    >
                                      {m.visible ? '●' : '○'}
                                    </button>
                                    <button
                                      onClick={() => handleDeleteMeasurement(id, m.id)}
                                      className="text-red-400 hover:text-red-300"
                                      title="Delete measurement"
                                    >
                                      ×
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Available Components.
                    Whole row is clickable to activate the component.
                    Resting state: empty orange ring + orange plus text.
                    Hover state: solid orange circle, white plus, no row background. */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Available</h3>
                  <div className="space-y-1">
                    {displayComponents
                      .filter(comp => !activeComponentIds.includes(comp.id))
                      .map((comp) => (
                          <button
                            key={comp.id}
                            type="button"
                            onClick={() => handleAddComponent(comp.id)}
                            className="w-full flex items-center gap-2 p-1.5 rounded transition group text-left cursor-pointer"
                            aria-label={`Add ${comp.name}`}
                          >
                            <div className="flex-1 text-sm text-slate-700 group-hover:text-slate-900">{comp.name}</div>
                            <span
                              className="w-7 h-7 flex items-center justify-center rounded-full text-base font-bold transition-all flex-shrink-0 border-2 border-orange-500 text-orange-500 group-hover:bg-orange-500 group-hover:text-white"
                              aria-hidden="true"
                            >
                              +
                            </span>
                          </button>
                      ))}
                  </div>
                </div>
              </div>
              )}
            </div>
          )}
        </div>

        {/* Center - Canvas */}
        <div className="flex-1 flex flex-col relative bg-gray-50">
          {/* Hidden marker: copilot only starts after first roof area created */}
          {roofAreas.length > 0 && <div data-copilot="takeoff-ready" className="hidden" />}

          {/* Top Toolbar */}
          <div className="flex-shrink-0 m-6 mb-0 flex items-center justify-between bg-white border border-gray-200 rounded-xl p-3 shadow-sm" data-copilot="takeoff-toolbar">
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
              <button
                onClick={() => {
                  setAreaMode(!areaMode);
                  setLineMode(false);
                  setPointMode(false);
                  setMultiLinealMode(false);
                  setMultiLinealPoints([]);
                  setMultiLinealSegmentObjects([]);
                  setAreaPoints([]);
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
            <div className="flex gap-2">
              <button
                onClick={handleZoomOut}
                className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm"
              >
                −
              </button>
              <span className="px-3 py-1 text-sm">{Math.round(zoom * 100)}%</span>
              <button
                onClick={handleZoomIn}
                className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-sm"
              >
                +
              </button>
              <button
                onClick={handleResetZoom}
                className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-sm"
              >
                Reset
              </button>
              <button
                onClick={handleFitToScreen}
                className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-sm"
              >
                Fit
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

      {/* Area Instructions (after first calibration) — always optional, all trades, all modes */}
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
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRoofAreaInstructions(false);
                  setAreaMode(true);
                  setLineMode(false);
                  setPointMode(false);
                  setMultiLinealMode(false);
                }}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-black rounded-full hover:bg-slate-800 transition-colors"
              >
                Draw Area
              </button>
              <button
                onClick={() => setShowRoofAreaInstructions(false)}
                className="flex-1 py-2.5 text-sm font-medium text-slate-700 border border-slate-300 rounded-full hover:bg-slate-50 transition-colors"
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

      {/* P1-1b pitch-only prompt for new-page mode (first area boundary drawn) */}
      {showPitchOnlyPrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-80 border border-gray-200 shadow-xl">
            <h2 className="text-lg font-semibold mb-1">"{initialPageName || 'New Area'}"</h2>
            <p className="text-sm text-slate-500 mb-4">
              {tradeConfig.pitchRequired
                ? 'Enter the roof pitch for this area, or skip to use 0°.'
                : 'Enter the slope or angle if applicable, or skip.'}
            </p>
            {tradeConfig.pitchRequired && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Pitch (degrees)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="90"
                  value={pitchOnlyInput}
                  onChange={(e) => setPitchOnlyInput(e.target.value)}
                  placeholder="e.g. 25"
                  autoFocus
                  className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded text-sm"
                />
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowPitchOnlyPrompt(false);
                  const pitch = pitchOnlyInput.trim() ? Number(pitchOnlyInput) : 0;
                  handleSaveArea(initialPageName || 'New Area', pitch);
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

      {/* Point Measurement Prompt */}
      {showPointMeasurementPrompt && pendingPointLocation && selectedComponentId && (
        <PointMeasurementModal
          componentName={displayComponents.find(c => c.id === selectedComponentId)?.name || 'Component'}
          onConfirm={() => {
            // Add point measurement
            const marker = fabricRef.current?.getObjects().slice(-1)[0]; // Last object added
            
            const newMeasurement: ComponentMeasurement = {
              id: `point-${Date.now()}`,
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
            
            // Collect canvas objects (line + markers) - last 3 objects added
            const objects = fabricRef.current?.getObjects() || [];
            const canvasObjects = objects.slice(-3); // Last 3 objects (2 markers + 1 line)
            
            // Create measurement
            const newMeasurement: ComponentMeasurement = {
              id: `line-${Date.now()}`,
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

      {/* App-style alert replaces native alert() across this workstation. */}
      <AlertModal
        open={alertState.open}
        title={alertState.title}
        description={alertState.description}
        variant={alertState.variant}
        onClose={closeAlert}
      />
      </div>
    </div>
  );
}

// Area Name Modal - isRoofing controls whether pitch is shown/required.
// modalTitle + namePlaceholder are trade-config-driven.
function AreaNameModal({
  isRoofing,
  modalTitle,
  namePlaceholder,
  componentName,
  calculatedArea,
  unit,
  onSave,
  onCancel,
  initialName = '',
}: {
  isRoofing: boolean;
  modalTitle?: string;
  namePlaceholder?: string;
  componentName: string | null;
  calculatedArea: number;
  unit: string;
  onSave: (name: string, pitch?: number) => void;
  onCancel: () => void;
  /** Pre-fill the area name (used in new-page mode where the user already named the area). */
  initialName?: string;
}) {
  const [name, setName] = useState(initialName);
  const [pitch, setPitch] = useState('');

  // P1-1b: when initialName is pre-filled (new-page mode), name is locked —
  // only pitch is needed from the user.
  const nameIsLocked = initialName !== '';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (componentName) {
      // Component area - no pitch needed
      onSave('');
    } else if (isRoofing) {
      // Roof area - require pitch; name comes from pre-fill or input
      const effectiveName = nameIsLocked ? initialName : name.trim();
      if (effectiveName && (pitch.trim() || nameIsLocked)) {
        onSave(effectiveName, pitch.trim() ? Number(pitch) : 0);
      }
    } else {
      // Generic area - name only, pitch=0 (flat)
      const effectiveName = nameIsLocked ? initialName : name.trim();
      if (effectiveName) {
        onSave(effectiveName, 0);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 border border-gray-200">
        <h2 className="text-xl font-semibold mb-4">
          {componentName ? 'Add Area to Component' : (modalTitle ?? (isRoofing ? 'Create Roof Area' : 'Create Area'))}
        </h2>
        
        {componentName && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-300 rounded-lg-lg">
            <div className="text-sm text-gray-600 mb-1">Component:</div>
            <div className="font-semibold">{componentName}</div>
            <div className="text-2xl font-bold text-blue-400 mt-2">
              {calculatedArea.toFixed(2)} sq {unit}
            </div>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {!componentName && (
            <>
              {nameIsLocked ? (
                // P1-1b new-page mode: name already set, show read-only.
                <div>
                  <label className="block text-sm mb-1 text-gray-500">Area</label>
                  <p className="px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm font-medium text-slate-800">{initialName}</p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm mb-2">Area Name <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded"
                    placeholder={namePlaceholder ?? (isRoofing ? 'e.g. Main Roof' : 'e.g. North Wall')}
                    autoFocus
                    required
                  />
                </div>
              )}
              {isRoofing && (
                <>
                  <div>
                    <label className="block text-sm mb-2">
                      Roof Pitch (degrees){nameIsLocked ? ' — optional, enter 0 if flat' : <span className="text-red-400"> *</span>}
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="90"
                      value={pitch}
                      onChange={(e) => setPitch(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded"
                      placeholder={nameIsLocked ? 'e.g. 25 (or 0 for flat)' : 'e.g. 30'}
                      required={!nameIsLocked}
                      autoFocus={nameIsLocked}
                    />
                    <p className="text-xs text-gray-600 mt-1">
                      Used to calculate component lengths (rafters, hips, valleys)
                    </p>
                  </div>
                  <div className="p-3 bg-gray-50 border border-orange-400 rounded-lg">
                    <p className="text-xs text-gray-900 font-medium">
                      Plan Area: {calculatedArea.toFixed(2)} sq {unit} (before pitch adjustment)
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      This pitch will be used for all components in this area
                    </p>
                  </div>
                </>
              )}
              {!isRoofing && (
                <div className="p-3 bg-gray-50 border border-gray-300 rounded-lg">
                  <p className="text-xs text-gray-900 font-medium">
                    Area: {calculatedArea.toFixed(2)} sq {unit}
                  </p>
                </div>
              )}
            </>
          )}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 bg-white border-2 border-slate-300 rounded-full pill-shimmer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-black text-white rounded-full hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
              disabled={!componentName && !nameIsLocked && (!name.trim() || (isRoofing && !pitch.trim()))}
            >
              {componentName ? 'Add to Component' : isRoofing ? 'Create Roof Area' : 'Create Area'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Point Measurement Modal
function PointMeasurementModal({
  componentName,
  onConfirm,
  onCancel,
}: {
  componentName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onConfirm();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className="bg-white rounded-lg p-6 w-96 border border-gray-200">
        <h2 className="text-xl font-semibold mb-4">Add Point</h2>
        <div className="mb-6">
          <div className="text-lg">
            Add 1 item to <strong className="text-purple-400">{componentName}</strong>?
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-white border-2 border-slate-300 rounded-full pill-shimmer"
          >
            Cancel (Esc)
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-black text-white rounded-full hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
            autoFocus
          >
            Add Point (Enter)
          </button>
        </div>
      </div>
    </div>
  );
}

// Line Measurement Modal
function LineMeasurementModal({
  length,
  unit,
  onConfirm,
  onCancel,
}: {
  length: number;
  unit: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onConfirm();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className="bg-white rounded-lg p-6 w-96 border border-gray-200">
        <h2 className="text-xl font-semibold mb-4">Line Measurement</h2>
        <div className="mb-6">
          <div className="text-3xl font-bold text-green-400">
            {length.toFixed(2)} {unit}
          </div>
          <div className="text-sm text-gray-600 mt-2">
            Press Enter to add, or Esc to cancel
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-white border-2 border-slate-300 rounded-full pill-shimmer"
          >
            Cancel (Esc)
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-black text-white rounded-full hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
            autoFocus
          >
            Add Line (Enter)
          </button>
        </div>
      </div>
    </div>
  );
}

// Calibration Modal Component
function CalibrationModal({
  calibrationNumber,
  defaultUnit,
  onSave,
  onCancel,
}: {
  calibrationNumber: number;
  defaultUnit: 'feet' | 'meters';
  onSave: (distance: number, unit: 'feet' | 'meters', addAnother: boolean) => void;
  onCancel: () => void;
}) {
  const [distance, setDistance] = useState('');
  const [unit, setUnit] = useState<'feet' | 'meters'>(defaultUnit);

  const handleSubmit = (addAnother: boolean) => {
    const num = parseFloat(distance);
    if (!isNaN(num) && num > 0) {
      onSave(num, unit, addAnother);
    }
  };

  const canAddAnother = calibrationNumber < 3;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 border border-gray-200">
        <h2 className="text-xl font-semibold mb-2">
          Calibration {calibrationNumber} of 3
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          {calibrationNumber === 1
            ? 'At least 1 calibration required. More = better accuracy.'
            : `Add ${3 - calibrationNumber + 1} more for best accuracy, or skip.`}
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm mb-2">Distance</label>
            <input
              type="number"
              step="0.01"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded"
              placeholder="e.g. 10.5"
              autoFocus
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-2">Unit</label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value as 'feet' | 'meters')}
              className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded"
            >
              <option value="feet">Feet</option>
              <option value="meters">Meters</option>
            </select>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 bg-white border-2 border-slate-300 rounded-full pill-shimmer"
            >
              Cancel
            </button>
            {canAddAnother && calibrationNumber > 1 && (
              <button
                type="button"
                onClick={() => handleSubmit(false)}
                className="px-4 py-2 bg-white border-2 border-slate-300 rounded-full pill-shimmer"
                disabled={!distance || parseFloat(distance) <= 0}
              >
                Skip
              </button>
            )}
            {canAddAnother ? (
              <button
                type="button"
                onClick={() => handleSubmit(true)}
                className="px-4 py-2 bg-black text-white rounded-full hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
                disabled={!distance || parseFloat(distance) <= 0}
              >
                Save & Add Another
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSubmit(false)}
                className="px-4 py-2 bg-black text-white rounded-full hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
                disabled={!distance || parseFloat(distance) <= 0}
              >
                Save
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
