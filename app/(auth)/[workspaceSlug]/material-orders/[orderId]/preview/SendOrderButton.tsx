'use client';

import { useState, useTransition, useEffect } from 'react';
import {
  loadOrderTemplatesForSend,
  sendOrderMessage,
} from './send-order-actions';

interface Props {
  orderId: string;
  orderNumber: string;
  /**
   * Pre-existing supplier link token, if any. Currently used only as
   * a hint to display "order link will be included" copy in the modal;
   * the server action auto-generates a token at send time when missing.
   */
  supplierUrlToken?: string | null;
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
 * Order-preview "Send Order" button + modal. Mirrors the quote-summary
 * Send button's send-mode but scoped to a single material order.
 *
 * Templates load lazily on modal open so the order-preview page render
 * stays fast for users who never click Send.
 */
export function SendOrderButton({
  orderId,
  orderNumber,
  supplierUrlToken: _supplierUrlToken,
  defaultRecipientEmail,
  defaultRecipientName,
  companyName,
}: Props) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [templatesLoaded, setTemplatesLoaded] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipientEmail, setRecipientEmail] = useState(defaultRecipientEmail ?? '');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<'sent' | 'suppressed' | null>(null);
  const [isPending, startTransition] = useTransition();

  // Lazy-load templates when the modal first opens.
  useEffect(() => {
    if (!open || templatesLoaded) return;
    loadOrderTemplatesForSend()
      .then((rows) => {
        setTemplates(rows);
        setTemplatesLoaded(true);
        // Pre-fill with the default template, or a minimal stock message.
        const def = rows.find((r) => r.is_default) || rows[0];
        if (def) {
          setSelectedTemplateId(def.id);
          setSubject(def.subject);
          setBody(def.body);
        } else {
          setSubject(`Material order ${orderNumber}${companyName ? ` from ${companyName}` : ''}`);
          setBody(
            // Default body intentionally short. The branded "Respond now"
            // button at the bottom of the email already provides the
            // primary action; this body just sets context.
            `Hi${defaultRecipientName ? ` ${defaultRecipientName}` : ''},\n\nPlease review our material order ${orderNumber}. You can confirm, request changes, or ask a question using the button below.\n\nThanks.`,
          );
        }
      })
      .catch(() => setTemplatesLoaded(true));
  }, [open, templatesLoaded, orderNumber, companyName, defaultRecipientName]);

  function handleTemplateChange(id: string) {
    setSelectedTemplateId(id);
    const tpl = templates.find((t) => t.id === id);
    if (tpl) {
      setSubject(tpl.subject);
      setBody(tpl.body);
    }
  }

  function submit() {
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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-4 py-2 text-sm font-medium rounded-full bg-orange-500 text-white hover:bg-orange-600 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
      >
        Send Order
      </button>

      {open ? (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 data-exclude-pdf">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Send Order via QuoteCore+</h3>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 text-xl">
                ✕
              </button>
            </div>

            <p className="text-sm text-slate-600">
              We&apos;ll email the supplier directly from QuoteCore+, branded as your company. Replies come back as in-app alerts.
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
                  <option value="">— Select template —</option>
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
                  No templates yet. Create one in the Templates section for faster future sends, or just type a message below.
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
                The supplier sees a &ldquo;Respond now&rdquo; button below your text that opens a reply page in their browser.
              </p>
            </div>

            {error ? (
              <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2">{error}</p>
            ) : null}
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

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50"
              >
                {success === 'sent' ? 'Close' : 'Cancel'}
              </button>
              {success !== 'sent' ? (
                <button
                  onClick={submit}
                  disabled={isPending}
                  className="px-4 py-2 text-sm font-medium rounded-full bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
                >
                  {isPending ? 'Sending…' : 'Send order'}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
