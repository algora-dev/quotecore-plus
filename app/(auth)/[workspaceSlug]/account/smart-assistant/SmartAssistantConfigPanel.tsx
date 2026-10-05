'use client';

import { useRef, useState, useTransition } from 'react';
import {
  saveAssistantConfig,
  uploadKnowledgeDoc,
  withdrawKnowledgeDoc,
} from './actions';

export type ConfigDoc = {
  id: string;
  file_name: string;
  status: string;
  size_bytes: number | null;
  created_at: string;
};

type Props = {
  initialName: string;
  initialGreeting: string;
  initialRules: string[];
  initialEnabled: boolean;
  initialMembersCanManage: boolean;
  docs: ConfigDoc[];
};

const statusBadge: Record<string, string> = {
  ready: 'bg-emerald-50 text-emerald-700',
  processing: 'bg-amber-50 text-amber-700',
  uploaded: 'bg-slate-100 text-slate-500',
  failed: 'bg-red-50 text-red-700',
  withdrawn: 'bg-slate-100 text-slate-400',
};

export function SmartAssistantConfigPanel({
  initialName,
  initialGreeting,
  initialRules,
  initialEnabled,
  initialMembersCanManage,
  docs,
}: Props) {
  const [name, setName] = useState(initialName);
  const [greeting, setGreeting] = useState(initialGreeting);
  const [rulesText, setRulesText] = useState(initialRules.join('\n'));
  const [enabled, setEnabled] = useState(initialEnabled);
  const [membersCanManage, setMembersCanManage] = useState(initialMembersCanManage);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function save() {
    setFeedback(null);
    startTransition(async () => {
      const result = await saveAssistantConfig({
        name,
        greeting,
        customRules: rulesText.split('\n'),
        enabled,
        membersCanManage,
      });
      setFeedback({ ok: result.ok, text: result.ok ? result.message : result.error });
    });
  }

  async function onUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    setFeedback(null);
    const result = await uploadKnowledgeDoc(file);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
    setFeedback({ ok: result.ok, text: result.ok ? result.message : result.error });
    if (result.ok) window.location.reload();
  }

  function withdraw(docId: string) {
    startTransition(async () => {
      const result = await withdrawKnowledgeDoc(docId);
      if (result.ok) window.location.reload();
      else setFeedback({ ok: false, text: result.error });
    });
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {feedback && (
        <div
          className={`rounded-xl border p-3 text-sm ${
            feedback.ok
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Persona */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Assistant identity</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            How the assistant presents itself and behaves in conversations.
          </p>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-900">Enable the assistant</p>
            <p className="text-xs text-slate-500">
              When off, the assistant does not respond to new messages.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEnabled(!enabled)}
            className={`relative h-6 w-11 rounded-full transition-colors ${
              enabled ? 'bg-emerald-500' : 'bg-slate-200'
            }`}
            aria-pressed={enabled}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                enabled ? 'translate-x-[22px]' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-900">Allow team members to manage</p>
            <p className="text-xs text-slate-500">
              When off, only the workspace owner or an admin can change these settings.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMembersCanManage(!membersCanManage)}
            className={`relative h-6 w-11 rounded-full transition-colors ${
              membersCanManage ? 'bg-emerald-500' : 'bg-slate-200'
            }`}
            aria-pressed={membersCanManage}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                membersCanManage ? 'translate-x-[22px]' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Greeting / persona note
          </label>
          <textarea
            value={greeting}
            onChange={(e) => setGreeting(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="e.g. Friendly, concise, refers to the boss as Shaun"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Custom rules (one per line, max 20)
          </label>
          <textarea
            value={rulesText}
            onChange={(e) => setRulesText(e.target.value)}
            rows={5}
            placeholder={'e.g. Always mention lead times in working days\nNever discuss competitor pricing'}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
          />
        </div>
        <button
          onClick={save}
          disabled={pending}
          className="rounded-full bg-black px-5 py-2 text-sm text-white hover:shadow-[0_0_12px_rgba(0,0,0,0.25)] disabled:opacity-50"
        >
          {pending ? 'Saving...' : 'Save settings'}
        </button>
      </section>

      {/* Knowledge */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Knowledge documents</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Plain text, Markdown, CSV or JSON, up to 2MB. Documents only become
            searchable once fully processed.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.md,.csv,.json"
            className="text-sm text-slate-600 file:mr-3 file:rounded-full file:border-0 file:bg-slate-900 file:px-4 file:py-1.5 file:text-xs file:text-white"
          />
          <button
            onClick={onUpload}
            disabled={uploading}
            className="rounded-full bg-black px-5 py-2 text-sm text-white hover:shadow-[0_0_12px_rgba(0,0,0,0.25)] disabled:opacity-50 whitespace-nowrap"
          >
            {uploading ? 'Processing...' : 'Upload'}
          </button>
        </div>

        {docs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 px-6 py-8 text-center text-sm text-slate-500">
            No knowledge documents yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {docs.map((doc) => (
              <div key={doc.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900 truncate">
                      {doc.file_name}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs ${
                        statusBadge[doc.status] ?? 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {doc.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {doc.size_bytes ? `${Math.round(doc.size_bytes / 1024)}KB · ` : ''}
                    {new Date(doc.created_at).toLocaleDateString()}
                  </div>
                </div>
                {doc.status !== 'withdrawn' && (
                  <button
                    onClick={() => withdraw(doc.id)}
                    disabled={pending}
                    className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs text-slate-700 hover:shadow-[0_0_8px_rgba(15,23,42,0.08)] disabled:opacity-50"
                  >
                    Withdraw
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
