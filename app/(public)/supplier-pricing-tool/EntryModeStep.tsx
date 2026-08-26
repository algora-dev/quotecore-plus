// Step 1: How do you want to price this job? (Google-form style choice cards)

'use client';

import type { EntryMode, HaveSubMode } from './types';

export function EntryModeStep({
  entryMode, setEntryMode, haveSubMode, setHaveSubMode, onNext,
}: {
  entryMode: EntryMode | null;
  setEntryMode: (m: EntryMode) => void;
  haveSubMode: HaveSubMode | null;
  setHaveSubMode: (m: HaveSubMode | null) => void;
  onNext: () => void;
}) {
  const canNext = entryMode === 'measure' || (entryMode === 'have' && haveSubMode !== null);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] transition p-4 md:p-6">
        <h2 className="text-lg font-semibold text-slate-900">How do you want to price this job?</h2>
        <p className="mt-1 text-sm text-slate-500">You can measure from a plan, or enter measurements you already have.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <ChoiceCard
            selected={entryMode === 'measure'}
            title="I need to measure a plan"
            desc="Upload a plan and measure roof areas and lines with our digital takeoff tool."
            onClick={() => { setEntryMode('measure'); setHaveSubMode(null); }}
          />
          <ChoiceCard
            selected={entryMode === 'have'}
            title="I already have my measurements"
            desc="Enter your measurements manually - areas and lineal measurements you've taken."
            onClick={() => setEntryMode('have')}
          />
        </div>
      </div>

      {entryMode === 'have' && (
        <div className="rounded-xl border border-slate-200 bg-white hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] transition p-4 md:p-6">
          <h3 className="text-base font-semibold text-slate-900">What kind of measurements do you have?</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <ChoiceCard
              selected={haveSubMode === 'plan'}
              title="Plan measurements"
              desc="Measurements off a plan. We'll convert them using the roof pitch."
              onClick={() => setHaveSubMode('plan')}
            />
            <ChoiceCard
              selected={haveSubMode === 'actual'}
              title="Actual / site measurements"
              desc="Real-world measurements taken on site. No conversion needed."
              onClick={() => setHaveSubMode('actual')}
            />
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={onNext}
          disabled={!canNext}
          className="rounded-full bg-black px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)] disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function ChoiceCard({ title, desc, selected, onClick }: { title: string; desc: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-xl border px-4 py-4 transition cursor-pointer ${selected ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900' : 'border-slate-200 bg-white hover:border-orange-200 hover:bg-orange-50/40'}`}
    >
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 h-4 w-4 flex-shrink-0 rounded-full border-2 flex items-center justify-center ${selected ? 'border-slate-900' : 'border-slate-300'}`}>
          {selected && <span className="h-2 w-2 rounded-full bg-slate-900" />}
        </span>
        <div>
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          <div className="mt-0.5 text-xs text-slate-500">{desc}</div>
        </div>
      </div>
    </button>
  );
}
