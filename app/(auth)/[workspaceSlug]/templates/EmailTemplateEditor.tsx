'use client';
import { useState } from 'react';
import { createEmailTemplate, updateEmailTemplate } from './email-actions';
import type { EmailTemplate } from './email-actions';

interface Props {
  template?: EmailTemplate | null;
  onClose: () => void;
  onSaved: () => void;
}

const PLACEHOLDERS = [
  { tag: '{{customer_name}}', label: 'Customer Name' },
  { tag: '{{quote_number}}', label: 'Quote Number' },
  { tag: '{{job_name}}', label: 'Job Reference' },
  { tag: '{{quote_url}}', label: 'Quote Acceptance URL' },
  { tag: '{{company_name}}', label: 'Company Name' },
  { tag: '{{quote_date}}', label: 'Quote Date' },
];

const DEFAULT_BODY = `Hi {{customer_name}},

Thank you for the opportunity to provide a quote for your project.

Please find your quote below. You can review the full details and accept or decline using the link:

{{quote_url}}

Quote #: {{quote_number}}
Job Reference: {{job_name}}

If you have any questions, please don't hesitate to get in touch.

Kind regards,
{{company_name}}`;

export function EmailTemplateEditor({ template, onClose, onSaved }: Props) {
  const [name, setName] = useState(template?.name || '');
  const [subject, setSubject] = useState(template?.subject || 'Quote #{{quote_number}} from {{company_name}}');
  const [body, setBody] = useState(template?.body || DEFAULT_BODY);
  const [isDefault, setIsDefault] = useState(template?.is_default || false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!name.trim()) {
      setError('Template name is required');
      return;
    }
    if (!body.trim()) {
      setError('Email body is required');
      return;
    }

    setSaving(true);
    setError('');
    try {
      if (template) {
        await updateEmailTemplate(template.id, { name, subject, body, is_default: isDefault });
      } else {
        await createEmailTemplate({ name, subject, body, is_default: isDefault });
      }
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  }

  function insertPlaceholder(tag: string) {
    const textarea = document.getElementById('email-body') as HTMLTextAreaElement | null;
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
      setBody(prev => prev + tag);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">
            {template ? 'Edit Email Template' : 'Create Email Template'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
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
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Standard Quote Email"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
          />
        </div>

        {/* Subject Line */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Subject Line</label>
          <input
            type="text"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="Quote #{{quote_number}} from {{company_name}}"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
          />
        </div>

        {/* Placeholders */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Insert Placeholder</label>
          <div className="flex flex-wrap gap-1.5">
            {PLACEHOLDERS.map(p => (
              <button
                key={p.tag}
                onClick={() => insertPlaceholder(p.tag)}
                className="px-2.5 py-1 text-xs font-medium rounded-full border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 transition"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Email Body */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email Body</label>
          <textarea
            id="email-body"
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={14}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none font-mono"
          />
        </div>

        {/* Default toggle */}
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={e => setIsDefault(e.target.checked)}
            className="rounded border-slate-300 text-orange-500 focus:ring-orange-500"
          />
          <span className="text-sm text-slate-600">Set as default email template</span>
        </label>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-full border border-slate-300 hover:bg-slate-50"
          >
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
