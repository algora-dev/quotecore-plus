'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Canvas } from 'fabric';
import { updateFlashingWithImage } from '../../actions';
import type { FlashingLibraryRow } from '@/app/lib/types';
import Image from 'next/image';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { QcJourney } from '@/app/components/ui/v2/QcJourney';

interface Props {
  flashing: FlashingLibraryRow;
  workspaceSlug: string;
}

interface MeasurementData {
  id: string;
  type: 'length' | 'angle';
  value: number;
  /** Stored unit at the time the flashing was drawn (e.g. 'mm', 'in',
   *  'degrees'). Optional for legacy rows that pre-date imperial
   *  support; render fallback handles undefined. */
  unit?: 'mm' | 'ft' | 'in' | 'degrees';
}

export function EditFlashingForm({ flashing, workspaceSlug }: Props) {
  const router = useRouter();
  const [name, setName] = useState(flashing.name);
  const [description, setDescription] = useState(flashing.description || '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
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
  
  // Regenerate preview function
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

  // Initialize hidden canvas from canvas_data
  useEffect(() => {
    if (!canvasRef.current || !flashing.canvas_data) return;
    
    // Get dimensions from saved canvas data
    const canvasData = typeof flashing.canvas_data === 'string'
      ? JSON.parse(flashing.canvas_data)
      : flashing.canvas_data;
    
    const width = canvasData.width || 800;
    const height = canvasData.height || 600;
    
    console.log('[EditForm] Creating canvas:', width, 'x', height);
    
    const canvas = new Canvas(canvasRef.current, {
      width,
      height,
      backgroundColor: '#ffffff', // White background (not gray)
    });
    
    // Load canvas from JSON
    canvas.loadFromJSON(canvasData, () => {
      canvas.renderAll();
      console.log('[EditForm] Canvas loaded from JSON');
      
      // Generate initial preview after a short delay to ensure render complete
      setTimeout(regeneratePreview, 100);
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

  const handleSave = async () => {
    if (!fabricRef.current) return;
    
    setSaveError(null);
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

      router.push(`/${workspaceSlug}/drawings`);
    } catch (err: any) {
      console.error('Failed to update flashing:', err);
      setSaveError('The drawing could not be saved. Keep this page open and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <QcJourney className="space-y-6">
      {saveError && <p role="alert" className="qc-flow-error">{saveError}</p>}
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
            <label htmlFor="drawing-edit-name" className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
            <input
              id="drawing-edit-name" type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Custom Ridge Cap"
              className="qc-input w-full"
            />
          </div>
          <div>
            <label htmlFor="drawing-edit-description" className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <input
              id="drawing-edit-description" type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="qc-input w-full"
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {measurements.map((m, index) => (
              <div key={m.id} className="border border-slate-200 rounded-lg p-3">
                <label htmlFor={`drawing-edit-measurement-${m.id}`} className="block text-xs text-slate-600 mb-1">
                  {m.type === 'length' ? 'Length' : 'Angle'} #{index + 1}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id={`drawing-edit-measurement-${m.id}`} type="number"
                    value={m.value}
                    onChange={(e) => handleUpdateMeasurement(m.id, parseFloat(e.target.value) || 0)}
                    className="qc-input w-full"
                  />
                  <span className="text-sm text-slate-600">
                    {/* Render the stored unit on the measurement (set at
                        creation based on the company's measurement
                        system). Falls back to 'mm' / '°' for legacy rows
                        that pre-date the imperial support. */}
                    {m.type === 'length' ? (m.unit ?? 'mm') : '°'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap gap-3 justify-end">
        <QcButton
          onClick={() => router.push(`/${workspaceSlug}/drawings`)}
          disabled={saving}
        >
          Cancel
        </QcButton>
        <QcButton
          onClick={handleSave}
          disabled={saving || !name.trim()}
          variant="primary" pending={saving}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </QcButton>
      </div>
    </QcJourney>
  );
}
