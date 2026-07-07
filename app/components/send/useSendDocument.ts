/**
 * useSendDocument — the state machine hook for the unified send modal.
 *
 * Owns all state that was previously strewn across the three send buttons:
 * mode, sendStage, compose fields, token, follow-up draft rules, send state.
 */

'use client';

import { useState, useTransition, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { sendDocumentMessage } from '@/app/lib/send-document/orchestrator';
import { scheduleDocumentFollowUp } from '@/app/lib/send-document/followups';
import { generateAcceptanceToken } from '@/app/(auth)/[workspaceSlug]/quotes/actions';
import { useSendTestTip } from './sendTestTip';
import type { SendDocumentProps, EmailTemplate } from './types';
import { ENTITY_CONFIG } from './entityConfig';
import type { EntityKind } from './types';

export type SendMode = 'choose' | 'send' | 'url' | 'email';
export type SendStage = 'form' | 'gate' | 'followups';

export interface DraftRule {
  id: string;
  kind: 'triggered' | 'time_based';
  trigger: string;
  addDelay: boolean;
  delayDays: number;
  delayHours: number;
  delayMinutes: number;
  templateId: string;
  result: { ok: true; fireAt: string } | { ok: false; error: string } | null;
}

function sanitize(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function replacePlaceholders(text: string, data: Record<string, string>): string {
  return text.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (match, key: string) => {
    const value = data[key];
    if (value === undefined) return match;
    // Don't sanitize link values (they're URLs).
    if (key.endsWith('_link') || key.endsWith('_url')) return value;
    return sanitize(value);
  });
}

export function useSendDocument(props: SendDocumentProps) {
  const router = useRouter();
  const config = ENTITY_CONFIG[props.entityKind];
  const testTip = useSendTestTip(props.sendTestTipSeen);

  const [showTestTip, setShowTestTip] = useState(false);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<SendMode>('choose');
  const [sendStage, setSendStage] = useState<SendStage>('form');

  // Compose state
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [recipientEmail, setRecipientEmail] = useState(props.defaultRecipientEmail ?? '');

  // Attachment state
  const [attachmentSelection, setAttachmentSelection] = useState({
    libraryAttachmentIds: [] as string[],
    quoteFileIds: [] as string[],
  });

  // Token state (for URL mode)
  const [token, setToken] = useState<string | null>(props.existingToken ?? null);
  const [tokenLoading, setTokenLoading] = useState(false);

  // Copy state
  const [copied, setCopied] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);

  // Send state
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<'sent' | 'suppressed' | null>(null);
  const [isSending, startSendTransition] = useTransition();

  // Follow-up state
  const [draftRules, setDraftRules] = useState<DraftRule[]>([]);
  const [followUpSaving, setFollowUpSaving] = useState(false);
  const [followUpError, setFollowUpError] = useState<string | null>(null);

  const isPlanGated = sendError?.includes("isn't included in your current plan") ?? false;

  const today = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  // Build placeholder data for client-side template prefill.
  const placeholderData: Record<string, string> = {
    ...props.mergeData,
    today,
  };

  // Compute the public URL from the token.
  const publicUrl = token
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}${config.publicPathPrefix}/${token}`
    : null;

  // ─── Token generation for URL mode ───
  useEffect(() => {
    if (mode !== 'url' || token || tokenLoading) return;
    if (config.tokenStrategy === 'static') {
      // Static tokens (invoice) should already be in props.existingToken.
      return;
    }
    if (config.tokenStrategy === 'idempotent-generate') {
      // Orders: token should already be in props.existingToken (server-side).
      return;
    }
    // Expiring-commit (quote): fetch a token for display without committing expiry/job_status.
    setTokenLoading(true);
    generateAcceptanceToken(props.entityId, 30, false)
      .then((t) => setToken(t))
      .catch((err) => setSendError(err instanceof Error ? err.message : 'Failed to generate link.'))
      .finally(() => setTokenLoading(false));
  }, [mode, token, tokenLoading, config.tokenStrategy, props.entityId]);

  // ─── Prefill subject/body when entering send/email mode ───
  useEffect(() => {
    if (mode !== 'send' && mode !== 'email') return;
    if (emailSubject || emailBody) return; // Don't clobber edits.
    const def = props.emailTemplates.find((t) => t.is_default) || props.emailTemplates[0];
    if (def) {
      setSelectedTemplateId(def.id);
      setEmailSubject(replacePlaceholders(def.subject, placeholderData));
      setEmailBody(replacePlaceholders(def.body, placeholderData));
    } else {
      buildDefaultEmail();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // ─── Copilot close-modals listener ───
  useEffect(() => {
    if (!open) return;
    const handler = () => setOpen(false);
    window.addEventListener('copilot-close-modals', handler);
    return () => window.removeEventListener('copilot-close-modals', handler);
  }, [open]);

  function buildDefaultEmail() {
    const name = props.defaultRecipientName ? ` ${props.defaultRecipientName}` : '';
    const subject = `${config.noun} from ${props.mergeData.company_name || 'us'}`;
    const body = `Hi${name},\n\nPlease find your ${config.noun.toLowerCase()} at the following link:\n\n${publicUrl || `[${config.noun} link will appear here]`}\n\nKind regards`;
    setEmailSubject(subject);
    setEmailBody(body);
  }

  function prefillFromTemplate(template: EmailTemplate | undefined) {
    if (!template) return;
    setEmailSubject(replacePlaceholders(template.subject, placeholderData));
    setEmailBody(replacePlaceholders(template.body, placeholderData));
  }

  function handleTemplateChange(templateId: string) {
    setSelectedTemplateId(templateId);
    prefillFromTemplate(props.emailTemplates.find((t) => t.id === templateId));
  }

  function openEmailOrSendMode(nextMode: 'email' | 'send') {
    const def = props.emailTemplates.find((t) => t.is_default) || props.emailTemplates[0];
    if (def) {
      setSelectedTemplateId(def.id);
      prefillFromTemplate(def);
    } else {
      setSelectedTemplateId('');
      buildDefaultEmail();
    }
    setSendError(null);
    setSendSuccess(null);
    setMode(nextMode);
  }

  function openSendModal() {
    setOpen(true);
    setMode('choose');
    setCopied(false);
    setEmailCopied(false);
    setSendError(null);
    setSendSuccess(null);
    setSendStage('form');
    setDraftRules([]);
    setFollowUpError(null);
  }

  function handleOpen() {
    if (testTip.shouldShow) {
      setShowTestTip(true);
      return;
    }
    openSendModal();
  }

  function defaultTemplateId(): string {
    const def = props.emailTemplates.find((t) => t.is_default) || props.emailTemplates[0];
    return def?.id ?? selectedTemplateId ?? '';
  }

  // ─── Follow-up rule management ───
  function addDraftRule(kind: 'triggered' | 'time_based') {
    setFollowUpError(null);
    if (draftRules.length >= 3) {
      setFollowUpError(`You can add at most 3 follow-ups per ${config.noun.toLowerCase()}.`);
      return;
    }
    if (kind === 'triggered') {
      // Find first unused trigger.
      const used = new Set(draftRules.filter((r) => r.kind === 'triggered').map((r) => r.trigger));
      const free = config.followUps.triggerOptions.find((t) => !used.has(t.value));
      if (!free) {
        setFollowUpError('All triggers already have a follow-up.');
        return;
      }
      setDraftRules((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          kind: 'triggered',
          trigger: free.value,
          addDelay: false,
          delayDays: 0,
          delayHours: 0,
          delayMinutes: 0,
          templateId: defaultTemplateId(),
          result: null,
        },
      ]);
    } else {
      // Time-based: default trigger is the entity_sent event.
      const timeTrigger = `${props.entityKind}_sent`;
      setDraftRules((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          kind: 'time_based',
          trigger: timeTrigger,
          addDelay: true,
          delayDays: 3,
          delayHours: 0,
          delayMinutes: 0,
          templateId: defaultTemplateId(),
          result: null,
        },
      ]);
    }
  }

  function updateDraftRule(id: string, patch: Partial<DraftRule>) {
    setDraftRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeDraftRule(id: string) {
    setFollowUpError(null);
    setDraftRules((prev) => prev.filter((r) => r.id !== id));
  }

  // ─── Copy URL ───
  async function handleCopyUrl() {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
    } catch {
      const input = document.createElement('input');
      input.value = publicUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ─── Copy Email ───
  async function handleCopyEmail() {
    const fullEmail = `Subject: ${emailSubject}\n\n${emailBody}`;
    try {
      await navigator.clipboard.writeText(fullEmail);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = fullEmail;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setEmailCopied(true);
    setTimeout(() => setEmailCopied(false), 2000);
  }

  // ─── Validate compose form ───
  function validateComposeForm(): boolean {
    setSendError(null);
    setSendSuccess(null);
    if (!recipientEmail.trim()) {
      setSendError('Please enter a recipient email.');
      return false;
    }
    if (!emailSubject.trim() || !emailBody.trim()) {
      setSendError('Subject and body cannot be empty.');
      return false;
    }
    return true;
  }

  // ─── Run the actual send ───
  function runSend(): Promise<{ ok: boolean }> {
    return new Promise((resolve) => {
      startSendTransition(async () => {
        const result = await sendDocumentMessage({
          entityKind: props.entityKind,
          entityId: props.entityId,
          templateId: selectedTemplateId || null,
          subject: emailSubject,
          body: emailBody,
          recipientEmail: recipientEmail.trim(),
          recipientName: props.defaultRecipientName ?? null,
          attachmentSelection,
        });
        if (result.ok) {
          setSendSuccess(result.status);
          router.refresh();
        } else {
          setSendError(result.error);
        }
        resolve({ ok: result.ok });
      });
    });
  }

  // ─── Gate: compose → gate ───
  function handleProceedToGate() {
    if (!validateComposeForm()) return;
    setSendStage('gate');
  }

  // ─── Gate branch A: send now ───
  async function handleSendNow() {
    await runSend();
    setSendStage('form');
  }

  // ─── Gate branch B: open follow-up builder ───
  function handleOpenFollowUps() {
    setFollowUpError(null);
    setSendStage('followups');
  }

  // ─── Confirm follow-ups + send ───
  async function handleConfirmFollowUpsAndSend() {
    setFollowUpError(null);
    const rules = draftRules.filter((r) => r.templateId);
    if (rules.length === 0) {
      setFollowUpError('Add at least one follow-up, or go back and choose "Send now".');
      return;
    }
    setFollowUpSaving(true);
    try {
      let anyError = false;
      for (const rule of rules) {
        const isTriggered = rule.kind === 'triggered';
        const triggerEvent = isTriggered ? rule.trigger : `${props.entityKind}_sent`;
        const waitDays = isTriggered ? (rule.addDelay ? rule.delayDays : 0) : rule.delayDays;
        const waitHours = isTriggered ? (rule.addDelay ? rule.delayHours : 0) : rule.delayHours;
        const waitMinutes = isTriggered ? (rule.addDelay ? rule.delayMinutes : 0) : rule.delayMinutes;
        const result = await scheduleDocumentFollowUp(props.entityKind, {
          entityId: props.entityId,
          templateId: rule.templateId,
          triggerEvent,
          waitDays,
          waitHours,
          waitMinutes,
          requireNoResponse: !isTriggered,
          respectQuietHours: true,
          recipientEmail: recipientEmail.trim(),
          recipientName: props.defaultRecipientName ?? null,
        });
        updateDraftRule(rule.id, {
          result: result.ok
            ? { ok: true as const, fireAt: result.fireAt }
            : { ok: false as const, error: result.error },
        });
        if (!result.ok) anyError = true;
      }
      if (anyError) {
        setFollowUpError('Some follow-ups could not be scheduled. Fix or remove them, then try again.');
        return;
      }
      const sendResult = await runSend();
      if (sendResult.ok) {
        router.refresh();
        setSendStage('form');
      }
    } finally {
      setFollowUpSaving(false);
    }
  }

  // ─── URL count in body for spam warning ───
  const urlCountInBody = (emailBody.match(/https?:\/\/[^\s]+/gi) ?? []).length;
  const bodyHasExtraUrls = urlCountInBody > 1;

  // ─── Navigate to template creator ───
  function goCreateTemplate() {
    const returnPath = encodeURIComponent(
      props.entityKind === 'invoice'
        ? `/${props.workspaceSlug}/invoices/${props.entityId}`
        : props.entityKind === 'order'
          ? `/${props.workspaceSlug}/material-orders/${props.entityId}/preview`
          : `/${props.workspaceSlug}/quotes/${props.entityId}/summary`,
    );
    router.push(
      `/${props.workspaceSlug}/resources?tab=email&kind=${config.templateKind}&return=${returnPath}`,
    );
  }

  return {
    config,
    testTip,
    showTestTip,
    setShowTestTip,
    open,
    setOpen,
    mode,
    setMode,
    sendStage,
    setSendStage,
    // compose
    selectedTemplateId,
    emailSubject,
    setEmailSubject,
    emailBody,
    setEmailBody,
    recipientEmail,
    setRecipientEmail,
    handleTemplateChange,
    // attachments
    attachmentSelection,
    setAttachmentSelection,
    // token
    token,
    publicUrl,
    // copy
    copied,
    emailCopied,
    handleCopyUrl,
    handleCopyEmail,
    // send
    sendError,
    sendSuccess,
    isSending,
    isPlanGated,
    handleOpen,
    openSendModal,
    openEmailOrSendMode,
    validateComposeForm,
    handleProceedToGate,
    handleSendNow,
    handleOpenFollowUps,
    handleConfirmFollowUpsAndSend,
    runSend,
    // follow-ups
    draftRules,
    addDraftRule,
    updateDraftRule,
    removeDraftRule,
    followUpSaving,
    followUpError,
    // misc
    bodyHasExtraUrls,
    goCreateTemplate,
    emailTemplates: props.emailTemplates,
  };
}
