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
  const [highlightsOn, setHighlightsOn] = useState(true);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ dx: number; dy: number; moved: boolean } | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const { messages, status, highlight, send, cancel, reset } = useAssistantChat();
  const { buildHints } = useAssistantHints();

  // Execute server-issued highlight commands on the page, gated by preference.
  const highlightRect = useAssistantHighlight(highlight, highlightsOn);

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
      void send(text, { hints: buildHints(), mode });
    },
    [input, status, send, buildHints, mode]
  );

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
                onClick={reset}
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
                  {m.content || (m.streaming ? '…' : '')}
                  {m.error && (
                    <span className="mt-1 block text-xs text-red-500">{m.error}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

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
