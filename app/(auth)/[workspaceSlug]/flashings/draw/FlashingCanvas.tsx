'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Canvas, Line, Circle, IText, Rect, ActiveSelection } from 'fabric';
import { createFlashingFromCanvas } from '../actions';

type DrawMode = 'none' | 'line' | 'text' | 'edit';
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
  // For placement
  placementSide?: 'interior' | 'exterior';
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
  
  const [history, setHistory] = useState<CanvasState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
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

  // Save state to history
  const saveToHistory = useCallback(() => {
    if (!fabricRef.current) return;
    
    setHistory(prevHistory => {
      setHistoryIndex(prevIndex => {
        const newHistory = prevHistory.slice(0, prevIndex + 1);
        const state: CanvasState = {
          canvasJSON: JSON.stringify(fabricRef.current!.toJSON()),
          measurements: measurements.map(m => ({ ...m })),
        };
        newHistory.push(state);
        
        // Keep only last 10 states
        const trimmed = newHistory.length > 10 ? newHistory.slice(-10) : newHistory;
        return trimmed.length - 1;
      });
      
      const newHistory = prevHistory.slice(0, historyIndex + 1);
      const state: CanvasState = {
        canvasJSON: JSON.stringify(fabricRef.current!.toJSON()),
        measurements: measurements.map(m => ({ ...m })),
      };
      newHistory.push(state);
      return newHistory.length > 10 ? newHistory.slice(-10) : newHistory;
    });
  }, [measurements, historyIndex]);

  // Undo
  const handleUndo = () => {
    if (historyIndex <= 0) return;
    
    const prevState = history[historyIndex - 1];
    restoreState(prevState);
    setHistoryIndex(historyIndex - 1);
  };

  // Redo
  const handleRedo = () => {
    if (historyIndex >= history.length - 1) return;
    
    const nextState = history[historyIndex + 1];
    restoreState(nextState);
    setHistoryIndex(historyIndex + 1);
  };

  // Restore state
  const restoreState = (state: CanvasState) => {
    if (!fabricRef.current) return;
    
    fabricRef.current.loadFromJSON(JSON.parse(state.canvasJSON), () => {
      fabricRef.current?.renderAll();
    });
    
    setMeasurements(state.measurements.map(m => ({ ...m })));
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          handleUndo();
        } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
          e.preventDefault();
          handleRedo();
        } else if (e.key === 'a') {
          e.preventDefault();
          handleSelectAll();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, history]);

  // Select All - proper implementation
  const handleSelectAll = () => {
    if (!fabricRef.current) return;
    
    const canvas = fabricRef.current;
    const allObjects = canvas.getObjects();
    
    // Make all objects selectable
    allObjects.forEach((obj: any) => {
      obj.set({ selectable: true, evented: true });
    });
    
    // Create active selection
    if (allObjects.length > 0) {
      canvas.discardActiveObject();
      const selection = new ActiveSelection(allObjects as any, { canvas });
      canvas.setActiveObject(selection as any);
      canvas.requestRenderAll();
    }
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
        setTimeout(saveToHistory, 100);
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
          selectable: false,
          evented: false,
        });
        canvas.add(marker);

        if (currentPoints.length > 0) {
          const prevPoint = currentPoints[currentPoints.length - 1];
          
          const line = new Line([prevPoint.x, prevPoint.y, newPoint.x, newPoint.y], {
            stroke: '#000000',
            strokeWidth: 2,
            selectable: false,
            evented: false,
          });
          canvas.add(line);

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
          canvas.add(lengthLabel);

          // Add to measurements
          setMeasurements(prev => [...prev, {
            id: `length-${Date.now()}`,
            type: 'length',
            value: length,
            originalValue: length,
            visible: true,
            labelObjectId: (lengthLabel as any)._id,
            placementSide: 'exterior',
          }]);
        }

        setLinePoints([...currentPoints, newPoint]);
        canvas.renderAll();
        setTimeout(saveToHistory, 100);
      }
    });

    return () => {
      canvas.dispose();
    };
  }, [canvasSize, saveToHistory]);

  useEffect(() => {
    if (fabricRef.current) {
      const cursor = drawMode !== 'none' && drawMode !== 'edit' ? 'crosshair' : 'default';
      fabricRef.current.defaultCursor = cursor;
      fabricRef.current.hoverCursor = cursor;
    }
  }, [drawMode]);

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
    setHistory([]);
    setHistoryIndex(-1);
  };

  const handleFinishLine = () => {
    setLinePoints([]);
    setDrawMode('none');
  };

  const handleToggleMeasurementVisibility = (id: string) => {
    const measurement = measurements.find(m => m.id === id);
    if (!measurement || !fabricRef.current) return;

    const canvas = fabricRef.current;
    const obj = canvas.getObjects().find((o: any) => o._id === measurement.labelObjectId);
    if (obj) {
      obj.set('visible', !measurement.visible);
    }
    
    setMeasurements(measurements.map(m => 
      m.id === id ? { ...m, visible: !m.visible } : m
    ));
    
    canvas.renderAll();
    setTimeout(saveToHistory, 100);
  };

  const handleEditMeasurementValue = (id: string) => {
    const measurement = measurements.find(m => m.id === id);
    if (!measurement || !fabricRef.current) return;

    const newValue = prompt(`Enter new ${measurement.type} value:`, measurement.value.toString());
    if (newValue === null) return;

    const numValue = parseFloat(newValue);
    if (isNaN(numValue)) return;

    const canvas = fabricRef.current;
    const obj = canvas.getObjects().find((o: any) => o._id === measurement.labelObjectId);
    if (obj && (obj as any).type === 'i-text') {
      (obj as any).set('text', measurement.type === 'length' ? `${numValue}mm` : `${numValue}°`);
    }

    setMeasurements(measurements.map(m =>
      m.id === id ? { ...m, value: numValue } : m
    ));

    canvas.renderAll();
    setTimeout(saveToHistory, 100);
  };

  const handleResetMeasurement = (id: string) => {
    const measurement = measurements.find(m => m.id === id);
    if (!measurement || !fabricRef.current) return;

    const canvas = fabricRef.current;
    const obj = canvas.getObjects().find((o: any) => o._id === measurement.labelObjectId);
    if (obj && (obj as any).type === 'i-text') {
      (obj as any).set('text', measurement.type === 'length' ? `${measurement.originalValue}mm` : `${measurement.originalValue}°`);
    }

    setMeasurements(measurements.map(m =>
      m.id === id ? { ...m, value: m.originalValue } : m
    ));

    canvas.renderAll();
    setTimeout(saveToHistory, 100);
  };

  const handleToggleAngleType = (id: string) => {
    const measurement = measurements.find(m => m.id === id);
    if (!measurement || measurement.type !== 'angle' || !fabricRef.current) return;

    const newShowInterior = !measurement.showInterior;
    const newValue = newShowInterior ? measurement.interiorValue! : measurement.exteriorValue!;

    const canvas = fabricRef.current;
    const obj = canvas.getObjects().find((o: any) => o._id === measurement.labelObjectId);
    if (obj && (obj as any).type === 'i-text') {
      (obj as any).set('text', `${newValue}°`);
    }

    setMeasurements(measurements.map(m =>
      m.id === id ? { ...m, showInterior: newShowInterior, value: newValue } : m
    ));

    canvas.renderAll();
    setTimeout(saveToHistory, 100);
  };

  const handleTogglePlacementSide = (id: string) => {
    const measurement = measurements.find(m => m.id === id);
    if (!measurement || !fabricRef.current) return;

    const newSide = measurement.placementSide === 'exterior' ? 'interior' : 'exterior';

    setMeasurements(measurements.map(m =>
      m.id === id ? { ...m, placementSide: newSide } : m
    ));

    // Note: Actual repositioning would require recalculating label position
    // For now just toggle the state - full implementation would move the label
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
      setTimeout(saveToHistory, 100);
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
      setTimeout(saveToHistory, 100);
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
    <div className="max-w-full mx-auto p-6">
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
            drawMode === 'line' ? 'bg-[#FF6B35] text-white shadow-lg' : 'bg-white border border-slate-300 hover:bg-slate-50'
          }`}
        >
          📏 Line
        </button>
        <button
          onClick={() => setDrawMode('text')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
            drawMode === 'text' ? 'bg-[#FF6B35] text-white shadow-lg' : 'bg-white border border-slate-300 hover:bg-slate-50'
          }`}
        >
          📝 Text
        </button>
        <button
          onClick={() => setDrawMode('edit')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
            drawMode === 'edit' ? 'bg-[#FF6B35] text-white shadow-lg' : 'bg-white border border-slate-300 hover:bg-slate-50'
          }`}
        >
          ✏️ Edit
        </button>
        
        <div className="h-8 w-px bg-slate-300" />
        
        <button
          onClick={handleUndo}
          disabled={historyIndex <= 0}
          title="Undo (Ctrl+Z)"
          className="px-3 py-2 text-lg rounded-lg bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-30"
        >
          ⏪
        </button>
        <button
          onClick={handleRedo}
          disabled={historyIndex >= history.length - 1}
          title="Redo (Ctrl+Y)"
          className="px-3 py-2 text-lg rounded-lg bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-30"
        >
          ⏩
        </button>
        <button
          onClick={handleSelectAll}
          title="Select All (Ctrl+A)"
          className="px-4 py-2 text-sm font-medium rounded-lg bg-white border border-slate-300 hover:bg-slate-50"
        >
          🎯 Select All
        </button>
        
        {selectedPoint !== null && (
          <>
            <div className="h-8 w-px bg-slate-300" />
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
              {measurements_live?.length || '—'}mm
            </span>
          </div>
          <div>
            <span className="text-blue-700 font-semibold">Angle:</span>{' '}
            <span className="text-blue-900 font-bold text-2xl">
              {measurements_live?.angle !== null && measurements_live?.angle !== undefined ? `${measurements_live.angle}°` : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Layout: Sidebar + Canvas */}
      <div className="flex gap-4">
        {/* Left Sidebar - Measurements List */}
        <div className="w-72 border-2 border-slate-300 rounded-xl p-4 bg-white max-h-[700px] overflow-y-auto">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Measurements</h3>
          {measurements.length === 0 ? (
            <p className="text-xs text-slate-400">No measurements yet</p>
          ) : (
            <div className="space-y-3">
              {measurements.map((m) => (
                <div key={m.id} className="p-3 border rounded-lg border-slate-200 bg-slate-50">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-medium text-slate-600">
                      {m.type === 'length' ? '📏 Length' : '📐 Angle'}
                    </span>
                    <button
                      onClick={() => handleToggleMeasurementVisibility(m.id)}
                      className="text-sm"
                      title={m.visible ? 'Hide' : 'Show'}
                    >
                      {m.visible ? '👁️' : '🚫'}
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
                      <button
                        onClick={() => handleToggleAngleType(m.id)}
                        className="w-full text-xs px-2 py-1.5 bg-blue-100 hover:bg-blue-200 rounded text-left"
                        title="Toggle Interior/Exterior"
                      >
                        ↔️ Toggle Angle Type
                      </button>
                    )}
                    {m.type === 'length' && (
                      <button
                        onClick={() => handleTogglePlacementSide(m.id)}
                        className="w-full text-xs px-2 py-1.5 bg-purple-100 hover:bg-purple-200 rounded text-left"
                        title="Toggle placement side"
                      >
                        {m.placementSide === 'exterior' ? '↗️' : '↙️'} {m.placementSide === 'exterior' ? 'Exterior' : 'Interior'} Side
                      </button>
                    )}
                    <button
                      onClick={() => handleEditMeasurementValue(m.id)}
                      className="w-full text-xs px-2 py-1.5 bg-slate-100 hover:bg-slate-200 rounded text-left"
                      title="Edit Value"
                    >
                      ✏️ Edit Value
                    </button>
                    <button
                      onClick={() => handleResetMeasurement(m.id)}
                      className="w-full text-xs px-2 py-1.5 bg-slate-100 hover:bg-slate-200 rounded text-left"
                      title="Reset to Original"
                    >
                      🔄 Reset
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Canvas */}
        <div className="border-2 border-slate-300 rounded-xl overflow-hidden shadow-lg">
          <canvas ref={canvasRef} width={currentSize.width} height={currentSize.height} />
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">✨ How to Use:</h3>
        <ul className="text-sm text-blue-800 space-y-1 grid grid-cols-2 gap-x-6">
          <li><strong>📏 Line Tool:</strong> Click points to draw. Watch live measurements above.</li>
          <li><strong>✏️ Edit Tool:</strong> Click orange point → add angle annotation.</li>
          <li><strong>⏪ ⏩ Undo/Redo:</strong> Ctrl+Z / Ctrl+Y (10 steps history)</li>
          <li><strong>🎯 Select All:</strong> Ctrl+A to select and move entire drawing.</li>
          <li><strong>📋 Sidebar:</strong> Manage all measurements - hide, edit, toggle types.</li>
          <li><strong>↔️ Angle Toggle:</strong> Switch between interior/exterior angles.</li>
          <li><strong>↗️ Length Placement:</strong> Toggle which side of line the label appears.</li>
        </ul>
      </div>
    </div>
  );
}
