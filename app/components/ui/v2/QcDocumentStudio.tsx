'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { QcButton } from './QcButton';
import './qc-document-studio.css';

/** C58. Selection and presentation only. No save, calculations or navigation. */
export interface QcStudioOption { id: string; label: string; description?: string }

export function QcStudioToolbar({ section, onSelect, options, preview, onPreview, primary, children }: {
  section: string; onSelect: (section: string) => void; options: QcStudioOption[];
  preview: boolean; onPreview: () => void; primary?: ReactNode; children?: ReactNode;
}) {
  return <div className="qc-studio-toolbar qc-document-controls" data-exclude-pdf>
    <div className="qc-studio-toolbar-start">{primary}
      <QcButton size="sm" aria-pressed={!preview && section === 'document'} onClick={() => onSelect('document')}>Document</QcButton>
      <QcButton size="sm" aria-pressed={!preview && section === 'items'} onClick={() => onSelect('items')}>All items</QcButton>
      <label className="qc-studio-section-picker"><span className="qc-studio-sr-only">Edit section</span>
        <select aria-label="Edit section" value="" onChange={e => { if (e.target.value) onSelect(e.target.value); }}>
          <option value="">More options…</option>
          {options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
      </label>
    </div>
    <div className="qc-studio-toolbar-end">{children}
      <QcButton size="sm" aria-pressed={preview} onClick={onPreview}>{preview ? 'Edit document' : 'Clean preview'}</QcButton>
    </div>
  </div>;
}

export function QcStudioInspectorHeading({ title, subtitle, section, onBack, onCollapse }: {
  title: string; subtitle?: string; section: string; onBack: () => void; onCollapse: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const previous = useRef(section);
  useEffect(() => {
    if (previous.current !== section) {
      previous.current = section;
      // Move focus only on an explicit selection, never on field changes.
      heading.current?.focus({ preventScroll: true });
      heading.current?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    }
  }, [section]);
  return <div className="qc-studio-inspector-heading">
    <div className="qc-studio-inspector-actions">
      <QcButton size="sm" onClick={onBack}>‹ Document</QcButton>
      <QcButton size="sm" onClick={onCollapse} data-qc-document-collapse aria-label="Hide editing panel">Hide ‹</QcButton>
    </div>
    <p className="qc-document-eyebrow">Editing</p><h2 ref={heading} tabIndex={-1}>{title}</h2>
    {subtitle && <p className="qc-document-help">{subtitle}</p>}
  </div>;
}

/** Hidden instead of conditional unmount: local form drafts survive panel navigation. */
export function QcStudioSection({ active, children }: { active: boolean; children: ReactNode }) {
  return <div className="qc-studio-section" hidden={!active}>{children}</div>;
}

export function QcStudioOverview({ options, onSelect, children, readOnly = false }: {
  options: QcStudioOption[]; onSelect: (section: string) => void; children?: ReactNode; readOnly?: boolean;
}) {
  return <div className="qc-studio-overview">
    <p className="qc-document-help">{readOnly ? 'This document is read-only. Use the sections below to inspect its details.' : 'Click a section on the document to edit it here. Use All items to find hidden items.'}</p>
    <div className="qc-studio-overview-links">{options.map(option => <button key={option.id} type="button" onClick={() => onSelect(option.id)}>
      <span><strong>{option.label}</strong>{option.description && <small>{option.description}</small>}</span><span aria-hidden="true">›</span>
    </button>)}</div>{children}
  </div>;
}

export function QcStudioItemIndex({ items, onSelect }: {
  items: { id: string; label: string; hidden?: boolean; detail?: string }[]; onSelect: (id: string) => void;
}) {
  return <div className="qc-studio-item-index">{items.map((item, index) => <button type="button" key={item.id} onClick={() => onSelect(item.id)}>
    <span className="qc-studio-item-number">{index + 1}</span><span><strong>{item.label || 'Untitled item'}</strong>{item.detail && <small>{item.detail}</small>}</span>
    {item.hidden && <span className="qc-studio-hidden-badge">Hidden</span>}<span aria-hidden="true">›</span>
  </button>)}{items.length === 0 && <p className="qc-document-empty">No items yet. Choose Add item to get started.</p>}</div>;
}
