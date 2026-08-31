'use client';

// Supplier Pricing Tool shell - default route (Burton Roofing, the dev
// version). Other suppliers render via ./[supplierSlug]/page.tsx using the
// same shell. Everything supplier-specific comes from the supplier config.

import { PortalFlow } from './PortalFlow';
import { FreeToolsAuthProvider, useFreeToolsAuth } from '../_components/FreeToolsAuthProvider';
import { SupplierConfigProvider, useSupplierConfig } from './supplierConfig';
import { DEFAULT_SUPPLIER_SLUG } from './supplierDefs';
import Link from 'next/link';

function Header() {
  const { config, basePath } = useSupplierConfig();
  const { user, openAuthModal, signOut } = useFreeToolsAuth();
  const headerLogo = config.logoDarkUrl ?? config.logoUrl;

  return (
    <header className="border-b border-black/20" style={{ backgroundColor: config.brandColor }}>
      <div className="mx-auto max-w-5xl px-4 py-3 md:py-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex items-center gap-3">
          {headerLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={headerLogo} alt={config.name} className="h-9 w-auto object-contain" onError={e => { if (config.logoUrl && e.target instanceof HTMLImageElement && e.target.src !== config.logoUrl) e.target.src = config.logoUrl; }} />
          ) : (
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold"
              style={{ backgroundColor: '#fff', color: config.brandColor }}
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
            <Link href={`${basePath}/admin`} className="hidden md:inline text-xs text-white/60 hover:text-white transition">
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

/** Scoped theme layer: remaps the tool's generic black/blue accents to the
 *  active supplier's palette (from config.theme). Scoped to .spt-scope so
 *  nothing outside this tool is affected. Fully config-driven - new
 *  suppliers need zero CSS edits. */
function ThemeStyle() {
  const { config } = useSupplierConfig();
  const t = config.theme;
  const wash = t.washAlpha ?? 0.05;
  const glow = t.glowAlpha ?? 0.4;
  return (
    <style>{`
      .spt-scope .bg-black { background-color: ${t.primary}; }
      .spt-scope .hover\\:bg-slate-800:hover { background-color: ${t.primaryHover}; }
      .spt-scope .text-\\[\\#1D4ED8\\] { color: ${t.accent}; }
      .spt-scope .text-blue-600 { color: ${t.accent}; }
      .spt-scope .hover\\:text-blue-700:hover { color: ${t.accentHover}; }
      .spt-scope .border-blue-200 { border-color: ${t.border}; }
      .spt-scope .hover\\:border-blue-200:hover { border-color: ${t.border}; }
      .spt-scope .hover\\:border-blue-300:hover { border-color: ${t.borderHover}; }
      .spt-scope .bg-blue-50\\/40 { background-color: rgba(${hexToRgb(t.accent)}, ${wash}); }
      .spt-scope .hover\\:bg-blue-50\\/40:hover { background-color: rgba(${hexToRgb(t.accent)}, ${wash}); }
      .spt-scope .focus\\:border-blue-500:focus { border-color: ${t.accent}; }
      .spt-scope .focus\\:border-blue-400:focus { border-color: ${t.accent}; }
      .spt-scope .shadow-\\[0_0_16px_rgba\\(37\\,99\\,235\\,0\\.5\\)\\] { box-shadow: 0 0 16px rgba(${hexToRgb(t.primary)}, ${glow}); }
      .spt-scope .hover\\:shadow-\\[0_0_12px_rgba\\(255\\,107\\,53\\,0\\.4\\)\\]:hover { box-shadow: 0 0 12px rgba(${hexToRgb(t.accent)}, 0.45); }
      .spt-scope .pill-shimmer::before {
        background: linear-gradient(90deg, transparent 0%, transparent 40%, ${t.accent} 50%, transparent 60%, transparent 100%);
        background-size: 200% 100%;
        background-repeat: no-repeat;
      }
    `}</style>
  );
}

function hexToRgb(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return '0,0,0';
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

export function ToolShell() {
  return (
    <main className="spt-scope min-h-screen">
      <ThemeStyle />
      <Header />
      <PortalFlow />
    </main>
  );
}

export default function Page() {
  return (
    <FreeToolsAuthProvider>
      <SupplierConfigProvider slug={DEFAULT_SUPPLIER_SLUG}>
        <ToolShell />
      </SupplierConfigProvider>
    </FreeToolsAuthProvider>
  );
}
