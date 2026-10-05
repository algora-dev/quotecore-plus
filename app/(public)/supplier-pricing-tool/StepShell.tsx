// Google-form style step shell - progress bar, step container.

'use client';

import type { ReactNode } from 'react';

export interface StepDef {
  key: string;
  label: string;
}

export function StepProgress({ steps, current }: { steps: StepDef[]; current: number }) {
  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-5xl px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <span className="whitespace-nowrap text-sm font-semibold text-slate-900">
            Step {current} of {steps.length}
          </span>
          <span className="truncate text-xs text-slate-500">{steps[current - 1]?.label}</span>
        </div>
        <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-black transition-all duration-300"
            style={{ width: `${(current / steps.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function StepCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white hover:border-blue-200 hover:shadow-[0_0_8px_rgba(37,99,235,0.08)] transition">
      <div className="p-4 md:p-6">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
