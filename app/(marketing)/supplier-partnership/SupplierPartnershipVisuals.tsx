interface VideoPlaceholderProps {
  eyebrow: string;
  title: string;
  description: string;
  duration: string;
  compact?: boolean;
}

function MiniCheck() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

export function VideoPlaceholder({ eyebrow, title, description, duration, compact = false }: VideoPlaceholderProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-[0_28px_80px_rgba(15,23,42,0.18)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_18%,rgba(255,107,53,0.34),transparent_28%),radial-gradient(circle_at_18%_84%,rgba(255,255,255,0.10),transparent_34%)]" />
      <div className={`relative flex aspect-video flex-col justify-between ${compact ? "p-5 sm:p-6" : "p-6 sm:p-8"}`}>
        <div className="flex items-center justify-between gap-4">
          <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80 backdrop-blur-sm">{eyebrow}</span>
          <span className="text-xs font-medium text-white/70">{duration}</span>
        </div>
        <div className="flex items-center justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-black/45 shadow-[0_0_30px_rgba(255,107,53,0.24)] backdrop-blur-md">
            <svg viewBox="0 0 24 24" className="h-7 w-7 fill-white" aria-hidden="true"><path d="M8 5.14v13.72c0 .78.84 1.26 1.5.86l10-6.86a1 1 0 000-1.72l-10-6.86A1 1 0 008 5.14z" /></svg>
          </div>
        </div>
        <div className="max-w-md">
          <p className={`${compact ? "text-base" : "text-lg sm:text-xl"} font-semibold text-white`}>{title}</p>
          <p className="mt-1 text-xs leading-5 text-white/70 sm:text-sm">{description}</p>
        </div>
      </div>
    </div>
  );
}

export function QuoteCoreIntegrationVisual() {
  const products = [
    ["Concrete roof tile", "£1.24", "bg-orange-100"],
    ["Dry ridge system", "£8.60", "bg-slate-100"],
    ["Breathable membrane", "£54.00", "bg-amber-50"],
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950 p-3 shadow-[0_18px_45px_rgba(15,23,42,0.14)] sm:p-4">
      <div className="flex items-center gap-1.5 border-b border-white/10 pb-3">
        <span className="h-2 w-2 rounded-full bg-[#FF6B35]" /><span className="h-2 w-2 rounded-full bg-white/20" /><span className="h-2 w-2 rounded-full bg-white/20" />
        <span className="ml-2 text-[9px] font-medium uppercase tracking-[0.16em] text-white/70">Supplier workspace</span>
      </div>
      <div className="mt-3 grid grid-cols-[0.8fr_1.2fr] gap-3">
        <div className="space-y-2 rounded-lg bg-white/5 p-3">
          <div className="h-2 w-16 rounded-full bg-white/15" />
          {["Catalogues", "Products", "Pricing", "Enquiries"].map((item, index) => (
            <div key={item} className={`rounded-md px-2 py-1.5 text-[9px] font-medium ${index === 1 ? "bg-[#BD4A1A] text-white" : "text-white/70"}`}>{item}</div>
          ))}
        </div>
        <div className="rounded-lg bg-white p-3">
          <div className="flex items-center justify-between gap-2">
            <div><p className="text-[9px] font-semibold text-slate-900">Your product library</p><p className="text-[7px] text-slate-600">Ready for contractor quotes</p></div>
            <span className="rounded-full bg-emerald-50 px-2 py-1 text-[7px] font-semibold text-emerald-700">Live</span>
          </div>
          <div className="mt-3 space-y-2">
            {products.map(([name, price, colour]) => (
              <div key={name} className="flex items-center gap-2 rounded-md border border-slate-100 p-2">
                <div className={`h-7 w-7 rounded-md ${colour}`} />
                <div className="min-w-0 flex-1"><p className="truncate text-[8px] font-semibold text-slate-700">{name}</p><div className="mt-1 h-1 w-12 rounded-full bg-slate-100" /></div>
                <span className="text-[8px] font-semibold text-slate-700">{price}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PublicPricingToolVisual() {
  const roofDetails = [["Area", "140 m²"], ["Pitch", "35°"], ["System", "Tile"], ["Region", "North West"]];

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.10)]">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2"><div className="flex h-7 w-7 items-center justify-center rounded-full bg-black text-[9px] font-bold text-white">S</div><div><p className="text-[9px] font-semibold text-slate-900">Supplier pricing tool</p><p className="text-[7px] text-slate-600">Powered by QuoteCore+</p></div></div>
        <span className="rounded-full bg-orange-50 px-2 py-1 text-[7px] font-semibold text-[#BD4A1A]">Your products</span>
      </div>
      <div className="grid grid-cols-[1.1fr_0.9fr] gap-3 p-4">
        <div>
          <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-600">Roof details</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {roofDetails.map(([label, value]) => <div key={label} className="rounded-md border border-slate-200 p-2"><p className="text-[7px] text-slate-600">{label}</p><p className="mt-1 text-[9px] font-semibold text-slate-700">{value}</p></div>)}
          </div>
          <div className="mt-3 h-6 rounded-full bg-black" />
        </div>
        <div className="rounded-lg bg-slate-950 p-3 text-white">
          <p className="text-[7px] uppercase tracking-[0.14em] text-white/70">Preliminary total</p><p className="mt-1 text-lg font-semibold">£4,860</p>
          <div className="mt-3 space-y-1.5 text-[7px] text-white/55"><div className="flex justify-between"><span>Tiles</span><span>£2,410</span></div><div className="flex justify-between"><span>Accessories</span><span>£1,120</span></div><div className="flex justify-between"><span>Delivery</span><span>Calculated</span></div></div>
          <div className="mt-3 flex items-center gap-1.5 text-[7px] font-semibold text-orange-300"><MiniCheck /> Send enquiry to supplier</div>
        </div>
      </div>
    </div>
  );
}

export function CatalogueOutcomeVisual() {
  const stages = [
    ["Your catalogue", "Products and pricing"],
    ["QuoteCore+", "Structured once"],
    ["Buyer tools", "Quotes and enquiries"],
  ];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-[linear-gradient(135deg,#fff_0%,#fff8f4_100%)] p-5 sm:p-7">
      <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-[#FF6B35]/10 blur-3xl" />
      <div className="relative grid gap-3 sm:grid-cols-3 sm:items-center">
        {stages.map(([label, detail], index) => (
          <div key={label} className="relative">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-50 text-sm font-semibold text-[#BD4A1A]">0{index + 1}</div>
              <p className="mt-4 text-sm font-semibold text-slate-900">{label}</p>
              <p className="mt-1 text-xs text-slate-500">{detail}</p>
            </div>
            {index < stages.length - 1 && (
              <div className="absolute -bottom-3 left-1/2 z-10 flex h-6 w-6 -translate-x-1/2 rotate-90 items-center justify-center rounded-full border border-orange-200 bg-white text-[#BD4A1A] sm:-right-3 sm:bottom-auto sm:left-auto sm:top-1/2 sm:-translate-y-1/2 sm:translate-x-0 sm:rotate-0" aria-hidden="true">→</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardVisual() {
  const summary = [["Tool uses", "1,284"], ["Enquiries", "86"], ["Avg. value", "£4.7k"]];
  const bars = [38, 52, 44, 68, 58, 82, 72, 92];
  const products = [["Tile", 48], ["Metal", 31], ["Membrane", 21]] as const;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 p-4 shadow-[0_30px_90px_rgba(15,23,42,0.28)] sm:p-5">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div><p className="text-xs font-semibold text-white">Supplier performance</p><p className="mt-1 text-[10px] text-white/70">Example reporting view</p></div>
        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[9px] font-semibold text-emerald-300">Live data</span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {summary.map(([label, value]) => <div key={label} className="rounded-lg bg-white/5 p-3"><p className="text-[8px] text-white/70">{label}</p><p className="mt-1 text-sm font-semibold text-white">{value}</p></div>)}
      </div>
      <div className="mt-3 grid grid-cols-[1.35fr_0.65fr] gap-3">
        <div className="rounded-lg bg-white p-3">
          <div className="flex h-24 items-end gap-2">{bars.map((height, index) => <div key={`${height}-${index}`} className="flex-1 rounded-t bg-[#FF6B35]/80" style={{ height: `${height}%` }} />)}</div>
          <div className="mt-2 h-1 w-20 rounded-full bg-slate-100" />
        </div>
        <div className="space-y-2 rounded-lg bg-white/5 p-3">
          {products.map(([label, percentage]) => (
            <div key={label}>
              <div className="flex justify-between text-[8px] text-white/55"><span>{label}</span><span>{percentage}%</span></div>
              <div className="mt-1 h-1 rounded-full bg-white/10"><div className="h-1 rounded-full bg-orange-300" style={{ width: `${percentage}%` }} /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
