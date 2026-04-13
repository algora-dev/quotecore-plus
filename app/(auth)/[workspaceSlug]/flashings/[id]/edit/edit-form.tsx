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
  
  // Parse canvas_data to extract measurements
  const [measurements, setMeasurements] = useState<MeasurementData[]>(() => {
    if (!flashing.canvas_data) {
      console.log('[EditForm] No canvas_data found');
      return [];
    }
    
    try {
      const canvasData = typeof flashing.canvas_data === 'string' 
        ? JSON.parse(flashing.canvas_data)
        : flashing.canvas_data;
      
      console.log('[EditForm] Canvas data:', canvasData);
      console.log('[EditForm] Objects count:', canvasData.objects?.length || 0);
      
      // Extract measurements from canvas objects
      const extracted: MeasurementData[] = [];
      
      if (canvasData.objects) {
        canvasData.objects.forEach((obj: any, index: number) => {
          console.log(`[EditForm] Object ${index}:`, {
            type: obj.type,
            measurementId: obj.measurementId,
            text: obj.text,
          });
          
          if (obj.measurementId && obj.type === 'i-text' && obj.text) {
            // Parse text like "125mm" or "90°"
            const text = obj.text.toString();
            
            if (text.endsWith('mm')) {
              // Length measurement
              const value = parseFloat(text.replace('mm', ''));
              if (!isNaN(value)) {
                console.log('[EditForm] Found length:', value);
                extracted.push({
                  id: obj.measurementId,
                  type: 'length',
                  value,
                });
              }
            } else if (text.endsWith('°')) {
              // Angle measurement
              const value = parseFloat(text.replace('°', ''));
              if (!isNaN(value)) {
                console.log('[EditForm] Found angle:', value);
                extracted.push({
                  id: obj.measurementId,
                  type: 'angle',
                  value,
                });
              }
            }
          }
        });
      }
      
      console.log('[EditForm] Total extracted measurements:', extracted.length);
      return extracted;
    } catch (err) {
      console.error('[EditForm] Failed to parse canvas_data:', err);
      return [];
    }
  });

  const handleUpdateMeasurement = (id: string, newValue: number) => {
    setMeasurements(measurements.map(m => 
      m.id === id ? { ...m, value: newValue } : m
    ));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Update canvas_data with new measurement values
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

      // Update flashing
      await updateFlashing(flashing.id, {
        name,
        description: description || null,
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
