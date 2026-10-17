'use client';

import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { QcDialog } from '@/app/components/ui/v2/QcDialog';

type Platform = 'ios' | 'android';
type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

function deviceInfo() {
  if (typeof navigator === 'undefined') return { mobile: false, ios: false, android: false, safari: false };
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/i.test(ua);
  const android = /Android/i.test(ua);
  const mobile = ios || android || /Mobile/i.test(ua);
  const safari = ios && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
  return { mobile, ios, android, safari };
}

export function AddToPhone() {
  const [open, setOpen] = useState(false);
  const [qrData, setQrData] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [platform, setPlatform] = useState<Platform>('ios');
  const [mobile, setMobile] = useState(false);
  const [iosSafari, setIosSafari] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const info = deviceInfo();
    setMobile(info.mobile);
    setIosSafari(info.safari);
    if (info.android) setPlatform('android');
    else if (info.ios) setPlatform('ios');
    const nav = navigator as Navigator & { standalone?: boolean };
    setInstalled(info.mobile && (window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true));

    const beforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPrompt);
    };
    const onInstalled = () => { setInstalled(true); setInstallPrompt(null); };
    window.addEventListener('beforeinstallprompt', beforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', beforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const parts = window.location.pathname.split('/').filter(Boolean);
    const slug = parts[0] ?? '';
    const target = `${window.location.origin}/${slug}/assistant`;
    setUrl(target);
    if (mobile || qrData) return;
    QRCode.toDataURL(target, { width: 220, margin: 1, color: { dark: '#0D1014', light: '#ffffff' } })
      .then(setQrData)
      .catch(() => setQrData(null));
  }, [open, mobile, qrData]);

  const nativeInstallAvailable = mobile && platform === 'android' && installPrompt !== null && !installed;
  const title = installed ? 'QuoteCore+ is already installed' : mobile ? 'Add QuoteCore+ to this phone' : 'Add QuoteCore+ to your phone';
  const description = installed
    ? 'Open it from your home screen for quick access to Smart Assistant.'
    : mobile
      ? 'A home-screen icon opens QuoteCore+ like an app, without changing how your account works.'
      : 'Scan the code with your phone, then add QuoteCore+ to the home screen.';
  const iosBrowserNote = useMemo(() => mobile && platform === 'ios' && !iosSafari, [iosSafari, mobile, platform]);

  async function installNative() {
    if (!installPrompt || installing) return;
    setInstalling(true);
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') setInstallPrompt(null);
    } finally { setInstalling(false); }
  }

  return <>
    <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/20 bg-[#171C23] px-4 py-2.5 text-sm font-semibold text-[#FBFCFF] transition hover:border-[#FF9A5C] hover:bg-[#202630] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9A5C]">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M12 18h.01" /></svg>
      Add to your phone
    </button>

    <QcDialog open={open} onRequestClose={() => setOpen(false)} size="md" title={title} description={description}
      footer={<QcButton variant="secondary" onClick={() => setOpen(false)}>Close</QcButton>}>
      {installed ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><strong>Installed.</strong> You can launch QuoteCore+ from your phone’s home screen.</div> : <div className="space-y-5">
        {!mobile && <div className="grid gap-5 sm:grid-cols-[220px_minmax(0,1fr)] sm:items-center">
          <div className="flex justify-center">{qrData ? <img src={qrData} alt="QR code that opens Smart Assistant on your phone" className="rounded-xl border border-slate-200 bg-white" width={220} height={220} /> : <div className="flex h-[220px] w-[220px] items-center justify-center rounded-xl border border-dashed border-slate-300 text-xs text-slate-400">Generating QR…</div>}</div>
          <div><p className="text-sm font-semibold text-slate-900">1. Scan with your phone camera</p><p className="mt-1 text-sm leading-6 text-slate-600">Open the link and sign in if asked. Then choose your phone below for the last few steps.</p>{url && <p className="mt-3 break-all rounded-lg bg-slate-50 px-2.5 py-2 text-[11px] text-slate-500">{url}</p>}</div>
        </div>}

        {mobile && <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm leading-6 text-slate-700"><strong className="text-slate-950">You’re already on your phone.</strong> No QR code needed—follow the steps below.</div>}

        <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Phone type">
          <button type="button" role="tab" aria-selected={platform === 'ios'} onClick={() => setPlatform('ios')} className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition ${platform === 'ios' ? 'bg-gradient-to-r from-[#FF641F] via-[#FF8A3D] to-[#FFB36B] text-[#191B20] shadow-sm' : 'text-slate-600 hover:bg-white'}`}>iPhone / iPad</button>
          <button type="button" role="tab" aria-selected={platform === 'android'} onClick={() => setPlatform('android')} className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition ${platform === 'android' ? 'bg-gradient-to-r from-[#FF641F] via-[#FF8A3D] to-[#FFB36B] text-[#191B20] shadow-sm' : 'text-slate-600 hover:bg-white'}`}>Android</button>
        </div>

        {platform === 'ios' ? <div>
          {iosBrowserNote && <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><strong>Open this page in Safari first.</strong> iPhone and iPad add-to-home-screen controls are available from Safari’s Share menu.</p>}
          <ol className="space-y-3 text-sm text-slate-700">
            <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-bold text-white">1</span><span>Open QuoteCore+ in <strong>Safari</strong>.</span></li>
            <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-bold text-white">2</span><span>Tap <strong>Share</strong> (the square with the upward arrow).</span></li>
            <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-bold text-white">3</span><span>Choose <strong>Add to Home Screen</strong>.</span></li>
            <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-bold text-white">4</span><span>Tap <strong>Add</strong>. QuoteCore+ will appear with your other apps.</span></li>
          </ol>
        </div> : <div>
          {nativeInstallAvailable ? <div className="rounded-xl border border-orange-200 bg-orange-50 p-4"><p className="text-sm font-semibold text-slate-950">Your browser can install QuoteCore+ now.</p><p className="mt-1 text-sm text-slate-600">Use the button below and confirm the install prompt.</p><QcButton className="mt-3" variant="primary" pending={installing} onClick={() => void installNative()}>{installing ? 'Opening install…' : 'Install QuoteCore+'}</QcButton></div> : <ol className="space-y-3 text-sm text-slate-700">
            <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-bold text-white">1</span><span>Open QuoteCore+ in <strong>Chrome</strong>.</span></li>
            <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-bold text-white">2</span><span>Open Chrome’s <strong>three-dot menu</strong>.</span></li>
            <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-bold text-white">3</span><span>Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</span></li>
            <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-bold text-white">4</span><span>Confirm. QuoteCore+ will appear with your other apps.</span></li>
          </ol>}
        </div>}
      </div>}
    </QcDialog>
  </>;
}
