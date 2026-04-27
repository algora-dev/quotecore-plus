'use client';

import { useState } from 'react';
import { useCopilot } from '@/app/components/copilot/CopilotProvider';
import { COPILOT_GUIDES } from '@/app/components/copilot/guides';

export function CopilotSettings() {
  const { state, setVisible, resetGuides } = useCopilot();
  const [showResetModal, setShowResetModal] = useState(false);

  const completedCount = state.guidesCompleted.length;
  const totalGuides = COPILOT_GUIDES.length;

  return (
    <div className="space-y-4">
      {/* Master Toggle */}
      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
        <div>
          <p className="text-sm font-medium text-slate-900">Show Copilot</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {state.visible
              ? 'Copilot toggle is visible in the navigation bar'
              : 'Copilot is hidden from the navigation bar'}
          </p>
        </div>
        <button
          onClick={() => setVisible(!state.visible)}
          className={`relative w-11 h-6 rounded-full transition-colors ${state.visible ? 'bg-orange-500' : 'bg-slate-300'}`}
        >
          <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${state.visible ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>

      {/* Progress */}
      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
        <div>
          <p className="text-sm font-medium text-slate-900">Tutorial Progress</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {completedCount} of {totalGuides} guides completed
          </p>
        </div>
        <button
          onClick={() => setShowResetModal(true)}
          className="px-3 py-1.5 text-xs font-medium rounded-full border border-slate-300 hover:bg-slate-100 transition"
        >
          Reset All
        </button>
      </div>

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm mx-4 shadow-xl space-y-4">
            <h3 className="text-base font-semibold text-slate-900">Reset All Tutorials</h3>
            <p className="text-sm text-slate-600">Reset all completed tutorials? You will see the guides again on each page.</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  resetGuides();
                  setShowResetModal(false);
                }}
                className="px-4 py-2 text-sm font-medium rounded-full bg-black text-white hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
