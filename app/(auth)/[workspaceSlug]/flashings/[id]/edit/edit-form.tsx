'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Canvas } from 'fabric';
import { updateFlashingWithImage } from '../../actions';
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
  const [imageUrl, setImageUrl] = useState(flashing.image_url);
  
  // Hidden canvas for regeneration
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fabricRef = useRef<Canvas | null>(null);
  
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

  // Initialize hidden canvas from canvas_data
  useEffect(() => {
    if (!canvasRef.current || !flashing.canvas_data) return;
    
    const canvas = new Canvas(canvasRef.current, {
      backgroundColor: '#ffffff', // White background (not gray)
    });
    
    // Load canvas from JSON
    canvas.loadFromJSON(flashing.canvas_data, () => {
      canvas.renderAll();
      console.log('[EditForm] Canvas loaded from JSON');
    });
    
    fabricRef.current = canvas;
    
    return () => {
      canvas.dispose();
    };
  }, [flashing.canvas_data]);

  const handleUpdateMeasurement = (id: string, newValue: number) => {
    setMeasurements(measurements.map(m => 
      m.id === id ? { ...m, value: newValue } : m
    ));
    
    // Update canvas text object
    if (fabricRef.current) {
      const canvas = fabricRef.current;
      const textObj = canvas.getObjects().find((o: any) => 
        o.type === 'i-text' && o.measurementId === id
      );
      
      if (textObj) {
        const measurement = measurements.find(m => m.id === id);
        if (measurement) {
          const newText = measurement.type === 'length' 
            ? `${newValue}mm` 
            : `${newValue}°`;
          (textObj as any).set('text', newText);
          canvas.renderAll();
          
          // Generate new preview
          regeneratePreview();
        }
      }
    }
  };
  
  const regeneratePreview = () => {
    if (!fabricRef.current) return;
    
    const canvas = fabricRef.current;
    
    // Export canvas as data URL
    const dataUrl = canvas.toDataURL({
      format: 'png',
      quality: 1,
      multiplier: 1,
    });
    
    // Update preview image
    setImageUrl(dataUrl);
  };

  const handleSave = async () => {
    if (!fabricRef.current) return;
    
    setSaving(true);
    try {
      const canvas = fabricRef.current;
      
      // Rebuild full measurements array from edited values
      const updatedMeasurements = flashing.measurements?.map(m => {
        const edited = measurements.find(em => em.id === m.id);
        return edited ? { ...m, value: edited.value } : m;
      }) || [];

      // Export updated canvas as PNG
      const dataUrl = canvas.toDataURL({
        format: 'png',
        quality: 1,
        multiplier: 1,
      });

      const response = await fetch(dataUrl);
      const blob = await response.blob();

      // Get updated canvas JSON
      const canvasJSON = JSON.stringify(canvas.toJSON());

      // Build FormData
      const formData = new FormData();
      formData.append('name', name);
      formData.append('description', description || '');
      formData.append('image', blob, 'flashing.png');
      formData.append('canvas_data', canvasJSON);
      formData.append('measurements', JSON.stringify(updatedMeasurements));

      // Update with new image
      await updateFlashingWithImage(flashing.id, formData);

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
      {/* Hidden canvas for regeneration */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      
      {/* Preview */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Preview (Live Updates)</h3>
        <div className="max-w-sm mx-auto aspect-square bg-white rounded-lg flex items-center justify-center overflow-hidden border border-slate-200">
          <Image
            src={imageUrl}
            alt={name}
            width={400}
            height={400}
            className="object-contain"
            key={imageUrl}
          />
        </div>
        <p className="text-xs text-slate-500 mt-2 text-center">
          Image updates automatically as you edit measurements
        </p>
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
