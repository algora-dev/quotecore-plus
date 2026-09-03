'use client';

// Supplier admin panel: branded login gate + sidebar shell. Sections live
// in their own files (AdminProducts, AdminTrade, AdminTeam, AdminTracking,
// AdminCta); this file owns auth state, layout and the Settings section.
// Everything is demo-grade (sessionStorage auth, localStorage data) and
// per-supplier branded from the def - same template for every deployment.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { SupplierConfig } from '../supplierConfig';
import {
  defaultConfig, readStoredConfig, writeStoredConfig, resetStoredConfig, SupplierConfigProvider,
} from '../supplierConfig';
import { getSupplierDef } from '../supplierDefs';
import { adminAuthKey, readAdminData, writeAdminData, resetAdminData, type AdminData } from '../adminData';
import { AdminProducts } from './AdminProducts';
import { AdminTrade } from './AdminTrade';
import { AdminTeam } from './AdminTeam';
import { AdminTracking } from './AdminTracking';
import { AdminCta } from './AdminCta';

type SectionKey = 'dashboard' | 'products' | 'trade' | 'team' | 'tracking' | 'cta' | 'settings';

export function AdminPanel({ slug }: { slug: string }) {
  const def = getSupplierDef(slug);
  const brand = def.brandColor;
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    setAuthed(window.sessionStorage.getItem(adminAuthKey(slug)) === '1');
  }, [slug]);

  if (authed === null) {
    return <main className="min-h-screen flex items-center justify-center text-sm text-slate-400">Loading admin...</main>;
  }
  if (!authed) {
    return <AdminLogin slug={slug} brand={brand} logo={def.logoDarkUrl ?? def.logoUrl} name={def.name} onLogin={() => setAuthed(true)} />;
  }
  return <AdminHome slug={slug} onLogout={() => { window.sessionStorage.removeItem(adminAuthKey(slug)); setAuthed(false); }} />;
}

// ---- login ----

function AdminLogin({ slug, brand, logo, name, onLogin }: { slug: string; brand: string; logo: string | null; name: string; onLogin: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    // Demo auth: any non-empty credentials accepted.
    if (!email.trim() || !password.trim()) {
      setError('Enter your email and password.');
      return;
    }
    window.sessionStorage.setItem(adminAuthKey(slug), '1');
    onLogin();
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: brand }}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
        <div className="flex flex-col items-center text-center">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt={name} className="h-12 w-auto object-contain" />
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold text-white" style={{ backgroundColor: brand }}>
              {name.slice(0, 1)}
            </span>
          )}
          <h1 className="mt-4 text-lg font-bold text-slate-900">Supplier Admin</h1>
          <p className="mt-1 text-xs text-slate-500">Sign in to manage {name}</p>
        </div>
        <form onSubmit={submit} className="mt-6 space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none" placeholder="you@example.com" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none" placeholder="Password" />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button type="submit" className="w-full rounded-full px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90" style={{ backgroundColor: brand }}>
            Sign in
          </button>
        </form>
        <p className="mt-4 text-center text-[11px] text-slate-400">Demo build - any email and password signs in.</p>
        <div className="mt-3 border-t border-slate-100 pt-3 text-center">
          <Link href={slug === 'burton-roofing' ? '/supplier-pricing-tool' : `/supplier-pricing-tool/${slug}`} className="text-xs font-medium text-slate-400 hover:text-slate-600 transition">
            Back to the pricing tool
          </Link>
        </div>
      </div>
    </main>
  );
}

// ---- shell ----

function AdminHome({ slug, onLogout }: { slug: string; onLogout: () => void }) {
  const [cfg, setCfg] = useState<SupplierConfig>(() => defaultConfig(slug));
  const [admin, setAdmin] = useState<AdminData>(() => readAdminData(slug, defaultConfig(slug)));
  const [section, setSection] = useState<SectionKey>('dashboard');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const base = defaultConfig(slug);
    setCfg(readStoredConfig(slug) ?? base);
    setAdmin(readAdminData(slug, base));
  }, [slug]);

  function flashSaved() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const saveAll = () => {
    writeStoredConfig(cfg);
    writeAdminData(slug, admin);
    flashSaved();
  };

  const sections: { key: SectionKey; label: string }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    ...(admin.features.products ? [{ key: 'products' as SectionKey, label: 'Products' }] : []),
    ...(admin.features.tradePricing ? [{ key: 'trade' as SectionKey, label: 'Trade pricing' }] : []),
    ...(admin.features.team ? [{ key: 'team' as SectionKey, label: 'Team' }] : []),
    ...(admin.features.tracking ? [{ key: 'tracking' as SectionKey, label: 'Tracking' }] : []),
    ...(admin.features.cta ? [{ key: 'cta' as SectionKey, label: 'Call to action' }] : []),
    { key: 'settings', label: 'Settings' },
  ];

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-black/20" style={{ backgroundColor: cfg.brandColor }}>
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            {cfg.logoDarkUrl || cfg.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cfg.logoDarkUrl ?? cfg.logoUrl ?? undefined} alt={cfg.name} className="h-8 w-auto object-contain" />
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-xs font-bold" style={{ color: cfg.brandColor }}>{cfg.name.slice(0, 1)}</span>
            )}
            <span className="text-sm font-semibold text-white">Admin</span>
          </div>
          <div className="flex items-center gap-2">
            {saved && <span className="text-xs text-green-300">Saved</span>}
            <button onClick={saveAll} className="rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-white/25 transition">Save changes</button>
            <Link href={slug === 'burton-roofing' ? '/supplier-pricing-tool' : `/supplier-pricing-tool/${slug}`} className="rounded-full border border-white/50 px-3.5 py-1.5 text-xs font-medium text-white hover:border-white transition">View tool</Link>
            <button onClick={onLogout} className="rounded-full border border-white/50 px-3.5 py-1.5 text-xs font-medium text-white hover:border-white transition">Log out</button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 flex flex-col md:flex-row gap-6 pb-16">
        <nav className="md:w-48 flex-shrink-0">
          <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
            {sections.map(s => (
              <button
                key={s.key}
                onClick={() => setSection(s.key)}
                className={`whitespace-nowrap rounded-full md:rounded-xl px-4 py-2 text-left text-sm font-medium transition ${section === s.key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-white hover:border hover:border-slate-200'}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </nav>
        <div className="flex-1 min-w-0 space-y-4">
          {section === 'dashboard' && <Dashboard cfg={cfg} admin={admin} slug={slug} />}
          {section === 'products' && <AdminProducts cfg={cfg} setCfg={setCfg} />}
          {section === 'trade' && <AdminTrade admin={admin} setAdmin={setAdmin} cfg={cfg} />}
          {section === 'team' && <AdminTeam admin={admin} setAdmin={setAdmin} />}
          {section === 'tracking' && <AdminTracking cfg={cfg} slug={slug} />}
          {section === 'cta' && <AdminCta admin={admin} setAdmin={setAdmin} />}
          {section === 'settings' && <Settings slug={slug} cfg={cfg} setCfg={setCfg} admin={admin} setAdmin={setAdmin} onReset={flashSaved} />}
        </div>
      </div>
    </main>
  );
}

export function SectionCard({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 md:p-6 space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {desc && <p className="mt-0.5 text-xs text-slate-400">{desc}</p>}
      </div>
      {children}
    </section>
  );
}

// ---- dashboard ----

function Dashboard({ cfg, admin, slug }: { cfg: SupplierConfig; admin: AdminData; slug: string }) {
  const [events, setEvents] = useState(0);
  const [quotes, setQuotes] = useState(0);
  const [value, setValue] = useState(0);

  useEffect(() => {
    const load = () => {
      let q = 0, v = 0, s = 0;
      for (const ev of readEventsSafe(slug)) {
        q += 1; v += ev.total;
        s += 1;
      }
      setQuotes(q); setValue(v); setEvents(q + s);
    };
    load();
    window.addEventListener('qc-spt-events-changed', load);
    return () => window.removeEventListener('qc-spt-events-changed', load);
  }, [slug]);

  const stats = [
    { label: 'Products', value: String(cfg.products.length), show: admin.features.products },
    { label: 'Trade customers', value: String(admin.customers.length), show: admin.features.tradePricing },
    { label: 'Team members', value: String(admin.team.length), show: admin.features.team },
    { label: 'Quotes created', value: String(quotes), show: admin.features.tracking },
    { label: 'Quote value', value: `${cfg.currency}${value.toFixed(2)}`, show: admin.features.tracking },
    { label: 'Signups captured', value: String(events - quotes), show: admin.features.tracking },
  ].filter(s => s.show);

  return (
    <div className="space-y-4">
      <SectionCard title="Overview" desc={`Live snapshot for ${cfg.name} (demo data stored in this browser).`}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map(s => (
            <div key={s.label} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs text-slate-500">{s.label}</div>
              <div className="mt-1 text-xl font-semibold text-slate-900">{s.value}</div>
            </div>
          ))}
        </div>
      </SectionCard>
      <SectionCard title="Feature plan" desc="Every module below can be switched on or off per deployment - use Settings to demo different tiers.">
        <div className="flex flex-wrap gap-2">
          {[
            ['Products', admin.features.products], ['Trade pricing', admin.features.tradePricing],
            ['Team', admin.features.team], ['Tracking', admin.features.tracking], ['Call to action', admin.features.cta],
          ].map(([label, on]) => (
            <span key={label as string} className={`rounded-full px-3 py-1 text-xs font-medium ${on ? 'bg-green-50 text-green-700 ring-1 ring-green-200' : 'bg-slate-100 text-slate-400'}`}>
              {label as string}{on ? ' - on' : ' - off'}
            </span>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function readEventsSafe(slug: string) {
  try {
    const raw = window.localStorage.getItem(`qc-spt-${slug}-events-v1`);
    const parsed = raw ? (JSON.parse(raw) as Array<{ type: string; total?: number }>) : [];
    return parsed.filter((e): e is { type: 'quote'; total: number } => e.type === 'quote');
  } catch { return [] as Array<{ type: 'quote'; total: number }>; }
}

// ---- settings ----

function Settings({ slug, cfg, setCfg, admin, setAdmin, onReset }: {
  slug: string; cfg: SupplierConfig; setCfg: (fn: (c: SupplierConfig) => SupplierConfig) => void;
  admin: AdminData; setAdmin: (fn: (a: AdminData) => AdminData) => void; onReset: () => void;
}) {
  const inputCls = 'mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none';
  return (
    <div className="space-y-4">
      <SectionCard title="Branding & wording">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-slate-600">Supplier name</label>
            <input type="text" value={cfg.name} onChange={e => setCfg(c => ({ ...c, name: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Tagline</label>
            <input type="text" value={cfg.tagline} onChange={e => setCfg(c => ({ ...c, tagline: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Blanket trade discount (%)</label>
            <input type="number" min="0" max="80" step="0.5" value={cfg.discountPct} onChange={e => setCfg(c => ({ ...c, discountPct: parseFloat(e.target.value) || 0 }))} className={inputCls} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={cfg.poweredBy} onChange={e => setCfg(c => ({ ...c, poweredBy: e.target.checked }))} className="h-4 w-4 accent-slate-900" />
          Powered by QuoteCore+ (off = white-label)
        </label>
      </SectionCard>
      <SectionCard title="Plan modules (internal)" desc="For QuoteCore+ use - we set which modules a customer's deployment includes when we build their version. Demos run with everything on; toggling here previews a lower tier.">
        <div className="grid gap-2 md:grid-cols-2">
          {([
            ['products', 'Products manager', 'Add, edit and remove catalog products and pricing.'],
            ['tradePricing', 'Trade pricing', 'Trade tiers + customer email list with tier assignment.'],
            ['team', 'Team', 'Add team members, invite and reset passwords.'],
            ['tracking', 'Tracking', 'Quotes created, values, signups and product leaderboard.'],
            ['cta', 'Call to action', 'Configure the end-of-flow email-capture popup offer.'],
          ] as const).map(([key, label, desc]) => (
            <label key={key} className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 cursor-pointer transition ${admin.features[key] ? 'border-slate-900 bg-slate-50' : 'border-slate-200 bg-white hover:border-blue-200'}`}>
              <input type="checkbox" checked={admin.features[key]} onChange={e => setAdmin(a => ({ ...a, features: { ...a.features, [key]: e.target.checked } }))} className="mt-0.5 h-4 w-4 accent-slate-900" />
              <span>
                <span className="block text-sm font-medium text-slate-900">{label}</span>
                <span className="block mt-0.5 text-xs text-slate-500">{desc}</span>
              </span>
            </label>
          ))}
        </div>
      </SectionCard>
      <SectionCard title="Reset" desc="Restore this supplier's demo defaults (branding, catalog, admin data).">
        <button
          onClick={() => { resetStoredConfig(slug); resetAdminData(slug); setCfg(() => defaultConfig(slug)); setAdmin(() => readAdminData(slug, defaultConfig(slug))); onReset(); }}
          className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-600 hover:border-slate-400 transition"
        >
          Reset to defaults
        </button>
      </SectionCard>
    </div>
  );
}
