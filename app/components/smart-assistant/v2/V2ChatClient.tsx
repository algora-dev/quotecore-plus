'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createConversation, type ConversationRow } from '@/app/(auth)/[workspaceSlug]/assistant/actions';
import { SafeMessage } from '../SafeMessage';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import type { Access, ActionView, ConversationCard, RecordTarget, SessionSnapshot } from '@/app/lib/smart-assistant/v2/contracts';
import { isUuid } from '@/app/lib/smart-assistant/v2/contracts';
import { isSafeDestination } from '@/app/lib/smart-assistant/v2/navigation';
import { isRecord } from '@/app/lib/smart-assistant/section-permissions';
import { ConversationCards } from './ConversationCards';
import { request, session } from './client';
import { useVoiceNote } from './useVoiceNote';
import s from './assistant.module.css';
type Pending = {
    requestId: string;
    message: string;
    runId?: string;
};
export type V2ChatProps = {
    access: Access;
    initialConversations: ConversationRow[];
    assistantName: string;
    greeting: string;
    settingsHref: string;
    visible?: boolean;
    onHide: () => void;
};
export function V2ChatClient({ access, initialConversations, assistantName, greeting, settingsHref, visible = true, onHide }: V2ChatProps) {
    const router = useRouter();
    const pathname = usePathname();
    const [conversations, setConversations] = useState(initialConversations);
    const [active, setActive] = useState<string | null>(initialConversations[0]?.id ?? null);
    const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null);
    const [input, setInput] = useState('');
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    const [menu, setMenu] = useState(false);
    const [mode, setMode] = useState<'voice' | 'text'>('text');
    const [unresolved, setUnresolved] = useState(false);
    const [locked, setLocked] = useState(false);
    const pending = useRef(new Map<string, Pending>());
    const current = useRef(active);
    current.current = active;
    const epoch = useRef(0);
    const mounted = useRef(true);
    const operation = useRef(false);
    const navTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const navPending = useRef<string | null>(null);
    const autoOpened = useRef(new Set<string>());
    const scroll = useRef<HTMLDivElement>(null);
    const nearBottom = useRef(true);
    const visibility = useRef(visible);
    visibility.current = visible;
    const end = useRef<HTMLDivElement>(null);
    const prefKey = `sa-input:${access.userId}:${access.companyId}`;
    const lastConversationKey = `sa-conversation:${access.userId}:${access.companyId}`;
    const voice = useVoiceNote(visible && !locked, text => { if (text)
        setInput(p => p ? `${p} ${text}` : text); }, setNotice);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; epoch.current++; if (navTimer.current)
        clearTimeout(navTimer.current); }; }, []);
    useEffect(() => { try {
        const pref = localStorage.getItem(prefKey);
        if (pref === 'voice' || pref === 'text')
            setMode(pref);
        const id = sessionStorage.getItem(lastConversationKey);
        if (isUuid(id))
            setActive(id);
    }
    catch { /* storage can be unavailable */ } }, [prefKey, lastConversationKey, initialConversations]);
    const changeMode = (next: 'voice' | 'text') => { voice.cancel(); setMode(next); try {
        localStorage.setItem(prefKey, next);
    }
    catch { /* local preference only */ } };
    const refresh = useCallback(async (id: string) => {
        const ticket = ++epoch.current;
        try {
            const next = await session(id);
            if (!mounted.current || ticket !== epoch.current || current.current !== id)
                return null;
            if (next.access.companyId !== access.companyId || next.access.userId !== access.userId) {
                setSnapshot(null);
                setLocked(true);
                setInput('');
                pending.current.clear();
                throw new Error('Your account changed. Reload this page before continuing.');
            }
            setSnapshot(next);
            setLocked(false);
            const p = pending.current.get(id);
            const outcome = p ? next.runs.find(r => r.requestId === p.requestId) : null;
            if (outcome && ['completed', 'failed', 'cancelled', 'aborted', 'timed_out'].includes(outcome.status)) {
                pending.current.delete(id);
                setUnresolved(false);
                if (outcome.status !== 'completed')
                    setNotice('The previous message did not complete. No unconfirmed change was applied. You can send a new message.');
            }
            return next;
        }
        catch (error) {
            if (mounted.current && ticket === epoch.current) {
                setSnapshot(null);
                setLocked(true);
                setNotice(error instanceof Error ? error.message : 'Could not load the conversation.');
            }
            return null;
        }
    }, [access.companyId, access.userId]);
    useEffect(() => { setSnapshot(null); setNotice(null); epoch.current++; if (active) {
        try {
            sessionStorage.setItem(lastConversationKey, active);
        }
        catch { /* optional */ }
        void refresh(active);
    } setUnresolved(!!active && pending.current.has(active)); }, [active, refresh, lastConversationKey]);
    // Reconnect only fetches state. It does not resubmit or spend a turn.
    useEffect(() => { if (!visible || !active)
        return; void refresh(active); const timer = setInterval(() => { if (!operation.current)
        void refresh(active); }, snapshot?.activeRunId ? 2000 : 15000); return () => clearInterval(timer); }, [visible, active, refresh, snapshot?.activeRunId]);
    useEffect(() => { if (nearBottom.current && visible)
        end.current?.scrollIntoView({ block: 'end', behavior: 'auto' }); }, [snapshot?.messages.length, snapshot?.cards.length, busy, visible]);
    useEffect(() => {
        if (!navPending.current)
            return;
        const target = navPending.current;
        if (pathname + window.location.search === target) {
            navPending.current = null;
            if (navTimer.current)
                clearTimeout(navTimer.current);
            setBusy(false);
            operation.current = false;
            onHide();
        }
    }, [pathname, onHide]);
    const openRecord = async (card: ConversationCard, target: RecordTarget) => {
        const conversationId = current.current;
        if (!conversationId || operation.current || locked)
            return;
        operation.current = true;
        setBusy(true);
        setNotice(null);
        voice.cancel();
        try {
            const result = await request('/api/smart-assistant/v2/navigation', { conversationId, cardId: card.id, target, companyId: access.companyId });
            if (!isSafeDestination(result.destination, access.workspaceSlug))
                throw new Error('This destination could not be verified.');
            // Mark only this requested card, never replay historical navigation on reopen.
            autoOpened.current.add(card.id);
            const destination = result.destination;
            if (window.location.pathname + window.location.search === destination) {
                operation.current = false;
                setBusy(false);
                onHide();
                return;
            }
            navPending.current = destination;
            router.push(destination);
            const startedAt = Date.now();
            const checkNavigation = () => {
                if (!mounted.current || !navPending.current)
                    return;
                // Query-only navigation (component highlight) may not change usePathname.
                if (window.location.pathname + window.location.search === destination) {
                    navPending.current = null;
                    operation.current = false;
                    setBusy(false);
                    onHide();
                }
                else if (Date.now() - startedAt >= 10000) {
                    navPending.current = null;
                    operation.current = false;
                    setBusy(false);
                    setNotice('The page has not opened yet. Try Open again. Your conversation is still here.');
                }
                else
                    navTimer.current = setTimeout(checkNavigation, 100);
            };
            navTimer.current = setTimeout(checkNavigation, 100);
        }
        catch (error) {
            operation.current = false;
            setBusy(false);
            setNotice(error instanceof Error ? error.message : 'Could not open this record.');
        }
    };
    const newChat = async () => {
        if (operation.current || unresolved)
            return;
        operation.current = true;
        setBusy(true);
        voice.cancel();
        try {
            const result = await createConversation(null);
            if (!result.ok)
                throw new Error(result.error);
            const row = { id: result.id, title: null, last_active_at: new Date().toISOString() };
            setConversations(p => [row, ...p]);
            current.current = row.id;
            setActive(row.id);
            setInput('');
            setMenu(false);
            return row.id;
        }
        catch (error) {
            setNotice(error instanceof Error ? error.message : 'Could not start a conversation.');
            return null;
        }
        finally {
            operation.current = false;
            setBusy(false);
        }
    };
    const send = async (textOverride?: string) => {
        const text = (textOverride ?? input).trim();
        if (!text || text.length > 16000 || operation.current || locked)
            return;
        if (snapshot?.activeRunId) {
            setNotice('The assistant is still working. Please wait or refresh.');
            return;
        }
        let id = active;
        if (!id) {
            id = await newChat() ?? null;
            if (!id)
                return;
        }
        const earlier = pending.current.get(id);
        if (earlier && earlier.message !== text) {
            setNotice('Resolve the previous message before sending a different one. Use Retry same message.');
            return;
        }
        const logical = earlier ?? { requestId: crypto.randomUUID(), message: text };
        pending.current.set(id, logical);
        setUnresolved(true);
        operation.current = true;
        setBusy(true);
        setNotice(null);
        voice.cancel();
        nearBottom.current = true;
        try {
            await request('/api/smart-assistant/v2/session', { conversationId: id, pathname, companyId: access.companyId });
            const res = await fetch('/api/smart-assistant/turn', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId: id, message: text, clientRequestId: logical.requestId }) });
            const result: unknown = await res.json().catch(() => null);
            if (!res.ok) {
                // Never throw away the request key on an uncertain 5xx/network result.
                if (res.status >= 400 && res.status < 500 && (!isRecord(result) || result.error_code !== 'already_running')) {
                    pending.current.delete(id);
                    setUnresolved(false);
                }
                const code = isRecord(result) ? String(result.error_code ?? '') : '';
                throw new Error(code === 'quota_exceeded' ? 'This workspace has reached its assistant limit.' : res.status === 409 ? 'A turn is already in progress or the request conflicts. Refresh before trying again.' : 'The reply could not be verified. Retry the same message rather than send a duplicate.');
            }
            if (!isRecord(result) || typeof result.run_id !== 'string')
                throw new Error('Reply status could not be verified. Retry the same message.');
            logical.runId = result.run_id;
            if (mounted.current && current.current === id)
                setInput('');
            const next = await refresh(id);
            if (result.status === 'completed') {
                pending.current.delete(id);
                setUnresolved(false);
            }
            operation.current = false;
            setBusy(false);
            // Only a newly requested run can auto-open. Historical cards remain buttons.
            const card = next?.cards.find(c => c.runId === result.run_id && c.content.kind === 'records' && c.content.autoOpen && !autoOpened.current.has(c.id));
            if (card?.content.kind === 'records' && card.content.options.length === 1 && visibility.current)
                await openRecord(card, card.content.options[0]);
        }
        catch (error) {
            if (mounted.current) {
                setNotice(error instanceof Error ? error.message : 'Connection interrupted. Retry the same message.');
                setInput(text);
            }
            await refresh(id);
        }
        finally {
            if (!navPending.current) {
                operation.current = false;
                if (mounted.current)
                    setBusy(false);
            }
        }
    };
    const act = async (action: ActionView, command: 'confirm' | 'cancel') => {
        if (operation.current || !active || locked)
            return;
        operation.current = true;
        setBusy(true);
        setNotice(null);
        try {
            await request('/api/smart-assistant/v2/actions', { actionId: action.id, command, proofDigest: action.proofDigest, version: action.version, companyId: access.companyId });
            const next = await refresh(active);
            router.refresh();
            const saved = next?.actions.find(a => a.id === action.id);
            const card = next?.cards.find(c => c.content.kind === 'proposal' && c.content.actionId === action.id);
            if (command === 'confirm' && saved?.actionKind === 'draft_create' && saved.status === 'committed' && saved.target && card && visibility.current) {
                operation.current = false;
                setBusy(false);
                await openRecord(card, saved.target);
            }
        }
        catch (error) {
            setNotice(error instanceof Error ? error.message : 'Could not verify this action. Refresh its status before trying again.');
            await refresh(active);
        }
        finally {
            if (!navPending.current) {
                operation.current = false;
                setBusy(false);
            }
        }
    };
    const canConfirm = (action: ActionView) => { const live = snapshot?.access ?? access; return live.phases.p3 && (action.actionKind !== 'draft_create' || live.phases.p4) && action.sections.every(section => live.permissions[section] === 'edit'); };
    // Owner direction: show the answer and its final click options only.
    // Intermediate lookup cards from the same run are trail noise and get hidden.
    const lastCardOnly = (cards: ConversationCard[]) => cards.length > 1 ? [cards[cards.length - 1]] : cards;
    const cardsFor = (runId: string | null) => lastCardOnly(snapshot?.cards.filter(c => c.runId === runId) ?? []);
    const replies = new Set(snapshot?.messages.filter(m => m.role === 'assistant').map(m => m.runId));
    const orphanCards = lastCardOnly(snapshot?.cards.filter(c => !replies.has(c.runId)) ?? []);
    return <div className={s.root} data-qc-ui="v2" data-clarity-mask="true" data-sa-v2="true">
    <header className={s.header}><QcButton autoFocus aria-label="Assistant menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>☰ <span className="sr-only">Menu</span></QcButton><QcButton onClick={() => { voice.cancel(); setMenu(false); onHide(); }}>Hide</QcButton></header>
    {menu && <nav className={s.menu} aria-label="Assistant menu">
      <div className={s.menuRow}>
        <QcButton size="sm" disabled={busy || unresolved} onClick={() => void newChat()}>New chat</QcButton>
        <QcButton size="sm" aria-pressed={mode === 'voice'} onClick={() => changeMode(mode === 'voice' ? 'text' : 'voice')}>{mode === 'voice' ? 'Prefer text' : 'Prefer voice'}</QcButton>
        <QcButton size="sm" onClick={() => { voice.cancel(); router.push(settingsHref); onHide(); }}>Settings</QcButton>
      </div>
      <p className={s.detail}>Recent conversations</p>
      <div className={s.convList}>
        {conversations.slice(0, 12).map(c => <QcButton key={c.id} className={s.convRow} disabled={busy || unresolved} aria-current={active === c.id ? 'page' : undefined} onClick={() => { voice.cancel(); setActive(c.id); setInput(''); setMenu(false); }}>{c.title || `Conversation ${new Date(c.last_active_at).toLocaleDateString()}`}</QcButton>)}
      </div>
    </nav>}
    <div className={s.messages} ref={scroll} onScroll={() => { const el = scroll.current; if (el)
        nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100; }} aria-label="Conversation">
      {!snapshot?.messages.length && <><h2>{assistantName}</h2><p>{greeting || 'Tell me what you need to find or change. I will ask you to review important actions.'}</p><div className={s.actions}>
        {(snapshot?.access ?? access).permissions.draft_quotes !== 'hidden' && <QcButton disabled={busy || locked} onClick={() => void send('Open my most recent draft.')}>Open my latest draft</QcButton>}
        {access.phases.p2 && <QcButton disabled={busy || locked} onClick={() => void send('What needs my attention today?')}>What needs attention?</QcButton>}
      </div>{access.historyAfter && <p className={s.detail}>Earlier messages may be withheld after an access change.</p>}</>}
      {snapshot?.messages.map(m => <div key={m.id}><div className={`${s.message} ${m.role === 'user' ? s.user : ''}`}><SafeMessage content={m.content}/></div>
        {m.role === 'assistant' && <ConversationCards canConfirm={canConfirm} cards={cardsFor(m.runId)} actions={snapshot.actions} busy={busy || locked} onOpen={(c, t) => void openRecord(c, t)} onReply={t => void send(t)} onAction={(a, c) => void act(a, c)}/>}</div>)}
      <ConversationCards canConfirm={canConfirm} cards={orphanCards} actions={snapshot?.actions ?? []} busy={busy || locked} onOpen={(c, t) => void openRecord(c, t)} onReply={t => void send(t)} onAction={(a, c) => void act(a, c)}/>
      {(busy || snapshot?.activeRunId) && <p role="status">Working. You can hide the assistant and come back.</p>}<div ref={end}/>
    </div>
    {notice && <div className={s.notice} role="alert">{notice}{active && <QcButton disabled={busy} onClick={() => void refresh(active)}>Refresh status</QcButton>}</div>}
    <div className={s.composer}>
      {voice.state !== 'off' && <p className={s.live} role="status">{voice.state === 'recording' ? 'Listening. Tap Stop when finished.' : voice.state === 'requesting' ? 'Opening microphone...' : 'Transcribing. Review before sending.'}</p>}
      {mode === 'text' ? <textarea className={s.input} aria-label="Message the assistant" value={input} disabled={busy || locked || voice.state !== 'off'} maxLength={16000} rows={2} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        void send();
    } }}/> : input && <div className={s.card}><p>{input}</p><QcButton onClick={() => changeMode('text')}>Edit transcript</QcButton><QcButton onClick={() => setInput('')}>Discard</QcButton></div>}
      <div className={s.row}><QcButton className={mode === 'voice' ? s.mic : ''} aria-pressed={voice.state === 'recording'} disabled={busy || locked || ['requesting', 'transcribing'].includes(voice.state)} onClick={() => void voice.toggle()}>{voice.state === 'recording' ? 'Stop' : 'Microphone'}</QcButton>
        <QcButton onClick={() => changeMode(mode === 'text' ? 'voice' : 'text')}>{mode === 'text' ? 'Voice' : 'Type'}</QcButton>
        {input.trim() && <QcButton variant="primary" disabled={busy || locked || voice.state !== 'off'} onClick={() => void send()}>Send</QcButton>}
        {unresolved && active && <QcButton disabled={busy || locked} onClick={() => void send(pending.current.get(active)?.message)}>Retry same message</QcButton>}
      </div>
    </div>
  </div>;
}
