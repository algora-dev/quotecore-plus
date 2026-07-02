'use client';

import { useState, useRef, useEffect } from 'react';
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

  // History removed - was causing issues with canvas state sync

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
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'a') {
          e.preventDefault();
          handleSelectAll();
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

            // Arc is hidden by default — user can show via sidebar toggle
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
            alert('Error: Canvas data is corrupted');
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
            alert('⚠️ Cannot load this drawing for editing.\n\nThis may be due to incompatible canvas format.\n\nPlease create a new ' + featureSingularLower + ' from scratch.');
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
        alert(`Failed to load flashing: ${err}`);
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
      alert('Right angle can only be added to middle points');
      return;
    }

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
      alert('Custom angle requires a middle point');
      return;
    }

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
      alert(`Please enter a name for this ${featureSingularLower}`);
      return;
    }

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
          alert(`Error: ${msg}`);
          return;
        }
      }

      router.push(`/${workspaceSlug}/drawings`);
    } catch (err: any) {
      console.error('Failed to save flashing:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const currentSize = CANVAS_SIZES[canvasSize];

  return (
    <div className="max-w-full mx-auto p-6 bg-slate-50 min-h-screen">
      {/* Loading overlay - show over canvas */}
      {loading && (
        <div className="fixed inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="text-center">
            <div className="text-lg font-semibold text-slate-900">Loading {featureSingularLower}...</div>
            <div className="text-sm text-slate-600 mt-2">Please wait</div>
          </div>
        </div>
      )}
      <div className="mb-6">
        <button
          onClick={() => router.push(`/${workspaceSlug}/drawings`)}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 transition-colors mb-3"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back
        </button>
        <h1 className="text-2xl font-semibold text-slate-900">
          {editMode ? `Edit ${featureLabelSingular}` : `Draw ${featureLabelSingular}`}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Draw to scale: 2 pixels = 1mm (max {currentSize.maxMm})
        </p>
      </div>

      {/* Input fields - Clean Card */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 mb-4 space-y-3" data-copilot="flashing-inputs">
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Custom Ridge Cap"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Canvas Size</label>
            <select
              value={canvasSize}
              onChange={(e) => setCanvasSize(e.target.value as CanvasSize)}
              className="px-3 py-2 border border-slate-300 rounded-lg bg-white"
            >
              <option value="small">Small (600x450)</option>
              <option value="medium">Medium (800x600)</option>
              <option value="large">Large (1200x900)</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
          />
        </div>
      </div>

      {/* Toolbar - Professional Design */}
      <div className="bg-white rounded-lg border border-slate-200 p-3 mb-4 flex gap-2 items-center flex-wrap" data-copilot="flashing-toolbar">
        <button
          onClick={() => {
            if (!editingLocked && !checkAdjustPointsExit()) {
              setDrawMode('line');
            }
          }}
          disabled={editingLocked}
          data-copilot="flashing-tool-line"
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
            drawMode === 'line' ? 'bg-black text-white shadow-lg' : 'bg-white border border-slate-300 hover:bg-slate-50'
          } ${editingLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          Line
        </button>
        <button
          onClick={() => {
            if (!editingLocked && !checkAdjustPointsExit()) {
              setDrawMode('text');
            }
          }}
          disabled={editingLocked}
          data-copilot="flashing-tool-text"
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
            drawMode === 'text' ? 'bg-black text-white shadow-lg' : 'bg-white border border-slate-300 hover:bg-slate-50'
          } ${editingLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          Text
        </button>
        <div className="relative">
          <button
            onClick={() => {
              if (!editingLocked && !checkAdjustPointsExit()) {
                setDrawMode('draw');
              }
            }}
            disabled={editingLocked}
            data-copilot="flashing-tool-pencil"
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              drawMode === 'draw' ? 'bg-black text-white shadow-lg' : 'bg-white border border-slate-300 hover:bg-slate-50'
            } ${editingLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Pencil
          </button>
          {drawMode === 'draw' && (
            <div className="absolute top-full left-0 mt-1 flex gap-1 bg-white border border-slate-200 rounded-lg p-1.5 shadow-lg z-10">
              <button
                onClick={() => setPencilWidth(1)}
                className={`w-8 h-8 flex items-center justify-center rounded transition ${
                  pencilWidth === 1 ? 'bg-black text-white' : 'hover:bg-slate-100'
                }`}
                title="Thin"
              >
                <div className="w-3 border-t border-current" style={{ borderWidth: '1px' }} />
              </button>
              <button
                onClick={() => setPencilWidth(2)}
                className={`w-8 h-8 flex items-center justify-center rounded transition ${
                  pencilWidth === 2 ? 'bg-black text-white' : 'hover:bg-slate-100'
                }`}
                title="Medium"
              >
                <div className="w-3 border-t-2 border-current" />
              </button>
              <button
                onClick={() => setPencilWidth(4)}
                className={`w-8 h-8 flex items-center justify-center rounded transition ${
                  pencilWidth === 4 ? 'bg-black text-white' : 'hover:bg-slate-100'
                }`}
                title="Thick"
              >
                <div className="w-3 border-t-4 border-current" />
              </button>
            </div>
          )}
        </div>
        <button
          onClick={() => {
            if (!editingLocked && !checkAdjustPointsExit()) {
              setDrawMode('edit');
            }
          }}
          disabled={editingLocked}
          data-copilot="flashing-tool-edit"
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
            drawMode === 'edit' ? 'bg-black text-white shadow-lg' : 'bg-white border border-slate-300 hover:bg-slate-50'
          } ${editingLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          Edit
        </button>
        <button
          onClick={() => {
            if (!editingLocked) {
              handleAdjustPointsMode();
            }
          }}
          disabled={editingLocked}
          data-copilot="flashing-tool-adjust"
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
            drawMode === 'adjustPoints' ? 'bg-black text-white shadow-lg' : 'bg-white border border-slate-300 hover:bg-slate-50'
          } ${editingLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          Adjust Points
        </button>

        <button
          onClick={handleRecalibrateAll}
          disabled={editingLocked}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
            needsRecalibration
              ? 'bg-[#FF6B35] text-white shadow-lg animate-pulse hover:bg-[#ff5722]'
              : 'bg-white border border-slate-300 hover:bg-slate-50'
          } ${editingLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          Recalibrate
        </button>

        <button
          onClick={handleSelectAll}
          disabled={editingLocked}
          title="Select All (Ctrl+A)"
          className={`px-4 py-2 text-sm font-medium rounded-lg bg-white border border-slate-300 hover:bg-slate-50 ${editingLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          Select All
        </button>
        {editingLocked && (
          <button
            onClick={handleDeselectAll}
            title="Deselect All - resume editing"
            className="px-4 py-2 text-sm font-medium rounded-lg bg-[#FF6B35] text-white hover:bg-[#ff5722] transition-all"
          >
            Deselect All
          </button>
        )}

        <div className="ml-auto flex gap-2">
          <button
            onClick={handleClear}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-white border border-slate-300 hover:bg-slate-50"
          >
            Clear
          </button>
          <button
            onClick={() => router.push(`/${workspaceSlug}/drawings`)}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-white border border-slate-300 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            data-copilot="flashing-save"
            className="px-4 py-2 text-sm font-medium rounded-lg bg-black text-white hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)] disabled:opacity-50"
          >
            {saving ? 'Saving...' : `Save ${featureLabelSingular}`}
          </button>
        </div>
      </div>

      {/* Live Measurements + Finish button - Subtle Professional Design */}
      <div className="mb-4 p-3 bg-slate-100 border border-slate-200 rounded-lg inline-flex items-center" data-copilot="flashing-live-readout">
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
          <button
            onClick={handleFinishTool}
            className="ml-4 px-4 py-1.5 text-sm font-medium rounded-full bg-[#FF6B35] text-white hover:bg-[#ff5722] transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
          >
            Finish
          </button>
        )}
      </div>

      {/* Main Layout: Sidebar + Canvas */}
      <div className="flex gap-4">
        {/* Left Sidebar - Measurements List - Professional Design */}
        <div className="w-72 bg-white border border-slate-200 rounded-lg p-4 max-h-[700px] overflow-y-auto shadow-sm" data-copilot="flashing-measurements">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Measurements</h3>
          {measurements.length === 0 ? (
            <p className="text-xs text-slate-400">No measurements yet</p>
          ) : (
            <div className="space-y-3">
              {measurements.map((m) => (
                <div
                  key={m.id}
                  onClick={() => {
                    if (!checkAdjustPointsExit()) {
                      handleSelectMeasurement(m.id);
                    }
                  }}
                  className={`p-3 border rounded-lg cursor-pointer transition-all ${
                    selectedMeasurement === m.id
                      ? 'border-[#FF6B35] bg-orange-50 shadow-sm ring-1 ring-orange-200'
                      : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-medium text-slate-600">
                      {m.type === 'length' ? 'Length' : 'Angle'}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!editingLocked && !checkAdjustPointsExit()) {
                            handleToggleTextVisibility(m.id);
                          }
                        }}
                        disabled={editingLocked || !m.visible}
                        className={`text-xs px-2 py-0.5 bg-slate-200 hover:bg-slate-300 rounded ${(editingLocked || !m.visible) ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title={m.textHidden ? 'Show text' : 'Hide text'}
                      >
                        {m.textHidden ? 'Show Text' : 'Hide Text'}
                      </button>
                      {m.type === 'angle' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!editingLocked && !checkAdjustPointsExit()) {
                              handleToggleArcVisibility(m.id);
                            }
                          }}
                          disabled={editingLocked || !m.visible}
                          className={`flex items-center justify-center w-7 h-6 bg-slate-200 hover:bg-slate-300 rounded ${(editingLocked || !m.visible) ? 'opacity-50 cursor-not-allowed' : ''}`}
                          title={m.arcHidden ? 'Show angle arc ring' : 'Hide angle arc ring'}
                        >
                          <span style={{ color: m.arcHidden ? '#94a3b8' : '#FF6B35', fontSize: '20px', lineHeight: 1, fontWeight: 'bold' }}>○</span>
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!editingLocked && !checkAdjustPointsExit()) {
                            handleToggleMeasurementVisibility(m.id);
                          }
                        }}
                        disabled={editingLocked}
                        className={`text-xs px-2 py-0.5 bg-slate-200 hover:bg-slate-300 rounded ${editingLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title={m.visible ? 'Hide all' : 'Show all'}
                      >
                        {m.visible ? 'Hide' : 'Show'}
                      </button>
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
                        <button
                          data-copilot="flashing-angle-calc"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!editingLocked && !checkAdjustPointsExit()) {
                              handleOpenCalculator(m.id);
                            }
                          }}
                          disabled={editingLocked}
                          className={`w-full text-xs px-2 py-1.5 bg-slate-100 hover:bg-slate-200 rounded text-left font-medium text-slate-700 ${editingLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                          title="Auto-Calculate from Roof Pitches"
                        >
                          Auto-Calculate
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!editingLocked && !checkAdjustPointsExit()) {
                              handleToggleAngleType(m.id);
                            }
                          }}
                          disabled={editingLocked}
                          className={`w-full text-xs px-2 py-1.5 bg-slate-100 hover:bg-slate-200 rounded text-left ${editingLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                          title="Toggle Interior/Exterior"
                        >
                          Toggle Angle Type
                        </button>
                      </>
                    )}
                    {m.type === 'length' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!editingLocked && !checkAdjustPointsExit()) {
                            handleTogglePlacementSide(m.id);
                          }
                        }}
                        disabled={editingLocked}
                        className={`w-full text-xs px-2 py-1.5 bg-slate-100 hover:bg-slate-200 rounded text-left ${editingLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title="Toggle placement side"
                      >
                        {m.placementSide === 'exterior' ? 'Exterior' : 'Interior'} Side
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!editingLocked && !checkAdjustPointsExit()) {
                          handleEditMeasurementValue(m.id);
                        }
                      }}
                      disabled={editingLocked}
                      className={`w-full text-xs px-2 py-1.5 bg-slate-100 hover:bg-slate-200 rounded text-left ${editingLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                      title="Edit Value"
                    >
                      Edit Value
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Canvas - Professional Container */}
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          <canvas ref={canvasRef} width={currentSize.width} height={currentSize.height} />
        </div>
      </div>

      {/* Instructions - Subtle Design */}
      <div className="mt-4 p-4 bg-slate-100 border border-slate-200 rounded-lg">
        <h3 className="text-sm font-semibold text-slate-900 mb-2">How to Use:</h3>
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
      </div>

      {/* Angle Calculator Widget — same draggable floating widget used in
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
        <div className="fixed inset-0 backdrop-blur-md bg-slate-900/20 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-slate-200">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Finished Adjusting?</h2>
            <p className="text-slate-700 mb-6">
              Are you sure you&apos;re finished adjusting the drawing points?
            </p>
            <p className="text-sm text-slate-500 mb-6">
              Click <strong>Recalibrate</strong> after adjusting to update all measurements.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleConfirmFinishAdjusting(false)}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 font-medium rounded-full hover:bg-slate-50 transition-all shadow-sm"
              >
                No, Continue
              </button>
              <button
                onClick={() => handleConfirmFinishAdjusting(true)}
                className="flex-1 px-4 py-2 bg-[#FF6B35] text-white font-medium rounded-full hover:bg-[#ff5722] transition-all shadow-sm"
              >
                Yes, Finish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Select All Warning Modal */}
      {showSelectAllWarning && (
        <div className="fixed inset-0 backdrop-blur-md bg-slate-900/20 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border border-slate-200">
            <h2 className="text-xl font-bold text-red-600 mb-4">⚠️ Warning: Final Step</h2>
            <p className="text-slate-700 mb-4">
              <strong>Make sure you are finished editing your drawing.</strong>
            </p>
            <p className="text-slate-700 mb-6">
              Once you use the Select All feature, you <strong>cannot edit the drawing any further</strong>.
              You will only be able to move and resize the entire image.
            </p>
            <p className="text-sm text-slate-500 mb-6">
              Are you ready to finalize your drawing?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleConfirmSelectAll(false)}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 font-medium rounded-full hover:bg-slate-50 transition-all shadow-sm"
              >
                No, Continue Editing
              </button>
              <button
                onClick={() => handleConfirmSelectAll(true)}
                className="flex-1 px-4 py-2 bg-red-600 text-white font-medium rounded-full hover:bg-red-700 transition-all shadow-sm"
              >
                Yes, Finalize
              </button>
            </div>
          </div>
        </div>
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
        };
        const submit = () => {
          const num = parseFloat(editValueInput);
          if (!Number.isFinite(num)) return;
          applyEditMeasurementValue(editValueMeasurementId, num);
          close();
        };
        const unit = m.type === 'length' ? lengthUnit : '°';
        return (
          <div
            className="fixed inset-0 backdrop-blur-md bg-slate-900/20 flex items-center justify-center z-50"
          >
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
              <div className="flex items-center gap-2 mb-6">
                <input
                  type="number"
                  step="any"
                  value={editValueInput}
                  onChange={(e) => setEditValueInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submit();
                    if (e.key === 'Escape') close();
                  }}
                  autoFocus
                  className="flex-1 px-3 py-2 text-base border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
                <span className="text-sm text-slate-500 font-medium">{unit}</span>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={close}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 font-medium rounded-full hover:bg-slate-50 transition-all shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submit}
                  className="flex-1 px-4 py-2 bg-[#FF6B35] text-white font-medium rounded-full hover:bg-[#ff5722] transition-all shadow-sm"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

