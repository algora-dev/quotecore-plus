'use client';
import { notifyComponentFocus } from '@/app/lib/smart-assistant/v2/component-focus';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createConversation, type ConversationRow } from '@/app/(auth)/[workspaceSlug]/assistant/actions';
import { displayTaskMessage } from '@/app/lib/smart-assistant/tasks/wire';
import { failedTurns, staleTaskCard, awaitingProceed } from '@/app/lib/smart-assistant/tasks/presentation';
import { displayResolutionMessage } from '@/app/lib/smart-assistant/resolver/wire';
import { displayDraftChoice } from '@/app/lib/smart-assistant/library-workflow/wire';
import { SafeMessage } from '../SafeMessage';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import type { Access, ActionView, ConversationCard, RecordTarget, SessionSnapshot } from '@/app/lib/smart-assistant/v2/contracts';
import { isUuid } from '@/app/lib/smart-assistant/v2/contracts';
import { isSafeDestination } from '@/app/lib/smart-assistant/v2/navigation';
import { isRecord } from '@/app/lib/smart-assistant/section-permissions';
import { ConversationCards } from './ConversationCards';
import { request, session } from './client';
import { consumeTurnStream } from './stream-turn';
import { useVoiceNote } from './useVoiceNote';
import { useSpeechPlayback } from './useSpeechPlayback';
import { useBuildVersion } from './useBuildVersion';
import { AssistantIcon } from './AssistantIcon';
import { AssistantSpinner } from './AssistantSpinner';
import { AssistantSheet } from './AssistantSheet';
import { VoiceCapture } from './VoiceCapture';
import { useAssistantViewport } from './useAssistantViewport';
import { attachmentError, MAX_LOCAL_ATTACHMENTS } from './media-utils';
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
  const [sheet, setSheet] = useState<'menu' | 'attach' | null>(null);
  const [mode, setMode] = useState<'voice' | 'text'>('text');
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
  const root = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  // Tracks the assistant message that was visible on the previous snapshot so
  // completed tasks can anchor at their beginning instead of the chat bottom.
  const lastAssistantAnchor = useRef<string | null | undefined>(undefined);
  const attachmentUrls = useRef(new Set<string>());
  const attachmentCount = useRef(0);
  attachmentCount.current = attachments.length;
  const inputValue = useRef(input); inputValue.current = input;
  const [draftOrigin, setDraftOrigin] = useState<'text' | 'voice'>('text');
  const [streamText, setStreamText] = useState('');
  // Streaming capability probe: on when the server flag serves SSE; any
  // mid-stream failure disables it permanently for this browser session and
  // every later turn uses the classic JSON path unchanged.
  const streamOffKey = `sa-stream-off:${access.userId}:${access.companyId}`;
  const canStream = useRef(false);
  useAssistantViewport(root, visible);
  const nearBottom = useRef(true);
  const visibility = useRef(visible);
  visibility.current = visible;
  const end = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const prefKey = `sa-input:${access.userId}:${access.companyId}`;
  const lastConversationKey = `sa-conversation:${access.userId}:${access.companyId}`;
  const speechPrefKey = `sa-speech:${access.userId}:${access.companyId}`;
  const ttsPrefKey = `sa-tts:${access.userId}:${access.companyId}`;
  const [voiceSendQueue, setVoiceSendQueue] = useState<string | null>(null);

  const voice = useVoiceNote(visible && !locked && !busy && !snapshot?.activeRunId && !unresolved, text => {
    const next = inputValue.current ? `${inputValue.current} ${text}` : text;
    if (next.length > MAX_INPUT) { setNotice('That would make the message too long. Send the existing draft first, then record another note.'); return; }
    setInput(next); setDraftOrigin('voice'); setMode('voice');
  }, setNotice, text => {
    // Transcribe & send: same composition + guards as the review card's Send,
    // then the transcript submits itself once the recorder has fully stopped.
    const composed = inputValue.current ? `${inputValue.current} ${text}` : text;
    if (composed.length > MAX_INPUT) { setNotice('That would make the message too long. Send the existing draft first, then record another note.'); return; }
    if (attachments.length > 0) { setNotice('Attachments are local previews only in this build. Remove them to send a text or voice message.'); return; }
    setVoiceSendQueue(composed);
  });
  const speech = useSpeechPlayback(visible && !locked, speechPrefKey, ttsPrefKey);
  const capturing = useRef(false); capturing.current = voice.state !== 'off';
  const updateReady = useBuildVersion(!busy && voice.state === 'off');

  const clearAttachments = useCallback(() => {
    attachmentUrls.current.forEach(url => URL.revokeObjectURL(url));
    attachmentUrls.current.clear(); attachmentCount.current = 0; setAttachments([]);
  }, []);
  useEffect(() => {
    mounted.current = true;
    const urls = attachmentUrls.current;
    return () => {
      mounted.current = false; epoch.current++;
      if (navTimer.current) clearTimeout(navTimer.current);
      urls.forEach(url => URL.revokeObjectURL(url)); urls.clear();
    };
  }, []);
  useEffect(() => {
    try {
      const pref = localStorage.getItem(prefKey);
      if (pref === 'voice' || pref === 'text') setMode(pref);
      const id = sessionStorage.getItem(lastConversationKey);
      if (isUuid(id)) setActive(id);
      try { canStream.current = sessionStorage.getItem(streamOffKey) !== '1'; } catch { canStream.current = true; }
    } catch { /* storage can be unavailable */ }
  }, [prefKey, lastConversationKey, streamOffKey]);
  useEffect(() => {
    // Late transcription/playback cannot leak into a different conversation.
    voice.cancel(); speech.stop(); clearAttachments(); setSheet(null); setVoiceSendQueue(null);
  }, [active, voice.cancel, speech.stop, clearAttachments]);
  useEffect(() => { if (!visible || locked) { setSheet(null); speech.stop(); } }, [visible, locked, speech.stop]);

  const changeMode = (next: 'voice' | 'text', focus = false) => {
    voice.cancel(); setMode(next); setSheet(null);
    try { localStorage.setItem(prefKey, next); } catch { /* personal preference only */ }
    if (next === 'text' && focus) requestAnimationFrame(() => composer.current?.focus({ preventScroll: true }));
  };
  const onFilesSelected = (files: FileList | null) => {
    if (!files?.length) return;
    const next: LocalAttachment[] = []; const errors: string[] = [];
    for (const file of Array.from(files)) {
      const error = attachmentError(file);
      if (error) { errors.push(error); continue; }
      if (attachmentCount.current + next.length >= MAX_LOCAL_ATTACHMENTS) { errors.push('Preview up to three files at a time.'); break; }
      const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
      if (previewUrl) attachmentUrls.current.add(previewUrl);
      next.push({ id: crypto.randomUUID(), file, previewUrl });
    }
    attachmentCount.current += next.length;
    setAttachments(prev => [...prev, ...next]); setSheet(null);
    if (errors.length) setNotice(errors[0]);
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
        if (outcome.status === 'completed' && !capturing.current) {
          const reply = next.messages.filter(m => m.role === 'assistant' && m.runId === outcome.id).at(-1);
          if (reply) speech.autoSpeak(reply.id, displayTaskMessage(displayResolutionMessage(reply.content)));
        }
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
  }, [access.companyId, access.userId, speech.autoSpeak]);

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

  // When an assistant turn completes, show the beginning of that answer so
  // the user can read the instruction and review the draft from the top.
  // Interim updates still follow the bottom while the user is already there.
  useEffect(() => {
    if (!visible) return;
    const lastAssistantId = [...(snapshot?.messages ?? [])].reverse().find(m => m.role === 'assistant')?.id ?? null;
    if (lastAssistantAnchor.current === undefined) {
      // Initial load keeps the existing chat behaviour.
      lastAssistantAnchor.current = lastAssistantId;
      if (nearBottom.current) end.current?.scrollIntoView({ block: 'end', behavior: 'auto' });
      return;
    }
    if (lastAssistantId && lastAssistantId !== lastAssistantAnchor.current) {
      lastAssistantAnchor.current = lastAssistantId;
      const assistantTurn = scroll.current?.querySelector('[data-sa-assistant-turn="true"]');
      if (assistantTurn) {
        assistantTurn.scrollIntoView({ block: 'start', behavior: 'auto' });
        return;
      }
    }
    if (nearBottom.current) end.current?.scrollIntoView({ block: 'end', behavior: 'auto' });
  }, [snapshot, busy, visible]);

  // Streamed provisional text follows the same bottom-anchored scroll as
  // persisted messages (answers stream token-by-token when enabled).
  useEffect(() => {
    if (nearBottom.current && visible && streamText) end.current?.scrollIntoView({ block: 'end', behavior: 'auto' });
  }, [streamText, visible]);

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
      setSheet(null);
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
    if (!rawText || rawText.length > MAX_INPUT || operation.current || locked || voice.state !== 'off') return;
    if (textOverride === undefined && attachments.length > 0) {
      setNotice('Attachments are local previews only in this build. Remove them to send a text or voice message.');
      return;
    }
    if (snapshot?.activeRunId) {
      setNotice('The assistant is still working. Please wait or refresh.');
      return;
    }
    const text = rawText; // No fake attachment metadata is ever sent as a model prompt.
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
        body: JSON.stringify({ conversationId: id, message: text, clientRequestId: logical.requestId, pageContext: { companyId: access.companyId, pathname }, ...(canStream.current ? { stream: true } : {}) }),
      });
      let result: unknown;
      if ((res.headers.get('content-type') ?? '').includes('text/event-stream')) {
        // Server streaming is enabled: consume SSE deltas with the SAME markdown
        // pipeline; the final event is authoritative and replaces provisional
        // text. Any failure disables streaming for this session and throws into
        // the existing pending/check-request flow (the run still finishes
        // server-side, so nothing is ever re-sent).
        try {
          result = await consumeTurnStream(res, {
            onDelta: delta => { if (mounted.current && current.current === id) setStreamText(prev => prev + delta); },
            onDiscard: () => { if (mounted.current) setStreamText(''); },
          });
        } catch (streamError) {
          canStream.current = false;
          try { sessionStorage.setItem(streamOffKey, '1'); } catch { /* preference only */ }
          setStreamText('');
          throw streamError;
        }
        setStreamText('');
      } else {
        result = await res.json().catch(() => null);
      }
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
        setInput(value => value.trim() === rawText ? '' : value);
        setSheet(null);
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

  const sendRef = useRef(send);
  sendRef.current = send;
  useEffect(() => {
    // Auto-submit for Transcribe & send: fires only after the recorder is fully
    // off so send() sees a clean voice state; a blocked send leaves the
    // transcript in the review card exactly like the default path.
    if (voiceSendQueue === null || voice.state !== 'off') return;
    const text = voiceSendQueue;
    setVoiceSendQueue(null);
    void sendRef.current(text);
  }, [voiceSendQueue, voice.state]);

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

  const controlsBusy = busy || locked || unresolved || !!snapshot?.activeRunId;
  // Owner 2026-10-01 (voice): questions with a known finite answer set get
  // tappable replies instead of forcing a typed/voice answer. A tap sends
  // ordinary text through send(), so the server binds it like any answer and
  // nothing here is ever write authority (Confirm cards keep their protocol).
  const quickRepliesFor = (text: string): { label: string; answer: string }[] => {
    if (!text) return [];
    if (/\b(?:plan|actual)[^.?!]{0,60}?\bor\b[^.?!]{0,60}?\b(?:plan|actual)\b/i.test(text)) return [
      { label: 'Plan measurements', answer: 'Plan measurements' },
      { label: 'Actual measurements', answer: 'Actual measurements' },
    ];
    return [];
  };
  const lastAssistantMessage = [...(snapshot?.messages ?? [])].reverse().find(m => m.role === 'assistant');
  const quickReplies = !streamText && lastAssistantMessage ? quickRepliesFor(lastAssistantMessage.content) : [];
  const hasMessages = !!snapshot?.messages.length;
  const currentAccess = snapshot?.access ?? access;
  const task = snapshot?.task;
  const taskLabel = task && task.status !== 'closed' ? task.label : 'Your QuoteCore+ copilot';
  const removeAttachment = (id: string) => {
    const item = attachments.find(a => a.id === id);
    if (item?.previewUrl) { URL.revokeObjectURL(item.previewUrl); attachmentUrls.current.delete(item.previewUrl); }
    setAttachments(prev => prev.filter(a => a.id !== id));
  };
  const hide = () => { voice.cancel(); speech.stop(); setSheet(null); onHide(); };
  const openAttachmentSheet = () => { voice.cancel(); speech.stop(); setSheet('attach'); };

  return <div ref={root} className={s.root} data-qc-ui="v2" data-clarity-mask="true" data-sa-v2="true" data-sa-experience="visual-v2" data-mode={mode}>
    <div className={s.frame} ref={frame}>
      <header className={s.header}>
        <QcButton autoFocus className={s.brandButton} aria-label="Assistant menu" aria-haspopup="dialog" aria-expanded={sheet === 'menu'} onClick={() => { voice.cancel(); setSheet('menu'); }}>
          <img src="/smart-assistant/q-menu.webp" alt="" width="44" height="44" draggable="false" />
        </QcButton>
        <div className={s.headerCopy}><h1>{assistantName || 'Smart Assistant'}</h1><p title={taskLabel}>{taskLabel}</p></div>
        <QcButton className={s.speakerButton} aria-label={speech.enabled ? 'Turn spoken replies off' : 'Turn spoken replies on'} aria-pressed={speech.enabled} disabled={!speech.available} title={!speech.available ? 'Spoken replies are unavailable in this browser' : speech.enabled ? 'Spoken replies on' : 'Spoken replies off'} onClick={speech.toggleEnabled}>
          <AssistantIcon name={speech.enabled ? 'speaker' : 'muted'}/>
        </QcButton>
        <QcButton className={s.hideButton} onClick={hide} aria-label="Hide assistant"><AssistantIcon name="hide"/><span>Hide</span></QcButton>
      </header>

      <div className={s.messages} ref={scroll} onScroll={() => { const el = scroll.current; if (el) nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100; }} aria-label="Conversation" tabIndex={0}>
        <div className={s.conversationContent}>
          {!hasMessages && <section className={s.welcome}>
            <span className={s.welcomeEyebrow}>QUOTECORE+ SMART ASSISTANT</span>
            <h2>{mode === 'voice' ? <>Less typing.<br/>More getting things done.</> : <>What can I help<br/>you with today?</>}</h2>
            <p>{greeting || 'Find the right record. Check a price. Review a change. All in one place.'}</p>
            {updateReady && (
        <button type="button" onClick={() => window.location.reload()} className={s.updateChip}>
          Update available · tap to reload
        </button>
      )}
      <div className={s.quickActions}>
              {currentAccess.permissions.quotes !== 'hidden' && <QcButton disabled={controlsBusy} onClick={() => void send('Show my quotes.')}><AssistantIcon name="search"/><span>Find my quotes</span><AssistantIcon name="chevron"/></QcButton>}
              {currentAccess.permissions.draft_quotes !== 'hidden' && <QcButton disabled={controlsBusy} onClick={() => void send('Open my most recent draft.')}><AssistantIcon name="draft"/><span>Open my latest draft</span><AssistantIcon name="chevron"/></QcButton>}
              {currentAccess.phases.p2 && <QcButton disabled={controlsBusy} onClick={() => void send('What needs my attention today?')}><AssistantIcon name="alert"/><span>What needs attention?</span><AssistantIcon name="chevron"/></QcButton>}
            </div>
            {access.historyAfter && <p className={s.detail}>Earlier messages may be withheld after an access change.</p>}
          </section>}

          {snapshot?.messages.map(m => <div key={m.id} className={s.turn} data-sa-assistant-turn={m.role === 'assistant' && m.id === lastAssistantMessage?.id ? 'true' : undefined}>
            <div className={m.role === 'user' ? s.userMessage : s.assistantMessage}>
              {m.role === 'assistant' && <div className={s.assistantHeading}><span className={s.messageLabel}>ASSISTANT</span>{speech.available && <QcButton className={s.readAloud} aria-label="Read this answer aloud" disabled={locked || voice.state !== 'off'} onClick={() => speech.play(displayTaskMessage(displayResolutionMessage(displayDraftChoice(m.content))))}><AssistantIcon name="speaker"/></QcButton>}</div>}
              <SafeMessage content={displayTaskMessage(displayResolutionMessage(displayDraftChoice(m.content)))}/>
            </div>
            {failureByMessage.has(m.id) && <div className={s.failure} role="status" data-sa-failed-run={m.runId ?? undefined}>
              <AssistantIcon name="alert"/><div><p>{failureByMessage.get(m.id)!.copy}</p>
              {m.id === latestUser && failureByMessage.get(m.id)!.canRetry && <QcButton disabled={controlsBusy} onClick={() => void send(failureByMessage.get(m.id)!.retryText)}>Retry request</QcButton>}</div>
            </div>}
            {m.role === 'assistant' && <>
              <ConversationCards isStale={staleChoice} canConfirm={canConfirm} cards={cardsFor(m.runId)} actions={snapshot.actions} busy={controlsBusy || voice.state !== 'off'} onOpen={(c, t) => void openRecord(c, t)} onReply={t => void send(t)} onAction={(a, c) => void act(a, c)}/>
            </>}
            {m.role === 'assistant' && m.id === lastAssistantMessage?.id && quickReplies.length > 0 && <div className={s.quickActions} data-sa-quick-replies="true">
              {quickReplies.map(reply => <QcButton key={reply.answer} disabled={controlsBusy || voice.state !== 'off'} onClick={() => void send(reply.answer)}>{reply.label}</QcButton>)}
            </div>}
          </div>)}
          <ConversationCards isStale={staleChoice} canConfirm={canConfirm} cards={orphanCards} actions={snapshot?.actions ?? []} busy={controlsBusy || voice.state !== 'off'} onOpen={(c, t) => void openRecord(c, t)} onReply={t => void send(t)} onAction={(a, c) => void act(a, c)}/>
          {streamText && <div className={s.turn} data-sa-streaming="true">
            <div className={s.assistantMessage}>
              <div className={s.assistantHeading}><span className={s.messageLabel}>ASSISTANT</span></div>
              <SafeMessage content={streamText}/>
            </div>
          </div>}
          {task && <div className={s.taskFooter} data-sa-task={task.id}>
            {task.status === 'closed' ? <p className={s.detail}><AssistantIcon name="check"/>Task closed. Ask something new whenever you’re ready.</p> : awaitingProceed(task, snapshot?.messages ?? []) ? <>
              {/* Assistant asked for confirmation to continue: Proceed is UX sugar over
                  sending "Yes, proceed." through the normal turn pipeline. Never a write
                  confirmation — action cards keep their own Confirm/Cancel protocol. */}
              <QcButton variant="primary" disabled={controlsBusy || voice.state !== 'off'} onClick={() => void send('Yes, proceed.')}><AssistantIcon name="chevron"/><span>Proceed</span></QcButton>
              <QcButton className={s.quietButton} disabled={controlsBusy || voice.state !== 'off'} onClick={refineAnswer}>Not quite</QcButton>
              <QcButton className={s.doneButton} disabled={controlsBusy || voice.state !== 'off'} onClick={() => void finishTask('done')}><AssistantIcon name="check"/><span>Done</span></QcButton>
            </> : <>
              <QcButton className={s.doneButton} disabled={controlsBusy || voice.state !== 'off'} onClick={() => void finishTask(task.status === 'answered' ? 'done' : 'move_on')}><AssistantIcon name={task.status === 'answered' ? 'check' : 'chevron'}/>{task.status === 'answered' ? 'Done' : 'Move on'}</QcButton>
              {task.status === 'answered' && <QcButton className={s.quietButton} disabled={controlsBusy || voice.state !== 'off'} onClick={refineAnswer}>Not quite</QcButton>}
            </>}
          </div>}
          {unresolved && !busy && !snapshot?.activeRunId && active && <div className={s.failure} role="status"><AssistantIcon name="alert"/><div><p>The last request’s outcome is not confirmed yet.</p><QcButton disabled={locked} onClick={() => void send(pending.current.get(active)?.message)}>Check request</QcButton></div></div>}
          {(busy || snapshot?.activeRunId) && <div className={s.working} role="status"><AssistantSpinner/><span>Working on your request…</span></div>}
          <div ref={end}/>
        </div>
      </div>

      <div className={s.bottomArea}>
        {notice && <div className={s.notice} role="alert"><AssistantIcon name="alert"/><span>{notice}</span>{locked && active ? <QcButton size="sm" disabled={busy} onClick={() => void refresh(active)}>Check status</QcButton> : <QcButton className={s.iconButton} aria-label="Dismiss notice" onClick={() => setNotice(null)}><AssistantIcon name="close"/></QcButton>}</div>}
        {speech.state !== 'off' && <div className={s.playback}>
          <AssistantIcon name="speaker"/><div className={s.playbackCopy}><strong>{speech.state === 'error' ? 'Audio unavailable' : speech.state === 'paused' ? 'Paused' : speech.state === 'loading' ? 'Preparing audio…' : 'Speaking response'}</strong><span>{speech.error || 'Your text answer stays in the conversation'}</span></div>
          {['speaking','paused'].includes(speech.state) && <QcButton className={s.iconButton} aria-label={speech.state === 'paused' ? 'Resume speech' : 'Pause speech'} onClick={speech.pauseOrResume}><AssistantIcon name={speech.state === 'paused' ? 'play' : 'pause'}/></QcButton>}
          <QcButton className={s.iconButton} aria-label="Stop speech" onClick={speech.stop}><AssistantIcon name="close"/></QcButton>
        </div>}

        {mode === 'voice' && !busy && !snapshot?.activeRunId && !(input.trim() && voice.state === 'off') && <VoiceCapture voice={voice} disabled={controlsBusy} expanded={!hasMessages} beforeStart={() => { speech.stop(); setNotice(null); }}/>} 
        {mode === 'voice' && input.trim() && voice.state === 'off' && <section className={s.transcript} aria-label="Review message">
          <div className={s.transcriptHeader}><span>{draftOrigin === 'voice' ? 'YOUR VOICE NOTE' : 'YOUR MESSAGE'}</span><QcButton className={s.quietButton} onClick={() => changeMode('text', true)}><AssistantIcon name="edit"/>Edit</QcButton></div>
          <p>{input}</p><div className={s.transcriptActions}><QcButton disabled={controlsBusy} onClick={() => setInput('')}>Discard</QcButton><QcButton variant="primary" disabled={controlsBusy || !!attachments.length} onClick={() => void send()}><AssistantIcon name="send"/>Send message</QcButton></div>
        </section>}

        <div className={s.dock}>
          {attachments.length > 0 && <div className={s.attachments}>
            <div className={s.attachmentList}>{attachments.map(item => <div key={item.id} className={s.attachmentItem}>
              {item.previewUrl ? <img src={item.previewUrl} alt="Local attachment preview" width="40" height="40"/> : <AssistantIcon name="file"/>}
              <span><strong>{item.file.name}</strong><small>On this device · not uploaded</small></span>
              <QcButton className={s.iconButton} aria-label={`Remove ${item.file.name}`} onClick={() => removeAttachment(item.id)}><AssistantIcon name="close"/></QcButton>
            </div>)}</div>
            <p>File reading is not enabled yet. Remove previews to send.</p>
          </div>}
          {mode === 'text' && <div className={s.textDock}>
            <textarea ref={composer} className={s.input} aria-label="Message the assistant" value={input} disabled={busy || locked || voice.state !== 'off'} maxLength={MAX_INPUT} rows={1} placeholder="Ask Smart Assistant…" onChange={e => { setInput(e.target.value); setDraftOrigin('text'); }} onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia('(hover: hover) and (pointer: fine)').matches) { e.preventDefault(); void send(); }
            }}/>
            <QcButton className={s.sendButton} variant="primary" aria-label="Send message" disabled={controlsBusy || voice.state !== 'off' || !input.trim() || !!attachments.length} onClick={() => void send()}><AssistantIcon name="send"/></QcButton>
          </div>}
          <div className={s.modeBar} role="group" aria-label="Input controls">
            <QcButton className={s.modeButton} aria-pressed={mode === 'text'} onClick={() => changeMode('text', true)}><AssistantIcon name="keyboard"/><span>Type</span></QcButton>
            <QcButton className={s.modeButton} aria-pressed={mode === 'voice'} onClick={() => changeMode('voice')}><AssistantIcon name="mic"/><span>Voice</span></QcButton>
            <QcButton className={s.modeButton} aria-haspopup="dialog" aria-expanded={sheet === 'attach'} aria-label="Attach a photo or file" onClick={openAttachmentSheet}><AssistantIcon name="attach"/><span>Attach</span></QcButton>
          </div>
        </div>
      </div>
    </div>

    {sheet && <AssistantSheet title={sheet === 'menu' ? 'Your assistant' : 'Add an attachment'} background={frame} onClose={() => setSheet(null)}>
      {sheet === 'menu' ? <>
        <div className={s.menuActions}>
          <QcButton disabled={controlsBusy} onClick={() => void newChat()}><AssistantIcon name="plus"/>New conversation</QcButton>
          <QcButton onClick={() => { voice.cancel(); speech.stop(); router.push(settingsHref); hide(); }}><AssistantIcon name="settings"/>Assistant settings</QcButton>
        </div>
        <div className={s.voicePreference}>
          <label htmlFor={`sa-voice-${access.companyId}`}>Spoken replies</label>
          <QcButton disabled={!speech.available} aria-pressed={speech.enabled} onClick={speech.toggleEnabled}>{speech.enabled ? 'On' : 'Off'}</QcButton>
          <select id={`sa-voice-${access.companyId}`} aria-label="Reading voice" value={speech.voiceURI} disabled={!speech.available} onChange={e => speech.chooseVoice(e.target.value)}>
            <option value="">Device default voice</option>{speech.voices.map(v => <option key={`${v.voiceURI}:${v.lang}`} value={v.voiceURI}>{v.name} · {v.lang}</option>)}
          </select>
          <div className={s.voiceTtsRow}>
            <label htmlFor={`sa-tts-voice-${access.companyId}`}>Premium AI voice</label>
            <QcButton disabled={!speech.available} aria-pressed={speech.premiumEnabled} onClick={speech.togglePremium}>{speech.premiumEnabled ? 'On' : 'Off'}</QcButton>
          </div>
          {speech.premiumEnabled && <select id={`sa-tts-voice-${access.companyId}`} aria-label="Premium reading voice" value={speech.premiumVoice} onChange={e => speech.choosePremiumVoice(e.target.value)}>
            {speech.premiumVoices.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>}
          <p className={s.detail}>{speech.premiumEnabled && !speech.premiumReady ? 'Premium AI voice is not available right now, so browser/device voices will speak replies. It turns on automatically when the service is reachable.' : 'Premium AI voice speaks replies with a natural neural voice and falls back to browser voices when unavailable. Spoken replies never replace the text.'}</p>
        </div>
        <h3 className={s.sectionLabel}>Recent conversations</h3>
        <div className={s.conversationList}>{conversations.slice(0, 12).map(c => <QcButton key={c.id} disabled={controlsBusy} aria-current={active === c.id ? 'page' : undefined} onClick={() => { voice.cancel(); speech.stop(); setActive(c.id); setInput(''); clearAttachments(); setSheet(null); }}><AssistantIcon name="history"/><span>{c.title || `Conversation · ${new Date(c.last_active_at).toLocaleDateString()}`}</span><AssistantIcon name="chevron"/></QcButton>)}</div>
      </> : <>
        <p className={s.sheetIntro}>Add context to your next request.</p>
        <div className={s.attachmentNotice}><AssistantIcon name="lock"/><p><strong>Local preview only</strong>Photo and file reading is not enabled in this build. Nothing is uploaded or sent to the assistant.</p></div>
        <div className={s.attachmentOptions}>
          <QcButton onClick={() => cameraInput.current?.click()}><span className={s.optionIcon}><AssistantIcon name="camera"/></span><span><strong>Take a photo</strong><small>Open your camera</small></span><AssistantIcon name="chevron"/></QcButton>
          <QcButton onClick={() => imageInput.current?.click()}><span className={s.optionIcon}><AssistantIcon name="image"/></span><span><strong>Choose an image</strong><small>From your photo library</small></span><AssistantIcon name="chevron"/></QcButton>
          <QcButton onClick={() => uploadInput.current?.click()}><span className={s.optionIcon}><AssistantIcon name="file"/></span><span><strong>Choose a file</strong><small>PDF or plain text</small></span><AssistantIcon name="chevron"/></QcButton>
        </div><p className={s.detail}>Up to 3 local previews · 10 MB each. Remove previews before sending a message.</p>
        <input ref={cameraInput} hidden type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={e => { onFilesSelected(e.target.files); e.currentTarget.value = ''; }}/>
        <input ref={imageInput} hidden type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={e => { onFilesSelected(e.target.files); e.currentTarget.value = ''; }}/>
        <input ref={uploadInput} hidden type="file" accept="application/pdf,text/plain" multiple onChange={e => { onFilesSelected(e.target.files); e.currentTarget.value = ''; }}/>
      </>}
    </AssistantSheet>}
  </div>;
}
