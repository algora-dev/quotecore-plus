'use client';
import { SHOWCASE_HOME_URL, type ShowcaseCopy } from './showcaseCopy';

/**
 * Locked-feature showcase UI (owner directive 2026-10-14).
 *
 * LockedFeatureButton: dark primary button (design system) with a lock icon.
 * Hover shows the short tooltip; the click opens the FeatureUpsellModal and
 * is owned by the caller.
 *
 * FeatureUpsellCard: the shared modal card (benefits, availability chip,
 * homepage CTA, explicit dismiss only - no click-outside-to-close).
 *
 * FeatureUpsellModal: the card in a plain fixed overlay for surfaces without
 * the canvas-hosted dialog system (guided demo, marketing tools). Inside the
 * takeoff workstation, wrap FeatureUpsellCard in QcHostedDialog instead so
 * it stacks correctly with the hosted native dialogs.
 */

export function LockedFeatureButton({ label, tooltip, onClick, className = '', dataCopilot }: {
  label: string;
  tooltip: string;
  onClick: () => void;
  className?: string;
  dataCopilot?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={tooltip}
      {...(dataCopilot ? { 'data-copilot': dataCopilot } : {})}
      className={`inline-flex items-center gap-1.5 rounded-full bg-black px-3 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_12px_rgba(255,107,53,0.4)] ${className}`}
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
      {label}
    </button>
  );
}

export function FeatureUpsellCard({ feature, onClose }: { feature: ShowcaseCopy; onClose: () => void }) {
  return (
    <div className="bg-white rounded-2xl p-4 md:p-6 max-w-sm w-full border border-gray-200 shadow-xl">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-orange-100 text-[#BD4A1A]">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-slate-900">{feature.title}</h2>
          <p className="text-sm text-slate-500 mt-2">{feature.lead}</p>
        </div>
      </div>
      {feature.benefits.length > 0 && (
        <ul className="mt-4 space-y-2">
          {feature.benefits.map((benefit) => (
            <li key={benefit} className="flex items-start gap-2 text-sm text-slate-700">
              <svg className="w-4 h-4 mt-0.5 text-[#BD4A1A] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {benefit}
            </li>
          ))}
        </ul>
      )}
      <span className="mt-4 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200">
        <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
        {feature.availability}
      </span>
      <div className="mt-5 flex flex-col gap-2">
        <a
          href={SHOWCASE_HOME_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full inline-flex items-center justify-center rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)]"
        >
          {feature.ctaLabel}
        </a>
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 text-sm font-medium text-slate-600 border border-slate-300 rounded-full hover:bg-slate-50 transition-colors"
        >
          Keep going here
        </button>
      </div>
    </div>
  );
}

export function FeatureUpsellModal({ feature, onClose }: { feature: ShowcaseCopy; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 backdrop-blur-sm bg-black/40">
      <FeatureUpsellCard feature={feature} onClose={onClose} />
    </div>
  );
}
