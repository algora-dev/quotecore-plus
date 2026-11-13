'use client';

import { useEffect, useState } from 'react';
import { QcDialog } from '@/app/components/ui/v2/QcDialog';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import YouTubeLite from '@/components/YouTubeLite';
import {
  WELCOME_VIDEO_URL,
  WELCOME_VIDEO_FALLBACK_YOUTUBE_ID,
  dfyHref,
} from '@/app/lib/onboarding/constants';
import {
  recordWelcomeSeen,
  recordWelcomeChoice,
  recordDemoTipsSeen,
} from '@/app/lib/onboarding/actions';
import { trackEvent } from '@/lib/analytics';

/**
 * Demo-first welcome flow (owner 2026-11-13), shown over the demo launcher:
 *
 *  1. Welcome — founder video on top (muted autoplay + controls so browsers
 *     allow it), then two CTAs: Continue to the demo, or Get in touch with us
 *     (Done For You page, new tab).
 *  2. Tips — right after continuing: finish at least the first three tasks
 *     (the pricing chapter), and when switching to your own workspace, add
 *     your pricing first.
 *
 * Each step shows once per account (company-level first-wins stamps). The
 * tips step re-shows on later demo visits until dismissed.
 */
export function DemoWelcomeModal({ initialStep }: { initialStep: 'welcome' | 'tips' }) {
  const [step, setStep] = useState<'welcome' | 'tips' | 'closed'>(initialStep);

  // Stamp "seen" as soon as each step renders, not on close: a closed tab must
  // never re-trigger the redirect loop guard in the workspace home.
  useEffect(() => {
    if (initialStep === 'welcome') {
      void recordWelcomeSeen();
      trackEvent('onboarding_welcome_shown');
    }
  }, [initialStep]);

  useEffect(() => {
    if (step === 'tips') {
      void recordDemoTipsSeen();
      trackEvent('onboarding_tips_shown');
    }
  }, [step]);

  const getInTouch = () => {
    window.open(dfyHref('welcome_modal'), '_blank', 'noopener,noreferrer');
    trackEvent('onboarding_welcome_choice', { choice: 'get_in_touch' });
    void recordWelcomeChoice('get_in_touch');
    setStep('closed');
  };

  const continueToDemo = () => {
    trackEvent('onboarding_welcome_choice', { choice: 'continue' });
    void recordWelcomeChoice('continue');
    setStep('tips');
  };

  const closeTips = () => setStep('closed');

  return (
    <>
      <QcDialog
        open={step === 'welcome'}
        size="md"
        title="Welcome to QuoteCore+"
        description="A quick word from Shaun, our founder — what this does and what to do next."
        onRequestClose={continueToDemo}
        footer={
          <>
            <QcButton onClick={getInTouch}>Get in touch with us</QcButton>
            <QcButton variant="primary" onClick={continueToDemo}>Continue to the demo</QcButton>
          </>
        }
      >
        <div className="space-y-3 text-sm text-slate-700">
          {WELCOME_VIDEO_URL ? (
            // Muted autoplay (browser policy) with controls visible: sound is
            // one tap away, and the video still starts rolling on its own.
            <video
              src={WELCOME_VIDEO_URL}
              controls
              autoPlay
              muted
              playsInline
              className="w-full rounded-xl border border-slate-200 bg-slate-900"
            />
          ) : (
            // Placeholder until the founder recording is uploaded (swap the
            // constant in app/lib/onboarding/constants.ts).
            <YouTubeLite
              videoId={WELCOME_VIDEO_FALLBACK_YOUTUBE_ID}
              title="How QuoteCore+ Done For You Setup works"
              uploadDate="2026-10-15"
            />
          )}
          <p className="text-xs text-slate-500">
            You can open your own workspace from inside the demo at any time — the toggle is top
            right. And if you&apos;d rather we set everything up for you, that&apos;s exactly what
            Get in touch is for.
          </p>
        </div>
      </QcDialog>

      <QcDialog
        open={step === 'tips'}
        size="md"
        title="Start with the first three tasks"
        description="The demo opens with Build your pricing — three short tasks."
        onRequestClose={closeTips}
        footer={<QcButton variant="primary" onClick={closeTips}>Got it — start the demo</QcButton>}
      >
        <div className="space-y-3 text-sm text-slate-700">
          <p>
            Finish at least those three before exploring the rest — they&apos;re the fastest way to
            see how QuoteCore+ fits together. Take your time with everything else.
          </p>
          <p>
            When you switch to your own workspace, add your pricing first. It&apos;s the one thing
            that turns measurements into real prices — without it you&apos;ll only ever see
            quantities.
          </p>
          <figure className="space-y-1.5">
            <img
              src="/demo-workspace-toggle.png"
              alt="Top-right app bar with the My Workspace and Guided demo toggle highlighted in orange"
              className="w-full rounded-xl border border-slate-200"
            />
            <figcaption className="text-xs text-slate-500">
              Switch to your own workspace anytime — it&apos;s this toggle, top right.
            </figcaption>
          </figure>
        </div>
      </QcDialog>
    </>
  );
}
