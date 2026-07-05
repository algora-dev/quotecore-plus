/**
 * Canvas-rework: Reconstruct Fabric.js canvas objects from stored DB data.
 *
 * On re-entry (mode=add), the hydration data contains measurement rows with
 * `canvas_points` (vertex coordinates). This module rebuilds the actual
 * Fabric.js objects (polygons, lines, markers) so the user can visually
 * edit their previous work.
 *
 * Every created object is tagged with a `measurementId` custom property
 * so the undo system can re-link canvasObjects after a restore.
 */

import { Canvas, Circle, Line, Polygon, Triangle } from 'fabric';
import type { ComponentMeasurement, RoofArea, Calibration } from './reconstructTypes';

export interface ReconstructInput {
  /** Component measurements grouped by component. */
  componentMeasurements: { componentId: string; measurements: ComponentMeasurement[] }[];
  /** Roof area boundary polygons. */
  roofAreas: RoofArea[];
  /** Component color mapping (componentId → hex color). */
  componentColors: { componentId: string; color: string }[];
  /** Page filter: only reconstruct measurements for this page. */
  currentPageId: string | null;
}

export interface ReconstructOutput {
  /** Updated componentMeasurements with canvasObjects populated. */
  componentMeasurements: { componentId: string; measurements: ComponentMeasurement[]; expanded: boolean }[];
  /** Updated roofAreas with polygon + markers populated. */
  roofAreas: RoofArea[];
}

/**
 * Reconstruct all canvas objects from DB data.
 * Call this AFTER the canvas is initialised and the background image is loaded.
 */
export function reconstructCanvas(
  canvas: Canvas,
  input: ReconstructInput,
): ReconstructOutput {
  const objectsAdded: unknown[] = [];

  // Parent/child plans (2026-07-05): a measurement belongs on the canvas only
  // if it was drawn on the CURRENT page. Rows with a different fromPageId stay
  // in React state (so left-panel totals/components aggregate across the
  // parent area's plans) but are NOT drawn. Null fromPageId = legacy or fresh
  // drawing on the current page → draw it.
  const belongsOnPage = (fromPageId: string | null | undefined): boolean => {
    if (!input.currentPageId) return true;
    if (fromPageId == null) return true;
    return fromPageId === input.currentPageId;
  };

  // ─── Roof Area boundaries ──────────────────────────────────────────
  const restoredRoofAreas: RoofArea[] = input.roofAreas.map((area, areaIdx) => {
    if (!area.points || area.points.length < 3 || !belongsOnPage(area.fromPageId)) {
      return { ...area, polygon: undefined, markers: [] };
    }

    // Polygon (blue fill, semi-transparent, matching the draw-time style)
    const polygon = new Polygon(
      area.points.map(p => ({ x: p.x, y: p.y })),
      {
        fill: 'rgba(59, 130, 246, 0.2)',
        stroke: '#3b82f6',
        strokeWidth: 2,
        selectable: false,
        objectCaching: false,
      },
    );
    (polygon as unknown as { measurementId: string }).measurementId = area.id;
    canvas.add(polygon);
    objectsAdded.push(polygon);

    // Vertex markers
    const markers = area.points.map((p) => {
      const marker = createMarker(p.x, p.y, '#3b82f6', area.id);
      canvas.add(marker);
      return marker;
    });
    objectsAdded.push(...markers);

    return { ...area, polygon, markers };
  });

  // ─── Component measurements ────────────────────────────────────────
  const restoredComponents = input.componentMeasurements.map((comp) => {
    const color = input.componentColors.find(c => c.componentId === comp.componentId)?.color || '#10b981';

    const restoredMeasurements: ComponentMeasurement[] = comp.measurements.map((m) => {
      if (!m.points || m.points.length === 0 || !belongsOnPage(m.fromPageId)) {
        return { ...m, canvasObjects: [] };
      }

      const canvasObjects: unknown[] = [];

      switch (m.type) {
        case 'line': {
          if (m.points.length >= 2) {
            const [p1, p2] = m.points;
            const marker1 = createMarker(p1.x, p1.y, color, m.id);
            const marker2 = createMarker(p2.x, p2.y, color, m.id);
            const line = new Line([p1.x, p1.y, p2.x, p2.y], {
              stroke: color,
              strokeWidth: 2,
              selectable: false,
                    hasControls: false,
              hasBorders: false,
            });
            (line as unknown as { measurementId: string }).measurementId = m.id;
            canvas.add(marker1, marker2, line);
            canvasObjects.push(marker1, marker2, line);
          }
          break;
        }

        case 'area': {
          if (m.points.length >= 3) {
            const poly = new Polygon(
              m.points.map(p => ({ x: p.x, y: p.y })),
              {
                fill: color + '33', // semi-transparent
                stroke: color,
                strokeWidth: 2,
                selectable: false,
                        objectCaching: false,
              },
            );
            (poly as unknown as { measurementId: string }).measurementId = m.id;
            canvas.add(poly);
            canvasObjects.push(poly);

            // Vertex markers
            m.points.forEach(p => {
              const marker = createMarker(p.x, p.y, color, m.id);
              canvas.add(marker);
              canvasObjects.push(marker);
            });
          }
          break;
        }

        case 'point': {
          if (m.points.length >= 1) {
            const p = m.points[0];
            const triangle = new Triangle({
              left: p.x,
              top: p.y,
              width: 10,
              height: 10,
              fill: color,
              stroke: '#000',
              strokeWidth: 1,
              originX: 'center',
              originY: 'center',
              selectable: false,
                    hasControls: false,
              hasBorders: false,
            });
            (triangle as unknown as { measurementId: string }).measurementId = m.id;
            canvas.add(triangle);
            canvasObjects.push(triangle);
          }
          break;
        }

        case 'multi_lineal':
        case 'multi_lineal_lxh':
        case 'multi_lineal_lxh_freestyle': {
          if (m.points.length >= 2) {
            // Markers at each vertex
            m.points.forEach(p => {
              const marker = createMarker(p.x, p.y, color, m.id);
              canvas.add(marker);
              canvasObjects.push(marker);
            });
            // Line segments between consecutive points
            for (let i = 1; i < m.points.length; i++) {
              const p1 = m.points[i - 1];
              const p2 = m.points[i];
              const line = new Line([p1.x, p1.y, p2.x, p2.y], {
                stroke: color,
                strokeWidth: 2,
                selectable: false,
                        hasControls: false,
                hasBorders: false,
              });
              (line as unknown as { measurementId: string }).measurementId = m.id;
              canvas.add(line);
              canvasObjects.push(line);
            }
          }
          break;
        }

        case 'volume_3d': {
          if (m.points.length >= 3) {
            const poly = new Polygon(
              m.points.map(p => ({ x: p.x, y: p.y })),
              {
                fill: color + '33',
                stroke: color,
                strokeWidth: 2,
                strokeDashArray: [],
                selectable: false,
                        objectCaching: false,
              },
            );
            (poly as unknown as { measurementId: string }).measurementId = m.id;
            canvas.add(poly);
            canvasObjects.push(poly);

            // Vertex markers
            m.points.forEach(p => {
              const marker = createMarker(p.x, p.y, color, m.id);
              canvas.add(marker);
              canvasObjects.push(marker);
            });
          }
          break;
        }

        case 'length_x_height_freestyle': {
          if (m.points.length >= 2) {
            const [p1, p2] = m.points;
            const marker1 = createMarker(p1.x, p1.y, color, m.id);
            const marker2 = createMarker(p2.x, p2.y, color, m.id);
            const line = new Line([p1.x, p1.y, p2.x, p2.y], {
              stroke: color,
              strokeWidth: 2,
              selectable: false,
                    hasControls: false,
              hasBorders: false,
            });
            (line as unknown as { measurementId: string }).measurementId = m.id;
            canvas.add(marker1, marker2, line);
            canvasObjects.push(marker1, marker2, line);
          }
          break;
        }
      }

      // Apply visibility
      if (!m.visible) {
        canvasObjects.forEach((obj: unknown) => {
          (obj as { set: (k: string, v: unknown) => void }).set('visible', false);
        });
      }

      return { ...m, canvasObjects: canvasObjects as never[] };
    });

    return {
      componentId: comp.componentId,
      measurements: restoredMeasurements,
      expanded: false,
    };
  });

  canvas.renderAll();

  return {
    componentMeasurements: restoredComponents,
    roofAreas: restoredRoofAreas,
  };
}

function createMarker(x: number, y: number, color: string, measurementId: string): Circle {
  const marker = new Circle({
    left: x,
    top: y,
    radius: 3,
    fill: color,
    stroke: '#000',
    strokeWidth: 1,
    originX: 'center',
    originY: 'center',
    selectable: false,
    hasControls: false,
    hasBorders: false,
  });
  (marker as unknown as { measurementId: string }).measurementId = measurementId;
  return marker;
}
