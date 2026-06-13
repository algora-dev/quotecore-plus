'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { deleteInvoiceTemplate, type InvoiceTemplate } from '@/app/(auth)/[workspaceSlug]/invoices/template-actions';
import { ConfirmModal } from '@/app/components/ConfirmModal';

interface Props {
  workspaceSlug: string;
  initialTemplates: InvoiceTemplate[];
}

export function InvoiceTemplatesList({ workspaceSlug, initialTemplates }: Props) {
  const router = useRouter();
  const [templates, setTemplates] = useState<InvoiceTemplate[]>(initialTemplates);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const confirmTemplate = templates.find((t) => t.id === confirmDeleteId);

  async function handleConfirmDelete() {
    if (!confirmDeleteId) return;
    setDeleting(true);
    try {
      await deleteInvoiceTemplate(confirmDeleteId);
      setTemplates((prev) => prev.filter((t) => t.id !== confirmDeleteId));
      setConfirmDeleteId(null);
    } catch {
      alert('Failed to delete template.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex justify-end">
        <Link
          href={`/${workspaceSlug}/resources/invoice-templates/new`}
          className="inline-flex items-center gap-1.5 rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)] ring-2 ring-transparent hover:ring-orange-400/30"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Template
        </Link>
      </div>

      {/* List */}
      {templates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
          <p className="text-sm text-slate-500">No invoice templates yet.</p>
          <Link
            href={`/${workspaceSlug}/resources/invoice-templates/new`}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create First Template
          </Link>
        </div>
      ) : (
        <div className="grid gap-1">
          {templates.map((t) => (
            <div
              key={t.id}
              className="grid sm:grid-cols-[1fr_auto] gap-4 items-center rounded-xl border bg-white px-4 py-4 border-slate-200 hover:bg-orange-50/40 hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] transition group"
            >
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 text-sm">{t.name}</p>
                <div className="flex flex-wrap gap-3 mt-1">
                  {t.company_name && (
                    <span className="text-xs text-slate-500">{t.company_name}</span>
                  )}
                  {(t.payment_account_number || t.payment_account_name) && (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                      Payment details set
                    </span>
                  )}
                  {t.payment_link && (
                    <span className="inline-flex items-center gap-1 text-xs text-blue-600">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      Pay link
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Link
                  href={`/${workspaceSlug}/resources/invoice-templates/${t.id}/edit`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-all"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit
                </Link>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(t.id)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-all"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* App-style confirm delete modal */}
      <ConfirmModal
        open={confirmDeleteId !== null}
        title={`Delete "${confirmTemplate?.name ?? 'template'}"?`}
        description="This template will be permanently deleted. Invoices that used it won't be affected."
        confirmLabel="Delete Template"
        cancelLabel="Keep"
        destructive
        pending={deleting}
        pendingLabel="Deleting…"
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
