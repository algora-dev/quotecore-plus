'use client';

import { useEffect, useRef, useState } from 'react';
import { MarketingButton } from '@/components/marketing/MarketingButton';
import { Icon, type IconName } from './Icon';
import s from './Homepage.module.css';

/**
 * "Is QuoteCore+ for you?" - four-tap self-qualification quiz (owner audio 2026-10-08).
 * Dark Focus card styled as a sibling of the /pricing V5 calculator.
 * Owner rules: every result tier is positive, "because" lines are built from the
 * visitor's own answers, the catch-all option reads "Two or more of these",
 * single taps auto-advance, about 20 seconds end to end, no em dashes in copy.
 * Sits between How it works and Done For You. CTAs: pricing, demo, DFY anchor.
 */

type FitOption = {
  id: string;
  label: string;
  icon: IconName;
  weight: number;
  because: string;
};

type FitQuestion = {
  title: string;
  options: FitOption[];
};

const QUESTIONS: FitQuestion[] = [
  {
    title: 'How do you measure roofs today?',
    options: [
      { id: 'plans', label: 'Printed plans, scaled by hand', icon: 'ruler', weight: 2, because: 'You measure from printed plans. QuoteCore+ reads the same plan digitally, so the ruler stays in the drawer.' },
      { id: 'satellite', label: 'Satellite images like Google Earth', icon: 'roof', weight: 2, because: 'You measure from satellite images. AI Scan Assist finds the roof areas and edge lengths for you.' },
      { id: 'onsite', label: 'On site, with a tape', icon: 'people', weight: 2, because: 'You climb the roof to measure. Most of those trips become optional once a plan or photo can do the measuring.' },
      { id: 'mix', label: 'Two or more of these', icon: 'check', weight: 2, because: 'You mix measuring methods to get the job done. One digital workflow replaces the lot.' },
    ],
  },
  {
    title: 'Where do your prices live?',
    options: [
      { id: 'spreadsheet', label: 'A spreadsheet', icon: 'calculator', weight: 2, because: 'Your pricing lives in a spreadsheet. Smart Components remembers your rates, waste factors and pack sizes, and applies them for you.' },
      { id: 'notebook', label: 'A notebook, or in my head', icon: 'document', weight: 2, because: 'Your pricing lives in a notebook or your head. Smart Components keeps that know-how safe and does the maths for you.' },
      { id: 'custom', label: 'Custom software I had built', icon: 'spark', weight: 1, because: 'You have already invested in custom pricing. Smart Components gives you that flexibility without the maintenance.' },
      { id: 'app', label: 'Another quoting app', icon: 'roof', weight: 1, because: 'You already quote digitally. QuoteCore+ adds real takeoff and material logic on top of templates.' },
    ],
  },
  {
    title: 'How long does one quote take you?',
    options: [
      { id: 'short', label: 'Under 30 minutes', icon: 'clock', weight: 0, because: 'Your quotes already come together fast. QuoteCore+ keeps it that way as your volume grows.' },
      { id: 'mid', label: '30 minutes to a couple of hours', icon: 'clock', weight: 1, because: 'Each quote costs you an hour or two. QuoteCore+ cuts that back to minutes.' },
      { id: 'long', label: 'Half a day or more', icon: 'clock', weight: 2, because: 'One quote eats half a day. That is exactly the time QuoteCore+ gives back.' },
    ],
  },
];

const SPEED_OPTIONS: Array<{ id: string; label: string; weight: number; because: string }> = [
  { id: 'yes', label: 'Yes', weight: 1, because: 'You are already looking to speed up quoting. You will feel the difference within the first week.' },
  { id: 'no', label: 'No', weight: 0, because: 'You are not in a rush to change. You will still get the time back on every job.' },
];

const ACCURACY_OPTIONS: Array<{ id: string; label: string; weight: number; because: string }> = [
  { id: 'yes', label: 'Yes', weight: 2, because: 'Missed items and underpriced jobs are expensive. Component-based pricing catches what memory misses.' },
  { id: 'sometimes', label: 'Sometimes', weight: 1, because: 'The odd slipped item still stings. Smart Components makes those slips rare.' },
  { id: 'no', label: 'No', weight: 0, because: 'Your numbers are solid. Smart Components keeps them that way on every quote.' },
];

const TIERS = [
  { min: 7, verdict: 'Strong fit.', sub: 'You are exactly who we built QuoteCore+ for.' },
  { min: 4, verdict: 'Great fit.', sub: 'QuoteCore+ will save you real time on every job.' },
  { min: 0, verdict: 'Good fit.', sub: 'There is clear upside here for you.' },
];

const ADVANCE_MS = 260;

function track(name: string, params?: Record<string, string | number>) {
  const w = window as unknown as { gtag?: (...args: unknown[]) => void };
  w.gtag?.('event', name, params);
}

export function FitQuizSection() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<FitOption[]>([]);
  const [speed, setSpeed] = useState<(typeof SPEED_OPTIONS)[number] | null>(null);
  const [accuracy, setAccuracy] = useState<(typeof ACCURACY_OPTIONS)[number] | null>(null);
  const [locked, setLocked] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const started = useRef(false);
  const reported = useRef(false);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const score = answers.reduce((total, a) => total + a.weight, 0)
    + (speed?.weight ?? 0)
    + (accuracy?.weight ?? 0);
  const tier = TIERS.find(t => score >= t.min) ?? TIERS[TIERS.length - 1];

  useEffect(() => {
    if (step === 4 && !reported.current) {
      reported.current = true;
      track('quiz_complete', { tier: tier.verdict.replace('.', '').toLowerCase(), score });
    }
  }, [step, tier, score]);

  function choose(option: FitOption) {
    if (locked) return;
    if (!started.current) {
      started.current = true;
      track('quiz_start');
    }
    setLocked(option.id);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setAnswers(prev => [...prev, option]);
      setLocked(null);
      setStep(prev => prev + 1);
    }, ADVANCE_MS);
  }

  function goBack() {
    if (step === 0) return;
    setStep(prev => prev - 1);
    if (step < 4) setAnswers(prev => prev.slice(0, Math.max(0, prev.length - 1)));
    setLocked(null);
  }

  function retake() {
    setStep(0);
    setAnswers([]);
    setSpeed(null);
    setAccuracy(null);
    setLocked(null);
  }

  const progressLabel = step >= 4 ? 'Your result' : step === 3 ? 'Question 4 of 4' : `Question ${step + 1} of 4`;
  const because = step >= 4
    ? [...answers, speed, accuracy]
        .filter((x): x is FitOption => x !== null)
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 3)
    : [];

  return (
    <section id="fit-check" className={`${s.section} ${s.fitSection}`} aria-labelledby="fit-title">
      <div className={s.container}>
        <div className={s.fitGrid}>
          <div>
            <p className={s.eyebrow}>20-second check</p>
            <h2 id="fit-title" className={s.sectionTitle}>Is QuoteCore+ for you?</h2>
            <p className={s.bodyCopy}>Four quick questions about how you quote today. Tap an answer, keep moving. Your own answers build the verdict.</p>
          </div>
          <div className={s.fitCard}>
            <div className={s.fitAtmosphere} aria-hidden="true" />
            <div className={s.fitProgress} aria-hidden="true">
              {[0, 1, 2, 3].map(i => (
                <span key={i} className={i <= Math.min(step, 3) ? s.fitSegDone : s.fitSeg} />
              ))}
              <span className={s.fitProgressLabel}>{progressLabel}</span>
            </div>
            <div className={s.fitBody} key={step}>
              {step < 3 && (
                <div className={s.fitAnimate}>
                  <p className={s.fitQuestion}>{QUESTIONS[step].title}</p>
                  <div className={s.fitChoices} role="group" aria-label={QUESTIONS[step].title}>
                    {QUESTIONS[step].options.map(option => (
                      <button
                        key={option.id}
                        type="button"
                        className={s.fitChoice}
                        data-selected={locked === option.id}
                        onClick={() => choose(option)}
                      >
                        <span className={s.fitChoiceIcon}><Icon name={option.icon} size={20} /></span>
                        <span>{option.label}</span>
                        <span className={s.fitCheck}><Icon name="check" size={12} /></span>
                      </button>
                    ))}
                  </div>
                  {step > 0 && (
                    <button type="button" className={s.fitBack} onClick={goBack}>Back</button>
                  )}
                </div>
              )}
              {step === 3 && (
                <div className={s.fitAnimate}>
                  <p className={s.fitQuestion}>Nearly there. Two quick ones.</p>
                  <div className={s.fitDuo}>
                    <fieldset className={s.fitFieldset}>
                      <legend className={s.fitDuoLegend}>Actively looking to speed up your quoting?</legend>
                      <div className={s.fitPills}>
                        {SPEED_OPTIONS.map(o => (
                          <button key={o.id} type="button" className={s.fitPill} aria-pressed={speed?.id === o.id} onClick={() => setSpeed(o)}>{o.label}</button>
                        ))}
                      </div>
                    </fieldset>
                    <fieldset className={s.fitFieldset}>
                      <legend className={s.fitDuoLegend}>Do you ever miss items or underprice a job?</legend>
                      <div className={s.fitPills}>
                        {ACCURACY_OPTIONS.map(o => (
                          <button key={o.id} type="button" className={s.fitPill} aria-pressed={accuracy?.id === o.id} onClick={() => setAccuracy(o)}>{o.label}</button>
                        ))}
                      </div>
                    </fieldset>
                  </div>
                  <div className={s.fitContinueRow}>
                    <button type="button" className={s.fitPrimary} disabled={!speed || !accuracy} onClick={() => setStep(4)}>
                      See my result
                      <Icon name="arrow" size={16} />
                    </button>
                  </div>
                  <button type="button" className={s.fitBack} onClick={goBack}>Back</button>
                </div>
              )}
              {step === 4 && (
                <div className={s.fitAnimate}>
                  <h3 className={s.fitResultHeadline}><span>{tier.verdict}</span></h3>
                  <p className={s.fitResultSub}>{tier.sub}</p>
                  <p className={s.fitBecauseLabel}>Because you told us:</p>
                  <ul className={s.fitBecauseList}>
                    {because.map(b => (
                      <li key={b.because}><Icon name="check" size={16} /><span>{b.because}</span></li>
                    ))}
                  </ul>
                  <div className={s.fitCtas}>
                    <MarketingButton
                      href="/pricing"
                      variant="primary"
                      icon={<Icon name="arrow" size={16} />}
                      onClick={() => track('quiz_cta_click', { cta: 'build_plan' })}
                    >
                      Build your plan
                    </MarketingButton>
                    <a
                      className={s.fitCtaSecondary}
                      href="/demo"
                      onClick={() => track('quiz_cta_click', { cta: 'demo' })}
                    >
                      <span>See how it works</span>
                      <Icon name="play" size={16} />
                    </a>
                    <a
                      className={s.fitCtaSecondary}
                      href="#setup"
                      onClick={() => track('quiz_cta_click', { cta: 'done_for_you' })}
                    >
                      <span>Have us set it up</span>
                      <Icon name="people" size={16} />
                    </a>
                  </div>
                  <button type="button" className={s.fitRetake} onClick={retake}>Not quite you? Retake</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
