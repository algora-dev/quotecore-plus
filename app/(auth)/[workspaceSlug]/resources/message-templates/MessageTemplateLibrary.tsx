'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { QcLibrary, QcLibraryEmpty, QcLibraryError, QcTemplateNav } from '@/app/components/ui/v2/QcLibrary';
import { QcJourneyHeader } from '@/app/components/ui/v2/QcJourney';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { QcIcon } from '@/app/components/ui/v2/QcIcon';
import { ConfirmModal } from '@/app/components/ConfirmModal';
import { EmailTemplateEditor } from '../EmailTemplateEditor';
import { deleteEmailTemplate, type EmailTemplate, type MessageTemplateKind } from '../email-actions';
import type { AttachmentRow } from '../../attachments/actions';

const PURPOSES: { key: MessageTemplateKind | 'all'; label: string }[] = [
  { key: 'all', label: 'All messages' }, { key: 'custom', label: 'General' },
  { key: 'quote_send', label: 'Quotes' }, { key: 'order_send', label: 'Orders' },
  { key: 'followup', label: 'Follow-ups' }, { key: 'decline_response', label: 'Decline responses' },
];
interface Props {
  workspaceSlug: string; templates: EmailTemplate[]; attachments: AttachmentRow[];
  attachmentsEnabled: boolean; loadError?: boolean; attachmentLoadError?: boolean;
}

/** The existing Send controllers deliberately offer ALL company templates.
 * Purpose guides variables/default copy only; it is not a send-time restriction.
 * Do not introduce an invoice_send/all DB enum or per-kind default semantics.
 */
export function MessageTemplateLibrary({ workspaceSlug, templates, attachments, attachmentsEnabled, loadError = false, attachmentLoadError = false }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [purpose, setPurpose] = useState<MessageTemplateKind | 'all'>('all');
  const [editing, setEditing] = useState<EmailTemplate | null | undefined>(undefined);
  const [pendingDelete, setPendingDelete] = useState<EmailTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const visible = templates.filter(t => !removed.has(t.id) && (purpose === 'all' || (t.kind || 'custom') === purpose)
    && `${t.name} ${t.subject}`.toLowerCase().includes(search.trim().toLowerCase()));

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true); setError('');
    try { await deleteEmailTemplate(pendingDelete.id); setRemoved(prev => new Set(prev).add(pendingDelete.id)); setPendingDelete(null); router.refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to delete this message template.'); setPendingDelete(null); }
    finally { setDeleting(false); }
  }

  return <QcLibrary>
    <QcJourneyHeader title="Message templates" eyebrow="Resources" description="Write once, reuse when sending quotes, invoices and orders. Your template name appears in the Send selector.">
      <QcButton variant="primary" onClick={() => setEditing(null)} disabled={loadError || attachmentLoadError}><QcIcon name="plus" />New message template</QcButton>
    </QcJourneyHeader>
    <QcTemplateNav workspaceSlug={workspaceSlug} current="messages" />
    {loadError && <QcLibraryError title="Message templates could not be loaded" onRetry={() => router.refresh()}>Your saved templates are unavailable. Retry before creating or editing.</QcLibraryError>}
    {attachmentLoadError && <QcLibraryError title="Attachment library could not be loaded" onRetry={() => router.refresh()}>Editing is paused so a saved default attachment cannot be accidentally cleared. Retry to continue.</QcLibraryError>}
    {error && <QcLibraryError>{error}</QcLibraryError>}
    <div className="qc-library-toolbar">
      <label className="qc-library-search">Search message templates<input type="search" className="qc-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or subject" /></label>
      <label className="qc-library-search" style={{ maxWidth: 240 }}>Message purpose<select className="qc-select" value={purpose} onChange={e => setPurpose(e.target.value as MessageTemplateKind | 'all')}>
        {PURPOSES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
      </select></label>
    </div>
    <p className="qc-flow-result" role="status">{visible.length} template{visible.length === 1 ? '' : 's'} shown</p>
    {!loadError && (visible.length ? <div className="qc-library-results">{visible.map(t => <article className="qc-library-result" key={t.id}>
      <div className="qc-library-result-icon"><QcIcon name="mail" /></div>
      <div><h2><button type="button" className="qc-library-action-name" disabled={attachmentLoadError} onClick={() => setEditing(t)}>{t.name}</button></h2>
        <div className="qc-library-result-meta"><span className="qc-library-badge">{PURPOSES.find(p => p.key === (t.kind || 'custom'))?.label ?? 'Saved message'}</span>
          {t.is_default && <span className="qc-library-badge">Default message</span>}{t.attachment_id && <span className="qc-library-badge">Attachment</span>}</div>
        <p>{t.subject || 'No subject saved'}</p></div>
      <div className="qc-library-row-actions"><QcButton disabled={attachmentLoadError} onClick={() => setEditing(t)} aria-label={`Edit ${t.name}`}>Edit</QcButton>
        <QcButton className="qc-icon-button" onClick={() => setPendingDelete(t)} aria-label={`Delete ${t.name}`}><QcIcon name="trash" /></QcButton></div>
    </article>)}</div> : <QcLibraryEmpty title={search || purpose !== 'all' ? 'No matching messages' : 'Start with a message you send often'}
      action={search || purpose !== 'all' ? <QcButton onClick={() => { setSearch(''); setPurpose('all'); }}>Clear filters</QcButton>
        : <QcButton variant="primary" disabled={attachmentLoadError} onClick={() => setEditing(null)}>Create a message template</QcButton>}>
      {search || purpose !== 'all' ? 'Try another name or purpose.' : 'A general message works across quotes, orders and invoices. Specific purposes provide the matching document variables.'}
    </QcLibraryEmpty>)}
    <p className="qc-flow-description" style={{ marginTop: 20 }}>Purpose helps you write the message; all saved message templates remain available in Send. Use General for an invoice or a message you share across document types.</p>
    {editing !== undefined && <EmailTemplateEditor template={editing} attachments={attachments} attachmentsEnabled={attachmentsEnabled}
      onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); router.refresh(); }} />}
    <ConfirmModal open={!!pendingDelete} title={`Delete “${pendingDelete?.name ?? 'message template'}”?`} description="This removes the reusable message. This action cannot be undone."
      destructive pending={deleting} pendingLabel="Deleting…" confirmLabel="Delete template" cancelLabel="Keep template" onCancel={() => setPendingDelete(null)} onConfirm={confirmDelete} />
  </QcLibrary>;
}
