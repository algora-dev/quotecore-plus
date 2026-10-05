'use client';
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { QcDialog } from '@/app/components/ui/v2/QcDialog';
import { DEMO_GUIDE_CHAPTERS, guideHref, guideProgress, nextGuideStep, type DemoStep } from '@/app/lib/demo/guide';
import type { DemoEvent, DemoGuideChapter, DemoGuideState } from '@/app/lib/demo/model';
import type { GuideCommand } from '@/app/lib/demo/commands';
import { normalAccountHref } from '@/app/lib/demo/routing';
import './demo-experience.css';
type Props = { workspaceSlug: string; sessionId: string; expiresAt: string; initialState: DemoGuideState };
type Allowance = { turnsRemaining: number; turnsLimit: number; sendsRemaining: number; sendsLimit: number; configured: boolean };
type Position = { x: number; y: number };
function clampPosition(position: Position, element: HTMLElement): Position {
  const rect = element.getBoundingClientRect();
  return { x: Math.max(12, Math.min(position.x, window.innerWidth - rect.width - 12)), y: Math.max(12, Math.min(position.y, window.innerHeight - Math.min(rect.height, window.innerHeight - 24) - 12)) };
}
export function DemoExperience({ workspaceSlug, sessionId, expiresAt, initialState }: Props) {
  const router = useRouter(); const pathname = usePathname();
  const [state, setState] = useState(initialState); const [open, setOpen] = useState(initialState.mode === 'guided' || !initialState.welcomed);
  const [mounted, setMounted] = useState(false); const [pending, setPending] = useState(false); const [error, setError] = useState('');
  const [resetOpen, setResetOpen] = useState(false); const [expired, setExpired] = useState(false); const [completeOpen, setCompleteOpen] = useState(false);
  const [allowance, setAllowance] = useState<Allowance | null>(null); const [units, setUnits] = useState<'metric' | 'imperial_ft' | 'imperial_rs'>('metric'); const [skylightAdded, setSkylightAdded] = useState(false);
  const [position, setPosition] = useState<Position | null>(null); const widget = useRef<HTMLElement>(null);
  const drag = useRef<{ pointerId: number; dx: number; dy: number } | null>(null);
  // Guide-initiated navigation: hold a "loading the next task" card until the
  // destination page actually renders, so the helper never runs ahead of the app.
  const [awaitingPage, setAwaitingPage] = useState<string | null>(null);
  const [justCompleted, setJustCompleted] = useState<DemoStep | null>(null);
  const prevAckKeysRef = useRef<string[]>(Object.keys(initialState.acknowledgements));
  const skipEventRef = useRef<DemoEvent | null>(null);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch('/api/demo/state', { cache: 'no-store', signal });
      const result = await response.json();
      if (response.status === 410 || response.status === 401) { setExpired(true); return; }
      if (!response.ok) { if (response.status === 503) setError(result.error ?? 'Demo verification is temporarily unavailable.'); return; }
      if (result.sessionId !== sessionId) { setExpired(true); return; }
      setState(result.tutorialState); setAllowance(result.allowance); if (result.skylightAdded === true) setSkylightAdded(true);
      if (result.units === 'imperial_ft' || result.units === 'imperial_rs' || result.units === 'metric') setUnits(result.units);
    } catch (cause) { if (!(cause instanceof DOMException && cause.name === 'AbortError')) setError('Could not refresh demo progress. Your product edits are not changed.'); }
  }, [sessionId]);
  useEffect(() => { setMounted(true); const controller = new AbortController(); void refresh(controller.signal);
    const listener = () => { if (document.visibilityState === 'visible') void refresh(controller.signal); };
    const timer = window.setInterval(listener, 2500); document.addEventListener('visibilitychange', listener); window.addEventListener('qc-demo-refresh', listener);
    return () => { controller.abort(); clearInterval(timer); document.removeEventListener('visibilitychange', listener); window.removeEventListener('qc-demo-refresh', listener); };
  }, [refresh]);
  // Catch acknowledgements that land server-side as the visitor navigates
  // between product pages (saves ack on the server; the route change is the cue).
  useEffect(() => { void refresh(); }, [pathname, refresh]);
  useEffect(() => { if (!awaitingPage) return; const timer = setTimeout(() => setAwaitingPage(null), 6000); return () => clearTimeout(timer); }, [awaitingPage]);
  useEffect(() => { if (awaitingPage && pathname === awaitingPage) setAwaitingPage(null); }, [pathname, awaitingPage]);
  useEffect(() => { const remaining = Date.parse(expiresAt) - Date.now(); if (remaining <= 0) { setExpired(true); return; }
    const timer = setTimeout(() => setExpired(true), Math.min(remaining, 2147483647)); return () => clearTimeout(timer);
  }, [expiresAt]);
  useEffect(() => { const resize = () => { if (widget.current) setPosition(previous => previous ? clampPosition(previous, widget.current!) : null); };
    window.addEventListener('resize', resize); return () => window.removeEventListener('resize', resize);
  }, []);
  // Celebrate real completions: when a product save acknowledges a step, show
  // an explicit "nice work - do the next task" card instead of the next task
  // silently appearing. Skips we initiated ourselves advance quietly.
  useEffect(() => {
    const keys = Object.keys(state.acknowledgements);
    const previousKeys = prevAckKeysRef.current; prevAckKeysRef.current = keys;
    if (keys.length <= previousKeys.length) return;
    const added = keys.filter(key => !previousKeys.includes(key));
    if (skipEventRef.current) { if (added.includes(skipEventRef.current)) skipEventRef.current = null; return; }
    const completed = DEMO_GUIDE_CHAPTERS.flatMap(chapter => chapter.steps).find(step => added.includes(step.event));
    if (completed) setJustCompleted(completed);
  }, [state.acknowledgements]);
  // Live skylight signal: the takeoff canvas dispatches qc-demo-skylight the
  // moment the visitor's created component gets an entry; the server state
  // covers saved/reloaded sessions.
  useEffect(() => {
    const active = state.chapter === 'takeoff' && !state.acknowledgements['takeoff.saved'];
    (window as unknown as { __qcDemoGuidedComponentId?: string | undefined }).__qcDemoGuidedComponentId = active ? state.guided_created_component_id : undefined;
    if (!active || !state.guided_created_component_id) return;
    const listener = () => setSkylightAdded(true);
    window.addEventListener('qc-demo-skylight', listener);
    return () => window.removeEventListener('qc-demo-skylight', listener);
  }, [state]);
  const step = nextGuideStep(state); const progress = guideProgress(state);
  const chapterIndex = DEMO_GUIDE_CHAPTERS.findIndex(chapter => chapter.id === state.chapter);
  const chapter = DEMO_GUIDE_CHAPTERS[chapterIndex] ?? DEMO_GUIDE_CHAPTERS[0];
  const nextChapter = DEMO_GUIDE_CHAPTERS[chapterIndex + 1]?.id;
  const destination = guideHref(workspaceSlug, state); const destinationPath = destination.split('?')[0];
  // The Smart Assistant popup opens from any workspace page; its only wrong
  // page is the standalone /assistant page (owner direction 2026-10-05).
  const assistantStep = step?.target === 'assistant';
  // The send task is valid on the Job Space AND the customer editor (its copy
  // starts with "press Save Quote"): owner direction 2026-10-05.
  const jobStep = step?.event === 'email.sent';
  const editorPath = state.seed.guided_roof_job ? `/${workspaceSlug}/quotes/${state.seed.guided_roof_job}/customer-edit` : '';
  const onExpectedPage = assistantStep ? pathname !== `/${workspaceSlug}/assistant`
    : jobStep ? pathname === destinationPath || (!!editorPath && pathname === editorPath)
    : pathname === destinationPath;
  // Owner 2026-10-05: when a completion card is showing but the visitor has
  // ALREADY arrived on the next task's page (Finish & Save lands straight in
  // the customer quote editor), skip the celebration card and show the actual
  // next instruction immediately.
  useEffect(() => { if (justCompleted && step && pathname === destinationPath) setJustCompleted(null); }, [justCompleted, step, pathname, destinationPath]);
  // Owner 2026-10-05 (pass 5): when the visitor is ALREADY on the NEXT
  // chapter's first page (Finish & Save lands straight in the customer quote
  // editor), advance the chapter quietly instead of showing a "Continue to
  // Prepare the customer quote" button they cannot need.
  const autoAdvance = useRef<{ chapter: DemoGuideChapter | undefined; run: boolean }>({ chapter: undefined, run: false });
  autoAdvance.current.chapter = nextChapter;
  useEffect(() => {
    if (!justCompleted || step || pending || expired) return;
    const chapterId = autoAdvance.current.chapter; if (!chapterId || autoAdvance.current.run) return;
    const first = DEMO_GUIDE_CHAPTERS.find(chapter => chapter.id === chapterId)!.steps[0];
    const nextPath = guideHref(workspaceSlug, { ...state, chapter: chapterId }, first).split('?')[0];
    if (pathname !== nextPath) return;
    autoAdvance.current.run = true; setJustCompleted(null);
    void command({ action: 'chapter', chapter: chapterId }).finally(() => { autoAdvance.current.run = false; });
  }, [justCompleted, step, pathname, pending, expired, state, workspaceSlug]);
  async function command(input: GuideCommand, navigate = false) {
    if (pending || expired) return; setPending(true); setError('');
    try {
      const response = await fetch('/api/demo/state', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? 'Could not save the guide.');
      setState(result.tutorialState); setOpen(result.tutorialState.mode === 'guided');
      if (navigate && typeof result.href === 'string') { setAwaitingPage(result.href.split('?')[0]); router.push(result.href); }
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save guide progress.'); } finally { setPending(false); }
  }
  async function skipStep() {
    if (pending || expired || !step) return;
    skipEventRef.current = step.event; setError('');
    await command({ action: 'skip' });
  }
  async function reset() {
    setPending(true); setError('');
    try {
      const response = await fetch('/api/demo/reset', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId, confirm: 'RESET' }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? 'Reset could not complete.');
      window.location.assign(`/${encodeURIComponent(result.slug)}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Reset could not complete.'); setPending(false); }
  }
  function startDrag(event: ReactPointerEvent<HTMLElement>) {
    // Draggable from the whole header, including the grip handle - only the
    // minimize control is exempt. Works with mouse, pen and touch.
    if ((event.target as HTMLElement).closest('.qc-demo-icon')) return;
    if (!widget.current) return;
    const rect = widget.current.getBoundingClientRect(); drag.current = { pointerId: event.pointerId, dx: event.clientX - rect.left, dy: event.clientY - rect.top };
    event.currentTarget.setPointerCapture(event.pointerId); setPosition({ x: rect.left, y: rect.top });
  }
  function moveDrag(event: ReactPointerEvent<HTMLElement>) {
    if (!drag.current || drag.current.pointerId !== event.pointerId || !widget.current) return;
    setPosition(clampPosition({ x: event.clientX - drag.current.dx, y: event.clientY - drag.current.dy }, widget.current));
  }
  const expiryLabel = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', day: 'numeric', month: 'short' }).format(new Date(expiresAt));
  // Units-adaptive Smart Assistant scripts (owner direction 2026-10-05): the
  // example bakes in "on the plan" so the basis question never fires, and the
  // wording follows the measurement system chosen at demo entry.
  const saCreateScript = units === 'metric'
    ? 'Create a roof quote for Jim Smith — 180 m² roof on the plan, 25° pitch, 5 hips at 4 m and 1 ridge at 2 m, using the roofing library.'
    : units === 'imperial_rs'
    ? 'Create a roof quote for Jim Smith — 19.4 roofing squares on the plan, 25° pitch, 5 hips at 13 ft and 1 ridge at 6.5 ft, using the roofing library.'
    : 'Create a roof quote for Jim Smith — 1,940 ft² roof on the plan, 25° pitch, 5 hips at 13 ft and 1 ridge at 6.5 ft, using the roofing library.';
  const saEditScript = units === 'metric' ? 'Change the ridge to 6 m and add 12 m of gutter.' : 'Change the ridge to 20 ft and add 40 ft of gutter.';
  const saFindScript = 'Do I have any accepted quotes without a material order?';
  const guide = <>
    {!open && <button className="qc-demo-reopen" type="button" onClick={() => setOpen(true)} aria-label="Resume guided demo">QCP demo · {progress.done}/{progress.total}<span>Resume guide</span></button>}
    {open && <aside ref={widget} className="qc-demo-guide" aria-label="QuoteCore+ demo guide" style={position ? { left: position.x, top: position.y, right: 'auto', bottom: 'auto' } : undefined}>
      <header className="qc-demo-guide-head" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}><button type="button" className="qc-demo-drag"
        aria-label="Move guide. On desktop use arrow keys to reposition, Escape to reset." onKeyDown={event => { if (event.key === 'Escape') setPosition(null); const delta: Record<string, Position> = { ArrowLeft: {x:-20,y:0}, ArrowRight:{x:20,y:0},ArrowUp:{x:0,y:-20},ArrowDown:{x:0,y:20} }; if (delta[event.key] && widget.current) { event.preventDefault(); const rect = widget.current.getBoundingClientRect(); setPosition(clampPosition({ x: rect.left+delta[event.key].x, y: rect.top+delta[event.key].y }, widget.current)); } }}>⠿</button>
        <div><span>YOUR QCP DEMO · {Math.max(1, chapterIndex + 1)} OF 4</span><strong>{chapter.title}</strong></div>
        <button className="qc-demo-icon" type="button" aria-label="Hide guide" onClick={() => setOpen(false)}>−</button></header>
      <div className="qc-demo-progress" role="progressbar" aria-label="Completed demo actions" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done}><i style={{ width: `${100 * progress.done / progress.total}%` }} /></div>
      <div className="qc-demo-guide-body">
        {!state.welcomed && !expired ? <><p className="qc-demo-eyebrow">WELCOME TO YOUR DEMO</p><h2>Welcome to your workspace</h2>
          <p>This is a fictional QCP Roofing &amp; Construction sandbox. Every price, job and measurement in here is part of the demo, and it is yours to try for up to 24 hours.</p>
          <div className="qc-demo-welcome-actions">
            <QcButton variant="primary" disabled={pending} onClick={() => void command({ action: 'welcome', mode: 'guided' }, true)}>Start the guided demo →</QcButton>
            <button type="button" className="qc-demo-secondary-link" disabled={pending} onClick={() => void command({ action: 'welcome', mode: 'explore' })}>I&apos;ll explore myself</button>
          </div>
        </> : justCompleted ? <><p className="qc-demo-eyebrow">NICE WORK - TASK COMPLETE</p><h2>{justCompleted.title} ✓</h2>
          <p>{justCompleted.event === 'takeoff.saved'
            ? 'Saved. You can keep editing freely - add or remove anything - or continue to the next step. Your customer quote will use exactly what you saved.'
            : 'Saved and recorded - nice work. Ready for the next one?'}</p>
          {step ? <div className="qc-demo-actions"><a className="qc-demo-continue" href={destination} onClick={() => setJustCompleted(null)}>Do the next task →</a></div>
            : nextChapter ? <div className="qc-demo-actions"><QcButton variant="primary" disabled={pending} onClick={() => { setJustCompleted(null); void command({ action: 'chapter', chapter: nextChapter }, true); }}>Continue to {DEMO_GUIDE_CHAPTERS[chapterIndex + 1].title}</QcButton>{justCompleted.event === 'takeoff.saved' && <button type="button" className="qc-demo-secondary-link" onClick={() => setJustCompleted(null)}>Keep editing the takeoff</button>}</div>
              : <div className="qc-demo-actions"><QcButton variant="primary" onClick={() => { setJustCompleted(null); setCompleteOpen(true); }}>Review your demo</QcButton></div>}
          <button type="button" className="qc-demo-secondary-link" onClick={() => setJustCompleted(null)}>{step ? 'Show the next step here' : 'Stay on this chapter'}</button>
        </> : awaitingPage ? <><p className="qc-demo-eyebrow">LOADING</p><h2>Opening the next task…</h2>
          <p className="qc-demo-loading">The next page is on its way. Hold tight - nothing to click yet.</p>
        </> : step ? <><p className="qc-demo-eyebrow">{onExpectedPage ? 'YOUR NEXT ACTION' : 'GUIDE PAUSED WHILE YOU EXPLORE'}</p><h2>{step.title}</h2>
          <p>{onExpectedPage ? step.copy : `Resume “${step.title}” on the correct page. You can keep exploring here without losing your saved progress.`}</p>
          {step.target === 'takeoff' && onExpectedPage && (skylightAdded
            ? <p className="qc-demo-note"><strong>Skylight added ✓</strong> Look around freely - add, edit or remove anything. Press <strong>Finish &amp; Save</strong> when you’re ready; you’ll land straight in the customer quote editor.</p>
            : <p className="qc-demo-note"><strong>Your one job:</strong> add your component{state.guided_created_component_name ? <> (“{state.guided_created_component_name}”)</> : null} and draw a rectangle anywhere on the roof. Everything else is already measured and priced.</p>)}
          {state.chapter === 'smart-assistant' && <p className="qc-demo-note">{allowance?.configured ? `${allowance.turnsRemaining} of ${allowance.turnsLimit} user turns remain. Reset does not restore them.` : 'Real Smart Assistant requires calibrated cost controls on this deployment. The rest of the demo remains available.'}</p>}
          {state.chapter === 'smart-assistant' && onExpectedPage && <div className="qc-demo-script"><span>{step.event === 'assistant.found' ? 'ASK THIS' : 'TRY THIS'}</span><p>{step.event === 'assistant.created' ? saCreateScript : step.event === 'assistant.edited' ? saEditScript : saFindScript}</p></div>}
          {step.event === 'component.viewed' && onExpectedPage ? <QcButton variant="primary" disabled={pending || expired} onClick={() => void skipStep()}>I&apos;ve had a look - next step →</QcButton>
            : !onExpectedPage ? <a className="qc-demo-continue" href={destination}>Resume this task →</a>
            : step.event === 'component.created' ? <a className="qc-demo-continue" href={destination}>Open the component creator →</a>
            : step.event === 'component.tested' || step.event === 'component.edited' ? <a className="qc-demo-continue" href={destination}>Open the component →</a>
            : assistantStep ? <QcButton variant="primary" onClick={() => window.dispatchEvent(new Event('qc-open-assistant'))}>Open Smart Assistant →</QcButton>
            : null}
          {!(step.event === 'component.viewed' && onExpectedPage) && <button type="button" className="qc-demo-secondary-link" disabled={pending || expired} onClick={() => void skipStep()}>Skip this task →</button>}
        </> : <><h2>{chapter.title} complete</h2><p>Your successful saved actions have been recorded. Nicely done.</p><div className="qc-demo-actions">{nextChapter ? <QcButton variant="primary" disabled={pending} onClick={() => void command({action:'chapter',chapter:nextChapter},true)}>Continue to {DEMO_GUIDE_CHAPTERS[chapterIndex+1].title}</QcButton> : <QcButton variant="primary" onClick={() => setCompleteOpen(true)}>Review your demo</QcButton>}</div></>}
        {error && <p role="alert" className="qc-demo-error">{error}</p>}
        <div className="qc-demo-guide-links"><button type="button" disabled={pending} onClick={() => void command({action:'explore'})}>Explore / resume later</button><a href={`/${workspaceSlug}/demo-guide`}>All chapters</a><button type="button" onClick={() => setPosition(null)}>Reset position</button></div>
      </div>
    </aside>}
    <QcDialog open={resetOpen} pending={pending} onRequestClose={() => setResetOpen(false)} title="Start again from the QCP seed?" description="This removes your edits, created records, measurements and guide progress, and shows the welcome as a first-time visitor. It takes about 15 seconds - keep this tab open. AI and email allowances are not restored. Other open demo tabs will become invalid."
      footer={<div className="qc-demo-actions"><QcButton disabled={pending} variant="secondary" onClick={() => setResetOpen(false)}>Keep exploring</QcButton><QcButton disabled={pending} onClick={reset}>{pending ? 'Preparing your fresh demo…' : 'Reset demo'}</QcButton></div>}>{error && <p role="alert" className="qc-demo-error">{error}</p>}</QcDialog>
    <QcDialog open={expired} onRequestClose={() => window.location.assign('/demo')} title="This demo has ended" description="It expired or was reset in another tab. Start again for a fresh fictional workspace. Your remaining resource allowances do not reset.">
      <div className="qc-demo-actions"><Link className="qc-demo-continue" href="/demo">Start a fresh demo</Link><a className="qc-demo-secondary-link" href={normalAccountHref(mounted ? window.location.hostname : '')}>Get your own account</a></div>
    </QcDialog>
    <QcDialog open={completeOpen} onRequestClose={() => setCompleteOpen(false)} title={progress.done === progress.total ? 'You’ve tried the QuoteCore+ workflow' : 'Keep exploring QuoteCore+'}
      footer={<div className="qc-demo-actions"><a className="qc-demo-continue" href={normalAccountHref(mounted ? window.location.hostname : '')}>Get your own account</a><a className="qc-demo-secondary-link" href="https://quote-core.com/done-for-you-setup">Ask about Done For You</a><QcButton variant="secondary" onClick={() => setCompleteOpen(false)}>Continue exploring</QcButton></div>}>
      <div className="qc-demo-complete">
        <div className="qc-demo-progress" role="progressbar" aria-label="Completed demo actions" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done}><i style={{ width: `${100 * progress.done / progress.total}%` }} /></div>
        <p className="qc-demo-complete-count">{progress.done} OF {progress.total} GUIDED ACTIONS COMPLETED</p>
        <ul>
          <li>Priced a reusable roofing component</li>
          <li>Measured a prepared roof plan with real pitch + waste maths</li>
          <li>Presented and sent a customer quote</li>
          <li>Drafted work with Smart Assistant in plain English</li>
        </ul>
        <p>Digital Takeoff and Smart Assistant are optional — real accounts can enter measurements directly. Orders, invoices and the rest of this sandbox are still yours to explore.</p>
      </div>
    </QcDialog>
  </>;
  return <><div className="qc-demo-banner"><strong>DEMO</strong><span>Fictional · available until {expiryLabel}</span><button type="button" onClick={() => setOpen(true)}>Demo guide</button><button type="button" onClick={() => setResetOpen(true)}>Start again</button><a href={normalAccountHref(mounted ? window.location.hostname : '')}>Get your own account</a></div>{mounted && createPortal(<div data-qc-ui="v2">{guide}</div>, document.body)}</>;
}
