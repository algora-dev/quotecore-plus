'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { deleteQuote, updateQuoteJobStatus } from './actions';
import type { JobStatus } from './actions';
import { useRouter } from 'next/navigation';

type Quote = {
  id: string;
  customer_name: string;
  job_name: string | null;
  status: string;
  quote_number: number | null;
  created_at: string;
  job_status: string | null;
};

interface Props {
  quotes: Quote[];
  workspaceSlug: string;
}

const JOB_STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  unsent:            { label: 'Unsent',            bg: 'bg-slate-50',    text: 'text-slate-600',   border: 'border-slate-300' },
  sent:              { label: 'Sent',              bg: 'bg-orange-50',   text: 'text-orange-700',  border: 'border-orange-300' },
  accepted:          { label: 'Accepted',          bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-emerald-300' },
  declined:          { label: 'Declined',          bg: 'bg-red-50',      text: 'text-red-700',     border: 'border-red-300' },
  deposit_paid:      { label: 'Deposit Paid',      bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-emerald-300' },
  materials_ordered: { label: 'Materials Ordered', bg: 'bg-blue-50',     text: 'text-blue-700',    border: 'border-blue-300' },
  install:           { label: 'Install',           bg: 'bg-blue-50',     text: 'text-blue-700',    border: 'border-blue-300' },
  invoice_sent:      { label: 'Invoice Sent',      bg: 'bg-orange-50',   text: 'text-orange-700',  border: 'border-orange-300' },
  invoice_paid:      { label: 'Invoice Paid',      bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-emerald-300' },
  finished:          { label: 'Finished',          bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-emerald-300' },
};

const JOB_STATUS_ORDER: string[] = [
  'unsent', 'sent', 'accepted', 'declined', 'deposit_paid',
  'materials_ordered', 'install', 'invoice_sent', 'invoice_paid', 'finished',
];

function JobStatusDropdown({ quoteId, currentStatus }: { quoteId: string; currentStatus: string }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(currentStatus);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const config = JOB_STATUS_CONFIG[status] || JOB_STATUS_CONFIG.unsent;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  async function handleSelect(newStatus: string) {
    if (newStatus === status) {
      setOpen(false);
      return;
    }
    setSaving(true);
    setOpen(false);
    try {
      await updateQuoteJobStatus(quoteId, newStatus as JobStatus);
      setStatus(newStatus);
      router.refresh();
    } catch (err) {
      console.error('Failed to update job status:', err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        disabled={saving}
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border transition-all hover:shadow-sm ${config.bg} ${config.text} ${config.border} ${saving ? 'opacity-50' : ''}`}
      >
        {saving ? '...' : config.label}
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {JOB_STATUS_ORDER.map((s) => {
            const c = JOB_STATUS_CONFIG[s];
            const isActive = s === status;
            return (
              <button
                key={s}
                onClick={() => handleSelect(s)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs transition hover:bg-slate-50 ${isActive ? 'font-semibold' : ''}`}
              >
                <span className={`inline-block w-2 h-2 rounded-full ${c.bg} border ${c.border}`} />
                <span className={isActive ? c.text : 'text-slate-700'}>{c.label}</span>
                {isActive && (
                  <svg className="w-3 h-3 ml-auto text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function QuotesList({ quotes, workspaceSlug }: Props) {
  const [activeTab, setActiveTab] = useState<'draft' | 'confirmed'>('confirmed');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  const drafts = quotes.filter(q => q.status === 'draft');
  const confirmed = quotes
    .filter(q => q.status === 'confirmed' || q.status === 'sent' || q.status === 'accepted')
    .sort((a, b) => (b.quote_number || 0) - (a.quote_number || 0));
  
  const filteredDrafts = drafts.filter(q => 
    q.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (q.job_name && q.job_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );
  
  const filteredConfirmed = confirmed.filter(q => 
    (q.quote_number && q.quote_number.toString().includes(searchQuery)) ||
    q.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (q.job_name && q.job_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );
  
  const displayQuotes = activeTab === 'draft' ? filteredDrafts : filteredConfirmed;

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await deleteQuote(deleteId);
      setDeleteId(null);
      router.refresh();
    } catch (err) {
      console.error('Failed to delete quote:', err);
      alert('Failed to delete quote. Please try again.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      {/* Tabs + Actions row */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 p-1 bg-slate-100 rounded-full w-fit">
          <button
            onClick={() => setActiveTab('confirmed')}
            className={`px-4 py-1.5 text-sm font-medium rounded-full transition ${
              activeTab === 'confirmed'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Confirmed ({confirmed.length})
          </button>
          <button
            onClick={() => setActiveTab('draft')}
            className={`px-4 py-1.5 text-sm font-medium rounded-full transition ${
              activeTab === 'draft'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Drafts ({drafts.length})
          </button>
        </div>
        
        <div className="flex gap-2">
          <Link
            href={`/${workspaceSlug}/quotes/new`}
            className="inline-flex items-center rounded-full bg-black px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
          >
            + New Quote
          </Link>
          <Link
            href={`/${workspaceSlug}/templates`}
            className="inline-flex items-center rounded-full bg-[#FF6B35] px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-[#ff5722] hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
          >
            Templates
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={activeTab === 'confirmed' ? 'Search by quote #, client, or job...' : 'Search by client or job...'}
          className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
        />
        <svg 
          className="absolute left-3 top-2.5 w-4 h-4 text-slate-400"
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        )}
      </div>

      {/* Quote List */}
      {displayQuotes.length > 0 ? (
        <div className="grid gap-2">
          {displayQuotes.map((q) => (
            <div
              key={q.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 hover:shadow-sm transition"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {q.quote_number && (
                    <span className="font-semibold text-orange-600 text-sm">#{q.quote_number}</span>
                  )}
                  <span className="font-medium text-slate-900 text-sm truncate">{q.customer_name}</span>
                  {q.job_name && <span className="text-slate-400 text-sm truncate">— {q.job_name}</span>}
                </div>
                <span className="text-xs text-slate-400 mt-0.5 block">
                  {new Date(q.created_at).toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>
              
              <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                {q.status === 'draft' && (
                  <span className="rounded-full px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-500">
                    Draft
                  </span>
                )}

                {q.status !== 'draft' && (
                  <JobStatusDropdown
                    quoteId={q.id}
                    currentStatus={q.job_status || 'unsent'}
                  />
                )}

                {q.status === 'draft' ? (
                  <Link
                    href={`/${workspaceSlug}/quotes/${q.id}`}
                    className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full border border-slate-300 bg-white pill-shimmer"
                  >
                    Edit
                  </Link>
                ) : (
                  <Link
                    href={`/${workspaceSlug}/quotes/${q.id}/summary`}
                    className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full border border-slate-300 bg-white pill-shimmer"
                  >
                    View
                  </Link>
                )}

                <button
                  onClick={() => setDeleteId(q.id)}
                  className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full border border-red-200 bg-white text-red-500 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
          <p className="text-sm text-slate-500">
            {activeTab === 'draft' 
              ? 'No draft quotes yet.' 
              : 'No confirmed quotes yet.'}
          </p>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Delete Quote</h3>
            <p className="text-sm text-slate-500 mt-2">
              This action cannot be undone. The quote will be permanently deleted.
            </p>
            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-sm font-medium rounded-full bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
