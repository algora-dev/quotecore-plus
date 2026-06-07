'use client';
import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { sendInvoiceMessage } from './send-invoice-actions';

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  is_default: boolean | null;
}

interface InvoiceMeta {
  customerName: string;
  invoiceNumber: string;
  invoiceTotal: string;
  companyName: string | null;
  dueDate: string | null;
}

interface Props {
  invoiceId: string;
  workspaceSlug: string;
  publicToken: string;
  /** Invoice status — button hidden when cancelled/paid */
  status: string;
  emailTemplates: EmailTemplate[];
  invoiceMeta: InvoiceMeta;
  /** Pre-filled customer email (from invoice row). */
  defaultRecipientEmail?: string | null;
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
    .replace(/\{\{invoice_number\}\}/g, sanitize(data.invoice_number || ''))
    .replace(/\{\{invoice_total\}\}/g, sanitize(data.invoice_total || ''))
    .replace(/\{\{invoice_link\}\}/g, data.invoice_link || '')
    .replace(/\{\{company_name\}\}/g, sanitize(data.company_name || ''))
    .replace(/\{\{due_date\}\}/g, sanitize(data.due_date || ''))
    .replace(/\{\{today\}\}/g, sanitize(data.today || ''));
}

export function SendInvoiceButton({
  invoiceId,
  workspaceSlug,
  publicToken,
  status,
  emailTemplates,
  invoiceMeta,
  defaultRecipientEmail,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'choose' | 'url' | 'email' | 'send'>('choose');
  const [copied, setCopied] = useState(false);

  // Email/send state
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailCopied, setEmailCopied] = useState(false);

  // Send mode state
  const [recipientEmail, setRecipientEmail] = useState(defaultRecipientEmail ?? '');
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<'sent' | 'suppressed' | null>(null);
  const [isSending, startSendTransition] = useTransition();

  const isPlanGated = sendError?.includes("isn't included in your current plan") ?? false;

  // Don't show on terminal statuses
  if (['cancelled', 'paid'].includes(status)) return null;

  const invoicePublicUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/invoice/${publicToken}`
      : `/invoice/${publicToken}`;

  const today = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const placeholderData: Record<string, string> = {
    customer_name: invoiceMeta.customerName,
    invoice_number: invoiceMeta.invoiceNumber,
    invoice_total: invoiceMeta.invoiceTotal,
    invoice_link: invoicePublicUrl,
    company_name: invoiceMeta.companyName ?? '',
    due_date: invoiceMeta.dueDate ?? '',
    today,
  };

  function prefillFromTemplate(template: EmailTemplate | undefined) {
    if (!template) return;
    setEmailSubject(replacePlaceholders(template.subject, placeholderData));
    setEmailBody(replacePlaceholders(template.body, placeholderData));
  }

  function buildDefaultEmail() {
    const dueStr = invoiceMeta.dueDate ? ` Due: ${invoiceMeta.dueDate}.` : '';
    setEmailSubject(`Invoice ${invoiceMeta.invoiceNumber} from ${invoiceMeta.companyName || 'us'}`);
    setEmailBody(
      `Hi ${invoiceMeta.customerName},\n\nPlease find your invoice at the following link:\n\n${invoicePublicUrl}\n\nTotal: ${invoiceMeta.invoiceTotal}.${dueStr}\n\nKind regards`,
    );
  }

  function openEmailOrSendMode(nextMode: 'email' | 'send') {
    const defaultTpl = emailTemplates.find((t) => t.is_default) || emailTemplates[0];
    if (defaultTpl) {
      setSelectedTemplateId(defaultTpl.id);
      prefillFromTemplate(defaultTpl);
    } else {
      setSelectedTemplateId('');
      buildDefaultEmail();
    }
    setSendError(null);
    setSendSuccess(null);
    setMode(nextMode);
  }

  function handleTemplateChange(templateId: string) {
    setSelectedTemplateId(templateId);
    prefillFromTemplate(emailTemplates.find((t) => t.id === templateId));
  }

  function handleOpen() {
    setOpen(true);
    setMode('choose');
    setCopied(false);
    setEmailCopied(false);
    setSendError(null);
    setSendSuccess(null);
  }

  async function handleCopyUrl() {
    try {
      await navigator.clipboard.writeText(invoicePublicUrl);
    } catch {
      const input = document.createElement('input');
      input.value = invoicePublicUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

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
      const result = await sendInvoiceMessage({
        invoiceId,
        templateId: selectedTemplateId || null,
        subject: emailSubject,
        body: emailBody,
        recipientEmail: recipientEmail.trim(),
        recipientName: invoiceMeta.customerName,
      });
      if (result.ok) {
        setSendSuccess(result.status);
        router.refresh();
      } else {
        setSendError(result.error);
      }
    });
  }

  // Url counts in body for spam warning
  const urlCountInBody = (emailBody.match(/https?:\/\/[^\s]+/gi) ?? []).length;
  const bodyHasExtraUrls = urlCountInBody > 1;

  function goCreateTemplate() {
    const returnPath = encodeURIComponent(`/${workspaceSlug}/invoices/${invoiceId}`);
    router.push(
      `/${workspaceSlug}/resources?tab=email&kind=invoice_send&return=${returnPath}`,
    );
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 rounded-full bg-[#FF6B35] px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4 20-7Z" />
        </svg>
        Send Invoice
      </button>

      {open && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">
                {mode === 'choose' ? 'Send Invoice to Customer' :
                 mode === 'url' ? 'Copy Invoice Link' :
                 mode === 'send' ? 'Send from QuoteCore+' :
                 'Generate Email'}
              </h3>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
            </div>

            {/* ── Choose mode ── */}
            {mode === 'choose' && (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">How would you like to send this invoice?</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Send from QuoteCore+ */}
                  <button
                    onClick={() => openEmailOrSendMode('send')}
                    className="p-4 rounded-xl border-2 border-orange-300 bg-orange-50/50 hover:border-orange-400 hover:bg-orange-50 transition text-left space-y-2"
                  >
                    <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                      <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                        <path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4 20-7Z" />
                      </svg>
                    </div>
                    <h4 className="text-sm font-semibold text-slate-900">Send from QuoteCore+</h4>
                    <p className="text-xs text-slate-500">Email the customer directly, branded as your company</p>
                  </button>

                  {/* Copy URL */}
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
                    <p className="text-xs text-slate-500">Copy the invoice link to paste anywhere</p>
                  </button>

                  {/* Generate Email */}
                  <button
                    onClick={() => openEmailOrSendMode('email')}
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
                        ? 'Use a template, copy to your own email client'
                        : 'Generate email text to paste into your client'}
                    </p>
                  </button>

                  {/* Create template */}
                  <button
                    onClick={goCreateTemplate}
                    className="p-4 rounded-xl border-2 border-slate-200 hover:border-orange-300 hover:bg-orange-50/50 transition text-left space-y-2"
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                      <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </div>
                    <h4 className="text-sm font-semibold text-slate-900">Create template</h4>
                    <p className="text-xs text-slate-500">Build a reusable invoice email template</p>
                  </button>
                </div>
              </div>
            )}

            {/* ── URL mode ── */}
            {mode === 'url' && (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">
                  Paste this link in a message or email. The customer can view the invoice and report payment.
                </p>
                <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <input
                    type="text"
                    readOnly
                    value={invoicePublicUrl}
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
                <p className="text-xs text-slate-500">
                  Note: anyone with this link can view and download the invoice. Share only with the intended customer.
                </p>
                <button onClick={() => setMode('choose')} className="text-sm text-slate-500 hover:text-slate-700">
                  ← Back to options
                </button>
              </div>
            )}

            {/* ── Email mode ── */}
            {mode === 'email' && (
              <div className="space-y-3">
                {emailTemplates.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Email Template</label>
                    <select
                      value={selectedTemplateId}
                      onChange={(e) => handleTemplateChange(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
                    >
                      <option value="">- Select template -</option>
                      {emailTemplates.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}{t.is_default ? ' (Default)' : ''}</option>
                      ))}
                    </select>
                  </div>
                )}
                {emailTemplates.length === 0 && (
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-xs text-slate-500">No invoice email templates yet. A basic email has been generated.</p>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email Body</label>
                  <textarea
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    rows={12}
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none ${
                      bodyHasExtraUrls ? 'border-amber-400' : 'border-slate-300 focus:border-orange-500'
                    }`}
                  />
                  {bodyHasExtraUrls && (
                    <p className="mt-1 text-xs text-amber-700">⚠ Multiple URLs may trigger spam filters. Remove extras.</p>
                  )}
                </div>
                <div className="flex items-center justify-between pt-1">
                  <button onClick={() => setMode('choose')} className="text-sm text-slate-500 hover:text-slate-700">
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
                    {emailCopied ? '✓ Copied!' : 'Copy Email'}
                  </button>
                </div>
              </div>
            )}

            {/* ── Send mode ── */}
            {mode === 'send' && (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">
                  We&apos;ll email the customer directly from QuoteCore+, branded as your company.
                </p>

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
                        <option key={t.id} value={t.id}>{t.name}{t.is_default ? ' (Default)' : ''}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-xs text-slate-500">
                      No invoice templates yet. Type a custom message below or{' '}
                      <button onClick={goCreateTemplate} className="underline text-slate-700 font-medium">create a template</button>.
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Message</label>
                  <textarea
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    rows={10}
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none ${
                      bodyHasExtraUrls ? 'border-amber-400' : 'border-slate-300 focus:border-orange-500'
                    }`}
                  />
                  {bodyHasExtraUrls ? (
                    <p className="mt-1 text-xs text-amber-700">⚠ Multiple URLs may trigger spam filters.</p>
                  ) : (
                    <p className="mt-1 text-xs text-slate-500">
                      A &ldquo;View Invoice&rdquo; button is included automatically below your message.
                    </p>
                  )}
                </div>

                {sendError && (
                  <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2">{sendError}</p>
                )}
                {sendSuccess === 'sent' && (
                  <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-2">
                    Invoice sent! The invoice status has been updated to Sent.
                  </p>
                )}
                {sendSuccess === 'suppressed' && (
                  <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-2">
                    This recipient is on your suppression list. The send was blocked.
                  </p>
                )}

                <div className="flex items-center justify-between pt-1">
                  <button onClick={() => setMode('choose')} className="text-sm text-slate-500 hover:text-slate-700">
                    ← Back to options
                  </button>
                  <button
                    onClick={handleSendSubmit}
                    disabled={isSending || sendSuccess === 'sent' || isPlanGated}
                    className="px-4 py-2 text-sm font-medium rounded-full bg-[#FF6B35] text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
                  >
                    {isSending ? 'Sending…' : sendSuccess === 'sent' ? 'Sent ✓' : 'Send Invoice'}
                  </button>
                </div>
              </div>
            )}

            {mode !== 'choose' && (
              <div className="flex justify-end">
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
