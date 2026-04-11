'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Canvas, Line, Circle, IText, Rect, Path } from 'fabric';
import { createFlashingFromCanvas } from '../actions';

type DrawMode = 'none' | 'line' | 'text' | 'edit';
type AngleType = 'right' | 'custom';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const SCALE = 1; // 1 pixel = 1mm

interface AnnotatedPoint {
  x: number;
  y: number;
  angleType: AngleType;
  angleValue: number;
  marker?: any;
  annotation?: any;
}

export function FlashingCanvas({ workspaceSlug }: { workspaceSlug: string }) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fabricRef = useRef<Canvas | null>(null);
  
  const [drawMode, setDrawMode] = useState<DrawMode>('none');
  const [linePoints, setLinePoints] = useState<{ x: number; y: number }[]>([]);
  const [annotatedPoints, setAnnotatedPoints] = useState<AnnotatedPoint[]>([]);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [interiorAngle, setInteriorAngle] = useState(true);
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  // Refs to avoid stale closure issues
  const drawModeRef = useRef<DrawMode>('none');
  const linePointsRef = useRef<{ x: number; y: number }[]>([]);
  const interiorAngleRef = useRef(true);

  // Update refs when state changes
  useEffect(() => {
    drawModeRef.current = drawMode;
    linePointsRef.current = linePoints;
    interiorAngleRef.current = interiorAngle;
  }, [drawMode, linePoints, interiorAngle]);

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

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current || fabricRef.current) return;

    const canvas = new Canvas(canvasRef.current, {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      backgroundColor: '#ffffff',
    });

    fabricRef.current = canvas;

    // Mouse move - track cursor for live measurements
    canvas.on('mouse:move', (opt) => {
      const pointer = canvas.getPointer(opt.e);
      setCursorPos({ x: pointer.x, y: pointer.y });
    });

    // Mouse down - handle clicks
    canvas.on('mouse:down', (opt) => {
      const pointer = canvas.getPointer(opt.e);

      console.log('[Canvas] Click at:', pointer, 'Mode:', drawModeRef.current);

      // Text mode - add text immediately
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

      // Edit mode - select point to edit annotation
      if (drawModeRef.current === 'edit') {
        // Find if user clicked near a point
        const currentPoints = linePointsRef.current;
        for (let i = 0; i < currentPoints.length; i++) {
          const pt = currentPoints[i];
          const dist = Math.sqrt(Math.pow(pointer.x - pt.x, 2) + Math.pow(pointer.y - pt.y, 2));
          if (dist < 10) {
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

        console.log('[Canvas] Line point added:', newPoint, 'Total points:', currentPoints.length + 1);

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
        });
        canvas.add(marker);

        if (currentPoints.length > 0) {
          // Draw line from previous point
          const prevPoint = currentPoints[currentPoints.length - 1];
          const line = new Line([prevPoint.x, prevPoint.y, newPoint.x, newPoint.y], {
            stroke: '#000000',
            strokeWidth: 2,
            selectable: false,
            evented: false,
          });
          canvas.add(line);
        }

        setLinePoints([...currentPoints, newPoint]);
        canvas.renderAll();
      }
    });

    return () => {
      canvas.dispose();
    };
  }, []);

  // Update cursor based on draw mode
  useEffect(() => {
    if (fabricRef.current) {
      const cursor = drawMode !== 'none' && drawMode !== 'edit' ? 'crosshair' : 'default';
      fabricRef.current.defaultCursor = cursor;
      fabricRef.current.hoverCursor = cursor;
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
    setAnnotatedPoints([]);
    setSelectedPoint(null);
  };

  const handleFinishLine = () => {
    setLinePoints([]);
    setDrawMode('none');
  };

  const handleAddRightAngle = () => {
    if (selectedPoint === null || selectedPoint >= linePoints.length) return;
    
    const pt = linePoints[selectedPoint];
    
    // Draw right angle symbol (small square)
    if (fabricRef.current) {
      const size = 10;
      const square = new Rect({
        left: pt.x - size / 2,
        top: pt.y - size / 2,
        width: size,
        height: size,
        fill: 'transparent',
        stroke: '#000',
        strokeWidth: 1,
        selectable: false,
        evented: false,
      });
      fabricRef.current.add(square);
      fabricRef.current.renderAll();
    }
    
    setSelectedPoint(null);
  };

  const handleAddCustomAngle = () => {
    if (selectedPoint === null || selectedPoint < 1 || selectedPoint >= linePoints.length) return;
    
    const pt = linePoints[selectedPoint];
    const prevPt = linePoints[selectedPoint - 1];
    const nextPt = linePoints[selectedPoint + 1] || cursorPos;
    
    if (!nextPt) return;
    
    const angle = Math.round(calculateAngle(prevPt, pt, nextPt, interiorAngle));
    
    // Draw arc symbol + angle text
    if (fabricRef.current) {
      // Simple arc representation (you can enhance this)
      const arcRadius = 20;
      const arc = new Circle({
        left: pt.x,
        top: pt.y,
        radius: arcRadius,
        fill: 'transparent',
        stroke: '#FF6B35',
        strokeWidth: 1,
        originX: 'center',
        originY: 'center',
        selectable: false,
        evented: false,
      });
      
      const text = new IText(`${angle}°`, {
        left: pt.x + arcRadius + 5,
        top: pt.y - 10,
        fontSize: 14,
        fill: '#000',
        fontFamily: 'Arial',
        editable: true,
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

      // Export canvas as PNG
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

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Draw Flashing</h1>
        <p className="text-sm text-slate-500 mt-1">
          Draw to scale: 1 pixel = 1mm (max 800mm x 600mm)
        </p>
      </div>

      {/* Input fields */}
      <div className="mb-4 space-y-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Custom Ridge Cap"
            className="w-full max-w-md px-3 py-2 border border-slate-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
            className="w-full max-w-md px-3 py-2 border border-slate-300 rounded-lg"
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
          {interiorAngle ? '📐 Interior' : '📐 Exterior'}
        </button>
        
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
      {measurements && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg inline-block">
          <div className="flex gap-6 text-sm font-mono">
            <div>
              <span className="text-blue-600 font-semibold">Length:</span>{' '}
              <span className="text-blue-900 font-bold">{measurements.length}mm</span>
            </div>
            {measurements.angle !== null && (
              <div>
                <span className="text-blue-600 font-semibold">Angle:</span>{' '}
                <span className="text-blue-900 font-bold">{measurements.angle}°</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Canvas */}
      <div className="border-2 border-slate-300 rounded-xl overflow-hidden inline-block shadow-lg">
        <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />
      </div>

      {/* Instructions */}
      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg max-w-3xl">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">✨ How to Use:</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>
            <strong>📏 Line Tool:</strong> Click points to draw. Watch live length/angle measurements above canvas.
          </li>
          <li>
            <strong>✏️ Edit Tool:</strong> Click a point (orange dot), then choose Right Angle or Custom Angle.
          </li>
          <li>
            <strong>📐 Interior/Exterior:</strong> Toggle to change which side of angle is measured.
          </li>
          <li>
            <strong>📝 Text Tool:</strong> Add labels, measurements, or notes anywhere.
          </li>
          <li>
            <strong>Scale:</strong> 1 pixel = 1mm (draw actual dimensions!)
          </li>
        </ul>
      </div>
    </div>
  );
}
