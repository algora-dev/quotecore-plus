'use client';
import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { generateAcceptanceToken } from '../../actions';
import { sendQuoteMessage } from './send-message-actions';
import { scheduleQuoteFollowUp } from '@/app/lib/messages/scheduled';

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
}

interface Props {
  quoteId: string;
  workspaceSlug: string;
  existingToken: string | null;
  hasCustomerQuote: boolean;
  emailTemplates: EmailTemplate[];
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

export function SendQuoteButton({ quoteId, workspaceSlug, existingToken, hasCustomerQuote, emailTemplates, quoteMeta }: Props) {
  const router = useRouter();

  /**
   * Open the Templates page on the Message tab so the user can build
   * a reusable quote_send template. The `kind` + `return` query params
   * are aspirational — the TemplatesPageClient currently honours `tab`
   * but not the others; they're recorded in the URL so the Phase 2
   * wiring can pick them up without breaking the navigation now.
   */
  function goCreateTemplate() {
    const returnPath = encodeURIComponent(
      `/${workspaceSlug}/quotes/${quoteId}/summary`,
    );
    router.push(`/${workspaceSlug}/templates?tab=email&kind=quote_send&return=${returnPath}`);
  }
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'choose' | 'url' | 'email' | 'send'>('choose');
  const [token, setToken] = useState(existingToken);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Sync local token state to the server prop when it changes.
  // Without this, `router.refresh()` (used by ReopenQuoteButton, the
  // post-send prompt, etc.) re-runs the server component and updates
  // `existingToken` — but the client component's `token` state stays
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
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<'sent' | 'suppressed' | null>(null);
  const [isSending, startSendTransition] = useTransition();

  // Post-send "Schedule follow-up?" prompt state. After a successful
  // send through the Messages pipeline we offer three optional
  // follow-up rules, each toggleable and configurable independently:
  //
  //   1. After no response — fires N days after this send.
  //   2. After acceptance  — fires N days after the customer accepts
  //                          (parked with sentinel timestamps until
  //                          activated by the accept handler).
  //   3. After decline     — fires N days after the customer declines.
  //
  // Each rule has its own template + delay. The prompt is hidden
  // when all rules are scheduled or the user dismisses it.
  type DelayUnit = 'immediately' | 'hours' | 'days';
  type PostSendRule = {
    enabled: boolean;
    templateId: string;
    delayValue: number;
    delayUnit: DelayUnit;
    scheduled: { ok: true; fireAt: string } | { ok: false; error: string } | null;
  };
  const [postSendRules, setPostSendRules] = useState<Record<'no_response' | 'accepted' | 'declined', PostSendRule>>({
    // Event triggers default to "Immediately" because that's the
    // headline use case Shaun called out: customer accepts → the
    // congrats / next-steps email goes out within seconds. The user
    // can pick hours or days if they want a deliberate gap. The
    // no_response chase keeps the conventional 7-day default.
    no_response: { enabled: true, templateId: '', delayValue: 7, delayUnit: 'days', scheduled: null },
    accepted: { enabled: false, templateId: '', delayValue: 0, delayUnit: 'immediately', scheduled: null },
    declined: { enabled: false, templateId: '', delayValue: 0, delayUnit: 'immediately', scheduled: null },
  });
  const [postSendScheduling, setPostSendScheduling] = useState(false);
  const [postSendDismissed, setPostSendDismissed] = useState(false);

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

  async function handleOpen() {
    setOpen(true);
    setMode('choose');
    setCopied(false);
    setEmailCopied(false);
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
    setSendError(null);
    setSendSuccess(null);
  }

  function handleSendSubmit() {
    setSendError(null);
    setSendSuccess(null);
    if (!recipientEmail.trim()) {
      setSendError('Please enter a recipient email.');
      return;
    }
    if (!emailSubject.trim() || !emailBody.trim()) {
      setSendError('Subject and body cannot be empty.');
      return;
    }
    startSendTransition(async () => {
      const result = await sendQuoteMessage({
        quoteId,
        templateId: selectedTemplateId || null,
        subject: emailSubject,
        body: emailBody,
        recipientEmail: recipientEmail.trim(),
        recipientName: quoteMeta.customerName,
      });
      if (result.ok) {
        setSendSuccess(result.status);
        // Reset post-send prompt state on every new successful send so
        // a user can do Send -> Schedule -> Send again without the
        // prompt staying dismissed.
        setPostSendDismissed(false);
        // Pre-select a template for every follow-up rule: prefer the
        // default template, otherwise the one they just used.
        const defaultTpl = emailTemplates.find((t) => t.is_default) || emailTemplates[0];
        const defaultTplId = defaultTpl?.id ?? selectedTemplateId ?? '';
        setPostSendRules((prev) => ({
          no_response: { ...prev.no_response, templateId: defaultTplId, scheduled: null },
          accepted: { ...prev.accepted, templateId: defaultTplId, scheduled: null },
          declined: { ...prev.declined, templateId: defaultTplId, scheduled: null },
        }));
      } else {
        setSendError(result.error);
      }
    });
  }

  async function handleSchedulePostSend() {
    const enabledRules = (Object.entries(postSendRules) as Array<[
      'no_response' | 'accepted' | 'declined',
      PostSendRule,
    ]>).filter(([, rule]) => rule.enabled && !rule.scheduled?.ok && rule.templateId);
    if (enabledRules.length === 0) return;

    setPostSendScheduling(true);
    const triggerByKey: Record<typeof enabledRules[number][0], 'quote_sent' | 'quote_accepted' | 'quote_declined'> = {
      no_response: 'quote_sent',
      accepted: 'quote_accepted',
      declined: 'quote_declined',
    };
    try {
      // Schedule rules sequentially so errors are independent and the
      // user can see which one(s) failed.
      for (const [key, rule] of enabledRules) {
        const result = await scheduleQuoteFollowUp({
          quoteId,
          templateId: rule.templateId,
          triggerEvent: triggerByKey[key],
          // Translate the rule's (value, unit) pair into the
          // scheduleQuoteFollowUp contract. "Immediately" means
          // both numbers are zero — the activator will dispatch
          // inline as soon as the event fires.
          waitDays: rule.delayUnit === 'days' ? rule.delayValue : 0,
          waitHours: rule.delayUnit === 'hours' ? rule.delayValue : 0,
          // "no_response" implies require_no_response. The accepted /
          // declined triggers don't gate on response because the
          // event ITSELF is the gate — if the customer accepts, we
          // want the thank-you to fire regardless of whether they
          // also replied to the previous message.
          requireNoResponse: key === 'no_response',
          respectQuietHours: true,
          recipientEmail: recipientEmail.trim(),
          recipientName: quoteMeta.customerName || null,
        });
        setPostSendRules((prev) => ({
          ...prev,
          [key]: {
            ...prev[key],
            scheduled: result.ok
              ? { ok: true as const, fireAt: result.fireAt }
              : { ok: false as const, error: result.error },
          },
        }));
      }
      router.refresh();
    } finally {
      setPostSendScheduling(false);
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
    } else {
      setSelectedTemplateId('');
      setEmailSubject(`Quote #${quoteMeta.quoteNumber} from ${quoteMeta.companyName || 'us'}`);
      setEmailBody(`Hi ${quoteMeta.customerName},\n\nPlease find your quote at the following link:\n\n${url}\n\nKind regards`);
    }

    setMode('email');
  }

  function handleTemplateChange(templateId: string) {
    setSelectedTemplateId(templateId);
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
                      <option value="">— Select template —</option>
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
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
                  />
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

                {/* Template selector — reused from email mode. No template
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
                      <option value="">— None (custom message) —</option>
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
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    The recipient sees a &ldquo;Respond now&rdquo; button below this text that opens a reply page in their browser.
                  </p>
                </div>

                {sendError ? (
                  <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2">{sendError}</p>
                ) : null}
                {sendSuccess === 'sent' ? (
                  <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-2">Message sent. Replies will show up as in-app alerts.</p>
                ) : null}
                {sendSuccess === 'suppressed' ? (
                  <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-2">This recipient is on your suppression list, so the message was blocked. The send is logged but no email was dispatched.</p>
                ) : null}

                {/* Post-send "Schedule follow-ups?" prompt. Shown only
                    after a successful (not suppressed) send through the
                    Messages pipeline. Offers three independent rules:
                    no-response chase, after-acceptance thank-you, and
                    after-decline revival. Each is opt-in with its own
                    template + delay. Hidden once all enabled rules are
                    scheduled, or the user dismisses it. */}
                {sendSuccess === 'sent' && !postSendDismissed && emailTemplates.length > 0 ? (
                  <div className="rounded-lg border border-orange-200 bg-orange-50/60 p-3 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <svg className="w-4 h-4 mt-0.5 text-orange-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                          <p className="text-sm font-medium text-slate-900">Schedule follow-ups?</p>
                          <p className="text-xs text-slate-600 mt-0.5">
                            Each rule is independent. Accept/decline rules are parked until the event happens, then fire on the delay you set.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPostSendDismissed(true)}
                        className="text-slate-400 hover:text-slate-700 text-sm leading-none p-1"
                        aria-label="Dismiss follow-up prompt"
                      >
                        ✕
                      </button>
                    </div>

                    {(['no_response', 'accepted', 'declined'] as const).map((key) => {
                      const rule = postSendRules[key];
                      const label =
                        key === 'no_response'
                          ? 'If no response'
                          : key === 'accepted'
                            ? 'After customer accepts'
                            : 'After customer declines';
                      const isScheduled = rule.scheduled?.ok === true;
                      return (
                        <div
                          key={key}
                          className={`rounded-lg border p-2 ${
                            isScheduled ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'
                          }`}
                        >
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={rule.enabled || isScheduled}
                              disabled={isScheduled}
                              onChange={(e) =>
                                setPostSendRules((prev) => ({
                                  ...prev,
                                  [key]: { ...prev[key], enabled: e.target.checked },
                                }))
                              }
                              className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                            />
                            <span className="text-xs font-medium text-slate-900">{label}</span>
                            {isScheduled ? (
                              <span className="ml-auto text-[10px] uppercase tracking-wide text-emerald-700 font-semibold">
                                Scheduled
                              </span>
                            ) : null}
                          </label>
                          {rule.enabled && !isScheduled ? (
                            <div className="flex items-end gap-2 flex-wrap mt-2 pl-6">
                              <div className="flex-1 min-w-[120px]">
                                <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Template</label>
                                <select
                                  value={rule.templateId}
                                  onChange={(e) =>
                                    setPostSendRules((prev) => ({
                                      ...prev,
                                      [key]: { ...prev[key], templateId: e.target.value },
                                    }))
                                  }
                                  className="w-full text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white"
                                >
                                  {emailTemplates.map((t) => (
                                    <option key={t.id} value={t.id}>
                                      {t.name}
                                      {t.is_default ? ' (Default)' : ''}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="w-32">
                                <label className="block text-[10px] font-medium text-slate-500 mb-0.5">When</label>
                                <select
                                  value={rule.delayUnit}
                                  onChange={(e) => {
                                    const nextUnit = e.target.value as DelayUnit;
                                    setPostSendRules((prev) => ({
                                      ...prev,
                                      [key]: {
                                        ...prev[key],
                                        delayUnit: nextUnit,
                                        // When switching to immediately, zero out the value.
                                        // When switching from immediately to hours/days, default to 1.
                                        delayValue:
                                          nextUnit === 'immediately'
                                            ? 0
                                            : prev[key].delayUnit === 'immediately'
                                              ? 1
                                              : prev[key].delayValue,
                                      },
                                    }));
                                  }}
                                  className="w-full text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white"
                                >
                                  {/* Immediately is only meaningful for event triggers —
                                      a 'no response' chase 0 seconds after sending makes no
                                      sense and the server would reject it. */}
                                  {key !== 'no_response' ? (
                                    <option value="immediately">Immediately</option>
                                  ) : null}
                                  <option value="hours">Hours after</option>
                                  <option value="days">Days after</option>
                                </select>
                              </div>
                              {rule.delayUnit !== 'immediately' ? (
                                <div className="w-20">
                                  <label className="block text-[10px] font-medium text-slate-500 mb-0.5">{rule.delayUnit === 'hours' ? '# hrs' : '# days'}</label>
                                  <input
                                    type="number"
                                    min={1}
                                    max={rule.delayUnit === 'hours' ? 168 : 90}
                                    value={rule.delayValue}
                                    onChange={(e) =>
                                      setPostSendRules((prev) => ({
                                        ...prev,
                                        [key]: {
                                          ...prev[key],
                                          delayValue: Math.max(
                                            1,
                                            Math.min(
                                              prev[key].delayUnit === 'hours' ? 168 : 90,
                                              Number(e.target.value) || 1,
                                            ),
                                          ),
                                        },
                                      }))
                                    }
                                    className="w-full text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white"
                                  />
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                          {isScheduled ? (
                            <p className="text-[10px] text-emerald-700 pl-6 mt-1">
                              {key === 'no_response' ? (
                                <>
                                  Will send around{' '}
                                  {new Date((rule.scheduled as { ok: true; fireAt: string }).fireAt).toLocaleString('en-GB', {
                                    weekday: 'short',
                                    day: '2-digit',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}{' '}
                                  unless the customer responds first.
                                </>
                              ) : (
                                <>
                                  Parked until the customer {key === 'accepted' ? 'accepts' : 'declines'};{' '}
                                  {rule.delayUnit === 'immediately'
                                    ? 'fires immediately when they do.'
                                    : `fires ${rule.delayValue} ${rule.delayUnit === 'hours' ? (rule.delayValue === 1 ? 'hour' : 'hours') : rule.delayValue === 1 ? 'day' : 'days'} after.`}
                                </>
                              )}
                            </p>
                          ) : null}
                          {rule.scheduled && !rule.scheduled.ok ? (
                            <p className="text-[11px] text-rose-700 pl-6 mt-1">{rule.scheduled.error}</p>
                          ) : null}
                        </div>
                      );
                    })}

                    <div className="flex items-center justify-end">
                      <button
                        type="button"
                        onClick={handleSchedulePostSend}
                        disabled={
                          postSendScheduling ||
                          !(Object.values(postSendRules).some((r) => r.enabled && !r.scheduled?.ok && r.templateId))
                        }
                        className="px-3 py-1.5 text-xs font-medium rounded-full bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
                      >
                        {postSendScheduling ? 'Scheduling…' : 'Schedule selected'}
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() => setMode('choose')}
                    className="text-sm text-slate-500 hover:text-slate-700"
                  >
                    ← Back to options
                  </button>
                  <button
                    onClick={handleSendSubmit}
                    disabled={isSending || sendSuccess === 'sent'}
                    className="px-4 py-2 text-sm font-medium rounded-full bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
                  >
                    {isSending ? 'Sending…' : sendSuccess === 'sent' ? 'Sent' : 'Send message'}
                  </button>
                </div>
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
