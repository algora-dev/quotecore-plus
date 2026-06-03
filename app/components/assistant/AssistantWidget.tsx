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

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AssistantMode } from '@/app/lib/assistant/protocol';
import { useAssistantChat } from './useAssistantChat';
import { useAssistantHints } from './useAssistantHints';
import { useAssistantHighlight } from './useAssistantHighlight';

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

  const { messages, status, highlight, send, sendKickoff, cancel, reset } = useAssistantChat();
  const { buildHints } = useAssistantHints();
  // Phase 4: execute server-issued highlight commands on the page — gated by
  // the user's Highlights preference.
  const highlightRect = useAssistantHighlight(highlight, highlightsOn);

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
  // Guard so the guide-mode kickoff fires once per (open, screen) and never
  // mid-stream or over an existing conversation.
  const kickedOffRef = useRef<string | null>(null);

  // Auto-scroll to the latest message while streaming.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Proactive Guide-me: when the panel is open in guide mode and the
  // conversation is empty (fresh / after New), auto-start guidance for the
  // current screen. Fires once per screen; won't interrupt an existing chat
  // or an in-flight stream. Switching to Respond, or having any messages,
  // suppresses it.
  useEffect(() => {
    if (!open || mode !== 'guide_me') return;
    if (messages.length > 0 || status === 'streaming') return;
    const hints = buildHints();
    const screenKey = hints.screenKey;
    if (kickedOffRef.current === screenKey) return;
    kickedOffRef.current = screenKey;
    void sendKickoff({ hints, mode: 'guide_me' });
  }, [open, mode, messages.length, status, buildHints, sendKickoff]);

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

  const panelStyle: React.CSSProperties = pos
    ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' }
    : { right: 20, bottom: 20 };

  return (
    <>
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
