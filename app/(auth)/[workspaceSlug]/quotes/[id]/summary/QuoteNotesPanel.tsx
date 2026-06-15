'use client';

import { useState, useTransition } from 'react';
import { addQuoteNote, updateQuoteNote, deleteQuoteNote } from './quote-notes-actions';
import { ConfirmModal } from '@/app/components/ConfirmModal';

export interface QuoteNote {
  id: string;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
  /** Author populated from server-side join on created_by_user_id. */
  author?: { full_name: string | null } | null;
}

interface Props {
  quoteId: string;
  initialNotes: QuoteNote[];
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface NoteRowProps {
  note: QuoteNote;
  onUpdated: (updated: QuoteNote) => void;
  onDeleted: (id: string) => void;
}

function NoteRow({ note, onUpdated, onDeleted }: NoteRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(note.title);
  const [editBody, setEditBody] = useState(note.body);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleEdit() {
    setEditTitle(note.title);
    setEditBody(note.body);
    setError(null);
    setEditing(true);
    setExpanded(true);
  }

  function handleSaveEdit() {
    setError(null);
    startTransition(async () => {
      try {
        await updateQuoteNote(note.id, editTitle, editBody);
        onUpdated({ ...note, title: editTitle.trim(), body: editBody.trim(), updated_at: new Date().toISOString() });
        setEditing(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Save failed');
      }
    });
  }

  function doDelete() {
    setConfirmDelete(false);
    startTransition(async () => {
      try {
        await deleteQuoteNote(note.id);
        onDeleted(note.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Delete failed');
      }
    });
  }

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {/* Title row — click to expand/collapse body */}
        <button
          type="button"
          onClick={() => { if (!editing) setExpanded((p) => !p); }}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50/60 transition-colors group"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">{note.title}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {note.author?.full_name && (
                <span className="font-medium text-slate-500">{note.author.full_name} · </span>
              )}
              {formatDateTime(note.created_at)}
              {note.updated_at !== note.created_at && ' · edited'}
            </p>
          </div>
          <div className="flex items-center gap-2 ml-3 flex-shrink-0">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleEdit(); }}
              disabled={isPending}
              className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              aria-label="Edit note"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
              disabled={isPending}
              className="p-1 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
              aria-label="Delete note"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
            <svg
              className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {/* Expanded body / edit form */}
        {expanded && (
          <div className="border-t border-slate-100 px-4 py-3 bg-slate-50/40">
            {editing ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Title</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-400 focus:outline-none bg-white"
                    placeholder="Note title"
                    maxLength={100}
                    disabled={isPending}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Note</label>
                  <textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    rows={5}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-400 focus:outline-none bg-white resize-y"
                    placeholder="Note content"
                    maxLength={2000}
                    disabled={isPending}
                  />
                </div>
                {error && <p className="text-xs text-rose-600">{error}</p>}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    disabled={isPending}
                    className="px-4 py-1.5 text-xs font-medium rounded-full bg-black text-white hover:bg-slate-800 disabled:opacity-50 transition-all hover:shadow-[0_0_8px_rgba(255,107,53,0.3)]"
                  >
                    {isPending ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditing(false); setError(null); }}
                    disabled={isPending}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{note.body}</p>
            )}
          </div>
        )}
      </div>

      {/* Styled delete confirmation — matches app-wide ConfirmModal pattern */}
      <ConfirmModal
        open={confirmDelete}
        title="Delete this note?"
        description="This note will be permanently removed. This cannot be undone."
        confirmLabel="Delete"
        pending={isPending}
        pendingLabel="Deleting…"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={doDelete}
      />
    </>
  );
}

interface AddFormProps {
  onAdded: (note: QuoteNote) => void;
  onCancel: () => void;
  quoteId: string;
}

function AddNoteForm({ onAdded, onCancel, quoteId }: AddFormProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        const { id } = await addQuoteNote(quoteId, title, body);
        const now = new Date().toISOString();
        onAdded({ id, title: title.trim(), body: body.trim(), created_at: now, updated_at: now });
        setTitle('');
        setBody('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save note');
      }
    });
  }

  return (
    <div className="rounded-xl border border-orange-200 bg-orange-50/40 p-4 space-y-3">
      <p className="text-xs font-semibold text-slate-700">New note</p>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-400 focus:outline-none bg-white"
          placeholder="e.g. Site visit notes, Customer call summary…"
          maxLength={100}
          disabled={isPending}
          autoFocus
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Note</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-400 focus:outline-none bg-white resize-y"
          placeholder="Enter your note here…"
          maxLength={2000}
          disabled={isPending}
        />
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending || !title.trim() || !body.trim()}
          className="px-4 py-1.5 text-xs font-medium rounded-full bg-black text-white hover:bg-slate-800 disabled:opacity-50 transition-all hover:shadow-[0_0_8px_rgba(255,107,53,0.3)]"
        >
          {isPending ? 'Saving…' : 'Save note'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="text-xs text-slate-400 hover:text-slate-600"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function QuoteNotesPanel({ quoteId, initialNotes }: Props) {
  const [sectionOpen, setSectionOpen] = useState(true);
  const [notes, setNotes] = useState<QuoteNote[]>(initialNotes);
  const [adding, setAdding] = useState(false);

  function handleAdded(note: QuoteNote) {
    setNotes((prev) => [note, ...prev]);
    setAdding(false);
  }

  function handleUpdated(updated: QuoteNote) {
    setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
  }

  function handleDeleted(id: string) {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      {/* Section header */}
      <button
        type="button"
        onClick={() => setSectionOpen((p) => !p)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/60 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="text-sm font-semibold text-slate-900">Notes</span>
          {notes.length > 0 && (
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-600">
              {notes.length}
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${sectionOpen ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {sectionOpen && (
        <div className="border-t border-slate-100 px-5 py-4 space-y-3">
          {!adding && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-orange-300 hover:text-orange-700 transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
              </svg>
              Add note
            </button>
          )}

          {adding && (
            <AddNoteForm
              quoteId={quoteId}
              onAdded={handleAdded}
              onCancel={() => setAdding(false)}
            />
          )}

          {notes.length === 0 && !adding && (
            <p className="text-xs text-slate-400 py-2">No notes yet. Add one to keep track of anything relevant to this quote.</p>
          )}

          <div className="space-y-2">
            {notes.map((note) => (
              <NoteRow
                key={note.id}
                note={note}
                onUpdated={handleUpdated}
                onDeleted={handleDeleted}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
