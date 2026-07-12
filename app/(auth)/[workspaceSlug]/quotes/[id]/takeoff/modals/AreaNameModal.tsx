'use client';
import { useState } from 'react';
import { PitchInput } from '@/app/components/PitchInput';

export function AreaNameModal({
  isRoofing,
  modalTitle,
  namePlaceholder,
  componentName,
  calculatedArea,
  unit,
  onSave,
  onCancel,
  initialName = '',
}: {
  isRoofing: boolean;
  modalTitle?: string;
  namePlaceholder?: string;
  componentName: string | null;
  calculatedArea: number;
  unit: string;
  onSave: (name: string, pitch?: number) => void;
  onCancel: () => void;
  /** Pre-fill the area name (used in new-page mode where the user already named the area). */
  initialName?: string;
}) {
  const [name, setName] = useState(initialName);
  const [pitchDegrees, setPitchDegrees] = useState<number | null>(null);

  // P1-1b: when initialName is pre-filled (new-page mode), name is locked -
  // only pitch is needed from the user.
  const nameIsLocked = initialName !== '';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (componentName) {
      // Component area - no pitch needed
      onSave('');
    } else if (isRoofing) {
      // Roof area - require pitch; name comes from pre-fill or input
      const effectiveName = nameIsLocked ? initialName : name.trim();
      if (effectiveName && (pitchDegrees != null || nameIsLocked)) {
        onSave(effectiveName, pitchDegrees ?? 0);
      }
    } else {
      // Generic area - name only, pitch=0 (flat)
      const effectiveName = nameIsLocked ? initialName : name.trim();
      if (effectiveName) {
        onSave(effectiveName, 0);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 border border-gray-200">
        <h2 className="text-xl font-semibold mb-4">
          {componentName ? 'Add Area to Component' : (modalTitle ?? (isRoofing ? 'Create Roof Area' : 'Create Area'))}
        </h2>
        
        {componentName && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-300 rounded-lg-lg">
            <div className="text-sm text-gray-600 mb-1">Component:</div>
            <div className="font-semibold">{componentName}</div>
            <div className="text-2xl font-bold text-blue-400 mt-2">
              {calculatedArea.toFixed(2)} sq {unit}
            </div>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {!componentName && (
            <>
              {nameIsLocked ? (
                // P1-1b new-page mode: name already set, show read-only.
                <div>
                  <label className="block text-sm mb-1 text-gray-500">Area</label>
                  <p className="px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm font-medium text-slate-800">{initialName}</p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm mb-2">Area Name <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded"
                    placeholder={namePlaceholder ?? (isRoofing ? 'e.g. Main Roof' : 'e.g. North Wall')}
                    autoFocus
                    required
                  />
                </div>
              )}
              {isRoofing && (
                <>
                  <PitchInput
                    degrees={pitchDegrees}
                    onSave={setPitchDegrees}
                    label="Roof Pitch"
                    required={!nameIsLocked}
                    autoFocus={nameIsLocked}
                    className="block"
                  />
                  <p className="text-xs text-gray-600 -mt-2">
                    Used to calculate component lengths (rafters, hips, valleys)
                  </p>
                  <div className="p-3 bg-gray-50 border border-orange-400 rounded-lg">
                    <p className="text-xs text-gray-900 font-medium">
                      Plan Area: {calculatedArea.toFixed(2)} sq {unit} (before pitch adjustment)
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      This pitch will be used for all components in this area
                    </p>
                  </div>
                </>
              )}
              {!isRoofing && (
                <div className="p-3 bg-gray-50 border border-gray-300 rounded-lg">
                  <p className="text-xs text-gray-900 font-medium">
                    Area: {calculatedArea.toFixed(2)} sq {unit}
                  </p>
                </div>
              )}
            </>
          )}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 bg-white border-2 border-slate-300 rounded-full pill-shimmer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-black text-white rounded-full hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
              disabled={!componentName && !nameIsLocked && (!name.trim() || (isRoofing && pitchDegrees == null))}
            >
              {componentName ? 'Add to Component' : isRoofing ? 'Create Roof Area' : 'Create Area'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Point Measurement Modal
