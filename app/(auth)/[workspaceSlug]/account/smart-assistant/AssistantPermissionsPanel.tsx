'use client';

import { useId, useRef, useState } from 'react';
import {
  ASSISTANT_SECTIONS,
  PERMISSION_LEVELS,
  permissionFailure,
  permissionsEqual,
  type PermissionResult,
  type PermissionSnapshot,
  type SectionPermissions,
} from '@/app/lib/smart-assistant/section-permissions';
import { loadAssistantSectionPermissions, saveAssistantSectionPermissions } from './permission-actions';

const VISIBLE_KEYS = new Set(['quotes','draft_quotes','orders','invoices','components','customers']);
const LEVEL_COPY: Record<string,string> = { hidden: 'No access', read_only: 'View', edit: 'Edit' };

export function AssistantPermissionsPanel({ initialState }: { initialState: PermissionResult }) {
  const id = useId();
  const [state, setState] = useState(initialState);
  const [snapshot, setSnapshot] = useState<PermissionSnapshot | null>(initialState.ok ? initialState.snapshot : null);
  const [draft, setDraft] = useState<SectionPermissions | null>(initialState.ok ? { ...initialState.snapshot.permissions } : null);
  const [pending, setPending] = useState<'save' | 'reload' | null>(null);
  const [saved, setSaved] = useState(false);
  const inFlight = useRef(false);
  const dirty = snapshot !== null && draft !== null && !permissionsEqual(snapshot.permissions, draft);
  const blocked = !state.ok || !snapshot?.canManage || pending !== null;
  const visibleSections = ASSISTANT_SECTIONS.filter(section => VISIBLE_KEYS.has(section.key));

  function applyResult(result: PermissionResult) {
    setState(result);
    if (result.ok) { setSnapshot(result.snapshot); setDraft({ ...result.snapshot.permissions }); }
  }

  async function save() {
    if (inFlight.current || blocked || !snapshot || !draft) return;
    inFlight.current = true; setPending('save'); setSaved(false);
    try {
      const result = await saveAssistantSectionPermissions({ permissions: draft, expectedRevision: snapshot.revision, expectedCompanyId: snapshot.companyId });
      applyResult(result); setSaved(result.ok);
    } catch { setState(permissionFailure(null)); }
    finally { inFlight.current = false; setPending(null); }
  }

  async function reload() {
    if (inFlight.current) return;
    inFlight.current = true; setPending('reload'); setSaved(false);
    try { applyResult(await loadAssistantSectionPermissions()); }
    catch { setState(permissionFailure(null)); }
    finally { inFlight.current = false; setPending(null); }
  }

  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6" aria-labelledby={`${id}-heading`}>
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">Permissions</p><h2 id={`${id}-heading`} className="mt-1 text-lg font-semibold text-slate-900">What can Smart Assistant access?</h2><p className="mt-1 text-sm text-slate-500">Keep access as narrow or as useful as you need. Edit still uses QuoteCore+ confirmation rules.</p></div>
      {snapshot?.canManage && state.ok && <button type="button" onClick={() => void save()} disabled={blocked || (!dirty && snapshot.source === 'saved')} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">{pending === 'save' ? 'Saving…' : 'Save access'}</button>}
    </div>

    {!state.ok && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="alert"><p>{state.error}</p><button type="button" onClick={() => void reload()} disabled={pending !== null} className="mt-2 font-semibold underline underline-offset-2">{pending === 'reload' ? 'Loading…' : 'Reload access'}</button></div>}
    {snapshot && !snapshot.canManage && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Only a workspace owner or admin can change access.</div>}

    {draft && <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
      <div className="hidden grid-cols-[minmax(180px,1fr)_300px] bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid"><span>QuoteCore+ area</span><span>Access</span></div>
      {visibleSections.map(section => <div key={section.key} className="grid gap-3 border-t border-slate-100 px-4 py-4 first:border-t-0 md:grid-cols-[minmax(180px,1fr)_300px] md:items-center">
        <div><p className="text-sm font-semibold text-slate-900">{section.label === 'Components' ? 'Pricing Library' : section.label}</p><p className="mt-0.5 text-xs leading-5 text-slate-500">{section.description}</p></div>
        <div className="grid grid-cols-3 rounded-xl border border-slate-200 bg-slate-50 p-1" role="radiogroup" aria-label={`${section.label} access`}>
          {PERMISSION_LEVELS.map(level => <label key={level.value} className={`cursor-pointer rounded-lg px-2 py-2.5 text-center text-xs font-semibold transition focus-within:outline-none focus-within:ring-2 focus-within:ring-orange-400 ${draft[section.key] === level.value ? 'bg-gradient-to-r from-[#FF641F] via-[#FF8A3D] to-[#FFB36B] text-[#191B20] shadow-sm' : 'text-slate-500 hover:bg-white hover:text-slate-800'} ${blocked ? 'cursor-not-allowed opacity-60' : ''}`}>
            <input className="sr-only" type="radio" name={`${id}-${section.key}`} value={level.value} disabled={blocked} checked={draft[section.key] === level.value} onChange={() => { setSaved(false); setDraft(current => current ? { ...current, [section.key]: level.value } : current); }} />
            {LEVEL_COPY[level.value]}
          </label>)}
        </div>
      </div>)}
    </div>}

    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500" aria-live="polite">
      <span><strong>No access</strong> hides the section. <strong>View</strong> is read-only. <strong>Edit</strong> permits supported changes with confirmation.</span>
      {dirty && <span className="font-semibold text-orange-700">Unsaved changes</span>}
      {saved && state.ok && <span className="font-semibold text-emerald-700">Access saved</span>}
      {dirty && snapshot && <button type="button" disabled={pending !== null} onClick={() => { setDraft({ ...snapshot.permissions }); setSaved(false); }} className="font-semibold text-slate-700 underline underline-offset-2">Discard changes</button>}
    </div>
  </section>;
}
