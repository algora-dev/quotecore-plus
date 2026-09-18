'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { SafeMessage } from '@/app/components/smart-assistant/SafeMessage';
import { createConversation, type ConversationRow } from './actions';

type Message = { role: 'user' | 'assistant' | 'tool'; content: string };

type Props = {
  initialConversations: ConversationRow[];
  assistantName: string;
  greeting: string;
  settingsHref: string;
  /** Render inside the launcher panel instead of a standalone page. */
  embedded?: boolean;
};

export function ChatClient({ initialConversations, assistantName, greeting, settingsHref, embedded }: Props) {
  const [conversations, setConversations] = useState(initialConversations);
  const [activeId, setActiveId] = useState<string | null>(initialConversations[0]?.id ?? null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Voice input: push-to-talk recording -> server-side OpenAI transcription
  // (consistent quality across devices; the browser speech engine varied).
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  // Pending logical send per conversation: id + exact text. Retained across
  // unknown outcomes (network/5xx) so a retry replays idempotently; cleared
  // on deterministic refusals.
  const pendingRef = useRef<Map<string, { requestId: string; message: string }>>(new Map());
  const stateVersionRef = useRef(0);

  // Clarity: DOM mask is the privacy control; the tag is analytics only.
  useEffect(() => {
    const w = window as unknown as { clarity?: (...args: unknown[]) => void };
    w.clarity?.('set', 'smart_assistant', 'chat');
    w.clarity?.('event', 'smart_assistant_chat_open');
  }, []);

  const loadState = useCallback(async (conversationId: string) => {
    const version = ++stateVersionRef.current;
    const res = await fetch(`/api/smart-assistant/state?conversationId=${conversationId}`);
    if (!res.ok) {
      if (version === stateVersionRef.current) setMessages([]);
      return;
    }
    const data = (await res.json()) as { messages: Message[]; run_status: string | null };
    // Late responses from a previously-selected conversation never overwrite
    // the currently visible thread.
    if (version !== stateVersionRef.current) return;
    setMessages(
      (data.messages ?? []).filter((m) => m.role === 'user' || m.role === 'assistant'),
    );
  }, []);

  useEffect(() => {
    if (activeId) void loadState(activeId);
  }, [activeId, loadState]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  async function newChat() {
    const result = await createConversation(null);
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    const row: ConversationRow = { id: result.id, title: null, last_active_at: new Date().toISOString() };
    setConversations((prev) => [row, ...prev]);
    setActiveId(result.id);
    setMessages([]);
  }

  const toggleMic = async () => {
    if (transcribing) return;
    if (listening) {
      mediaRecorderRef.current?.stop();
      return;
    }
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices) {
      setNotice('Voice input is not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : undefined;
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      // Hard cap: stop automatically after 2 minutes.
      const cap = setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop();
      }, 120_000);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        clearTimeout(cap);
        stream.getTracks().forEach((t) => t.stop());
        setListening(false);
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size === 0) return;
        if (blob.size > 14 * 1024 * 1024) {
          setNotice('Recording too long.');
          return;
        }
        setTranscribing(true);
        setNotice(null);
        try {
          const fd = new FormData();
          fd.append('audio', blob, 'voice.webm');
          const res = await fetch('/api/smart-assistant/transcribe', { method: 'POST', body: fd });
          const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
          if (!res.ok) {
            setNotice(data.error ?? 'Transcription failed.');
            return;
          }
          const text = (data.text ?? '').trim();
          if (text) setInput((prev) => (prev ? `${prev} ${text}` : text));
        } catch {
          setNotice('Network error during transcription.');
        } finally {
          setTranscribing(false);
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setListening(true);
      setNotice(null);
    } catch {
      setNotice('Microphone permission was denied.');
    }
  };

  async function send() {
    const text = input.trim();
    if (!text || busy || !activeId) return;
    const pending = pendingRef.current.get(activeId);
    if (pending && pending.message !== text) {
      setNotice('Finish or retry your pending message first.');
      return;
    }
    // One logical send = one request id, retained across unknown outcomes.
    const requestId = pending?.requestId ?? crypto.randomUUID();
    if (!pending) pendingRef.current.set(activeId, { requestId, message: text });
    setInput('');
    setNotice(null);
    setBusy(true);
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    try {
      const res = await fetch('/api/smart-assistant/turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: activeId,
          message: text,
          clientRequestId: requestId,
        }),
      });
      if (res.status === 409) {
        const body = (await res.json().catch(() => ({}))) as { error_code?: string };
        if (body.error_code === 'request_id_conflict') {
          pendingRef.current.delete(activeId);
          setNotice('Request conflict - please send your message again.');
          setMessages((prev) => prev.slice(0, -1));
          setInput(text);
        } else {
          setNotice('The assistant is still working on your last message.');
          setMessages((prev) => prev.slice(0, -1));
          setInput(text);
        }
        return;
      }
      if (res.status === 429) {
        pendingRef.current.delete(activeId);
        setNotice('Monthly assistant limit reached for this workspace.');
        return;
      }
      if (res.status >= 400 && res.status < 500) {
        pendingRef.current.delete(activeId);
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setNotice(body.error ?? `Request failed (${res.status}).`);
        return;
      }
      if (!res.ok) {
        // Unknown outcome: keep the pending key so a retry replays idempotently.
        setMessages((prev) => prev.slice(0, -1));
        setInput(text);
        setNotice('The reply did not complete - press Send again to retry safely.');
        return;
      }
      pendingRef.current.delete(activeId);
      await loadState(activeId);
      setConversations((prev) =>
        prev.map((c) => (c.id === activeId && !c.title ? { ...c, title: text.slice(0, 60) } : c)),
      );
    } catch {
      setMessages((prev) => prev.slice(0, -1));
      setInput(text);
      setNotice('Network error - press Send again to retry safely.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-clarity-mask="true" className={embedded ? 'flex h-full w-full bg-white overflow-hidden' : 'flex h-[calc(100vh-8rem)] rounded-xl border border-slate-200 bg-white overflow-hidden'}>
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-slate-200">
        <div className="p-3">
          <button
            onClick={newChat}
            className="w-full rounded-full bg-black px-4 py-2 text-sm text-white hover:shadow-[0_0_12px_rgba(0,0,0,0.25)]"
          >
            New chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveId(c.id)}
              className={`w-full text-left rounded-lg px-3 py-2 text-sm truncate ${
                c.id === activeId ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {c.title ?? 'New conversation'}
            </button>
          ))}
        </div>
        <div className="p-3 border-t border-slate-200">
          <a href={settingsHref} className="text-xs text-slate-500 hover:text-slate-900">
            Assistant settings
          </a>
        </div>
      </aside>

      {/* Thread */}
      <div className="flex-1 flex flex-col min-w-0">
        {!embedded && (
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-900">{assistantName}</span>
            <a href={settingsHref} className="md:hidden text-xs text-slate-500">
              Settings
            </a>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.length === 0 && !busy && (
            <div className="py-6">
              <div className="mx-auto max-w-xs rounded-2xl border border-slate-200 bg-white px-4 py-5 text-center shadow-sm">
                <div className="flex items-center justify-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FF6B35]/15">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF6B35" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                  </span>
                  <p className="text-sm font-bold text-slate-900">Ask {assistantName}</p>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  {greeting || `Ask about your quotes, pricing, customers, invoices or orders.`}
                </p>
              </div>
              <div className="mt-3 space-y-1.5">
                {['What quotes do I have?', 'How much is my corrugate per m2?', 'Any unread messages?'].map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => setInput(prompt)}
                    disabled={!activeId}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-xs text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <span>{prompt}</span>
                    <span className="shrink-0 text-slate-400">→</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) =>
            m.role === 'user' ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-md bg-slate-900 px-3.5 py-2.5 text-sm leading-relaxed text-white whitespace-pre-wrap">
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={i} className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-sm leading-relaxed text-slate-800 shadow-sm">
                  <SafeMessage content={m.content} />
                </div>
              </div>
            ),
          )}
          {busy && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-sm">
                <span className="inline-flex items-center gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:120ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:240ms]" />
                </span>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {notice && (
          <div className="mx-4 mb-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            {notice}
          </div>
        )}

        <div className="border-t border-slate-200 bg-white p-3">
          <div className="flex items-end gap-2 rounded-2xl border border-slate-300 p-1.5 focus-within:border-orange-500">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder={activeId ? `Message ${assistantName}...` : 'Start a new chat first'}
            disabled={!activeId || busy}
            maxLength={16000}
            rows={1}
            aria-label={`Message ${assistantName}`}
            className="max-h-28 min-h-[42px] flex-1 resize-none border-0 bg-transparent px-2.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => void toggleMic()}
            disabled={transcribing}
            aria-label={listening ? 'Stop recording' : transcribing ? 'Transcribing' : 'Start voice input'}
            title={listening ? 'Tap to stop and transcribe' : transcribing ? 'Transcribing...' : 'Voice input'}
            className={`flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl transition-colors ${listening ? 'animate-pulse bg-[#FF6B35] text-white' : transcribing ? 'bg-slate-100 text-slate-400' : 'text-slate-400 hover:bg-slate-100'}`}
          >
            {transcribing ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4m0 12v4M2 12h4m12 0h4" /><circle cx="12" cy="12" r="4" /></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0014 0M12 17v4" /></svg>
            )}
          </button>
          <button
            onClick={() => void send()}
            disabled={!activeId || busy || !input.trim()}
            aria-label="Send message"
            className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl bg-black text-white transition hover:opacity-90 disabled:opacity-40"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
          </button>
          </div>
        </div>
      </div>
    </div>
  );
}
