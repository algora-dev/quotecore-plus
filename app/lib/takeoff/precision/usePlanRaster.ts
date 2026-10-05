'use client';

import { useEffect, useMemo, useState } from 'react';
import { sceneDimsFromSource } from './sceneViewport';

type RasterState = { url: string; width: number; height: number; error: string | null };
export function usePlanRaster(active: boolean, url: string | null, imageRevision: string | null) {
  const [raster, setRaster] = useState<RasterState | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!active || !url) return;
    let disposed = false;
    const img = new Image();
    img.onload = () => {
      if (!disposed) setRaster({ url, width: img.naturalWidth, height: img.naturalHeight, error: null });
    };
    img.onerror = () => {
      if (!disposed) setRaster({ url, width: 0, height: 0, error: 'The plan image could not be loaded. Retry, or reopen the plan if its link has expired.' });
    };
    img.src = url;
    return () => { disposed = true; img.onload = null; img.onerror = null; };
  }, [active, url, retry]);
  const current = raster?.url === url ? raster : null;
  const width = current?.width ?? 0;
  const height = current?.height ?? 0;
  const scene = useMemo(() => width > 0 && height > 0 ? sceneDimsFromSource(width, height, imageRevision) : null,
    [width, height, imageRevision]);
  return { scene, sourceWidth: width, sourceHeight: height, error: current?.error ?? null, retry: () => setRetry((n) => n + 1) };
}
