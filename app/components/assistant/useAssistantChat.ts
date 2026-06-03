'use client';

/**
 * useAssistantChat — SSE chat consumer (Phase 2)
 * ===============================================
 * Drives a conversation against POST /api/assistant/chat. Parses the SSE event
 * stream, accumulates streaming tokens into the in-flight assistant message,
 * retains history, and supports cancel/abort.
 *
 * The hook is transport-only: it knows nothing about layout. The widget renders
 * `messages` + `status`. Context hints are supplied by the caller (assembled by
 * AssistantContextProvider) so this hook stays client-agnostic.
 */

import { useCallback, useRef, useState } from 'react';
import {
  ASSISTANT_PROTOCOL_VERSION,
  type AssistantClientHints,
  type AssistantMode,
  type AssistantStreamEvent,
  type ChatMessage,
} from '@/app/lib/assistant/protocol';

export interface UiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** True while this assistant message is still streaming. */
  streaming?: boolean;
  /** Set when a turn errored. */
  error?: string;
}

export type ChatStatus = 'idle' | 'streaming' | 'error';

interface SendOptions {
  hints: Omit<AssistantClientHints, 'assistantProtocolVersion'>;
  mode: AssistantMode;
}

let msgSeq = 0;
function nextId(prefix: string) {
  msgSeq += 1;
  return `${prefix}-${Date.now()}-${msgSeq}`;
}

export function useAssistantChat() {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>('idle');
  const sessionIdRef = useRef<string | undefined>(undefined);
  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const reset = useCallback(() => {
    cancel();
    sessionIdRef.current = undefined;
    setMessages([]);
    setStatus('idle');
  }, [cancel]);

  const send = useCallback(
    async (text: string, opts: SendOptions) => {
      const trimmed = text.trim();
      if (!trimmed || status === 'streaming') return;

      const userMsg: UiMessage = { id: nextId('u'), role: 'user', content: trimmed };
      const assistantId = nextId('a');

      // History to send: prior turns + this user message, mapped to wire shape.
      const priorWire: ChatMessage[] = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const wireMessages: ChatMessage[] = [
        ...priorWire,
        { role: 'user', content: trimmed },
      ];

      setMessages((prev) => [
        ...prev,
        userMsg,
        { id: assistantId, role: 'assistant', content: '', streaming: true },
      ]);
      setStatus('streaming');

      const ac = new AbortController();
      abortRef.current = ac;

      const patchAssistant = (fn: (m: UiMessage) => UiMessage) =>
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? fn(m) : m)));

      try {
        const res = await fetch('/api/assistant/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: ac.signal,
          body: JSON.stringify({
            messages: wireMessages,
            sessionId: sessionIdRef.current,
            mode: opts.mode,
            hints: {
              ...opts.hints,
              assistantProtocolVersion: ASSISTANT_PROTOCOL_VERSION,
            },
          }),
        });

        if (!res.ok || !res.body) {
          let detail = `Request failed (${res.status}).`;
          try {
            const j = await res.json();
            if (j?.message) detail = j.message;
          } catch {
            /* non-JSON error */
          }
          patchAssistant((m) => ({ ...m, streaming: false, error: detail }));
          setStatus('error');
          return;
        }

        await consumeSse(res.body, (event) => {
          switch (event.type) {
            case 'session':
              sessionIdRef.current = event.sessionId;
              break;
            case 'token':
              patchAssistant((m) => ({ ...m, content: m.content + event.text }));
              break;
            case 'error':
              patchAssistant((m) => ({
                ...m,
                streaming: false,
                error: event.message,
              }));
              setStatus('error');
              break;
            case 'done':
              patchAssistant((m) => ({ ...m, streaming: false }));
              setStatus('idle');
              break;
            // 'tool_call' / 'highlight' handled in later phases.
            default:
              break;
          }
        });

        // Ensure the streaming flag clears even if no explicit 'done' arrived.
        patchAssistant((m) => (m.streaming ? { ...m, streaming: false } : m));
        setStatus((s) => (s === 'streaming' ? 'idle' : s));
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') {
          patchAssistant((m) => ({ ...m, streaming: false }));
          setStatus('idle');
        } else {
          patchAssistant((m) => ({
            ...m,
            streaming: false,
            error: 'Connection error.',
          }));
          setStatus('error');
        }
      } finally {
        abortRef.current = null;
      }
    },
    [messages, status]
  );

  /**
   * Proactive kickoff for Guide-me: sends a turn that asks the assistant to
   * start guiding from the user's current screen/step. It renders as a normal
   * user message (clear + honest about what happened) and reuses `send` so all
   * streaming/abort logic is shared.
   */
  const sendKickoff = useCallback(
    (opts: SendOptions) =>
      send('Guide me from where I am on this screen.', opts),
    [send]
  );

  return { messages, status, send, sendKickoff, cancel, reset };
}

/**
 * Parse an SSE byte stream into AssistantStreamEvent objects. Handles partial
 * frames across chunk boundaries (frames are separated by a blank line).
 */
async function consumeSse(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: AssistantStreamEvent) => void
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sep: number;
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      for (const line of frame.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const json = trimmed.slice(5).trim();
        if (!json) continue;
        try {
          onEvent(JSON.parse(json) as AssistantStreamEvent);
        } catch {
          /* ignore malformed frame */
        }
      }
    }
  }
}
