'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { SHOWCASE_HOME_URL, type ShowcaseCopy } from './showcaseCopy';
import './showcase.css';

/**
 * Feature showcase UI (owner 2026-10-14, v2 dark restyle same day).
 *
 * Visual language: the pricing calculator's approved Dark Focus composition
 * (ink surfaces, orange atmosphere glow, glass accents, orange-gradient
 * primary with dark text, rounded-rect controls). See showcase.css.
 *
 * LockedFeatureButton: dark glass toolbar teaser with a lock icon. Hover
 * shows the short tooltip (title attr, caller-owned); click opens the modal.
 *
 * FeatureUpsellCard: scoped .qcs-* card, safe inside any host (explicit
 * properties, no bare element selectors).
 *
 * FeatureUpsellModal: the card in a blurred overlay, portaled to
 * document.body so host-page CSS modules can never cascade into it (fixes
 * the dark-on-dark CTA seen in the measurement tool). Explicit dismiss
 * button only, no click-outside-to-close.
 *
 * Inside the takeoff workstation the card is wrapped in QcHostedDialog by
 * the caller (native dialog stacking); the same scoped classes apply.
 */

const LOCK_ICON = (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);

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
      className={`qcs-teaser ${className}`}
    >
      {LOCK_ICON}
      {label}
    </button>
  );
}

export function FeatureUpsellCard({ feature, onClose }: { feature: ShowcaseCopy; onClose: () => void }) {
  return (
    <div className="qcs-card">
      <div className="qcs-glow" aria-hidden="true" />
      <div className="qcs-body">
        <div className="qcs-eyebrow">
          <span className="qcs-dot" aria-hidden="true" />
          QuoteCore+ <span aria-hidden="true">/</span> {feature.label}
        </div>
        <h2 className="qcs-title">{feature.title}</h2>
        <p className="qcs-lead">{feature.lead}</p>
        {feature.benefits.length > 0 && (
          <ul className="qcs-benefits">
            {feature.benefits.map((benefit) => (
              <li key={benefit}>
                <span className="qcs-check" aria-hidden="true">
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                {benefit}
              </li>
            ))}
          </ul>
        )}
        <div>
          <span className="qcs-badge">{feature.availability}</span>
        </div>
        <div className="qcs-actions">
          <a className="qcs-cta" href={SHOWCASE_HOME_URL} target="_blank" rel="noopener noreferrer">
            {feature.ctaLabel}
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </a>
          <button type="button" className="qcs-secondary" onClick={onClose}>
            Keep going here
          </button>
        </div>
      </div>
    </div>
  );
}

export function FeatureUpsellModal({ feature, onClose }: { feature: ShowcaseCopy; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return createPortal(
    <div className="qcs-overlay" role="dialog" aria-modal="true" aria-label={feature.title}>
      <FeatureUpsellCard feature={feature} onClose={onClose} />
    </div>,
    document.body,
  );
}
