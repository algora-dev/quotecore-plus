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
};

export function ChatClient({ initialConversations, assistantName, greeting, settingsHref }: Props) {
  const [conversations, setConversations] = useState(initialConversations);
  const [activeId, setActiveId] = useState<string | null>(initialConversations[0]?.id ?? null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
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
    <div data-clarity-mask="true" className="flex h-[calc(100vh-8rem)] rounded-xl border border-slate-200 bg-white overflow-hidden">
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
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-900">{assistantName}</span>
          <a href={settingsHref} className="md:hidden text-xs text-slate-500">
            Settings
          </a>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.length === 0 && !busy && (
            <div className="rounded-xl border border-dashed border-slate-200 px-6 py-12 text-center text-sm text-slate-500">
              {greeting || `Ask ${assistantName} about your quotes, pricing, customers, invoices or orders.`}
            </div>
          )}
          {messages.map((m, i) =>
            m.role === 'user' ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[80%] rounded-xl bg-slate-900 px-4 py-2 text-sm text-white whitespace-pre-wrap">
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={i} className="flex justify-start">
                <div className="max-w-[80%] rounded-xl border border-slate-200 px-4 py-2">
                  <SafeMessage content={m.content} />
                </div>
              </div>
            ),
          )}
          {busy && (
            <div className="flex justify-start">
              <div className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-400">
                {assistantName} is thinking...
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

        <div className="p-3 border-t border-slate-200 flex gap-2">
          <input
            type="text"
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
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={() => void send()}
            disabled={!activeId || busy || !input.trim()}
            className="rounded-full bg-black px-5 py-2 text-sm text-white hover:shadow-[0_0_12px_rgba(0,0,0,0.25)] disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
