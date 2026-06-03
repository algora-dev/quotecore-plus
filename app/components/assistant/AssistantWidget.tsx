'use client';

/**
 * AssistantWidget — floating chat widget (Phase 2)
 * =================================================
 * The first client of the assistant backend. Floating, draggable, collapsible,
 * persists across pages (mounted in the workspace layout). Streams responses
 * over SSE via useAssistantChat. Mode toggle (Respond only / Guide me) is wired
 * but Guide-me's proactive behaviour fully lands with workflow tools (Phase 3).
 *
 * Gated by NEXT_PUBLIC_AI_ASSISTANT_V1. The Help Drawer stays as a fallback.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { AssistantMode } from '@/app/lib/assistant/protocol';
import { useCopilot } from '@/app/components/copilot/CopilotProvider';
import type { CopilotEngineSnapshot } from '@/app/components/copilot/CopilotProvider';
import { useAssistantChat } from './useAssistantChat';
import { useAssistantHints } from './useAssistantHints';
import { useAssistantHighlight } from './useAssistantHighlight';
import type { ActiveHighlight } from './useAssistantChat';

/** Pull a registry elementId out of a Copilot `target` selector, if present.
 *  e.g. `[data-copilot="quote-customer"]` -> "quote-customer". Mirrors
 *  workflowService.elementIdFromTarget; kept local so this stays client-only. */
function elementIdFromCopilotTarget(target: string | undefined): string | null {
  if (!target) return null;
  const m = /\[data-copilot="([^"]+)"\]/.exec(target);
  return m ? m[1] : null;
}

const ENABLED =
  (process.env.NEXT_PUBLIC_AI_ASSISTANT_V1 ?? '').toLowerCase() === 'true';

interface Props {
  userId: string;
  companyId: string;
  trade?: string;
}

const HIGHLIGHTS_PREF_KEY = 'qc-assistant-highlights';

export function AssistantWidget(_props: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AssistantMode>('respond_only');
  const [input, setInput] = useState('');
  // Highlights preference (Guide-me only). Default ON; persisted per-browser.
  // When off, server still emits highlight commands but the client draws
  // nothing — the chat still describes where the control is.
  const [highlightsOn, setHighlightsOn] = useState(true);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // Hover-to-reveal tooltip (Guide-me only): the rect of the highlighted
  // element while the user is hovering it. Null when not hovering.
  const [hoverRect, setHoverRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  const { messages, status, highlight, send, cancel, reset } = useAssistantChat();
  const { buildHints } = useAssistantHints();
  const pathname = usePathname();

  // Live Copilot engine state (the "brain"). In Guide-me we subscribe to this
  // and follow its step progression rather than blind DB polling.
  const {
    isActive: copilotActive,
    currentStepData,
    beginAssistantEngine,
    endAssistantEngine,
  } = useCopilot();

  // SPIKE SCOPE: only the create-quote flow on /quotes/new is rewired to the
  // live Copilot engine. Everywhere else, Guide-me keeps its existing
  // server-SSE highlight behaviour untouched.
  const guideMeOnThisScreen =
    mode === 'guide_me' && !!pathname && /\/quotes\/new$/.test(pathname);

  // While Guide-me is live on this screen, derive the highlight from Copilot's
  // CURRENT step element. This is ADDITIVE to the server-SSE highlight path
  // (which still drives respond mode / other screens). When guiding, the
  // Copilot-derived highlight takes precedence.
  const copilotElementId = elementIdFromCopilotTarget(currentStepData?.target);
  const guiding = guideMeOnThisScreen && open && copilotActive;

  const copilotHighlight: ActiveHighlight | null = useMemo(() => {
    if (!guiding || !copilotElementId) return null;
    return {
      type: 'highlight',
      elementId: copilotElementId,
      treatment: 'pulse',
      // Stable key per element so the executor re-fires as steps advance but
      // not on every render.
      key: `copilot-${copilotElementId}`,
    };
  }, [guiding, copilotElementId]);

  // Phase 4: execute highlight commands on the page — gated by the user's
  // Highlights preference. In Guide-me on this screen, drive from Copilot's
  // live step; otherwise use the server-issued highlight.
  const activeHighlight = copilotHighlight ?? highlight;
  const highlightRect = useAssistantHighlight(
    activeHighlight,
    highlightsOn,
    /* persistent (follow-along) only when Copilot is driving */ !!copilotHighlight
  );

  // Load the persisted Highlights preference once on mount (default ON).
  useEffect(() => {
    try {
      const v = window.localStorage.getItem(HIGHLIGHTS_PREF_KEY);
      if (v === 'off') setHighlightsOn(false);
    } catch {
      /* localStorage unavailable — keep default */
    }
  }, []);

  const toggleHighlights = useCallback(() => {
    setHighlightsOn((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(HIGHLIGHTS_PREF_KEY, next ? 'on' : 'off');
      } catch {
        /* ignore persistence failure */
      }
      return next;
    });
  }, []);
  // Snapshot of the user's real Copilot state, captured when Guide-me takes
  // over the engine so we can restore it exactly on exit (never clobber the
  // user's persisted Copilot preference).
  const engineSnapshotRef = useRef<CopilotEngineSnapshot | null>(null);

  // Auto-scroll to the latest message while streaming.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Guide-me engine lifecycle (create-quote on /quotes/new only, this spike).
  // When Guide-me is open on this screen, we (1) start Copilot's detection
  // engine ephemerally (snapshotting the user's real pref), and (2) set a body
  // marker so the legacy CopilotOverlay hides while its engine keeps running
  // underneath. On exit (mode change / close / navigate away) we clear the
  // marker and restore the snapshot exactly.
  //
  // The chat is intentionally SILENT here: no auto-kickoff turn, no per-step
  // narration. The flow is highlight + hover-tooltip driven. The chat only
  // responds when the user types a question.
  useEffect(() => {
    if (!guideMeOnThisScreen || !open) return;

    // Take over the engine (idempotent: only snapshot once).
    if (!engineSnapshotRef.current) {
      engineSnapshotRef.current = beginAssistantEngine('create-quote');
    }
    if (typeof document !== 'undefined') {
      document.body.dataset.assistantGuiding = '1';
    }

    return () => {
      if (typeof document !== 'undefined') {
        delete document.body.dataset.assistantGuiding;
      }
      if (engineSnapshotRef.current) {
        endAssistantEngine(engineSnapshotRef.current);
        engineSnapshotRef.current = null;
      }
    };
  }, [guideMeOnThisScreen, open, beginAssistantEngine, endAssistantEngine]);

  // Hover-to-reveal tooltip wiring (Guide-me, this screen only). When Copilot
  // is highlighting an element, attach hover listeners to that live DOM node so
  // hovering reveals the authored step.description (INSTANT static text — the
  // SAME string Copilot would show; no LLM). Desktop hover is fine (web app is
  // desktop-first; mobile is a separate future app). When Guide-me is off, this
  // effect doesn't run, so existing hover behaviour is unchanged.
  useEffect(() => {
    if (!copilotHighlight || !highlightsOn || typeof document === 'undefined') {
      setHoverRect(null);
      return;
    }
    const id = copilotHighlight.elementId;
    const escaped = window.CSS?.escape ? window.CSS.escape(id) : id.replace(/"/g, '\\"');
    const el =
      document.querySelector<HTMLElement>(`[data-assistant-id="${escaped}"]`) ??
      document.querySelector<HTMLElement>(`[data-copilot="${escaped}"]`);
    if (!el) {
      setHoverRect(null);
      return;
    }
    const measure = () => {
      const r = el.getBoundingClientRect();
      setHoverRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    const onEnter = () => measure();
    const onLeave = () => setHoverRect(null);
    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mouseleave', onLeave);
    // Keep the tooltip anchored if the page scrolls while hovering.
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      el.removeEventListener('mouseenter', onEnter);
      el.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
      setHoverRect(null);
    };
  }, [copilotHighlight, highlightsOn]);

  // Drag handling (pointer events on the header).
  const onPointerDownHeader = useCallback((e: React.PointerEvent) => {
    const panel = (e.currentTarget as HTMLElement).closest(
      '[data-assistant-panel]'
    ) as HTMLElement | null;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    dragRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);
  const onPointerMoveHeader = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const x = e.clientX - dragRef.current.dx;
    const y = e.clientY - dragRef.current.dy;
    setPos({
      x: Math.max(8, Math.min(window.innerWidth - 80, x)),
      y: Math.max(8, Math.min(window.innerHeight - 80, y)),
    });
  }, []);
  const onPointerUpHeader = useCallback(() => {
    dragRef.current = null;
  }, []);

  const submit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      const text = input;
      if (!text.trim() || status === 'streaming') return;
      setInput('');
      void send(text, { hints: buildHints(), mode });
    },
    [input, status, send, buildHints, mode]
  );

  if (!ENABLED) return null;

  // Hover tooltip text = the authored Copilot step.description (same string the
  // legacy overlay shows). Rendered with the same _italic_ convention.
  const hoverText = currentStepData?.description ?? '';
  const showHoverTip = !!hoverRect && guiding && !!hoverText;
  // Position: prefer to the right of the element, flip left near the edge,
  // clamp to viewport. Tooltip width ~288px (w-72).
  const TIP_W = 288;
  let tipLeft = 0;
  let tipTop = 0;
  if (hoverRect) {
    const spaceRight = window.innerWidth - (hoverRect.left + hoverRect.width);
    tipLeft =
      spaceRight > TIP_W + 24
        ? hoverRect.left + hoverRect.width + 12
        : Math.max(12, hoverRect.left - TIP_W - 12);
    tipTop = Math.max(12, Math.min(hoverRect.top, window.innerHeight - 160));
  }

  const panelStyle: React.CSSProperties = pos
    ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' }
    : { right: 20, bottom: 20 };

  return (
    <>
      {/* Guide-me hover-to-reveal tooltip: hovering the highlighted element
          reveals the authored step description instantly (static text). */}
      {showHoverTip && (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-[80] w-72 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-2xl"
          style={{ top: tipTop, left: tipLeft }}
        >
          {currentStepData?.title && (
            <p className="mb-1 text-sm font-semibold text-slate-900">
              {currentStepData.title}
            </p>
          )}
          <p className="text-xs leading-relaxed text-slate-600">
            {hoverText.split(/(_[^_]+_)/g).map((part, i) =>
              part.startsWith('_') && part.endsWith('_') ? (
                <em key={i} className="italic text-slate-700">
                  {part.slice(1, -1)}
                </em>
              ) : (
                <span key={i}>{part}</span>
              )
            )}
          </p>
        </div>
      )}

      {/* Phase 4: arrow pointer at the highlighted control (other treatments
          style the element itself via useAssistantHighlight). */}
      {highlightRect && highlightRect.treatment === 'arrow' && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-[70] -translate-y-full animate-bounce text-2xl"
          style={{
            top: highlightRect.top - 6,
            left: highlightRect.left + highlightRect.width / 2 - 10,
          }}
        >
          ⤵️
        </div>
      )}

      {/* Launcher */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          data-assistant-id="assistant-launcher"
          className="fixed bottom-5 right-5 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition hover:bg-blue-700"
          aria-label="Open assistant"
        >
          <span className="text-2xl">💬</span>
        </button>
      )}

      {open && (
        <div
          data-assistant-panel
          style={panelStyle}
          className="fixed z-[60] flex h-[32rem] w-[22rem] max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        >
          {/* Header (drag handle) */}
          <div
            onPointerDown={onPointerDownHeader}
            onPointerMove={onPointerMoveHeader}
            onPointerUp={onPointerUpHeader}
            className="flex cursor-move items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 select-none"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">🔨</span>
              <span className="text-sm font-semibold text-slate-700">Assistant</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={reset}
                title="New conversation"
                className="rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-200"
              >
                New
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                title="Collapse"
                aria-label="Collapse assistant"
                className="rounded px-1.5 py-0.5 text-slate-500 hover:bg-slate-200"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Mode toggle (+ Highlights switch, Guide-me only) */}
          <div className="flex items-center gap-1 border-b border-slate-100 px-3 py-1.5 text-xs">
            <span className="text-slate-400">Mode:</span>
            {(['respond_only', 'guide_me'] as AssistantMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-full px-2 py-0.5 font-medium transition ${
                  mode === m
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {m === 'respond_only' ? 'Respond' : 'Guide me'}
              </button>
            ))}
            {mode === 'guide_me' && (
              <button
                type="button"
                onClick={toggleHighlights}
                role="switch"
                aria-checked={highlightsOn}
                title={
                  highlightsOn
                    ? 'Highlights on — the assistant points to the next control'
                    : 'Highlights off — the assistant only describes where to go'
                }
                className={`ml-auto flex items-center gap-1 rounded-full px-2 py-0.5 font-medium transition ${
                  highlightsOn
                    ? 'bg-amber-100 text-amber-700'
                    : 'text-slate-400 hover:bg-slate-100'
                }`}
              >
                <span>{highlightsOn ? '✨' : '○'}</span>
                <span>Highlights</span>
              </button>
            )}
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {messages.length === 0 && (
              <p className="mt-6 text-center text-sm text-slate-400">
                Ask me anything about QuoteCore+ — how to build a quote, what a
                field means, or where to find something.
              </p>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                    m.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-800'
                  }`}
                >
                  {m.content || (m.streaming ? '…' : '')}
                  {m.error && (
                    <span className="mt-1 block text-xs text-red-500">
                      {m.error}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Composer */}
          <form
            onSubmit={submit}
            className="flex items-end gap-2 border-t border-slate-200 p-2"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) submit(e);
              }}
              rows={1}
              placeholder="Ask the assistant…"
              data-assistant-id="assistant-input"
              className="max-h-24 flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
            {status === 'streaming' ? (
              <button
                type="button"
                onClick={cancel}
                className="rounded-lg bg-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300"
              >
                Stop
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
              >
                Send
              </button>
            )}
          </form>
        </div>
      )}
    </>
  );
}
