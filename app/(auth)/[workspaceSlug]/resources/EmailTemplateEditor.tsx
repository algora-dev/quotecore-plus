'use client';
import { useMemo, useState } from 'react';
import {
  createEmailTemplate,
  updateEmailTemplate,
  type EmailTemplate,
  type MessageTemplateKind,
} from './email-actions';
import { variablesForKind, VAR_LABELS } from '@/app/lib/messages/mergeVars';

interface Props {
  template?: EmailTemplate | null;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Message Template editor. Drives the per-company library of email/message
 * templates used by the Messages pipeline (`/m/[token]` reply flow).
 *
 * Kind dropdown filters the merge-variable picker so authors see ONLY the
 * variables their template kind can supply at send time. Unknown
 * `{{placeholders}}` are left literal in the recipient's email (rather
 * than silently blanked) so authors get a visible signal if they paste a
 * template across kinds.
 */
const KIND_LABELS: Record<MessageTemplateKind, string> = {
  quote_send: 'Send a quote',
  order_send: 'Send a material order',
  followup: 'Follow up on a quote',
  decline_response: 'Response to a declined quote',
  custom: 'Custom / freeform',
};

const KIND_HINTS: Record<MessageTemplateKind, string> = {
  quote_send: 'Used when the user clicks Send from QuoteCore+ on a quote summary.',
  order_send: 'Used when the user sends a material order to a supplier.',
  followup: 'Used for automated quote follow-ups (Phase 2).',
  decline_response: 'Used for automated responses when a customer declines (Phase 2).',
  custom: 'Generic template; only company-level merge variables are available.',
};

const DEFAULT_BODY_BY_KIND: Record<MessageTemplateKind, string> = {
  quote_send: `Hi {{customer_name}},

Thank you for the opportunity to provide a quote for {{job_name}}.

Quote #: {{quote_number}}

Please review and respond using the link below.

Kind regards,
{{company_name}}`,
  order_send: `Hi {{order_supplier}},

Please review our material order {{order_number}}.

Order reference: {{order_reference}}
Items: {{order_total_items}}

You can confirm, request changes, or ask a question using the button below.

Thanks,
{{company_name}}`,
  followup: `Hi {{customer_name}},

Just following up on the quote we sent for {{job_name}} (Quote #{{quote_number}}).

Let us know if you have any questions, or if there's anything we can adjust.

Kind regards,
{{company_name}}`,
  decline_response: `Hi {{customer_name}},

Thanks for taking the time to consider Quote #{{quote_number}}.

If you'd be open to sharing what would have turned it into a yes \u2014 pricing, scope, timing \u2014 we'd really appreciate the feedback. It helps us do better next time.

Kind regards,
{{company_name}}`,
  custom: `Hi,

(Your message here.)

Kind regards,
{{company_name}}`,
};

export function EmailTemplateEditor({ template, onClose, onSaved }: Props) {
  const [name, setName] = useState(template?.name || '');
  // `template.kind` was added in the 2026-05-12 migration; old rows default to 'custom'.
  const [kind, setKind] = useState<MessageTemplateKind>(
    (template?.kind as MessageTemplateKind) || 'quote_send',
  );
  const [subject, setSubject] = useState(
    template?.subject || 'Quote #{{quote_number}} from {{company_name}}',
  );
  const [body, setBody] = useState(template?.body || DEFAULT_BODY_BY_KIND.quote_send);
  const [isDefault, setIsDefault] = useState(template?.is_default || false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const availableVars = useMemo(() => variablesForKind(kind), [kind]);

  async function handleSave() {
    if (!name.trim()) {
      setError('Template name is required');
      return;
    }
    if (!body.trim()) {
      setError('Body is required');
      return;
    }

    setSaving(true);
    setError('');
    try {
      if (template) {
        await updateEmailTemplate(template.id, { name, subject, body, is_default: isDefault, kind });
      } else {
        await createEmailTemplate({ name, subject, body, is_default: isDefault, kind });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setSaving(false);
    }
  }

  function insertPlaceholder(varKey: string) {
    const tag = `{{${varKey}}}`;
    const textarea = document.getElementById('message-template-body') as HTMLTextAreaElement | null;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newBody = body.slice(0, start) + tag + body.slice(end);
      setBody(newBody);
      // Restore cursor after placeholder
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + tag.length, start + tag.length);
      }, 0);
    } else {
      setBody((prev) => prev + tag);
    }
  }

  function handleKindChange(next: MessageTemplateKind) {
    setKind(next);
    // Only seed default body/subject if the user hasn't customised the
    // body yet (matches the existing on a fresh editor open).
    if (!template && body === DEFAULT_BODY_BY_KIND[kind]) {
      setBody(DEFAULT_BODY_BY_KIND[next]);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">
            {template ? 'Edit Message Template' : 'Create Message Template'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">
            ✕
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
        )}

        {/* Template Name */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Template Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Standard Quote Send"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
          />
        </div>

        {/* Kind */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Used for</label>
          <select
            value={kind}
            onChange={(e) => handleKindChange(e.target.value as MessageTemplateKind)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
          >
            {(Object.keys(KIND_LABELS) as MessageTemplateKind[]).map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">{KIND_HINTS[kind]}</p>
        </div>

        {/* Subject Line */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Subject Line</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Quote #{{quote_number}} from {{company_name}}"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
          />
        </div>

        {/* Placeholders (filtered by kind) */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Insert variable</label>
          <div className="flex flex-wrap gap-1.5">
            {availableVars.map((v) => (
              <button
                key={v}
                onClick={() => insertPlaceholder(v)}
                className="px-2.5 py-1 text-xs font-medium rounded-full border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 transition"
                title={`{{${v}}}`}
              >
                {VAR_LABELS[v]}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Message Body</label>
          <textarea
            id="message-template-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={14}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none font-mono"
          />
        </div>

        {/* Default toggle */}
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="rounded border-slate-300 text-orange-500 focus:ring-orange-500"
          />
          <span className="text-sm text-slate-600">Set as default for this kind</span>
        </label>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-full border border-slate-300 hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium rounded-full bg-black text-white hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)] disabled:opacity-50"
          >
            {saving ? 'Saving...' : template ? 'Update Template' : 'Create Template'}
          </button>
        </div>
      </div>
    </div>
  );
}
