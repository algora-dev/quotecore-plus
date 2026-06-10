'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  loadOrderTemplatesForSend,
  sendOrderMessage,
} from './send-order-actions';
import { generateOrderSupplierToken } from './supplier-link-actions';
import { scheduleOrderFollowUp } from '@/app/lib/messages/scheduled';
import {
  AttachmentSendPicker,
  type PickerFile,
  type AttachmentSelection,
} from '@/app/components/attachments/AttachmentSendPicker';

interface Props {
  orderId: string;
  orderNumber: string;
  workspaceSlug: string;
  /** Existing supplier token, if any. Used to skip an extra round-trip
   *  when the user opens the Copy URL option. */
  existingToken?: string | null;
  defaultRecipientEmail?: string | null;
  defaultRecipientName?: string | null;
  companyName: string | null;
  /** Attachment-library files for the send picker (orders = library only). */
  libraryFiles: PickerFile[];
  /** True when the attachment library isn't in the company's plan. */
  libraryLocked: boolean;
  /** Templates for the send modal + follow-up builder. Passed from the
   *  server so the follow-up builder has them synchronously (the send
   *  form still lazy-loads via loadOrderTemplatesForSend as a fallback). */
  emailTemplates?: MessageTemplate[];
  /** Whether this company's plan includes scheduled follow-ups. */
  canFollowups?: boolean;
}

interface MessageTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  is_default: boolean | null;
  attachment_id?: string | null;
}

/**
 * Send Order modal mirroring the Send Quote modal's three-option chooser:
 *
 *   1. Send from QuoteCore+  - email the supplier directly via the
 *      Messages pipeline (branded with the user's company).
 *   2. Copy URL Link         - generate /orders/<token>, copy to
 *      clipboard. Replaces the standalone "Supplier Link" pill that
 *      used to live on the preview top bar (removed 2026-05-12).
 *   3. Create new template   - redirect the user to the Templates page
 *      with a `?return=` query param so they can come back to this
 *      order once they've saved their template.
 *
 * Each mode is rendered inside the same modal shell so the user doesn't
 * lose context. Same UX shape as SendQuoteButton.
 */
type Mode = 'choose' | 'send' | 'url' | 'create-template-redirect';

export function SendOrderButton({
  orderId,
  orderNumber,
  workspaceSlug,
  existingToken,
  defaultRecipientEmail,
  defaultRecipientName,
  companyName,
  libraryFiles,
  libraryLocked,
  emailTemplates = [],
  canFollowups = false,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('choose');

  // Send-mode state. Seed from the server-provided templates so the
  // follow-up builder has them immediately; the lazy load still runs to
  // pick up any created after mount.
  const [templates, setTemplates] = useState<MessageTemplate[]>(emailTemplates);
  const [templatesLoaded, setTemplatesLoaded] = useState(emailTemplates.length > 0);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipientEmail, setRecipientEmail] = useState(defaultRecipientEmail ?? '');
  // Send-time attachment selection (orders: library files only). IDs only.
  const [attachmentSelection, setAttachmentSelection] = useState<AttachmentSelection>({
    libraryAttachmentIds: [],
    quoteFileIds: [],
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<'sent' | 'suppressed' | null>(null);
  const [isPending, startTransition] = useTransition();

  // URL-mode state.
  const [token, setToken] = useState<string | null>(existingToken ?? null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // --- PRE-SEND follow-up flow (mirrors SendQuoteButton) -------------
  // 'form' = compose, 'gate' = Send-now vs Add-follow-ups, 'followups'
  // = the rule builder.
  type SendStage = 'form' | 'gate' | 'followups';
  const [sendStage, setSendStage] = useState<SendStage>('form');

  // Order follow-up rules. Triggered options are order_accepted /
  // order_declined / order_viewed ("On Read"). Time-based maps to 'order_sent'.
  // order_viewed parks until the supplier opens the order, then fires after
  // the configured delay, and is cancelled if they accept/decline/request info.
  type FollowUpKind = 'triggered' | 'time_based';
  type TriggerChoice = 'order_accepted' | 'order_declined' | 'order_viewed';
  type DraftRule = {
    id: string;
    kind: FollowUpKind;
    trigger: TriggerChoice;
    addDelay: boolean;
    delayDays: number;
    delayHours: number;
    delayMinutes: number;
    templateId: string;
    result: { ok: true; fireAt: string } | { ok: false; error: string } | null;
  };
  const [draftRules, setDraftRules] = useState<DraftRule[]>([]);
  const [followUpSaving, setFollowUpSaving] = useState(false);
  const [followUpError, setFollowUpError] = useState<string | null>(null);

  function defaultTemplateId(): string {
    const def = templates.find((t) => t.is_default) || templates[0];
    return def?.id ?? selectedTemplateId ?? '';
  }

  function addDraftRule(kind: FollowUpKind) {
    setFollowUpError(null);
    if (draftRules.length >= 3) {
      setFollowUpError('You can add at most 3 follow-ups per order.');
      return;
    }
    if (kind === 'triggered') {
      const all: TriggerChoice[] = ['order_accepted', 'order_declined', 'order_viewed'];
      const used = new Set(draftRules.filter((r) => r.kind === 'triggered').map((r) => r.trigger));
      const free = all.find((t) => !used.has(t));
      if (!free) {
        setFollowUpError('Both order triggers already have a follow-up.');
        return;
      }
      setDraftRules((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          kind: 'triggered',
          trigger: free,
          addDelay: false,
          delayDays: 0,
          delayHours: 0,
          delayMinutes: 0,
          templateId: defaultTemplateId(),
          result: null,
        },
      ]);
    } else {
      setDraftRules((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          kind: 'time_based',
          trigger: 'order_accepted', // unused for time_based
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

  // Prefill subject/body the first time the user enters Send mode when
  // templates were seeded from props (so the lazy loader below is
  // skipped). Only runs while the compose form is empty so we never
  // clobber the user's edits.
  useEffect(() => {
    if (mode !== 'send' || subject || body) return;
    const def = templates.find((t) => t.is_default) || templates[0];
    if (def) {
      setSelectedTemplateId(def.id);
      setSubject(def.subject);
      setBody(def.body);
    } else {
      setSubject(`Order ${orderNumber}${companyName ? ` from ${companyName}` : ''}`);
      setBody(
        `Hi${defaultRecipientName ? ` ${defaultRecipientName}` : ''},\n\nPlease review our order ${orderNumber}. You can confirm, request changes, or ask a question using the button below.\n\nThanks.`,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Lazy fallback: when templates weren't seeded from props, load them
  // on entering Send mode (legacy path).
  useEffect(() => {
    if (mode !== 'send' || templatesLoaded) return;
    loadOrderTemplatesForSend()
      .then((rows) => {
        setTemplates(rows);
        setTemplatesLoaded(true);
        const def = rows.find((r) => r.is_default) || rows[0];
        if (def) {
          setSelectedTemplateId(def.id);
          setSubject(def.subject);
          setBody(def.body);
        } else {
          setSubject(
            `Order ${orderNumber}${companyName ? ` from ${companyName}` : ''}`,
          );
          setBody(
            `Hi${defaultRecipientName ? ` ${defaultRecipientName}` : ''},\n\nPlease review our order ${orderNumber}. You can confirm, request changes, or ask a question using the button below.\n\nThanks.`,
          );
        }
      })
      .catch(() => setTemplatesLoaded(true));
  }, [mode, templatesLoaded, orderNumber, companyName, defaultRecipientName]);

  // Mint the supplier token when the user enters URL mode.
  //
  // We defer the initial `setTokenLoading(true)` + `setError(null)`
  // mutations into a microtask so the `react-hooks/set-state-in-effect`
  // lint rule (Next 16) doesn't flag synchronous state mutation during
  // effect setup. The behaviour is unchanged because microtasks fire
  // before the next paint.
  useEffect(() => {
    if (mode !== 'url' || token || tokenLoading) return;
    queueMicrotask(() => {
      setTokenLoading(true);
      setError(null);
    });
    generateOrderSupplierToken(orderId)
      .then((t) => setToken(t))
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Could not generate link.'),
      )
      .finally(() => setTokenLoading(false));
  }, [mode, orderId, token, tokenLoading]);

  function handleTemplateChange(id: string) {
    setSelectedTemplateId(id);
    const tpl = templates.find((t) => t.id === id);
    if (tpl) {
      setSubject(tpl.subject);
      setBody(tpl.body);
    }
  }

  /** Validate the compose form before any send / gate decision. */
  function validateComposeForm(): boolean {
    setError(null);
    setSuccess(null);
    if (!recipientEmail.trim()) {
      setError('Please enter a recipient email.');
      return false;
    }
    if (!subject.trim() || !body.trim()) {
      setError('Subject and body cannot be empty.');
      return false;
    }
    return true;
  }

  /** Compose -> gate. */
  function handleProceedToGate() {
    if (!validateComposeForm()) return;
    setSendStage('gate');
  }

  /** Run the actual order send. Shared by both gate branches. */
  function runSend(): Promise<{ ok: boolean }> {
    return new Promise((resolve) => {
      startTransition(async () => {
        const result = await sendOrderMessage({
          orderId,
          templateId: selectedTemplateId || null,
          subject,
          body,
          recipientEmail: recipientEmail.trim(),
          recipientName: defaultRecipientName ?? null,
          attachmentSelection,
        });
        if (result.ok) {
          setSuccess(result.status);
        } else {
          setError(result.error);
        }
        resolve({ ok: result.ok });
      });
    });
  }

  /** Gate branch A: send now, no follow-ups. */
  async function handleSendNow() {
    setError(null);
    setSuccess(null);
    await runSend();
    setSendStage('form');
  }

  /** Gate branch B: open the builder empty. */
  function handleOpenFollowUps() {
    setFollowUpError(null);
    setSendStage('followups');
  }

  /** Persist each draft rule via scheduleOrderFollowUp, THEN send. */
  async function handleConfirmFollowUpsAndSend() {
    setFollowUpError(null);
    const rules = draftRules.filter((r) => r.templateId);
    if (rules.length === 0) {
      setFollowUpError('Add at least one follow-up, or go back and choose “Send now”.');
      return;
    }
    setFollowUpSaving(true);
    try {
      let anyError = false;
      for (const rule of rules) {
        const isTriggered = rule.kind === 'triggered';
        const triggerEvent = isTriggered ? rule.trigger : 'order_sent';
        const waitDays = isTriggered ? (rule.addDelay ? rule.delayDays : 0) : rule.delayDays;
        const waitHours = isTriggered ? (rule.addDelay ? rule.delayHours : 0) : rule.delayHours;
        const waitMinutes = isTriggered ? (rule.addDelay ? rule.delayMinutes : 0) : rule.delayMinutes;
        const result = await scheduleOrderFollowUp({
          orderId,
          templateId: rule.templateId,
          triggerEvent,
          waitDays,
          waitHours,
          waitMinutes,
          // Time-based chase cancels on supplier response; triggered rules
          // never gate on it (the event IS the response).
          requireNoResponse: !isTriggered,
          respectQuietHours: true,
          recipientEmail: recipientEmail.trim(),
          recipientName: defaultRecipientName ?? null,
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

  async function copyUrl() {
    if (!token) return;
    const url = `${window.location.origin}/orders/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers.
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function goCreateTemplate() {
    // Open the templates page on the Message tab. The query params for
    // `kind=` (prefill the template kind) and `return=` (back-nav after
    // save) are not yet wired in TemplatesPageClient - they’re here so
    // the navigation intent is captured for the Phase 2 wiring without
    // breaking the current URL.
    const returnPath = encodeURIComponent(
      `/${workspaceSlug}/material-orders/${orderId}/preview`,
    );
    router.push(`/${workspaceSlug}/resources?tab=email&kind=order_send&return=${returnPath}`);
  }

  const orderUrl = token ? `${typeof window !== 'undefined' ? window.location.origin : ''}/orders/${token}` : null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setMode('choose');
          setError(null);
          setSuccess(null);
          setCopied(false);
          setSendStage('form');
          setDraftRules([]);
          setFollowUpError(null);
        }}
        className="px-4 py-2 text-sm font-medium rounded-full bg-orange-500 text-white hover:bg-orange-600 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
      >
        Send Order
      </button>

      {open ? (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 data-exclude-pdf">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">
                {mode === 'choose'
                  ? 'Send Order to Supplier'
                  : mode === 'send'
                    ? 'Send from QuoteCore+'
                    : 'Copy Supplier Link'}
              </h3>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 text-xl">
                ✕
              </button>
            </div>

            {/* Choose Mode */}
            {mode === 'choose' ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">How would you like to send this order?</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    onClick={() => setMode('send')}
                    className="p-4 rounded-xl border-2 border-orange-300 bg-orange-50/50 hover:border-orange-400 hover:bg-orange-50 transition text-left space-y-2"
                  >
                    <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                      <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                        <path d="M22 2 11 13" />
                        <path d="M22 2 15 22l-4-9-9-4 20-7Z" />
                      </svg>
                    </div>
                    <h4 className="text-sm font-semibold text-slate-900">Send from QuoteCore+</h4>
                    <p className="text-xs text-slate-500">
                      {templates.length > 0
                        ? 'Use a template, branded as your company'
                        : 'Email the supplier directly from the app'}
                    </p>
                  </button>

                  <button
                    onClick={() => setMode('url')}
                    className="p-4 rounded-xl border-2 border-slate-200 hover:border-orange-300 hover:bg-orange-50/50 transition text-left space-y-2"
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                      <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                    </div>
                    <h4 className="text-sm font-semibold text-slate-900">Copy URL Link</h4>
                    <p className="text-xs text-slate-500">Generate a supplier link and paste it anywhere</p>
                  </button>

                  <button
                    onClick={goCreateTemplate}
                    className="p-4 rounded-xl border-2 border-slate-200 hover:border-orange-300 hover:bg-orange-50/50 transition text-left space-y-2"
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                      <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </div>
                    <h4 className="text-sm font-semibold text-slate-900">Create new template</h4>
                    <p className="text-xs text-slate-500">Build a reusable order email template</p>
                  </button>
                </div>
              </div>
            ) : null}

            {/* Send Mode */}
            {mode === 'send' ? (
              <div className="space-y-4">
                <p className="text-sm text-slate-600">
                  We&apos;ll email the supplier directly from QuoteCore+, branded as your
                  company. Replies come back as in-app alerts.
                </p>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Recipient email</label>
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="supplier@example.com"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
                  />
                </div>

                {templates.length > 0 ? (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Message Template</label>
                    <select
                      value={selectedTemplateId}
                      onChange={(e) => handleTemplateChange(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
                    >
                      <option value="">- None (custom message) -</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                          {t.is_default ? ' (Default)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : templatesLoaded ? (
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-xs text-slate-500">
                      No templates yet. Type a one-off message below, or
                      <button
                        onClick={goCreateTemplate}
                        className="text-orange-600 hover:underline font-medium ml-1"
                      >
                        create a template
                      </button>{' '}
                      for faster future sends.
                    </p>
                  </div>
                ) : null}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Message</label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={10}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    The supplier sees a &ldquo;View order&rdquo; button below your text that opens the full order in their browser.
                  </p>
                </div>

                {/* Attachments picker. Orders attach library files only; the
                    supplier downloads them from the order page. */}
                <AttachmentSendPicker
                  libraryFiles={libraryFiles}
                  quoteFiles={[]}
                  selection={attachmentSelection}
                  onChange={setAttachmentSelection}
                  libraryLocked={libraryLocked}
                />

                {error ? <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2">{error}</p> : null}
                {success === 'sent' ? (
                  <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-2">
                    Order sent. Replies will arrive as in-app alerts.
                  </p>
                ) : null}
                {success === 'suppressed' ? (
                  <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-2">
                    This recipient is on your suppression list, so the message was blocked. The send is logged but no email was dispatched.
                  </p>
                ) : null}

                {/* PRE-SEND GATE: Send now vs Add Follow-ups. */}
                {sendStage === 'gate' && success !== 'sent' ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
                    <p className="text-sm font-medium text-slate-900">Before we send — do you want follow-ups?</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={handleSendNow}
                        disabled={isPending}
                        title="No follow-ups needed"
                        className="p-4 rounded-xl border-2 border-slate-200 bg-white hover:border-orange-300 hover:bg-orange-50/40 transition text-left space-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="w-9 h-9 rounded-full bg-black flex items-center justify-center">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
                          </svg>
                        </div>
                        <h4 className="text-sm font-semibold text-slate-900">{isPending ? 'Sending…' : 'Send now'}</h4>
                        <p className="text-xs text-slate-500">No follow-ups needed</p>
                      </button>

                      <button
                        type="button"
                        onClick={handleOpenFollowUps}
                        disabled={isPending || !canFollowups}
                        title={canFollowups ? 'Then send' : 'Automated follow-ups are not included in your current plan'}
                        className="p-4 rounded-xl border-2 border-orange-300 bg-orange-50/50 hover:border-orange-400 hover:bg-orange-50 transition text-left space-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="w-9 h-9 rounded-full bg-[#FF6B35] flex items-center justify-center">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <h4 className="text-sm font-semibold text-slate-900">Add Follow-ups</h4>
                        <p className="text-xs text-slate-500">{canFollowups ? 'Then send' : 'Pro plan feature'}</p>
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSendStage('form')}
                      className="text-sm text-slate-500 hover:text-slate-700"
                    >
                      ← Back to message
                    </button>
                  </div>
                ) : null}

                {/* FOLLOW-UP BUILDER. Order triggers: accepted / declined only
                    (no info-requested — that cancels follow-ups). Time-based
                    chase maps to order_sent. */}
                {sendStage === 'followups' && success !== 'sent' ? (
                  <div className="rounded-xl border border-orange-200 bg-orange-50/60 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-900">Add follow-ups</p>
                      <span className="text-xs text-slate-500">{draftRules.length} / 3</span>
                    </div>

                    {templates.length === 0 ? (
                      <div className="rounded-lg border border-slate-200 bg-white p-3">
                        <p className="text-xs text-slate-500">You have no message templates yet — follow-ups need one.</p>
                        <button onClick={goCreateTemplate} className="mt-2 text-xs font-medium text-orange-600 hover:text-orange-700 underline">
                          Create your first follow-up template
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => addDraftRule('triggered')}
                            disabled={draftRules.length >= 3}
                            className="px-3 py-1.5 text-xs font-semibold rounded-full bg-black text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_12px_rgba(255,107,53,0.5)] ring-2 ring-transparent hover:ring-orange-400/30 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            + Triggered follow-up
                          </button>
                          <button
                            type="button"
                            onClick={() => addDraftRule('time_based')}
                            disabled={draftRules.length >= 3}
                            className="px-3 py-1.5 text-xs font-semibold rounded-full bg-black text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_12px_rgba(255,107,53,0.5)] ring-2 ring-transparent hover:ring-orange-400/30 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            + Time-based follow-up
                          </button>
                        </div>

                        {draftRules.length === 0 ? (
                          <p className="text-[11px] text-slate-500">
                            Add a follow-up above — choose a trigger-based rule (fires when the supplier accepts or declines) or a time-based chase. You can add up to 3.
                          </p>
                        ) : null}

                        {draftRules.map((rule) => {
                          const isTriggered = rule.kind === 'triggered';
                          const isErr = rule.result && !rule.result.ok;
                          const isOk = rule.result?.ok === true;
                          return (
                            <div
                              key={rule.id}
                              className={`rounded-xl border p-3 space-y-2 ${
                                isOk ? 'border-emerald-200 bg-emerald-50' : isErr ? 'border-rose-200 bg-rose-50/60' : 'border-slate-200 bg-white'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-semibold text-slate-900">
                                  {isTriggered ? 'Triggered follow-up' : 'Time-based follow-up'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removeDraftRule(rule.id)}
                                  className="text-slate-400 hover:text-rose-600 text-sm leading-none p-1"
                                  aria-label="Remove follow-up"
                                >
                                  ✕
                                </button>
                              </div>

                              {isTriggered ? (
                                <div className="space-y-2">
                                  <div>
                                    <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Trigger event</label>
                                    <select
                                      value={rule.trigger}
                                      onChange={(e) => updateDraftRule(rule.id, { trigger: e.target.value as TriggerChoice })}
                                      className="w-full text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white"
                                    >
                                      {(['order_accepted', 'order_declined', 'order_viewed'] as const).map((t) => {
                                        const tlabel = t === 'order_accepted' ? 'Order accepted' : t === 'order_declined' ? 'Order declined' : 'On read (opened, no response)';
                                        const usedElsewhere = draftRules.some((r) => r.id !== rule.id && r.kind === 'triggered' && r.trigger === t);
                                        return (
                                          <option key={t} value={t} disabled={usedElsewhere}>
                                            {tlabel}{usedElsewhere ? ' (already added)' : ''}
                                          </option>
                                        );
                                      })}
                                    </select>
                                  </div>
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={rule.addDelay}
                                      onChange={(e) => updateDraftRule(rule.id, { addDelay: e.target.checked })}
                                      className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                                    />
                                    <span className="text-xs text-slate-700">Add time delay (otherwise fires immediately)</span>
                                  </label>
                                  {rule.addDelay ? (
                                    <div className="flex items-end gap-2">
                                      <div className="w-24">
                                        <label className="block text-[10px] font-medium text-slate-500 mb-0.5"># days</label>
                                        <input
                                          type="number" min={0} max={365}
                                          value={rule.delayDays}
                                          onChange={(e) => updateDraftRule(rule.id, { delayDays: Math.max(0, Math.min(365, Number(e.target.value) || 0)) })}
                                          className="w-full text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white"
                                        />
                                      </div>
                                      <div className="w-24">
                                        <label className="block text-[10px] font-medium text-slate-500 mb-0.5"># hours</label>
                                        <input
                                          type="number" min={0} max={23}
                                          value={rule.delayHours}
                                          onChange={(e) => updateDraftRule(rule.id, { delayHours: Math.max(0, Math.min(23, Number(e.target.value) || 0)) })}
                                          className="w-full text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white"
                                        />
                                      </div>
                                      <div className="w-24">
                                        <label className="block text-[10px] font-medium text-slate-500 mb-0.5"># minutes</label>
                                        <input
                                          type="number" min={0} max={59}
                                          value={rule.delayMinutes}
                                          onChange={(e) => updateDraftRule(rule.id, { delayMinutes: Math.max(0, Math.min(59, Number(e.target.value) || 0)) })}
                                          className="w-full text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white"
                                        />
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <p className="text-[11px] text-slate-500">Chases the supplier if they don’t respond. Auto-cancels when they accept, decline, or request info. Respects quiet hours.</p>
                                  <div className="flex items-end gap-2">
                                    <div className="w-24">
                                      <label className="block text-[10px] font-medium text-slate-500 mb-0.5"># days</label>
                                      <input
                                        type="number" min={0} max={365}
                                        value={rule.delayDays}
                                        onChange={(e) => updateDraftRule(rule.id, { delayDays: Math.max(0, Math.min(365, Number(e.target.value) || 0)) })}
                                        className="w-full text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white"
                                      />
                                    </div>
                                    <div className="w-24">
                                      <label className="block text-[10px] font-medium text-slate-500 mb-0.5"># hours</label>
                                      <input
                                        type="number" min={0} max={23}
                                        value={rule.delayHours}
                                        onChange={(e) => updateDraftRule(rule.id, { delayHours: Math.max(0, Math.min(23, Number(e.target.value) || 0)) })}
                                        className="w-full text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white"
                                      />
                                    </div>
                                    <div className="w-24">
                                      <label className="block text-[10px] font-medium text-slate-500 mb-0.5"># minutes</label>
                                      <input
                                        type="number" min={0} max={59}
                                        value={rule.delayMinutes}
                                        onChange={(e) => updateDraftRule(rule.id, { delayMinutes: Math.max(0, Math.min(59, Number(e.target.value) || 0)) })}
                                        className="w-full text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white"
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}

                              <div>
                                <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Template</label>
                                <select
                                  value={rule.templateId}
                                  onChange={(e) => updateDraftRule(rule.id, { templateId: e.target.value })}
                                  className="w-full text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white"
                                >
                                  {templates.map((t) => (
                                    <option key={t.id} value={t.id}>{t.name}{t.is_default ? ' (Default)' : ''}</option>
                                  ))}
                                </select>
                              </div>

                              {isOk ? <p className="text-[10px] text-emerald-700">Scheduled ✓</p> : null}
                              {isErr ? <p className="text-[11px] text-rose-700">{(rule.result as { ok: false; error: string }).error}</p> : null}
                            </div>
                          );
                        })}
                      </>
                    )}

                    {followUpError ? (
                      <p className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2">{followUpError}</p>
                    ) : null}

                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => setSendStage('gate')}
                        className="text-sm text-slate-500 hover:text-slate-700"
                      >
                        ← Back
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmFollowUpsAndSend}
                        disabled={followUpSaving || isPending || templates.length === 0 || draftRules.length === 0}
                        className="px-4 py-2 text-sm font-medium rounded-full bg-[#FF6B35] text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
                      >
                        {followUpSaving || isPending ? 'Saving & sending…' : 'Save follow-ups & send'}
                      </button>
                    </div>
                  </div>
                ) : null}

                {/* Compose-stage footer: opens the pre-send gate (does not
                    send directly). Hidden once gate/builder is showing or
                    after a successful send. */}
                {sendStage === 'form' ? (
                  <div className="flex items-center justify-between pt-2">
                    <button onClick={() => setMode('choose')} className="text-sm text-slate-500 hover:text-slate-700">
                      ← Back to options
                    </button>
                    {success !== 'sent' ? (
                      <button
                        onClick={handleProceedToGate}
                        disabled={isPending}
                        className="px-4 py-2 text-sm font-medium rounded-full bg-black text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
                      >
                        Continue
                      </button>
                    ) : (
                      <button
                        onClick={() => setOpen(false)}
                        className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50"
                      >
                        Close
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* URL Mode */}
            {mode === 'url' ? (
              <div className="space-y-4">
                <p className="text-sm text-slate-600">
                  Share this link with the supplier. They&apos;ll see the full order and can
                  confirm, request changes, or ask a question. Responses come back as in-app alerts.
                </p>

                {error ? <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2">{error}</p> : null}

                {tokenLoading && !orderUrl ? (
                  <div className="py-8 text-center text-slate-500 text-sm">Generating link…</div>
                ) : orderUrl ? (
                  <>
                    <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <input
                        type="text"
                        readOnly
                        value={orderUrl}
                        className="flex-1 text-sm text-slate-700 bg-transparent border-none outline-none truncate"
                      />
                      <button
                        onClick={copyUrl}
                        className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                          copied
                            ? 'bg-emerald-500 text-white'
                            : 'bg-black text-white hover:bg-slate-800 hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]'
                        }`}
                      >
                        {copied ? '✓ Copied!' : 'Copy URL'}
                      </button>
                    </div>
                    <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                      <p className="text-xs text-orange-700">
                        <strong>Note:</strong> Anyone with this link can view the order and respond.
                        Only share it with the intended supplier.
                      </p>
                    </div>
                  </>
                ) : null}

                <div className="flex items-center justify-between pt-2">
                  <button onClick={() => setMode('choose')} className="text-sm text-slate-500 hover:text-slate-700">
                    ← Back to options
                  </button>
                  <button
                    onClick={() => setOpen(false)}
                    className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
