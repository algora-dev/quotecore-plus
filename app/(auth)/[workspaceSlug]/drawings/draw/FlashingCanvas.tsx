'use client';

import { useState, useRef, useEffect } from 'react';
import { QcDrawingWorkspace } from '@/app/components/ui/v2/QcDrawingWorkspace';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { QcJourneyDialog } from '@/app/components/ui/v2/QcJourney';
import { useQcFeedback } from '@/app/components/ui/v2/useQcFeedback';
import { useRouter, useSearchParams } from 'next/navigation';
import { Canvas, Line, Circle, IText, Rect, ActiveSelection, Object as _FabricObject, PencilBrush } from 'fabric';
import { createFlashingFromCanvas, updateFlashingWithImage, loadFlashingById } from '../actions';
import { AngleCalculatorWidget } from './AngleCalculatorWidget';

// F-15: Extracted helpers + types
import {
  type DrawMode,
  type CanvasSize,
  CANVAS_SIZES,
  SCALE,
  MM_PER_INCH,
  formatLength,
  lengthInputToMm,
  type FabricCanvasData,
  type StoredMeasurement,
  type MeasurementItem,
  type _CanvasState,
} from './parts/helpers';
import { useCanvasHistory } from '@/app/lib/takeoff/useCanvasHistory';
export function FlashingCanvas({
  workspaceSlug,
  lengthUnit = 'mm',
  featureLabelSingular = 'Flashing',
}: {
  workspaceSlug: string;
  /**
   * Unit the user's length inputs are in (and what we stamp onto each
   * saved measurement). Driven by the company's measurement system at
   * the page boundary; defaults to mm so any caller that hasn't been
   * updated yet still renders sensibly.
   */
  lengthUnit?: 'mm' | 'in';
  /**
   * Trade-aware singular label ('Flashing' / 'Drawing/Image'). Display copy
   * only - internal identifiers, routes and file names are unchanged.
   */
  featureLabelSingular?: string;
}) {
  const featureSingularLower = featureLabelSingular.toLowerCase();
  const router = useRouter();
  const { notify, feedback } = useQcFeedback();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editValueError, setEditValueError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fabricRef = useRef<Canvas | null>(null);

  // Detect edit mode
  const editMode = searchParams.get('edit') === 'true';
  const flashingId = searchParams.get('id');

  const [canvasSize, setCanvasSize] = useState<CanvasSize>('medium');
  const [drawMode, setDrawMode] = useState<DrawMode>('none');
  const [measurements, setMeasurements] = useState<MeasurementItem[]>([]);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [linePoints, setLinePoints] = useState<{ x: number; y: number }[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const [selectedMeasurement, setSelectedMeasurement] = useState<string | null>(null);

  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [calculatingAngleId, setCalculatingAngleId] = useState<string | null>(null);
  // Replaces the old window.prompt() flow for Edit Value. Both state
  // pieces null = modal closed; non-null = modal open against that
  // measurement, with the input pre-filled to its current value.
  // (Restyle to match the rest of the app, Shaun spec 2026-05-11.)
  const [editValueMeasurementId, setEditValueMeasurementId] = useState<string | null>(null);
  const [editValueInput, setEditValueInput] = useState<string>('');
  const [needsRecalibration, setNeedsRecalibration] = useState(false);
  const [showAdjustConfirmation, setShowAdjustConfirmation] = useState(false);
  const [showSelectAllWarning, setShowSelectAllWarning] = useState(false);
  const [editingLocked, setEditingLocked] = useState(false);
  const [loading, setLoading] = useState(editMode); // Loading state for edit mode
  const [canvasReady, setCanvasReady] = useState(false); // Track when canvas is initialized
  const [flashingLoaded, setFlashingLoaded] = useState(false); // Track if flashing data loaded

  // Canvas-rework: Undo/redo system (replaces the old history that was removed).
  // Snapshots both canvas JSON AND React state together to prevent sync desync.
  const { canUndo, canRedo, pushSnapshot, undo, redo, clear: clearHistory } = useCanvasHistory(20);

  const pushHistorySnapshot = () => {
    if (!fabricRef.current) return;
    pushSnapshot(fabricRef.current, { measurements });
  };

  const restoreSnapshot = (snapshot: { canvasJSON: string; reactState: Record<string, unknown> }) => {
    if (!fabricRef.current) return;
    const fabricJSON = JSON.parse(snapshot.canvasJSON);
    fabricRef.current.loadFromJSON(fabricJSON, () => {
      fabricRef.current?.renderAll();
      const restored = snapshot.reactState.measurements as MeasurementItem[] | undefined;
      if (restored) setMeasurements(restored);
    });
  };

  const handleUndo = () => {
    if (!fabricRef.current) return;
    const snapshot = undo(fabricRef.current, { measurements });
    if (snapshot) restoreSnapshot(snapshot);
  };

  const handleRedo = () => {
    if (!fabricRef.current) return;
    const snapshot = redo(fabricRef.current, { measurements });
    if (snapshot) restoreSnapshot(snapshot);
  };

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [pencilWidth, setPencilWidth] = useState<1 | 2 | 4>(2);

  // Refs
  const drawModeRef = useRef<DrawMode>('none');
  const linePointsRef = useRef<{ x: number; y: number }[]>([]);


  useEffect(() => {
    drawModeRef.current = drawMode;
    linePointsRef.current = linePoints;
  }, [drawMode, linePoints]);

  // Refs for stable history saving
  const measurementsRef = useRef<MeasurementItem[]>([]);

  useEffect(() => {
    measurementsRef.current = measurements;
  }, [measurements]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not intercept typing/select-all/undo inside a field or open dialog.
      // Canvas shortcuts otherwise keep the existing history/selection owners.
      if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable="true"], dialog, [role="dialog"]')) return;
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'a') {
          e.preventDefault();
          handleSelectAll();
        }
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          handleUndo();
        }
        if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
          e.preventDefault();
          handleRedo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Select All - with warning (final step, locks editing)
  const handleSelectAll = () => {
    if (!fabricRef.current) return;

    // Show warning modal first
    setShowSelectAllWarning(true);
  };

  const handleConfirmSelectAll = (proceed: boolean) => {
    setShowSelectAllWarning(false);

    if (!proceed || !fabricRef.current) return;

    // Lock editing - Select All is final
    setEditingLocked(true);

    // Exit Line mode to prevent adding points while moving selection
    setDrawMode('none');

    const canvas = fabricRef.current;
    // Select ALL objects (including point markers so they move with the drawing)
    const allObjects = canvas.getObjects();

    if (allObjects.length === 0) return;

    // Make objects selectable
    allObjects.forEach((obj: any) => {
      obj.set({ selectable: true, evented: true });
    });

    // Create active selection
    canvas.discardActiveObject();
    const selection = new ActiveSelection(allObjects as any, { canvas });

    // Set as active FIRST
    canvas.setActiveObject(selection as any);

    // Then disable middle handles (must be after setActiveObject)
    const activeObj = canvas.getActiveObject();
    if (activeObj) {
      activeObj.setControlsVisibility({
        mt: false,  // no middle-top
        mb: false,  // no middle-bottom
        ml: false,  // no middle-left
        mr: false,  // no middle-right
        tl: true,   // keep corners
        tr: true,
        bl: true,
        br: true,
        mtr: true,  // keep rotation
      });
    }

    canvas.requestRenderAll();
  };

  // Deselect All - exits the locked Select All state so the user can
  // continue editing or save their work. Discards the ActiveSelection
  // and re-enables editing tools.
  const handleDeselectAll = () => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    canvas.discardActiveObject();

    // Make objects non-selectable again (back to drawing mode)
    canvas.getObjects().forEach((obj: any) => {
      obj.set({ selectable: false, evented: false });
    });

    canvas.requestRenderAll();
    setEditingLocked(false);
    setDrawMode('none');
  };

  const calculateDistance = (p1: { x: number; y: number }, p2: { x: number; y: number }): number => {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy) * SCALE;
  };

  const calculateAngle = (
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    p3: { x: number; y: number },
    interior: boolean
  ): number => {
    const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
    const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };

    const dot = v1.x * v2.x + v1.y * v2.y;
    const det = v1.x * v2.y - v1.y * v2.x;
    let angle = Math.atan2(det, dot) * (180 / Math.PI);

    if (interior && angle < 0) angle += 360;
    if (!interior && angle > 0) angle -= 360;

    return Math.abs(angle);
  };

  const getAngleBisector = (
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    p3: { x: number; y: number }
  ): { x: number; y: number } => {
    const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
    const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
    const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

    const norm1 = { x: v1.x / len1, y: v1.y / len1 };
    const norm2 = { x: v2.x / len2, y: v2.y / len2 };

    return {
      x: (norm1.x + norm2.x) / 2,
      y: (norm1.y + norm2.y) / 2
    };
  };

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    if (fabricRef.current) {
      fabricRef.current.dispose();
    }

    const size = CANVAS_SIZES[canvasSize];
    const canvas = new Canvas(canvasRef.current, {
      width: size.width,
      height: size.height,
      backgroundColor: '#ffffff',
      selection: true,
    });

    fabricRef.current = canvas;
    setCanvasReady(true); // Mark canvas as ready

    canvas.on('mouse:move', (opt) => {
      // Fabric 7 renamed canvas.getPointer() to two clearer methods:
      // getViewportPoint() and getScenePoint(). We want scene coordinates
      // (the canvas's own coordinate space, post viewport transform), which
      // is exactly what the old getPointer() returned by default.
      const pointer = canvas.getScenePoint(opt.e);
      setCursorPos({ x: pointer.x, y: pointer.y });
    });

    canvas.on('mouse:down', (opt) => {
      const pointer = canvas.getScenePoint(opt.e);

      if (drawModeRef.current === 'text') {
        const text = new IText('Text', {
          left: pointer.x,
          top: pointer.y,
          // Fabric 7 changed the default origin from 'left/top' to
          // 'center/center'. Pin this back to the original behaviour so the
          // text appears at the pointer click position, not centred on it.
          originX: 'left',
          originY: 'top',
          fontSize: 16,
          fill: '#000000',
          fontFamily: 'Arial',
        });
        canvas.add(text);
        canvas.setActiveObject(text);
        canvas.renderAll();
        setDrawMode('none');
        return;
      }

      if (drawModeRef.current === 'edit') {
        const currentPoints = linePointsRef.current;
        for (let i = 0; i < currentPoints.length; i++) {
          const pt = currentPoints[i];
          const dist = Math.sqrt(Math.pow(pointer.x - pt.x, 2) + Math.pow(pointer.y - pt.y, 2));
          if (dist < 15) {
            setSelectedPoint(i);
            return;
          }
        }
        return;
      }

      if (drawModeRef.current === 'line') {
        const currentPoints = linePointsRef.current;
        const newPoint = { x: pointer.x, y: pointer.y };

        const marker = new Circle({
          left: newPoint.x,
          top: newPoint.y,
          radius: 4,
          fill: '#FF6B35',
          stroke: '#000',
          strokeWidth: 1,
          originX: 'center',
          originY: 'center',
          selectable: true, // Make draggable in edit mode
          evented: true,
          hasControls: false, // No resize handles
          hasBorders: false,  // No selection border
        });
        (marker as any).pointIndex = currentPoints.length; // Store which point this is
        (marker as any).isPointMarker = true; // Flag to identify point markers
        canvas.add(marker);

        const newMeasurements: MeasurementItem[] = [];

        if (currentPoints.length > 0) {
          const prevPoint = currentPoints[currentPoints.length - 1];

          // Add angle if we now have 3+ points (angle at previous point)
          if (currentPoints.length >= 2) {
            const prevPrevPoint = currentPoints[currentPoints.length - 2];

            const interiorAngleVal = Math.round(calculateAngle(prevPrevPoint, prevPoint, newPoint, true));
            const exteriorAngleVal = 360 - interiorAngleVal;
            const displayValue = interiorAngleVal;

            const bisector = getAngleBisector(prevPrevPoint, prevPoint, newPoint);

            const arcRadius = 25;

            const arc = new Circle({
              left: prevPoint.x,
              top: prevPoint.y,
              radius: arcRadius,
              fill: 'transparent',
              stroke: '#FF6B35',
              strokeWidth: 1.5,
              originX: 'center',
              originY: 'center',
              selectable: true,
              evented: true,
            });

            const textOffset = arcRadius + 15;
            const measurementId = `angle-${Date.now()}`;

            const angleText = new IText(`${displayValue}°`, {
              left: prevPoint.x + bisector.x * textOffset,
              top: prevPoint.y + bisector.y * textOffset,
              fontSize: 16,
              fill: '#000',
              fontFamily: 'Arial',
              originX: 'center',
              originY: 'center',
              editable: true,
              selectable: true,
            });
            (angleText as any).measurementId = measurementId;

            (arc as any).measurementId = measurementId;

            canvas.add(arc);
            canvas.add(angleText);

            // Arc is hidden by default - user can show via sidebar toggle
            arc.set('visible', false);

            newMeasurements.push({
              id: measurementId,
              type: 'angle',
              value: displayValue,
              originalValue: displayValue,
              visible: true,
              arcHidden: true,
              interiorValue: interiorAngleVal,
              exteriorValue: exteriorAngleVal,
              showInterior: true,
              labelObjectId: measurementId,
              pointIndex: currentPoints.length - 1, // Angle is at the previous point
            });
          }

          // Add line
          const measurementId = `length-${Date.now() + 1}`;

          const line = new Line([prevPoint.x, prevPoint.y, newPoint.x, newPoint.y], {
            stroke: '#000000',
            strokeWidth: 2,
            selectable: false,
            evented: false,
          });
          (line as any).measurementId = measurementId;
          (line as any).lineStartIndex = currentPoints.length - 1;
          (line as any).lineEndIndex = currentPoints.length;
          canvas.add(line);

          // Add length label
          const length = Math.round(calculateDistance(prevPoint, newPoint));
          const midX = (prevPoint.x + newPoint.x) / 2;
          const midY = (prevPoint.y + newPoint.y) / 2;

          const dx = newPoint.x - prevPoint.x;
          const dy = newPoint.y - prevPoint.y;
          const lineLength = Math.sqrt(dx * dx + dy * dy);
          const perpX = -dy / lineLength;
          const perpY = dx / lineLength;

          const offset = 15;
          const labelX = midX + perpX * offset;
          const labelY = midY + perpY * offset;

          const lengthLabel = new IText(`${formatLength(length, lengthUnit)}${lengthUnit}`, {
            left: labelX,
            top: labelY,
            fontSize: 14,
            fill: '#0066cc',
            fontFamily: 'Arial',
            originX: 'center',
            originY: 'center',
            selectable: true,
            evented: true,
          });
          (lengthLabel as any).measurementId = measurementId;

          canvas.add(lengthLabel);

          newMeasurements.push({
            id: measurementId,
            type: 'length',
            value: length,
            originalValue: length,
            visible: true,
            labelObjectId: measurementId,
            placementSide: 'exterior',
            lineStart: { x: prevPoint.x, y: prevPoint.y },
            lineEnd: { x: newPoint.x, y: newPoint.y },
            lineStartIndex: currentPoints.length - 1,
            lineEndIndex: currentPoints.length,
          });
        }

        setLinePoints([...currentPoints, newPoint]);
        if (newMeasurements.length > 0) {
          pushHistorySnapshot();
          setMeasurements(prev => [...prev, ...newMeasurements]);
        }
        canvas.requestRenderAll();
      }
    });

    // Selection handler - two-way highlighting
    canvas.on('selection:created', (e) => {
      const selected = e.selected?.[0];
      if (selected && (selected as any).measurementId) {
        setSelectedMeasurement((selected as any).measurementId);
      }
    });

    canvas.on('selection:updated', (e) => {
      const selected = e.selected?.[0];
      if (selected && (selected as any).measurementId) {
        setSelectedMeasurement((selected as any).measurementId);
      } else {
        setSelectedMeasurement(null);
      }
    });

    canvas.on('selection:cleared', () => {
      setSelectedMeasurement(null);
    });

    // Point dragging handler - updates connected lines and measurements
    canvas.on('object:moving', (e) => {
      const obj = e.target;
      if (!obj || !(obj as any).isPointMarker) return;

      const pointIdx = (obj as any).pointIndex;
      if (pointIdx === undefined) return;

      const newX = obj.left!;
      const newY = obj.top!;

      // Mark that recalibration is needed
      setNeedsRecalibration(true);

      // Update linePoints ref
      const currentPoints = linePointsRef.current;
      if (pointIdx >= currentPoints.length) return;
      currentPoints[pointIdx] = { x: newX, y: newY };

      // Update all connected lines
      canvas.getObjects().forEach((canvasObj: any) => {
        if (canvasObj.type === 'line') {
          const startIdx = canvasObj.lineStartIndex;
          const endIdx = canvasObj.lineEndIndex;

          if (startIdx === pointIdx) {
            canvasObj.set({ x1: newX, y1: newY });
          }
          if (endIdx === pointIdx) {
            canvasObj.set({ x2: newX, y2: newY });
          }

          // If this line was affected, update its length label
          if (startIdx === pointIdx || endIdx === pointIdx) {
            const measurementId = canvasObj.measurementId;
            if (measurementId) {
              const p1 = currentPoints[startIdx];
              const p2 = currentPoints[endIdx];
              if (p1 && p2) {
                const newLength = Math.round(calculateDistance(p1, p2));
                const midX = (p1.x + p2.x) / 2;
                const midY = (p1.y + p2.y) / 2;

                // Find and update label
                const label = canvas.getObjects().find((o: any) =>
                  o.measurementId === measurementId && o.type === 'i-text'
                );
                if (label) {
                  const dx = p2.x - p1.x;
                  const dy = p2.y - p1.y;
                  const lineLength = Math.sqrt(dx * dx + dy * dy);
                  const perpX = -dy / lineLength;
                  const perpY = dx / lineLength;
                  const offset = 15;

                  (label as any).set({
                    text: `${formatLength(newLength, lengthUnit)}${lengthUnit}`,
                    left: midX + perpX * offset,
                    top: midY + perpY * offset,
                  });
                }

                // Update measurement state
                setMeasurements(prev => prev.map(m =>
                  m.id === measurementId
                    ? { ...m, value: newLength, lineStart: p1, lineEnd: p2 }
                    : m
                ));
              }
            }
          }
        }

        // Update angles at this point
        if (canvasObj.type === 'circle' && canvasObj.measurementId) {
          // Find angle measurements at this point
          const angleMeasurements = measurementsRef.current.filter(
            m => m.type === 'angle' && m.pointIndex === pointIdx
          );

          angleMeasurements.forEach(angleMeas => {
            // Recalculate angle if we have adjacent points
            if (pointIdx > 0 && pointIdx < currentPoints.length - 1) {
              const p1 = currentPoints[pointIdx - 1];
              const p2 = currentPoints[pointIdx];
              const p3 = currentPoints[pointIdx + 1];

              if (p1 && p2 && p3) {
                const newInterior = Math.round(calculateAngle(p1, p2, p3, true));
                const newExterior = 360 - newInterior;
                const newValue = angleMeas.showInterior ? newInterior : newExterior;

                // Update arc position
                canvasObj.set({ left: newX, top: newY });

                // Update text position and value
                const bisector = getAngleBisector(p1, p2, p3);
                const textOffset = 40;
                const angleText = canvas.getObjects().find((o: any) =>
                  o.measurementId === angleMeas.id && o.type === 'i-text'
                );
                if (angleText) {
                  (angleText as any).set({
                    text: `${newValue}°`,
                    left: newX + bisector.x * textOffset,
                    top: newY + bisector.y * textOffset,
                  });
                }

                // Update state
                setMeasurements(prev => prev.map(m =>
                  m.id === angleMeas.id
                    ? { ...m, value: newValue, interiorValue: newInterior, exteriorValue: newExterior }
                    : m
                ));
              }
            }
          });
        }
      });

      canvas.requestRenderAll();
    });

    // Update linePoints state after drag is complete
    canvas.on('object:modified', (e) => {
      const obj = e.target;
      if (obj && (obj as any).isPointMarker) {
        setLinePoints([...linePointsRef.current]);
      }
    });

    // Make freehand paths selectable/movable/resizable after drawing
    canvas.on('path:created', (e: any) => {
      const path = e.path;
      if (path) {
        path.set({
          selectable: true,
          evented: true,
          hasControls: true,
          hasBorders: true,
        });
        canvas.renderAll();
      }
    });

    return () => {
      canvas.dispose();
      setCanvasReady(false);
    };
  }, [canvasSize]); // Only re-init when canvas size changes

  // Load existing flashing in edit mode (AFTER canvas is ready, ONCE only)
  useEffect(() => {
    console.log('[FlashingCanvas] Load check:', { editMode, flashingId, canvasReady, flashingLoaded, hasCanvas: !!fabricRef.current });

    if (!editMode || !flashingId) {
      setLoading(false); // Not in edit mode, stop loading
      return;
    }

    if (flashingLoaded) {
      console.log('[FlashingCanvas] Already loaded, skipping');
      return; // Already loaded, don't load again
    }

    if (!canvasReady || !fabricRef.current) {
      console.log('[FlashingCanvas] Waiting for canvas to initialize...');
      return;
    }

    async function loadFlashing() {
      try {
        console.log('[FlashingCanvas] Loading flashing for edit:', flashingId);
        const flashing = await loadFlashingById(flashingId!);

        console.log('[FlashingCanvas] Flashing data received:', {
          hasCanvasData: !!flashing.canvas_data,
          measurementsCount: flashing.measurements?.length || 0,
        });

        if (!flashing || !fabricRef.current) {
          console.error('[FlashingCanvas] Missing flashing data or canvas ref');
          setLoading(false);
          return;
        }

        // Parse canvas data if it's a string. The DB column is typed Json;
        // narrow to the fabric-shaped view we actually wrote to it.
        let canvasDataObj: FabricCanvasData = flashing.canvas_data as FabricCanvasData;
        if (typeof canvasDataObj === 'string') {
          console.log('[FlashingCanvas] Canvas data is string, parsing...');
          try {
            canvasDataObj = JSON.parse(canvasDataObj) as FabricCanvasData;
          } catch (e) {
            console.error('[FlashingCanvas] Failed to parse canvas_data:', e);
            await notify('This drawing could not be loaded because its saved data is invalid.', 'Drawing unavailable');
            setLoading(false);
            setFlashingLoaded(true);
            return;
          }
        }
        if (!canvasDataObj) {
          console.error('[FlashingCanvas] canvas_data is null after parse');
          setLoading(false);
          setFlashingLoaded(true);
          return;
        }

        // Debug: Log the actual canvas data structure
        console.log('[FlashingCanvas] Canvas data TYPE:', typeof canvasDataObj);
        console.log('[FlashingCanvas] Has objects array?', !!canvasDataObj.objects);
        console.log('[FlashingCanvas] Objects count:', canvasDataObj.objects?.length || 0);
        console.log('[FlashingCanvas] Canvas dimensions in JSON:', {
          width: canvasDataObj.width,
          height: canvasDataObj.height,
        });
        console.log('[FlashingCanvas] Current canvas dimensions:', {
          width: fabricRef.current.getWidth(),
          height: fabricRef.current.getHeight(),
        });

        // CRITICAL FIX: Set canvas dimensions BEFORE loading objects
        if (canvasDataObj.width && canvasDataObj.height) {
          console.log('[FlashingCanvas] Resizing canvas to match saved dimensions...');
          fabricRef.current.setDimensions({
            width: canvasDataObj.width,
            height: canvasDataObj.height,
          });
        }

        console.log('[FlashingCanvas] First object sample:', JSON.stringify(canvasDataObj.objects?.[0]).substring(0, 200));

        // Load canvas from JSON. fabric's typing wants string | Record;
        // canvasDataObj is the narrowed view so a deliberate cast is
        // safe here.
        fabricRef.current.loadFromJSON(
          canvasDataObj as unknown as Record<string, unknown>,
          () => {
          if (!fabricRef.current) return;

          console.log('[FlashingCanvas] loadFromJSON callback fired');
          console.log('[FlashingCanvas] Objects after load:', fabricRef.current.getObjects().length);

          if (fabricRef.current.getObjects().length === 0) {
            console.error('[FlashingCanvas] CRITICAL: No objects loaded!');
            console.error('[FlashingCanvas] This indicates a fabric.js deserialization failure');
            void notify('This drawing could not be loaded for editing. Its saved format may be incompatible. Return to the library to view the saved image.', 'Drawing unavailable');
          } else {
            console.log('[FlashingCanvas] Successfully loaded', fabricRef.current.getObjects().length, 'objects');
          }

          // Apply arcHidden state to loaded angle arcs
          const loadedMeasurements = (flashing.measurements as unknown) as StoredMeasurement[] | null;
          if (loadedMeasurements) {
            fabricRef.current.getObjects().forEach((obj: any) => {
              if (obj.type === 'circle' && obj.measurementId) {
                const m = loadedMeasurements.find((mm: StoredMeasurement) => mm.id === obj.measurementId);
                if (m && m.arcHidden) {
                  obj.set('visible', false);
                }
              }
            });
          }

          fabricRef.current.renderAll();
        });

        // Restore state (outside callback to avoid loops). The DB column
        // is Json; we wrote MeasurementItem[] into it, so the narrowing
        // cast here is safe.
        const storedMeasurements = (flashing.measurements as unknown) as
          | StoredMeasurement[]
          | null;
        if (storedMeasurements) {
          setMeasurements(storedMeasurements);
        }

        // Restore line points from measurements pointIndices
        const points: { x: number; y: number }[] = [];
        if (storedMeasurements) {
          storedMeasurements.forEach((m: StoredMeasurement) => {
            if (m.type === 'length' && m.pointIndices) {
              // Reconstruct points from line objects
              const lineObj = fabricRef.current?.getObjects().find((obj: any) => obj.measurementId === m.id);
              if (lineObj && (lineObj as any).x1 !== undefined) {
                const line = lineObj as any;
                if (!points[m.pointIndices[0]]) {
                  points[m.pointIndices[0]] = { x: line.x1, y: line.y1 };
                }
                if (!points[m.pointIndices[1]]) {
                  points[m.pointIndices[1]] = { x: line.x2, y: line.y2 };
                }
              }
            }
          });
        }
        setLinePoints(points.filter(p => p)); // Remove undefined entries

        setName(flashing.name);
        setDescription(flashing.description || '');
        setFlashingLoaded(true); // Mark as loaded
        setLoading(false);

        console.log('[FlashingCanvas] Flashing loaded successfully');
        console.log('[FlashingCanvas] Canvas data size:', JSON.stringify(flashing.canvas_data).length, 'bytes');
        console.log('[FlashingCanvas] Measurements count:', flashing.measurements?.length || 0);
      } catch (err) {
        console.error('[FlashingCanvas] Failed to load flashing:', err);
        await notify(`Failed to load ${featureSingularLower}: ${err}`, 'Drawing unavailable');
        setLoading(false);
      }
    }

    loadFlashing();
  }, [editMode, flashingId, canvasReady, flashingLoaded]); // Trigger when canvas becomes ready

  // Sync pencil width when it changes
  useEffect(() => {
    if (fabricRef.current && drawMode === 'draw') {
      const brush = fabricRef.current.freeDrawingBrush;
      if (brush) {
        brush.width = pencilWidth;
      }
    }
  }, [pencilWidth, drawMode]);

  useEffect(() => {
    if (fabricRef.current) {
      const cursor = (drawMode === 'line' || drawMode === 'text' || drawMode === 'draw') ? 'crosshair' : 'default';
      fabricRef.current.defaultCursor = cursor;
      fabricRef.current.hoverCursor = cursor;

      const canvas = fabricRef.current;

      // Handle freehand drawing mode
      if (drawMode === 'draw') {
        canvas.isDrawingMode = true;
        const brush = new PencilBrush(canvas);
        brush.width = pencilWidth;
        brush.color = '#000000';
        canvas.freeDrawingBrush = brush;
      } else {
        canvas.isDrawingMode = false;
      }

      // Deselect everything when switching modes (UNLESS editing is locked from Select All)
      if (!editingLocked) {
        canvas.discardActiveObject();
      }

      // Show/hide angle circles based on mode
      canvas.getObjects().forEach((obj: any) => {
        if (obj.type === 'circle' && obj.measurementId) {
          // This is an angle arc/circle - check measurement visibility + arcHidden
          const measurement = measurements.find(m => m.id === obj.measurementId);
          const shouldShow = drawMode !== 'adjustPoints' && (!measurement || measurement.visible) && (!measurement || !measurement.arcHidden);
          obj.set('visible', shouldShow);
        }
        if (obj.type === 'rect' && obj.measurementId) {
          // This is a right angle square - check measurement visibility too
          const measurement = measurements.find(m => m.id === obj.measurementId);
          const shouldShow = drawMode !== 'adjustPoints' && (!measurement || measurement.visible);
          obj.set('visible', shouldShow);
        }
      });

      // Make point markers selectable only in adjustPoints mode
      canvas.getObjects().forEach((obj: any) => {
        if (obj.isPointMarker) {
          obj.set('selectable', drawMode === 'adjustPoints');
        }
      });

      canvas.renderAll();
    }
  }, [drawMode, editingLocked]);

  // Helper to check if we should show Adjust Points confirmation
  const checkAdjustPointsExit = () => {
    if (drawMode === 'adjustPoints') {
      setShowAdjustConfirmation(true);
      return true; // Prevent action until confirmed
    }
    return false; // Allow action
  };

  const liveMeasurements = () => {
    if (drawMode !== 'line' || linePoints.length === 0 || !cursorPos) return null;

    const lastPoint = linePoints[linePoints.length - 1];
    const length = calculateDistance(lastPoint, cursorPos);

    let angle: number | null = null;
    if (linePoints.length >= 2) {
      const prevPoint = linePoints[linePoints.length - 2];
      angle = calculateAngle(prevPoint, lastPoint, cursorPos, true);
    }

    return { length: Math.round(length), angle: angle !== null ? Math.round(angle) : null };
  };

  const measurements_live = liveMeasurements();

  const handleClear = () => {
    pushHistorySnapshot();
    if (fabricRef.current) {
      fabricRef.current.clear();
      fabricRef.current.backgroundColor = '#ffffff';
      fabricRef.current.renderAll();
    }
    setLinePoints([]);
    setMeasurements([]);
    setSelectedPoint(null);
  };

  const _handleFinishLine = () => {
    setLinePoints([]);
    setDrawMode('none');
  };

  // Finish button: deselects everything and exits the active creative tool
  // (Line / Text / Pencil / Edit). Lets the user cleanly drop back to a
  // neutral state so they can pick a new tool, interact with the sidebar,
  // or save without the current tool staying sticky.
  const handleFinishTool = () => {
    const canvas = fabricRef.current;
    if (canvas) {
      canvas.discardActiveObject();
      canvas.renderAll();
    }
    setLinePoints([]);
    setCursorPos(null);
    setSelectedPoint(null);
    setSelectedMeasurement(null);
    setDrawMode('none');
  };

  const handleToggleMeasurementVisibility = (id: string) => {
    const measurement = measurements.find(m => m.id === id);
    if (!measurement || !fabricRef.current) return;
    pushHistorySnapshot();

    const canvas = fabricRef.current;
    const newVisible = !measurement.visible;

    // Find ALL objects with this measurementId (arc + text for angles, just text for lengths)
    canvas.getObjects().forEach((obj: any) => {
      if (obj.measurementId === id) {
        if (obj.type === 'i-text') {
          // Text labels: respect textHidden state when showing
          obj.set('visible', newVisible && !measurement.textHidden);
        } else if (obj.type === 'circle') {
          // Angle arc: respect arcHidden state when showing
          obj.set('visible', newVisible && !measurement.arcHidden);
        } else {
          obj.set('visible', newVisible);
        }
      }
    });

    setMeasurements(measurements.map(m =>
      m.id === id ? { ...m, visible: newVisible } : m
    ));

    canvas.renderAll();
  };

  // Toggle only the text label visibility (keeps line/arc visible)
  const handleToggleTextVisibility = (id: string) => {
    const measurement = measurements.find(m => m.id === id);
    if (!measurement || !fabricRef.current) return;
    pushHistorySnapshot();

    const canvas = fabricRef.current;
    const newTextHidden = !measurement.textHidden;

    // Only toggle i-text objects (the value labels), keep lines/arcs visible
    canvas.getObjects().forEach((obj: any) => {
      if (obj.measurementId === id && obj.type === 'i-text') {
        obj.set('visible', !newTextHidden);
      }
    });

    setMeasurements(measurements.map(m =>
      m.id === id ? { ...m, textHidden: newTextHidden } : m
    ));

    canvas.renderAll();
  };

  // Toggle only the angle arc circle visibility (keeps text/line visible)
  const handleToggleArcVisibility = (id: string) => {
    const measurement = measurements.find(m => m.id === id);
    if (!measurement || !fabricRef.current) return;
    pushHistorySnapshot();

    const canvas = fabricRef.current;
    const newArcHidden = !measurement.arcHidden;

    // Only toggle circle objects (the angle arcs), keep text/lines visible
    canvas.getObjects().forEach((obj: any) => {
      if (obj.measurementId === id && obj.type === 'circle') {
        obj.set('visible', !newArcHidden && measurement.visible);
      }
    });

    setMeasurements(measurements.map(m =>
      m.id === id ? { ...m, arcHidden: newArcHidden } : m
    ));

    canvas.renderAll();
  };

  // Helper function to update all connected geometry when a point moves
  const updateConnectedGeometry = (changedPointIdx: number, offsetX: number, offsetY: number) => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const currentPoints = linePointsRef.current;

    // Move all points AFTER the changed point by the same offset
    for (let i = changedPointIdx + 1; i < currentPoints.length; i++) {
      currentPoints[i] = {
        x: currentPoints[i].x + offsetX,
        y: currentPoints[i].y + offsetY,
      };

      // Update point marker
      const marker = canvas.getObjects().find((o: any) =>
        o.isPointMarker && o.pointIndex === i
      );
      if (marker) {
        marker.set({
          left: currentPoints[i].x,
          top: currentPoints[i].y,
        });
      }
    }

    // Update ALL lines and measurements
    canvas.getObjects().forEach((obj: any) => {
      if (obj.type === 'line') {
        const startIdx = obj.lineStartIndex;
        const endIdx = obj.lineEndIndex;

        if (startIdx !== undefined && endIdx !== undefined) {
          const p1 = currentPoints[startIdx];
          const p2 = currentPoints[endIdx];

          if (p1 && p2) {
            obj.set({
              x1: p1.x,
              y1: p1.y,
              x2: p2.x,
              y2: p2.y,
            });

            // Update length measurement and label
            const measurementId = obj.measurementId;
            if (measurementId) {
              const newLength = Math.round(calculateDistance(p1, p2));
              const midX = (p1.x + p2.x) / 2;
              const midY = (p1.y + p2.y) / 2;

              const label = canvas.getObjects().find((o: any) =>
                o.measurementId === measurementId && o.type === 'i-text'
              );
              if (label) {
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const lineLength = Math.sqrt(dx * dx + dy * dy);
                const perpX = -dy / lineLength;
                const perpY = dx / lineLength;
                const offset = 15;

                (label as any).set({
                  text: `${formatLength(newLength, lengthUnit)}${lengthUnit}`,
                  left: midX + perpX * offset,
                  top: midY + perpY * offset,
                });
              }

              setMeasurements(prev => prev.map(m =>
                m.id === measurementId
                  ? { ...m, value: newLength, lineStart: p1, lineEnd: p2 }
                  : m
              ));
            }
          }
        }
      }
    });

    // Update all angles
    measurements.forEach(m => {
      if (m.type === 'angle' && m.pointIndex !== undefined) {
        const pointIdx = m.pointIndex;
        if (pointIdx > 0 && pointIdx < currentPoints.length - 1) {
          const p1 = currentPoints[pointIdx - 1];
          const p2 = currentPoints[pointIdx];
          const p3 = currentPoints[pointIdx + 1];

          if (p1 && p2 && p3) {
            const newInterior = Math.round(calculateAngle(p1, p2, p3, true));
            const newExterior = 360 - newInterior;
            const newValue = m.showInterior ? newInterior : newExterior;

            // Update arc position
            const arc = canvas.getObjects().find((o: any) =>
              o.measurementId === m.id && o.type === 'circle'
            );
            if (arc) {
              arc.set({ left: p2.x, top: p2.y });
            }

            // Update text position and value
            const bisector = getAngleBisector(p1, p2, p3);
            const textOffset = 40;
            const angleText = canvas.getObjects().find((o: any) =>
              o.measurementId === m.id && o.type === 'i-text'
            );
            if (angleText) {
              (angleText as any).set({
                text: `${newValue}°`,
                left: p2.x + bisector.x * textOffset,
                top: p2.y + bisector.y * textOffset,
              });
            }

            setMeasurements(prev => prev.map(measure =>
              measure.id === m.id
                ? { ...measure, value: newValue, interiorValue: newInterior, exteriorValue: newExterior }
                : measure
            ));
          }
        }
      }
    });
  };

  /**
   * Open the in-app Edit Value modal for the given measurement.
   * Wired to the per-measurement "Edit Value" button in the side panel.
   * Replaces the previous window.prompt() flow so the prompt is on-brand
   * and consistent with the rest of the app (Shaun spec 2026-05-11).
   */
  const handleEditMeasurementValue = (id: string) => {
    const measurement = measurements.find(m => m.id === id);
    if (!measurement || !fabricRef.current) return;
    pushHistorySnapshot();
    setEditValueMeasurementId(id);
    setEditValueInput(
      measurement.type === 'length'
        ? formatLength(measurement.value, lengthUnit)
        : measurement.value.toString()
    );
  };

  /**
   * Apply a numeric edit-value to a measurement. Pulled out of the old
   * handleEditMeasurementValue so the modal can call it without retreading
   * the prompt-validation flow.
   */
  const applyEditMeasurementValue = (id: string, numValue: number) => {
    const measurement = measurements.find(m => m.id === id);
    if (!measurement || !fabricRef.current) return;
    if (!Number.isFinite(numValue)) return;

    const canvas = fabricRef.current;
    const currentPoints = linePointsRef.current;

    if (measurement.type === 'length') {
      // The user types in the active unit (mm or inches); convert to
      // canonical mm before doing pixel math / storage.
      numValue = lengthInputToMm(numValue, lengthUnit);

      const startIdx = measurement.lineStartIndex;
      const endIdx = measurement.lineEndIndex;

      if (startIdx !== undefined && endIdx !== undefined && currentPoints[startIdx] && currentPoints[endIdx]) {
        const p1 = currentPoints[startIdx];
        const p2 = currentPoints[endIdx];

        const currentLengthPx = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
        const newLengthPx = numValue / SCALE;
        const scale = newLengthPx / currentLengthPx;

        // Calculate new end point
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const newP2 = {
          x: p1.x + dx * scale,
          y: p1.y + dy * scale,
        };

        // Calculate offset
        const offsetX = newP2.x - p2.x;
        const offsetY = newP2.y - p2.y;

        // Update this point
        currentPoints[endIdx] = newP2;

        // Update the marker for THIS point first
        const changedMarker = canvas.getObjects().find((o: any) =>
          o.isPointMarker && o.pointIndex === endIdx
        );
        if (changedMarker) {
          changedMarker.set({
            left: newP2.x,
            top: newP2.y,
          });
        }

        // Propagate to all connected points
        updateConnectedGeometry(endIdx, offsetX, offsetY);

        setLinePoints([...currentPoints]);
      }
    } else if (measurement.type === 'angle') {
      const pointIdx = measurement.pointIndex;
      if (pointIdx === undefined || pointIdx < 1 || pointIdx >= currentPoints.length - 1) return;

      const p1 = currentPoints[pointIdx - 1];
      const p2 = currentPoints[pointIdx];
      const p3 = currentPoints[pointIdx + 1];

      // Calculate current angle using ACTUAL current points
      const currentInterior = calculateAngle(p1, p2, p3, true);
      const targetInterior = measurement.showInterior ? numValue : 360 - numValue;
      const angleDiff = targetInterior - currentInterior;

      // Rotate p3 and all subsequent points around p2
      const angleRad = angleDiff * Math.PI / 180;

      for (let i = pointIdx + 1; i < currentPoints.length; i++) {
        const pt = currentPoints[i];
        const dx = pt.x - p2.x;
        const dy = pt.y - p2.y;

        currentPoints[i] = {
          x: p2.x + dx * Math.cos(angleRad) - dy * Math.sin(angleRad),
          y: p2.y + dx * Math.sin(angleRad) + dy * Math.cos(angleRad),
        };

        // Update point marker
        const marker = canvas.getObjects().find((o: any) =>
          o.isPointMarker && o.pointIndex === i
        );
        if (marker) {
          marker.set({
            left: currentPoints[i].x,
            top: currentPoints[i].y,
          });
        }
      }

      // Update all connected geometry
      updateConnectedGeometry(pointIdx, 0, 0);

      setLinePoints([...currentPoints]);
    }

    canvas.requestRenderAll();
  };

  const handleAdjustPointsMode = () => {
    if (drawMode === 'adjustPoints') {
      // Already in adjust mode, show confirmation
      setShowAdjustConfirmation(true);
    } else {
      // Enter adjust mode
      setDrawMode('adjustPoints');
    }
  };

  const handleConfirmFinishAdjusting = (confirm: boolean) => {
    if (confirm) {
      // Exit adjust mode, return to edit mode
      setDrawMode('edit');
      setShowAdjustConfirmation(false);
    } else {
      // Continue adjusting
      setShowAdjustConfirmation(false);
    }
  };

  const handleRecalibrateAll = () => {
    if (!fabricRef.current) return;
    pushHistorySnapshot();

    const canvas = fabricRef.current;
    const currentPoints = linePointsRef.current;

    // Reset recalibration flag
    setNeedsRecalibration(false);

    // Recalculate ALL measurements from actual canvas positions
    const updatedMeasurements = measurements.map(m => {
      if (m.type === 'length' && m.lineStartIndex !== undefined && m.lineEndIndex !== undefined) {
        const p1 = currentPoints[m.lineStartIndex];
        const p2 = currentPoints[m.lineEndIndex];

        if (p1 && p2) {
          const actualLength = Math.round(calculateDistance(p1, p2));

          // Update label text
          const textObj = canvas.getObjects().find((o: any) =>
            o.measurementId === m.id && o.type === 'i-text'
          );
          if (textObj) {
            (textObj as any).set('text', `${formatLength(actualLength, lengthUnit)}${lengthUnit}`);
          }

          return {
            ...m,
            value: actualLength,
            originalValue: actualLength,
            lineStart: p1,
            lineEnd: p2,
          };
        }
      } else if (m.type === 'angle' && m.pointIndex !== undefined) {
        const pointIdx = m.pointIndex;
        if (pointIdx > 0 && pointIdx < currentPoints.length - 1) {
          const p1 = currentPoints[pointIdx - 1];
          const p2 = currentPoints[pointIdx];
          const p3 = currentPoints[pointIdx + 1];

          if (p1 && p2 && p3) {
            const actualInterior = Math.round(calculateAngle(p1, p2, p3, true));
            const actualExterior = 360 - actualInterior;
            const actualValue = m.showInterior ? actualInterior : actualExterior;

            // Update label text
            const textObj = canvas.getObjects().find((o: any) =>
              o.measurementId === m.id && o.type === 'i-text'
            );
            if (textObj) {
              (textObj as any).set('text', `${actualValue}°`);
            }

            return {
              ...m,
              value: actualValue,
              originalValue: actualValue,
              interiorValue: actualInterior,
              exteriorValue: actualExterior,
            };
          }
        }
      }
      return m;
    });

    setMeasurements(updatedMeasurements);
    canvas.renderAll();
  };

  const handleToggleAngleType = (id: string) => {
    const measurement = measurements.find(m => m.id === id);
    if (!measurement || measurement.type !== 'angle' || !fabricRef.current) return;
    pushHistorySnapshot();

    const newShowInterior = !measurement.showInterior;
    const newValue = newShowInterior ? measurement.interiorValue! : measurement.exteriorValue!;

    const canvas = fabricRef.current;
    const textObj = canvas.getObjects().find((o: any) =>
      o.measurementId === id && o.type === 'i-text'
    );

    if (textObj) {
      (textObj as any).set('text', `${newValue}°`);
    }

    setMeasurements(measurements.map(m =>
      m.id === id ? { ...m, showInterior: newShowInterior, value: newValue } : m
    ));

    canvas.renderAll();
  };

  const handleOpenCalculator = (id: string) => {
    const measurement = measurements.find(m => m.id === id);
    if (!measurement || measurement.type !== 'angle') return;

    setCalculatingAngleId(id);
    setCalculatorOpen(true);
  };

  const handleApplyCalculatedAngle = (newAngle: number) => {
    if (!calculatingAngleId || !fabricRef.current) return;
    pushHistorySnapshot();

    const measurement = measurements.find(m => m.id === calculatingAngleId);
    if (!measurement || measurement.type !== 'angle') {
      setCalculatingAngleId(null);
      return;
    }

    const canvas = fabricRef.current;
    const currentPoints = linePointsRef.current;
    const pointIdx = measurement.pointIndex;

    // Infer angle type from the applied value:
    // >180° = external (opens outward), <180° = internal (folds inward), =180° = straight
    const inferredAngleType: 'internal' | 'external' | 'straight' =
      Math.abs(newAngle - 180) < 0.5 ? 'straight' : (newAngle > 180 ? 'external' : 'internal');

    // Update geometry (same logic as handleEditMeasurementValue for angles)
    if (pointIdx !== undefined && pointIdx >= 1 && pointIdx < currentPoints.length - 1) {
      const p1 = currentPoints[pointIdx - 1];
      const p2 = currentPoints[pointIdx];
      const p3 = currentPoints[pointIdx + 1];

      // Calculate current angle using ACTUAL current points
      const currentInterior = calculateAngle(p1, p2, p3, true);

      // For external angles (>180°), the finished angle IS the target - we want
      // the points to open outward. For internal angles (<180°), the finished angle
      // is the tight inside. The key insight: the rotation direction must differ
      // for external vs internal even when the bend amount is the same.
      //
      // We compute the target as the finished angle directly. The sign of the
      // angleDiff will naturally differ for external (positive, opens outward)
      // vs internal (negative, folds inward) - IF we use the raw finished angle
      // as the target rather than normalising it through showInterior.
      //
      // However, the drawing engine works with interior angles (0-180° range
      // from calculateAngle). For external angles >180°, we need to rotate the
      // OPPOSITE direction from what the interior diff would suggest.
      //
      // Approach: compute the bend amount and apply it in the correct direction.
      // bendAmount = |180 - newAngle|
      // direction: external → rotate one way, internal → rotate the other way

      const bendAmount = Math.abs(180 - newAngle); // e.g. 15° for both 195° and 165°

      // Current bend from flat = |180 - currentInterior|
      const currentBend = Math.abs(180 - currentInterior);

      // How much we need to rotate = difference in bend, with direction
      // For external angles: points should move outward (positive rotation)
      // For internal angles: points should move inward (negative rotation)
      //
      // The sign of the rotation depends on which side the points currently are.
      // We use the signed cross product to determine current bend direction,
      // then flip if needed to match the target angleType.

      // Determine current bend direction: is the current angle external or internal?
      const currentIsExternal = currentInterior > 180;

      // Target rotation: we want to go from current bend to target bend in the
      // correct direction. The simplest reliable approach: compute the raw
      // angleDiff using the finished angle directly (not through showInterior),
      // so external angles naturally produce opposite rotation from internal.
      let targetAngle: number;
      if (inferredAngleType === 'external') {
        // External: target is >180°. Use the finished angle directly as the target.
        targetAngle = newAngle;
      } else if (inferredAngleType === 'internal') {
        // Internal: target is <180°. Use the finished angle directly.
        targetAngle = newAngle;
      } else {
        // Straight: target is 180°
        targetAngle = 180;
      }

      const angleDiff = targetAngle - currentInterior;
      const angleRad = angleDiff * Math.PI / 180;

      for (let i = pointIdx + 1; i < currentPoints.length; i++) {
        const pt = currentPoints[i];
        const dx = pt.x - p2.x;
        const dy = pt.y - p2.y;

        currentPoints[i] = {
          x: p2.x + dx * Math.cos(angleRad) - dy * Math.sin(angleRad),
          y: p2.y + dx * Math.sin(angleRad) + dy * Math.cos(angleRad),
        };

        // Update point marker
        const marker = canvas.getObjects().find((o: any) =>
          o.isPointMarker && o.pointIndex === i
        );
        if (marker) {
          marker.set({
            left: currentPoints[i].x,
            top: currentPoints[i].y,
          });
        }
      }

      // Update all connected geometry
      updateConnectedGeometry(pointIdx, 0, 0);

      setLinePoints([...currentPoints]);
    }

    // Update text label
    const textObj = canvas.getObjects().find((o: any) =>
      o.measurementId === calculatingAngleId && o.type === 'i-text'
    );
    if (textObj) {
      (textObj as any).set('text', `${newAngle}°`);
    }

    // Update measurement state - store angleType so the drawing remembers
    // which direction this angle bends.
    const newInterior = inferredAngleType === 'external' ? newAngle : (inferredAngleType === 'internal' ? newAngle : 180);
    const newExterior = 360 - newInterior;

    setMeasurements(measurements.map(m =>
      m.id === calculatingAngleId
        ? { ...m, value: newAngle, interiorValue: newInterior, exteriorValue: newExterior, angleType: inferredAngleType }
        : m
    ));

    canvas.requestRenderAll();
    setCalculatingAngleId(null);
  };

  const handleSelectMeasurement = (id: string) => {
    if (!fabricRef.current) return;

    setSelectedMeasurement(id);

    // Highlight the corresponding canvas object
    const canvas = fabricRef.current;
    const obj = canvas.getObjects().find((o: any) =>
      o.measurementId === id && o.type === 'i-text'
    );

    if (obj) {
      canvas.setActiveObject(obj as any);
      canvas.requestRenderAll();
    }
  };

  const handleTogglePlacementSide = (id: string) => {
    const measurement = measurements.find(m => m.id === id);
    if (!measurement || measurement.type !== 'length' || !fabricRef.current) return;
    if (!measurement.lineStart || !measurement.lineEnd) return;
    pushHistorySnapshot();

    const newSide = measurement.placementSide === 'exterior' ? 'interior' : 'exterior';

    const canvas = fabricRef.current;
    const textObj = canvas.getObjects().find((o: any) =>
      o.measurementId === id && o.type === 'i-text'
    );

    if (textObj) {
      // Recalculate label position on the opposite side
      const midX = (measurement.lineStart.x + measurement.lineEnd.x) / 2;
      const midY = (measurement.lineStart.y + measurement.lineEnd.y) / 2;

      const dx = measurement.lineEnd.x - measurement.lineStart.x;
      const dy = measurement.lineEnd.y - measurement.lineStart.y;
      const lineLength = Math.sqrt(dx * dx + dy * dy);
      const perpX = -dy / lineLength;
      const perpY = dx / lineLength;

      const offset = newSide === 'exterior' ? 15 : -15;
      const labelX = midX + perpX * offset;
      const labelY = midY + perpY * offset;

      (textObj as any).set({
        left: labelX,
        top: labelY,
      });
    }

    setMeasurements(measurements.map(m =>
      m.id === id ? { ...m, placementSide: newSide } : m
    ));

    canvas.renderAll();
  };

  const _handleAddRightAngle = () => {
    if (selectedPoint === null || selectedPoint === 0 || selectedPoint >= linePoints.length - 1) {
      void notify('Select a middle point to add a right angle.', 'Select a middle point');
      return;
    }
    pushHistorySnapshot();

    const pt = linePoints[selectedPoint];

    if (fabricRef.current) {
      const size = 12;
      const square = new Rect({
        left: pt.x - size / 2,
        top: pt.y - size / 2,
        // The (pt.x - size/2, pt.y - size/2) pre-offset assumes the v6
        // top-left origin. Fabric 7 made center/center the default, which
        // would double the offset. Lock back to left/top to preserve
        // visual layout.
        originX: 'left',
        originY: 'top',
        width: size,
        height: size,
        fill: 'transparent',
        stroke: '#000',
        strokeWidth: 1.5,
        selectable: true,
        evented: true,
      });
      fabricRef.current.add(square);
      fabricRef.current.renderAll();
    }

    setSelectedPoint(null);
  };

  const _handleAddCustomAngle = () => {
    if (selectedPoint === null || selectedPoint < 1 || selectedPoint >= linePoints.length - 1) {
      void notify('Select a middle point to add a custom angle.', 'Select a middle point');
      return;
    }
    pushHistorySnapshot();

    const pt = linePoints[selectedPoint];
    const prevPt = linePoints[selectedPoint - 1];
    const nextPt = linePoints[selectedPoint + 1];

    const interiorAngleVal = Math.round(calculateAngle(prevPt, pt, nextPt, true));
    const exteriorAngleVal = 360 - interiorAngleVal;
    const displayValue = interiorAngleVal;

    const bisector = getAngleBisector(prevPt, pt, nextPt);

    if (fabricRef.current) {
      const arcRadius = 25;

      const arc = new Circle({
        left: pt.x,
        top: pt.y,
        radius: arcRadius,
        fill: 'transparent',
        stroke: '#FF6B35',
        strokeWidth: 1.5,
        originX: 'center',
        originY: 'center',
        selectable: true,
        evented: true,
      });

      const textOffset = arcRadius + 15;
      const text = new IText(`${displayValue}°`, {
        left: pt.x + bisector.x * textOffset,
        top: pt.y + bisector.y * textOffset,
        fontSize: 16,
        fill: '#000',
        fontFamily: 'Arial',
        originX: 'center',
        originY: 'center',
        editable: true,
        selectable: true,
      });

      fabricRef.current.add(arc);
      fabricRef.current.add(text);

      // Add to measurements
      setMeasurements(prev => [...prev, {
        id: `angle-${Date.now()}`,
        type: 'angle',
        value: displayValue,
        originalValue: displayValue,
        visible: true,
        interiorValue: interiorAngleVal,
        exteriorValue: exteriorAngleVal,
        showInterior: true,
        labelObjectId: (text as any)._id,
      }]);

      fabricRef.current.renderAll();
    }

    setSelectedPoint(null);
  };

  const handleSave = async () => {
    if (!fabricRef.current) return;
    if (!name.trim()) {
      setSaveError(`Please enter a name for this ${featureSingularLower}.`);
      return;
    }

    setSaveError(null);
    setSaving(true);
    try {
      const canvas = fabricRef.current;

      const dataUrl = canvas.toDataURL({
        format: 'png',
        quality: 1,
        multiplier: 1,
      });

      const response = await fetch(dataUrl);
      const blob = await response.blob();

      // Export canvas JSON with custom properties
      const canvasJSON = JSON.stringify((canvas as any).toJSON([
        'measurementId',
        'lineStartIndex',
        'lineEndIndex',
        'pointIndex',
        'isPointMarker',
      ]));

      // Build clean measurements array for database. Length measurements
      // carry the unit that was active at draw time (mm for metric
      // accounts, inches for either Imperial option); angles are always
      // degrees regardless of the company's measurement system.
      const cleanMeasurements = measurements.map((m, index) => ({
        id: m.id,
        type: m.type,
        sequence: index + 1,
        value: m.value,
        // Canonical storage: lengths always written as mm. The display
        // conversion happens on render via formatLength(). Angles stay
        // in degrees.
        unit: m.type === 'length' ? 'mm' : 'degrees',
        pointIndices: m.type === 'length'
          ? [m.lineStartIndex, m.lineEndIndex]
          : [m.pointIndex! - 1, m.pointIndex!, (m.pointIndex! + 1) % linePoints.length],
        visible: m.visible,
        placement: m.type === 'angle' ? (m.showInterior ? 'interior' : 'exterior') : undefined,
      }));

      const formData = new FormData();
      formData.append('name', name);
      formData.append('description', description || '');
      formData.append('image', blob, 'flashing.png');
      formData.append('canvas_data', canvasJSON);
      formData.append('measurements', JSON.stringify(cleanMeasurements));

      // Log file sizes
      console.log('[FlashingSave] PNG size:', Math.round(blob.size / 1024), 'KB');
      console.log('[FlashingSave] Canvas JSON size:', Math.round(canvasJSON.length / 1024), 'KB');
      console.log('[FlashingSave] Measurements:', cleanMeasurements.length, 'items');

      if (editMode && flashingId) {
        // UPDATE existing flashing
        console.log('[FlashingSave] Updating existing flashing:', flashingId);
        await updateFlashingWithImage(flashingId, formData);
      } else {
        // CREATE new flashing
        console.log('[FlashingSave] Creating new flashing');
        const result = await createFlashingFromCanvas(formData);
        if (!result.ok) {
          if (result.code === 'flashing_limit_reached' || result.code === 'feature_gated') {
            // Server-side route gate should have prevented this, but if a
            // user squeaks through (e.g. limit hit between page load and
            // save) bounce them to the flashings page where the cap-aware
            // UpgradeModal lives.
            router.push(`/${workspaceSlug}/drawings`);
            return;
          }
          const msg = result.code === 'internal_error' ? result.message : `Save failed (${result.code})`;
          setSaveError(msg);
          return;
        }
      }

      router.push(`/${workspaceSlug}/drawings`);
    } catch (err: any) {
      console.error('Failed to save flashing:', err);
      setSaveError(err.message || 'The drawing could not be saved. Your work is still here.');
    } finally {
      setSaving(false);
    }
  };

  const currentSize = CANVAS_SIZES[canvasSize];

  return (
    <QcDrawingWorkspace>
      {feedback}
      {saveError && <p className="qc-drawing-error" role="alert">{saveError}</p>}
      {/* Loading overlay - show over canvas */}
      {loading && <QcJourneyDialog label="Loading drawing" size="sm" pending>
        <div className="qc-drawing-load" role="status" aria-live="polite">Loading drawing...</div>
      </QcJourneyDialog>}

      <div className="qc-drawing-header">
        <QcButton
          onClick={() => router.push(`/${workspaceSlug}/drawings`)}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back to library
        </QcButton>
        <div className="qc-drawing-identity"><h1 className="text-2xl font-semibold text-slate-900">
          {editMode ? `Edit ${featureLabelSingular}` : `Draw ${featureLabelSingular}`}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Draw to scale: 2 pixels = 1mm (max {currentSize.maxMm})
        </p></div>
      </div>

      {/* Input fields - Clean Card */}
      <div className="qc-drawing-card space-y-3" data-copilot="flashing-inputs">
        <div className="qc-drawing-fields">
          <div className="flex-1">
            <label htmlFor="qc-drawing-name" className="qc-label">Name *</label>
            <input
              id="qc-drawing-name" type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setSaveError(null); }}
              placeholder="e.g., Custom Ridge Cap"
              className="qc-input w-full"
            />
          </div>
          <div>
            <label htmlFor="qc-drawing-size" className="qc-label">Canvas size</label>
            <select id="qc-drawing-size"
              value={canvasSize}
              onChange={(e) => setCanvasSize(e.target.value as CanvasSize)}
              className="qc-select w-full"
            >
              <option value="small">Small (600x450)</option>
              <option value="medium">Medium (800x600)</option>
              <option value="large">Large (1200x900)</option>
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="qc-drawing-description" className="qc-label">Description</label>
          <input
            id="qc-drawing-description" type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
            className="qc-input w-full"
          />
        </div>
      </div>

      {/* Toolbar - Professional Design */}
      <div className="qc-drawing-toolbar" aria-label="Drawing tools" role="group" data-copilot="flashing-toolbar">
        <QcButton
          onClick={() => {
            if (!editingLocked && !checkAdjustPointsExit()) {
              setDrawMode('line');
            }
          }}
          disabled={editingLocked}
          aria-pressed={drawMode === 'line'} data-copilot="flashing-tool-line"
        >
          Line
        </QcButton>
        <QcButton
          onClick={() => {
            if (!editingLocked && !checkAdjustPointsExit()) {
              setDrawMode('text');
            }
          }}
          disabled={editingLocked}
          aria-pressed={drawMode === 'text'} data-copilot="flashing-tool-text"
        >
          Text
        </QcButton>
        <div className="relative">
          <QcButton
            onClick={() => {
              if (!editingLocked && !checkAdjustPointsExit()) {
                setDrawMode('draw');
              }
            }}
            disabled={editingLocked}
            aria-pressed={drawMode === 'draw'} data-copilot="flashing-tool-pencil"
          >
            Pencil
          </QcButton>
          {drawMode === 'draw' && (
            <div className="absolute top-full right-0 mt-1 flex gap-1 bg-white border border-slate-200 rounded-lg p-1.5 shadow-lg z-10">
              <QcButton
                onClick={() => setPencilWidth(1)}
                aria-label="Thin pencil" aria-pressed={pencilWidth === 1} title="Thin"
              >
                <div className="w-3 border-t border-current" style={{ borderWidth: '1px' }} />
              </QcButton>
              <QcButton
                onClick={() => setPencilWidth(2)}
                aria-label="Medium pencil" aria-pressed={pencilWidth === 2} title="Medium"
              >
                <div className="w-3 border-t-2 border-current" />
              </QcButton>
              <QcButton
                onClick={() => setPencilWidth(4)}
                aria-label="Thick pencil" aria-pressed={pencilWidth === 4} title="Thick"
              >
                <div className="w-3 border-t-4 border-current" />
              </QcButton>
            </div>
          )}
        </div>
        <QcButton
          onClick={() => {
            if (!editingLocked && !checkAdjustPointsExit()) {
              setDrawMode('edit');
            }
          }}
          disabled={editingLocked}
          aria-pressed={drawMode === 'edit'} data-copilot="flashing-tool-edit"
        >
          Edit
        </QcButton>
        <QcButton
          onClick={() => {
            if (!editingLocked) {
              handleAdjustPointsMode();
            }
          }}
          disabled={editingLocked}
          aria-pressed={drawMode === 'adjustPoints'} data-copilot="flashing-tool-adjust"
        >
          Adjust Points
        </QcButton>

        <QcButton
          variant={needsRecalibration ? 'primary' : 'ghost'} onClick={handleRecalibrateAll}
          disabled={editingLocked}
        >
          Recalibrate
        </QcButton>

        <QcButton
          onClick={handleSelectAll}
          disabled={editingLocked}
          title="Select All (Ctrl+A)"
        >
          Select All
        </QcButton>
        {editingLocked && (
          <QcButton
            onClick={handleDeselectAll}
            title="Deselect All - resume editing"
          >
            Deselect All
          </QcButton>
        )}

        <div className="qc-drawing-primary-actions">
          <QcButton
            onClick={handleUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
          >
            ↩ Undo
          </QcButton>
          <QcButton
            onClick={handleRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
          >
            ↪ Redo
          </QcButton>
          <QcButton
            variant="danger" onClick={handleClear}
          >
            Clear
          </QcButton>
          <QcButton
            onClick={() => router.push(`/${workspaceSlug}/drawings`)}
          >
            Cancel
          </QcButton>
          <QcButton
            variant="primary" onClick={handleSave}
            disabled={saving || !name.trim()}
            data-copilot="flashing-save"
          >
            {saving ? 'Saving...' : `Save ${featureLabelSingular}`}
          </QcButton>
        </div>
      </div>

      {/* Live Measurements + Finish button - Subtle Professional Design */}
      <div className="qc-drawing-readout" data-copilot="flashing-live-readout">
        <div className="flex gap-6 text-sm">
          <div>
            <span className="text-slate-600 font-medium">Length:</span>{' '}
            <span className="text-slate-900 font-bold">
              {measurements_live?.length != null ? formatLength(measurements_live.length, lengthUnit) : '-'}{lengthUnit}
            </span>
          </div>
          <div>
            <span className="text-slate-600 font-medium">Angle:</span>{' '}
            <span className="text-slate-900 font-bold">
              {measurements_live?.angle !== null && measurements_live?.angle !== undefined ? `${measurements_live.angle}°` : '-'}
            </span>
          </div>
        </div>
        {/* Orange Finish button - appears when a creative tool is active.
            Clicking it deselects everything and exits the tool so the user
            can freely pick a new tool, interact with the sidebar, or save. */}
        {(['line', 'text', 'draw', 'edit'] as DrawMode[]).includes(drawMode) && (
          <QcButton
            variant="primary" onClick={handleFinishTool}
            className="ml-4"
          >
            Finish
          </QcButton>
        )}
      </div>

      {/* Main Layout: Sidebar + Canvas */}
      <div className="qc-drawing-grid">
        {/* Left Sidebar - Measurements List - Professional Design */}
        <div className="qc-drawing-card qc-drawing-measurements" data-copilot="flashing-measurements">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Measurements</h3>
          {measurements.length === 0 ? (
            <p className="text-xs text-slate-400">No measurements yet</p>
          ) : (
            <div className="space-y-3">
              {measurements.map((m) => (
                <div
                  key={m.id}
                  className="qc-drawing-measurement" data-selected={selectedMeasurement === m.id}
                >
                  <div className="qc-drawing-measurement-heading">
                    <QcButton aria-pressed={selectedMeasurement === m.id}
                      onClick={() => { if (!checkAdjustPointsExit()) handleSelectMeasurement(m.id); }}>
                      Select {m.type === 'length' ? 'length' : 'angle'}
                    </QcButton>
                    <div className="qc-drawing-measurement-actions">
                      <QcButton
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!editingLocked && !checkAdjustPointsExit()) {
                            handleToggleTextVisibility(m.id);
                          }
                        }}
                        disabled={editingLocked || !m.visible}
                        title={m.textHidden ? 'Show text' : 'Hide text'}
                      >
                        {m.textHidden ? 'Show Text' : 'Hide Text'}
                      </QcButton>
                      {m.type === 'angle' && (
                        <QcButton
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!editingLocked && !checkAdjustPointsExit()) {
                              handleToggleArcVisibility(m.id);
                            }
                          }}
                          disabled={editingLocked || !m.visible}
                          aria-label={m.arcHidden ? 'Show angle arc ring' : 'Hide angle arc ring'} title={m.arcHidden ? 'Show angle arc ring' : 'Hide angle arc ring'}
                        >
                          <span style={{ color: m.arcHidden ? '#94a3b8' : '#FF6B35', fontSize: '20px', lineHeight: 1, fontWeight: 'bold' }}>○</span>
                        </QcButton>
                      )}
                      <QcButton
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!editingLocked && !checkAdjustPointsExit()) {
                            handleToggleMeasurementVisibility(m.id);
                          }
                        }}
                        disabled={editingLocked}
                        title={m.visible ? 'Hide all' : 'Show all'}
                      >
                        {m.visible ? 'Hide' : 'Show'}
                      </QcButton>
                    </div>
                  </div>
                  <div className="text-base font-bold text-slate-900 mb-3">
                    {m.type === 'length' ? `${formatLength(m.value, lengthUnit)}${lengthUnit}` : `${m.value}°`}
                    {m.type === 'angle' && (
                      <span className="text-xs font-normal text-slate-500 ml-1">
                        ({m.showInterior ? 'Interior' : 'Exterior'})
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {m.type === 'angle' && (
                      <>
                        <QcButton
                          data-copilot="flashing-angle-calc"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!editingLocked && !checkAdjustPointsExit()) {
                              handleOpenCalculator(m.id);
                            }
                          }}
                          disabled={editingLocked}
                          className="w-full text-left"
                          title="Auto-Calculate from Roof Pitches"
                        >
                          Auto-Calculate
                        </QcButton>
                        <QcButton
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!editingLocked && !checkAdjustPointsExit()) {
                              handleToggleAngleType(m.id);
                            }
                          }}
                          disabled={editingLocked}
                          className="w-full text-left"
                          title="Toggle Interior/Exterior"
                        >
                          Toggle Angle Type
                        </QcButton>
                      </>
                    )}
                    {m.type === 'length' && (
                      <QcButton
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!editingLocked && !checkAdjustPointsExit()) {
                            handleTogglePlacementSide(m.id);
                          }
                        }}
                        disabled={editingLocked}
                        className="w-full text-left"
                        title="Toggle placement side"
                      >
                        {m.placementSide === 'exterior' ? 'Exterior' : 'Interior'} Side
                      </QcButton>
                    )}
                    <QcButton
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!editingLocked && !checkAdjustPointsExit()) {
                          handleEditMeasurementValue(m.id);
                        }
                      }}
                      disabled={editingLocked}
                      className="w-full text-left"
                      title="Edit Value"
                    >
                      Edit Value
                    </QcButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Canvas - Professional Container */}
        <section className="qc-drawing-canvas-section" aria-label="Drawing canvas">
          <p id="qc-drawing-scroll-help" className="qc-drawing-scroll-hint">Drawing stays at its true scale. Scroll inside the canvas to see the rest.</p>
          <div className="qc-drawing-scrollport" tabIndex={0} role="region" aria-label="Scrollable drawing" aria-describedby="qc-drawing-scroll-help">
            <div className="qc-drawing-paper">
              <canvas ref={canvasRef} width={currentSize.width} height={currentSize.height} />
            </div>
          </div>
        </section>
      </div>

      {/* Instructions - Subtle Design */}
      <details className="qc-drawing-help">
        <summary>Drawing tools and shortcuts</summary>
        <ul className="text-sm text-slate-700 space-y-1 grid grid-cols-2 gap-x-6">
          <li><strong>Line Tool:</strong> Click points to draw. Angles appear automatically after 3rd point.</li>
          <li><strong>Text Tool:</strong> Click to add text labels anywhere on the canvas.</li>
          <li><strong>Pencil Tool:</strong> Freehand draw with 3 thickness options. Drawings are movable and resizable.</li>
          <li><strong>Select All:</strong> Ctrl+A to select and move entire drawing.</li>
          <li><strong>Sidebar:</strong> Click any measurement to highlight it on canvas.</li>
          <li><strong>Measurements:</strong> Appear as Length → Angle → Length → Angle...</li>
          <li><strong>Toggle Angle:</strong> Switch between interior/exterior angles in sidebar.</li>
          <li><strong>Hide/Show:</strong> Toggle visibility of individual measurements.</li>
          <li><strong>Edit Values:</strong> Change any measurement value manually.</li>
          <li><strong>Auto-Calculate:</strong> Use roof pitch calculator for accurate angles.</li>
        </ul>
      </details>

      {/* Angle Calculator Widget - same draggable floating widget used in
          the order editor. Stays open so the user can apply multiple angles
          without re-opening the calculator. */}
      <AngleCalculatorWidget
        isOpen={calculatorOpen}
        onClose={() => setCalculatorOpen(false)}
        onApply={handleApplyCalculatedAngle}
        currentAngle={
          calculatingAngleId
            ? measurements.find(m => m.id === calculatingAngleId)?.value || 0
            : 0
        }
      />

      {/* Adjust Points Confirmation Modal */}
      {showAdjustConfirmation && (
        <QcJourneyDialog label="Finish adjusting points" size="sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-slate-200">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Finished Adjusting?</h2>
            <p className="text-slate-700 mb-6">
              Are you sure you&apos;re finished adjusting the drawing points?
            </p>
            <p className="text-sm text-slate-500 mb-6">
              Click <strong>Recalibrate</strong> after adjusting to update all measurements.
            </p>
            <div className="flex gap-3">
              <QcButton
                onClick={() => handleConfirmFinishAdjusting(false)}
                className="flex-1"
              >
                No, Continue
              </QcButton>
              <QcButton
                variant="primary" onClick={() => handleConfirmFinishAdjusting(true)}
                className="flex-1"
              >
                Yes, Finish
              </QcButton>
            </div>
          </div>
        </QcJourneyDialog>
      )}

      {/* Select All Warning Modal */}
      {showSelectAllWarning && (
        <QcJourneyDialog label="Move the whole drawing" size="sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-slate-200">
            <h2 className="text-xl font-bold text-red-600 mb-4">Move the whole drawing?</h2>
            <p className="text-slate-700 mb-4">
              <strong>Make sure you are finished editing your drawing.</strong>
            </p>
            <p className="text-slate-700 mb-6">
              Select All pauses individual editing while you move or resize the whole drawing.
              Choose <strong>Deselect All</strong> to resume editing individual parts.
            </p>
            <p className="text-sm text-slate-500 mb-6">
              Select the whole drawing now?
            </p>
            <div className="flex gap-3">
              <QcButton
                onClick={() => handleConfirmSelectAll(false)}
                className="flex-1"
              >
                No, Continue Editing
              </QcButton>
              <QcButton
                variant="primary" onClick={() => handleConfirmSelectAll(true)}
                className="flex-1"
              >
                Select all
              </QcButton>
            </div>
          </div>
        </QcJourneyDialog>
      )}

      {/* Edit Value Modal - replaces the old window.prompt() for editing
          a measurement's length or angle value. Matches the visual style
          of the Adjust Points + Select All modals above so the flashing
          drawing experience reads as one coherent UI. */}
      {editValueMeasurementId && (() => {
        const m = measurements.find((x) => x.id === editValueMeasurementId);
        if (!m) return null;
        const close = () => {
          setEditValueMeasurementId(null);
          setEditValueInput('');
          setEditValueError(null);
        };
        const submit = () => {
          const num = parseFloat(editValueInput);
          if (!Number.isFinite(num)) { setEditValueError('Enter a valid number.'); return; }
          applyEditMeasurementValue(editValueMeasurementId, num);
          close();
        };
        const unit = m.type === 'length' ? lengthUnit : '°';
        return (
          <QcJourneyDialog label="Edit measurement value" size="sm" onRequestClose={close}>
            <div
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-slate-200"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold text-slate-900 mb-4">
                Edit {m.type === 'length' ? 'length' : 'angle'} value
              </h2>
              <p className="text-sm text-slate-600 mb-4">
                {m.type === 'length'
                  ? 'Enter the real-world length for this segment. The drawing will rescale to match while keeping connected points in sync.'
                  : 'Enter the angle you want this vertex to read. Subsequent points rotate around this vertex to land at the new angle.'}
              </p>
              {editValueError && <p role="alert" id="qc-value-error" className="qc-drawing-error">{editValueError}</p>}
              <div className="flex items-center gap-2 mb-6">
                <input aria-label={m.type === 'length' ? `Length in ${lengthUnit}` : 'Angle in degrees'} aria-invalid={!!editValueError} aria-describedby={editValueError ? 'qc-value-error' : undefined}
                  type="number"
                  step="any"
                  value={editValueInput}
                  onChange={(e) => { setEditValueInput(e.target.value); setEditValueError(null); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submit();
                    if (e.key === 'Escape') close();
                  }}
                  autoFocus
                  className="qc-input flex-1"
                />
                <span className="text-sm text-slate-500 font-medium">{unit}</span>
              </div>
              <div className="flex gap-3">
                <QcButton
                  type="button"
                  onClick={close}
                  className="flex-1"
                >
                  Cancel
                </QcButton>
                <QcButton
                  type="button"
                  variant="primary" onClick={submit}
                  className="flex-1"
                >
                  Apply
                </QcButton>
              </div>
            </div>
          </QcJourneyDialog>
        );
      })()}
    </QcDrawingWorkspace>
  );
}

