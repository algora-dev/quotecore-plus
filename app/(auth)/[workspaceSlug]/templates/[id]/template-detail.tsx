'use client';
import { useState } from 'react';
import Link from 'next/link';
import { addTemplateRoofArea, removeTemplateRoofArea, addTemplateComponent, removeTemplateComponent } from '../actions';
import type { TemplateRow, TemplateRoofAreaRow, TemplateComponentRow, ComponentLibraryRow } from '@/app/lib/types';

interface Props {
  template: TemplateRow; roofAreas: TemplateRoofAreaRow[];
  templateComponents: (TemplateComponentRow & { component_library: ComponentLibraryRow })[];
  libraryComponents: ComponentLibraryRow[]; workspaceSlug: string;
}

export function TemplateDetail({ template, roofAreas: initialAreas, templateComponents: initialComponents, libraryComponents, workspaceSlug }: Props) {
  const [areas, setAreas] = useState(initialAreas);
  const [components, setComponents] = useState(initialComponents);
  const [newAreaLabel, setNewAreaLabel] = useState('');
  const [addingArea, setAddingArea] = useState(false);
  const [selectedAreaForComponent, setSelectedAreaForComponent] = useState<string>('');
  const [selectedLibraryComponent, setSelectedLibraryComponent] = useState<string>('');

  async function handleAddArea() {
    if (!newAreaLabel.trim()) return; setAddingArea(true);
    try {
      const created = await addTemplateRoofArea(template.id, newAreaLabel.trim());
      setAreas(prev => [...prev, created]); setNewAreaLabel('');
    } catch (err) { alert(err instanceof Error ? err.message : 'Failed'); }
    finally { setAddingArea(false); }
  }

  async function handleRemoveArea(id: string) {
    if (!confirm('Remove this roof area?')) return;
    try { await removeTemplateRoofArea(id); setAreas(prev => prev.filter(a => a.id !== id)); setComponents(prev => prev.filter(c => c.template_roof_area_id !== id)); }
    catch (err) { alert(err instanceof Error ? err.message : 'Failed'); }
  }

  async function handleAddComponent() {
    if (!selectedLibraryComponent) return;
    const lib = libraryComponents.find(c => c.id === selectedLibraryComponent); if (!lib) return;
    try {
      const created = await addTemplateComponent(template.id, {
        component_library_id: selectedLibraryComponent,
        template_roof_area_id: selectedAreaForComponent || undefined, component_type: lib.component_type,
      });
      setComponents(prev => [...prev, created]); setSelectedLibraryComponent('');
    } catch (err) { alert(err instanceof Error ? err.message : 'Failed'); }
  }

  async function handleRemoveComponent(id: string) {
    try { await removeTemplateComponent(id); setComponents(prev => prev.filter(c => c.id !== id)); }
    catch (err) { alert(err instanceof Error ? err.message : 'Failed'); }
  }

  const mainComponents = components.filter(c => c.component_type === 'main');
  const extraComponents = components.filter(c => c.component_type === 'extra');

  return (
    <section className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <Link href={`/${workspaceSlug}/templates`} className="text-sm text-slate-500 hover:text-slate-700">← Templates</Link>
          <h1 className="text-3xl font-semibold text-slate-900 mt-1">{template.name}</h1>
          {template.description && <p className="text-slate-600 mt-1">{template.description}</p>}
          {template.roofing_profile && <span className="inline-block mt-2 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">{template.roofing_profile}</span>}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Default Roof Areas</h2>
        {areas.length > 0 ? (
          <div className="space-y-2 mb-4">
            {areas.map(area => (
              <div key={area.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <span className="font-medium text-sm">{area.label}</span>
                <button onClick={() => handleRemoveArea(area.id)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-slate-400 mb-4">No roof areas defined yet.</p>}
        <div className="flex gap-2">
          <input value={newAreaLabel} onChange={e => setNewAreaLabel(e.target.value)} placeholder="e.g. Main Roof, Garage, Extension"
            className="flex-1 px-3 py-1.5 text-sm rounded border border-slate-300" onKeyDown={e => e.key === 'Enter' && handleAddArea()} />
          <button onClick={handleAddArea} disabled={addingArea || !newAreaLabel.trim()}
            className="px-3 py-1.5 text-sm rounded bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50">Add Area</button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Default Components</h2>
          <Link href={`/${workspaceSlug}/components`} className="text-sm text-blue-600 hover:text-blue-800 font-medium">+ Create Component</Link>
        </div>

        <div className="flex gap-2 mb-4 flex-wrap">
          <select value={selectedLibraryComponent} onChange={e => setSelectedLibraryComponent(e.target.value)}
            className="flex-1 min-w-[200px] px-3 py-1.5 text-sm rounded border border-slate-300">
            <option value="">Select from library...</option>
            {libraryComponents.map(c => <option key={c.id} value={c.id}>{c.name} ({c.component_type} · {c.measurement_type})</option>)}
          </select>
          {areas.length > 0 && (
            <select value={selectedAreaForComponent} onChange={e => setSelectedAreaForComponent(e.target.value)}
              className="px-3 py-1.5 text-sm rounded border border-slate-300">
              <option value="">No area (unassigned)</option>
              {areas.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          )}
          <button onClick={handleAddComponent} disabled={!selectedLibraryComponent}
            className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">Add</button>
        </div>

        {mainComponents.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-medium text-slate-600 mb-2">Main Components</h3>
            <div className="space-y-1">
              {mainComponents.map(c => {
                const lib = c.component_library; const area = areas.find(a => a.id === c.template_roof_area_id);
                return (
                  <div key={c.id} className="flex items-center justify-between p-2 bg-slate-50 rounded text-sm">
                    <div>
                      <span className="font-medium">{lib?.name ?? 'Unknown'}</span>
                      <span className="text-slate-400 ml-2">{lib?.measurement_type}</span>
                      {area && <span className="text-blue-600 ml-2">→ {area.label}</span>}
                    </div>
                    <button onClick={() => handleRemoveComponent(c.id)} className="text-xs text-red-500 hover:text-red-700">×</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {extraComponents.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-slate-600 mb-2">Extras</h3>
            <div className="space-y-1">
              {extraComponents.map(c => {
                const lib = c.component_library;
                return (
                  <div key={c.id} className="flex items-center justify-between p-2 bg-amber-50 rounded text-sm">
                    <div><span className="font-medium">{lib?.name ?? 'Unknown'}</span><span className="text-slate-400 ml-2">{lib?.measurement_type}</span></div>
                    <button onClick={() => handleRemoveComponent(c.id)} className="text-xs text-red-500 hover:text-red-700">×</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {mainComponents.length === 0 && extraComponents.length === 0 && <p className="text-sm text-slate-400">No components assigned. Add from the library above.</p>}
      </div>

      <div className="flex justify-end">
        <Link href={`/${workspaceSlug}/quotes/new?template=${template.id}`}
          className="inline-flex items-center rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700">Create Quote from Template →</Link>
      </div>
    </section>
  );
}
