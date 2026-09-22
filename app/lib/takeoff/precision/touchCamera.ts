import { fitCamera, type Camera, type ViewportSize } from './sceneViewport';

export function resizePrecisionCamera(camera: Camera, old: ViewportSize, next: ViewportSize,
  scene: { width: number; height: number }): Camera {
  if (old.width === next.width && old.height === next.height) return camera;
  if (old.width <= 0 || old.height <= 0) return fitCamera(scene, next);
  const oldFit = fitCamera(scene, old);
  if (Math.abs(camera.zoom - oldFit.zoom) < 1e-8 && Math.abs(camera.tx - oldFit.tx) < 0.01 && Math.abs(camera.ty - oldFit.ty) < 0.01) {
    return fitCamera(scene, next);
  }
  // Preserve the scene point under the old viewport centre, at the same zoom.
  return { zoom: camera.zoom, tx: camera.tx + (next.width - old.width) / 2, ty: camera.ty + (next.height - old.height) / 2 };
}
