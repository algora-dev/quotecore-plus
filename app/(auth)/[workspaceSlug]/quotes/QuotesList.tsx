'use client';
import { useState } from 'react';
import Link from 'next/link';
import { deleteQuote } from './actions';
import { useRouter } from 'next/navigation';

type Quote = {
  id: string;
  customer_name: string;
  job_name: string | null;
  status: string;
  quote_number: number | null;
  created_at: string;
};

interface Props {
  quotes: Quote[];
  workspaceSlug: string;
}

export function QuotesList({ quotes, workspaceSlug }: Props) {
  const [activeTab, setActiveTab] = useState<'draft' | 'confirmed'>('draft');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  const drafts = quotes.filter(q => q.status === 'draft');
  const confirmed = quotes
    .filter(q => q.status === 'confirmed' || q.status === 'sent' || q.status === 'accepted')
    .sort((a, b) => (b.quote_number || 0) - (a.quote_number || 0)); // Sort by quote number desc
  
  // Filter by search query
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
      {/* Search */}
      <div className="relative max-w-md">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={activeTab === 'confirmed' ? 'Search by quote #, client, or job reference...' : 'Search by client or job reference...'}
          className="w-full pl-10 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
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

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('draft')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition ${
            activeTab === 'draft'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Drafts ({searchQuery ? `${filteredDrafts.length}/${drafts.length}` : drafts.length})
        </button>
        <button
          onClick={() => setActiveTab('confirmed')}
          className={`px-4 py-2 text-sm font-medium rounded-full transition ${
            activeTab === 'confirmed'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Confirmed ({confirmed.length})
        </button>
      </div>

      {/* Quote List */}
      {displayQuotes.length > 0 ? (
        <div className="grid gap-3">
          {displayQuotes.map((q) => (
            <div
              key={q.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 hover:shadow-md transition"
            >
              <div className="flex-1">
                {q.quote_number && (
                  <span className="font-semibold text-orange-600 mr-3">Quote #{q.quote_number}</span>
                )}
                <span className="font-medium text-slate-900">{q.customer_name}</span>
                {q.job_name && <span className="text-slate-500 ml-2">— {q.job_name}</span>}
                <span className="text-xs text-slate-400 ml-3">
                  {new Date(q.created_at).toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  q.status === 'draft' ? 'bg-slate-100 text-slate-600' :
                  q.status === 'sent' ? 'bg-orange-100 text-orange-700' :
                  q.status === 'accepted' ? 'bg-emerald-100 text-emerald-700' :
                  q.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  {q.status}
                </span>

                {/* Draft actions */}
                {q.status === 'draft' && (
                  <>
                    <Link
                      href={`/${workspaceSlug}/quotes/${q.id}`}
                      className="px-3 py-1 text-sm rounded-full border border-slate-300 bg-white hover:bg-slate-50"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => setDeleteId(q.id)}
                      className="px-3 py-1 text-sm rounded-full border border-red-300 bg-red-50 text-red-600 hover:bg-red-100"
                    >
                      Delete
                    </button>
                  </>
                )}

                {/* Confirmed actions */}
                {q.status !== 'draft' && (
                  <>
                    <Link
                      href={`/${workspaceSlug}/quotes/${q.id}/summary`}
                      className="px-3 py-1 text-sm rounded-full border border-slate-300 bg-white hover:bg-slate-50"
                    >
                      View
                    </Link>
                    <button
                      onClick={() => setDeleteId(q.id)}
                      className="px-3 py-1 text-sm rounded-full border border-red-300 bg-red-50 text-red-600 hover:bg-red-100"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <h2 className="text-xl font-semibold text-slate-900">
            No {activeTab} quotes yet
          </h2>
          <p className="mt-2 text-slate-600">
            {activeTab === 'draft' 
              ? 'Create a new quote to get started.' 
              : 'Confirmed quotes will appear here after you complete them.'}
          </p>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md mx-4 space-y-4">
            <h3 className="text-lg font-semibold text-red-600">Delete Quote?</h3>
            <p className="text-sm text-slate-600">
              Are you sure you want to delete this quote? This action cannot be undone and the quote will be gone forever.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 text-sm rounded-lg border border-slate-300 hover:bg-slate-50"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-sm font-medium rounded-full bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete Forever'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
