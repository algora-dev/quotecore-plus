'use client';

import { useCopilot } from './CopilotProvider';

export function CopilotToggle() {
  const { state, toggle } = useCopilot();

  if (!state.visible) return null;

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition"
      title="Copilot helps you learn each step"
    >
      <div className={`relative w-8 h-4 rounded-full transition-colors ${state.enabled ? 'bg-orange-500' : 'bg-slate-300'}`}>
        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${state.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </div>
      <span className="hidden sm:inline">Copilot</span>
    </button>
  );
}
