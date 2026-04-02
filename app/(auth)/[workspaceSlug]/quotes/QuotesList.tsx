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
  const router = useRouter();

  const drafts = quotes.filter(q => q.status === 'draft');
  const confirmed = quotes.filter(q => q.status === 'confirmed' || q.status === 'sent' || q.status === 'accepted');
  const displayQuotes = activeTab === 'draft' ? drafts : confirmed;

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
          Drafts ({drafts.length})
        </button>
        <button
          onClick={() => setActiveTab('confirmed')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition ${
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
                <span className="font-medium text-slate-900">{q.customer_name}</span>
                {q.job_name && <span className="text-slate-500 ml-2">— {q.job_name}</span>}
                <span className="text-xs text-slate-400 ml-3">
                  {new Date(q.created_at).toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  q.status === 'draft' ? 'bg-slate-100 text-slate-600' :
                  q.status === 'sent' ? 'bg-blue-100 text-blue-700' :
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
                      className="px-3 py-1 text-sm rounded-lg border border-slate-300 bg-white hover:bg-slate-50"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => setDeleteId(q.id)}
                      className="px-3 py-1 text-sm rounded-lg border border-red-300 bg-red-50 text-red-600 hover:bg-red-100"
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
                      className="px-3 py-1 text-sm rounded-lg border border-slate-300 bg-white hover:bg-slate-50"
                    >
                      View
                    </Link>
                    <Link
                      href={`/${workspaceSlug}/quotes/${q.id}/customer`}
                      className="px-3 py-1 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                    >
                      Customer Quote
                    </Link>
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
                className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
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
