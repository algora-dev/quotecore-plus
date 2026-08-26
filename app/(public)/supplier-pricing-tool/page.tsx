'use client';

import { PortalFlow } from './PortalFlow';
import { FreeToolsAuthProvider, useFreeToolsAuth } from '../_components/FreeToolsAuthProvider';
import { useSupplierConfig } from './supplierConfig';

// Supplier Pricing Tool demo - standalone demo flow living in the main app
// under /supplier-pricing-tool. NOT linked from public nav until Shaun approves.

function Header() {
  const { config } = useSupplierConfig();
  const { user, openAuthModal, signOut } = useFreeToolsAuth();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white">
            {config.name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <div className="text-sm font-semibold text-slate-900">{config.name}</div>
            <div className="text-xs text-slate-400">{config.tagline}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {config.poweredBy && <span className="text-xs text-slate-400">Powered by QuoteCore+</span>}
          {user ? (
            <button
              onClick={() => void signOut()}
              className="rounded-full border border-slate-300 px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-400 transition"
            >
              Log out
            </button>
          ) : (
            <button
              onClick={() => openAuthModal('signin')}
              className="rounded-full bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 transition"
            >
              Log in for trade pricing
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

function ToolShell() {
  return (
    <main className="min-h-screen">
      <Header />
      <PortalFlow />
    </main>
  );
}

export default function Page() {
  return (
    <FreeToolsAuthProvider>
      <ToolShell />
    </FreeToolsAuthProvider>
  );
}
