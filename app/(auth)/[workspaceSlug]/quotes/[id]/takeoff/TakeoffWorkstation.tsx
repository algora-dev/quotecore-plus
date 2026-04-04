'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Canvas, FabricImage, Line } from 'fabric';
import type { QuoteRow } from '@/app/lib/types';

interface Props {
  workspaceSlug: string;
  quote: QuoteRow;
  planUrl: string;
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

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

export function TakeoffWorkstation({ workspaceSlug, quote, planUrl }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const [zoom, setZoom] = useState(1);
  
  // Calibration state
  const [calibrationMode, setCalibrationMode] = useState(false);
  const [calibrationPoints, setCalibrationPoints] = useState<CalibrationPoint[]>([]);
  const [calibrations, setCalibrations] = useState<Calibration[]>([]);
  const [activeCalibrationId, setActiveCalibrationId] = useState<string | null>(null);
  const [showCalibrationModal, setShowCalibrationModal] = useState(false);
  const [tempCalibrationLine, setTempCalibrationLine] = useState<any>(null);
  const [calibrationConfirmed, setCalibrationConfirmed] = useState(false);
  
  // Refs to access current state in event handlers
  const calibrationModeRef = useRef(calibrationMode);
  const calibrationPointsRef = useRef(calibrationPoints);
  
  useEffect(() => {
    calibrationModeRef.current = calibrationMode;
    calibrationPointsRef.current = calibrationPoints;
  }, [calibrationMode, calibrationPoints]);

  // Initialize Fabric canvas
  useEffect(() => {
    if (!canvasRef.current) return;

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
        selectable: false,
        evented: false,
      });

      canvas.add(fabricImg);
      canvas.sendObjectToBack(fabricImg);
      canvas.renderAll();
    };
    imgElement.src = planUrl;

    // Pan on drag OR calibration click
    canvas.on('mouse:down', (opt) => {
      const evt = opt.e;
      
      // Calibration mode: capture points
      if (calibrationModeRef.current && !evt.altKey) {
        const pointer = canvas.getPointer(opt.e);
        const newPoint = { x: pointer.x, y: pointer.y };
        
        if (calibrationPointsRef.current.length === 0) {
          // First point
          console.log('[Calibration] First point:', newPoint);
          setCalibrationPoints([newPoint]);
        } else if (calibrationPointsRef.current.length === 1) {
          // Second point - draw line and show modal
          const point1 = calibrationPointsRef.current[0];
          const point2 = newPoint;
          console.log('[Calibration] Second point:', newPoint);
          
          // Draw calibration line
          const line = new Line([point1.x, point1.y, point2.x, point2.y], {
            stroke: '#facc15', // yellow-400
            strokeWidth: 3,
            selectable: false,
            evented: false,
          });
          canvas.add(line);
          setTempCalibrationLine(line);
          
          // Calculate pixel distance
          const dx = point2.x - point1.x;
          const dy = point2.y - point1.y;
          const pixelDistance = Math.sqrt(dx * dx + dy * dy);
          
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
        canvas.lastPosX = evt.clientX;
        canvas.lastPosY = evt.clientY;
      }
    });

    canvas.on('mouse:move', (opt) => {
      if (canvas.isDragging) {
        const e = opt.e;
        const vpt = canvas.viewportTransform!;
        vpt[4] += e.clientX - canvas.lastPosX;
        vpt[5] += e.clientY - canvas.lastPosY;
        canvas.requestRenderAll();
        canvas.lastPosX = e.clientX;
        canvas.lastPosY = e.clientY;
      }
    });

    canvas.on('mouse:up', () => {
      canvas.setViewportTransform(canvas.viewportTransform!);
      canvas.isDragging = false;
      canvas.selection = true;
    });

    return () => {
      canvas.dispose();
    };
  }, [planUrl]);

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
    setCalibrationConfirmed(true);
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
    const avgScale = updatedCalibrations.reduce((sum, cal) => sum + cal.scale, 0) / updatedCalibrations.length;
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
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/${workspaceSlug}/quotes/${quote.id}`}
            className="text-blue-400 hover:text-blue-300"
          >
            ← Back
          </Link>
          <h1 className="text-xl font-semibold">{quote.customer_name} - Digital Takeoff</h1>
        </div>
        <button
          disabled={calibrations.length === 0}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          title={calibrations.length === 0 ? 'Calibrate the plan first' : ''}
        >
          Save & Continue to Components
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Calibration, Roof Areas & Components */}
        <div className="w-80 bg-slate-800 border-r border-slate-700 p-4 overflow-y-auto space-y-6">
          {/* Calibration Section */}
          <div>
            <h2 className="text-sm font-semibold mb-3 text-slate-400">Calibration</h2>
            {calibrations.length === 0 ? (
              <div className="text-sm text-yellow-400 font-medium">
                ⚠️ Calibrate first to continue
              </div>
            ) : calibrationConfirmed ? (
              /* Confirmed - Show only scale (minimal) */
              <div className="space-y-2">
                <div className="p-3 rounded bg-green-600/20 border border-green-600">
                  <div className="text-green-400 font-bold mb-2">✓ Confirmed</div>
                  <div className="text-xs text-slate-400 mb-1">Scale</div>
                  <div className="font-bold text-green-400">
                    {(calibrations.reduce((sum, cal) => sum + cal.scale, 0) / calibrations.length).toFixed(4)} {calibrations[0].unit}/px
                  </div>
                </div>
              </div>
            ) : (
              /* Not confirmed - Show details + Confirm button */
              <div className="space-y-2">
                {/* Average Scale Display */}
                <div className="p-3 rounded bg-yellow-600/20 border border-yellow-600">
                  <div className="text-xs text-slate-400 mb-1">Average Scale</div>
                  <div className="font-bold text-yellow-400">
                    {(calibrations.reduce((sum, cal) => sum + cal.scale, 0) / calibrations.length).toFixed(4)} {calibrations[0].unit}/px
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Based on {calibrations.length} measurement{calibrations.length > 1 ? 's' : ''}
                  </div>
                </div>
                
                {/* Individual Calibrations */}
                {calibrations.map((cal, idx) => (
                  <div
                    key={cal.id}
                    className="p-2 rounded text-sm bg-slate-700"
                  >
                    <div className="font-medium">
                      #{idx + 1}: {cal.actualDistance} {cal.unit}
                    </div>
                    <div className="text-xs text-slate-400">
                      {cal.scale.toFixed(4)} {cal.unit}/px
                    </div>
                  </div>
                ))}
                
                {/* Confirm Button */}
                <button
                  onClick={handleConfirmCalibration}
                  className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 rounded text-sm font-medium"
                >
                  ✓ Confirm Calibration
                </button>
              </div>
            )}
          </div>

          <div className="border-t border-slate-700 pt-4">
            <h2 className="text-sm font-semibold mb-3 text-slate-400">Roof Areas</h2>
            <div className="text-sm text-slate-500">
              No areas defined yet
            </div>
          </div>

          <div className="border-t border-slate-700 pt-4">
            <h2 className="text-sm font-semibold mb-3 text-slate-400">Components</h2>
            <div className="text-sm text-slate-500">
              No components assigned yet
            </div>
          </div>
        </div>

        {/* Center - Canvas */}
        <div className="flex-1 flex flex-col p-6 relative">
          {/* Top Toolbar */}
          <div className="mb-4 flex items-center justify-between bg-slate-800 rounded-lg p-3 shadow-lg">
            {/* Tools - Left Side */}
            <div className="flex gap-2">
              <button
                onClick={handleStartCalibration}
                className={`px-3 py-2 rounded text-sm flex items-center gap-2 ${
                  calibrationMode
                    ? 'bg-yellow-600 hover:bg-yellow-700'
                    : calibrationConfirmed
                    ? 'bg-slate-600 hover:bg-slate-500'
                    : 'bg-slate-700 hover:bg-slate-600'
                }`}
              >
                📐 {calibrationConfirmed ? 'Recalibrate' : 'Calibrate'}
              </button>
              <button
                disabled={calibrationMode || calibrations.length === 0}
                className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                title={calibrations.length === 0 ? 'Calibrate first' : ''}
              >
                📏 Line
              </button>
              <button
                disabled={calibrationMode || calibrations.length === 0}
                className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                title={calibrations.length === 0 ? 'Calibrate first' : ''}
              >
                📐 Area
              </button>
              <button
                disabled={calibrationMode || calibrations.length === 0}
                className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                title={calibrations.length === 0 ? 'Calibrate first' : ''}
              >
                📍 Point
              </button>
            </div>

            {/* Zoom Controls - Right Side */}
            <div className="flex gap-2">
              <button
                onClick={handleZoomOut}
                className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm"
              >
                −
              </button>
              <span className="px-3 py-1 text-sm">{Math.round(zoom * 100)}%</span>
              <button
                onClick={handleZoomIn}
                className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm"
              >
                +
              </button>
              <button
                onClick={handleResetZoom}
                className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm"
              >
                Reset
              </button>
              <button
                onClick={handleFitToScreen}
                className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm"
              >
                Fit
              </button>
            </div>
          </div>

          {/* Canvas */}
          <div className="flex-1 flex items-center justify-center">
            <div 
              className="border-2 border-slate-700 rounded"
              style={{ cursor: calibrationMode ? 'crosshair' : 'default' }}
            >
              <canvas ref={canvasRef} />
            </div>
          </div>
          <p className="mt-4 text-center text-sm text-slate-500">
            {calibrationMode
              ? `Click ${calibrationPoints.length === 0 ? 'first' : 'second'} point to calibrate`
              : 'Hold Alt + Drag to pan'}
          </p>
        </div>
      </div>

      {/* Calibration Modal */}
      {showCalibrationModal && (
        <CalibrationModal
          calibrationNumber={calibrations.length + 1}
          onSave={handleSaveCalibration}
          onCancel={handleCancelCalibration}
        />
      )}
    </div>
  );
}

// Calibration Modal Component
function CalibrationModal({
  calibrationNumber,
  onSave,
  onCancel,
}: {
  calibrationNumber: number;
  onSave: (distance: number, unit: 'feet' | 'meters', addAnother: boolean) => void;
  onCancel: () => void;
}) {
  const [distance, setDistance] = useState('');
  const [unit, setUnit] = useState<'feet' | 'meters'>('feet');

  const handleSubmit = (addAnother: boolean) => {
    const num = parseFloat(distance);
    if (!isNaN(num) && num > 0) {
      onSave(num, unit, addAnother);
    }
  };

  const canAddAnother = calibrationNumber < 3;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg p-6 w-96 border border-slate-700">
        <h2 className="text-xl font-semibold mb-2">
          Calibration {calibrationNumber} of 3
        </h2>
        <p className="text-sm text-slate-400 mb-4">
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
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded"
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
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded"
            >
              <option value="feet">Feet</option>
              <option value="meters">Meters</option>
            </select>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded"
            >
              Cancel
            </button>
            {canAddAnother && calibrationNumber > 1 && (
              <button
                type="button"
                onClick={() => handleSubmit(false)}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded"
              >
                Skip
              </button>
            )}
            <button
              type="button"
              onClick={() => handleSubmit(canAddAnother)}
              className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded"
              disabled={!distance || parseFloat(distance) <= 0}
            >
              {canAddAnother && calibrationNumber < 3 ? 'Save & Add Another' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
