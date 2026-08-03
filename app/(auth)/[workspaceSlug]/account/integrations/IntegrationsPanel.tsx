'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { IntegrationProvider } from './actions';

const PROVIDER_INFO: Record<IntegrationProvider, { name: string; description: string; logo: string }> = {
  zapier: {
    name: 'Zapier',
    description: 'Send quotes to 6,000+ apps via Zapier webhooks. Fastest way to connect.',
    logo: '/logos/zapier.png',
  },
  jobnimbus: {
    name: 'JobNimbus',
    description: 'Create contacts, jobs, and attach quotes directly in JobNimbus.',
    logo: '/logos/jobnimbus.png',
  },
  fergus: {
    name: 'Fergus',
    description: 'Send customers, jobs, and quotes to Fergus job management.',
    logo: '/logos/fergus.png',
  },
};

export function IntegrationsPanel() {
  const [showComingSoon, setShowComingSoon] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Integrations</h2>
        <p className="mt-1 text-sm text-slate-500">
          Send completed quotes to the job management platform you already use.
        </p>
      </div>

      {/* Provider cards */}
      <div className="grid gap-3">
        {(Object.keys(PROVIDER_INFO) as IntegrationProvider[]).map((provider) => {
          const info = PROVIDER_INFO[provider];

          return (
            <div
              key={provider}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-50">
                    <Image src={info.logo} alt={`${info.name} logo`} width={28} height={28} className="object-contain" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">{info.name}</h3>
                    <p className="mt-0.5 text-xs text-slate-500">{info.description}</p>
                    <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                      Coming Soon
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowComingSoon(true)}
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:border-orange-300 hover:bg-orange-50/40 transition"
                >
                  Connect
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Coming Soon modal */}
      {showComingSoon && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40"
          onClick={() => setShowComingSoon(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-sm w-full mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-slate-900">Integrations Coming Soon</h3>
              <button
                type="button"
                onClick={() => setShowComingSoon(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-3">
              <div className="flex justify-center">
                <span className="text-4xl">🔧</span>
              </div>
              <p className="text-center text-sm text-slate-600">
                We&apos;re still putting the finishing touches on integrations. You&apos;ll be able to connect Zapier, JobNimbus, and Fergus soon.
              </p>
              <p className="text-center text-xs text-slate-400">
                We&apos;ll let you know when this feature is ready to use.
              </p>
              <button
                type="button"
                onClick={() => setShowComingSoon(false)}
                className="w-full rounded-full bg-black px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

