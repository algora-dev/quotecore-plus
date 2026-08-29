'use client';

import { PortalFlow } from './PortalFlow';
import { FreeToolsAuthProvider, useFreeToolsAuth } from '../_components/FreeToolsAuthProvider';
import { useSupplierConfig } from './supplierConfig';
import Link from 'next/link';

// Supplier Pricing Tool demo - standalone demo flow living in the main app
// under /supplier-pricing-tool. NOT linked from public nav until Shaun approves.

function Header() {
  const { config } = useSupplierConfig();
  const { user, openAuthModal, signOut } = useFreeToolsAuth();

  return (
    <header className="border-b border-black/20" style={{ backgroundColor: config.brandColor }}>
      <div className="mx-auto max-w-5xl px-4 py-3 md:py-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex items-center gap-3">
          {config.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/supplier-logos/burton-roofing-dark.png" alt={config.name} className="h-9 w-auto object-contain" onError={e => { (e.target as HTMLImageElement).src = config.logoUrl!; }} />
          ) : (
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold text-white"
              style={{ backgroundColor: '#fff' }}
            >
              {config.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div>
            <div className="text-sm font-semibold text-white">{config.name}</div>
            <div className="hidden sm:block text-xs text-white/60">{config.tagline}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {config.poweredBy && <span className="hidden md:inline text-xs text-white/60">Powered by QuoteCore+</span>}
          {config.features.adminPanel && (
            <Link href="/supplier-pricing-tool/admin" className="hidden md:inline text-xs text-white/60 hover:text-white transition">
              Admin
            </Link>
          )}
          {config.features.login && (user ? (
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
              <span className="hidden sm:inline">Log in for trade pricing</span>
              <span className="sm:hidden">Log in</span>
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}

function ToolShell() {
  return (
    <main className="spt-scope min-h-screen">
      {/* Burton theme layer: remaps the tool's generic black/blue accents to
          Burton teal (#012B39). Scoped to .spt-scope so nothing outside this
          tool is affected. */}
      <style>{`
        .spt-scope .bg-black { background-color: #012B39; }
        .spt-scope .hover\:bg-slate-800:hover { background-color: #014055; }
        .spt-scope .text-\[\#1D4ED8\] { color: #014E63; }
        .spt-scope .text-blue-600 { color: #014E63; }
        .spt-scope .hover\:text-blue-700:hover { color: #013A4D; }
        .spt-scope .border-blue-200 { border-color: #8FBAC4; }
        .spt-scope .hover\:border-blue-200:hover { border-color: #8FBAC4; }
        .spt-scope .hover\:border-blue-300:hover { border-color: #6BA7B4; }
        .spt-scope .bg-blue-50\/40 { background-color: rgba(1, 43, 57, 0.05); }
        .spt-scope .hover\:bg-blue-50\/40:hover { background-color: rgba(1, 43, 57, 0.05); }
        .spt-scope .focus\:border-blue-500:focus { border-color: #014E63; }
        .spt-scope .focus\:border-blue-400:focus { border-color: #014E63; }
        .spt-scope .shadow-\[0_0_16px_rgba\(37\,99\,235\,0\.5\)\] { box-shadow: 0 0 16px rgba(1, 43, 57, 0.4); }
      `}</style>
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
