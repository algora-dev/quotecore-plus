'use client';
import { useMemo, useState } from 'react';
import { QcLibrary, QcLibraryError } from '@/app/components/ui/v2/QcLibrary';
import { QcJourneyDialog } from '@/app/components/ui/v2/QcJourney';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { QcIcon } from '@/app/components/ui/v2/QcIcon';
import {
  createEmailTemplate,
  updateEmailTemplate,
  type EmailTemplate,
  type MessageTemplateKind,
} from './email-actions';
import { variablesForKind, VAR_LABELS } from '@/app/lib/messages/mergeVars';
import type { AttachmentRow } from '../attachments/actions';

interface Props {
  template?: EmailTemplate | null;
  /** Company attachment library (all rows; archived ones filtered out here). */
  attachments?: AttachmentRow[];
  /** Pro+ entitlement (feat_attachment_library). Gates the baked-file picker. */
  attachmentsEnabled?: boolean;
  onClose: () => void;
  onSaved: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
  custom: 'General - quotes, invoices & orders',
};

const KIND_HINTS: Record<MessageTemplateKind, string> = {
  quote_send: 'Provides quote-specific variables. Check these values when using this message for a different document.',
  order_send: 'Provides supplier/order variables. Check them when using this message for a different document.',
  followup: 'Quote follow-up wording and variables. Existing follow-up scheduling remains in Send.',
  decline_response: 'Quote-related response wording and variables.',
  custom: 'Reusable with any document, including invoices. Company variables are available; document-specific variables are not inserted here.',
};

const DEFAULT_BODY_BY_KIND: Record<MessageTemplateKind, string> = {
  quote_send: `Hi {{customer_name}},

Thank you for the opportunity to provide a quote for {{job_name}}.

Quote #: {{quote_number}}

Please review and respond using the link below.

Kind regards,
{{company_name}}`,
  order_send: `Hi {{order_supplier}},

Please review our order {{order_number}}.

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

export function EmailTemplateEditor({
  template,
  attachments = [],
  attachmentsEnabled = false,
  onClose,
  onSaved,
}: Props) {
  const [name, setName] = useState(template?.name || '');
  // `template.kind` was added in the 2026-05-12 migration; old rows default to 'custom'.
  const [kind, setKind] = useState<MessageTemplateKind>(
    (template?.kind as MessageTemplateKind) || 'custom',
  );
  const [subject, setSubject] = useState(
    template?.subject ?? 'A document from {{company_name}}',
  );
  const [body, setBody] = useState(template?.body ?? DEFAULT_BODY_BY_KIND.custom);
  const [isDefault, setIsDefault] = useState(template?.is_default || false);
  // Baked default attachment (company_attachments id) - Phase 4. The send-time
  // resolver re-verifies ownership; here we only offer this company's files.
  const [attachmentId, setAttachmentId] = useState<string | null>(
    template?.attachment_id ?? null,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Active (non-archived) library files only.
  const activeAttachments = useMemo(
    () => attachments.filter((a) => !a.archived_at),
    [attachments],
  );

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
      // Only persist a baked attachment when the company is entitled AND the
      // chosen id still exists in the active library (guards a stale selection).
      const bakedAttachmentId =
        attachmentsEnabled && attachmentId && activeAttachments.some((a) => a.id === attachmentId)
          ? attachmentId
          : null;
      if (template) {
        await updateEmailTemplate(template.id, {
          name, subject, body, is_default: isDefault, kind, attachment_id: bakedAttachmentId,
        });
      } else {
        await createEmailTemplate({
          name, subject, body, is_default: isDefault, kind, attachment_id: bakedAttachmentId,
        });
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

  return <QcJourneyDialog label={template ? 'Edit message template' : 'New message template'} size="lg" pending={saving}>
    <QcLibrary className="qc-library-dialog-pad">
      <div className="qc-library-dialog-heading"><div>
        <h2>{template ? 'Edit message template' : 'New message template'}</h2>
        <p>Name it, write your message and reuse it from Send. This does not send an email.</p>
      </div><QcButton className="qc-icon-button" onClick={onClose} disabled={saving} aria-label="Close message editor"><QcIcon name="close" /></QcButton></div>
      {error && <QcLibraryError>{error}</QcLibraryError>}
      <div className="qc-message-grid">
        <div className="qc-library-stack">
          <label className="qc-field"><span className="qc-flow-label">Template name</span>
            <input className="qc-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Standard document cover email" />
            <span className="qc-template-name-note">This exact name appears in the Send template selector.</span>
          </label>
          <label className="qc-field"><span className="qc-flow-label">Subject</span>
            <input className="qc-input" value={subject} onChange={e => setSubject(e.target.value)} placeholder="A document from {{company_name}}" />
          </label>
          <label className="qc-field" htmlFor="message-template-body"><span className="qc-flow-label">Message</span>
            <textarea id="message-template-body" className="qc-input" value={body} onChange={e => setBody(e.target.value)} rows={12} />
          </label>
          <details className="qc-flow-panel">
            <summary className="qc-flow-control qc-library-summary">Variables & message purpose</summary>
            <label className="qc-field" style={{ marginTop: 16 }}><span className="qc-flow-label">Purpose</span>
              <select className="qc-select" value={kind} onChange={e => handleKindChange(e.target.value as MessageTemplateKind)}>
                {(Object.keys(KIND_LABELS) as MessageTemplateKind[]).map(k => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
              </select><span className="qc-template-name-note">{KIND_HINTS[kind]}</span>
            </label>
            <p className="qc-flow-description" style={{ marginTop: 12 }}>Insert at the message cursor. Values fill in when sent; check document-specific variables before sending.</p>
            <div className="qc-library-action-row">{availableVars.map(v => <QcButton key={v} size="sm" onClick={() => insertPlaceholder(v)} title={`{{${v}}}`}>{VAR_LABELS[v]}</QcButton>)}</div>
          </details>
          <details className="qc-flow-panel">
            <summary className="qc-flow-control qc-library-summary">Default message & attachment</summary>
            <label className="qc-library-action-row" style={{ marginTop: 16 }}><input type="checkbox" className="qc-checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} />
              <span className="qc-flow-label">Use as the default message in Send</span></label>
            <p className="qc-template-name-note">The existing default is shared across document types, not a separate default for each purpose.</p>
            <label className="qc-field" style={{ marginTop: 16 }}><span className="qc-flow-label">Default attachment</span>
              {!attachmentsEnabled ? <span className="qc-template-name-note">File attachments in templates require the attachment-library feature on your plan.</span>
                : activeAttachments.length === 0 ? <span className="qc-template-name-note">No active files. Add one in Resources → Attachments, then return here.</span>
                : <><select className="qc-select" value={attachmentId ?? ''} onChange={e => setAttachmentId(e.target.value || null)}>
                  <option value="">No attachment</option>{activeAttachments.map(a => <option key={a.id} value={a.id}>{a.name} ({formatBytes(a.file_size)})</option>)}
                </select><span className="qc-template-name-note">Preselects a downloadable library file. You can change the attachment before sending.</span></>}
            </label>
          </details>
        </div>
        <aside className="qc-message-preview" aria-label="Message wording preview">
          <h3>Message preview</h3>
          <div className="qc-message-paper"><strong>{subject || 'Your subject'}</strong><p>{body || 'Your message will appear here.'}</p></div>
          <p className="qc-template-name-note">Wording preview only. Variables, document links and email delivery styling are applied by the existing Send system.</p>
        </aside>
      </div>
      <div className="qc-flow-dialog-footer"><QcButton onClick={onClose} disabled={saving}>Cancel</QcButton>
        <QcButton variant="primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : template ? 'Save changes' : 'Create template'}</QcButton>
      </div>
    </QcLibrary>
  </QcJourneyDialog>;
}
