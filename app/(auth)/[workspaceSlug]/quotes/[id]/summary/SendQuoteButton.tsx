'use client';
import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { generateAcceptanceToken } from '../../actions';
import { sendQuoteMessage } from './send-message-actions';
import { scheduleQuoteFollowUp } from '@/app/lib/messages/scheduled';
import {
  AttachmentSendPicker,
  type PickerFile,
  type AttachmentSelection,
} from '@/app/components/attachments/AttachmentSendPicker';
import { useSendTestTip } from '@/app/components/send/sendTestTip';
import { SendTestTipModal } from '@/app/components/send/SendTestTipModal';

/**
 * Subset of the email_templates row used by SendQuoteButton. Nullability
 * matches the DB.
 */
interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  is_default: boolean | null;
  /** Phase 4 baked default attachment (library file id). Pre-checks in the
   *  send picker when this template is selected. */
  attachment_id?: string | null;
}

interface Props {
  quoteId: string;
  workspaceSlug: string;
  existingToken: string | null;
  hasCustomerQuote: boolean;
  emailTemplates: EmailTemplate[];
  /** Whether this company's plan includes scheduled follow-up messages.
   *  Pro+ only. When false the post-send follow-up prompt is hidden. */
  canFollowups: boolean;
  /** Whether this company can send via QCP email (drives the test-tip copy). */
  canEmail: boolean;
  /** Whether THIS user has already seen the one-time "test it first" send tip. */
  sendTestTipSeen: boolean;
  /** Company attachment-library files (IDs only). Empty when not entitled. */
  libraryFiles: PickerFile[];
  /** This quote's own files (all tiers). */
  quoteFiles: PickerFile[];
  /** True when the attachment library is not in the company's plan. */
  libraryLocked: boolean;
  quoteMeta: {
    customerName: string;
    quoteNumber: number | null;
    jobName: string | null;
    companyName: string | null;
    quoteDate: string;
  };
}

function sanitize(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function replacePlaceholders(text: string, data: Record<string, string>): string {
  return text
    .replace(/\{\{customer_name\}\}/g, sanitize(data.customer_name || ''))
    .replace(/\{\{quote_number\}\}/g, sanitize(data.quote_number || ''))
    .replace(/\{\{job_name\}\}/g, sanitize(data.job_name || ''))
    .replace(/\{\{quote_url\}\}/g, data.quote_url || '') // URL not sanitized (needs to be clickable)
    .replace(/\{\{company_name\}\}/g, sanitize(data.company_name || ''))
    .replace(/\{\{quote_date\}\}/g, sanitize(data.quote_date || ''));
}

export function SendQuoteButton({ quoteId, workspaceSlug, existingToken, hasCustomerQuote, emailTemplates, canFollowups, canEmail, sendTestTipSeen, libraryFiles, quoteFiles, libraryLocked, quoteMeta }: Props) {
  const router = useRouter();
  const testTip = useSendTestTip(sendTestTipSeen);
  // When the one-time tip needs showing, the first "Send Quote" click opens the
  // tip instead of the send modal; "Got it" marks it seen and proceeds.
  const [showTestTip, setShowTestTip] = useState(false);

  /**
   * Open the Templates page on the Message tab so the user can build
   * a reusable quote_send template. The `kind` + `return` query params
   * are aspirational - the TemplatesPageClient currently honours `tab`
   * but not the others; they're recorded in the URL so the Phase 2
   * wiring can pick them up without breaking the navigation now.
   */
  function goCreateTemplate() {
    const returnPath = encodeURIComponent(
      `/${workspaceSlug}/quotes/${quoteId}/summary`,
    );
    router.push(`/${workspaceSlug}/resources?tab=email&kind=quote_send&return=${returnPath}`);
  }
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'choose' | 'url' | 'email' | 'send'>('choose');
  const [token, setToken] = useState(existingToken);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Sync local token state to the server prop when it changes.
  // Without this, `router.refresh()` (used by ReopenQuoteButton, the
  // post-send prompt, etc.) re-runs the server component and updates
  // `existingToken` - but the client component's `token` state stays
  // stuck on whatever was first passed at mount. Result: after a
  // reopen, ensureToken() reuses the now-deleted token and the user
  // gets a "Quote Not Found" page. Mirror the prop into local state
  // whenever it changes so we always reflect DB truth.
  useEffect(() => {
    setToken(existingToken);
  }, [existingToken]);

  // Email mode state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailCopied, setEmailCopied] = useState(false);
  const [expiryDays, setExpiryDays] = useState<number>(30);

  // Send mode state (Messages pipeline). Reuses subject/body from email
  // mode so the user can flip between Copy and Send without retyping.
  const [recipientEmail, setRecipientEmail] = useState('');
  // Send-time attachment selection. Pre-checked from the chosen template's
  // baked attachment_id; the user can add/remove freely. IDs only.
  const [attachmentSelection, setAttachmentSelection] = useState<AttachmentSelection>({
    libraryAttachmentIds: [],
    quoteFileIds: [],
  });
  // Count URLs in the email body - more than 1 is a spam risk.
  const urlCountInBody = (emailBody.match(/https?:\/\/[^\s]+/gi) ?? []).length;
  const bodyHasExtraUrls = urlCountInBody > 1;

  const [sendError, setSendError] = useState<string | null>(null);
  // True when the server returned a plan-gate error. Disables the Send
  // button so the user can't re-submit a request that will always fail.
  const isPlanGated = sendError?.includes("isn't included in your current plan") ?? false;
  const [sendSuccess, setSendSuccess] = useState<'sent' | 'suppressed' | null>(null);
  const [isSending, startSendTransition] = useTransition();

  // --- PRE-SEND follow-up decision -----------------------------------
  // When the user hits "Send message" we no longer fire immediately.
  // We first present a gate with two choices:
  //   - "Send now"        -> existing send path, no follow-ups.
  //   - "Add Follow-ups"  -> open the follow-up builder modal; on
  //                          confirm we persist each rule via
  //                          scheduleQuoteFollowUp THEN run the send.
  //
  // `sendStage` drives which of those surfaces is showing inside the
  // send-mode panel: 'form' = the compose form, 'gate' = the two-choice
  // step, 'followups' = the rule builder.
  type SendStage = 'form' | 'gate' | 'followups';
  const [sendStage, setSendStage] = useState<SendStage>('form');

  // A single follow-up rule the user is building before send. Three
  // kinds map onto the scheduler's trigger events:
  //   - 'triggered' with triggerEvent quote_accepted/declined/revision
  //   - 'time_based' -> trigger_event quote_sent (chase, cancel on reply)
  type FollowUpKind = 'triggered' | 'time_based';
  type TriggerChoice = 'quote_accepted' | 'quote_declined' | 'quote_revision_requested' | 'quote_viewed';
  type DraftRule = {
    id: string;
    kind: FollowUpKind;
    // triggered-only
    trigger: TriggerChoice;
    addDelay: boolean; // triggered: reveal the delay inputs
    // shared delay (days/hours/minutes)
    delayDays: number;
    delayHours: number;
    delayMinutes: number;
    templateId: string;
    // result after persisting
    result: { ok: true; fireAt: string } | { ok: false; error: string } | null;
  };
  const [draftRules, setDraftRules] = useState<DraftRule[]>([]);
  const [followUpSaving, setFollowUpSaving] = useState(false);
  const [followUpError, setFollowUpError] = useState<string | null>(null);

  function defaultTemplateId(): string {
    const defaultTpl = emailTemplates.find((t) => t.is_default) || emailTemplates[0];
    return defaultTpl?.id ?? selectedTemplateId ?? '';
  }

  // Triggers already claimed by an existing draft rule (one rule per
  // trigger). Used to disable the option in the trigger picker.
  const usedTriggers = new Set(
    draftRules.filter((r) => r.kind === 'triggered').map((r) => r.trigger),
  );

  function addDraftRule(kind: FollowUpKind) {
    setFollowUpError(null);
    if (draftRules.length >= 3) {
      setFollowUpError('You can add at most 3 follow-ups per quote.');
      return;
    }
    if (kind === 'triggered') {
      // Pick the first trigger not already used.
      const all: TriggerChoice[] = ['quote_accepted', 'quote_declined', 'quote_revision_requested', 'quote_viewed'];
      const free = all.find((t) => !usedTriggers.has(t));
      if (!free) {
        setFollowUpError('All three triggers already have a follow-up.');
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
          trigger: 'quote_accepted', // unused for time_based
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

  // Close modal when copilot transition starts
  useEffect(() => {
    function handleClose() { setOpen(false); }
    window.addEventListener('copilot-close-modals', handleClose);
    return () => window.removeEventListener('copilot-close-modals', handleClose);
  }, []);

  if (!hasCustomerQuote) return null;

  const acceptanceUrl = token
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/accept/${token}`
    : null;

  async function ensureToken(): Promise<string | null> {
    if (token) return token;
    setLoading(true);
    try {
      const newToken = await generateAcceptanceToken(quoteId, expiryDays);
      setToken(newToken);
      return newToken;
    } catch (err) {
      console.error('Failed to generate acceptance token:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }

  function openSendModal() {
    setOpen(true);
    setMode('choose');
    setCopied(false);
    setEmailCopied(false);
  }

  async function handleOpen() {
    if (testTip.shouldShow) {
      setShowTestTip(true);
      return;
    }
    openSendModal();
  }

  function handleTestTipContinue() {
    testTip.markSeen();
    setShowTestTip(false);
    openSendModal();
  }

  function handleTestTipClose() {
    testTip.markSeen();
    setShowTestTip(false);
  }

  async function handleUrlMode() {
    setMode('url');
    await ensureToken();
  }

  async function handleSendMode() {
    // Use the same template-prefill as email mode so the user can flip
    // freely between the two.
    await handleEmailMode();
    setMode('send');
    setSendStage('form');
    setDraftRules([]);
    setFollowUpError(null);
    setSendError(null);
    setSendSuccess(null);
  }

  /** Validate the compose form before any send / gate decision. */
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

  /**
   * Step 1 of the pre-send flow: the user finished composing and hit
   * the primary button. Instead of sending straight away we show the
   * gate ("Send now" vs "Add Follow-ups").
   */
  function handleProceedToGate() {
    if (!validateComposeForm()) return;
    setSendStage('gate');
  }

  /** Run the actual quote send. Shared by both gate branches. Returns
   *  the send result so the caller can decide what to do next. */
  function runSend(): Promise<{ ok: boolean }> {
    return new Promise((resolve) => {
      startSendTransition(async () => {
        const result = await sendQuoteMessage({
          quoteId,
          templateId: selectedTemplateId || null,
          subject: emailSubject,
          body: emailBody,
          recipientEmail: recipientEmail.trim(),
          recipientName: quoteMeta.customerName,
          attachmentSelection,
        });
        if (result.ok) {
          setSendSuccess(result.status);
        } else {
          setSendError(result.error);
        }
        resolve({ ok: result.ok });
      });
    });
  }

  /** Gate branch A: "Send now" - no follow-ups, just send. */
  async function handleSendNow() {
    setSendError(null);
    setSendSuccess(null);
    await runSend();
    // Stay on the form stage so the success/suppressed banner shows.
    setSendStage('form');
  }

  /** Gate branch B: "Add Follow-ups" - open the builder EMPTY. The user
   *  explicitly adds a Triggered or Time-based rule first; we no longer
   *  pre-seed a rule. */
  function handleOpenFollowUps() {
    setFollowUpError(null);
    setSendStage('followups');
  }

  /**
   * Confirm the follow-up builder: persist each draft rule via
   * scheduleQuoteFollowUp, THEN run the normal send. Per-rule
   * success/error is surfaced inline. We send AFTER scheduling so a
   * scheduling failure (e.g. cap exceeded) doesn't leave a sent quote
   * with no follow-ups silently.
   */
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
        const triggerEvent = isTriggered ? rule.trigger : 'quote_sent';
        // Triggered rules: delay only when "Add time delay" ticked,
        // else fire immediately (0/0). Time-based: always a delay > 0.
        const waitDays = isTriggered ? (rule.addDelay ? rule.delayDays : 0) : rule.delayDays;
        const waitHours = isTriggered ? (rule.addDelay ? rule.delayHours : 0) : rule.delayHours;
        const waitMinutes = isTriggered ? (rule.addDelay ? rule.delayMinutes : 0) : rule.delayMinutes;
        const result = await scheduleQuoteFollowUp({
          quoteId,
          templateId: rule.templateId,
          triggerEvent,
          waitDays,
          waitHours,
          waitMinutes,
          // Time-based chase cancels if the customer responds; triggered
          // rules never gate on response (the event IS the response).
          requireNoResponse: !isTriggered,
          respectQuietHours: true,
          recipientEmail: recipientEmail.trim(),
          recipientName: quoteMeta.customerName || null,
        });
        updateDraftRule(rule.id, {
          result: result.ok
            ? { ok: true as const, fireAt: result.fireAt }
            : { ok: false as const, error: result.error },
        });
        if (!result.ok) anyError = true;
      }
      // Only run the send once all rules are persisted. If any rule
      // errored we keep the modal open so the user sees which failed
      // and can fix it; we do NOT send in that case.
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

  async function handleEmailMode() {
    const t = await ensureToken();
    if (!t) return;

    const url = `${window.location.origin}/accept/${t}`;
    const data: Record<string, string> = {
      customer_name: quoteMeta.customerName,
      quote_number: quoteMeta.quoteNumber ? `${quoteMeta.quoteNumber}` : '',
      job_name: quoteMeta.jobName || '',
      quote_url: url,
      company_name: quoteMeta.companyName || '',
      quote_date: quoteMeta.quoteDate,
    };

    // Auto-select default template if available
    const defaultTemplate = emailTemplates.find(t => t.is_default) || emailTemplates[0];
    if (defaultTemplate) {
      setSelectedTemplateId(defaultTemplate.id);
      setEmailSubject(replacePlaceholders(defaultTemplate.subject, data));
      setEmailBody(replacePlaceholders(defaultTemplate.body, data));
      prefillAttachmentFromTemplate(defaultTemplate);
    } else {
      setSelectedTemplateId('');
      setEmailSubject(`Quote #${quoteMeta.quoteNumber} from ${quoteMeta.companyName || 'us'}`);
      setEmailBody(`Hi ${quoteMeta.customerName},\n\nPlease find your quote at the following link:\n\n${url}\n\nKind regards`);
    }

    setMode('email');
  }

  // Pre-check the template's baked attachment (Phase 4) in the send picker
  // when it exists + is in this company's active library. Replaces any prior
  // library pre-selection so switching templates swaps the baked file rather
  // than accumulating; the user's quote-file picks are preserved.
  function prefillAttachmentFromTemplate(template: EmailTemplate | undefined) {
    const bakedId = template?.attachment_id ?? null;
    const inLibrary = bakedId ? libraryFiles.some((f) => f.id === bakedId) : false;
    setAttachmentSelection((prev) => ({
      ...prev,
      libraryAttachmentIds: inLibrary && bakedId ? [bakedId] : [],
    }));
  }

  function handleTemplateChange(templateId: string) {
    setSelectedTemplateId(templateId);
    prefillAttachmentFromTemplate(emailTemplates.find(t => t.id === templateId));
    const template = emailTemplates.find(t => t.id === templateId);
    if (template && token) {
      const url = `${window.location.origin}/accept/${token}`;
      const data: Record<string, string> = {
        customer_name: quoteMeta.customerName,
        quote_number: quoteMeta.quoteNumber ? `${quoteMeta.quoteNumber}` : '',
        job_name: quoteMeta.jobName || '',
        quote_url: url,
        company_name: quoteMeta.companyName || '',
        quote_date: quoteMeta.quoteDate,
      };
      setEmailSubject(replacePlaceholders(template.subject, data));
      setEmailBody(replacePlaceholders(template.body, data));
    }
  }

  async function handleCopyUrl() {
    if (!acceptanceUrl) return;
    try {
      await navigator.clipboard.writeText(acceptanceUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.createElement('input');
      input.value = acceptanceUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function handleCopyEmail() {
    const fullEmail = `Subject: ${emailSubject}\n\n${emailBody}`;
    try {
      await navigator.clipboard.writeText(fullEmail);
      setEmailCopied(true);
      setTimeout(() => setEmailCopied(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = fullEmail;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setEmailCopied(true);
      setTimeout(() => setEmailCopied(false), 2000);
    }
  }

  return (
    <>
      <button
        onClick={handleOpen}
        data-copilot="send-quote"
        className="px-4 py-2 text-sm font-medium rounded-full bg-orange-500 text-white hover:bg-orange-600 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
      >
        Send Quote
      </button>

      {showTestTip && (
        <SendTestTipModal
          docType="quote"
          canEmail={canEmail}
          onContinue={handleTestTipContinue}
          onClose={handleTestTipClose}
        />
      )}

      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto space-y-4" data-copilot="cl-send-modal">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">
                {mode === 'choose' ? 'Send Quote to Customer' :
                 mode === 'url' ? 'Copy Acceptance Link' :
                 mode === 'send' ? 'Send from QuoteCore+' :
                 'Generate Email'}
              </h3>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>

            {loading && (
              <div className="py-8 text-center text-slate-500">Generating acceptance link...</div>
            )}

            {/* Choose Mode */}
            {mode === 'choose' && !loading && (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">How would you like to send this quote?</p>

                {/* Quote Expiry */}
                {!token && (
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <label className="text-sm font-medium text-slate-700 whitespace-nowrap">Link expires in:</label>
                    <select
                      value={expiryDays}
                      onChange={(e) => setExpiryDays(Number(e.target.value))}
                      className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white"
                    >
                      <option value={7}>7 days</option>
                      <option value={14}>14 days</option>
                      <option value={30}>30 days</option>
                      <option value={60}>60 days</option>
                      <option value={90}>90 days</option>
                      <option value={180}>180 days</option>
                      <option value={365}>1 year</option>
                    </select>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <button
                    onClick={handleSendMode}
                    data-copilot="cl-send-option"
                    className="p-4 rounded-xl border-2 border-orange-300 bg-orange-50/50 hover:border-orange-400 hover:bg-orange-50 transition text-left space-y-2"
                  >
                    <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                      {/* Paper-plane / send icon. The earlier path was Heroicons' "flag"
                          variant which read as a warning triangle in context. */}
                      <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                        <path d="M22 2 11 13" />
                        <path d="M22 2 15 22l-4-9-9-4 20-7Z" />
                      </svg>
                    </div>
                    <h4 className="text-sm font-semibold text-slate-900">Send from QuoteCore+</h4>
                    <p className="text-xs text-slate-500">Email the customer directly from the app, branded as your company</p>
                  </button>

                  <button
                    onClick={handleUrlMode}
                    data-copilot="cl-copy-url-option"
                    className="p-4 rounded-xl border-2 border-slate-200 hover:border-orange-300 hover:bg-orange-50/50 transition text-left space-y-2"
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                      <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                    </div>
                    <h4 className="text-sm font-semibold text-slate-900">Copy URL Link</h4>
                    <p className="text-xs text-slate-500">Generate a link and paste it anywhere</p>
                  </button>

                  <button
                    onClick={handleEmailMode}
                    data-copilot="cl-email-option"
                    className="p-4 rounded-xl border-2 border-slate-200 hover:border-orange-300 hover:bg-orange-50/50 transition text-left space-y-2"
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                      <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <h4 className="text-sm font-semibold text-slate-900">Generate Email</h4>
                    <p className="text-xs text-slate-500">
                      {emailTemplates.length > 0
                        ? 'Use a template, copy text to your own email client'
                        : 'Create email text to paste into your own client'}
                    </p>
                  </button>

                  <button
                    onClick={goCreateTemplate}
                    data-copilot="cl-create-template-option"
                    className="p-4 rounded-xl border-2 border-slate-200 hover:border-orange-300 hover:bg-orange-50/50 transition text-left space-y-2"
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                      <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </div>
                    <h4 className="text-sm font-semibold text-slate-900">Create new template</h4>
                    <p className="text-xs text-slate-500">Build a reusable quote email template</p>
                  </button>
                </div>
              </div>
            )}

            {/* URL Mode */}
            {mode === 'url' && !loading && acceptanceUrl && (
              <div data-copilot="cl-url-mode">
                <p className="text-sm text-slate-600">
                  Paste this URL into a message or email to the intended customer. When they open it, they&apos;ll see your customer quote and can accept or decline it.
                </p>

                <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <input
                    type="text"
                    readOnly
                    value={acceptanceUrl}
                    className="flex-1 text-sm text-slate-700 bg-transparent border-none outline-none truncate"
                  />
                  <button
                    onClick={handleCopyUrl}
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
                    <strong>Note:</strong> This link allows anyone with it to view your customer quote and accept or decline it. Only share it with the intended customer.
                  </p>
                </div>

                <button
                  onClick={() => setMode('choose')}
                  data-copilot="cl-back-options"
                  className="text-sm text-slate-500 hover:text-slate-700"
                >
                  ← Back to options
                </button>
              </div>
            )}

            {/* Email Mode */}
            {mode === 'email' && !loading && (
              <div data-copilot="cl-email-mode">
                {/* Template Selector */}
                {emailTemplates.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Email Template</label>
                    <select
                      value={selectedTemplateId}
                      onChange={e => handleTemplateChange(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
                    >
                      <option value="">- Select template -</option>
                      {emailTemplates.map(t => (
                        <option key={t.id} value={t.id}>{t.name}{t.is_default ? ' (Default)' : ''}</option>
                      ))}
                    </select>
                  </div>
                )}

                {emailTemplates.length === 0 && (
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-xs text-slate-500">
                      No email templates found. A basic email has been generated. You can create templates in the Templates section for faster future use.
                    </p>
                  </div>
                )}

                {/* Subject */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={e => setEmailSubject(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
                  />
                </div>

                {/* Body */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email Body</label>
                  <textarea
                    value={emailBody}
                    onChange={e => setEmailBody(e.target.value)}
                    rows={12}
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none ${
                      bodyHasExtraUrls
                        ? 'border-amber-400 focus:border-amber-500'
                        : 'border-slate-300 focus:border-orange-500'
                    }`}
                  />
                  {bodyHasExtraUrls && (
                    <div className="mt-2 flex gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <svg className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                      </svg>
                      <p className="text-xs text-amber-800">
                        <strong>Spam risk:</strong> This email contains {urlCountInBody} links. Emails with multiple URLs are more likely to land in spam or junk. Remove any extra links and let the quote button do the work.
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() => setMode('choose')}
                    className="text-sm text-slate-500 hover:text-slate-700"
                  >
                    ← Back to options
                  </button>
                  <button
                    onClick={handleCopyEmail}
                    className={`px-4 py-2 text-sm font-medium rounded-full transition-all ${
                      emailCopied
                        ? 'bg-emerald-500 text-white'
                        : 'bg-black text-white hover:bg-slate-800 hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]'
                    }`}
                  >
                    {emailCopied ? '✓ Email Copied!' : 'Copy Email'}
                  </button>
                </div>
              </div>
            )}

            {/* Send Mode (Messages pipeline) */}
            {mode === 'send' && !loading && (
              <div data-copilot="cl-send-mode" className="space-y-4">
                <p className="text-sm text-slate-600">
                  We&apos;ll email the customer directly from QuoteCore+, branded as your
                  company. Replies come back as in-app alerts.
                </p>

                {/* Recipient */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Recipient email</label>
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="customer@example.com"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
                  />
                </div>

                {/* Template selector - reused from email mode. No template
                    is required; users can type a one-off message inline.
                    The hint below the dropdown nudges them to save
                    repeated messages as templates for next time. */}
                {emailTemplates.length > 0 ? (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Message Template</label>
                    <select
                      value={selectedTemplateId}
                      onChange={(e) => handleTemplateChange(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
                    >
                      <option value="">- None (custom message) -</option>
                      {emailTemplates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                          {t.is_default ? ' (Default)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-xs text-slate-500">
                      No message templates yet. You can type a one-off message below, or
                      <span className="text-slate-700 font-medium"> create a template</span> in the Templates section for faster future sends.
                    </p>
                  </div>
                )}

                {/* Subject */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
                  />
                </div>

                {/* Body */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Message</label>
                  <textarea
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    rows={10}
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none ${
                      bodyHasExtraUrls
                        ? 'border-amber-400 focus:border-amber-500'
                        : 'border-slate-300 focus:border-orange-500'
                    }`}
                  />
                  {bodyHasExtraUrls ? (
                    <div className="mt-2 flex gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <svg className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                      </svg>
                      <p className="text-xs text-amber-800">
                        <strong>Spam risk:</strong> This message contains {urlCountInBody} links. Emails with multiple URLs are more likely to land in spam or junk. Remove any extra links - the quote button is included automatically.
                      </p>
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-slate-500">
                      The recipient sees a &ldquo;Respond now&rdquo; button below this text that opens a reply page in their browser.
                    </p>
                  )}
                </div>

                {/* Attachments picker. Library files are Pro+-gated (hidden
                    when libraryLocked); this quote's own files attach on any
                    tier. The recipient downloads them from the accept page. */}
                <AttachmentSendPicker
                  libraryFiles={libraryFiles}
                  quoteFiles={quoteFiles}
                  selection={attachmentSelection}
                  onChange={setAttachmentSelection}
                  libraryLocked={libraryLocked}
                />

                {sendError ? (
                  <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2">{sendError}</p>
                ) : null}
                {sendSuccess === 'sent' ? (
                  <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-2">Message sent. Replies will show up as in-app alerts.</p>
                ) : null}
                {sendSuccess === 'suppressed' ? (
                  <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-2">This recipient is on your suppression list, so the message was blocked. The send is logged but no email was dispatched.</p>
                ) : null}

                {/* PRE-SEND GATE. After the user composes and clicks the
                    primary button we show two choices before anything is
                    sent: send now (no follow-ups) or add follow-ups first.
                    This replaces the old POST-send "schedule follow-up?"
                    prompt with a pre-send decision. */}
                {sendStage === 'gate' && sendSuccess !== 'sent' ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
                    <p className="text-sm font-medium text-slate-900">Before we send - do you want follow-ups?</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={handleSendNow}
                        disabled={isSending}
                        title="No follow-ups needed"
                        className="p-4 rounded-xl border-2 border-slate-200 bg-white hover:border-orange-300 hover:bg-orange-50/40 transition text-left space-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="w-9 h-9 rounded-full bg-black flex items-center justify-center">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
                          </svg>
                        </div>
                        <h4 className="text-sm font-semibold text-slate-900">{isSending ? 'Sending…' : 'Send now'}</h4>
                        <p className="text-xs text-slate-500">No follow-ups needed</p>
                      </button>

                      <button
                        type="button"
                        onClick={handleOpenFollowUps}
                        disabled={isSending || !canFollowups}
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

                {/* FOLLOW-UP BUILDER. Opened by "Add Follow-ups". The user
                    can add multiple rules (cap 3). Each rule is either a
                    triggered follow-up (accepted / declined / dispute,
                    optional delay) or a time-based chase (delay > 0,
                    cancels on reply). On confirm we persist each rule then
                    run the send. */}
                {sendStage === 'followups' && sendSuccess !== 'sent' ? (
                  <div className="rounded-xl border border-orange-200 bg-orange-50/60 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-900">Add follow-ups</p>
                      <span className="text-xs text-slate-500">{draftRules.length} / 3</span>
                    </div>

                    {emailTemplates.length === 0 ? (
                      <div className="rounded-lg border border-slate-200 bg-white p-3">
                        <p className="text-xs text-slate-500">You have no message templates yet - follow-ups need one.</p>
                        <button onClick={goCreateTemplate} className="mt-2 text-xs font-medium text-orange-600 hover:text-orange-700 underline">
                          Create your first follow-up template
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* Add buttons FIRST. User explicitly creates a rule
                            (max 3) - nothing is pre-populated. Black/white,
                            orange glow on hover. */}
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
                            Add a follow-up above to get started - choose a trigger-based rule (fires on accept / decline / dispute) or a time-based chase. You can add up to 3.
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
                                      {(['quote_accepted', 'quote_declined', 'quote_revision_requested', 'quote_viewed'] as const).map((t) => {
                                        const tlabel =
                                          t === 'quote_accepted' ? 'Quote accepted' : t === 'quote_declined' ? 'Quote declined' : t === 'quote_revision_requested' ? 'Dispute / change requested' : 'On read (opened, no response)';
                                        // Disable a trigger already used by ANOTHER rule.
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
                                  <p className="text-[11px] text-slate-500">Chases the customer if they don’t respond. Auto-cancels when they reply, accept, or decline. Respects quiet hours.</p>
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
                                  {emailTemplates.map((t) => (
                                    <option key={t.id} value={t.id}>{t.name}{t.is_default ? ' (Default)' : ''}</option>
                                  ))}
                                </select>
                              </div>

                              {isOk ? (
                                <p className="text-[10px] text-emerald-700">Scheduled ✓</p>
                              ) : null}
                              {isErr ? (
                                <p className="text-[11px] text-rose-700">{(rule.result as { ok: false; error: string }).error}</p>
                              ) : null}
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
                        disabled={followUpSaving || isSending || emailTemplates.length === 0 || draftRules.length === 0}
                        className="px-4 py-2 text-sm font-medium rounded-full bg-[#FF6B35] text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
                      >
                        {followUpSaving || isSending ? 'Saving & sending…' : 'Save follow-ups & send'}
                      </button>
                    </div>
                  </div>
                ) : null}

                {/* Compose-stage footer: Back to options + the primary
                    button that OPENS the pre-send gate (does not send
                    directly anymore). Hidden once the gate/builder is
                    showing or after a successful send. */}
                {sendStage === 'form' ? (
                  <div className="flex items-center justify-between pt-2">
                    <button
                      onClick={() => setMode('choose')}
                      className="text-sm text-slate-500 hover:text-slate-700"
                    >
                      ← Back to options
                    </button>
                    <button
                      onClick={handleProceedToGate}
                      disabled={isSending || sendSuccess === 'sent' || isPlanGated}
                      className="px-4 py-2 text-sm font-medium rounded-full bg-black text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
                    >
                      {sendSuccess === 'sent' ? 'Sent' : 'Continue'}
                    </button>
                  </div>
                ) : null}
              </div>
            )}

            {/* Close */}
            {mode !== 'choose' && (
              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
