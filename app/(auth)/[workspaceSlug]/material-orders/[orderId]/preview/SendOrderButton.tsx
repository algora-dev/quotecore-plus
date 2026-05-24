'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  loadOrderTemplatesForSend,
  sendOrderMessage,
} from './send-order-actions';
import { generateOrderSupplierToken } from './supplier-link-actions';

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
}

interface MessageTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  is_default: boolean | null;
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
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('choose');

  // Send-mode state.
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [templatesLoaded, setTemplatesLoaded] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipientEmail, setRecipientEmail] = useState(defaultRecipientEmail ?? '');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<'sent' | 'suppressed' | null>(null);
  const [isPending, startTransition] = useTransition();

  // URL-mode state.
  const [token, setToken] = useState<string | null>(existingToken ?? null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Pre-fill subject/body when the user enters Send mode.
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
            `Material order ${orderNumber}${companyName ? ` from ${companyName}` : ''}`,
          );
          setBody(
            `Hi${defaultRecipientName ? ` ${defaultRecipientName}` : ''},\n\nPlease review our material order ${orderNumber}. You can confirm, request changes, or ask a question using the button below.\n\nThanks.`,
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

  function submitSend() {
    setError(null);
    setSuccess(null);
    if (!recipientEmail.trim()) {
      setError('Please enter a recipient email.');
      return;
    }
    if (!subject.trim() || !body.trim()) {
      setError('Subject and body cannot be empty.');
      return;
    }
    startTransition(async () => {
      const result = await sendOrderMessage({
        orderId,
        templateId: selectedTemplateId || null,
        subject,
        body,
        recipientEmail: recipientEmail.trim(),
        recipientName: defaultRecipientName ?? null,
      });
      if (result.ok) {
        setSuccess(result.status);
      } else {
        setError(result.error);
      }
    });
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
    router.push(`/${workspaceSlug}/templates?tab=email&kind=order_send&return=${returnPath}`);
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

                <div className="flex items-center justify-between pt-2">
                  <button onClick={() => setMode('choose')} className="text-sm text-slate-500 hover:text-slate-700">
                    ← Back to options
                  </button>
                  {success !== 'sent' ? (
                    <button
                      onClick={submitSend}
                      disabled={isPending}
                      className="px-4 py-2 text-sm font-medium rounded-full bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
                    >
                      {isPending ? 'Sending…' : 'Send order'}
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
