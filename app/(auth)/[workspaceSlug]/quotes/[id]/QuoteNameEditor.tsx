'use client';
import { useState, useId } from 'react';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { QcInput } from '@/app/components/ui/v2/QcField';
import { useQcFeedback } from '@/app/components/ui/v2/useQcFeedback';
import { updateQuoteNames } from '../actions';
import { useRouter } from 'next/navigation';

interface Props {
  quoteId: string;
  customerName: string;
  jobName: string | null;
}

export function QuoteNameEditor({ quoteId, customerName, jobName }: Props) {
  const { notify, feedback } = useQcFeedback();
  const fieldId = useId();
  const [editing, setEditing] = useState(false);
  const [client, setClient] = useState(customerName);
  const [reference, setReference] = useState(jobName || '');
  const [saving, setSaving] = useState(false);
  const _router = useRouter();

  async function handleSave() {
    if (!client.trim()) return;
    setSaving(true);
    try {
      await updateQuoteNames(quoteId, client.trim(), reference.trim() || null);
      window.location.reload();
    } catch (err) {
      console.error('Failed to update quote names:', err);
      await notify('Failed to save changes. Please try again.');
      setSaving(false);
    }
  }

  function handleCancel() {
    setClient(customerName);
    setReference(jobName || '');
    setEditing(false);
  }

  if (editing) {
    return (
      <>
      {feedback}
      <div className="qb-name-edit qb-stack">
        <div className="qc-field">
          <label htmlFor={`${fieldId}-customer`} className="qc-label">Customer name</label>
          <QcInput
            id={`${fieldId}-customer`}
            value={client}
            onChange={e => setClient(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') handleCancel();
            }}
            placeholder="Client name"
            className="qb-full-width"
            autoFocus
            disabled={saving}
          />
        </div>
        <div className="qc-field">
          <label htmlFor={`${fieldId}-job`} className="qc-label">Job reference (optional)</label>
          <QcInput
            id={`${fieldId}-job`}
            value={reference}
            onChange={e => setReference(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') handleCancel();
            }}
            placeholder="Job reference (optional)"
            className="qb-full-width"
            disabled={saving}
          />
        </div>
        <div className="flex gap-2">
          <QcButton
            onClick={handleSave}
            disabled={saving || !client.trim()}
            variant="primary" size="sm"
          >
            {saving ? 'Saving...' : 'Save'}
          </QcButton>
          <QcButton
            onClick={handleCancel}
            disabled={saving}
            size="sm"
          >
            Cancel
          </QcButton>
        </div>
      </div>
      </>
    );
  }

  return (
    <div className="qb-name-heading">
      <div>
        <h1 className="qb-title">{customerName}</h1>
        {jobName && <p className="qb-job-reference">{jobName}</p>}
      </div>
      <QcButton
        onClick={() => setEditing(true)}
        className="qb-edit-name" size="sm"
        title="Edit client and job reference"
      >
        <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
        Edit details
      </QcButton>
    </div>
  );
}
