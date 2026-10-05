'use client';

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { fitCamera, type Camera, type SceneDescriptor, type ViewportSize } from './sceneViewport';
import { resizePrecisionCamera } from './touchCamera';

/** Callback-ref measurement: the first image never waits for a tap to create
 * the camera. A frame change fits once; a rail resize preserves the camera's
 * scene centre. No stored geometry ever passes through this hook. */
export function usePrecisionCamera(active: boolean, scene: SceneDescriptor | null, frameKey: string) {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const [viewport, setViewport] = useState<ViewportSize>({ width: 0, height: 0 });
  const [camera, setCamera] = useState<Camera | null>(null);
  const cameraRef = useRef(camera);
  useLayoutEffect(() => { cameraRef.current = camera; }, [camera]);
  const bindSurface = useCallback((element: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    surfaceRef.current = element;
    if (!element || !active) return;
    const measure = () => {
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      setViewport((old) => old.width === rect.width && old.height === rect.height
        ? old : { width: rect.width, height: rect.height });
    };
    measure();
    observerRef.current = new ResizeObserver(measure);
    observerRef.current.observe(element);
  }, [active]);
  useLayoutEffect(() => () => observerRef.current?.disconnect(), []);
  const previous = useRef<{ key: string; viewport: ViewportSize } | null>(null);
  const width = scene?.width ?? 0;
  const height = scene?.height ?? 0;
  useLayoutEffect(() => {
    if (!active || !width || !height || !viewport.width || !viewport.height) return;
    const key = `${frameKey}|${width}x${height}`;
    const old = previous.current;
    previous.current = { key, viewport };
    setCamera((cam) => !cam || !old || old.key !== key
      ? fitCamera({ width, height }, viewport)
      : resizePrecisionCamera(cam, old.viewport, viewport, { width, height }));
  }, [active, frameKey, width, height, viewport]);
  const fit = useCallback(() => {
    if (width > 0 && height > 0 && viewport.width > 0 && viewport.height > 0) {
      setCamera(fitCamera({ width, height }, viewport));
    }
  }, [width, height, viewport]);
  const fitZoom = width > 0 && height > 0 && viewport.width > 0 && viewport.height > 0
    ? fitCamera({ width, height }, viewport).zoom : 0.1;
  const zoomBounds = useMemo(() => ({ min: fitZoom * 0.5, max: fitZoom * 16 }), [fitZoom]);
  const zoomBy = useCallback((factor: number) => {
    setCamera((cam) => {
      if (!cam || !viewport.width || !viewport.height) return cam;
      const x = (viewport.width / 2 - cam.tx) / cam.zoom;
      const y = (viewport.height / 2 - cam.ty) / cam.zoom;
      const zoom = Math.min(zoomBounds.max, Math.max(zoomBounds.min, cam.zoom * factor));
      return { zoom, tx: viewport.width / 2 - zoom * x, ty: viewport.height / 2 - zoom * y };
    });
  }, [viewport, zoomBounds]);
  return { surfaceRef, bindSurface, viewport, camera, cameraRef, setCamera, fit, zoomBounds, zoomBy };
}
