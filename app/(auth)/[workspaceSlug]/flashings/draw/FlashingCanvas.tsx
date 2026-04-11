'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Canvas, Line, Circle, Rect, IText } from 'fabric';
import { createFlashingFromCanvas } from '../actions';

type DrawMode = 'none' | 'line' | 'rect' | 'circle' | 'text';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

export function FlashingCanvas({ workspaceSlug }: { workspaceSlug: string }) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const [drawMode, setDrawMode] = useState<DrawMode>('none');
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [tempObject, setTempObject] = useState<any>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current || fabricRef.current) return;

    const canvas = new Canvas(canvasRef.current, {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      backgroundColor: '#ffffff',
    });

    fabricRef.current = canvas;

    // Mouse down - start drawing
    canvas.on('mouse:down', (opt) => {
      if (drawMode === 'none') return;
      
      const pointer = canvas.getPointer(opt.e);
      setIsDrawing(true);
      setStartPoint({ x: pointer.x, y: pointer.y });

      // For text, add immediately
      if (drawMode === 'text') {
        const text = new IText('Text', {
          left: pointer.x,
          top: pointer.y,
          fontSize: 20,
          fill: '#000',
        });
        canvas.add(text);
        canvas.setActiveObject(text);
        canvas.renderAll();
        setDrawMode('none');
        setIsDrawing(false);
        setStartPoint(null);
      }
    });

    // Mouse move - update temp shape
    canvas.on('mouse:move', (opt) => {
      if (!isDrawing || !startPoint || drawMode === 'text') return;

      const pointer = canvas.getPointer(opt.e);

      // Remove previous temp object
      if (tempObject) {
        canvas.remove(tempObject);
      }

      let newObject: any = null;

      switch (drawMode) {
        case 'line':
          newObject = new Line([startPoint.x, startPoint.y, pointer.x, pointer.y], {
            stroke: '#000',
            strokeWidth: 2,
          });
          break;
        case 'rect':
          newObject = new Rect({
            left: Math.min(startPoint.x, pointer.x),
            top: Math.min(startPoint.y, pointer.y),
            width: Math.abs(pointer.x - startPoint.x),
            height: Math.abs(pointer.y - startPoint.y),
            fill: 'transparent',
            stroke: '#000',
            strokeWidth: 2,
          });
          break;
        case 'circle':
          const radius = Math.sqrt(
            Math.pow(pointer.x - startPoint.x, 2) + Math.pow(pointer.y - startPoint.y, 2)
          );
          newObject = new Circle({
            left: startPoint.x,
            top: startPoint.y,
            radius: radius,
            fill: 'transparent',
            stroke: '#000',
            strokeWidth: 2,
            originX: 'center',
            originY: 'center',
          });
          break;
      }

      if (newObject) {
        canvas.add(newObject);
        setTempObject(newObject);
        canvas.renderAll();
      }
    });

    // Mouse up - finalize shape
    canvas.on('mouse:up', () => {
      if (isDrawing && tempObject) {
        setTempObject(null);
      }
      setIsDrawing(false);
      setStartPoint(null);
      setDrawMode('none');
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
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setDrawMode('line')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
            drawMode === 'line'
              ? 'bg-[#FF6B35] text-white'
              : 'bg-white border border-slate-300 hover:bg-slate-50'
          }`}
        >
          Line
        </button>
        <button
          onClick={() => setDrawMode('rect')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
            drawMode === 'rect'
              ? 'bg-[#FF6B35] text-white'
              : 'bg-white border border-slate-300 hover:bg-slate-50'
          }`}
        >
          Rectangle
        </button>
        <button
          onClick={() => setDrawMode('circle')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
            drawMode === 'circle'
              ? 'bg-[#FF6B35] text-white'
              : 'bg-white border border-slate-300 hover:bg-slate-50'
          }`}
        >
          Circle
        </button>
        <button
          onClick={() => setDrawMode('text')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
            drawMode === 'text'
              ? 'bg-[#FF6B35] text-white'
              : 'bg-white border border-slate-300 hover:bg-slate-50'
          }`}
        >
          Text
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

      {/* Canvas */}
      <div className="border border-slate-300 rounded-xl overflow-hidden inline-block">
        <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />
      </div>

      {/* Instructions */}
      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">Drawing Tips:</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Select a tool from the toolbar above</li>
          <li>• Click and drag on the canvas to draw</li>
          <li>• Use Line for straight edges, Rectangle for boxes, Circle for rounded shapes</li>
          <li>• Add Text for labels or measurements</li>
          <li>• Click objects to select and move them</li>
          <li>• Use Clear to start over</li>
        </ul>
      </div>
    </div>
  );
}
