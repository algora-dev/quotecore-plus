'use client';

import { useState } from 'react';
import { useUnitSystem } from '../ConstructionCalculator';
import { rectangleArea, triangleArea, trapezoidArea, circleArea } from '../lib/calculator';

type Shape = 'rectangle' | 'triangle' | 'trapezoid' | 'circle';

interface ShapeEntry {
  id: string;
  type: Shape;
  a: string;
  b: string;
  c: string;
  result: number;
}

const SHAPE_LABELS: Record<Shape, string> = {
  rectangle: 'Rectangle',
  triangle: 'Triangle',
  trapezoid: 'Trapezoid',
  circle: 'Circle',
};

export function AreaCalculator() {
  const { areaUnit, lengthUnit } = useUnitSystem();
  const [shapes, setShapes] = useState<ShapeEntry[]>([
    { id: '1', type: 'rectangle', a: '10', b: '8', c: '', result: 80 },
  ]);

  const total = shapes.reduce((sum, s) => sum + s.result, 0);

  function compute(entry: ShapeEntry): number {
    const a = parseFloat(entry.a) || 0;
    const b = parseFloat(entry.b) || 0;
    const c = parseFloat(entry.c) || 0;
    switch (entry.type) {
      case 'rectangle': return rectangleArea(a, b);
      case 'triangle': return triangleArea(a, b);
      case 'trapezoid': return trapezoidArea(a, b, c);
      case 'circle': return circleArea(a);
    }
  }

  function updateShape(id: string, patch: Partial<ShapeEntry>) {
    setShapes((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const updated = { ...s, ...patch };
        updated.result = compute(updated);
        return updated;
      }),
    );
  }

  function addShape() {
    const id = String(Date.now());
    setShapes((prev) => [...prev, { id, type: 'rectangle', a: '', b: '', c: '', result: 0 }]);
  }

  function removeShape(id: string) {
    setShapes((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Area Calculator</h2>
        <p className="mt-1 text-sm text-slate-500">
          Calculate area for rectangles, triangles, trapezoids, and circles. Add multiple shapes for a running total.
        </p>
      </div>

      <div className="space-y-4">
        {shapes.map((shape) => (
          <div key={shape.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <select
                value={shape.type}
                onChange={(e) => updateShape(shape.id, { type: e.target.value as Shape })}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium focus:border-orange-500 focus:outline-none"
              >
                {Object.entries(SHAPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              {shapes.length > 1 && (
                <button
                  onClick={() => removeShape(shape.id)}
                  className="text-xs font-medium text-red-500 hover:text-red-600"
                >
                  Remove
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {shape.type === 'rectangle' && (
                <>
                  <Field label={`Width (${lengthUnit})`} value={shape.a} onChange={(v) => updateShape(shape.id, { a: v })} />
                  <Field label={`Length (${lengthUnit})`} value={shape.b} onChange={(v) => updateShape(shape.id, { b: v })} />
                </>
              )}
              {shape.type === 'triangle' && (
                <>
                  <Field label={`Base (${lengthUnit})`} value={shape.a} onChange={(v) => updateShape(shape.id, { a: v })} />
                  <Field label={`Height (${lengthUnit})`} value={shape.b} onChange={(v) => updateShape(shape.id, { b: v })} />
                </>
              )}
              {shape.type === 'trapezoid' && (
                <>
                  <Field label={`Side A (${lengthUnit})`} value={shape.a} onChange={(v) => updateShape(shape.id, { a: v })} />
                  <Field label={`Side B (${lengthUnit})`} value={shape.b} onChange={(v) => updateShape(shape.id, { b: v })} />
                  <Field label={`Height (${lengthUnit})`} value={shape.c} onChange={(v) => updateShape(shape.id, { c: v })} />
                </>
              )}
              {shape.type === 'circle' && (
                <Field label={`Radius (${lengthUnit})`} value={shape.a} onChange={(v) => updateShape(shape.id, { a: v })} />
              )}

              <div className="col-span-2 sm:col-span-1">
                <p className="text-xs text-slate-500">Area</p>
                <p className="text-lg font-semibold text-slate-900">{shape.result.toFixed(2)} {areaUnit}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={addShape}
        className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-[#FF6B35] hover:text-[#FF6B35]"
      >
        + Add shape
      </button>

      <div className="rounded-xl bg-orange-50/50 border border-orange-100 p-4">
        <p className="text-xs text-slate-500">Total area ({shapes.length} shape{shapes.length !== 1 ? 's' : ''})</p>
        <p className="text-2xl font-bold text-slate-900">{total.toFixed(2)} {areaUnit}</p>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-600">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={0}
        step={0.1}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none"
      />
    </div>
  );
}
