'use client';

import { useMemo, useRef, useState } from 'react';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { QcDialog } from '@/app/components/ui/v2/QcDialog';
import { saveAssistantLibrary } from './library-actions';
import type { WorkflowSettings } from '@/app/lib/smart-assistant/workflow-controller/settings-contracts';

const normalize = (value: string) => value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export function AssistantLibrarySettings({ initial }: { initial: WorkflowSettings | null }) {
  const [epoch, setEpoch] = useState(initial?.epoch ?? 0);
  const [libraries, setLibraries] = useState(initial?.libraries ?? []);
  const [selected, setSelected] = useState(initial?.libraries[0]?.id ?? '');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const [search, setSearch] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  const saving = useRef(false);

  const library = libraries.find(item => item.id === selected);
  const filtered = useMemo(() => {
    if (!library) return [];
    const needle = search.trim().toLowerCase();
    return needle ? library.components.filter(component => `${component.name} ${component.callName}`.toLowerCase().includes(needle)) : library.components;
  }, [library, search]);

  if (!initial) {
    return <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><h2 className="font-semibold text-slate-900">Assistant shortcuts unavailable</h2><p className="mt-2 text-sm text-slate-600">The Smart Assistant library settings are not ready. No partial settings are editable.</p></section>;
  }

  function updateLibrary(fn: (value: NonNullable<typeof library>) => void) {
    setLibraries(previous => previous.map(item => {
      if (item.id !== selected) return item;
      const copy = structuredClone(item);
      fn(copy);
      return copy;
    }));
  }

  async function save() {
    if (!library || saving.current) return;
    setMessage('');
    const libraryKey = normalize(library.callName);
    const otherLibraryReferences = libraries.filter(item => item.id !== library.id)
      .flatMap(item => [normalize(item.name), normalize(item.callName)]).filter(Boolean);
    if (libraryKey && otherLibraryReferences.includes(libraryKey)) {
      setMessage('That library call name matches another library name or call name. Choose a unique shortcut.');
      return;
    }
    const seen = new Set<string>();
    const officialNames = new Map(library.components.map(component => [normalize(component.name), component.id]));
    for (const component of library.components) {
      const key = normalize(component.callName);
      if (key && (seen.has(key) || (officialNames.has(key) && officialNames.get(key) !== component.id))) {
        setMessage(`“${component.callName}” matches another component name or call name in this library. Choose a unique shortcut.`);
        return;
      }
      if (key) seen.add(key);
    }
    saving.current = true;
    setPending(true);
    try {
      const result = await saveAssistantLibrary({
        epoch,
        collectionId: library.id,
        enabled: library.enabled,
        // Library access now means the whole active library. Keep the internal
        // concept/default values intact, but do not ask customers to manage a
        // second copy of rules already owned by their Smart Components.
        includeAll: true,
        callName: library.callName,
        members: library.components.map(component => ({
          componentId: component.id,
          included: true,
          conceptKey: component.conceptKey,
          isDefault: component.isDefault,
          callName: component.callName,
        })),
      });
      setMessage(result.ok ? result.message : result.error);
      if (result.ok) {
        setEpoch(result.epoch);
        updateLibrary(value => { value.includeAll = true; value.components.forEach(component => { component.included = true; }); });
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'These settings could not be saved.');
    } finally {
      saving.current = false;
      setPending(false);
    }
  }

  return <>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-labelledby="assistant-shortcuts-heading">
      <div className="border-b border-white/10 bg-[#0D1014] px-5 py-6 text-[#FBFCFF] md:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#FF9A5C]">Fast, exact matching</p>
            <h2 id="assistant-shortcuts-heading" className="mt-1 text-xl font-semibold text-[#FBFCFF]">Assistant shortcuts</h2>
            <p className="mt-2 text-sm leading-6 text-[#B9C0CC]">Give a library and its Smart Components short call names so Smart Assistant can find the exact saved item with less typing, talking and back-and-forth.</p>
          </div>
          <button type="button" onClick={() => setHelpOpen(true)} className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-[#171C23] px-4 py-2 text-sm font-semibold text-[#FBFCFF] transition hover:border-[#FF9A5C] hover:bg-[#202630] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF9A5C]">How shortcuts work</button>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="border-b border-slate-100 bg-slate-50/55 p-4 lg:border-b-0 lg:border-r">
          <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Libraries</p>
          <div className="space-y-1">
            {libraries.map(item => {
              const ready = item.components.filter(component => component.callName.trim()).length;
              const total = item.components.length;
              return <button key={item.id} type="button" onClick={() => { setSelected(item.id); setSearch(''); setMessage(''); }}
                className={`w-full rounded-xl border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 ${selected === item.id ? 'border-orange-300 bg-orange-50 shadow-sm' : 'border-transparent hover:border-orange-200 hover:bg-orange-50/40'}`}>
                <span className="flex items-center justify-between gap-2"><strong className="truncate text-sm text-slate-900">{item.name}</strong><span className={`h-2 w-2 shrink-0 rounded-full ${item.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`} /></span>
                <span className="mt-1 block text-xs text-slate-500">{item.enabled ? `${ready} of ${total} call names set` : 'Smart Assistant access off'}</span>
              </button>;
            })}
          </div>
        </aside>

        <div className="min-w-0 p-5 md:p-6">
          {!library ? <p className="text-sm text-slate-500">Create a Pricing Library first, then configure its Assistant shortcut here.</p> : <fieldset disabled={pending} className="space-y-5">
            <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0"><h3 className="truncate text-base font-semibold text-slate-950">{library.name}</h3><p className="mt-1 text-sm text-slate-500">Let Smart Assistant use this library and its active Smart Components.</p></div>
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" className="h-4 w-4 accent-orange-500" checked={library.enabled} onChange={event => updateLibrary(value => { value.enabled = event.target.checked; })} />Available to Smart Assistant</label>
              </div>
              <div className="mt-4 grid gap-2 md:max-w-xl">
                <label htmlFor={`library-call-${library.id}`} className="text-sm font-semibold text-slate-800">Library call name <span className="font-normal text-slate-400">(optional)</span></label>
                <input id={`library-call-${library.id}`} value={library.callName} maxLength={80} onChange={event => updateLibrary(value => { value.callName = event.target.value; })} placeholder="e.g. Library 1"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100 md:text-sm" />
                <p className="text-xs leading-5 text-slate-500">The real library name stays unchanged. You can use either name with Smart Assistant.</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div><h3 className="font-semibold text-slate-900">Smart Component call names</h3><p className="mt-1 text-sm text-slate-500">Add shortcuts to the components you use most. The saved Smart Component still owns its measurement, pricing, waste, pitch and labour rules.</p></div>
              <label className="w-full sm:max-w-xs"><span className="sr-only">Search Smart Components</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search components…" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 md:text-sm" /></label>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="hidden grid-cols-[minmax(220px,1.45fr)_minmax(190px,0.75fr)] bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid"><span>Smart Component</span><span>Assistant call name</span></div>
              <div className="divide-y divide-slate-100">
                {filtered.map(component => <div key={component.id} className="grid gap-2 px-4 py-4 md:grid-cols-[minmax(220px,1.45fr)_minmax(190px,0.75fr)] md:items-center">
                  <div className="min-w-0"><span className="block truncate text-sm font-semibold text-slate-900" title={component.name}>{component.name}</span><span className="mt-0.5 block text-xs text-slate-400 md:hidden">Assistant call name</span></div>
                  <input aria-label={`Assistant call name for ${component.name}`} value={component.callName} maxLength={80}
                    onChange={event => updateLibrary(value => { value.components.find(item => item.id === component.id)!.callName = event.target.value; })}
                    placeholder="e.g. Ridge 1" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 md:text-sm" />
                </div>)}
                {!filtered.length && <p className="px-4 py-7 text-center text-sm text-slate-500">No Smart Components match this search.</p>}
              </div>
            </div>
            {library.components.length > 500 && <p role="alert" className="text-sm text-red-700">This library exceeds the 500-component settings limit and cannot be partially saved.</p>}

            {message && <p role="status" className={`rounded-xl border p-3 text-sm ${message.toLowerCase().includes('saved') ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>{message}</p>}
            <div className="flex flex-wrap items-center gap-3"><button type="button" disabled={pending || library.components.length > 500} onClick={() => void save()} className="rounded-xl bg-gradient-to-r from-[#FF641F] via-[#FF8A3D] to-[#FFB36B] px-4 py-2.5 text-sm font-semibold text-[#191B20] shadow-sm transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 disabled:cursor-not-allowed disabled:opacity-50">{pending ? 'Saving…' : 'Save library settings'}</button><span className="text-xs text-slate-500">Call names only change how Smart Assistant finds saved items. Existing quotes and component names are not renamed.</span></div>
          </fieldset>}
        </div>
      </div>
    </section>

    <QcDialog open={helpOpen} onRequestClose={() => setHelpOpen(false)} size="md" title="How Assistant shortcuts work"
      description="Call names are the recommended way to use Smart Assistant when your real library or component names are long or similar."
      footer={<QcButton variant="primary" onClick={() => setHelpOpen(false)}>Got it</QcButton>}>
      <div className="space-y-4 text-sm leading-6 text-slate-600">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="font-semibold text-slate-900">1. Give the library a short call name</p><p className="mt-1"><span className="text-slate-500">Residential Roofing</span> <span aria-hidden="true">→</span> <strong className="text-slate-900">Library 1</strong></p></div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="font-semibold text-slate-900">2. Give useful Smart Components short call names</p><p className="mt-1"><span className="text-slate-500">0.55 BMT pre-painted ridge flashing…</span> <span aria-hidden="true">→</span> <strong className="text-slate-900">Ridge 1</strong></p></div>
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4"><p className="font-semibold text-slate-950">3. Say it or type it</p><p className="mt-1 text-slate-700">“From Library 1, add five 4 m lengths of Ridge 1.”</p></div>
        <p>Smart Assistant uses the call name only to identify the exact saved item. QuoteCore+ then uses that Smart Component’s existing measurement, pitch, waste, material, labour and pricing rules.</p>
        <p>You do not need a call name for every component. Start with the ones you use most often.</p>
      </div>
    </QcDialog>
  </>;
}
