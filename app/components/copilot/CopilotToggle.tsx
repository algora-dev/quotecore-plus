'use client';

import { useState } from 'react';
import { useCopilot } from './CopilotProvider';
import { COPILOT_GUIDES } from './guides';

export function CopilotToggle() {
  const { state, toggle, startGuide } = useCopilot();
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="relative flex items-center gap-2">
      {/* Toggle switch */}
      <button
        onClick={() => {
          if (state.enabled) {
            toggle();
          } else {
            setShowMenu(true);
          }
        }}
        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition"
        title={state.enabled ? 'Turn off Copilot' : 'Turn on Copilot'}
      >
        <div className={`relative w-8 h-4 rounded-full transition-colors ${state.enabled ? 'bg-orange-500' : 'bg-slate-300'}`}>
          <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${state.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
        </div>
        <span className="hidden sm:inline">Copilot</span>
      </button>

      {/* Guide selector dropdown */}
      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 w-64 rounded-xl border border-slate-200 bg-white py-2 shadow-lg">
            <div className="px-3 py-1.5 border-b border-slate-100">
              <p className="text-xs font-semibold text-slate-900">Choose a guide</p>
            </div>
            {COPILOT_GUIDES.map(guide => {
              const isCompleted = state.guidesCompleted.includes(guide.id);
              return (
                <button
                  key={guide.id}
                  onClick={() => {
                    startGuide(guide.id);
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 transition"
                >
                  <div className="flex items-center gap-2">
                    {isCompleted ? (
                      <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-slate-300 flex-shrink-0" />
                    )}
                    <div>
                      <p className="text-xs font-medium text-slate-900">{guide.name}</p>
                      <p className="text-[10px] text-slate-400">{guide.steps.length} steps</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
