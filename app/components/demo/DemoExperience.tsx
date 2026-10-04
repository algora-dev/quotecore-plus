'use client';
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter } from 'next/navigation';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { QcDialog } from '@/app/components/ui/v2/QcDialog';
import { DEMO_GUIDE_CHAPTERS, guideHref, guideProgress, nextGuideStep } from '@/app/lib/demo/guide';
import type { DemoGuideState } from '@/app/lib/demo/model';
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
  const [state, setState] = useState(initialState); const [open, setOpen] = useState(initialState.mode === 'guided');
  const [mounted, setMounted] = useState(false); const [pending, setPending] = useState(false); const [error, setError] = useState('');
  const [resetOpen, setResetOpen] = useState(false); const [expired, setExpired] = useState(false); const [completeOpen, setCompleteOpen] = useState(false);
  const [allowance, setAllowance] = useState<Allowance | null>(null); const [selfSendEnabled, setSelfSendEnabled] = useState(false);
  const [position, setPosition] = useState<Position | null>(null); const widget = useRef<HTMLElement>(null);
  const drag = useRef<{ pointerId: number; dx: number; dy: number } | null>(null);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch('/api/demo/state', { cache: 'no-store', signal });
      const result = await response.json();
      if (response.status === 410 || response.status === 401) { setExpired(true); return; }
      if (!response.ok) { if (response.status === 503) setError(result.error ?? 'Demo verification is temporarily unavailable.'); return; }
      if (result.sessionId !== sessionId) { setExpired(true); return; }
      setState(result.tutorialState); setAllowance(result.allowance); setSelfSendEnabled(result.selfSendEnabled === true);
    } catch (cause) { if (!(cause instanceof DOMException && cause.name === 'AbortError')) setError('Could not refresh demo progress. Your product edits are not changed.'); }
  }, [sessionId]);
  useEffect(() => { setMounted(true); const controller = new AbortController(); void refresh(controller.signal);
    const listener = () => { if (document.visibilityState === 'visible') void refresh(controller.signal); };
    const timer = window.setInterval(listener, 12000); document.addEventListener('visibilitychange', listener); window.addEventListener('qc-demo-refresh', listener);
    return () => { controller.abort(); clearInterval(timer); document.removeEventListener('visibilitychange', listener); window.removeEventListener('qc-demo-refresh', listener); };
  }, [refresh]);
  useEffect(() => { const remaining = Date.parse(expiresAt) - Date.now(); if (remaining <= 0) { setExpired(true); return; }
    const timer = setTimeout(() => setExpired(true), Math.min(remaining, 2147483647)); return () => clearTimeout(timer);
  }, [expiresAt]);
  useEffect(() => { const resize = () => { if (widget.current) setPosition(previous => previous ? clampPosition(previous, widget.current!) : null); };
    window.addEventListener('resize', resize); return () => window.removeEventListener('resize', resize);
  }, []);
  const step = nextGuideStep(state); const progress = guideProgress(state);
  const chapterIndex = DEMO_GUIDE_CHAPTERS.findIndex(chapter => chapter.id === state.chapter);
  const chapter = DEMO_GUIDE_CHAPTERS[chapterIndex] ?? DEMO_GUIDE_CHAPTERS[0];
  const destination = guideHref(workspaceSlug, state); const destinationPath = destination.split('?')[0];
  const onExpectedPage = pathname === destinationPath;
  async function command(input: GuideCommand, navigate = false) {
    if (pending || expired) return; setPending(true); setError('');
    try {
      const response = await fetch('/api/demo/state', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? 'Could not save the guide.');
      setState(result.tutorialState); setOpen(result.tutorialState.mode === 'guided');
      if (navigate && typeof result.href === 'string') router.push(result.href);
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save guide progress.'); } finally { setPending(false); }
  }
  async function reset() {
    setPending(true); setError('');
    try {
      const response = await fetch('/api/demo/reset', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId, confirm: 'RESET' }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? 'Reset could not complete.');
      window.location.assign(`/${encodeURIComponent(result.slug)}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Reset could not complete.'); setPending(false); }
  }
  async function openPreview() {
    // Open synchronously while the click gesture is active, avoiding popup blockers.
    const tab = window.open('about:blank', '_blank'); if (tab) tab.opener = null;
    setPending(true); setError('');
    try {
      const response = await fetch('/api/demo/preview', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? 'Save your customer quote first.');
      if (tab) tab.location.replace(result.href); else window.location.assign(result.href);
      await refresh();
    } catch (cause) { tab?.close(); setError(cause instanceof Error ? cause.message : 'Preview could not open.'); } finally { setPending(false); }
  }
  function startDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!window.matchMedia('(min-width: 768px)').matches || !widget.current) return;
    const rect = widget.current.getBoundingClientRect(); drag.current = { pointerId: event.pointerId, dx: event.clientX - rect.left, dy: event.clientY - rect.top };
    event.currentTarget.setPointerCapture(event.pointerId); setPosition({ x: rect.left, y: rect.top });
  }
  function moveDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!drag.current || drag.current.pointerId !== event.pointerId || !widget.current) return;
    setPosition(clampPosition({ x: event.clientX - drag.current.dx, y: event.clientY - drag.current.dy }, widget.current));
  }
  const expiryLabel = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', day: 'numeric', month: 'short' }).format(new Date(expiresAt));
  const nextChapter = DEMO_GUIDE_CHAPTERS[chapterIndex + 1]?.id;
  const guide = <>
    {!open && <button className="qc-demo-reopen" type="button" onClick={() => setOpen(true)} aria-label="Resume guided demo">QCP demo · {progress.done}/{progress.total}<span>Resume guide</span></button>}
    {open && <aside ref={widget} className="qc-demo-guide" aria-label="QuoteCore+ demo guide" style={position ? { left: position.x, top: position.y, right: 'auto', bottom: 'auto' } : undefined}>
      <header className="qc-demo-guide-head"><button type="button" className="qc-demo-drag" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
        aria-label="Move guide. On desktop use arrow keys to reposition, Escape to reset." onKeyDown={event => { if (event.key === 'Escape') setPosition(null); const delta: Record<string, Position> = { ArrowLeft: {x:-20,y:0}, ArrowRight:{x:20,y:0},ArrowUp:{x:0,y:-20},ArrowDown:{x:0,y:20} }; if (delta[event.key] && widget.current) { event.preventDefault(); const rect = widget.current.getBoundingClientRect(); setPosition(clampPosition({ x: rect.left+delta[event.key].x, y: rect.top+delta[event.key].y }, widget.current)); } }}>⠿</button>
        <div><span>YOUR QCP DEMO · {Math.max(1, chapterIndex + 1)} OF 4</span><strong>{chapter.title}</strong></div>
        <button className="qc-demo-icon" type="button" aria-label="Collapse guide" onClick={() => setOpen(false)}>−</button></header>
      <div className="qc-demo-progress" role="progressbar" aria-label="Completed demo actions" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done}><i style={{ width: `${100 * progress.done / progress.total}%` }} /></div>
      <div className="qc-demo-guide-body">
        {step ? <><p className="qc-demo-eyebrow">{onExpectedPage ? 'YOUR NEXT ACTION' : 'GUIDE PAUSED WHILE YOU EXPLORE'}</p><h2>{step.title}</h2>
          <p>{onExpectedPage ? step.copy : `Resume “${step.title}” on the correct page. You can keep exploring here without losing your saved progress.`}</p>
          {state.guided_created_component_name && state.chapter === 'takeoff' && <p className="qc-demo-note">Your component: <strong>{state.guided_created_component_name}</strong>. Map scan measurements to priced roofing components before saving.</p>}
          {state.chapter === 'smart-assistant' && <p className="qc-demo-note">{allowance?.configured ? `${allowance.turnsRemaining} of ${allowance.turnsLimit} user turns remain. Reset does not restore them.` : 'Real Smart Assistant requires calibrated cost controls on this deployment. The rest of the demo remains available.'}</p>}
          {step.event === 'quote.previewed' && onExpectedPage ? <QcButton disabled={pending || expired} onClick={openPreview}>Open demo customer preview ↗</QcButton> : <a className="qc-demo-continue" href={destination}>{onExpectedPage ? 'Open this task' : 'Resume this task'} →</a>}
          {state.chapter === 'customer-quote' && selfSendEnabled && <a className="qc-demo-secondary-link" href={`/${workspaceSlug}/demo-guide/send`}>Send this demo quote to yourself</a>}
        </> : <><h2>{chapter.title} complete</h2><p>Your successful saved actions have been recorded.</p>{state.chapter === 'customer-quote' && selfSendEnabled && <a className="qc-demo-secondary-link" href={`/${workspaceSlug}/demo-guide/send`}>Send this demo quote to yourself</a>}{nextChapter ? <QcButton disabled={pending} onClick={() => void command({action:'chapter',chapter:nextChapter},true)}>Continue to {DEMO_GUIDE_CHAPTERS[chapterIndex+1].title}</QcButton> : <QcButton onClick={() => setCompleteOpen(true)}>Review your demo</QcButton>}</>}
        {error && <p role="alert" className="qc-demo-error">{error}</p>}
        <div className="qc-demo-guide-links"><button type="button" disabled={pending} onClick={() => void command({action:'explore'})}>Explore / resume later</button><a href={`/${workspaceSlug}/demo-guide`}>All chapters</a><button type="button" onClick={() => setPosition(null)}>Reset position</button></div>
      </div>
    </aside>}
    <QcDialog open={!state.welcomed && !expired} pending={pending} onRequestClose={() => void command({action:'welcome',mode:'explore'})} title="Welcome to the QuoteCore+ demo" description="QCP Roofing & Construction is fictional. This workspace is yours to experiment with for up to 24 hours."
      footer={<><QcButton disabled={pending} onClick={() => void command({action:'welcome',mode:'guided'},true)}>Show me how it works</QcButton><QcButton disabled={pending} variant="secondary" onClick={() => void command({action:'welcome',mode:'explore'})}>I’ll explore myself</QcButton></>}>
      <p className="qc-demo-copy">Build pricing, measure a prepared roof, prepare a customer quote and try real Smart Assistant. The prepared scan is precomputed; your edits and calculations are real. Prices are examples, not pricing advice. Arbitrary sending and integrations are disabled.</p>{error && <p role="alert" className="qc-demo-error">{error}</p>}
    </QcDialog>
    <QcDialog open={resetOpen} pending={pending} onRequestClose={() => setResetOpen(false)} title="Start again from the QCP seed?" description="This removes your edits, created records, measurements and guide progress. AI and email allowances are not restored. Other open demo tabs will become invalid."
      footer={<><QcButton disabled={pending} variant="secondary" onClick={() => setResetOpen(false)}>Keep exploring</QcButton><QcButton disabled={pending} onClick={reset}>{pending ? 'Preparing your fresh demo…' : 'Reset demo'}</QcButton></>}>{error && <p role="alert" className="qc-demo-error">{error}</p>}</QcDialog>
    <QcDialog open={expired} onRequestClose={() => window.location.assign('/demo')} title="This demo has ended" description="It expired or was reset in another tab. Start again for a fresh fictional workspace. Your remaining resource allowances do not reset.">
      <a className="qc-demo-continue" href="/demo">Start a fresh demo</a><a className="qc-demo-secondary-link" href={normalAccountHref(mounted ? window.location.hostname : '')}>Get your own account</a>
    </QcDialog>
    <QcDialog open={completeOpen} onRequestClose={() => setCompleteOpen(false)} title={progress.done === progress.total ? 'You’ve tried the QuoteCore+ workflow' : 'Keep exploring QuoteCore+'} description="Digital Takeoff and Smart Assistant are optional. Existing measurements can be entered directly. Orders, invoices and the rest of the sandbox are still here."
      footer={<><a className="qc-demo-continue" href={normalAccountHref(mounted ? window.location.hostname : '')}>Get your own account</a><a className="qc-demo-secondary-link" href="https://quote-core.com/done-for-you-setup">Ask about Done For You</a><QcButton variant="secondary" onClick={() => setCompleteOpen(false)}>Continue exploring</QcButton></>}><p>{progress.done} of {progress.total} guided actions completed. This is only part of what QuoteCore+ can do.</p></QcDialog>
  </>;
  return <><div className="qc-demo-banner"><strong>DEMO</strong><span>Fictional · available until {expiryLabel}</span><button type="button" onClick={() => setOpen(true)}>Demo guide</button><button type="button" onClick={() => setResetOpen(true)}>Start again</button><a href={normalAccountHref(mounted ? window.location.hostname : '')}>Get your own account</a></div>{mounted && createPortal(guide, document.body)}</>;
}
