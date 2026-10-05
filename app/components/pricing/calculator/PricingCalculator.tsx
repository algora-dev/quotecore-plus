'use client';
import { useEffect, useId, useMemo, useReducer, useRef, useState, type FocusEvent } from 'react';
import { QcButton, QcLinkButton } from '../../ui/v2/QcButton';
import type { PricingCalculatorProps, CalculatorAnswers } from './types';
import { answersReducer, EMPTY_ANSWERS, type AnswerAction } from './state';
import { calculatePlan, hasPlans, isCurrentSetup, makeIntent, normalizeAnswers } from './routing';
import { isComplete, parseAnswers, validateCatalog } from './validation';
import { safeNavigationHref } from './persistence';
import { DeviceQuestion, VolumeQuestion, MeasurementQuestion, ToolsQuestion, Disclosure } from './WorkflowQuestions';
import { AssistantQuestion } from './AssistantQuestion';
import { PlanSummary } from './PlanSummary';
import { ResultActions } from './ResultActions';
import { StoryPanel } from './StoryPanel';
import { Icon } from './Choice';
import { adjacentScreen, screenReady, stageFor, progressFor, STAGES, type Screen } from './flow';
import './calculator.css';

const TITLES: Record<Screen, string> = {
  device: 'Where will you work most?', workload: 'How many jobs do you price in a typical month?',
  measurements: 'How do you get your measurements?', tools: 'Make the plan work for you.',
  assistant: 'How much help would you like?', review: 'A setup for the way you work.',
};
const INTROS: Record<Screen, string> = {
  device: 'Pick what sounds most like your day.', workload: 'A starting estimate is all we need.',
  measurements: '', tools: 'Choose the tools that earn their place.',
  assistant: 'One Smart Assistant. Your choice of allowance.', review: '',
};
/** One answer state, one pricing engine, one DOM across phone/desktop.
 * The host owns auth, payment, persistence and the final continuation. */
export function PricingCalculator(props: PricingCalculatorProps) {
  const issues = validateCatalog(props.catalog);
  const badInitial = !issues.length && props.initialAnswers && (!parseAnswers(props.initialAnswers) || (props.initialAnswers.quotesPerMonth !== null && props.initialAnswers.quotesPerMonth > props.catalog.thresholds.maxInput));
  if (issues.length || badInitial) return <section data-qc-ui="v2" className="qcp">
    <div className="qcp-error" role="alert"><h2>Pricing is unavailable right now.</h2><p>We cannot safely calculate this setup. Refresh or contact support; no subscription has changed.</p></div>
  </section>;
  return <CalculatorInner {...props} key={`${props.catalog.id}:${props.catalog.revision}`} />;
}
function CalculatorInner({ catalog, variant = 'page', initialAnswers, startAtReview = false, currentSubscription,
  onContinue, continueHref, continueLabel, resultActions, notice }: PricingCalculatorProps) {
  const id = useId();
  const [answers, rawDispatch] = useReducer(answersReducer, initialAnswers ?? EMPTY_ANSWERS, normalizeAnswers);
  const [screen, setScreen] = useState<Screen>(startAtReview && initialAnswers && isComplete(initialAnswers, catalog) ? 'review' : 'device');
  const [draft, setDraft] = useState(initialAnswers?.quotesPerMonth?.toString() ?? '');
  const [editing, setEditing] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const footer = useRef<HTMLElement>(null);
  const shouldFocus = useRef(false);
  const active = useRef(true);
  const busy = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => {
    if (shouldFocus.current) {
      // One document scroller: window.scrollTo ONLY. scrollIntoView() cascades
      // through every scrollable ancestor and jumps the page around on tall
      // hosts (owner-reported 2026-10-05). Align the flow top under the host's
      // sticky header, smoothly, honouring reduced-motion.
      shouldFocus.current = false;
      const el = frame.current;
      if (el) {
        const headerOffset = parseFloat(getComputedStyle(el).getPropertyValue('--qcp-header-offset')) || 0;
        const top = Math.max(0, el.getBoundingClientRect().top + window.scrollY - headerOffset - 8);
        const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
        window.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
      }
      heading.current?.focus({ preventScroll: true });
    }
  }, [screen]);
  function keepFocusVisible(event: FocusEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.matches('input,button,a,summary') || footer.current?.contains(target) || target.closest('dialog')) return;
    // Native focus scrolling does not account for a sticky sibling footer.
    // Measure the real bar (including wrapping and safe-area padding), not a fixed height.
    requestAnimationFrame(() => {
      if (!target.isConnected || !frame.current || !footer.current) return;
      const visualTarget = target.matches('input') ? target.closest('label') ?? target : target;
      const bounds = visualTarget.getBoundingClientRect();
      const bar = footer.current.getBoundingClientRect();
      const headerOffset = parseFloat(getComputedStyle(frame.current).getPropertyValue('--qcp-header-offset')) || 0;
      const top = headerOffset + 12;
      const bottom = Math.min(window.innerHeight, bar.top) - 12;
      if (bounds.height > bottom - top || bounds.top < top) window.scrollBy({ top: bounds.top - top, behavior: 'auto' });
      else if (bounds.bottom > bottom) window.scrollBy({ top: bounds.bottom - bottom, behavior: 'auto' });
    });
  }
  const result = useMemo(() => calculatePlan(answers, catalog), [answers, catalog]);
  const complete = isComplete(answers, catalog);
  const intent = complete ? makeIntent(answers, catalog) : null;
  const ready = screenReady(screen, answers, catalog);
  const unchanged = result ? isCurrentSetup(result, catalog, currentSubscription) : false;
  const progress = progressFor(screen, answers);
  const stage = progress.index;
  let href: string | undefined;
  try { const candidate = intent && continueHref ? continueHref(intent) : undefined; if (candidate && safeNavigationHref(candidate)) href = candidate; } catch { /* An unsafe host URL never becomes an executable link. */ }
  function dispatch(action: AnswerAction) { if (busy.current) return; setError(''); setSuccess(''); rawDispatch(action); }
  function navigate(next: Screen) { if (busy.current) return; setAttempted(false); setError(''); shouldFocus.current = true; setScreen(next); }
  function updateDraft(value: string) {
    setDraft(value); const n = /^\d+$/.test(value) ? Number(value) : NaN;
    dispatch({ type: 'quotes', value: Number.isSafeInteger(n) && n >= 1 && n <= catalog.thresholds.maxInput ? n : null });
  }
  function next() {
    if (!ready) { setAttempted(true); return; }
    if (editing && !(screen === 'measurements' && hasPlans(answers)) && !(screen === 'workload' && answers.assistant === 'recommended')) {
      setEditing(false); navigate('review'); return;
    }
    if (editing && screen === 'workload') { navigate('assistant'); return; }
    navigate(adjacentScreen(screen, 1, answers));
  }
  function edit(nextScreen: Screen) { setEditing(true); navigate(nextScreen); }
  async function submit() {
    if (busy.current || !intent || !onContinue || unchanged || success) return;
    busy.current = true; setPending(true); setError('');
    try {
      const response = await onContinue(intent);
      if (active.current) setSuccess(response?.message ?? 'Your setup has been passed on for review. No payment is confirmed here.');
    } catch { if (active.current) setError('We could not continue. Your choices are still here. Please try again.'); }
    finally { busy.current = false; if (active.current) setPending(false); }
  }
  const label = continueLabel ?? (variant === 'page' ? 'Start with this setup' : variant === 'billing' ? 'Review subscription change' : 'Continue with this setup');
  const nextLabel = screen === 'assistant' || (editing && screen !== 'measurements' && screen !== 'workload') ? (editing ? 'Update my setup' : 'See my setup')
    : screen === 'measurements' && hasPlans(answers) ? 'Choose my tools' : 'Continue';
  const purchaseAction = href && !pending && !unchanged ? <QcLinkButton href={href} variant="primary" className="qcp-next" size="lg">{label}<Icon name="arrow" size={18} /></QcLinkButton>
              : <QcButton variant="primary" className="qcp-next" size="lg" pending={pending} disabled={!onContinue || !complete || unchanged || !!success} onClick={() => void submit()}>{pending ? 'Continuing…' : unchanged ? 'Your current setup' : success ? (catalog.stage === 'preview' ? 'Preview recorded' : 'Setup passed on') : label}{!pending && !success && <Icon name="arrow" size={18} />}</QcButton>;
  return <section data-qc-ui="v2" data-qc-component="pricing-selector-v5" className="qcp" data-variant={variant} data-screen={screen} aria-label="Configure your QuoteCore+ subscription">
    {notice && <p className="qcp-note qcp-host-notice" role="status">{notice}</p>}
    <div className="qcp-shell" data-review={screen === 'review' || undefined}>
      {screen !== 'review' && <StoryPanel screen={screen} answers={answers} />}
      <div className="qcp-flow" ref={frame} onFocusCapture={keepFocusVisible}>
        <nav className="qcp-progress" aria-label="Setup progress">
          {screen === 'review' ? <p className="qcp-progress-ready"><Icon name="check" size={18} />Your setup is ready</p> :
            <ol style={{ gridTemplateColumns: `repeat(${progress.total},minmax(0,1fr))` }}>{progress.questions.map((step, index) => <li key={step} aria-current={index === stage ? 'step' : undefined} data-done={index < stage || undefined}>
              <span className="qcp-progress-track" />
              {index < stage
                ? <button type="button" className="qcp-progress-label qcp-progress-jump" onClick={() => { setEditing(false); navigate(step); }} disabled={pending} title={`Back to ${STAGES[stageFor(step)]}`}><Icon name="check" size={12} />{STAGES[stageFor(step)]}</button>
                : <span className="qcp-progress-label"><span>{index + 1}</span>{STAGES[stageFor(step)]}</span>}
            </li>)}</ol>}
        </nav>
        <div className="qcp-question" key={screen}>
          <header className={`qcp-question-header${screen === 'review' ? ' qcp-review-header' : ''}`}>
            {screen !== 'review' && <p className="qcp-step-kicker">{String(stage + 1).padStart(2, '0')}<span>/ {String(progress.total).padStart(2, '0')}</span> {STAGES[stageFor(screen)].toUpperCase()}</p>}
            {screen === 'device' && <div className="qcp-mobile-proposition"><strong>Only pay for what helps you.</strong><p>Choose tools for the way you work, not a bundle you won’t use.</p><span>Your tailored price in less than a minute. No signup.</span></div>}
            <h2 ref={heading} tabIndex={-1} className={`qcp-question-title${screen === 'review' ? ' qcp-sr-only' : ''}`}>{TITLES[screen]}</h2>
            {INTROS[screen] && <p className="qcp-intro">{INTROS[screen]}</p>}
          </header>
          <fieldset disabled={pending} className="qcp-fieldset qcp-body"><legend className="qcp-sr-only">{screen === 'tools' ? 'Optional digital tools' : STAGES[stage]}</legend>
            {screen === 'device' && <DeviceQuestion answers={answers} dispatch={dispatch} id={id} />}
            {screen === 'workload' && <VolumeQuestion catalog={catalog} result={result} dispatch={dispatch} answers={answers} draft={draft} onDraft={updateDraft} id={id} attempted={attempted} />}
            {screen === 'measurements' && <MeasurementQuestion answers={answers} dispatch={dispatch} id={id} />}
            {screen === 'tools' && result && <ToolsQuestion result={result} catalog={catalog} answers={answers} dispatch={dispatch} id={id} />}
            {screen === 'assistant' && result && <AssistantQuestion answers={answers} result={result} catalog={catalog} dispatch={dispatch} id={id} />}
            {screen === 'review' && <><PlanSummary answers={answers} result={result} catalog={catalog} current={variant === 'billing' ? currentSubscription : undefined}
              primaryAction={purchaseAction}
              actionNotice={<>{error && <p className="qcp-error" role="alert">{error}</p>}{success && <p className="qcp-note" role="status">{success}</p>}</>}
              actions={resultActions && result && intent && variant === 'page' ? <ResultActions intent={intent} result={result} catalog={catalog} options={resultActions} disabled={pending} /> : undefined} />
              <Disclosure title="Edit your choices"><div className="qcp-edit-row">
                {(['device','workload','measurements', ...(hasPlans(answers) ? ['tools'] : []), 'assistant'] as Screen[]).map(s => <QcButton key={s} variant="glass" className="qcp-clear" onClick={() => edit(s)}><Icon name="edit" size={14} />Edit {s === 'device' ? 'device' : s === 'workload' ? 'workload' : s === 'measurements' ? 'measurements' : s === 'tools' ? 'tools' : 'Assistant'}</QcButton>)}
              </div></Disclosure>
            </>}
          </fieldset>
          {attempted && !ready && screen !== 'workload' && <p role="alert" className="qcp-error">{screen === 'device' ? 'Choose the device you will use most.' : 'Choose at least one measurement method.'}</p>}
          {screen !== 'review' && error && <p className="qcp-error" role="alert">{error}</p>}
          {screen !== 'review' && success && <p className="qcp-note" role="status">{success}</p>}
          {screen === 'review' && !onContinue && !href && <p className="qcp-note">The next action is not connected yet. You can review and edit this setup; nothing has been purchased.</p>}
        </div>
        <footer className="qcp-nav" ref={footer}>
          {screen === 'review' && <p className="qcp-review-footer-note">Your setup is yours to change. Nothing has been purchased here.</p>}
          <div className="qcp-nav-buttons">
            {screen !== 'device' && <QcButton className="qcp-clear qcp-back" variant="glass" aria-label="Back" disabled={pending} onClick={() => { setEditing(false); navigate(adjacentScreen(screen, -1, answers)); }}><Icon name="back" size={18} /><span>Back</span></QcButton>}
            {screen === 'device' && <p className="qcp-nav-hint">Your price comes<br />at the end.</p>}
            {screen !== 'review' ? <QcButton variant="primary" className="qcp-next" size="lg" disabled={pending} onClick={next}>{nextLabel}<Icon name="arrow" size={18} /></QcButton>
 : null}
          </div>
        </footer>
      </div>
    </div>
  </section>;
}
export type { CalculatorAnswers };
