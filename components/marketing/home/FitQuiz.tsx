'use client';

import { useEffect, useRef, useState } from 'react';
import { MarketingButton } from '@/components/marketing/MarketingButton';
import { FocusDialog } from './FocusDialog';
import { Icon, type IconName } from './Icon';
import s from './Homepage.module.css';
import n from './ExploreNextSteps.module.css';

/**
 * "Is QuoteCore+ for you?" - four-step self-qualification quiz.
 * Dark Focus card styled as a sibling of the /pricing V5 calculator.
 * Owner review 2026-10-08: clickable progress bars for completed steps,
 * Back moved under the progress label, equal gaps around the progress bar,
 * Q4 heading removed with an orange "Want to speed up your pricing process?",
 * result sub-line removed, CTAs open in new tabs, all-positive tiers,
 * "because" lines from the visitor's own answers, no em dashes in copy.
 * Owner review 2026-10-09 (round 2): all progress bars share one baseline,
 * question text pulled up closer to the bars with a clear gap before the
 * options, both Q4 questions orange, "See my result" under the right-hand
 * question, result label optically in line with the bars, fixed min-height
 * replaced by a measured shrink-to-fit body.
 * Owner review 2026-10-09 (round 3, verified in headless Chromium): the
 * module's scoped reset (.root h1/h2/h3/p { margin: 0 }) out-specifies
 * single-class rules, so every question/label margin silently computed to
 * 0. Quiz rules now carry .fitBody + element specificity to win. The Back
 * slot is reserved on every step (including Q1 and the result) so the
 * question baseline sits at one identical height on all screens. Body
 * height was measured from the inner wrapper.
 * 2026-10-12: controlled modal, stable outer height, responsive internal
 * scrolling, step focus and cancellation of pending answers when closed.
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
      { id: 'plans', label: 'Printed plans, scaled by hand', icon: 'ruler', weight: 2, because: 'You work from plans. Upload and calibrate a plan to measure it digitally in QuoteCore+.' },
      { id: 'satellite', label: 'Satellite images like Google Earth', icon: 'roof', weight: 2, because: 'You work from satellite images. Bring a suitable image into the app, calibrate the scale and measure from there.' },
      { id: 'onsite', label: 'On site, with a tape', icon: 'people', weight: 2, because: 'You measure on site. Enter your measurements and use your saved pricing to build the quote.' },
      { id: 'mix', label: 'Two or more of these', icon: 'check', weight: 2, because: 'You use a mix of methods. Enter your own measurements or measure a calibrated plan in the app.' },
    ],
  },
  {
    title: 'Where do your prices live?',
    options: [
      { id: 'spreadsheet', label: 'A spreadsheet', icon: 'calculator', weight: 2, because: 'Your pricing lives in a spreadsheet. Smart Components™ remembers your rates, waste factors and pack sizes, and applies them for you.' },
      { id: 'notebook', label: 'A notebook, or in my head', icon: 'document', weight: 2, because: 'Your pricing lives in a notebook or your head. Smart Components™ keeps that know-how safe and does the maths for you.' },
      { id: 'custom', label: 'Custom software I had built', icon: 'spark', weight: 1, because: 'Your pricing needs flexibility. Smart Components™ lets you set up your own rates and calculation rules.' },
      { id: 'app', label: 'Another quoting app', icon: 'roof', weight: 1, because: 'You already quote digitally. Explore measuring, component pricing and documents in one app.' },
    ],
  },
  {
    title: 'How long does one quote take you?',
    options: [
      { id: 'short', label: 'Under 30 minutes', icon: 'clock', weight: 0, because: 'You already quote quickly. Saved pricing and reusable documents can help with repeat work.' },
      { id: 'mid', label: '30 minutes to a couple of hours', icon: 'clock', weight: 1, because: 'Quoting takes time. Reuse your pricing and turn measurements into a quote with less repeated work.' },
      { id: 'long', label: 'Half a day or more', icon: 'clock', weight: 2, because: 'Your quotes take half a day or more. Connected measuring, pricing and documents can reduce the manual steps.' },
    ],
  },
];

const SPEED_OPTIONS: Array<{ id: string; label: string; weight: number; because: string }> = [
  { id: 'yes', label: 'Yes', weight: 1, because: 'You want faster pricing. Set up your rates and rules, then reuse them across jobs.' },
  { id: 'no', label: 'No', weight: 0, because: 'Speed is not your main concern. You can still keep your measurements, pricing and documents together.' },
];

const ACCURACY_OPTIONS: Array<{ id: string; label: string; weight: number; because: string }> = [
  { id: 'yes', label: 'Yes', weight: 2, because: 'You want fewer missed items. Build materials, waste and pricing rules into your saved components.' },
  { id: 'sometimes', label: 'Sometimes', weight: 1, because: 'You sometimes miss items. Saved component rules can help you include the details consistently.' },
  { id: 'no', label: 'No', weight: 0, because: 'You are confident in your numbers. Save your pricing rules and reuse them on future quotes.' },
];

const TIERS = [
  { min: 7, verdict: 'Strong fit.' },
  { min: 4, verdict: 'Great fit.' },
  { min: 0, verdict: 'Good fit.' },
];

const ADVANCE_MS = 260;

function track(name: string, params?: Record<string, string | number>) {
  const w = window as unknown as { gtag?: (...args: unknown[]) => void };
  w.gtag?.('event', name, params);
}

export function FitQuizDialog({ open, onClose, demoHref = '/demo', pricingHref = '/pricing', setupHref = '/#setup' }: {
  open: boolean; onClose: () => void; demoHref?: string; pricingHref?: string; setupHref?: string;
}) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<FitOption[]>([]);
  const [speed, setSpeed] = useState<(typeof SPEED_OPTIONS)[number] | null>(null);
  const [accuracy, setAccuracy] = useState<(typeof ACCURACY_OPTIONS)[number] | null>(null);
  const [locked, setLocked] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const reported = useRef(false);

  // Keep completed answers when closed, but cancel an in-flight answer advance.
  useEffect(() => {
    if (!open) setLocked(null);
    return () => { if (timer.current !== null) window.clearTimeout(timer.current); };
  }, [open]);

  const previousStep = useRef(step);
  useEffect(() => {
    if (open && previousStep.current !== step) {
      bodyRef.current?.querySelector<HTMLElement>('[data-step-heading]')?.focus({ preventScroll: true });
      bodyRef.current?.closest('dialog')?.scrollTo?.({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
    previousStep.current = step;
  }, [open, step]);

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
      timer.current = null;
      setAnswers(prev => [...prev.slice(0, step), option]);
      setLocked(null);
      setStep(prev => prev + 1);
    }, ADVANCE_MS);
  }

  function jumpTo(target: number) {
    if (target < 0 || target >= step) return;
    if (timer.current !== null) window.clearTimeout(timer.current);
    setStep(target);
    if (target < 3) setAnswers(prev => prev.slice(0, target));
    setLocked(null);
  }

  function goBack() {
    jumpTo(step - 1);
  }

  function retake() {
    if (timer.current !== null) window.clearTimeout(timer.current);
    started.current = false;
    reported.current = false;
    setStep(0);
    setAnswers([]);
    setSpeed(null);
    setAccuracy(null);
    setLocked(null);
  }

  const progressLabel = step >= 4 ? 'Your result' : step === 3 ? 'Step 4 of 4' : `Step ${step + 1} of 4`;
  const because = step >= 4
    ? [...answers, speed, accuracy]
        .filter((x): x is FitOption => x !== null)
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 3)
    : [];

  return open ? <FocusDialog title="Is QuoteCore+ for you?" eyebrow="15-second check" className={n.quizDialog} onClose={onClose}>
      <div id="fit-check" className={s.fitModalContent}>
        <p className={n.quizIntro}>Four quick steps about how you quote today. No sign-up needed.</p>
          <div className={`${s.fitCard} ${n.quizSurface}`}>
            <div className={s.fitAtmosphere} aria-hidden="true" />
            <div className={`${s.fitProgressWrap} ${n.quizProgress}`}>
              <div className={s.fitProgressBars} role="group" aria-label="Quiz progress">
                {[0, 1, 2, 3].map(i => i < step ? (
                  <button
                    key={i}
                    type="button"
                    className={s.fitSegBtn}
                    aria-label={`Back to step ${i + 1}`}
                    onClick={() => jumpTo(i)}
                  >
                    <span className={s.fitSegDone} />
                  </button>
                ) : (
                  <span key={i} className={i === step ? s.fitSegDone : s.fitSeg} aria-hidden="true" />
                ))}
              </div>
              <div className={s.fitProgressSide}>
                <span className={s.fitProgressLabel}>{progressLabel}</span>
                <span className={s.fitBackSlot}>
                  {step > 0 && step < 4 && (
                    <button type="button" className={s.fitBack} onClick={goBack}>Back</button>
                  )}
                </span>
              </div>
            </div>
            <div className={`${s.fitBody} ${n.quizBody}`} key={step} ref={bodyRef}>
              {step < 3 && (
                <div className={s.fitAnimate}>
                  <p className={s.fitQuestion} tabIndex={-1} data-step-heading>{QUESTIONS[step].title}</p>
                  <div className={`${s.fitChoices} ${n.quizButtons}`} role="group" aria-label={QUESTIONS[step].title}>
                    {QUESTIONS[step].options.map(option => (
                      <button
                        key={option.id}
                        type="button"
                        className={s.fitChoice}
                        data-selected={locked === option.id}
                        aria-pressed={locked === option.id}
                        onClick={() => choose(option)}
                      >
                        <span className={s.fitChoiceIcon}><Icon name={option.icon} size={20} /></span>
                        <span>{option.label}</span>
                        <span className={s.fitCheck}><Icon name="check" size={12} /></span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {step === 3 && (
                <div className={s.fitAnimate}>
                  <div className={s.fitDuo}>
                    <fieldset className={s.fitFieldset}>
                      <legend className={s.fitDuoLegend} tabIndex={-1} data-step-heading>Want to speed up your pricing process?</legend>
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
                      <div className={s.fitContinue}>
                        <button type="button" className={s.fitPrimary} disabled={!speed || !accuracy} onClick={() => setStep(4)}>
                          See my result
                          <Icon name="arrow" size={16} />
                        </button>
                      </div>
                    </fieldset>
                  </div>
                </div>
              )}
              {step === 4 && (
                <div className={s.fitAnimate}>
                  <h3 className={s.fitResultHeadline} tabIndex={-1} data-step-heading><span>{tier.verdict}</span></h3>
                  <p className={s.fitBecauseLabel}>Because you told us:</p>
                  <ul className={s.fitBecauseList}>
                    {because.map(b => (
                      <li key={b.because}><Icon name="check" size={16} /><span>{b.because}</span></li>
                    ))}
                  </ul>
                  <div className={s.fitCtas}>
                    <MarketingButton
                      href={pricingHref}
                      variant="primary"
                      target="_blank"
                      rel="noopener noreferrer"
                      icon={<Icon name="arrow" size={16} />}
                      onClick={() => track('quiz_cta_click', { cta: 'build_plan' })}
                    >
                      Build your plan
                    </MarketingButton>
                    <a
                      className={s.fitCtaSecondary}
                      href={demoHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => track('quiz_cta_click', { cta: 'demo' })}
                    >
                      <span>See how it works</span>
                      <Icon name="play" size={16} />
                    </a>
                    <a
                      className={s.fitCtaSecondary}
                      href={setupHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => track('quiz_cta_click', { cta: 'done_for_you' })}
                    >
                      <span>Have us set it up</span>
                      <Icon name="people" size={16} />
                    </a>
                  </div>
                  <button type="button" className={`${s.fitRetake} ${n.quizRetake}`} onClick={retake}>Not quite you? Retake</button>
                </div>
              )}
            </div>
          </div>
      </div>
    </FocusDialog> : null;
}
