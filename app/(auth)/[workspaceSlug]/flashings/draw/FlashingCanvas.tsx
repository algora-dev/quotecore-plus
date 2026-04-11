'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Canvas, Line, Circle, IText, Rect, Object as FabricObject } from 'fabric';
import { createFlashingFromCanvas } from '../actions';

type DrawMode = 'none' | 'line' | 'text' | 'edit';
type CanvasSize = 'small' | 'medium' | 'large';

const CANVAS_SIZES = {
  small: { width: 600, height: 450, maxMm: '300mm x 225mm' },
  medium: { width: 800, height: 600, maxMm: '400mm x 300mm' },
  large: { width: 1200, height: 900, maxMm: '600mm x 450mm' },
};

const SCALE = 0.5; // 2 pixels = 1mm

interface DrawingPoint {
  x: number;
  y: number;
  marker: any;
}

export function FlashingCanvas({ workspaceSlug }: { workspaceSlug: string }) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fabricRef = useRef<Canvas | null>(null);
  
  const [canvasSize, setCanvasSize] = useState<CanvasSize>('medium');
  const [drawMode, setDrawMode] = useState<DrawMode>('none');
  const [linePoints, setLinePoints] = useState<DrawingPoint[]>([]);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [interiorAngle, setInteriorAngle] = useState(true);
  const [exteriorLength, setExteriorLength] = useState(true);
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<any>(null);
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  // Refs to avoid stale closure issues
  const drawModeRef = useRef<DrawMode>('none');
  const linePointsRef = useRef<DrawingPoint[]>([]);
  const interiorAngleRef = useRef(true);
  const canvasSizeRef = useRef<CanvasSize>('medium');

  // Update refs when state changes
  useEffect(() => {
    drawModeRef.current = drawMode;
    linePointsRef.current = linePoints;
    interiorAngleRef.current = interiorAngle;
    canvasSizeRef.current = canvasSize;
  }, [drawMode, linePoints, interiorAngle, canvasSize]);

  // Calculate distance in mm
  const calculateDistance = (p1: { x: number; y: number }, p2: { x: number; y: number }): number => {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy) * SCALE;
  };

  // Calculate angle between two segments in degrees
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

  // Calculate angle bisector direction for text placement
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
    
    const bisector = {
      x: (norm1.x + norm2.x) / 2,
      y: (norm1.y + norm2.y) / 2
    };
    
    return bisector;
  };

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current) return;
    
    // Dispose existing canvas if changing size
    if (fabricRef.current) {
      fabricRef.current.dispose();
      fabricRef.current = null;
    }

    const size = CANVAS_SIZES[canvasSize];
    const canvas = new Canvas(canvasRef.current, {
      width: size.width,
      height: size.height,
      backgroundColor: '#ffffff',
      selection: false,
    });

    fabricRef.current = canvas;

    // Mouse move - track cursor
    canvas.on('mouse:move', (opt) => {
      const pointer = canvas.getPointer(opt.e);
      setCursorPos({ x: pointer.x, y: pointer.y });
    });

    // Selection event - for selecting labels
    canvas.on('selection:created', (e) => {
      if (e.selected && e.selected[0]) {
        setSelectedLabel(e.selected[0]);
      }
    });

    canvas.on('selection:updated', (e) => {
      if (e.selected && e.selected[0]) {
        setSelectedLabel(e.selected[0]);
      }
    });

    canvas.on('selection:cleared', () => {
      setSelectedLabel(null);
    });

    // Mouse down - handle clicks
    canvas.on('mouse:down', (opt) => {
      const pointer = canvas.getPointer(opt.e);

      // Text mode
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

      // Edit mode - select point or enable dragging
      if (drawModeRef.current === 'edit') {
        const currentPoints = linePointsRef.current;
        
        // Check if clicking near a point
        for (let i = 0; i < currentPoints.length; i++) {
          const pt = currentPoints[i];
          const dist = Math.sqrt(Math.pow(pointer.x - pt.x, 2) + Math.pow(pointer.y - pt.y, 2));
          if (dist < 15) {
            setSelectedPoint(i);
            console.log('[Edit] Selected point:', i);
            return;
          }
        }
        return;
      }

      // Line mode - add points
      if (drawModeRef.current === 'line') {
        const currentPoints = linePointsRef.current;
        const newPoint = { x: pointer.x, y: pointer.y };

        // Add marker
        const marker = new Circle({
          left: newPoint.x,
          top: newPoint.y,
          radius: 4,
          fill: '#FF6B35',
          stroke: '#000',
          strokeWidth: 1,
          originX: 'center',
          originY: 'center',
          selectable: false,
          evented: false,
          data: { pointIndex: currentPoints.length },
        });
        canvas.add(marker);

        const newDrawingPoint: DrawingPoint = { x: newPoint.x, y: newPoint.y, marker };

        if (currentPoints.length > 0) {
          const prevPoint = currentPoints[currentPoints.length - 1];
          
          // Draw line
          const line = new Line([prevPoint.x, prevPoint.y, newPoint.x, newPoint.y], {
            stroke: '#000000',
            strokeWidth: 2,
            selectable: false,
            evented: false,
            data: { type: 'line', fromIndex: currentPoints.length - 1, toIndex: currentPoints.length },
          });
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
          
          const offset = exteriorLength ? 15 : -15;
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
            data: { type: 'lengthLabel', fromIndex: currentPoints.length - 1, toIndex: currentPoints.length },
          });
          canvas.add(lengthLabel);
        }

        setLinePoints([...currentPoints, newDrawingPoint]);
        canvas.renderAll();
      }
    });

    // Object moving - for draggable points in edit mode
    canvas.on('object:moving', (e) => {
      if (drawModeRef.current !== 'edit') return;
      const obj = e.target as any;
      if (!obj || !obj.data || obj.data.pointIndex === undefined) return;

      const pointIndex = obj.data.pointIndex;
      const currentPoints = linePointsRef.current;
      if (pointIndex >= currentPoints.length) return;

      // Update point position
      const newX = obj.left!;
      const newY = obj.top!;
      currentPoints[pointIndex].x = newX;
      currentPoints[pointIndex].y = newY;

      // Update connected lines and labels
      canvas.getObjects().forEach((canvasObj: any) => {
        if (canvasObj.data?.type === 'line') {
          if (canvasObj.data.fromIndex === pointIndex) {
            canvasObj.set({ x1: newX, y1: newY });
          }
          if (canvasObj.data.toIndex === pointIndex) {
            canvasObj.set({ x2: newX, y2: newY });
          }
        }

        // Update length labels
        if (canvasObj.data?.type === 'lengthLabel') {
          if (canvasObj.data.fromIndex === pointIndex || canvasObj.data.toIndex === pointIndex) {
            const fromPt = currentPoints[canvasObj.data.fromIndex];
            const toPt = currentPoints[canvasObj.data.toIndex];
            const length = Math.round(calculateDistance(fromPt, toPt));
            const midX = (fromPt.x + toPt.x) / 2;
            const midY = (fromPt.y + toPt.y) / 2;
            
            const dx = toPt.x - fromPt.x;
            const dy = toPt.y - fromPt.y;
            const lineLength = Math.sqrt(dx * dx + dy * dy);
            const perpX = -dy / lineLength;
            const perpY = dx / lineLength;
            const offset = exteriorLength ? 15 : -15;
            
            canvasObj.set({
              text: `${length}mm`,
              left: midX + perpX * offset,
              top: midY + perpY * offset,
            });
          }
        }
      });

      canvas.renderAll();
    });

    return () => {
      canvas.dispose();
    };
  }, [canvasSize, exteriorLength]);

  // Update cursor and marker selectability based on mode
  useEffect(() => {
    if (fabricRef.current) {
      const cursor = drawMode !== 'none' && drawMode !== 'edit' ? 'crosshair' : 'default';
      fabricRef.current.defaultCursor = cursor;
      fabricRef.current.hoverCursor = cursor;

      // Make markers draggable in edit mode
      fabricRef.current.getObjects().forEach((obj: any) => {
        if ((obj as any).data?.pointIndex !== undefined) {
          obj.set({
            selectable: drawMode === 'edit',
            evented: drawMode === 'edit',
          });
        }
      });
      fabricRef.current.renderAll();
    }
  }, [drawMode]);

  // Calculate live measurements
  const liveMeasurements = () => {
    if (drawMode !== 'line' || linePoints.length === 0 || !cursorPos) return null;

    const lastPoint = linePoints[linePoints.length - 1];
    const length = calculateDistance(lastPoint, cursorPos);

    let angle: number | null = null;
    if (linePoints.length >= 2) {
      const prevPoint = linePoints[linePoints.length - 2];
      angle = calculateAngle(prevPoint, lastPoint, cursorPos, interiorAngle);
    }

    return { length: Math.round(length), angle: angle !== null ? Math.round(angle) : null };
  };

  const measurements = liveMeasurements();

  const handleClear = () => {
    if (fabricRef.current) {
      fabricRef.current.clear();
      fabricRef.current.backgroundColor = '#ffffff';
      fabricRef.current.renderAll();
    }
    setLinePoints([]);
    setSelectedPoint(null);
    setSelectedLabel(null);
  };

  const handleFinishLine = () => {
    setLinePoints([]);
    setDrawMode('none');
  };

  const handleHideLabel = () => {
    if (selectedLabel && fabricRef.current) {
      fabricRef.current.remove(selectedLabel);
      fabricRef.current.renderAll();
      setSelectedLabel(null);
    }
  };

  const handleAddRightAngle = () => {
    if (selectedPoint === null || selectedPoint >= linePoints.length) return;
    
    // Right angle needs at least 2 points (before and after)
    if (selectedPoint === 0 || selectedPoint === linePoints.length - 1) {
      alert('Right angle can only be added to middle points (not first or last point)');
      return;
    }
    
    const pt = linePoints[selectedPoint];
    
    // Draw right angle symbol (small square)
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
        data: { type: 'rightAngle' },
      });
      fabricRef.current.add(square);
      fabricRef.current.renderAll();
    }
    
    setSelectedPoint(null);
  };

  const handleAddCustomAngle = () => {
    if (selectedPoint === null || selectedPoint < 1 || selectedPoint >= linePoints.length - 1) {
      alert('Custom angle requires a middle point with lines on both sides');
      return;
    }
    
    const pt = linePoints[selectedPoint];
    const prevPt = linePoints[selectedPoint - 1];
    const nextPt = linePoints[selectedPoint + 1];
    
    const angle = Math.round(calculateAngle(prevPt, pt, nextPt, interiorAngle));
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
        data: { type: 'angleArc' },
      });
      
      const textOffset = arcRadius + 15;
      const text = new IText(`${angle}°`, {
        left: pt.x + bisector.x * textOffset,
        top: pt.y + bisector.y * textOffset,
        fontSize: 16,
        fill: '#000',
        fontFamily: 'Arial',
        originX: 'center',
        originY: 'center',
        editable: true,
        selectable: true,
        data: { type: 'angleLabel' },
      });
      
      fabricRef.current.add(arc);
      fabricRef.current.add(text);
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
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Draw Flashing</h1>
        <p className="text-sm text-slate-500 mt-1">
          Draw to scale: 2 pixels = 1mm (max {currentSize.maxMm})
        </p>
      </div>

      {/* Input fields */}
      <div className="mb-4 space-y-3">
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

      {/* Toolbar */}
      <div className="mb-4 flex gap-2 items-center flex-wrap">
        <button
          onClick={() => setDrawMode('line')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
            drawMode === 'line'
              ? 'bg-[#FF6B35] text-white shadow-lg'
              : 'bg-white border border-slate-300 hover:bg-slate-50'
          }`}
        >
          📏 Line
        </button>
        <button
          onClick={() => setDrawMode('text')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
            drawMode === 'text'
              ? 'bg-[#FF6B35] text-white shadow-lg'
              : 'bg-white border border-slate-300 hover:bg-slate-50'
          }`}
        >
          📝 Text
        </button>
        <button
          onClick={() => setDrawMode('edit')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
            drawMode === 'edit'
              ? 'bg-[#FF6B35] text-white shadow-lg'
              : 'bg-white border border-slate-300 hover:bg-slate-50'
          }`}
        >
          ✏️ Edit
        </button>
        
        <div className="h-8 w-px bg-slate-300" />
        
        <button
          onClick={() => setInteriorAngle(!interiorAngle)}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-white border border-slate-300 hover:bg-slate-50"
        >
          Angle: {interiorAngle ? '📐 Interior' : '📐 Exterior'}
        </button>

        <button
          onClick={() => setExteriorLength(!exteriorLength)}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-white border border-slate-300 hover:bg-slate-50"
        >
          Length: {exteriorLength ? '↗️ Exterior' : '↙️ Interior'}
        </button>
        
        {selectedLabel && (
          <button
            onClick={handleHideLabel}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700"
          >
            👁️ Hide Label
          </button>
        )}
        
        {selectedPoint !== null && (
          <>
            <button
              onClick={handleAddRightAngle}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700"
            >
              ⊏ Right Angle
            </button>
            <button
              onClick={handleAddCustomAngle}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              ⌒ Custom Angle
            </button>
          </>
        )}
        
        {drawMode === 'line' && linePoints.length > 0 && (
          <button
            onClick={handleFinishLine}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700"
          >
            ✓ Finish Line ({linePoints.length} points)
          </button>
        )}
        
        <div className="ml-auto flex gap-2">
          <button
            onClick={handleClear}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-white border border-slate-300 hover:bg-slate-50"
          >
            🗑️ Clear
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

      {/* Live Measurements */}
      <div className="mb-4 p-4 bg-blue-50 border-2 border-blue-300 rounded-lg inline-block min-w-[400px]">
        <div className="flex gap-8 text-lg font-mono">
          <div>
            <span className="text-blue-700 font-semibold">Length:</span>{' '}
            <span className="text-blue-900 font-bold text-2xl">
              {measurements?.length || '—'}mm
            </span>
          </div>
          <div>
            <span className="text-blue-700 font-semibold">Angle:</span>{' '}
            <span className="text-blue-900 font-bold text-2xl">
              {measurements?.angle !== null && measurements?.angle !== undefined ? `${measurements.angle}°` : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="border-2 border-slate-300 rounded-xl overflow-hidden inline-block shadow-lg">
        <canvas ref={canvasRef} width={currentSize.width} height={currentSize.height} />
      </div>

      {/* Instructions */}
      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg max-w-3xl">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">✨ How to Use:</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li><strong>Canvas Size:</strong> Change Small/Medium/Large to fit your flashing design.</li>
          <li><strong>📏 Line Tool:</strong> Click points to draw. Watch live measurements above canvas.</li>
          <li><strong>✏️ Edit Tool:</strong> Click orange point → add angle annotation, OR drag points to reposition.</li>
          <li><strong>👁️ Hide Label:</strong> Select any label (click it) → click "Hide Label" to remove clutter.</li>
          <li><strong>🎯 Drag Points:</strong> In Edit mode, click and drag orange markers to adjust the drawing.</li>
          <li><strong>Scale:</strong> 2 pixels = 1mm (draw actual dimensions!)</li>
        </ul>
      </div>
    </div>
  );
}
