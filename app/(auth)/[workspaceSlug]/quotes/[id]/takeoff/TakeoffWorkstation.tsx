'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Canvas, FabricImage } from 'fabric';
import type { QuoteRow } from '@/app/lib/types';

interface Props {
  workspaceSlug: string;
  quote: QuoteRow;
  planUrl: string;
}

const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 700;

export function TakeoffWorkstation({ workspaceSlug, quote, planUrl }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const [zoom, setZoom] = useState(1);

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

    // Pan on drag
    canvas.on('mouse:down', (opt) => {
      const evt = opt.e;
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
        <button className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded">
          Save & Continue to Components
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Tools */}
        <div className="w-64 bg-slate-800 border-r border-slate-700 p-4 space-y-4 overflow-y-auto">
          <div>
            <h2 className="text-sm font-semibold mb-2 text-slate-400">Tools</h2>
            <div className="space-y-2">
              <button className="w-full px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded text-left text-sm">
                📏 Line Measurement
              </button>
              <button className="w-full px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded text-left text-sm">
                📐 Area (Polygon)
              </button>
              <button className="w-full px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded text-left text-sm">
                📍 Point Marker
              </button>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold mb-2 text-slate-400">Measurements</h2>
            <div className="text-sm text-slate-500">
              No measurements yet
            </div>
          </div>
        </div>

        {/* Center - Canvas */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
          {/* Zoom Controls */}
          <div className="absolute top-4 right-4 flex gap-2 bg-slate-800 rounded-lg p-2 shadow-lg">
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

          <canvas ref={canvasRef} />
          <p className="mt-4 text-sm text-slate-500">Hold Alt + Drag to pan</p>
        </div>

        {/* Right Sidebar - Components */}
        <div className="w-80 bg-slate-800 border-l border-slate-700 p-4 overflow-y-auto">
          <h2 className="text-sm font-semibold mb-2 text-slate-400">Components</h2>
          <div className="text-sm text-slate-500">
            No components assigned yet
          </div>
        </div>
      </div>
    </div>
  );
}
