// Supply-mode choice (Step 0b): does the user want materials only
// (supply) or materials + installation labour (supply + install)?
// Shown at the start of the flow when the supplier config enables
// features.pricingMode. Labour rates stay on the applied products -
// includeLabour=false simply zeroes them out of the pricing engines,
// so switching back re-exposes them.

'use client';

export type PricingMode = 'supply' | 'supplyInstall';

export function includeLabourFor(mode: PricingMode | null | undefined): boolean {
  return mode !== 'supply';
}

export function PricingModeChoice({
  pricingMode, setPricingMode,
}: {
  pricingMode: PricingMode | null;
  setPricingMode: (m: PricingMode) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white hover:border-blue-200 hover:shadow-[0_0_8px_rgba(37,99,235,0.08)] transition p-4 md:p-6">
      <h3 className="text-base font-semibold text-slate-900">What pricing do you want?</h3>
      <p className="mt-1 text-sm text-slate-500">
        Materials only (supply), or materials with installation included (supply + install).
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <ChoiceCard
          selected={pricingMode === 'supply'}
          title="Supply only"
          desc="Material prices only - no installation labour."
          onClick={() => setPricingMode('supply')}
        />
        <ChoiceCard
          selected={pricingMode === 'supplyInstall'}
          title="Supply + install"
          desc="Materials plus installation labour in the pricing."
          onClick={() => setPricingMode('supplyInstall')}
        />
      </div>
    </div>
  );
}

function ChoiceCard({ title, desc, selected, onClick }: { title: string; desc: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-xl border px-4 py-4 transition cursor-pointer ${selected ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900' : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/40'}`}
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

/** Small chip shown on the output so the pricing basis is always clear. */
export function PricingModeChip({ mode }: { mode: PricingMode | null }) {
  return (
    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
      {mode === 'supply' ? 'Supply only - materials' : 'Supply + install'}
    </span>
  );
}
