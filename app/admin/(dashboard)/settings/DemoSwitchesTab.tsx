'use client';

import { useState, useTransition } from 'react';
import { setDemoSwitch, type DemoControlData } from './actions';

/**
 * Guided Walkthrough master switches (relocated from the removed /admin/demo
 * control room, owner 2026-11-02). Emergency brakes: no deploy needed,
 * effective on the next server read of demo_control row 1.
 */
export function DemoSwitchesTab({ initial }: { initial: DemoControlData }) {
  const [demoEnabled, setDemoEnabled] = useState(initial.demoEnabled);
  const [aiEnabled, setAiEnabled] = useState(initial.aiEnabled);
  const [note, setNote] = useState('');
  const [pending, start] = useTransition();

  const flip = (field: 'demo_enabled' | 'ai_enabled', value: boolean) => {
    start(async () => {
      try {
        await setDemoSwitch(field, value);
        if (field === 'demo_enabled') setDemoEnabled(value);
        else setAiEnabled(value);
        setNote('Saved - effective on the next request.');
      } catch (e) {
        setNote(e instanceof Error ? e.message : 'Update failed.');
      }
    });
  };

  const row = (label: string, description: string, value: boolean, onFlip: (v: boolean) => void) => (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-900">{label}</p>
        <p className="mt-0.5 text-xs text-slate-500">{description}</p>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() => onFlip(!value)}
        className={`flex-shrink-0 inline-flex items-center justify-center min-h-11 px-4 text-xs font-semibold rounded-xl border transition ${
          value
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
            : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
        }`}
        aria-pressed={value}
      >
        {value ? 'On' : 'Off'}
      </button>
    </div>
  );

  return (
    <div className="space-y-3">
      {row('Guided Walkthrough enabled', 'Master switch for /demo entry and sandbox provisioning.', demoEnabled, v => flip('demo_enabled', v))}
      {row('Walkthrough AI enabled', 'Smart Assistant + AI features inside the sandbox.', aiEnabled, v => flip('ai_enabled', v))}
      <p className="text-xs text-slate-400">
        {initial.updatedAt ? `Last updated ${new Date(initial.updatedAt).toLocaleString('en-GB')}. ` : ''}
        {note || 'Changes take effect on the next request - no deploy needed.'}
      </p>
    </div>
  );
}
