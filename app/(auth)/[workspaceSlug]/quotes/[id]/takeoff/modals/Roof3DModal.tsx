'use client';

/**
 * 3D roof view (Tier 1 spike, owner-approved 2026-10-28).
 *
 * Builds a lightweight pitched 3D preview from the drawn roof areas using the
 * grassfire model: every boundary edge of a roof area acts as an eave and the
 * surface rises inward at the area pitch, creasing at the medial ridge. A
 * rectangular outline becomes a proper gable, triangular outlines become
 * hips, and irregular outlines approximate the straight-skeleton result. All
 * areas render in one Three.js scene the user can orbit and zoom; the current
 * view and four standard angles download as PNGs.
 *
 * Tier 1 limitations (by design): seams where areas of different pitch meet
 * are approximate, and the result is a visual preview, not watertight
 * geometry. Areas are independent roofs in one scene; shared edges between
 * separately drawn areas are not welded.
 */

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { QcHostedDialog, QcHostedButton } from '@/app/components/ui/v2/QcHostedDialog';

export interface Roof3DFace {
  id: string;
  name: string;
  /** Pitch in degrees. */
  pitch: number;
  /** Plan-view polygon in canvas pixels. */
  points: { x: number; y: number }[];
  /** Plan area in squared real units, as stored on the roof area. */
  area: number;
}

/** Distinct face colours, cycled when there are more faces than colours. */
const FACE_COLORS = ['#F97316', '#0EA5E9', '#10B981', '#8B5CF6', '#F43F5E', '#EAB308', '#14B8A6', '#EC4899'];

type Pt = { x: number; y: number };

/** A pitched roof built from one plan-view outline. */
type PitchedFace =
  | { mode: 'gable'; ring: Pt[]; heightAt: (p: Pt) => number }
  | { mode: 'fan'; ring: Pt[]; peak: Pt; heightAt: (p: Pt) => number };

interface EdgeInfo {
  a: Pt;
  dx: number;
  dy: number;
  len: number;
  /** Interior-pointing unit normal. */
  inx: number;
  iny: number;
}

function polygonEdges(points: Pt[]): EdgeInfo[] {
  const n = points.length;
  let cx = 0;
  let cy = 0;
  for (const p of points) {
    cx += p.x;
    cy += p.y;
  }
  cx /= n;
  cy /= n;
  const edges: EdgeInfo[] = [];
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len;
    let ny = dx / len;
    if ((cx - a.x) * nx + (cy - a.y) * ny < 0) {
      nx = -nx;
      ny = -ny;
    }
    edges.push({ a, dx: dx / len, dy: dy / len, len, inx: nx, iny: ny });
  }
  return edges;
}

/** Grassfire distance: nearest edge line, interior side, clamped at zero. */
function grassfireDistance(p: Pt, edges: EdgeInfo[]): number {
  let best = Infinity;
  for (const e of edges) {
    const d = (p.x - e.a.x) * e.inx + (p.y - e.a.y) * e.iny;
    if (d < best) best = d;
  }
  return Math.max(0, best);
}

function pointInPolygon(p: Pt, ring: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

/** Clip an infinite line (origin + direction) to the polygon; null if no overlap. */
function clipLineToPolygon(origin: Pt, dir: Pt, ring: Pt[]): [Pt, Pt] | null {
  const params: number[] = [];
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % n];
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const denom = dir.x * ey - dir.y * ex;
    if (Math.abs(denom) < 1e-9) continue;
    const t = ((a.x - origin.x) * ey - (a.y - origin.y) * ex) / denom;
    const u = ((a.x - origin.x) * dir.y - (a.y - origin.y) * dir.x) / denom;
    if (u >= -1e-9 && u <= 1 + 1e-9) params.push(t);
  }
  if (params.length < 2) return null;
  params.sort((x, y) => x - y);
  const t0 = params[0];
  const t1 = params[params.length - 1];
  if (t1 - t0 < 1e-6) return null;
  return [
    { x: origin.x + dir.x * t0, y: origin.y + dir.y * t0 },
    { x: origin.x + dir.x * t1, y: origin.y + dir.y * t1 },
  ];
}

/** Insert a point into the ring after the edge it lies on (no-op if off-boundary). */
function insertIntoRing(ring: Pt[], p: Pt): void {
  const eps = 1e-6;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const len2 = ex * ex + ey * ey || 1;
    const u = ((p.x - a.x) * ex + (p.y - a.y) * ey) / len2;
    if (u < -eps || u > 1 + eps) continue;
    const px = a.x + ex * Math.min(Math.max(u, 0), 1);
    const py = a.y + ey * Math.min(Math.max(u, 0), 1);
    if (Math.hypot(p.x - px, p.y - py) < 1e-4) {
      ring.splice(i + 1, 0, { x: px, y: py });
      return;
    }
  }
}

/** Densify the ring so long edges carry midpoints for a smoother silhouette. */
function densifyRing(ring: Pt[]): Pt[] {
  const out: Pt[] = [];
  let perimeter = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    perimeter += Math.hypot(b.x - a.x, b.y - a.y);
  }
  const maxStep = Math.max(perimeter / 28, 1e-3);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    out.push(a);
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const segs = Math.floor(len / maxStep);
    for (let s = 1; s <= segs; s++) {
      const t = s / (segs + 1);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}

/**
 * Build a pitched roof from one plan outline. The height function is the
 * grassfire model (tan(pitch) x distance to the nearest eave line); the mesh
 * inserts the ridge so the crease is real geometry, not interpolation luck.
 * Gable mode: a near-parallel non-adjacent edge pair gives a ridge segment.
 * Fan mode fallback: one interior peak, tent triangulation (hips).
 */
function buildPitchedFace(points: Pt[], pitchDeg: number): PitchedFace | null {
  if (points.length < 3) return null;
  const rise = Math.tan((Math.max(0, pitchDeg) * Math.PI) / 180);
  const edges = polygonEdges(points);
  const heightAt = (p: Pt) => rise * grassfireDistance(p, edges);

  // Gable candidates: near-parallel, non-adjacent edge pairs. Pick the pair
  // whose equidistant ridge line clips to the longest segment in the polygon.
  let bestRidge: [Pt, Pt] | null = null;
  let bestRidgeLen = 0;
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 2; j < edges.length; j++) {
      if (i === 0 && j === edges.length - 1) continue;
      const e1 = edges[i];
      const e2 = edges[j];
      const parallel = Math.abs(e1.dx * e2.dx + e1.dy * e2.dy);
      if (parallel < 0.94) continue;
      // Equidistant line between the two edge lines (interior side).
      const d1 = (e2.a.x - e1.a.x) * e1.inx + (e2.a.y - e1.a.y) * e1.iny;
      if (d1 <= 0) continue;
      const origin = { x: e1.a.x + e1.inx * (d1 / 2), y: e1.a.y + e1.iny * (d1 / 2) };
      const dir = { x: e1.dx, y: e1.dy };
      const ridge = clipLineToPolygon(origin, dir, points);
      if (!ridge) continue;
      const rl = Math.hypot(ridge[1].x - ridge[0].x, ridge[1].y - ridge[0].y);
      if (rl > bestRidgeLen) {
        bestRidgeLen = rl;
        bestRidge = ridge;
      }
    }
  }

  const ring = densifyRing(points);
  if (bestRidge && bestRidgeLen > 0.18 * (edges.reduce((m, e) => Math.max(m, e.len), 0))) {
    const gableRing = ring.slice();
    insertIntoRing(gableRing, bestRidge[0]);
    insertIntoRing(gableRing, bestRidge[1]);
    return { mode: 'gable', ring: gableRing, heightAt };
  }

  // Tent fallback: deepest interior point via a coarse grid becomes the peak.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  let peak: Pt | null = null;
  let peakDist = -1;
  const steps = 26;
  for (let sx = 1; sx < steps; sx++) {
    for (let sy = 1; sy < steps; sy++) {
      const p = { x: minX + ((maxX - minX) * sx) / steps, y: minY + ((maxY - minY) * sy) / steps };
      if (!pointInPolygon(p, points)) continue;
      const d = grassfireDistance(p, edges);
      if (d > peakDist) {
        peakDist = d;
        peak = p;
      }
    }
  }
  if (!peak) return null;
  return { mode: 'fan', ring, peak, heightAt };
}

/** Standard screenshot angles: four isometric views at a low elevation. */
const FOUR_VIEWS: { theta: number; phi: number; label: string }[] = [
  { theta: Math.PI / 4, phi: Math.PI / 3.4, label: 'front-right' },
  { theta: (3 * Math.PI) / 4, phi: Math.PI / 3.4, label: 'front-left' },
  { theta: (5 * Math.PI) / 4, phi: Math.PI / 3.4, label: 'back-left' },
  { theta: (7 * Math.PI) / 4, phi: Math.PI / 3.4, label: 'back-right' },
];

function downloadDataUrl(dataUrl: string, filename: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function timestampSlug(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

export function Roof3DModal({
  faces,
  scale,
  unit,
  onClose,
}: {
  faces: Roof3DFace[];
  /** Real-world units per canvas pixel, from the page calibration. */
  scale: number;
  unit: 'feet' | 'meters';
  onClose: () => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const captureRef = useRef<(() => void) | null>(null);
  const captureFourRef = useRef<(() => Promise<void>) | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const usable = faces.filter((f) => f.points.length >= 3);
  const validScale = Number.isFinite(scale) && scale > 0;
  const unitShort = unit === 'feet' ? 'ft' : 'm';

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !validScale || usable.length === 0) return;

    // Convert to real units, flip canvas Y so north reads correctly, and
    // centre the whole roof on the origin so orbiting feels natural.
    const all: Pt[] = [];
    for (const f of usable) for (const p of f.points) all.push({ x: p.x * scale, y: -p.y * scale });
    const cx = all.reduce((s, p) => s + p.x, 0) / all.length;
    const cy = all.reduce((s, p) => s + p.y, 0) / all.length;
    const centred = usable.map((f) => f.points.map((p) => ({ x: p.x * scale - cx, y: -p.y * scale - cy })));

    const disposables: { dispose: () => void }[] = [];
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#e9eef4');

    const group = new THREE.Group();
    usable.forEach((face, i) => {
      const pts = centred[i];
      const built = buildPitchedFace(pts, face.pitch);
      if (!built) return;
      let geometry: THREE.BufferGeometry;
      if (built.mode === 'fan') {
        const vertices: number[] = [];
        const n = built.ring.length;
        for (let v = 0; v < n; v++) {
          const a = built.ring[v];
          const b = built.ring[(v + 1) % n];
          for (const p of [a, b, built.peak]) {
            vertices.push(p.x, built.heightAt(p), -p.y);
          }
        }
        geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.computeVertexNormals();
      } else {
        const shape = new THREE.Shape(built.ring.map((p) => new THREE.Vector2(p.x, p.y)));
        geometry = new THREE.ShapeGeometry(shape);
        const pos = geometry.attributes.position as THREE.BufferAttribute;
        for (let v = 0; v < pos.count; v++) {
          const p = { x: pos.getX(v), y: pos.getY(v) };
          pos.setZ(v, built.heightAt(p));
        }
        pos.needsUpdate = true;
        geometry.computeVertexNormals();
        // Shape space is (x, y, height); rotate so world is (x, height, -y).
        geometry.rotateX(-Math.PI / 2);
      }
      const material = new THREE.MeshLambertMaterial({
        color: new THREE.Color(FACE_COLORS[i % FACE_COLORS.length]),
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geometry, material);
      group.add(mesh);
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry, 1),
        new THREE.LineBasicMaterial({ color: 0x334155 }),
      );
      group.add(edges);
      disposables.push(geometry, material, edges.geometry, edges.material as unknown as { dispose: () => void });
    });
    scene.add(group);

    // Ground reference grid sized to the footprint.
    const box = new THREE.Box3().setFromObject(group);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const radius = Math.max(sphere.radius, 1);
    const grid = new THREE.GridHelper(radius * 2.8, 14, 0xcbd5e1, 0xdfe6ee);
    grid.position.set(sphere.center.x, -radius * 0.02, sphere.center.z);
    scene.add(grid);

    scene.add(new THREE.HemisphereLight(0xffffff, 0xcbd5e1, 1.0));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(radius * 1.4, radius * 2.2, radius * 1.1);
    scene.add(sun);

    const width = Math.max(mount.clientWidth, 1);
    const height = Math.max(mount.clientHeight, 1);
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(45, width / height, radius * 0.01, radius * 40);
    const target = sphere.center.clone();
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(target);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = radius * 0.7;
    controls.maxDistance = radius * 6;
    controls.maxPolarAngle = Math.PI * 0.52;
    const homeSpherical = new THREE.Spherical(radius * 2.4, Math.PI / 3.2, Math.PI / 4);
    camera.position.setFromSpherical(homeSpherical).add(target);
    camera.lookAt(target);
    controls.update();

    const resize = () => {
      const w = Math.max(mount.clientWidth, 1);
      const h = Math.max(mount.clientHeight, 1);
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    const animate = () => controls.update();
    renderer.setAnimationLoop(animate);

    const render = () => renderer.render(scene, camera);
    render();
    setReady(true);

    captureRef.current = () => {
      render();
      downloadDataUrl(renderer.domElement.toDataURL('image/png'), `roof-3d-${timestampSlug()}.png`);
    };
    captureFourRef.current = async () => {
      const original = camera.position.clone();
      const slug = timestampSlug();
      for (const view of FOUR_VIEWS) {
        camera.position.setFromSpherical(new THREE.Spherical(radius * 2.4, view.phi, view.theta)).add(target);
        camera.lookAt(target);
        render();
        downloadDataUrl(renderer.domElement.toDataURL('image/png'), `roof-3d-${view.label}-${slug}.png`);
        await new Promise((r) => setTimeout(r, 350));
      }
      camera.position.copy(original);
      camera.lookAt(target);
      controls.update();
      render();
    };

    return () => {
      renderer.setAnimationLoop(null);
      observer.disconnect();
      controls.dispose();
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement);
      captureRef.current = null;
      captureFourRef.current = null;
    };
    // The modal mounts fresh each time it opens, so scene setup runs once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <QcHostedDialog label="3D roof view" size="lg" className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-4xl mx-4 flex flex-col max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-900">3D roof view</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {usable.length} face{usable.length === 1 ? '' : 's'} · drag to orbit · scroll or pinch to zoom · approximate preview
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close 3D view"
            className="p-2 rounded-full hover:bg-slate-100 transition"
          >
            <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-3 overflow-x-auto">
          <div className="flex gap-2 flex-wrap">
            {usable.map((f, i) => (
              <span
                key={f.id}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border border-slate-200 bg-white whitespace-nowrap"
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: FACE_COLORS[i % FACE_COLORS.length] }} />
                {f.name} · {f.pitch}&deg; · {f.area.toFixed(1)} {unitShort}&sup2;
              </span>
            ))}
          </div>
        </div>

        <div className="px-5 pb-4 min-h-0 flex-1 flex flex-col">
          <div ref={mountRef} className="relative flex-1 min-h-[340px] h-[52vh] md:h-[58vh] rounded-xl overflow-hidden bg-[#e9eef4]">
            {!ready && !error && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-sm text-slate-500">Preparing 3D view&hellip;</p>
              </div>
            )}
            {error && (
              <div className="absolute inset-0 flex items-center justify-center px-6">
                <p className="text-sm text-slate-600">{error}</p>
              </div>
            )}
          </div>
        </div>

        <div className="px-5 pb-5 flex flex-wrap items-center justify-end gap-3">
          <QcHostedButton
            variant="ghost"
            disabled={!ready || busy}
            className="px-4 py-2 min-h-[44px] text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
            onClick={() => {
              setBusy(true);
              const p = captureFourRef.current?.() ?? Promise.resolve();
              p.finally(() => setBusy(false));
            }}
          >
            Download 4 standard views
          </QcHostedButton>
          <QcHostedButton
            variant="ghost"
            disabled={!ready || busy}
            className="px-4 py-2 min-h-[44px] text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
            onClick={onClose}
          >
            Close
          </QcHostedButton>
          <QcHostedButton
            variant="primary"
            disabled={!ready || busy}
            className="px-4 py-2 min-h-[44px] text-sm font-semibold rounded-full bg-black text-white hover:bg-slate-800 transition-all disabled:opacity-50"
            onClick={() => captureRef.current?.()}
          >
            {busy ? 'Capturing&hellip;' : 'Capture current view'}
          </QcHostedButton>
        </div>
      </div>
    </QcHostedDialog>
  );
}
