'use client';
import { usePathname } from 'next/navigation';
import { isSafeReturnDestination } from '@/app/lib/smart-assistant/v2/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LegacySmartAssistantLauncher } from './LegacySmartAssistantLauncher';
import { V2ChatClient } from './v2/V2ChatClient';
import { useCapability } from './v2/useCapability';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import type { ConversationRow } from '@/app/(auth)/[workspaceSlug]/assistant/actions';
import s from './v2/assistant.module.css';

type Props = { workspaceSlug: string; initialConversations: ConversationRow[]; assistantName: string; greeting: string };

/** A working, non-modal panel. No body scroll lock, full-page inert or backdrop.
 * Access refresh never retries a user mutation. Mobile keeps its viewport fit. */
export function SmartAssistantLauncher(props: Props) {
  const pathname = usePathname();
  const standalone = pathname === `/${props.workspaceSlug}/assistant`;
  const state = useCapability();
  const [accessEpoch, setAccessEpoch] = useState(0);
  const [open, setOpen] = useState(false);
  const [opening, setOpening] = useState(false);
  const [started, setStarted] = useState(false);
  const [localError, setLocalError] = useState('');
  const [demoOwnsEntry, setDemoOwnsEntry] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const requestId = useRef(0);
  const mounted = useRef(false);
  const isOpen = useRef(false);
  const recovering = useRef(false);
  const recoveryAttempted = useRef(false);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    // No event exists in ordinary accounts: normal launcher behavior is unchanged.
    const report = (event: Event) => setDemoOwnsEntry((event as CustomEvent).detail?.ownsAssistantEntry === true);
    window.addEventListener('qc-demo-guide-visibility', report);
    window.dispatchEvent(new Event('qc-demo-guide-visibility-request'));
    return () => window.removeEventListener('qc-demo-guide-visibility', report);
  }, []);
  useEffect(() => {
    if (!state.access || standalone) return;
    const path = pathname + window.location.search;
    if (isSafeReturnDestination(path, props.workspaceSlug)) {
      try { sessionStorage.setItem(`sa-last-page:${state.access.userId}:${state.access.companyId}`, path); } catch { /* optional */ }
    }
  }, [pathname, standalone, state.access, props.workspaceSlug]);

  const hide = useCallback(() => {
    ++requestId.current; isOpen.current = false; setOpen(false); setOpening(false);
    // Restore focus only when it was in our panel, never on initial mount or
    // while the visitor is deliberately using the application behind it.
    const restore = !!panel.current?.contains(document.activeElement);
    if (restore) requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }));
  }, []);
  const refreshAccess = state.refresh;
  const openAssistant = useCallback(async () => {
    if (isOpen.current) { panel.current?.focus({ preventScroll: true }); return; }
    const id = ++requestId.current;
    isOpen.current = true; recoveryAttempted.current = false;
    setOpen(true); setOpening(true); setLocalError('');
    const fresh = await refreshAccess();
    if (!mounted.current || id !== requestId.current || !isOpen.current) return;
    setOpening(false);
    if (fresh) setStarted(true);
    else setLocalError('Assistant access could not be opened. Retry below; your workspace is unchanged.');
  }, [refreshAccess]);

  const refreshAssistant = useCallback(async (automatic = false) => {
    if (recovering.current || !isOpen.current) return;
    if (automatic && recoveryAttempted.current) {
      setLocalError('Assistant permissions changed again. Refresh the Assistant before continuing. Your last request has not been retried.');
      return;
    }
    recoveryAttempted.current = true; recovering.current = true;
    const id = ++requestId.current; setOpening(true); setLocalError('');
    const fresh = await refreshAccess();
    recovering.current = false;
    if (!mounted.current || id !== requestId.current || !isOpen.current) return;
    setOpening(false);
    if (fresh) { setStarted(true); setAccessEpoch(epoch => epoch + 1); }
    else setLocalError('Could not refresh Assistant access. Please try again; no request has been retried.');
  }, [refreshAccess]);

  useEffect(() => {
    if (standalone) return;
    const openFromDemo = () => { void openAssistant(); };
    window.addEventListener('qc-open-assistant', openFromDemo);
    window.addEventListener('qc-hide-assistant', hide);
    return () => { window.removeEventListener('qc-open-assistant', openFromDemo); window.removeEventListener('qc-hide-assistant', hide); };
  }, [standalone, openAssistant, hide]);
  useEffect(() => {
    const report = () => window.dispatchEvent(new CustomEvent('qc-assistant-visibility', { detail: { open: open && !standalone } }));
    report(); window.addEventListener('qc-assistant-visibility-request', report);
    return () => {
      window.removeEventListener('qc-assistant-visibility-request', report);
      window.dispatchEvent(new CustomEvent('qc-assistant-visibility', { detail: { open: false } }));
    };
  }, [open, standalone]);
  useEffect(() => {
    if (!open || standalone) return;
    panel.current?.focus({ preventScroll: true });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || !panel.current?.contains(document.activeElement)) return;
      // A nested app confirmation owns Escape until it closes.
      if (document.querySelector('dialog[open]')) return;
      event.preventDefault(); hide();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, standalone, hide]);

  if (!state.ready && !open) return null;
  if (state.ready && !state.access && !state.error && !localError && !opening) return <LegacySmartAssistantLauncher {...props} />;
  const accessKey = state.access ? `${state.access.userId}:${state.access.companyId}:${state.access.permissionRevision}:${accessEpoch}` : 'no-access';
  const error = state.error || localError;
  return <div data-qc-ui="v2">
    <div className={s.launcher} hidden={open || standalone || demoOwnsEntry}><QcButton ref={trigger} variant="secondary" aria-label={`Open ${props.assistantName}`} aria-expanded={open} onClick={() => void openAssistant()}>{props.assistantName}</QcButton></div>
    <section ref={panel} tabIndex={-1} data-sa-host="true" className={s.dialog} hidden={!open || standalone} role="dialog" aria-modal="false" aria-label={props.assistantName}>
      {(opening || error || !started || !state.access) && <div className={s.accessState}>
        <header><h2>{props.assistantName}</h2><QcButton variant="ghost" aria-label="Hide Smart Assistant" onClick={hide}>Close</QcButton></header>
        {opening ? <p role="status">Checking your latest workspace permissions…</p> : <><p role="alert">{error || 'Assistant access is not available on this workspace yet.'}</p><QcButton variant="primary" onClick={() => void refreshAssistant()}>Retry Assistant access</QcButton></>}
        <p className={s.accessHint}>You can keep working in QuoteCore+ while this panel is open.</p>
      </div>}
      {started && state.access && <div className={s.chatMount} hidden={opening || !!error}><V2ChatClient key={accessKey} {...props} access={state.access} settingsHref={`/${props.workspaceSlug}/account/smart-assistant`} visible={open && !standalone && !opening && !error} onHide={hide} onStaleAccess={() => { void refreshAssistant(true); }} /></div>}
    </section>
  </div>;
}
