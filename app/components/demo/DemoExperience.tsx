'use client';
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter } from 'next/navigation';
import { QcButton, QcLinkButton } from '@/app/components/ui/v2/QcButton';
import { QcDialog } from '@/app/components/ui/v2/QcDialog';
import { activeGuideStep, DEMO_GUIDE_CHAPTERS, SKIP_REQUIRED_EVENTS, guideProgress } from '@/app/lib/demo/guide';
import type { DemoGuideState } from '@/app/lib/demo/model';
import type { GuideCommand } from '@/app/lib/demo/commands';
import { normalAccountHref } from '@/app/lib/demo/routing';
import { assistantExample, chapterOutcome, clampGuidePosition, demoSystemLabel, guideLocation, readComponentSurface, shouldAdvanceToCustomer, type DemoComponentSurface, type DemoSystem } from '@/app/lib/demo/presentation';
import { demoJsonRequest, demoRequest, safeDemoHref } from '@/app/lib/demo/client-request';
import { useDemoSession } from './useDemoSession';
import { DemoUnitChoice } from './DemoUnitChoice';
import './demo-experience.css';

type Props = { workspaceSlug: string; sessionId: string; expiresAt: string; initialState: DemoGuideState };
type Position = { x: number; y: number };

/** Guide copy marks real in-app controls as *Action*; rendered orange and bold. */
function guideCopy(text?: string) {
  const parts = (text ?? '').split(/\*([^*]+)\*/g);
  return parts.map((part, index) => index % 2 ? <strong key={index} className="qc-demo-act">{part}</strong> : part);
}

export function DemoExperience({ workspaceSlug, sessionId, expiresAt, initialState }: Props) {
  const router = useRouter(); const pathname = usePathname();
  const session = useDemoSession(sessionId, expiresAt, initialState);
  const { state, units, allowance, features, guidedQuote, expired, pending, syncError, refresh } = session;
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(initialState.mode === 'guided' || !initialState.welcomed);
  const [error, setError] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetUnits, setResetUnits] = useState<DemoSystem | null>(null);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const [surface, setSurface] = useState<DemoComponentSurface | null>(null);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [triedAdding, setTriedAdding] = useState(false);
  const [guidedTakeoffDone, setGuidedTakeoffDone] = useState(false);
  const [awaitingPath, setAwaitingPath] = useState<string | null>(null);
  const [navigationSlow, setNavigationSlow] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const [copying, setCopying] = useState(false);
  const [mobileNotice, setMobileNotice] = useState(false);
  const [quoteNotice, setQuoteNotice] = useState('');
  const quoteSeen = useRef<string | undefined>(undefined);
  const widget = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const promptBox = useRef<HTMLTextAreaElement>(null);
  const resetBusy = useRef(false);
  const drag = useRef<{ pointerId: number; dx: number; dy: number } | null>(null);
  const autoAdvance = useRef<string | null>(null);
  const visit = useRef(0);
  const stateMode = useRef(initialState.mode);
  const alive = useRef(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout>>();
  const prefillAcked = useRef(false);
  // Owner 2026-10-12: the touch takeoff requests element fullscreen (Android).
  // Anything portaled to document.body is NOT rendered while an element owns
  // the screen - re-portal the guide into the fullscreen element so the helper
  // stays visible during the whole takeoff.
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);

  const step = activeGuideStep(state);
  const progress = guideProgress(state);
  const chapterIndex = Math.max(0, DEMO_GUIDE_CHAPTERS.findIndex(chapter => chapter.id === state.chapter));
  const chapter = DEMO_GUIDE_CHAPTERS[chapterIndex];
  const nextChapter = DEMO_GUIDE_CHAPTERS[chapterIndex + 1];
  const stepIndex = step ? Math.max(0, chapter.steps.findIndex(item => item.event === step.event)) : chapter.steps.length;
  const location = guideLocation(workspaceSlug, state, pathname, surface);
  const reviewing = !!step && state.review_event === step.event;
  const required = !reviewing && !!step && SKIP_REQUIRED_EVENTS.includes(step.event);
  const finished = progress.handled === progress.total;
  const assistantStep = step?.target === 'assistant';
  const assistantNeedsDraft = step?.event === 'assistant.edited' && !state.assistant_quote_id;
  const assistantFoundReady = step?.event === 'assistant.found' && !!state.assistant_found_ready_at && !!state.assistant_found_record_ids?.length;
  const assistantFoundCount = assistantFoundReady ? state.assistant_found_record_ids?.length ?? 0 : 0;
  const assistantUnavailable = assistantStep && features !== null && !features.ai;
  const assistantExhausted = assistantStep && !!allowance?.configured && allowance.turnsRemaining <= 0;
  const assistantScript = units ? assistantExample(assistantNeedsDraft ? 'assistant.created' : step?.event, units) : '';
  const expiryLabel = mounted && Number.isFinite(Date.parse(expiresAt))
    ? new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', day: 'numeric', month: 'short' }).format(new Date(expiresAt)) : 'up to 24 hours';

  useEffect(() => {
    // Phone-sized screens get a one-time heads-up before the guide starts:
    // takeoff and the assistant are built for the app, not the browser.
    if (window.innerWidth >= 768) return;
    try { if (localStorage.getItem('qc-demo-mobile-notice') === '1') return; } catch { return; }
    setMobileNotice(true);
  }, []);
  useEffect(() => {
    alive.current = true; setMounted(true);
    const component = (event: Event) => setSurface(readComponentSurface((event as CustomEvent).detail));
    const assistant = (event: Event) => setAssistantOpen((event as CustomEvent).detail?.open === true);
    const prefilled = () => { prefillAcked.current = true; clearTimeout(copyTimer.current); setCopyStatus('Ready in Smart Assistant - just tap Send.'); copyTimer.current = setTimeout(() => { if (alive.current) setCopyStatus(''); }, 7000); };
    window.addEventListener('qc-demo-component-surface', component);
    window.addEventListener('qc-assistant-visibility', assistant);
    window.addEventListener('qc-demo-assistant-prefilled', prefilled);
    window.dispatchEvent(new Event('qc-demo-component-surface-request'));
    window.dispatchEvent(new Event('qc-assistant-visibility-request'));
    return () => {
      alive.current = false; clearTimeout(copyTimer.current);
      window.removeEventListener('qc-demo-component-surface', component);
      window.removeEventListener('qc-assistant-visibility', assistant);
      window.removeEventListener('qc-demo-assistant-prefilled', prefilled);
    };
  }, []);
  useEffect(() => {
    // The helper already owns the Assistant action during that lesson. Hide
    // the redundant floating launcher so it cannot cover the mobile footer.
    const report = () => window.dispatchEvent(new CustomEvent('qc-demo-guide-visibility', { detail: { ownsAssistantEntry: open && !!assistantStep && !expired && !resetting } }));
    report(); window.addEventListener('qc-demo-guide-visibility-request', report);
    return () => {
      window.removeEventListener('qc-demo-guide-visibility-request', report);
      window.dispatchEvent(new CustomEvent('qc-demo-guide-visibility', { detail: { ownsAssistantEntry: false } }));
    };
  }, [open, assistantStep, expired, resetting]);
  useEffect(() => {
    void refresh();
    // Request the actual editor state even if the page mounted before the guide.
    window.dispatchEvent(new Event('qc-demo-component-surface-request'));
  }, [pathname, refresh]);
  useEffect(() => {
    const syncHost = () => setPortalHost(document.fullscreenElement instanceof HTMLElement ? document.fullscreenElement : null);
    syncHost();
    document.addEventListener('fullscreenchange', syncHost);
    return () => document.removeEventListener('fullscreenchange', syncHost);
  }, []);
  useEffect(() => {
    if (stateMode.current !== state.mode) setOpen(state.mode === 'guided');
    stateMode.current = state.mode;
  }, [state.mode]);
  useEffect(() => {
    if (!awaitingPath) return;
    if (pathname === awaitingPath) { setAwaitingPath(null); setNavigationSlow(false); return; }
    const timer = setTimeout(() => setNavigationSlow(true), 10_000);
    return () => clearTimeout(timer);
  }, [pathname, awaitingPath]);
  useEffect(() => { setCopyStatus(''); setError(''); setGuidedTakeoffDone(false); }, [step?.event, units]);
  useEffect(() => {
    const target = window as Window & { __qcDemoGuidedComponentId?: string };
    const active = state.chapter === 'takeoff' && (!state.acknowledgements['takeoff.saved'] || state.review_event === 'takeoff.saved');
    target.__qcDemoGuidedComponentId = active ? state.guided_created_component_id : undefined;
    const added = () => setTriedAdding(true);
    if (active) window.addEventListener('qc-demo-skylight', added);
    return () => { delete target.__qcDemoGuidedComponentId; window.removeEventListener('qc-demo-skylight', added); };
  }, [state.chapter, state.review_event, state.guided_created_component_id, state.acknowledgements]);

  // Customer-response notification (owner 2026-10-13): the guided quote's
  // status + first-open timestamp ride the existing 5s demo-state poll. A live
  // transition (sent→viewed, viewed→accepted/declined) announces once in the
  // guide and refreshes server-rendered badges. Transitions already present at
  // load are not announced - only changes observed while this tab is open.
  useEffect(() => {
    if (!guidedQuote) return;
    const responded = guidedQuote.status === 'accepted' || guidedQuote.status === 'declined';
    const key = responded ? guidedQuote.status : guidedQuote.viewedAt ? 'viewed' : 'sent';
    const previous = quoteSeen.current;
    quoteSeen.current = key;
    if (previous === undefined || previous === key || key === 'sent') return;
    setQuoteNotice(responded
      ? `Your demo customer ${guidedQuote.status} the quote. Its status in your account has updated.`
      : 'Your demo customer opened the quote. It now shows a Viewed status in your account.');
    setOpen(true);
    router.refresh();
  }, [guidedQuote, router]);

  // Guided takeoff choreography (owner 2026-10-12): the touch shell announces
  // the first canvas entry (landscape reached, or the flip prompt dismissed);
  // the rail announces the first real interaction (auto-collapse); the
  // components step announces the moment the visitor's chapter-1 component
  // gets an entry on the plan (completion card: explore or save & continue).
  useEffect(() => {
    const canvasEntered = () => { if (state.chapter === 'takeoff') setOpen(true); };
    const interacted = () => { if (state.chapter === 'takeoff') setOpen(false); };
    const entryAdded = () => { if (state.chapter === 'takeoff') { setGuidedTakeoffDone(true); setOpen(true); } };
    window.addEventListener('qc-demo-takeoff-canvas-entered', canvasEntered);
    window.addEventListener('qc-demo-takeoff-interaction', interacted);
    window.addEventListener('qc-demo-guided-entry-added', entryAdded);
    return () => {
      window.removeEventListener('qc-demo-takeoff-canvas-entered', canvasEntered);
      window.removeEventListener('qc-demo-takeoff-interaction', interacted);
      window.removeEventListener('qc-demo-guided-entry-added', entryAdded);
    };
  }, [state.chapter]);

  const constrain = useCallback(() => {
    if (!widget.current) return;
    const rect = widget.current.getBoundingClientRect();
    setPosition(previous => previous ? clampGuidePosition(previous, rect.width, rect.height, window.innerWidth, window.innerHeight) : null);
  }, []);
  useEffect(() => {
    if (!mounted || !open) return;
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(constrain);
    if (widget.current) observer?.observe(widget.current);
    window.addEventListener('resize', constrain);
    return () => { observer?.disconnect(); window.removeEventListener('resize', constrain); };
  }, [mounted, open, constrain]);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => { const node = event.target as HTMLElement | null; if (!node?.closest?.('.qc-demo-menu')) setMenuOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape); };
  }, [menuOpen]);

  function navigate(href: string) {
    if (!safeDemoHref(href, workspaceSlug)) { setError('This guide destination could not be verified. Open the chapter overview to continue.'); return; }
    // A fresh navigation key reopens the same component after Cancel without
    // a full reload or overwriting an already-open editor while the user types.
    let destination = href;
    if (href.includes('demoComponent=') || href.includes('demoCreate=')) {
      destination += `${href.includes('?') ? '&' : '?'}demoVisit=${Date.now()}-${++visit.current}`;
    }
    const path = href.split('?')[0];
    setAwaitingPath(path === pathname ? null : path); setNavigationSlow(false);
    router.push(destination);
  }
  const runCommand = useCallback(async (input: GuideCommand, navigateAfter = false) => {
    if (resetBusy.current) return;
    setError('');
    try {
      const result = await session.command(input);
      if (!result || !alive.current) return;
      setOpen(result.tutorialState.mode === 'guided');
      if (navigateAfter) navigate(result.href);
      // Refresh layout only for access-changing chapter/setup commands, not
      // every hidden guide/poll (which used to disturb product controls).
      if (input.action === 'chapter' || input.action === 'welcome') router.refresh();
    } catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : 'Could not save guide progress. Please retry.'); }
  // navigate intentionally sees the latest route; never read it after unmount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.command, router, pathname, workspaceSlug]);

  useEffect(() => {
    if (!shouldAdvanceToCustomer(workspaceSlug, state, pathname) || pending || expired) return;
    const key = `${sessionId}:${state.revision}`;
    if (autoAdvance.current === key) return;
    autoAdvance.current = key;
    void runCommand({ action: 'chapter', chapter: 'customer-quote' });
  }, [state, pathname, workspaceSlug, sessionId, pending, expired, runCommand]);

  function showGuidance() { setOpen(true); requestAnimationFrame(() => widget.current?.focus({ preventScroll: true })); }
  function collapse() { setOpen(false); requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true })); }
  function beginReset() { setError(''); setResetUnits(units); setResetOpen(true); }
  async function reset() {
    if (resetBusy.current || !resetUnits) return;
    resetBusy.current = true; setResetting(true); setError('');
    try {
      const result = await demoRequest<{ slug: string }>('/api/demo/reset', demoJsonRequest({ sessionId, confirm: 'RESET', system: resetUnits }), 135_000);
      if (!safeDemoHref(`/${result.slug}`, result.slug)) throw new Error('The fresh workspace could not be opened. Check /demo before trying again.');
      window.location.assign(`/${result.slug}`);
    } catch (cause) {
      if (alive.current) setError(`${cause instanceof Error ? cause.message : 'Could not reset the demo.'} If the result is unclear, open the demo entry to check before resetting again.`);
      resetBusy.current = false; if (alive.current) setResetting(false);
    }
  }
  function startDrag(event: ReactPointerEvent<HTMLElement>) {
    if (event.button !== 0 || window.innerWidth < 768 || (event.target as HTMLElement).closest('.qc-demo-icon,.qc-demo-menu') || !widget.current) return;
    const rect = widget.current.getBoundingClientRect();
    drag.current = { pointerId: event.pointerId, dx: event.clientX - rect.left, dy: event.clientY - rect.top };
    event.currentTarget.setPointerCapture(event.pointerId); setPosition({ x: rect.left, y: rect.top });
  }
  function moveDrag(event: ReactPointerEvent<HTMLElement>) {
    if (!drag.current || event.pointerId !== drag.current.pointerId || !widget.current) return;
    const rect = widget.current.getBoundingClientRect();
    setPosition(clampGuidePosition({ x: event.clientX - drag.current.dx, y: event.clientY - drag.current.dy }, rect.width, rect.height, window.innerWidth, window.innerHeight));
  }
  async function copyPrompt(openAfter = false) {
    if (copying || !units) return;
    setCopying(true); clearTimeout(copyTimer.current);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(assistantScript);
      if (!alive.current) return;
      if (openAfter) {
        // Owner 2026-10-12: "copy & open" must actually PLACE the example in the
        // composer so the visitor only taps Send. The window slot covers the
        // race where the Assistant mounts after this event (fresh page); the
        // ack swaps the status line; a 3s fallback restores the manual paste
        // instruction if nothing consumed it.
        (window as Window & { __qcDemoAssistantPrefill?: { text: string; at: number } }).__qcDemoAssistantPrefill = { text: assistantScript, at: Date.now() };
        prefillAcked.current = false;
        window.dispatchEvent(new Event('qc-open-assistant'));
        window.dispatchEvent(new CustomEvent('qc-demo-assistant-prefill', { detail: { text: assistantScript } }));
        setCopyStatus('Opening Smart Assistant with your request ready…');
        copyTimer.current = setTimeout(() => { if (alive.current && !prefillAcked.current) setCopyStatus('Paste the request into Smart Assistant and send it.'); }, 3000);
      } else {
        setCopyStatus('Prompt copied.');
        copyTimer.current = setTimeout(() => { if (alive.current) setCopyStatus(''); }, 7000);
      }
    } catch {
      if (!alive.current) return;
      setCopyStatus('Clipboard access is unavailable. Select and copy the example below, then open Smart Assistant.');
      promptBox.current?.focus(); promptBox.current?.select();
    } finally { if (alive.current) setCopying(false); }
  }
  const accountHref = normalAccountHref(mounted ? window.location.hostname : '');
  const stepCopy = step?.event === 'email.sent' && location.inCustomerEditor
    ? 'Press *Save Quote* at the top of the editor. In Job Space, choose *Send Quote* and enter the address you want to receive it.'
    : step?.event === 'email.sent' ? 'Choose *Send Quote* in this Job Space. Enter your email address and send the demo quote.'
    : assistantNeedsDraft ? 'This lesson edits a draft created by the Assistant. First use the create request below, or skip this lesson to try finding work instead.'
    : step?.copy;
  const assistantInstruction = step?.event === 'assistant.created'
    ? 'Send the example in Smart Assistant, review the draft quote, then choose Confirm to create it.'
    : step?.event === 'assistant.edited'
      ? 'Send the example in Smart Assistant, review the proposed changes, then choose Confirm. Saving that confirmed change advances the guide automatically.'
      : assistantFoundReady
        ? `Smart Assistant found ${assistantFoundCount === 1 ? 'the matching accepted quote' : `${assistantFoundCount} matching accepted quotes`}. Open a suggested quote to inspect its Job Space, or finish this lesson from the guide.`
        : 'Send the example in Smart Assistant. When the matching accepted quote appears, open that quote to inspect it. The guide will also unlock a Finish button.';
  const testExample = units === 'metric' ? 'Try 2 m².' : units === 'imperial_ft' ? 'Try 20 ft².' : units === 'imperial_rs' ? 'Try 0.2 roofing squares.' : '';
  const showGuide = open && !expired && !resetting && !mobileNotice;
  const closeMobileNotice = useCallback(() => {
    setMobileNotice(false);
    try { localStorage.setItem('qc-demo-mobile-notice', '1'); } catch { /* Optional storage. */ }
  }, []);
  const touchTakeoff = mounted && !!window.matchMedia?.('(pointer: coarse)').matches;

  const overlays = <div data-qc-ui="v2" className="qc-demo-overlays" data-assistant-open={assistantOpen} data-assistant-chapter={assistantStep}>
    <p className="qc-demo-announcement" role="status" aria-live="polite" aria-atomic="true">{state.welcomed && state.mode === 'guided' && !expired ? `${chapter.title}: ${step?.title ?? 'chapter finished'}. ${progress.done} lessons completed${progress.skipped ? `, ${progress.skipped} skipped` : ''}.` : ''}</p>
    {!open && !expired && !mobileNotice && <button ref={trigger} className="qc-demo-reopen" type="button" onClick={showGuidance} aria-expanded={false} aria-controls="qc-demo-guide"><span>Demo guide</span><small>{progress.handled}/{progress.total} lessons · Resume</small></button>}
    {assistantOpen && open && !expired && <QcButton className="qc-demo-assistant-return" variant="secondary" onClick={() => window.dispatchEvent(new Event('qc-hide-assistant'))}>Hide Assistant to see the guide</QcButton>}
    {showGuide && <aside id="qc-demo-guide" ref={widget} tabIndex={-1} className="qc-demo-guide" aria-label="QuoteCore+ demo guide" style={position ? { left: position.x, top: position.y, right: 'auto', bottom: 'auto' } : undefined}>
      <header className="qc-demo-guide-head" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
        <button type="button" className="qc-demo-drag" aria-label="Move guide with arrow keys. Escape resets its position." onKeyDown={event => {
          if (event.key === 'Escape') { event.stopPropagation(); setPosition(null); }
          const delta: Record<string, Position> = { ArrowLeft: { x: -20, y: 0 }, ArrowRight: { x: 20, y: 0 }, ArrowUp: { x: 0, y: -20 }, ArrowDown: { x: 0, y: 20 } };
          if (delta[event.key] && widget.current) { event.preventDefault(); const rect = widget.current.getBoundingClientRect(); setPosition(clampGuidePosition({ x: rect.left + delta[event.key].x, y: rect.top + delta[event.key].y }, rect.width, rect.height, window.innerWidth, window.innerHeight)); }
        }}><span aria-hidden="true">⠿</span></button>
        <div><span>CHAPTER {chapterIndex + 1} OF 4</span><strong>{chapter.title}</strong></div><div className="qc-demo-menu"><button type="button" className="qc-demo-menu-btn" aria-haspopup="menu" aria-expanded={menuOpen} aria-label="Guide menu" onClick={() => setMenuOpen(v => !v)}><span aria-hidden="true" /><span aria-hidden="true" /><span aria-hidden="true" /></button>
        {menuOpen && <div className="qc-demo-menu-pop" role="menu"><QcLinkButton variant="ghost" size="sm" className="qc-demo-menu-item" role="menuitem" href={`/${workspaceSlug}/demo-guide`}>All chapters</QcLinkButton><button type="button" role="menuitem" className="qc-demo-menu-item" onClick={() => { setPosition(null); setMenuOpen(false); }}>Reset position</button></div>}</div>
      </header>
      <div className="qc-demo-progress" role="progressbar" aria-label="Guide lessons handled" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.handled} aria-valuetext={`${progress.done} completed, ${progress.skipped} skipped, ${progress.total} total`}><i style={{ width: `${100 * progress.handled / progress.total}%` }} /></div>
      <button type="button" className="qc-demo-hide" onClick={collapse} aria-label="Hide the demo guide"><span>Hide guide</span><span aria-hidden="true">▾</span></button>
      <div className="qc-demo-guide-body">
        {quoteNotice && <div className="qc-demo-note" role="status"><strong>Customer response</strong><p>{quoteNotice}</p><QcButton variant="ghost" size="sm" onClick={() => setQuoteNotice('')}>Dismiss</QcButton></div>}
        {!state.welcomed ? <>
          <p className="qc-demo-eyebrow">WELCOME TO QCP ROOFING &amp; CONSTRUCTION</p><h2>Try a real workflow, step by step</h2>
          <p>Build a pricing rule, use it on a roof, prepare a quote, then try Smart Assistant. All records and prices are fictional.</p>
          <p className="qc-demo-note-soft qc-demo-note">About 10 to 15 minutes. You can pause and explore whenever you like.</p>
          <div className="qc-demo-actions"><QcButton variant="primary" pending={pending} onClick={() => void runCommand({ action: 'welcome', mode: 'guided' }, true)}>Show me how it works</QcButton><QcButton variant="ghost" disabled={pending} onClick={() => void runCommand({ action: 'welcome', mode: 'explore' })}>I’ll explore first</QcButton></div>
        </> : awaitingPath ? <>
          <p className="qc-demo-eyebrow">OPENING YOUR TASK</p><h2>{navigationSlow ? 'The page is taking a little longer' : 'Opening the next page…'}</h2>
          <p role="status">{navigationSlow ? 'Your saved work is unchanged. Retry opening the task, or stay here and explore.' : 'Your next instruction will appear when the page is ready.'}</p>
          {navigationSlow && <div className="qc-demo-actions"><QcButton variant="primary" onClick={() => navigate(location.href)}>Try opening the task again</QcButton><QcButton variant="ghost" onClick={() => setAwaitingPath(null)}>Stay here</QcButton></div>}
        </> : step ? <>
          <p className="qc-demo-eyebrow">{location.onPage ? `${reviewing ? 'REVIEW · ' : ''}STEP ${stepIndex + 1} OF ${chapter.steps.length}` : 'READY WHEN YOU ARE'}</p><h2>{step.title}</h2>
          {reviewing && <p className="qc-demo-review-note">You’ve already completed this lesson. Review or repeat it without losing any later demo progress.</p>}
          {!location.onPage ? <><p>You’re exploring another page. Your guide progress is saved.</p><div className="qc-demo-actions"><QcButton variant="primary" onClick={() => navigate(location.href)}>Return to this task</QcButton></div></>
          : !location.ready ? <><p>{step.event === 'component.created' ? 'Open the component creator. We’ve filled in example rates; choose a name, review them and save.' : 'Open the saved component for this lesson. Your previous work is still there.'}</p><div className="qc-demo-actions"><QcButton variant="primary" onClick={() => navigate(location.href)}>{step.event === 'component.created' ? 'Create my component' : step.event === 'component.tested' ? 'Open Test Component' : 'Open the example component'}</QcButton></div></>
          : <>
            <p>{guideCopy(stepCopy)}</p>
            {step.event === 'component.created' && <p className="qc-demo-note qc-demo-note-soft">Example rates are already filled in. Give it any name. These are demo values, not pricing recommendations.</p>}
            {step.event === 'component.tested' && <div className="qc-demo-test-tip">
              <span>Suggested test</span><strong>{testExample}</strong>
              <p>Open <b className="qc-demo-act">Test Component</b>, enter the measurement above, then choose <b className="qc-demo-act">Calculate</b>.</p>
            </div>}
            {step.target === 'takeoff' && (guidedTakeoffDone ? <div className="qc-demo-note" role="status">
              <strong>Nice — your component is on the plan.</strong>
              <p>Keep exploring the canvas, or save and move to the next step.</p>
              <div className="qc-demo-actions"><QcButton variant="primary" onClick={() => window.dispatchEvent(new Event('qc-demo-takeoff-save-continue'))}>Save &amp; continue</QcButton><QcButton variant="ghost" onClick={collapse}>Keep exploring</QcButton></div>
            </div> : <p className="qc-demo-note">{triedAdding || session.skylightAdded ? <><strong>Nice, you added your component.</strong> Keep experimenting if you like, then {touchTakeoff ? <>press <strong className="qc-demo-act">Save &amp; continue</strong></> : <>click <strong className="qc-demo-act">Finish &amp; Save</strong></>} to progress. Whatever is on the final canvas is what you save.</> : <><strong>Add your component{state.guided_created_component_name ? `: “${state.guided_created_component_name}”` : ''}.</strong> {touchTakeoff ? <><strong>For the best experience, turn your phone sideways and turn off the tab bar in horizontal view in your phone settings.</strong> Open the <strong className="qc-demo-act">Components</strong> rail on the right. In <strong className="qc-demo-act">Component</strong>, the second dropdown, choose the component you just created. Tap <strong className="qc-demo-act">+ New entry</strong>, then draw the area on the plan. The prepared roof is already measured; your additions are real.</> : <>Click the <strong className="qc-demo-act">+ Add component</strong> button in the Components panel, find the component you named, then click it. In the toolbar under “Area”, select <strong className="qc-demo-act">Polygon</strong> or <strong className="qc-demo-act">Rectangle</strong> and draw the area on the plan. The prepared scan is precomputed; your measurements and edits are real.</>}</>}</p>)}
            {step.hint && <details className="qc-demo-why"><summary>Why this matters</summary><p>{guideCopy(step.hint)}</p></details>}
          </>}
          {assistantStep && location.onPage && <>
            {!assistantFoundReady && (assistantUnavailable || assistantExhausted) ? <div className="qc-demo-note" role="status"><strong>{assistantExhausted ? `You've used your ${allowance?.turnsLimit ?? 9}-task demo AI allowance` : 'Smart Assistant is unavailable right now'}</strong><p>{assistantExhausted ? 'You’ve used all Smart Assistant tasks included in this demo. You can skip this optional lesson or keep exploring the workspace.' : 'Your demo work is safe. Retry the status check, or skip this optional lesson and keep exploring.'}</p>{assistantUnavailable && <QcButton variant="ghost" onClick={() => void refresh()}>Check again</QcButton>}</div>
              : <>
                <div className="qc-demo-script"><label htmlFor="qc-demo-prompt">EXAMPLE REQUEST</label><textarea id="qc-demo-prompt" ref={promptBox} readOnly value={assistantScript} aria-label="Smart Assistant example to copy" rows={step.event === 'assistant.created' ? 4 : 2} />
                  <QcButton variant="ghost" size="sm" disabled={copying || !units} onClick={() => void copyPrompt()}>{copyStatus === 'Prompt copied.' ? 'Copied' : 'Copy example'}</QcButton></div>
                <p className="qc-demo-copy-status" role="status">{copyStatus || (units ? assistantInstruction : 'Loading your measurement system…')}</p>
                {assistantFoundReady && <div className="qc-demo-note qc-demo-assistant-found" role="status">
                  <strong>{assistantFoundCount === 1 ? 'Matching quote found.' : `${assistantFoundCount} matching quotes found.`}</strong>
                  <p>Open the suggested <b className="qc-demo-act">quote</b> in Smart Assistant if you want to inspect the Job Space. You can also finish now — you’ve completed the find task.</p>
                  <div className="qc-demo-actions"><QcButton variant="primary" pending={pending} onClick={() => void runCommand({ action: 'finish-assistant' })}>Finish Smart Assistant guide</QcButton></div>
                </div>}

              </>}
            {allowance?.configured && <p className="qc-demo-allowance">{allowance.turnsRemaining} of {allowance.turnsLimit} Smart Assistant tasks remain.</p>}
          </>}
          {step.event === 'email.sent' && location.onPage && features && !features.selfSend && <p className="qc-demo-note" role="status">Email delivery is switched off on this deployment. Skip this optional lesson to continue to Smart Assistant.</p>}
          {!reviewing && !required && !assistantFoundReady && <QcButton className="qc-demo-skip" variant="ghost" size="sm" disabled={pending} onClick={() => void runCommand({ action: 'skip' })}>Skip this optional lesson</QcButton>}
        </> : <>
          <p className="qc-demo-eyebrow">{finished ? 'DEMO COMPLETE' : 'CHAPTER FINISHED'}</p><h2>{finished ? 'Well done. That’s a real quote, built your way.' : `${chapter.title} complete`}</h2>
          <p>{finished ? 'You set up pricing, measured a roof, prepared a customer quote and put Smart Assistant to work. And you’ve only scratched the surface.' : 'Your progress is saved. Continue when you’re ready.'}</p>
          <div className="qc-demo-actions">{nextChapter && !finished ? <QcButton variant="primary" pending={pending} onClick={() => void runCommand({ action: 'chapter', chapter: nextChapter.id }, true)}>Continue to {nextChapter.title}</QcButton> : <QcButton variant="primary" onClick={() => setCompleteOpen(true)}>See what’s next</QcButton>}</div>
        </>}
        {error && <p role="alert" className="qc-demo-error">{error}</p>}
        {syncError && <div className="qc-demo-sync" role="status"><p>{syncError}</p><QcButton size="sm" variant="ghost" onClick={() => void refresh()}>Refresh guide progress</QcButton></div>}
      </div>
      {state.welcomed && !awaitingPath && assistantStep && location.onPage && !assistantUnavailable && !assistantExhausted && <div className="qc-demo-task-action"><div className="qc-demo-actions">{assistantFoundReady
        ? <QcButton variant="secondary" onClick={() => window.dispatchEvent(new Event('qc-open-assistant'))}>{assistantOpen ? 'Smart Assistant result is open' : 'Review result in Smart Assistant'}</QcButton>
        : <><QcButton variant="primary" disabled={copying || !units} onClick={() => void copyPrompt(true)}>{copying ? 'Copying…' : assistantOpen ? 'Copy example & return to Assistant' : 'Copy example & open Assistant'}</QcButton>{copyStatus.startsWith('Clipboard') && <QcButton variant="secondary" onClick={() => window.dispatchEvent(new Event('qc-open-assistant'))}>Open Assistant without copying</QcButton>}</>}</div></div>}
          </aside>}
    <QcDialog open={resetOpen && (!expired || resetting)} pending={resetting} onRequestClose={() => setResetOpen(false)} title={resetting ? 'Preparing your fresh demo' : 'Start this demo again?'} description={resetting ? 'Keep this tab open while we prepare your fictional workspace.' : 'This removes your demo edits and guide progress. Choose the units for the fresh workspace. AI and email allowances do not renew.'}
      footer={!resetting && <div className="qc-demo-actions"><QcButton variant="primary" disabled={!resetUnits} onClick={() => void reset()}>Replace my demo &amp; start fresh</QcButton><QcButton variant="ghost" onClick={() => setResetOpen(false)}>Keep my current demo</QcButton></div>}>
      {!resetting && <DemoUnitChoice value={resetUnits} onChange={setResetUnits} />}{error && <p role="alert" className="qc-demo-error">{error}</p>}
    </QcDialog>
    <QcDialog open={mobileNotice && !expired && !resetting} onRequestClose={closeMobileNotice} title="Mobile user heads up" description="Digital takeoff and the smart assistant work in your browser, well enough to test. They just don't fit the screen optimally there. In the main mobile app they get the full experience, designed for that screen. Everything else works great right here."
      footer={<div className="qc-demo-actions"><QcButton variant="primary" onClick={closeMobileNotice}>Start the demo</QcButton></div>} />
    <QcDialog open={expired && !resetting} onRequestClose={() => window.location.assign('/demo')} title="This demo has ended" description="It expired or was reset in another tab. Start fresh to try again. AI and email allowances carry over.">
      <div className="qc-demo-actions"><QcLinkButton variant="primary" href="/demo">Open a fresh demo</QcLinkButton><QcLinkButton variant="ghost" href={accountHref}>Get your own account</QcLinkButton></div>
    </QcDialog>
    <QcDialog open={completeOpen && !expired} onRequestClose={() => setCompleteOpen(false)} size="lg" labelledBy="qc-demo-complete-title" className="qc-demo-complete-dialog"
      footer={<div className="qc-demo-complete-actions">
        <QcLinkButton variant="primary" href="https://quote-core.com/pricing" target="_blank" rel="noopener noreferrer">Explore pricing</QcLinkButton>
        <div className="qc-demo-complete-row">
          <QcLinkButton variant="secondary" href="https://quote-core.com/done-for-you-setup" target="_blank" rel="noopener noreferrer">See Done-For-You packages</QcLinkButton>
          <QcLinkButton variant="secondary" href="https://calendly.com/quote-core-info/meeting" target="_blank" rel="noopener noreferrer">Book a free 20-minute call</QcLinkButton>
        </div>
        <QcButton variant="ghost" onClick={() => setCompleteOpen(false)}>Continue exploring the demo</QcButton>
      </div>}>
      <div className="qc-demo-complete">
        <div className="qc-demo-complete-hero">
          <span className="qc-demo-complete-badge" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.2 4.2L19 7" /></svg></span>
          <div>
            <p className="qc-demo-complete-eyebrow">Demo complete</p>
            <h2 id="qc-demo-complete-title">Nice work. You just ran the real QuoteCore+ workflow.</h2>
            <p className="qc-demo-complete-sub">Everything you did is how QuoteCore+ runs day to day. The full app adds your own component library and branding, purchase orders and invoices, automatic quote follow-ups and integrations.</p>
          </div>
        </div>
        <div className="qc-demo-complete-recap">
          {DEMO_GUIDE_CHAPTERS.map(item => { const result = chapterOutcome(state, item); return (
            <div key={item.id} className="qc-demo-complete-chapter"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.2 4.2L19 7" /></svg><div><strong>{item.title}</strong><span>{result.done}/{result.total} completed{result.skipped ? ` · ${result.skipped} skipped` : ''}</span></div></div>
          ); })}
        </div>
        <p className="qc-demo-complete-note">Your saved work stays in this demo until it expires. Come back any time.</p>
      </div>
    </QcDialog>
  </div>;

  return <><div className="qc-demo-banner"><strong>DEMO</strong><span className="qc-demo-banner-context">{demoSystemLabel(units ?? undefined)}<span> · Until {expiryLabel}</span></span><button type="button" onClick={showGuidance} aria-expanded={showGuide} aria-controls="qc-demo-guide">Guide</button><button type="button" onClick={beginReset} disabled={expired || resetting}>Start fresh</button><a href={accountHref}>Get your own account</a></div>{mounted && createPortal(overlays, portalHost ?? document.body)}</>;
}
