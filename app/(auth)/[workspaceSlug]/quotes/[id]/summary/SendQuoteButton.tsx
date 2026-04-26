'use client';
import { useState, useEffect } from 'react';
import { generateAcceptanceToken } from '../../actions';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  is_default: boolean;
}

interface Props {
  quoteId: string;
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

function replacePlaceholders(text: string, data: Record<string, string>): string {
  return text
    .replace(/\{\{customer_name\}\}/g, data.customer_name || '')
    .replace(/\{\{quote_number\}\}/g, data.quote_number || '')
    .replace(/\{\{job_name\}\}/g, data.job_name || '')
    .replace(/\{\{quote_url\}\}/g, data.quote_url || '')
    .replace(/\{\{company_name\}\}/g, data.company_name || '')
    .replace(/\{\{quote_date\}\}/g, data.quote_date || '');
}

export function SendQuoteButton({ quoteId, existingToken, hasCustomerQuote, emailTemplates, quoteMeta }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'choose' | 'url' | 'email'>('choose');
  const [token, setToken] = useState(existingToken);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Email mode state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailCopied, setEmailCopied] = useState(false);

  if (!hasCustomerQuote) return null;

  const acceptanceUrl = token
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/accept/${token}`
    : null;

  async function ensureToken(): Promise<string | null> {
    if (token) return token;
    setLoading(true);
    try {
      const newToken = await generateAcceptanceToken(quoteId);
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
                <div className="grid grid-cols-2 gap-3">
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
                        ? 'Use a template with quote details filled in'
                        : 'Create an email with the acceptance link'}
                    </p>
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
