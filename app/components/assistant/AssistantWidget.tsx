'use client';

/**
 * AssistantWidget - floating chat widget
 * =======================================
 * The in-app help surface (legacy Copilot removed - this is now the SOLE
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

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { AssistantMode } from '@/app/lib/assistant/protocol';
import { getElement } from '@/app/lib/assistant/uiRegistry';
import { useAssistantChat } from './useAssistantChat';
import { useAssistantHints } from './useAssistantHints';
import { useAssistantHighlight } from './useAssistantHighlight';
import { useBrowserFacts } from './useBrowserFacts';
import { useGuideEngine, type GuideStep } from './useGuideEngine';
import { START_GUIDE_EVENT, type StartGuideDetail } from './startGuide';
import { loadGuide } from './assistantPersistence';

/**
 * Render inline markdown emphasis (**bold**, _italic_ / *italic*) to React
 * nodes so guide-step + assistant text shows formatted instead of leaking the
 * raw markers (e.g. "_Order items_"). Deliberately tiny - emphasis only, no
 * links/headings/code - so there is NO new dependency and no block parsing.
 * Newlines are preserved by the bubble's `whitespace-pre-wrap`.
 */
function renderInlineMarkdown(text: string): ReactNode[] {
  // Alternating split on **bold**, then _italic_ / *italic* within each piece.
  const out: ReactNode[] = [];
  let key = 0;
  const boldParts = text.split(/(\*\*[^*]+\*\*)/g);
  for (const part of boldParts) {
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      out.push(<strong key={key++}>{part.slice(2, -2)}</strong>);
      continue;
    }
    // Italic: _text_ or *text* (single). Split and wrap matches.
    const italicParts = part.split(/(_[^_]+_|\*[^*]+\*)/g);
    for (const ip of italicParts) {
      if (!ip) continue;
      if (/^_[^_]+_$/.test(ip) || /^\*[^*]+\*$/.test(ip)) {
        out.push(<em key={key++}>{ip.slice(1, -1)}</em>);
      } else {
        out.push(<span key={key++}>{ip}</span>);
      }
    }
  }
  return out;
}

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

/**
 * Reset / re-sync: infer the user's REAL current step from live browser facts,
 * for when they've clicked Next too many times (or too few) and the pointer is
 * out of line with reality. Conservative by design: returns a confident index
 * or null (ambiguous), so the caller can fall back to asking the user.
 *
 * Heuristic (cheap, explainable):
 *  - A step whose target elementId is currently VISIBLE is a strong candidate
 *    for "where the user can act right now".
 *  - If exactly one step's element is visible, that's the answer (high
 *    confidence).
 *  - If several are visible (elements repeat across steps), pick the EARLIEST
 *    visible step at/after 0 that the user hasn't clearly completed - i.e. the
 *    first actionable on-screen step - but only return it when it's unambiguous
 *    enough; otherwise return null and let the chatbot ask.
 */
function inferCurrentStepIndex(
  steps: GuideStep[],
  visibleElementIds: string[]
): number | null {
  const visibleStepIdxs: number[] = [];
  steps.forEach((s, i) => {
    if (s.elementId && visibleElementIds.includes(s.elementId)) {
      visibleStepIdxs.push(i);
    }
  });
  if (visibleStepIdxs.length === 0) return null; // nothing on screen - ask
  if (visibleStepIdxs.length === 1) return visibleStepIdxs[0]; // confident
  // Multiple on-screen candidates: only commit if they're CONTIGUOUS (a normal
  // single-screen run of steps) - then the earliest is the right place to be.
  const first = visibleStepIdxs[0];
  const contiguous = visibleStepIdxs.every((v, k) => v === first + k);
  return contiguous ? first : null; // non-contiguous = genuinely ambiguous
}

/** Does a recent action / visible-element set satisfy this step's doneSignal? */
/**
 * Baseline captured the moment a step becomes current. Auto-advance must only
 * fire on a signal that is NEW relative to this baseline - otherwise a step
 * whose done-element is ALREADY on screen (very common) would advance instantly,
 * cascading through every step and fast-forwarding the whole guide to Finish.
 */
interface StepBaseline {
  /** elementIds already visible when the step started (so 'element-appears'
   *  only fires for elements that appear AFTER, as a result of the user act). */
  visibleAtStart: Set<string>;
  /** recentActions length at step start (so 'clicked'/'input' only count new
   *  actions taken DURING this step, not stale ones from before). */
  actionsAtStart: number;
}

function isStepDone(
  step: GuideStep,
  recentActions: { elementId: string; kind: string }[],
  visibleElementIds: string[],
  baseline: StepBaseline | null
): boolean {
  const sig = step.doneSignal;
  // Only actions taken AFTER the step started count toward completion.
  const freshActions = baseline ? recentActions.slice(baseline.actionsAtStart) : recentActions;
  switch (sig.kind) {
    case 'manual':
      return false; // never auto-advance - rely on the Next button
    case 'clicked': {
      const target = sig.elementId ?? step.elementId;
      return !!target && freshActions.some((a) => a.elementId === target && a.kind === 'click');
    }
    case 'input-filled': {
      const target = sig.elementId ?? step.elementId;
      return (
        !!target &&
        freshActions.some(
          (a) => a.elementId === target && (a.kind === 'input' || a.kind === 'change')
        )
      );
    }
    case 'element-appears': {
      const target = sig.elementId;
      // Must NEWLY appear: visible now AND not already visible at step start.
      return !!target && visibleElementIds.includes(target) && !(baseline?.visibleAtStart.has(target));
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
  /** Per-user Chat Assistant visibility preference (Account settings). Default
   *  true. When false the widget renders nothing. */
  enabled?: boolean;
}

const HIGHLIGHTS_PREF_KEY = 'qc-assistant-highlights';

export function AssistantWidget(_props: Props) {
  const userEnabled = _props.enabled !== false;
  // Stay open on mount if a guide is mid-flow (e.g. we just navigated to the
  // highlighted page) so the restored conversation + next step are visible
  // rather than collapsing behind the emblem.
  const [open, setOpen] = useState(
    () => typeof window !== 'undefined' && !!loadGuide()
  );
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
  } = useAssistantChat();
  const { buildHints } = useAssistantHints();
  // Passive browser-facts observer (Stage 3). Its recentActions are merged into
  // the per-turn hints so the assistant can judge whether a guide step is done.
  const { getFacts } = useBrowserFacts();

  // CLIENT step-engine (Stage 4, Fix 1): once the model confirms a workflow and
  // emits guide_start, the engine holds the full step list and drives stepping
  // locally - instant, deterministic, zero LLM tokens per step.
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
      /* localStorage unavailable - keep default */
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
    // on an interactive control in the header - otherwise setPointerCapture
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
  // the client engine. The chat coexists - chatting never resets the engine.
  useEffect(() => {
    if (!guideStart) return;
    // Pass the live pathname so the engine can prepend a "get to the start
    // page" step when the user isn't already on the workflow's start page.
    void engine.startWorkflow(
      guideStart.workflowId,
      typeof window !== 'undefined' ? window.location.pathname : null
    );
    clearGuideStart();
    // engine.startWorkflow is stable (useCallback); guideStart is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guideStart]);

  // External launch bridge (Option A): any client surface (Tutorials page, help
  // links) can fire a `qcp:start-guide` CustomEvent to begin a known workflow
  // programmatically - no LLM round-trip. We open the panel and hand the live
  // pathname to the engine so it can prepend a "get to the start page" hop.
  useEffect(() => {
    if (!userEnabled) return;
    const onStartGuide = (e: Event) => {
      const workflowId = (e as CustomEvent<StartGuideDetail>).detail?.workflowId;
      if (!workflowId) return;
      setOpen(true);
      void engine.startWorkflow(
        workflowId,
        typeof window !== 'undefined' ? window.location.pathname : null
      );
    };
    window.addEventListener(START_GUIDE_EVENT, onStartGuide as EventListener);
    return () =>
      window.removeEventListener(START_GUIDE_EVENT, onStartGuide as EventListener);
    // engine.startWorkflow is stable (useCallback).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEnabled]);

  // Render each new current step as an assistant-style message. Keyed on the
  // engine's currentIndex so we post exactly one bubble per step (incl. step 0
  // when a workflow starts). The highlight fires via activeHighlight above.
  // Seed from a rehydrated guide (after a nav remount) so we DON'T re-post the
  // restored current step - its bubble is already in the rehydrated thread.
  const lastPostedStepRef = useRef<string | null>(
    engine.isActive && engine.workflowId
      ? `${engine.workflowId}:${engine.currentIndex}`
      : null
  );
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
    // Capture the baseline at step start: what's already on screen + how many
    // actions have happened. Auto-advance only fires on a signal NEW relative
    // to this, so a step whose element is already visible does NOT instantly
    // advance (which previously cascaded straight to Finish).
    const startFacts = getFacts();
    const baseline = {
      visibleAtStart: new Set(startFacts.visibleElementIds),
      actionsAtStart: startFacts.recentActions.length,
    };
    const id = window.setInterval(() => {
      const facts = getFacts();
      if (
        engine.current &&
        isStepDone(engine.current, facts.recentActions, facts.visibleElementIds, baseline)
      ) {
        engine.next();
      }
    }, 700);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine.isActive, engine.currentIndex, engine.workflowId]);

  // Finish a guided workflow: clear the Next/Back/Reset bar (clean chat) and
  // post a warm sign-off. Called from the "Finish" button on the last step.
  const handleFinishGuide = useCallback(() => {
    pushAssistantMessage(
      "Looks like you've finished - hope that was helpful. If you need a hand with anything else, just say the word and I'll walk you through it."
    );
    engine.reset();
  }, [engine, pushAssistantMessage]);

  // Reset / re-sync position (Stage 4b): the user clicked Next too many times
  // (or is otherwise out of line). Infer their REAL step from live facts and
  // jump there if confident; if ambiguous, ask the chatbot to re-align.
  const handleResyncPosition = useCallback(() => {
    if (!engine.isActive) return;
    const facts = getFacts();
    const inferred = inferCurrentStepIndex(engine.steps, facts.visibleElementIds);
    if (inferred !== null) {
      engine.goToIndex(inferred);
    } else {
      // Can't tell from the screen - hand to the chatbot to ask the user.
      const facts = getFacts();
      void send(
        "I've lost my place in the walkthrough - I'm not sure which step I'm actually on. Ask me what I've done so far and help me get back on the right step.",
        {
          hints: { ...buildHints(), recentActions: facts.recentActions },
          mode,
          highlightsOn,
        }
      );
    }
  }, [engine, getFacts, send, buildHints, highlightsOn, mode]);

  // Hidden when the feature flag is off OR the user turned the Chat Assistant
  // off in Account settings.
  if (!ENABLED || !userEnabled) return null;

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
          title="To fully hide chat, go to Account > Notifications"
          className="assistant-launcher group fixed bottom-5 right-5 z-[60] inline-flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-2 border-slate-200 bg-white text-slate-900 transition-colors duration-200 ease-in-out hover:bg-slate-50 safe-bottom"
        >
          {/* Q's face. The orange glow/pulse + hover lift come from
              .assistant-launcher in globals.css. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/q-avatar.png"
            alt="Q"
            width={40}
            height={40}
            className="h-9 w-9 object-contain transition-transform duration-150 group-hover:scale-110"
            draggable={false}
          />
          {hasConversation && (
            <span className="absolute right-0 top-0 h-3 w-3 rounded-full border-2 border-white bg-[#ff6b35]" />
          )}
        </button>
      )}

      {open && (
        <div
          data-assistant-panel
          style={{ ...panelStyle, transformOrigin: pos ? 'center' : 'bottom right' }}
          className="group/panel fixed z-[60] flex h-[25.5rem] w-[23rem] max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl transition-transform duration-150 ease-out hover:scale-[1.02]"
        >
          {/* Header (drag handle) */}
          <div
            onPointerDown={onPointerDownHeader}
            onPointerMove={onPointerMoveHeader}
            onPointerUp={onPointerUpHeader}
            className="flex cursor-move select-none items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3"
          >
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/q-avatar.png"
                alt="Q"
                width={28}
                height={28}
                className="h-7 w-7 rounded-full object-contain"
                draggable={false}
              />
              <span className="text-sm font-semibold text-slate-800">Q</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                title="Hide chat"
                aria-label="Hide assistant"
                className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold text-slate-500 transition-all duration-200 hover:bg-slate-900 hover:text-white hover:shadow-[0_0_12px_rgba(255,107,53,0.5)]"
              >
                Hide
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
                  title={
                    m === 'respond_only'
                      ? "Ask me any question about the app and I'll respond"
                      : "I'll walk you through how to do something, just ask me what you want to learn to use"
                  }
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
                    ? 'Highlights on - the assistant points to the next control'
                    : 'Highlights off - the assistant only describes where to go'
                }
                className="ml-auto inline-flex items-center gap-2 text-xs font-medium text-slate-600"
              >
                <span>Highlights</span>
                {/* Track: grey when OFF, solid orange when ON. Colour is set via
                    inline style (not an arbitrary Tailwind class) so a purge or
                    stale CSS bundle can never mute the ON state to a default
                    blue/grey. Knob stays white and slides left->right. */}
                <span
                  className="relative inline-block h-4 w-7 rounded-full transition-colors"
                  style={{ backgroundColor: highlightsOn ? '#ff6b35' : '#cbd5e1' }}
                >
                  {/* Knob pinned with an explicit left-0.5 base (without it the
                      knob's `left:auto` drifted right, overhanging the track).
                      Track 28px - knob 12px - 2px each side => ON travels 12px
                      (translate-x-3) to sit flush right; OFF stays flush left. */}
                  <span
                    className={`absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${
                      highlightsOn ? 'translate-x-3' : 'translate-x-0'
                    }`}
                  />
                </span>
              </button>
            )}
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {!hasConversation && (
              <div className="mx-auto mt-8 max-w-[16rem] text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/q-avatar.png"
                  alt="Q"
                  width={48}
                  height={48}
                  className="mx-auto mb-3 h-12 w-12 rounded-full object-contain"
                  draggable={false}
                />
                <p className="text-sm font-semibold text-slate-700">Hey, I&rsquo;m Q.</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-400">
                  Ask me anything about QuoteCore+ - building a quote, what a
                  field does, or where to find something. I&rsquo;ll keep it short.
                </p>
              </div>
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
                    m.role === 'assistant' ? (
                      renderInlineMarkdown(m.content)
                    ) : (
                      m.content
                    )
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
              step-engine is driving a workflow. "Next step →" is INSTANT - the
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
                onClick={handleResyncPosition}
                title="Lost your place? Re-sync to the step you're actually on"
                className="shrink-0 rounded-full px-2.5 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => engine.back()}
                disabled={!engine.canGoBack}
                title="Previous step"
                className="shrink-0 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-default disabled:opacity-40"
              >
                ← Back
              </button>
              {engine.upcoming === null ? (
                <button
                  type="button"
                  onClick={handleFinishGuide}
                  title="Finish the walkthrough"
                  className="shrink-0 rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white transition-all hover:bg-emerald-700 hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
                >
                  Finish ✓
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => engine.next()}
                  className="shrink-0 rounded-full bg-[#ff6b35] px-3.5 py-1.5 text-xs font-semibold text-white transition-all hover:bg-[#e85f2e]"
                >
                  Next step →
                </button>
              )}
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
              placeholder="Ask Q…"
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
