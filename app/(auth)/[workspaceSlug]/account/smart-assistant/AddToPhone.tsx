'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/**
 * "Add to your phone" flow for the Smart Assistant: shows a QR code that
 * opens the assistant URL on the phone, with per-platform install steps
 * (iOS Safari vs Android Chrome). Client-side only - the URL is derived
 * from the current location so no server props are needed.
 */
export function AddToPhone() {
  const [open, setOpen] = useState(false);
  const [qrData, setQrData] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [platform, setPlatform] = useState<'ios' | 'android'>('ios');

  useEffect(() => {
    if (!open || qrData) return;
    // Config page lives at /{slug}/account/smart-assistant - derive the
    // assistant URL from the path so the QR always matches the workspace.
    const parts = window.location.pathname.split('/').filter(Boolean);
    const slug = parts[0] ?? '';
    const target = `${window.location.origin}/${slug}/assistant`;
    setUrl(target);
    const ua = navigator.userAgent;
    setPlatform(/android/i.test(ua) ? 'android' : 'ios');
    QRCode.toDataURL(target, { width: 220, margin: 1, color: { dark: '#000000', light: '#ffffff' } })
      .then(setQrData)
      .catch(() => setQrData(null));
  }, [open, qrData]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="2" width="14" height="20" rx="2" />
          <path d="M12 18h.01" />
        </svg>
        Add to your phone
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Install on your phone</h3>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <div className="mt-4 flex flex-col items-center">
              {qrData ? (
                <img src={qrData} alt="QR code to open the assistant on your phone" className="rounded-xl border border-slate-200" width={220} height={220} />
              ) : (
                <div className="flex h-[220px] w-[220px] items-center justify-center rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
                  Generating QR...
                </div>
              )}
              <p className="mt-3 text-center text-xs text-slate-500">
                Scan with your phone camera to open the assistant. Log in if asked, then follow the steps below to install it as an app.
              </p>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setPlatform('ios')}
                className={`flex-1 rounded-full border px-3 py-1.5 text-xs font-medium transition ${platform === 'ios' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 text-slate-600 hover:border-slate-400'}`}
              >
                iPhone
              </button>
              <button
                onClick={() => setPlatform('android')}
                className={`flex-1 rounded-full border px-3 py-1.5 text-xs font-medium transition ${platform === 'android' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 text-slate-600 hover:border-slate-400'}`}
              >
                Android
              </button>
            </div>

            {platform === 'ios' ? (
              <ol className="mt-3 space-y-1.5 text-xs leading-relaxed text-slate-600">
                <li>1. Scan the QR code - it opens in Safari</li>
                <li>2. Tap the Share button (square with arrow)</li>
                <li>3. Scroll down and tap &quot;Add to Home Screen&quot;</li>
                <li>4. Tap Add - the QuoteCore+ icon is now on your phone</li>
              </ol>
            ) : (
              <ol className="mt-3 space-y-1.5 text-xs leading-relaxed text-slate-600">
                <li>1. Scan the QR code - it opens in Chrome</li>
                <li>2. Tap the menu (three dots, top right)</li>
                <li>3. Tap &quot;Add to Home screen&quot; or &quot;Install app&quot;</li>
                <li>4. Confirm - the QuoteCore+ icon is now on your phone</li>
              </ol>
            )}

            {url && (
              <p className="mt-3 truncate rounded-lg bg-slate-50 px-2 py-1.5 text-[10px] text-slate-400">{url}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
