'use client';
import { useState } from 'react';
import { updateQuoteNames } from '../actions';
import { useRouter } from 'next/navigation';

interface Props {
  quoteId: string;
  customerName: string;
  jobName: string | null;
}

export function QuoteNameEditor({ quoteId, customerName, jobName }: Props) {
  const [editing, setEditing] = useState(false);
  const [client, setClient] = useState(customerName);
  const [reference, setReference] = useState(jobName || '');
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function handleSave() {
    if (!client.trim()) return;
    setSaving(true);
    try {
      await updateQuoteNames(quoteId, client.trim(), reference.trim() || null);
      setEditing(false);
      router.refresh();
    } catch (err) {
      console.error('Failed to update quote names:', err);
      alert('Failed to save changes. Please try again.');
    } finally {
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
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            value={client}
            onChange={e => setClient(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') handleCancel();
            }}
            placeholder="Client name"
            className="flex-1 px-2 py-1 text-xl font-semibold border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
            autoFocus
            disabled={saving}
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            value={reference}
            onChange={e => setReference(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') handleCancel();
            }}
            placeholder="Job reference (optional)"
            className="flex-1 px-2 py-1 text-sm text-slate-500 border border-slate-300 rounded focus:border-blue-500 focus:outline-none"
            disabled={saving}
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving || !client.trim()}
            className="px-3 py-1 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={handleCancel}
            disabled={saving}
            className="px-3 py-1 text-xs rounded-lg border border-slate-300 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{customerName}</h1>
        {jobName && <p className="text-sm text-slate-500 mt-0.5">— {jobName}</p>}
      </div>
      <button
        onClick={() => setEditing(true)}
        className="mt-1 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition"
        title="Edit client and job reference"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      </button>
    </div>
  );
}
