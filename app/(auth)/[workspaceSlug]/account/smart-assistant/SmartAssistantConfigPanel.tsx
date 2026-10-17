'use client';

import { useState, useTransition } from 'react';
import { saveAssistantConfig } from './actions';

type Props = {
  initialName: string;
  initialGreeting: string;
  initialEnabled: boolean;
  initialMembersCanManage: boolean;
};

export function SmartAssistantConfigPanel({ initialName, initialGreeting, initialEnabled, initialMembersCanManage }: Props) {
  const [name, setName] = useState(initialName);
  const [greeting, setGreeting] = useState(initialGreeting);
  const [membersCanManage, setMembersCanManage] = useState(initialMembersCanManage);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setFeedback(null);
    startTransition(async () => {
      const result = await saveAssistantConfig({
        name,
        greeting,
        // V1 launch: behaviour is owned by QuoteCore+. Saving this simplified
        // panel intentionally clears legacy user-authored prompt rules.
        customRules: [],
        enabled: initialEnabled,
        membersCanManage,
      });
      setFeedback({ ok: result.ok, text: result.ok ? result.message : result.error });
    });
  }

  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6" aria-labelledby="assistant-identity-heading">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">Your Assistant</p><h2 id="assistant-identity-heading" className="mt-1 text-lg font-semibold text-slate-900">Name & personality</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Give Smart Assistant a name and a simple working style. QuoteCore+ keeps the safety and workflow rules underneath.</p></div>
      <button type="button" onClick={save} disabled={pending} className="rounded-xl bg-gradient-to-r from-[#FF6B35] to-[#ff9b55] px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-sm transition hover:brightness-105 disabled:opacity-50">{pending ? 'Saving…' : 'Save Assistant'}</button>
    </div>

    <div className="mt-5 grid gap-4 lg:grid-cols-2">
      <label className="block text-sm font-medium text-slate-700">Assistant name
        <input type="text" value={name} onChange={event => setName(event.target.value)} maxLength={60} placeholder="e.g. Alex" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base outline-none transition focus:border-orange-500 md:text-sm" />
        <span className="mt-1 block text-xs font-normal text-slate-500">Used when Smart Assistant introduces itself inside your workspace.</span>
      </label>
      <label className="block text-sm font-medium text-slate-700">Personality & style <span className="font-normal text-slate-400">(optional)</span>
        <textarea value={greeting} onChange={event => setGreeting(event.target.value)} maxLength={500} rows={4} placeholder="e.g. Friendly, practical and concise. Keep answers short unless I ask for more detail." className="mt-1 w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 text-base leading-6 outline-none transition focus:border-orange-500 md:text-sm" />
        <span className="mt-1 block text-xs font-normal text-slate-500">Describe tone and communication style, not business logic. Product rules are managed by QuoteCore+.</span>
      </label>
    </div>

    <div className="mt-5 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div><p className="text-sm font-semibold text-slate-900">Let team members manage Assistant setup</p><p className="mt-0.5 text-xs leading-5 text-slate-500">When off, only the workspace owner or an admin can change these settings.</p></div>
      <button type="button" role="switch" aria-checked={membersCanManage} onClick={() => setMembersCanManage(value => !value)} className={`relative h-7 w-12 shrink-0 rounded-full transition ${membersCanManage ? 'bg-orange-500' : 'bg-slate-300'}`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${membersCanManage ? 'translate-x-6' : 'translate-x-1'}`} />
        <span className="sr-only">{membersCanManage ? 'Disable' : 'Enable'} team management</span>
      </button>
    </div>

    {feedback && <p role="status" className={`mt-4 rounded-xl border p-3 text-sm ${feedback.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>{feedback.text}</p>}
  </section>;
}
