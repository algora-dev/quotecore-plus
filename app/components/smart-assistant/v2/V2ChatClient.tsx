'use client';
import { notifyComponentFocus } from '@/app/lib/smart-assistant/v2/component-focus';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createConversation, type ConversationRow } from '@/app/(auth)/[workspaceSlug]/assistant/actions';
import { displayTaskMessage } from '@/app/lib/smart-assistant/tasks/wire';
import { failedTurns, staleTaskCard } from '@/app/lib/smart-assistant/tasks/presentation';
import { displayResolutionMessage } from '@/app/lib/smart-assistant/resolver/wire';
import { SafeMessage } from '../SafeMessage';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import type { Access, ActionView, ConversationCard, RecordTarget, SessionSnapshot } from '@/app/lib/smart-assistant/v2/contracts';
import { isUuid } from '@/app/lib/smart-assistant/v2/contracts';
import { isSafeDestination } from '@/app/lib/smart-assistant/v2/navigation';
import { isRecord } from '@/app/lib/smart-assistant/section-permissions';
import { ConversationCards } from './ConversationCards';
import { request, session } from './client';
import { useVoiceNote } from './useVoiceNote';
import { useSpeechPlayback } from './useSpeechPlayback';
import s from './assistant.module.css';

type Pending = {
  requestId: string;
  message: string;
  runId?: string;
};

type LocalAttachment = {
  id: string;
  file: File;
  previewUrl: string | null;
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

const MAX_INPUT = 16000;

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
  const [attachOpen, setAttachOpen] = useState(false);
  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);
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
  const composer = useRef<HTMLTextAreaElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  const prefKey = `sa-input:${access.userId}:${access.companyId}`;
  const lastConversationKey = `sa-conversation:${access.userId}:${access.companyId}`;
  const speechPrefKey = `sa-speech:${access.userId}:${access.companyId}`;

  const voice = useVoiceNote(visible && !locked, text => {
    if (text) setInput(p => p ? `${p} ${text}` : text);
    setMode('voice');
  }, setNotice);
  const speech = useSpeechPlayback(visible, speechPrefKey);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      epoch.current++;
      if (navTimer.current) clearTimeout(navTimer.current);
      attachments.forEach(item => { if (item.previewUrl) URL.revokeObjectURL(item.previewUrl); });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    try {
      const pref = localStorage.getItem(prefKey);
      if (pref === 'voice' || pref === 'text') setMode(pref);
      const id = sessionStorage.getItem(lastConversationKey);
      if (isUuid(id)) setActive(id);
    } catch {
      /* storage can be unavailable */
    }
  }, [prefKey, lastConversationKey, initialConversations]);

  useEffect(() => {
    if (voice.state === 'recording') speech.stop();
  }, [voice.state, speech]);

  const quickTaskLabel = snapshot?.task?.status && snapshot.task.status !== 'closed' ? snapshot.task.label : null;

  const assistantMessages = useMemo(() => snapshot?.messages.filter(m => m.role === 'assistant') ?? [], [snapshot?.messages]);
  useEffect(() => {
    const latest = assistantMessages.at(-1);
    if (!latest || voice.state !== 'off') return;
    const content = displayTaskMessage(displayResolutionMessage(latest.content)).trim();
    if (content) speech.speak(latest.id, content);
  }, [assistantMessages, speech, voice.state]);

  const clearAttachments = useCallback(() => {
    setAttachments(prev => {
      prev.forEach(item => { if (item.previewUrl) URL.revokeObjectURL(item.previewUrl); });
      return [];
    });
  }, []);

  const changeMode = (next: 'voice' | 'text') => {
    voice.cancel();
    setMode(next);
    setAttachOpen(false);
    try { localStorage.setItem(prefKey, next); } catch { /* local preference only */ }
  };

  const attachmentSummary = (items: LocalAttachment[]) => items.map(item => {
    const size = item.file.size > 1024 * 1024
      ? `${(item.file.size / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.max(1, Math.round(item.file.size / 1024))} KB`;
    const kind = item.file.type.startsWith('image/') ? 'image' : item.file.type || 'file';
    return `- ${item.file.name} (${kind}, ${size})`;
  }).join('\n');

  const enrichTurnMessage = (text: string) => attachments.length > 0
    ? `${text.trim()}\n\n[Selected attachments]\n${attachmentSummary(attachments)}\n\nIf the file contents are not available to inspect directly yet, tell me what extra context you need rather than guessing.`
    : text.trim();

  const onFilesSelected = (files: FileList | null) => {
    if (!files?.length) return;
    const next: LocalAttachment[] = [];
    for (const file of Array.from(files).slice(0, 5)) {
      const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
      next.push({ id: crypto.randomUUID(), file, previewUrl });
    }
    setAttachments(prev => {
      const all = [...prev, ...next].slice(0, 5);
      if (all.length < prev.length + next.length) {
        next.slice(Math.max(0, 5 - prev.length)).forEach(item => { if (item.previewUrl) URL.revokeObjectURL(item.previewUrl); });
      }
      return all;
    });
    setAttachOpen(true);
    setNotice('Attachment added. Tell Smart Assistant what you want done with it. Multimodal file reading can be wired to the backend next.');
  };

  const refresh = useCallback(async (id: string) => {
    const ticket = ++epoch.current;
    try {
      const next = await session(id);
      if (!mounted.current || ticket !== epoch.current || current.current !== id) return null;
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
        setNotice(null);
        setInput(value => value.trim() === p?.message.trim() ? '' : value);
      }
      return next;
    } catch (error) {
      if (mounted.current && ticket === epoch.current) {
        setSnapshot(null);
        setLocked(true);
        setNotice(error instanceof Error ? error.message : 'Could not load the conversation.');
      }
      return null;
    }
  }, [access.companyId, access.userId]);

  useEffect(() => {
    setSnapshot(null);
    setNotice(null);
    epoch.current++;
    if (active) {
      try { sessionStorage.setItem(lastConversationKey, active); } catch { /* optional */ }
      void refresh(active);
    }
    setUnresolved(!!active && pending.current.has(active));
  }, [active, refresh, lastConversationKey]);

  useEffect(() => {
    if (!visible || !active) return;
    void refresh(active);
    const timer = setInterval(() => { if (!operation.current) void refresh(active); }, snapshot?.activeRunId ? 2000 : 15000);
    return () => clearInterval(timer);
  }, [visible, active, refresh, snapshot?.activeRunId]);

  useEffect(() => {
    if (nearBottom.current && visible) end.current?.scrollIntoView({ block: 'end', behavior: 'auto' });
  }, [snapshot?.messages.length, snapshot?.cards.length, busy, visible]);

  useEffect(() => {
    if (!navPending.current) return;
    const target = navPending.current;
    if (pathname + window.location.search === target) {
      notifyComponentFocus();
      navPending.current = null;
      if (navTimer.current) clearTimeout(navTimer.current);
      setBusy(false);
      operation.current = false;
      onHide();
    }
  }, [pathname, onHide]);

  const openRecord = async (card: ConversationCard, target: RecordTarget) => {
    const conversationId = current.current;
    if (!conversationId || operation.current || locked) return;
    operation.current = true;
    setBusy(true);
    setNotice(null);
    voice.cancel();
    speech.stop();
    try {
      const result = await request('/api/smart-assistant/v2/navigation', { conversationId, cardId: card.id, target, companyId: access.companyId });
      if (!isSafeDestination(result.destination, access.workspaceSlug)) throw new Error('This destination could not be verified.');
      autoOpened.current.add(card.id);
      const destination = result.destination;
      if (window.location.pathname + window.location.search === destination) {
        notifyComponentFocus();
        operation.current = false;
        setBusy(false);
        onHide();
        return;
      }
      navPending.current = destination;
      router.push(destination);
      const startedAt = Date.now();
      const checkNavigation = () => {
        if (!mounted.current || !navPending.current) return;
        if (window.location.pathname + window.location.search === destination) {
          notifyComponentFocus();
          navPending.current = null;
          operation.current = false;
          setBusy(false);
          onHide();
        } else if (Date.now() - startedAt >= 10000) {
          navPending.current = null;
          operation.current = false;
          setBusy(false);
          setNotice('The page has not opened yet. Try Open again. Your conversation is still here.');
        } else navTimer.current = setTimeout(checkNavigation, 100);
      };
      navTimer.current = setTimeout(checkNavigation, 100);
    } catch (error) {
      operation.current = false;
      setBusy(false);
      setNotice(error instanceof Error ? error.message : 'Could not open this record.');
    }
  };

  const newChat = async () => {
    if (operation.current || unresolved) return;
    operation.current = true;
    setBusy(true);
    voice.cancel();
    speech.stop();
    try {
      const result = await createConversation(null);
      if (!result.ok) throw new Error(result.error);
      const row = { id: result.id, title: null, last_active_at: new Date().toISOString() };
      setConversations(p => [row, ...p]);
      current.current = row.id;
      setActive(row.id);
      setInput('');
      clearAttachments();
      setMenu(false);
      return row.id;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not start a conversation.');
      return null;
    } finally {
      operation.current = false;
      setBusy(false);
    }
  };

  const send = async (textOverride?: string) => {
    const rawText = (textOverride ?? input).trim();
    if ((!rawText && attachments.length === 0) || rawText.length > MAX_INPUT || operation.current || locked) return;
    if (!rawText && attachments.length > 0) {
      setNotice('Add a short note telling Smart Assistant what you want done with this attachment.');
      return;
    }
    if (snapshot?.activeRunId) {
      setNotice('The assistant is still working. Please wait or refresh.');
      return;
    }
    const text = enrichTurnMessage(rawText);
    let id = active;
    if (!id) {
      id = await newChat() ?? null;
      if (!id) return;
    }
    const earlier = pending.current.get(id);
    if (earlier && earlier.message !== text) {
      setNotice('The previous request\'s outcome is still unconfirmed. Use Check request before sending another.');
      return;
    }
    const logical = earlier ?? { requestId: crypto.randomUUID(), message: text };
    pending.current.set(id, logical);
    setUnresolved(true);
    operation.current = true;
    setBusy(true);
    setNotice(null);
    voice.cancel();
    speech.stop();
    nearBottom.current = true;
    try {
      const res = await fetch('/api/smart-assistant/turn', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: id, message: text, clientRequestId: logical.requestId, pageContext: { companyId: access.companyId, pathname } }),
      });
      const result: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        if (res.status >= 400 && res.status < 500 && (!isRecord(result) || result.error_code !== 'already_running')) {
          pending.current.delete(id);
          setUnresolved(false);
        }
        const code = isRecord(result) ? String(result.error_code ?? '') : '';
        const serverMessage = isRecord(result) && typeof result.error === 'string' ? result.error : '';
        throw new Error(code === 'quota_exceeded'
          ? 'This workspace has reached its assistant limit.'
          : code === 'migration_required'
            ? (serverMessage || 'Smart Assistant setup is incomplete on this deployment. Ask an administrator to finish setup.')
            : ['access_changed', 'permissions_changed', 'workspace_changed'].includes(code)
              ? (serverMessage || 'Your Smart Assistant access changed. Reopen the assistant.')
              : res.status === 409
                ? 'A turn is already in progress or the request conflicts. Refresh before trying again.'
                : 'The reply could not be verified. Retry the same message rather than send a duplicate.');
      }
      if (!isRecord(result) || typeof result.run_id !== 'string') throw new Error('Reply status could not be verified. Retry the same message.');
      logical.runId = result.run_id;
      if (mounted.current && current.current === id) {
        setInput('');
        clearAttachments();
        setAttachOpen(false);
      }
      const next = await refresh(id);
      if (result.status === 'completed') {
        pending.current.delete(id);
        setUnresolved(false);
      }
      operation.current = false;
      setBusy(false);
      const card = next?.cards.find(c => c.runId === result.run_id && c.content.kind === 'records' && c.content.autoOpen && !autoOpened.current.has(c.id));
      if (card?.content.kind === 'records' && card.content.options.length === 1 && visibility.current) await openRecord(card, card.content.options[0]);
    } catch (error) {
      const next = await refresh(id);
      if (mounted.current && current.current === id && next) {
        const outcome = next.runs.find(r => r.requestId === logical.requestId);
        if (outcome || pending.current.has(id)) setNotice(null);
        else setNotice(error instanceof Error ? error.message : 'The request could not be submitted.');
      }
    } finally {
      if (!navPending.current) {
        operation.current = false;
        if (mounted.current) setBusy(false);
      }
    }
  };

  const act = async (action: ActionView, command: 'confirm' | 'cancel') => {
    if (operation.current || !active || locked) return;
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
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not verify this action. Refresh its status before trying again.');
      await refresh(active);
    } finally {
      if (!navPending.current) {
        operation.current = false;
        setBusy(false);
      }
    }
  };

  const finishTask = async (command: 'done' | 'move_on') => {
    const task = snapshot?.task;
    if (!active || !task || task.status === 'closed' || operation.current || unresolved || snapshot?.activeRunId || locked) return;
    operation.current = true;
    setBusy(true);
    setNotice(null);
    try {
      await request('/api/smart-assistant/v2/task', { companyId: access.companyId, conversationId: active, taskId: task.id, version: task.version, command });
      await refresh(active);
    } catch (error) {
      const next = await refresh(active);
      if (next?.task?.id === task.id && next.task.status === 'closed') setNotice(null);
      else setNotice(error instanceof Error ? error.message : 'Task status could not be verified.');
    } finally {
      operation.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const refineAnswer = () => {
    changeMode('text');
    setInput(value => value || 'Not quite. ');
    requestAnimationFrame(() => composer.current?.focus());
  };

  const failures = failedTurns(snapshot?.messages ?? [], snapshot?.runs ?? []);
  const failureByMessage = new Map(failures.map(f => [f.messageId, f]));
  const latestUser = snapshot?.messages.filter(m => m.role === 'user').at(-1)?.id;
  const staleChoice = (card: ConversationCard) => staleTaskCard(card, snapshot?.task);
  const canConfirm = (action: ActionView) => {
    const live = snapshot?.access ?? access;
    return live.phases.p3 && (action.actionKind !== 'draft_create' || live.phases.p4) && action.sections.every(section => live.permissions[section] === 'edit');
  };
  const lastCardOnly = (cards: ConversationCard[]) => cards.length > 1 ? [cards[cards.length - 1]] : cards;
  const cardsFor = (runId: string | null) => lastCardOnly(snapshot?.cards.filter(c => c.runId === runId) ?? []);
  const replies = new Set(snapshot?.messages.filter(m => m.role === 'assistant').map(m => m.runId));
  const orphanCards = lastCardOnly(snapshot?.cards.filter(c => !replies.has(c.runId)) ?? []);

  const busyText = voice.state === 'requesting'
    ? 'Opening microphone…'
    : voice.state === 'transcribing'
      ? 'Transcribing your voice note…'
      : busy || snapshot?.activeRunId
        ? 'Smart Assistant is working. You can hide it and come back.'
        : null;

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(item => {
      if (item.id === id && item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return item.id !== id;
    }));
  };

  return <div className={s.root} data-qc-ui="v2" data-clarity-mask="true" data-sa-v2="true">
    <header className={s.header}>
      <div className={s.headerLead}>
        <QcButton autoFocus aria-label="Assistant menu" aria-expanded={menu} className={`${s.iconButton} ${s.brandButton}`} onClick={() => setMenu(!menu)}>
          <img src="/smart-assistant/q-logo-square.png" alt="" className={s.brandMark} />
          <span className="sr-only">Menu</span>
        </QcButton>
        <div className={s.headerCopy}>
          <p className={s.kicker}>{assistantName}</p>
          <p className={s.headerTitle}>{quickTaskLabel || 'Ready for your next task'}</p>
        </div>
      </div>
      <div className={s.headerActions}>
        <QcButton
          aria-label={speech.enabled ? 'Turn spoken replies off' : 'Turn spoken replies on'}
          aria-pressed={speech.enabled}
          disabled={speech.state === 'unavailable'}
          className={s.iconButton}
          onClick={() => speech.toggleEnabled()}>
          <span aria-hidden>{speech.enabled ? '🔊' : '🔈'}</span>
        </QcButton>
        <QcButton className={s.hideButton} onClick={() => { voice.cancel(); setMenu(false); onHide(); }}>Hide</QcButton>
      </div>
    </header>

    {menu && <nav className={s.menu} aria-label="Assistant menu">
      <div className={s.menuRow}>
        <QcButton size="sm" disabled={busy || unresolved} onClick={() => void newChat()}>New chat</QcButton>
        <QcButton size="sm" onClick={() => { voice.cancel(); router.push(settingsHref); onHide(); }}>Settings</QcButton>
      </div>
      <p className={s.detail}>Recent conversations</p>
      <div className={s.convList}>
        {conversations.slice(0, 12).map(c => <QcButton key={c.id} className={s.convRow} disabled={busy || unresolved} aria-current={active === c.id ? 'page' : undefined} onClick={() => { voice.cancel(); setActive(c.id); setInput(''); setMenu(false); }}>{c.title || `Conversation ${new Date(c.last_active_at).toLocaleDateString()}`}</QcButton>)}
      </div>
    </nav>}

    <div className={s.messages} ref={scroll} onScroll={() => {
      const el = scroll.current;
      if (el) nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    }} aria-label="Conversation">
      {snapshot?.task && snapshot.task.status !== 'closed' && <div className={s.taskStrip} data-sa-task={snapshot.task.id}>
        <div>
          <span className={s.taskEyebrow}>Current task</span>
          <strong>{snapshot.task.label}</strong>
        </div>
        <div className={s.taskStripActions}>
          <QcButton size="sm" disabled={busy || locked || unresolved || !!snapshot.activeRunId} onClick={() => void finishTask(snapshot.task?.status === 'answered' ? 'done' : 'move_on')}>
            {snapshot.task.status === 'answered' ? 'Done' : 'Move on'}
          </QcButton>
          {snapshot.task.status === 'answered' && <QcButton size="sm" disabled={busy || locked || unresolved || !!snapshot.activeRunId} onClick={refineAnswer}>Not quite</QcButton>}
        </div>
      </div>}

      {!snapshot?.messages.length && <section className={s.hero}>
        <div className={s.heroBadge}>QuoteCore+ Ferrari mode</div>
        <h2>{assistantName}</h2>
        <p>{greeting || 'Tell me what you need to find, open or change. I will keep the task clear, suggest likely matches and ask you to review important actions.'}</p>
        <div className={s.quickActions}>
          {(snapshot?.access ?? access).permissions.draft_quotes !== 'hidden' && <QcButton variant="glass" disabled={busy || locked} onClick={() => void send('Open my most recent draft.')}>Open my latest draft</QcButton>}
          {access.phases.p2 && <QcButton variant="glass" disabled={busy || locked} onClick={() => void send('What needs my attention today?')}>What needs attention?</QcButton>}
          <QcButton variant="glass" disabled={busy || locked} onClick={() => changeMode('voice')}>Talk to Smart Assistant</QcButton>
        </div>
        {access.historyAfter && <p className={s.detail}>Earlier messages may be withheld after an access change.</p>}
      </section>}

      {snapshot?.messages.map(m => <div key={m.id} className={s.turn}>
        <div className={`${s.message} ${m.role === 'user' ? s.user : s.assistant}`}>
          {m.role === 'assistant' && <span className={s.messageLabel}>Smart Assistant</span>}
          {m.role === 'user' && <span className={s.messageLabel}>You</span>}
          <SafeMessage content={displayTaskMessage(displayResolutionMessage(m.content))} />
        </div>
        {failureByMessage.has(m.id) && <div className={s.noticeCard} role="status" data-sa-failed-run={m.runId ?? undefined}>
          <p>{failureByMessage.get(m.id)!.copy} Review any proposal card separately; task controls never approve changes.</p>
          {m.id === latestUser && failureByMessage.get(m.id)!.canRetry && <QcButton disabled={busy || locked || unresolved || !!snapshot?.activeRunId} onClick={() => void send(failureByMessage.get(m.id)!.retryText)}>Retry request</QcButton>}
        </div>}
        {m.role === 'assistant' && <ConversationCards isStale={staleChoice} canConfirm={canConfirm} cards={cardsFor(m.runId)} actions={snapshot.actions} busy={busy || locked} onOpen={(c, t) => void openRecord(c, t)} onReply={t => void send(t)} onAction={(a, c) => void act(a, c)} />}
      </div>)}

      <ConversationCards isStale={staleChoice} canConfirm={canConfirm} cards={orphanCards} actions={snapshot?.actions ?? []} busy={busy || locked} onOpen={(c, t) => void openRecord(c, t)} onReply={t => void send(t)} onAction={(a, c) => void act(a, c)} />

      {snapshot?.task && snapshot.task.status === 'closed' && <div className={s.taskClosed}><p>Task complete. Your next request starts fresh. History stays here.</p></div>}

      {unresolved && !busy && !snapshot?.activeRunId && active && <div className={s.noticeCard} role="status">
        <p>The last request&apos;s outcome is not confirmed yet.</p>
        <QcButton disabled={locked} onClick={() => void send(pending.current.get(active)?.message)}>Check request</QcButton>
      </div>}

      {busyText && <p className={s.processHint} role="status">{busyText}</p>}
      <div ref={end} />
    </div>

    {notice && <div className={s.notice} role="alert">{notice}{locked && active && <QcButton size="sm" disabled={busy} onClick={() => void refresh(active)}>Refresh status</QcButton>}</div>}

    <div className={s.composer}>
      {speech.enabled && (speech.state === 'speaking' || speech.state === 'paused') && <div className={s.audioBar} role="status">
        <span>{speech.state === 'speaking' ? 'Speaking response' : 'Speech paused'}</span>
        <div className={s.audioActions}>
          <QcButton size="sm" onClick={() => speech.pauseOrResume()}>{speech.state === 'speaking' ? 'Pause' : 'Resume'}</QcButton>
          <QcButton size="sm" onClick={() => speech.stop()}>Stop voice</QcButton>
        </div>
      </div>}

      {attachments.length > 0 && <div className={s.attachments}>
        <div className={s.attachmentHeader}>
          <strong>Attachments</strong>
          <span className={s.detail}>Add a note or voice instruction so Smart Assistant knows what you want done.</span>
        </div>
        <div className={s.attachmentList}>
          {attachments.map(item => <div key={item.id} className={s.attachmentItem}>
            {item.previewUrl ? <img src={item.previewUrl} alt="" className={s.attachmentPreview} /> : <div className={s.attachmentFallback}>FILE</div>}
            <div className={s.attachmentMeta}>
              <strong>{item.file.name}</strong>
              <span>{item.file.type.startsWith('image/') ? 'Image' : 'File'} · {item.file.size > 1024 * 1024 ? `${(item.file.size / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(item.file.size / 1024))} KB`}</span>
            </div>
            <QcButton size="sm" className={s.attachmentRemove} onClick={() => removeAttachment(item.id)}>Remove</QcButton>
          </div>)}
        </div>
      </div>}

      {attachOpen && <div className={s.attachTray}>
        <QcButton variant="glass" className={s.attachAction} onClick={() => cameraInput.current?.click()}>Take photo</QcButton>
        <QcButton variant="glass" className={s.attachAction} onClick={() => uploadInput.current?.click()}>Choose image</QcButton>
        <QcButton variant="glass" className={s.attachAction} onClick={() => uploadInput.current?.click()}>Upload file</QcButton>
      </div>}
      <input ref={cameraInput} className={s.hiddenInput} type="file" accept="image/*" capture="environment" onChange={e => { onFilesSelected(e.target.files); e.currentTarget.value = ''; }} />
      <input ref={uploadInput} className={s.hiddenInput} type="file" accept="image/*,.pdf,.doc,.docx,.txt,.csv" multiple onChange={e => { onFilesSelected(e.target.files); e.currentTarget.value = ''; }} />

      <div className={s.modeTabs} role="tablist" aria-label="Assistant input method">
        <button type="button" role="tab" aria-selected={mode === 'text'} className={`${s.modeTab} ${mode === 'text' ? s.modeTabActive : ''}`} onClick={() => changeMode('text')}>
          <span className={s.modeGlyph}>ABC</span>
          <span>Type</span>
        </button>
        <button type="button" role="tab" aria-selected={mode === 'voice'} className={`${s.modeTab} ${mode === 'voice' ? s.modeTabActive : ''}`} onClick={() => changeMode('voice')}>
          <span className={s.modeGlyph}>🎙</span>
          <span>Voice</span>
        </button>
        <button type="button" role="tab" aria-selected={attachOpen} className={`${s.modeTab} ${attachOpen ? s.modeTabActive : ''}`} onClick={() => setAttachOpen(v => !v)}>
          <span className={s.modeGlyph}>＋</span>
          <span>Attach</span>
        </button>
      </div>

      {mode === 'text' ? <div className={s.textDock}>
        <textarea ref={composer} className={s.input} aria-label="Message the assistant" value={input} disabled={busy || locked || voice.state !== 'off'} maxLength={MAX_INPUT} rows={3} placeholder={attachments.length > 0 ? 'Describe what you want Smart Assistant to do with the attachment…' : 'Ask Smart Assistant anything…'} onChange={e => setInput(e.target.value)} onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            void send();
          }
        }} />
        <div className={s.composerActions}>
          <span className={s.composerHint}>{attachments.length > 0 ? 'Text + attachments ready' : 'Type your request'}</span>
          <QcButton variant="primary" disabled={busy || locked || voice.state !== 'off' || (!input.trim() && attachments.length === 0)} onClick={() => void send()}>Send</QcButton>
        </div>
      </div> : <div className={s.voiceDock}>
        {voice.state === 'recording' ? <>
          <div className={s.voiceLive}><span className={s.livePill}>Listening</span><span className={s.timer}>{formatElapsed(voice.elapsedMs)}</span></div>
          <div className={s.waveform} aria-hidden="true">{voice.meter.map((value, index) => <span key={index} className={s.waveBar} style={{ height: `${Math.max(16, Math.round(value * 84))}px` }} />)}</div>
          <div className={s.voiceActions}>
            <QcButton className={s.secondaryLarge} onClick={() => voice.cancel()}>Cancel</QcButton>
            <QcButton variant="primary" className={s.primaryLarge} onClick={() => void voice.toggle()}>Finish</QcButton>
          </div>
        </> : input.trim() ? <div className={s.transcriptCard}>
          <div className={s.transcriptHeader}><strong>Voice transcript</strong><span className={s.detail}>Review before sending.</span></div>
          <p>{input}</p>
          <div className={s.voiceActions}>
            <QcButton className={s.secondaryLarge} onClick={() => setInput('')}>Discard</QcButton>
            <QcButton className={s.secondaryLarge} onClick={() => changeMode('text')}>Edit</QcButton>
            <QcButton variant="primary" className={s.primaryLarge} disabled={busy || locked || voice.state !== 'off'} onClick={() => void send()}>Send</QcButton>
          </div>
        </div> : <>
          <div className={s.voiceIntro}>
            <span className={s.livePill}>Voice mode</span>
            <p>Tap the microphone to start recording. Tap again to finish, then review the transcript before sending.</p>
          </div>
          <button type="button" className={`${s.voiceOrb} ${voice.state === 'requesting' ? s.voiceOrbPending : ''}`} disabled={busy || locked || ['requesting', 'transcribing'].includes(voice.state)} onClick={() => void voice.toggle()}>
            <span className={s.voiceOrbIcon}>{voice.state === 'requesting' ? '…' : '🎙'}</span>
            <span className={s.voiceOrbLabel}>{voice.state === 'requesting' ? 'Opening mic' : 'Tap to record'}</span>
          </button>
        </>}
      </div>}
    </div>
  </div>;
}

function formatElapsed(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
