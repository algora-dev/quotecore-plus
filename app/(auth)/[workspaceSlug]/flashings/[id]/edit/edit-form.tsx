'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateFlashing } from '../../actions';
import type { FlashingLibraryRow } from '@/app/lib/types';
import Image from 'next/image';

interface Props {
  flashing: FlashingLibraryRow;
  workspaceSlug: string;
}

interface MeasurementData {
  id: string;
  type: 'length' | 'angle';
  value: number;
}

export function EditFlashingForm({ flashing, workspaceSlug }: Props) {
  const router = useRouter();
  const [name, setName] = useState(flashing.name);
  const [description, setDescription] = useState(flashing.description || '');
  const [saving, setSaving] = useState(false);
  
  // Load measurements from clean measurements column
  const [measurements, setMeasurements] = useState<MeasurementData[]>(() => {
    // Use new measurements column (clean data)
    if (flashing.measurements && Array.isArray(flashing.measurements)) {
      console.log('[EditForm] Loading from measurements column:', flashing.measurements.length);
      return flashing.measurements.map(m => ({
        id: m.id,
        type: m.type,
        value: m.value,
      }));
    }
    
    console.log('[EditForm] No measurements found');
    return [];
  });

  const handleUpdateMeasurement = (id: string, newValue: number) => {
    setMeasurements(measurements.map(m => 
      m.id === id ? { ...m, value: newValue } : m
    ));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Rebuild full measurements array from edited values
      const updatedMeasurements = flashing.measurements?.map(m => {
        const edited = measurements.find(em => em.id === m.id);
        return edited ? { ...m, value: edited.value } : m;
      }) || [];

      // Also update canvas_data text objects to match
      let updatedCanvasData = flashing.canvas_data;
      
      if (updatedCanvasData && measurements.length > 0) {
        const canvasData = typeof updatedCanvasData === 'string'
          ? JSON.parse(updatedCanvasData)
          : updatedCanvasData;
        
        if (canvasData.objects) {
          canvasData.objects.forEach((obj: any) => {
            if (obj.measurementId && obj.type === 'i-text') {
              const measurement = measurements.find(m => m.id === obj.measurementId);
              if (measurement) {
                obj.text = measurement.type === 'length' 
                  ? `${measurement.value}mm`
                  : `${measurement.value}°`;
              }
            }
          });
        }
        
        updatedCanvasData = JSON.stringify(canvasData);
      }

      // Update both measurements column AND canvas_data (keep in sync)
      await updateFlashing(flashing.id, {
        name,
        description: description || null,
        measurements: updatedMeasurements,
        canvas_data: updatedCanvasData,
      });

      router.push(`/${workspaceSlug}/flashings`);
    } catch (err: any) {
      console.error('Failed to update flashing:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Preview */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Preview</h3>
        <div className="max-w-sm mx-auto aspect-square bg-slate-100 rounded-lg flex items-center justify-center overflow-hidden">
          <Image
            src={flashing.image_url}
            alt={name}
            width={400}
            height={400}
            className="object-contain"
          />
        </div>
      </div>

      {/* Basic Details */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Details</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Custom Ridge Cap"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black"
            />
          </div>
        </div>
      </div>

      {/* Measurements */}
      {measurements.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">
            Measurements ({measurements.length})
          </h3>
          <p className="text-xs text-slate-600 mb-3">
            Update measurement values. These changes will apply to the saved image data.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {measurements.map((m, index) => (
              <div key={m.id} className="border border-slate-200 rounded-lg p-3">
                <label className="block text-xs text-slate-600 mb-1">
                  {m.type === 'length' ? 'Length' : 'Angle'} #{index + 1}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={m.value}
                    onChange={(e) => handleUpdateMeasurement(m.id, parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-black focus:border-black"
                  />
                  <span className="text-sm text-slate-600">
                    {m.type === 'length' ? 'mm' : '°'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex gap-3 justify-end">
        <button
          onClick={() => router.push(`/${workspaceSlug}/flashings`)}
          className="px-4 py-2 text-sm font-medium border border-slate-300 rounded-full hover:bg-slate-50 transition-all shadow-sm"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="px-4 py-2 text-sm font-medium bg-black text-white rounded-full hover:bg-slate-800 transition-all shadow-sm disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
