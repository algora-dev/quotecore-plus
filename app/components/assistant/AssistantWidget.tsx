'use client';

/**
 * AssistantWidget — floating chat widget
 * =======================================
 * The in-app help surface (legacy Copilot removed — this is now the SOLE
 * guided-help surface). Floating, draggable, collapsible to a small message
 * emblem that reopens the conversation at its last point. Streams responses
 * over SSE via useAssistantChat.
 *
 * STAGE 1 NOTE: the conversational Guide-me re-architecture (intent-led,
 * cross-page, library-driven) lands in Stage 3. For now this widget keeps the
 * Respond / Guide-me mode toggle + the Highlights preference and the
 * server-issued highlight path (useAssistantHighlight). It no longer couples to
 * the old Copilot engine in any way.
 *
 * Gated by NEXT_PUBLIC_AI_ASSISTANT_V1. The Help Drawer stays as a docs fallback.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AssistantMode } from '@/app/lib/assistant/protocol';
import { getElement } from '@/app/lib/assistant/uiRegistry';
import { useAssistantChat } from './useAssistantChat';
import { useAssistantHints } from './useAssistantHints';
import { useAssistantHighlight } from './useAssistantHighlight';
import { useBrowserFacts } from './useBrowserFacts';
import { useGuideEngine, type GuideStep } from './useGuideEngine';

/**
 * Render one guided step as an assistant-style chat message (Fix 1c + Fix 2).
 * Names the actual control. Only says "highlighted" when highlights are ON; when
 * OFF, it names the control explicitly (label via the UI registry, else the
 * step title) and never implies a glow/pointer.
 */
function stepMessageText(step: GuideStep, highlightsOn: boolean): string {
  const label = step.elementId ? getElement(step.elementId)?.label ?? null : null;
  const controlName = label ?? step.title;
  const lines = [`Step: ${step.title}`, '', step.instruction.trim()];
  if (step.elementId) {
    lines.push(
      '',
      highlightsOn
        ? `I’ve highlighted ${controlName} for you on screen.`
        : `Look for ${controlName} on screen.`
    );
  }
  return lines.join('\n');
}

/** Does a recent action / visible-element set satisfy this step's doneSignal? */
function isStepDone(
  step: GuideStep,
  recentActions: { elementId: string; kind: string }[],
  visibleElementIds: string[]
): boolean {
  const sig = step.doneSignal;
  switch (sig.kind) {
    case 'manual':
      return false; // never auto-advance — rely on the Next button
    case 'clicked': {
      const target = sig.elementId ?? step.elementId;
      return !!target && recentActions.some((a) => a.elementId === target && a.kind === 'click');
    }
    case 'input-filled': {
      const target = sig.elementId ?? step.elementId;
      return (
        !!target &&
        recentActions.some(
          (a) => a.elementId === target && (a.kind === 'input' || a.kind === 'change')
        )
      );
    }
    case 'element-appears': {
      const target = sig.elementId;
      return !!target && visibleElementIds.includes(target);
    }
    default:
      return false;
  }
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
  const [highlightsOn, setHighlightsOn] = useState(true);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ dx: number; dy: number; moved: boolean } | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const {
    messages,
    status,
    highlight,
    guideStart,
    clearGuideStart,
    pushAssistantMessage,
    send,
    cancel,
    reset,
  } = useAssistantChat();
  const { buildHints } = useAssistantHints();
  // Passive browser-facts observer (Stage 3). Its recentActions are merged into
  // the per-turn hints so the assistant can judge whether a guide step is done.
  const { getFacts } = useBrowserFacts();

  // CLIENT step-engine (Stage 4, Fix 1): once the model confirms a workflow and
  // emits guide_start, the engine holds the full step list and drives stepping
  // locally — instant, deterministic, zero LLM tokens per step.
  const engine = useGuideEngine();

  // The highlight to render: the engine's current-step highlight takes priority
  // (persistent follow-along) while a workflow is active; otherwise the
  // server-SSE one-off highlight from chat. Persistent mode is on iff the
  // engine is driving.
  const activeHighlight = engine.isActive ? engine.currentHighlight : highlight;
  const highlightRect = useAssistantHighlight(
    activeHighlight,
    highlightsOn,
    engine.isActive
  );

  // Load the persisted Highlights preference once on mount (default ON).
  useEffect(() => {
    try {
      if (window.localStorage.getItem(HIGHLIGHTS_PREF_KEY) === 'off') {
        setHighlightsOn(false);
      }
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

  // Auto-scroll to the latest message while streaming.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Drag handling (pointer events on the header). Tracks `moved` so a click on
  // the collapse control isn't swallowed by an accidental micro-drag.
  const onPointerDownHeader = useCallback((e: React.PointerEvent) => {
    // Don't start a drag (and don't capture the pointer) when the press lands
    // on an interactive control in the header — otherwise setPointerCapture
    // swallows the control's click (this is what made the "hide" button dead).
    if ((e.target as HTMLElement).closest('button, a, input, [role="switch"]')) {
      return;
    }
    const panel = (e.currentTarget as HTMLElement).closest(
      '[data-assistant-panel]'
    ) as HTMLElement | null;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    dragRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);
  const onPointerMoveHeader = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    dragRef.current.moved = true;
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
      // Merge live browser facts (recentActions) into the per-turn hints. Both
      // buildHints and getFacts scan the DOM at send-time, so they agree on the
      // current screen + visible elements; we add recentActions on top.
      const facts = getFacts();
      void send(
        text,
        {
          hints: { ...buildHints(), recentActions: facts.recentActions },
          mode,
          highlightsOn,
        }
      );
    },
    [input, status, send, buildHints, getFacts, mode, highlightsOn]
  );

  // --- Client step-engine wiring (Fix 1c/1d/1e) ---------------------------

  // When the model confirms a workflow (begin_guide → guide_start SSE), start
  // the client engine. The chat coexists — chatting never resets the engine.
  useEffect(() => {
    if (!guideStart) return;
    void engine.startWorkflow(guideStart.workflowId);
    clearGuideStart();
    // engine.startWorkflow is stable (useCallback); guideStart is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guideStart]);

  // Render each new current step as an assistant-style message. Keyed on the
  // engine's currentIndex so we post exactly one bubble per step (incl. step 0
  // when a workflow starts). The highlight fires via activeHighlight above.
  const lastPostedStepRef = useRef<string | null>(null);
  useEffect(() => {
    if (!engine.isActive || !engine.current) {
      if (!engine.isActive) lastPostedStepRef.current = null;
      return;
    }
    const stamp = `${engine.workflowId}:${engine.currentIndex}`;
    if (lastPostedStepRef.current === stamp) return;
    lastPostedStepRef.current = stamp;
    pushAssistantMessage(stepMessageText(engine.current, highlightsOn));
    // highlightsOn intentionally read at post time; step changes drive this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine.isActive, engine.currentIndex, engine.workflowId, engine.current]);

  // FACTS-BASED AUTO-ADVANCE (Fix 1d): poll live browser facts; if the current
  // step's doneSignal is satisfied, advance without waiting for the button.
  // Best-effort magic; the Next button is the reliable fallback. 'manual' steps
  // never auto-advance.
  useEffect(() => {
    if (!engine.isActive || !engine.current) return;
    if (engine.current.doneSignal.kind === 'manual') return;
    const id = window.setInterval(() => {
      const facts = getFacts();
      if (
        engine.current &&
        isStepDone(engine.current, facts.recentActions, facts.visibleElementIds)
      ) {
        engine.next();
      }
    }, 700);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine.isActive, engine.currentIndex, engine.workflowId]);

  // Starting a brand-new conversation also stops any active guided workflow.
  const handleReset = useCallback(() => {
    engine.reset();
    reset();
  }, [engine, reset]);

  if (!ENABLED) return null;

  const panelStyle: React.CSSProperties = pos
    ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' }
    : { right: 20, bottom: 20 };

  const hasConversation = messages.length > 0;

  return (
    <>
      {/* Arrow pointer at the highlighted control (other treatments style the
          element itself via useAssistantHighlight). */}
      {highlightRect && highlightRect.treatment === 'arrow' && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-[70] -translate-y-full text-[#ff6b35]"
          style={{
            top: highlightRect.top - 8,
            left: highlightRect.left + highlightRect.width / 2 - 8,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 18 L3 7 L10 10 L17 7 Z" />
          </svg>
        </div>
      )}

      {/* Collapsed launcher / message emblem. Reopening preserves the existing
          conversation (state lives in the hook, which stays mounted). A small
          dot indicates an in-progress conversation to return to. */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          data-assistant-id="assistant-launcher"
          aria-label={hasConversation ? 'Reopen assistant conversation' : 'Open assistant'}
          className="assistant-launcher group fixed bottom-5 right-5 z-[60] inline-flex h-12 w-12 items-center justify-center rounded-full border-2 border-transparent bg-slate-900 text-white transition-colors duration-200 ease-in-out hover:bg-slate-800"
        >
          {/* Message emblem (no emoji) */}
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
          {hasConversation && (
            <span className="absolute right-0 top-0 h-3 w-3 rounded-full border-2 border-white bg-[#ff6b35]" />
          )}
        </button>
      )}

      {open && (
        <div
          data-assistant-panel
          style={{ ...panelStyle, transformOrigin: pos ? 'center' : 'bottom right' }}
          className="group/panel fixed z-[60] flex h-[34rem] w-[23rem] max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl transition-transform duration-150 ease-out hover:scale-[1.02]"
        >
          {/* Header (drag handle) */}
          <div
            onPointerDown={onPointerDownHeader}
            onPointerMove={onPointerMoveHeader}
            onPointerUp={onPointerUpHeader}
            className="flex cursor-move select-none items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3"
          >
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-white">
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
              </span>
              <span className="text-sm font-semibold text-slate-800">Assistant</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleReset}
                title="Start a new conversation"
                className="rounded-full px-2.5 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
              >
                New
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                title="Click to Hide"
                aria-label="Hide assistant"
                className="group/hide inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-500 transition-all duration-200 hover:bg-slate-900 hover:text-white hover:shadow-[0_0_12px_rgba(255,107,53,0.5)]"
              >
                {/* Obvious ">" retract-to-emblem control (no emoji) */}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
            </div>
          </div>

          {/* Mode toggle (+ Highlights switch, Guide-me only) */}
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2">
            <div className="inline-flex rounded-full bg-slate-100 p-0.5">
              {(['respond_only', 'guide_me'] as AssistantMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                    mode === m
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {m === 'respond_only' ? 'Respond' : 'Guide me'}
                </button>
              ))}
            </div>
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
                className="ml-auto inline-flex items-center gap-2 text-xs font-medium text-slate-600"
              >
                <span>Highlights</span>
                <span
                  className={`relative inline-block h-4 w-7 rounded-full transition-colors ${
                    highlightsOn ? 'bg-[#ff6b35]' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${
                      highlightsOn ? 'translate-x-3.5' : 'translate-x-0.5'
                    }`}
                  />
                </span>
              </button>
            )}
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {!hasConversation && (
              <p className="mx-auto mt-8 max-w-[16rem] text-center text-sm leading-relaxed text-slate-400">
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
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-800'
                  }`}
                >
                  {m.content ? (
                    m.content
                  ) : m.streaming ? (
                    <span className="assistant-typing" aria-label="Assistant is typing">
                      <span />
                      <span />
                      <span />
                    </span>
                  ) : (
                    ''
                  )}
                  {m.error && (
                    <span className="mt-1 block text-xs text-red-500">{m.error}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Guided-workflow control bar (Fix 1c). Shown only while the client
              step-engine is driving a workflow. "Next step →" is INSTANT — the
              steps are already in memory (preloaded), so the click advances
              with no fetch/LLM round-trip. Facts auto-advance can move ahead of
              the button; this is the reliable fallback. */}
          {engine.isActive && engine.current && (
            <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50 px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-500">
                {engine.workflowName ? `${engine.workflowName} · ` : ''}
                Step {engine.currentIndex + 1} of {engine.steps.length}
              </span>
              <button
                type="button"
                onClick={() => engine.next()}
                disabled={engine.upcoming === null}
                className="shrink-0 rounded-full bg-[#ff6b35] px-3.5 py-1.5 text-xs font-semibold text-white transition-all hover:bg-[#e85f2e] disabled:cursor-default disabled:opacity-40"
              >
                {engine.upcoming === null ? 'Last step' : 'Next step →'}
              </button>
            </div>
          )}

          {/* Composer */}
          <form
            onSubmit={submit}
            className="flex items-end gap-2 border-t border-slate-200 p-3"
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
              className="max-h-24 flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition-colors focus:border-[#ff6b35] focus:ring-1 focus:ring-[#ff6b35]"
            />
            {status === 'streaming' ? (
              <button
                type="button"
                onClick={cancel}
                className="rounded-full bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-300"
              >
                Stop
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_12px_rgba(255,107,53,0.4)] disabled:opacity-40 disabled:hover:shadow-none"
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
