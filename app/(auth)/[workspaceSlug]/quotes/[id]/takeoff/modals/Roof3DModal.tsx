'use client';

/**
 * 3D roof view (Tier 1 spike, owner-approved 2026-10-28).
 *
 * Pitched 3D preview of the drawn roof areas using the grassfire model
 * (app/lib/takeoff/roof3d/geometry.ts): every boundary edge of a roof area
 * acts as an eave and the surface rises inward at the area pitch, creasing at
 * the medial ridge. A rectangular outline becomes a proper gable, irregular
 * outlines approximate hips and valleys. All areas render in one Three.js
 * scene the user can orbit and zoom; the current view downloads as a PNG and
 * the four standard angles download as one composite 2x2 sheet.
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
import { buildFaceTriangles, type Pt } from '@/app/lib/takeoff/roof3d/geometry';

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

/** Standard screenshot angles: four isometric views at a low elevation. */
const FOUR_VIEWS: { theta: number; phi: number; label: string }[] = [
  { theta: Math.PI / 4, phi: Math.PI / 3.4, label: 'Front right' },
  { theta: (3 * Math.PI) / 4, phi: Math.PI / 3.4, label: 'Front left' },
  { theta: (5 * Math.PI) / 4, phi: Math.PI / 3.4, label: 'Back left' },
  { theta: (7 * Math.PI) / 4, phi: Math.PI / 3.4, label: 'Back right' },
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
  const captureFourRef = useRef<(() => void) | null>(null);
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
      const positions = buildFaceTriangles(centred[i], face.pitch);
      if (!positions) return;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.computeVertexNormals();
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
    // OrbitControls needs the browser to leave touch gestures to the canvas.
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.style.cursor = 'grab';
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
    // One composite 2x2 sheet, one download: browsers block rapid multi-file
    // downloads, which swallowed three of the four files previously.
    captureFourRef.current = () => {
      const cw = renderer.domElement.width;
      const ch = renderer.domElement.height;
      const composite = document.createElement('canvas');
      composite.width = cw * 2;
      composite.height = ch * 2;
      const ctx = composite.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#e9eef4';
      ctx.fillRect(0, 0, composite.width, composite.height);
      const original = camera.position.clone();
      FOUR_VIEWS.forEach((view, i) => {
        camera.position
          .setFromSpherical(new THREE.Spherical(radius * 2.4, view.phi, view.theta))
          .add(target);
        camera.lookAt(target);
        render();
        ctx.drawImage(renderer.domElement, (i % 2) * cw, Math.floor(i / 2) * ch, cw, ch);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillRect((i % 2) * cw + 12, Math.floor(i / 2) * ch + 12, 158, 26);
        ctx.fillStyle = '#334155';
        ctx.font = '600 15px -apple-system, Segoe UI, sans-serif';
        ctx.fillText(view.label, (i % 2) * cw + 20, Math.floor(i / 2) * ch + 30);
      });
      camera.position.copy(original);
      camera.lookAt(target);
      controls.update();
      render();
      downloadDataUrl(composite.toDataURL('image/png'), `roof-3d-four-views-${timestampSlug()}.png`);
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
              try {
                captureFourRef.current?.();
              } finally {
                setBusy(false);
              }
            }}
          >
            Download 4-view sheet
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
            Capture current view
          </QcHostedButton>
        </div>
      </div>
    </QcHostedDialog>
  );
}
