'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Canvas, Line, Circle, IText, Rect, Group } from 'fabric';
import { createFlashingFromCanvas } from '../actions';

type DrawMode = 'none' | 'line' | 'text' | 'edit';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const SCALE = 0.5; // 2 pixels = 1mm (doubled visual size)

export function FlashingCanvas({ workspaceSlug }: { workspaceSlug: string }) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fabricRef = useRef<Canvas | null>(null);
  
  const [drawMode, setDrawMode] = useState<DrawMode>('none');
  const [linePoints, setLinePoints] = useState<{ x: number; y: number }[]>([]);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [interiorAngle, setInteriorAngle] = useState(true);
  const [exteriorLength, setExteriorLength] = useState(true);
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

  // Calculate angle bisector direction for text placement
  const getAngleBisector = (
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    p3: { x: number; y: number }
  ): { x: number; y: number } => {
    // Normalize vectors
    const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
    const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
    const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
    
    const norm1 = { x: v1.x / len1, y: v1.y / len1 };
    const norm2 = { x: v2.x / len2, y: v2.y / len2 };
    
    // Bisector is the average of normalized vectors
    const bisector = {
      x: (norm1.x + norm2.x) / 2,
      y: (norm1.y + norm2.y) / 2
    };
    
    return bisector;
  };

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current || fabricRef.current) return;

    const canvas = new Canvas(canvasRef.current, {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      backgroundColor: '#ffffff',
      selection: false, // Disable group selection to prevent accidental moves
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
        });
        canvas.add(marker);

        if (currentPoints.length > 0) {
          const prevPoint = currentPoints[currentPoints.length - 1];
          
          // Draw line
          const line = new Line([prevPoint.x, prevPoint.y, newPoint.x, newPoint.y], {
            stroke: '#000000',
            strokeWidth: 2,
            selectable: false,
            evented: false,
          });
          canvas.add(line);

          // Add length label on the line
          const length = Math.round(calculateDistance(prevPoint, newPoint));
          const midX = (prevPoint.x + newPoint.x) / 2;
          const midY = (prevPoint.y + newPoint.y) / 2;
          
          // Calculate perpendicular offset for label (exterior/interior)
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
          });
          canvas.add(lengthLabel);
        }

        setLinePoints([...currentPoints, newPoint]);
        canvas.renderAll();
      }
    });

    return () => {
      canvas.dispose();
    };
  }, [exteriorLength]);

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
    setSelectedPoint(null);
  };

  const handleFinishLine = () => {
    setLinePoints([]);
    setDrawMode('none');
  };

  const handleAddRightAngle = () => {
    if (selectedPoint === null || selectedPoint >= linePoints.length) return;
    if (selectedPoint === 0 && linePoints.length < 2) return;
    if (selectedPoint === linePoints.length - 1 && linePoints.length < 2) return;
    
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
    const nextPt = linePoints[selectedPoint + 1];
    
    if (!nextPt) return;
    
    const angle = Math.round(calculateAngle(prevPt, pt, nextPt, interiorAngle));
    
    // Calculate bisector for text placement
    const bisector = getAngleBisector(prevPt, pt, nextPt);
    
    // Draw arc symbol + angle text on bisector
    if (fabricRef.current) {
      const arcRadius = 25;
      
      // Simplified arc (quarter circle)
      const arc = new Circle({
        left: pt.x,
        top: pt.y,
        radius: arcRadius,
        fill: 'transparent',
        stroke: '#FF6B35',
        strokeWidth: 1.5,
        originX: 'center',
        originY: 'center',
        selectable: false,
        evented: false,
        startAngle: 0,
        endAngle: Math.PI / 2,
      });
      
      // Position text on bisector, interior side
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

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Draw Flashing</h1>
        <p className="text-sm text-slate-500 mt-1">
          Draw to scale: 2 pixels = 1mm (max 400mm x 300mm)
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
          Angle: {interiorAngle ? '📐 Interior' : '📐 Exterior'}
        </button>

        <button
          onClick={() => setExteriorLength(!exteriorLength)}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-white border border-slate-300 hover:bg-slate-50"
        >
          Length: {exteriorLength ? '↗️ Exterior' : '↙️ Interior'}
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

      {/* Live Measurements - Always visible, fixed position */}
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
        <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />
      </div>

      {/* Instructions */}
      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg max-w-3xl">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">✨ How to Use:</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>
            <strong>📏 Line Tool:</strong> Click points to draw. Watch live length/angle above canvas (2x bigger now!).
          </li>
          <li>
            <strong>✏️ Edit Tool:</strong> Click an orange point, then choose Right Angle or Custom Angle.
          </li>
          <li>
            <strong>Angle placement:</strong> Custom angles now appear on the angle bisector (middle of the angle).
          </li>
          <li>
            <strong>Length labels:</strong> Automatically added to each line segment.
          </li>
          <li>
            <strong>Toggle sides:</strong> Switch interior/exterior for angles and lengths independently.
          </li>
          <li>
            <strong>Scale:</strong> 2 pixels = 1mm (drawings appear 2x larger now!)
          </li>
        </ul>
      </div>
    </div>
  );
}
