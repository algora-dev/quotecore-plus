'use client';
// Calibration entry chooser (spec 4.1): appears once per page-load when the plan
// is loaded, the AI calibration flag is on and the page is not yet calibrated.
// Two deliberate choices only - AI never starts automatically.
import type { CalibrationImageDescriptor } from '@/app/lib/takeoff/calibrationTypes';

export function CalibrationChooser({
  image,
  title,
  description,
  onChooseAi,
  onChooseManual,
  onClose,
}: {
  image: CalibrationImageDescriptor;
  /** Optional copy overrides (6.1: the toolbar Recalibrate entry reuses this
   *  popup with recalibration copy). */
  title?: string;
  description?: string;
  onChooseAi: () => void;
  onChooseManual: () => void;
  onClose: () => void;
}) {
  void image; // descriptor available for future guidance copy (dimensions etc.)
  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl">
        <h3 className="text-lg font-semibold text-slate-900">{title ?? 'Calibrate this plan'}</h3>
        <p className="text-sm text-slate-500 mt-2">
          {description ??
            'Choose a clear, long dimension or scale bar. AI will suggest up to three measurements. Check the marker positions and distance; one correct measurement is enough.'}
        </p>
        <div className="mt-5 grid gap-3">
          <button
            type="button"
            onClick={onChooseAi}
            className="block w-full text-left p-5 bg-white border-2 border-slate-200 rounded-xl hover:border-[#FF6B35] hover:shadow-lg transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-orange-50 group-hover:bg-orange-100 transition-colors">
                <svg className="w-6 h-6 text-[#FF6B35]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              </div>
              <div>
                <div className="font-semibold text-slate-900">Find measurements with AI</div>
                <div className="text-sm text-slate-500">Suggests up to 3 dimensions to check and confirm</div>
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={onChooseManual}
            className="block w-full text-left p-5 bg-white border-2 border-slate-200 rounded-xl hover:border-[#FF6B35] hover:shadow-lg transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-orange-50 group-hover:bg-orange-100 transition-colors">
                <svg className="w-6 h-6 text-[#FF6B35]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.5 19.5l15-15m0 0V8.25m0-3.75H15" />
                </svg>
              </div>
              <div>
                <div className="font-semibold text-slate-900">Calibrate manually</div>
                <div className="text-sm text-slate-500">Click two points on a known measurement</div>
              </div>
            </div>
          </button>
        </div>
        <div className="flex justify-end mt-5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50 transition"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
