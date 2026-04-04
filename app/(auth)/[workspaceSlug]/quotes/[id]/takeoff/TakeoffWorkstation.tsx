'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Stage, Layer, Image as KonvaImage } from 'react-konva';
import type { QuoteRow } from '@/app/lib/types';

interface Props {
  workspaceSlug: string;
  quote: QuoteRow;
  planUrl: string;
}

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 800;

export function TakeoffWorkstation({ workspaceSlug, quote, planUrl }: Props) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const stageRef = useRef<any>(null);

  // Load image
  useEffect(() => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setImage(img);
      
      // Fit image to canvas
      const scaleX = CANVAS_WIDTH / img.width;
      const scaleY = CANVAS_HEIGHT / img.height;
      const fitScale = Math.min(scaleX, scaleY, 1); // Don't zoom in beyond 100%
      
      setScale(fitScale);
      
      // Center image
      const x = (CANVAS_WIDTH - img.width * fitScale) / 2;
      const y = (CANVAS_HEIGHT - img.height * fitScale) / 2;
      setPosition({ x, y });
    };
    img.src = planUrl;
  }, [planUrl]);

  // Handle wheel zoom
  function handleWheel(e: any) {
    e.evt.preventDefault();

    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = scale;
    const pointer = stage.getPointerPosition();

    const mousePointTo = {
      x: (pointer.x - position.x) / oldScale,
      y: (pointer.y - position.y) / oldScale,
    };

    // Zoom in/out
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = Math.max(0.1, Math.min(5, oldScale + direction * 0.1));

    setScale(newScale);
    setPosition({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  }

  // Handle drag
  function handleDragEnd(e: any) {
    setPosition({
      x: e.target.x(),
      y: e.target.y(),
    });
  }

  // Zoom controls
  function zoomIn() {
    setScale(prev => Math.min(5, prev + 0.2));
  }

  function zoomOut() {
    setScale(prev => Math.max(0.1, prev - 0.2));
  }

  function resetView() {
    if (!image) return;
    
    const scaleX = CANVAS_WIDTH / image.width;
    const scaleY = CANVAS_HEIGHT / image.height;
    const fitScale = Math.min(scaleX, scaleY, 1);
    
    setScale(fitScale);
    
    const x = (CANVAS_WIDTH - image.width * fitScale) / 2;
    const y = (CANVAS_HEIGHT - image.height * fitScale) / 2;
    setPosition({ x, y });
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href={`/${workspaceSlug}/quotes/${quote.id}`}
              className="text-slate-400 hover:text-white text-sm"
            >
              ← Back to Quote
            </Link>
            <div className="border-l border-slate-700 pl-4">
              <h1 className="text-xl font-semibold text-white">Digital Take-off Station</h1>
              <p className="text-sm text-slate-400">
                {quote.customer_name} {quote.job_name && `— ${quote.job_name}`}
              </p>
            </div>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={zoomOut}
              className="px-3 py-2 bg-slate-700 text-white rounded hover:bg-slate-600"
              title="Zoom Out"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <span className="text-white text-sm min-w-[60px] text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={zoomIn}
              className="px-3 py-2 bg-slate-700 text-white rounded hover:bg-slate-600"
              title="Zoom In"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <button
              onClick={resetView}
              className="px-3 py-2 bg-slate-700 text-white rounded hover:bg-slate-600 text-sm"
            >
              Reset View
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-80px)]">
        {/* Left Sidebar */}
        <div className="w-80 bg-slate-800 border-r border-slate-700 p-4 overflow-y-auto">
          <div className="space-y-4">
            {/* Job Info */}
            <div className="bg-slate-700 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-white mb-2">Job Details</h3>
              <div className="space-y-1 text-sm">
                <div className="text-slate-400">Customer: <span className="text-white">{quote.customer_name}</span></div>
                {quote.job_name && (
                  <div className="text-slate-400">Job: <span className="text-white">{quote.job_name}</span></div>
                )}
                <div className="text-slate-400">Quote: <span className="text-white">#{quote.quote_number || 'Draft'}</span></div>
              </div>
            </div>

            {/* Placeholder for components list (Slice 4+) */}
            <div className="bg-slate-700 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-white mb-2">Components</h3>
              <p className="text-xs text-slate-400">
                Component selection coming in next slice...
              </p>
            </div>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white rounded-lg shadow-2xl overflow-hidden">
            <Stage
              ref={stageRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              onWheel={handleWheel}
              draggable
              onDragEnd={handleDragEnd}
              x={position.x}
              y={position.y}
              scaleX={scale}
              scaleY={scale}
            >
              <Layer>
                {image && (
                  <KonvaImage
                    image={image}
                    x={0}
                    y={0}
                  />
                )}
              </Layer>
            </Stage>
          </div>
        </div>
      </div>
    </div>
  );
}
