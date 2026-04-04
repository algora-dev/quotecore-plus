'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Canvas, FabricImage, Line, Circle, Polygon } from 'fabric';
import type { QuoteRow } from '@/app/lib/types';

interface Component {
  id: string;
  name: string;
}

interface ComponentColor {
  componentId: string;
  color: string;
}

interface RoofArea {
  id: string;
  name: string;
  points: { x: number; y: number }[];
  area: number; // in square feet or meters
  visible: boolean;
  polygon?: any; // fabric.js polygon object
  markers?: any[]; // fabric.js marker objects
}

interface ComponentMeasurement {
  id: string;
  type: 'line' | 'area' | 'point';
  value: number; // length (ft/m) or area (sq ft/m)
  points?: { x: number; y: number }[];
  visible: boolean;
  canvasObjects?: any[]; // fabric.js objects
}

interface ComponentWithMeasurements {
  componentId: string;
  measurements: ComponentMeasurement[];
  expanded: boolean;
}

interface Props {
  workspaceSlug: string;
  quote: QuoteRow;
  planUrl: string;
  components: Component[];
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

// Color palette for components (10 distinct colors)
const COLOR_PALETTE = [
  '#ef4444', // red-500
  '#3b82f6', // blue-500
  '#10b981', // green-500
  '#f59e0b', // amber-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#14b8a6', // teal-500
  '#f97316', // orange-500
  '#06b6d4', // cyan-500
  '#84cc16', // lime-500
];

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

export function TakeoffWorkstation({ workspaceSlug, quote, planUrl, components }: Props) {
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
  const [showConfirmedFlash, setShowConfirmedFlash] = useState(false);
  const [showCalibrationHelp, setShowCalibrationHelp] = useState(true);
  
  // Component colors (auto-assign on mount)
  const [componentColors, setComponentColors] = useState<ComponentColor[]>([]);
  const [activeComponentIds, setActiveComponentIds] = useState<string[]>([]);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  
  // Roof Areas
  const [roofAreas, setRoofAreas] = useState<RoofArea[]>([]);
  const [areaMode, setAreaMode] = useState(false);
  const [areaPoints, setAreaPoints] = useState<{ x: number; y: number }[]>([]);
  const [tempAreaPolygon, setTempAreaPolygon] = useState<any>(null);
  const [showAreaNamePrompt, setShowAreaNamePrompt] = useState(false);
  const [pendingAreaPoints, setPendingAreaPoints] = useState<{ x: number; y: number }[]>([]);
  
  // Component measurements
  const [componentMeasurements, setComponentMeasurements] = useState<ComponentWithMeasurements[]>([]);
  const [lineMode, setLineMode] = useState(false);
  const [linePoints, setLinePoints] = useState<{ x: number; y: number }[]>([]);
  const [pointMode, setPointMode] = useState(false);
  const [showLineMeasurementPrompt, setShowLineMeasurementPrompt] = useState(false);
  const [pendingLineMeasurement, setPendingLineMeasurement] = useState<{ points: { x: number; y: number }[], length: number } | null>(null);
  const [showAreaMeasurementPrompt, setShowAreaMeasurementPrompt] = useState(false);
  const [pendingAreaMeasurement, setPendingAreaMeasurement] = useState<{ points: { x: number; y: number }[], area: number } | null>(null);
  const [showPointMeasurementPrompt, setShowPointMeasurementPrompt] = useState(false);
  const [pendingPointLocation, setPendingPointLocation] = useState<{ x: number; y: number } | null>(null);
  
  // Component display state (may include test components)
  const [displayComponents, setDisplayComponents] = useState<Component[]>([]);
  
  // Auto-assign colors to components
  useEffect(() => {
    console.log('[Components] Raw prop received:', components);
    console.log('[Components] Count:', components.length);
    console.log('[Components] Calibration confirmed:', calibrationConfirmed);
    if (components.length > 0) {
      console.log('[Components] Sample component:', components[0]);
    }
    
    // Add test components if none exist (for debugging)
    let componentsToUse = [...components];
    if (components.length === 0) {
      console.log('[Components] No real components - adding TEST entries');
      componentsToUse = [
        { id: 'test-1', name: '[TEST] Clay Tiles' },
        { id: 'test-2', name: '[TEST] Ridge Capping' },
        { id: 'test-3', name: '[TEST] Guttering' },
      ];
    }
    
    setDisplayComponents(componentsToUse);
    
    const colors = componentsToUse.map((comp, idx) => ({
      componentId: comp.id,
      color: COLOR_PALETTE[idx % COLOR_PALETTE.length],
    }));
    setComponentColors(colors);
  }, [components, calibrationConfirmed]);
  
  const handleAddComponent = (componentId: string) => {
    if (!activeComponentIds.includes(componentId)) {
      setActiveComponentIds([...activeComponentIds, componentId]);
    }
  };
  
  const handleRemoveComponent = (componentId: string) => {
    setActiveComponentIds(activeComponentIds.filter(id => id !== componentId));
  };
  
  const handleDeleteArea = (areaId: string) => {
    const area = roofAreas.find(a => a.id === areaId);
    if (area && fabricRef.current) {
      if (area.polygon) fabricRef.current.remove(area.polygon);
      area.markers?.forEach(marker => fabricRef.current!.remove(marker));
    }
    setRoofAreas(roofAreas.filter(a => a.id !== areaId));
  };
  
  const handleToggleAreaVisibility = (areaId: string) => {
    setRoofAreas(roofAreas.map(area => {
      if (area.id === areaId) {
        const newVisible = !area.visible;
        if (area.polygon) {
          area.polygon.set('visible', newVisible);
        }
        area.markers?.forEach(marker => marker.set('visible', newVisible));
        fabricRef.current?.renderAll();
        return { ...area, visible: newVisible };
      }
      return area;
    }));
  };
  
  // Calculate area using Shoelace formula
  const calculatePolygonArea = (points: { x: number; y: number }[]) => {
    let sum = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      sum += points[i].x * points[j].y;
      sum -= points[j].x * points[i].y;
    }
    const pixelArea = Math.abs(sum / 2);
    
    // Convert to real-world units using calibration scale
    const avgScale = calibrations.reduce((s, cal) => s + cal.scale, 0) / calibrations.length;
    const realArea = pixelArea * avgScale * avgScale; // scale² for area
    
    return realArea;
  };
  
  const handleSaveArea = (name: string) => {
    if (pendingAreaPoints.length < 3) return;
    
    const area = calculatePolygonArea(pendingAreaPoints);
    
    // Draw polygon on canvas and collect current markers
    let polygon;
    const markers: any[] = [];
    if (fabricRef.current) {
      polygon = new Polygon(pendingAreaPoints, {
        fill: 'rgba(59, 130, 246, 0.2)', // blue with transparency
        stroke: '#3b82f6',
        strokeWidth: 2,
        selectable: false,
        evented: false,
      });
      fabricRef.current.add(polygon);
      
      // Find and store all blue/green markers for this polygon
      const objects = fabricRef.current.getObjects();
      objects.forEach(obj => {
        if (obj.get('type') === 'circle' && 
            (obj.fill === '#3b82f6' || obj.fill === '#10b981')) {
          markers.push(obj);
        }
      });
    }
    
    const newArea: RoofArea = {
      id: `area-${Date.now()}`,
      name,
      points: pendingAreaPoints,
      area,
      visible: true,
      polygon,
      markers,
    };
    
    setRoofAreas([...roofAreas, newArea]);
    setAreaPoints([]);
    setPendingAreaPoints([]);
    setShowAreaNamePrompt(false);
    setAreaMode(false);
  };
  
  // Refs to access current state in event handlers
  const calibrationModeRef = useRef(calibrationMode);
  const calibrationPointsRef = useRef(calibrationPoints);
  const areaModeRef = useRef(areaMode);
  const areaPointsRef = useRef(areaPoints);
  const lineModeRef = useRef(lineMode);
  const linePointsRef = useRef(linePoints);
  const pointModeRef = useRef(pointMode);
  
  useEffect(() => {
    calibrationModeRef.current = calibrationMode;
    calibrationPointsRef.current = calibrationPoints;
    areaModeRef.current = areaMode;
    areaPointsRef.current = areaPoints;
    lineModeRef.current = lineMode;
    linePointsRef.current = linePoints;
    pointModeRef.current = pointMode;
  }, [calibrationMode, calibrationPoints, areaMode, areaPoints, lineMode, linePoints, pointMode]);

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

    // Pan on drag OR calibration click OR area click OR line click
    canvas.on('mouse:down', (opt) => {
      const evt = opt.e;
      
      // Line mode: measure distance (2 points)
      if (lineModeRef.current && !evt.altKey) {
        const pointer = canvas.getPointer(opt.e);
        const newPoint = { x: pointer.x, y: pointer.y };
        const currentPoints = linePointsRef.current;
        
        if (currentPoints.length === 0) {
          // First point
          console.log('[Line] First point');
          setLinePoints([newPoint]);
          
          // Draw marker (green)
          const marker = new Circle({
            left: newPoint.x,
            top: newPoint.y,
            radius: 4,
            fill: '#10b981',
            stroke: '#000',
            strokeWidth: 2,
            originX: 'center',
            originY: 'center',
            selectable: false,
            evented: false,
          });
          canvas.add(marker);
        } else if (currentPoints.length === 1) {
          // Second point - draw line, calculate length, prompt
          console.log('[Line] Second point');
          const firstPoint = currentPoints[0];
          
          // Draw marker (blue)
          const marker = new Circle({
            left: newPoint.x,
            top: newPoint.y,
            radius: 4,
            fill: '#3b82f6',
            stroke: '#000',
            strokeWidth: 2,
            originX: 'center',
            originY: 'center',
            selectable: false,
            evented: false,
          });
          canvas.add(marker);
          
          // Draw line
          const line = new Line([firstPoint.x, firstPoint.y, newPoint.x, newPoint.y], {
            stroke: '#10b981',
            strokeWidth: 2,
            selectable: false,
            evented: false,
          });
          canvas.add(line);
          
          // Calculate pixel distance
          const pixelDistance = Math.sqrt(
            Math.pow(newPoint.x - firstPoint.x, 2) + 
            Math.pow(newPoint.y - firstPoint.y, 2)
          );
          
          // Convert to real-world using calibration scale
          const avgScale = calibrations.reduce((s, cal) => s + cal.scale, 0) / calibrations.length;
          const realDistance = pixelDistance * avgScale;
          
          // Show confirmation modal
          setPendingLineMeasurement({ 
            points: [firstPoint, newPoint], 
            length: realDistance 
          });
          setShowLineMeasurementPrompt(true);
          setLinePoints([firstPoint, newPoint]);
        }
        
        return;
      }
      
      // Area mode: add polygon points
      if (areaModeRef.current && !evt.altKey) {
        const pointer = canvas.getPointer(opt.e);
        const newPoint = { x: pointer.x, y: pointer.y };
        const currentPoints = areaPointsRef.current;
        
        // Check if click is near start point (close polygon)
        if (currentPoints.length >= 3) {
          const startPoint = currentPoints[0];
          const distance = Math.sqrt(
            Math.pow(newPoint.x - startPoint.x, 2) + 
            Math.pow(newPoint.y - startPoint.y, 2)
          );
          
          if (distance < 15) {
            // Close polygon - prompt for name
            console.log('[Area] Closing polygon with', currentPoints.length, 'points');
            setPendingAreaPoints(currentPoints);
            setShowAreaNamePrompt(true);
            return;
          }
        }
        
        // Add point
        console.log('[Area] Added point', currentPoints.length + 1);
        setAreaPoints([...currentPoints, newPoint]);
        
        // Draw marker (green for first point, blue for rest)
        const isFirstPoint = currentPoints.length === 0;
        const marker = new Circle({
          left: newPoint.x,
          top: newPoint.y,
          radius: 4,
          fill: isFirstPoint ? '#10b981' : '#3b82f6', // green first, blue rest
          stroke: '#000',
          strokeWidth: 2,
          originX: 'center',
          originY: 'center',
          selectable: false,
          evented: false,
        });
        canvas.add(marker);
        
        return;
      }
      
      // Calibration mode: capture points
      if (calibrationModeRef.current && !evt.altKey) {
        const pointer = canvas.getPointer(opt.e);
        const newPoint = { x: pointer.x, y: pointer.y };
        
        if (calibrationPointsRef.current.length === 0) {
          // First point - add visual marker
          console.log('[Calibration] First point:', newPoint);
          const marker = new Circle({
            left: newPoint.x,
            top: newPoint.y,
            radius: 5,
            fill: '#facc15',
            stroke: '#000',
            strokeWidth: 2,
            originX: 'center',
            originY: 'center',
            selectable: false,
            evented: false,
          });
          canvas.add(marker);
          setCalibrationPoints([newPoint]);
        } else if (calibrationPointsRef.current.length === 1) {
          // Second point - add marker, draw line, and show modal
          const point1 = calibrationPointsRef.current[0];
          const point2 = newPoint;
          console.log('[Calibration] Second point:', newPoint);
          
          // Add marker for second point
          const marker2 = new Circle({
            left: newPoint.x,
            top: newPoint.y,
            radius: 5,
            fill: '#facc15',
            stroke: '#000',
            strokeWidth: 2,
            originX: 'center',
            originY: 'center',
            selectable: false,
            evented: false,
          });
          canvas.add(marker2);
          
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

  // Update cursor when calibration/area/line mode changes
  useEffect(() => {
    if (fabricRef.current) {
      const cursor = (calibrationMode || areaMode || lineMode) ? 'crosshair' : 'default';
      fabricRef.current.defaultCursor = cursor;
      fabricRef.current.hoverCursor = cursor;
    }
  }, [calibrationMode, areaMode, lineMode]);
  
  // Update cursor when hovering near first point (to close loop)
  useEffect(() => {
    if (!fabricRef.current || !areaMode || areaPoints.length < 3) return;
    
    const canvas = fabricRef.current;
    const handleMouseMove = (opt: any) => {
      const pointer = canvas.getPointer(opt.e);
      const firstPoint = areaPoints[0];
      const distance = Math.sqrt(
        Math.pow(pointer.x - firstPoint.x, 2) + 
        Math.pow(pointer.y - firstPoint.y, 2)
      );
      
      // Change cursor when near first point (to close polygon)
      if (distance < 15) {
        canvas.defaultCursor = 'alias'; // connecting/link cursor
        canvas.hoverCursor = 'alias';
      } else {
        canvas.defaultCursor = 'crosshair';
        canvas.hoverCursor = 'crosshair';
      }
    };
    
    canvas.on('mouse:move', handleMouseMove);
    return () => {
      canvas.off('mouse:move', handleMouseMove);
    };
  }, [areaMode, areaPoints]);

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
    console.log('[Calibration] Confirming... current state:', { calibrationConfirmed, showConfirmedFlash });
    setCalibrationConfirmed(true);
    setShowConfirmedFlash(true);
    setCalibrationMode(false); // Turn off calibration mode!
    
    // Remove all calibration lines and markers from canvas
    if (fabricRef.current) {
      const objects = fabricRef.current.getObjects();
      const calibrationObjects = objects.filter(obj => 
        obj.stroke === '#facc15' || // Yellow lines
        (obj.fill === '#facc15' && obj.get('type') === 'circle') // Yellow markers
      );
      console.log('[Calibration] Removing', calibrationObjects.length, 'calibration objects');
      calibrationObjects.forEach(obj => fabricRef.current!.remove(obj));
      fabricRef.current.renderAll();
    }
    
    console.log('[Calibration] State updated to confirmed, lines removed');
    // Hide calibration section after 0.5s flash
    setTimeout(() => {
      console.log('[Calibration] Hiding flash, confirmed should stay true');
      setShowConfirmedFlash(false);
    }, 500);
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
          {/* Calibration Section - Show if: not confirmed, calibration mode, or showing flash */}
          {(!calibrationConfirmed || calibrationMode || showConfirmedFlash) && (
            <div>
              <h2 className="text-sm font-semibold mb-3 text-slate-400">Calibration</h2>
              {calibrations.length === 0 ? (
                <div className="text-sm text-yellow-400 font-medium">
                  ⚠️ Calibrate first to continue
                </div>
              ) : showConfirmedFlash ? (
                /* Flash green confirmation briefly */
                <div className="p-3 rounded bg-green-600/20 border border-green-600 animate-pulse">
                  <div className="text-green-400 font-bold mb-2">✓ Confirmed</div>
                  <div className="text-xs text-slate-400 mb-1">Scale</div>
                  <div className="font-bold text-green-400">
                    {(calibrations.reduce((sum, cal) => sum + cal.scale, 0) / calibrations.length).toFixed(4)} {calibrations[0].unit}/px
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
          )}

          <div className="border-t border-slate-700 pt-4">
            <h2 className="text-sm font-semibold mb-3 text-slate-400">Roof Areas</h2>
            {roofAreas.length === 0 ? (
              <div className="text-sm text-slate-500">
                {calibrationConfirmed ? 'Click "Area" to draw' : 'Calibrate first'}
              </div>
            ) : (
              <div className="space-y-2">
                {roofAreas.map((area) => {
                  const unit = calibrations[0]?.unit || 'feet';
                  return (
                    <div
                      key={area.id}
                      className="p-2 rounded bg-blue-600/20 border border-blue-600 flex items-center gap-2"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-sm">{area.name}</div>
                        <div className="text-xs text-slate-300">
                          {area.area.toFixed(2)} sq {unit}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleToggleAreaVisibility(area.id)}
                          className={`w-6 h-6 flex items-center justify-center rounded text-lg transition-colors ${
                            area.visible 
                              ? 'text-green-500 hover:bg-green-600/20' 
                              : 'text-green-500 hover:bg-green-600/20'
                          }`}
                          title={area.visible ? 'Hide area' : 'Show area'}
                        >
                          {area.visible ? '●' : '○'}
                        </button>
                        <button
                          onClick={() => handleDeleteArea(area.id)}
                          className="w-6 h-6 flex items-center justify-center text-red-400 hover:bg-red-600/20 rounded"
                          title="Delete area"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {calibrationConfirmed && (
            <div className="border-t border-slate-700 pt-4">
              <h2 className="text-sm font-semibold mb-3 text-slate-400">Components</h2>
              {displayComponents.length === 0 ? (
              <div className="text-sm text-slate-500">
                No components in library
              </div>
            ) : (
              <div className="space-y-4">
                {/* Active Components */}
                {activeComponentIds.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-slate-500 mb-2">Active ({activeComponentIds.length})</h3>
                    <div className="space-y-1">
                      {activeComponentIds.map((id) => {
                        const comp = displayComponents.find(c => c.id === id);
                        const assignment = componentColors.find(c => c.componentId === id);
                        if (!comp) return null;
                        const isSelected = selectedComponentId === comp.id;
                        return (
                          <div
                            key={comp.id}
                            onClick={() => setSelectedComponentId(comp.id)}
                            className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-all ${
                              isSelected 
                                ? 'bg-slate-600 ring-2 ring-blue-500' 
                                : 'bg-slate-700 hover:bg-slate-650'
                            }`}
                          >
                            <div
                              className="w-6 h-6 rounded border-2 border-slate-600 flex-shrink-0"
                              style={{ backgroundColor: assignment?.color }}
                            />
                            <div className="flex-1 text-sm font-medium">{comp.name}</div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveComponent(comp.id);
                              }}
                              className="w-6 h-6 flex items-center justify-center text-red-400 hover:bg-red-600/20 rounded"
                            >
                              ×
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Available Components */}
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 mb-2">Available</h3>
                  <div className="space-y-1">
                    {displayComponents
                      .filter(comp => !activeComponentIds.includes(comp.id))
                      .map((comp) => {
                        const assignment = componentColors.find(c => c.componentId === comp.id);
                        return (
                          <div
                            key={comp.id}
                            className="flex items-center gap-2 p-2 rounded bg-slate-700/50 hover:bg-slate-700"
                          >
                            <div
                              className="w-6 h-6 rounded border-2 border-slate-600 flex-shrink-0"
                              style={{ backgroundColor: assignment?.color }}
                            />
                            <div className="flex-1 text-sm font-medium">{comp.name}</div>
                            <button
                              onClick={() => handleAddComponent(comp.id)}
                              className="w-6 h-6 flex items-center justify-center text-green-400 hover:bg-green-600/20 rounded font-bold"
                            >
                              +
                            </button>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
              )}
            </div>
          )}
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
                onClick={() => {
                  if (!selectedComponentId) {
                    alert('Select a component first');
                    return;
                  }
                  setLineMode(!lineMode);
                  setLinePoints([]);
                }}
                disabled={calibrationMode || calibrations.length === 0}
                className={`px-3 py-2 rounded text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                  lineMode ? 'bg-green-600 hover:bg-green-700' : 'bg-slate-700 hover:bg-slate-600'
                }`}
                title={calibrations.length === 0 ? 'Calibrate first' : selectedComponentId ? 'Measure line' : 'Select component first'}
              >
                📏 Line
              </button>
              <button
                onClick={() => setAreaMode(!areaMode)}
                disabled={calibrationMode || calibrations.length === 0}
                className={`px-3 py-2 rounded text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                  areaMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-700 hover:bg-slate-600'
                }`}
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
            <div className="border-2 border-slate-700 rounded">
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

      {/* Initial Calibration Help */}
      {showCalibrationHelp && calibrations.length === 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-6 max-w-md border border-slate-700">
            <h2 className="text-xl font-semibold mb-4">📐 Calibrate Your Plan</h2>
            <div className="space-y-3 text-sm">
              <p>Before you can measure, you need to set the scale:</p>
              <ol className="list-decimal list-inside space-y-2 text-slate-300">
                <li>Click the <span className="font-bold text-yellow-400">"Calibrate"</span> button</li>
                <li>Click <span className="font-bold">two points</span> on the plan with a known distance</li>
                <li>Enter the <span className="font-bold">actual distance</span> between those points</li>
                <li>Add 2-3 calibrations for best accuracy</li>
                <li>Click <span className="font-bold text-green-400">"Confirm Calibration"</span> when done</li>
              </ol>
              <p className="text-slate-400 text-xs mt-4">
                Tip: Use dimensions shown on the plan (like wall lengths or roof spans).
              </p>
            </div>
            <button
              onClick={() => {
                setShowCalibrationHelp(false);
                // Auto-start calibration mode
                setCalibrationMode(true);
              }}
              className="mt-6 w-full px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded font-medium"
            >
              Got it, let's calibrate!
            </button>
          </div>
        </div>
      )}

      {/* Area Name Prompt */}
      {showAreaNamePrompt && (
        <AreaNameModal
          onSave={handleSaveArea}
          onCancel={() => {
            setShowAreaNamePrompt(false);
            setPendingAreaPoints([]);
            setAreaPoints([]);
          }}
        />
      )}

      {/* Line Measurement Prompt */}
      {showLineMeasurementPrompt && pendingLineMeasurement && (
        <LineMeasurementModal
          length={pendingLineMeasurement.length}
          unit={calibrations[0]?.unit || 'feet'}
          onConfirm={() => {
            if (!selectedComponentId) return;
            
            // Collect canvas objects (line + markers)
            const objects = fabricRef.current?.getObjects() || [];
            const canvasObjects = objects.filter(obj => 
              (obj.get('type') === 'line' && obj.stroke === '#10b981') ||
              (obj.get('type') === 'circle' && (obj.fill === '#10b981' || obj.fill === '#3b82f6'))
            ).slice(-3); // Last 3 objects (2 markers + 1 line)
            
            // Create measurement
            const newMeasurement: ComponentMeasurement = {
              id: `line-${Date.now()}`,
              type: 'line',
              value: pendingLineMeasurement.length,
              points: pendingLineMeasurement.points,
              visible: true,
              canvasObjects,
            };
            
            // Add to component measurements
            const compData = componentMeasurements.find(c => c.componentId === selectedComponentId);
            if (compData) {
              setComponentMeasurements(componentMeasurements.map(c =>
                c.componentId === selectedComponentId
                  ? { ...c, measurements: [...c.measurements, newMeasurement] }
                  : c
              ));
            } else {
              setComponentMeasurements([
                ...componentMeasurements,
                { 
                  componentId: selectedComponentId, 
                  measurements: [newMeasurement],
                  expanded: true 
                }
              ]);
            }
            
            // Clear state (keep lineMode active for repeat)
            setShowLineMeasurementPrompt(false);
            setPendingLineMeasurement(null);
            setLinePoints([]);
          }}
          onCancel={() => {
            // Remove line and markers from canvas
            if (fabricRef.current) {
              const objects = fabricRef.current.getObjects();
              const toRemove = objects.filter(obj => 
                (obj.get('type') === 'line' && obj.stroke === '#10b981') ||
                (obj.get('type') === 'circle' && (obj.fill === '#10b981' || obj.fill === '#3b82f6'))
              ).slice(-3);
              toRemove.forEach(obj => fabricRef.current!.remove(obj));
              fabricRef.current.renderAll();
            }
            
            // Clear state
            setShowLineMeasurementPrompt(false);
            setPendingLineMeasurement(null);
            setLinePoints([]);
          }}
        />
      )}
    </div>
  );
}

// Area Name Modal
function AreaNameModal({
  onSave,
  onCancel,
}: {
  onSave: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSave(name.trim());
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg p-6 w-96 border border-slate-700">
        <h2 className="text-xl font-semibold mb-4">Name This Area</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-2">Area Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded"
              placeholder="e.g. Main Roof"
              autoFocus
              required
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
              disabled={!name.trim()}
            >
              Save Area
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Line Measurement Modal
function LineMeasurementModal({
  length,
  unit,
  onConfirm,
  onCancel,
}: {
  length: number;
  unit: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onConfirm();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className="bg-slate-800 rounded-lg p-6 w-96 border border-slate-700">
        <h2 className="text-xl font-semibold mb-4">Line Measurement</h2>
        <div className="mb-6">
          <div className="text-3xl font-bold text-green-400">
            {length.toFixed(2)} {unit}
          </div>
          <div className="text-sm text-slate-400 mt-2">
            Press Enter to add, or Esc to cancel
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded"
          >
            Cancel (Esc)
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded"
            autoFocus
          >
            Add Line (Enter)
          </button>
        </div>
      </div>
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
                disabled={!distance || parseFloat(distance) <= 0}
              >
                Skip
              </button>
            )}
            {canAddAnother ? (
              <button
                type="button"
                onClick={() => handleSubmit(true)}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded"
                disabled={!distance || parseFloat(distance) <= 0}
              >
                Save & Add Another
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSubmit(false)}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded"
                disabled={!distance || parseFloat(distance) <= 0}
              >
                Save
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
