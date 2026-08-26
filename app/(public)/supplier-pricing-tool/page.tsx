import { PortalFlow } from './PortalFlow';

// Supplier Pricing Tool demo - standalone demo flow living in the main app
// under /supplier-pricing-tool. NOT linked from public nav until Shaun approves.
export default function Page() {
  return (
    <main className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white">R</span>
            <div>
              <div className="text-sm font-semibold text-slate-900">Roofline Supplies</div>
              <div className="text-xs text-slate-400">Roofing materials, priced fast</div>
            </div>
          </div>
          <span className="text-xs text-slate-400">Powered by QuoteCore+</span>
        </div>
      </header>
      <PortalFlow />
    </main>
  );
}
