'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Canvas, Line, Circle, IText } from 'fabric';
import { createFlashingFromCanvas } from '../actions';

type DrawMode = 'none' | 'line' | 'text';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

export function FlashingCanvas({ workspaceSlug }: { workspaceSlug: string }) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fabricRef = useRef<Canvas | null>(null);
  
  const [drawMode, setDrawMode] = useState<DrawMode>('none');
  const [linePoints, setLinePoints] = useState<{ x: number; y: number }[]>([]);
  const [tempLine, setTempLine] = useState<any>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  // Refs to avoid stale closure issues
  const drawModeRef = useRef<DrawMode>('none');
  const linePointsRef = useRef<{ x: number; y: number }[]>([]);

  // Update refs when state changes
  useEffect(() => {
    drawModeRef.current = drawMode;
    linePointsRef.current = linePoints;
  }, [drawMode, linePoints]);

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current || fabricRef.current) return;

    const canvas = new Canvas(canvasRef.current, {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      backgroundColor: '#ffffff',
    });

    fabricRef.current = canvas;

    // Mouse down - handle clicks
    canvas.on('mouse:down', (opt) => {
      const pointer = canvas.getPointer(opt.e);

      console.log('[Canvas] Click at:', pointer, 'Mode:', drawModeRef.current);

      // Text mode - add text immediately
      if (drawModeRef.current === 'text') {
        const text = new IText('Text', {
          left: pointer.x,
          top: pointer.y,
          fontSize: 20,
          fill: '#000000',
          fontFamily: 'Arial',
        });
        canvas.add(text);
        canvas.setActiveObject(text);
        canvas.renderAll();
        setDrawMode('none');
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
      const cursor = drawMode !== 'none' ? 'crosshair' : 'default';
      fabricRef.current.defaultCursor = cursor;
      fabricRef.current.hoverCursor = cursor;
    }
  }, [drawMode]);

  const handleClear = () => {
    if (fabricRef.current) {
      fabricRef.current.clear();
      fabricRef.current.backgroundColor = '#ffffff';
      fabricRef.current.renderAll();
    }
    setLinePoints([]);
    setTempLine(null);
  };

  const handleFinishLine = () => {
    setLinePoints([]);
    setTempLine(null);
    setDrawMode('none');
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

      // Convert data URL to Blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();

      // Export canvas JSON for re-editing
      const canvasJSON = JSON.stringify(canvas.toJSON());

      // Create FormData
      const formData = new FormData();
      formData.append('name', name);
      formData.append('description', description || '');
      formData.append('image', blob, 'flashing.png');
      formData.append('canvas_data', canvasJSON);

      // Save to database + storage
      await createFlashingFromCanvas(formData);

      // Navigate back to flashings list
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
          Use the tools below to draw a custom flashing design
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
      <div className="mb-4 flex gap-2 items-center">
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

      {/* Canvas */}
      <div className="border-2 border-slate-300 rounded-xl overflow-hidden inline-block shadow-lg">
        <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />
      </div>

      {/* Instructions */}
      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg max-w-3xl">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">✨ Drawing Tips:</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>
            <strong>📏 Line Tool:</strong> Click multiple points to draw connected lines. Click "Finish Line" when done.
          </li>
          <li>
            <strong>📝 Text Tool:</strong> Click anywhere to add text, then type and position as needed.
          </li>
          <li>
            <strong>✏️ Edit:</strong> Click on any object to select, move, resize, or delete it.
          </li>
          <li>
            <strong>🗑️ Clear:</strong> Remove everything and start fresh.
          </li>
        </ul>
      </div>
    </div>
  );
}
