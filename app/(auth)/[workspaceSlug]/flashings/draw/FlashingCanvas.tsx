'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Canvas, Line, Circle, IText, Rect, ActiveSelection, Object as FabricObject } from 'fabric';
import { createFlashingFromCanvas } from '../actions';
import { AngleCalculatorModal } from './AngleCalculatorModal';

type DrawMode = 'none' | 'line' | 'text' | 'edit' | 'adjustPoints';
type CanvasSize = 'small' | 'medium' | 'large';

const CANVAS_SIZES = {
  small: { width: 600, height: 450, maxMm: '300mm x 225mm' },
  medium: { width: 800, height: 600, maxMm: '400mm x 300mm' },
  large: { width: 1200, height: 900, maxMm: '600mm x 450mm' },
};

const SCALE = 0.5; // 2 pixels = 1mm

interface MeasurementItem {
  id: string;
  type: 'length' | 'angle';
  value: number;
  originalValue: number;
  visible: boolean;
  labelObjectId?: string;
  // For angles
  interiorValue?: number;
  exteriorValue?: number;
  showInterior?: boolean;
  // For placement and repositioning
  placementSide?: 'interior' | 'exterior';
  // Store line endpoints for length label repositioning AND point indices
  lineStart?: { x: number; y: number };
  lineEnd?: { x: number; y: number };
  lineStartIndex?: number; // Index in linePoints array
  lineEndIndex?: number;   // Index in linePoints array
  // For angles - store the point index this angle is at
  pointIndex?: number;
  adjacentLineIndices?: number[]; // Indices of connected line measurements
}

interface CanvasState {
  canvasJSON: string;
  measurements: MeasurementItem[];
}

export function FlashingCanvas({ workspaceSlug }: { workspaceSlug: string }) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fabricRef = useRef<Canvas | null>(null);
  
  const [canvasSize, setCanvasSize] = useState<CanvasSize>('medium');
  const [drawMode, setDrawMode] = useState<DrawMode>('none');
  const [measurements, setMeasurements] = useState<MeasurementItem[]>([]);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [linePoints, setLinePoints] = useState<{ x: number; y: number }[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const [selectedMeasurement, setSelectedMeasurement] = useState<string | null>(null);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [calculatingAngleId, setCalculatingAngleId] = useState<string | null>(null);
  const [needsRecalibration, setNeedsRecalibration] = useState(false);
  const [showAdjustConfirmation, setShowAdjustConfirmation] = useState(false);
  const [showSelectAllWarning, setShowSelectAllWarning] = useState(false);
  const [editingLocked, setEditingLocked] = useState(false);
  
  // History removed - was causing issues with canvas state sync
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

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

    canvas.on('mouse:move', (opt) => {
      const pointer = canvas.getPointer(opt.e);
      setCursorPos({ x: pointer.x, y: pointer.y });
    });

    canvas.on('mouse:down', (opt) => {
      const pointer = canvas.getPointer(opt.e);

      if (drawModeRef.current === 'text') {
        const text = new IText('Text', {
          left: pointer.x,
          top: pointer.y,
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

            newMeasurements.push({
              id: measurementId,
              type: 'angle',
              value: displayValue,
              originalValue: displayValue,
              visible: true,
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
          
          const lengthLabel = new IText(`${length}mm`, {
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
                    text: `${newLength}mm`,
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

    return () => {
      canvas.dispose();
    };
  }, [canvasSize]); // Only re-init when canvas size changes

  useEffect(() => {
    if (fabricRef.current) {
      const cursor = (drawMode === 'line' || drawMode === 'text') ? 'crosshair' : 'default';
      fabricRef.current.defaultCursor = cursor;
      fabricRef.current.hoverCursor = cursor;
      
      const canvas = fabricRef.current;
      
      // Deselect everything when switching modes (UNLESS editing is locked from Select All)
      if (!editingLocked) {
        canvas.discardActiveObject();
      }
      
      // Show/hide angle circles based on mode
      canvas.getObjects().forEach((obj: any) => {
        if (obj.type === 'circle' && obj.measurementId) {
          // This is an angle arc/circle - check measurement visibility too
          const measurement = measurements.find(m => m.id === obj.measurementId);
          const shouldShow = drawMode !== 'adjustPoints' && (!measurement || measurement.visible);
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

  const handleFinishLine = () => {
    setLinePoints([]);
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
        obj.set('visible', newVisible);
      }
    });
    
    setMeasurements(measurements.map(m => 
      m.id === id ? { ...m, visible: newVisible } : m
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
                  text: `${newLength}mm`,
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

  const handleEditMeasurementValue = (id: string) => {
    const measurement = measurements.find(m => m.id === id);
    if (!measurement || !fabricRef.current) return;

    const newValue = prompt(`Enter new ${measurement.type} value:`, measurement.value.toString());
    if (newValue === null) return;

    const numValue = parseFloat(newValue);
    if (isNaN(numValue)) return;

    const canvas = fabricRef.current;
    const currentPoints = linePointsRef.current;
    
    if (measurement.type === 'length') {
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
            (textObj as any).set('text', `${actualLength}mm`);
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

    // Update geometry (same logic as handleEditMeasurementValue for angles)
    if (pointIdx !== undefined && pointIdx >= 1 && pointIdx < currentPoints.length - 1) {
      const p1 = currentPoints[pointIdx - 1];
      const p2 = currentPoints[pointIdx];
      const p3 = currentPoints[pointIdx + 1];
      
      // Calculate current angle using ACTUAL current points
      const currentInterior = calculateAngle(p1, p2, p3, true);
      const targetInterior = measurement.showInterior ? newAngle : 360 - newAngle;
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

    // Update text label
    const textObj = canvas.getObjects().find((o: any) => 
      o.measurementId === calculatingAngleId && o.type === 'i-text'
    );
    if (textObj) {
      (textObj as any).set('text', `${newAngle}°`);
    }

    // Update measurement state
    const newInterior = measurement.showInterior ? newAngle : 360 - newAngle;
    const newExterior = 360 - newInterior;
    
    setMeasurements(measurements.map(m =>
      m.id === calculatingAngleId 
        ? { ...m, value: newAngle, interiorValue: newInterior, exteriorValue: newExterior }
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

  const handleAddRightAngle = () => {
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

  const handleAddCustomAngle = () => {
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
      alert('Please enter a name for this flashing');
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

      const canvasJSON = JSON.stringify(canvas.toJSON());

      const formData = new FormData();
      formData.append('name', name);
      formData.append('description', description || '');
      formData.append('image', blob, 'flashing.png');
      formData.append('canvas_data', canvasJSON);

      await createFlashingFromCanvas(formData);

      router.push(`/${workspaceSlug}/flashings`);
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Draw Flashing</h1>
        <p className="text-sm text-slate-600 mt-1">
          Draw to scale: 2 pixels = 1mm (max {currentSize.maxMm})
        </p>
      </div>

      {/* Input fields - Clean Card */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 mb-4 space-y-3">
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
      <div className="bg-white rounded-lg border border-slate-200 p-3 mb-4 flex gap-2 items-center flex-wrap">
        <button
          onClick={() => {
            if (!editingLocked && !checkAdjustPointsExit()) {
              setDrawMode('line');
            }
          }}
          disabled={editingLocked}
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
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
            drawMode === 'text' ? 'bg-black text-white shadow-lg' : 'bg-white border border-slate-300 hover:bg-slate-50'
          } ${editingLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          Text
        </button>
        <button
          onClick={() => {
            if (!editingLocked && !checkAdjustPointsExit()) {
              setDrawMode('edit');
            }
          }}
          disabled={editingLocked}
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
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
            drawMode === 'adjustPoints' ? 'bg-black text-white shadow-lg' : 'bg-white border border-slate-300 hover:bg-slate-50'
          } ${editingLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          Adjust Points
        </button>
        
        <div className="h-8 w-px bg-slate-300" />
        
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
          title="Select All (Ctrl+A)"
          className="px-4 py-2 text-sm font-medium rounded-lg bg-white border border-slate-300 hover:bg-slate-50"
        >
          Select All
        </button>
        
        <div className="ml-auto flex gap-2">
          <button
            onClick={handleClear}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-white border border-slate-300 hover:bg-slate-50"
          >
            Clear
          </button>
          <button
            onClick={() => router.push(`/${workspaceSlug}/flashings`)}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-white border border-slate-300 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-black text-white hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)] disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Flashing'}
          </button>
        </div>
      </div>

      {/* Live Measurements - Subtle Professional Design */}
      <div className="mb-4 p-3 bg-slate-100 border border-slate-200 rounded-lg inline-block">
        <div className="flex gap-6 text-sm">
          <div>
            <span className="text-slate-600 font-medium">Length:</span>{' '}
            <span className="text-slate-900 font-bold">
              {measurements_live?.length || '—'}mm
            </span>
          </div>
          <div>
            <span className="text-slate-600 font-medium">Angle:</span>{' '}
            <span className="text-slate-900 font-bold">
              {measurements_live?.angle !== null && measurements_live?.angle !== undefined ? `${measurements_live.angle}°` : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Layout: Sidebar + Canvas */}
      <div className="flex gap-4">
        {/* Left Sidebar - Measurements List - Professional Design */}
        <div className="w-72 bg-white border border-slate-200 rounded-lg p-4 max-h-[700px] overflow-y-auto shadow-sm">
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
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!editingLocked && !checkAdjustPointsExit()) {
                          handleToggleMeasurementVisibility(m.id);
                        }
                      }}
                      disabled={editingLocked}
                      className={`text-xs px-2 py-0.5 bg-slate-200 hover:bg-slate-300 rounded ${editingLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                      title={m.visible ? 'Hide' : 'Show'}
                    >
                      {m.visible ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <div className="text-base font-bold text-slate-900 mb-3">
                    {m.type === 'length' ? `${m.value}mm` : `${m.value}°`}
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
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!editingLocked && !checkAdjustPointsExit()) {
                              handleOpenCalculator(m.id);
                            }
                          }}
                          disabled={editingLocked}
                          className={`w-full text-xs px-2 py-1.5 bg-[#FF6B35] text-white hover:bg-[#ff5722] rounded text-left font-medium ${editingLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                          className={`w-full text-xs px-2 py-1.5 bg-blue-100 hover:bg-blue-200 rounded text-left ${editingLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                        className={`w-full text-xs px-2 py-1.5 bg-purple-100 hover:bg-purple-200 rounded text-left ${editingLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
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
          <li><strong>Select All:</strong> Ctrl+A to select and move entire drawing.</li>
          <li><strong>Sidebar:</strong> Click any measurement to highlight it on canvas.</li>
          <li><strong>Measurements:</strong> Appear as Length → Angle → Length → Angle...</li>
          <li><strong>Toggle Angle:</strong> Switch between interior/exterior angles in sidebar.</li>
          <li><strong>Hide/Show:</strong> Toggle visibility of individual measurements.</li>
          <li><strong>Edit Values:</strong> Change any measurement value manually.</li>
          <li><strong>Auto-Calculate:</strong> Use roof pitch calculator for accurate angles.</li>
        </ul>
      </div>

      {/* Angle Calculator Modal */}
      <AngleCalculatorModal
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
              Are you sure you're finished adjusting the drawing points?
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
    </div>
  );
}
