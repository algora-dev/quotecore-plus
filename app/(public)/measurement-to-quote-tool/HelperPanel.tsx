'use client';

import { QcIcon } from '@/app/components/ui/v2/QcIcon';

/**
 * Contextual helper for the guided component editor (owner 2026-10-03).
 * ALWAYS open by default; the user can minimise it (and the test section)
 * independently. The topic follows whichever settings field the user is in,
 * so every step explains itself with an example.
 */
export type HelperTopic = 'intro' | 'name' | 'sku' | 'type' | 'pricing' | 'labour' | 'waste' | 'pitch';

const TIPS: Record<HelperTopic, { title: string; body: string }> = {
  intro: {
    title: 'Build your pricing one item at a time',
    body: 'Work down the left side - name, costs, allowances. This panel explains each section as you go, and the test panel below shows what your settings produce. Nothing is saved until you press Create.',
  },
  name: {
    title: 'Component name',
    body: 'What you and your team will see in lists and reports. Use something you recognise instantly. Examples: "Longrun roofing", "Ridge flashing", "Spouting 125mm".',
  },
  sku: {
    title: 'Product code / SKU',
    body: 'Your own reference code for this item - handy when ordering from suppliers. Optional. Example: CF-0.42-G300.',
  },
  type: {
    title: 'Measurement type',
    body: 'How you measure it on a job: Linear for lengths - ridges, hips, valleys, barges, spouting (per m). Area for surfaces - roof planes, underlay, cladding sheets (per m²). Quantity for counted items - screws, brackets (each).',
  },
  pricing: {
    title: 'Material cost',
    body: 'What you pay your supplier per m, m² or item, before waste. Example: $18.50/m for ridge. Tick "sold in packs" for rolls or packs - the test panel then rounds purchases up to whole packs.',
  },
  labour: {
    title: 'Labour cost',
    body: 'What it costs you to install or provide this, per m, m² or item. Example: $11.00/m to install ridge. Enter 0 if there is no labour on this item.',
  },
  waste: {
    title: 'Waste allowance',
    body: 'Do you need spare material on this? Percentage adds a % to the measurement (e.g. 10% cut waste on sheets). Fixed adds a flat amount per entry or per segment. Leave off when waste does not apply.',
  },
  pitch: {
    title: 'Pitch calculation',
    body: 'Does the quantity change with roof pitch? Use Rafter pitch for roof planes and barges (plan measurement × 1/cos of the pitch). Hip/valley pitch for hips and valleys. Ridge and spouting run level - leave this off.',
  },
};

export function HelperPanel({ topic, minimized, onToggle }: {
  topic: HelperTopic;
  minimized: boolean;
  onToggle: () => void;
}) {
  const tip = TIPS[topic] ?? TIPS.intro;
  return (
    <aside className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3" aria-label="Helper tips" data-topic={topic}>
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
          <QcIcon name="info" className="h-4 w-4 shrink-0 text-[#BD4A1A]" aria-hidden="true" />
          {tip.title}
        </p>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!minimized}
          aria-label={minimized ? 'Show helper' : 'Minimise helper'}
          className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-200/70 hover:text-slate-700"
        >
          <QcIcon name={minimized ? 'expand' : 'collapse'} className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {!minimized && <p className="mt-2 text-xs leading-relaxed text-slate-600">{tip.body}</p>}
    </aside>
  );
}
