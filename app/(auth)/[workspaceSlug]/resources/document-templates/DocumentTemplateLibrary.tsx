'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { TemplateRow, CustomerQuoteTemplateRow, MaterialOrderTemplateRow } from '@/app/lib/types';
import { QcLibrary, QcLibraryEmpty, QcLibraryError, QcTemplateNav } from '@/app/components/ui/v2/QcLibrary';
import { QcJourneyHeader, QcJourneyDialog } from '@/app/components/ui/v2/QcJourney';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { QcIcon, type QcIconName } from '@/app/components/ui/v2/QcIcon';
import { ConfirmModal } from '@/app/components/ConfirmModal';
import { deleteTemplate, deleteCustomerQuoteTemplate } from '../actions';
import { deleteOrderTemplate } from '../../material-orders/template-actions';
import { TemplateManager } from '../../material-orders/template-manager-new';
import { deleteInvoiceTemplate, type InvoiceTemplate } from '../../invoices/template-actions';

type DocumentType = 'quote' | 'order' | 'invoice';
type TemplateKind = 'quote-structure' | 'quote-header' | 'order' | 'invoice';
type Row = { id: string; name: string; description: string; type: DocumentType; kind: TemplateKind; kindLabel: string; icon: QcIconName; editHref?: string; previewHref?: string };
interface Props {
  workspaceSlug: string; structures: TemplateRow[]; headers: CustomerQuoteTemplateRow[];
  orders: MaterialOrderTemplateRow[]; invoices: InvoiceTemplate[]; unavailable?: string[];
  isOverStorage?: boolean; initialType?: DocumentType | 'all'; initialKind?: TemplateKind | null;
}
const FILTERS = [{ key: 'all', label: 'All documents' }, { key: 'quote', label: 'Quotes' }, { key: 'order', label: 'Orders' }, { key: 'invoice', label: 'Invoices' }] as const;

export function DocumentTemplateLibrary({ workspaceSlug, structures, headers, orders, invoices, unavailable = [], isOverStorage,
  initialType = 'all', initialKind = null }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [type, setType] = useState<DocumentType | 'all'>(initialType);
  const [kind, setKind] = useState<TemplateKind | null>(initialKind);
  const [creating, setCreating] = useState<'choose' | 'quote' | null>(null);
  const [orderEditor, setOrderEditor] = useState<string | 'new' | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const base = `/${workspaceSlug}`;
  const rows = useMemo<Row[]>(() => [
    ...structures.map(t => ({ id: t.id, name: t.name, description: t.description || 'Reusable components, extras and quote setup.', type: 'quote' as const, kind: 'quote-structure' as const, kindLabel: 'Quote structure', icon: 'pricing' as const, editHref: `${base}/resources/${t.id}/edit` })),
    ...headers.map(t => ({ id: t.id, name: t.name, description: t.company_name || 'Company details, logo and footer for customer quotes.', type: 'quote' as const, kind: 'quote-header' as const, kindLabel: 'Quote header & footer', icon: 'quote' as const, editHref: `${base}/customer-quote-templates/${t.id}/edit`, previewHref: `${base}/customer-quote-templates/${t.id}` })),
    ...orders.map(t => ({ id: t.id, name: t.name, description: t.description || [t.default_supplier_name, t.default_from_company].filter(Boolean).join(' · ') || 'Supplier, delivery and order header defaults.', type: 'order' as const, kind: 'order' as const, kindLabel: 'Order details', icon: 'orders' as const })),
    ...invoices.map(t => ({ id: t.id, name: t.name, description: [t.company_name, t.payment_account_name ? 'Payment details included' : null].filter(Boolean).join(' · ') || 'Header, footer, payment details, notes and terms.', type: 'invoice' as const, kind: 'invoice' as const, kindLabel: 'Invoice & payment details', icon: 'invoice' as const, editHref: `${base}/resources/invoice-templates/${t.id}/edit` })),
  ].sort((a,b) => a.name.localeCompare(b.name)), [structures, headers, orders, invoices, base]);
  const visible = rows.filter(row => !removed.has(`${row.kind}:${row.id}`) && (type === 'all' || row.type === type) && (!kind || row.kind === kind)
    && `${row.name} ${row.description} ${row.kindLabel}`.toLowerCase().includes(search.trim().toLowerCase()));

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true); setError('');
    try {
      if (pendingDelete.kind === 'quote-structure') await deleteTemplate(pendingDelete.id);
      else if (pendingDelete.kind === 'quote-header') await deleteCustomerQuoteTemplate(pendingDelete.id);
      else if (pendingDelete.kind === 'order') await deleteOrderTemplate(pendingDelete.id);
      else await deleteInvoiceTemplate(pendingDelete.id);
      setRemoved(prev => new Set(prev).add(`${pendingDelete.kind}:${pendingDelete.id}`));
      setPendingDelete(null); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to delete the template. Please try again.'); setPendingDelete(null); }
    finally { setDeleting(false); }
  }

  return <QcLibrary>
    <QcJourneyHeader title="Document templates" eyebrow="Resources" description="Save the details you reuse. Give each template a name you will recognise when creating a document.">
      <QcButton variant="primary" onClick={() => setCreating('choose')}><QcIcon name="plus" />New template</QcButton>
    </QcJourneyHeader>
    <QcTemplateNav workspaceSlug={workspaceSlug} current="documents" />
    {unavailable.length > 0 && <QcLibraryError title="Some templates could not be loaded" onRetry={() => router.refresh()}>
      Unavailable: {unavailable.join(', ')}. The list below only shows the sections that loaded successfully.
    </QcLibraryError>}
    {error && <QcLibraryError>{error}</QcLibraryError>}
    <div className="qc-library-toolbar">
      <label className="qc-library-search">Search templates<input type="search" value={search} onChange={e => setSearch(e.target.value)}
        className="qc-input" placeholder="Search by name or description" /></label>
      <div className="qc-library-filters" role="group" aria-label="Filter by document">
        {FILTERS.map(f => <button type="button" key={f.key} className="qc-library-filter qc-flow-control" aria-pressed={type === f.key}
          onClick={() => { setType(f.key); setKind(null); }}>{f.label}</button>)}
      </div>
    </div>
    {kind && <div className="qc-library-action-row"><span className="qc-flow-result">Showing {kind === 'quote-header' ? 'quote headers & footers' : 'quote structures'}</span>
      <QcButton size="sm" onClick={() => setKind(null)}>Show all quote templates</QcButton></div>}
    <p className="qc-flow-result" role="status">{visible.length} template{visible.length === 1 ? '' : 's'} shown</p>
    {visible.length ? <div className="qc-library-results">
      {visible.map(row => <article key={`${row.kind}:${row.id}`} className="qc-library-result">
        <div className="qc-library-result-icon"><QcIcon name={row.icon} /></div>
        <div><h2>{row.editHref ? <Link className="qc-flow-link" href={row.editHref}>{row.name}</Link>
          : <button type="button" className="qc-library-action-name" onClick={() => setOrderEditor(row.id)}>{row.name}</button>}</h2>
          <div className="qc-library-result-meta"><span className="qc-library-badge">{row.kindLabel}</span></div><p>{row.description}</p></div>
        <div className="qc-library-row-actions">
          {row.previewHref && <Link className="qc-button qc-flow-control" href={row.previewHref}>Preview</Link>}
          {row.editHref ? <Link className="qc-button qc-flow-control" href={row.editHref} aria-label={`Edit ${row.name}`}>Edit</Link>
            : <QcButton onClick={() => setOrderEditor(row.id)} aria-label={`Edit ${row.name}`}>Edit</QcButton>}
          <QcButton variant="ghost" className="qc-icon-button" onClick={() => setPendingDelete(row)} aria-label={`Delete ${row.name}`}><QcIcon name="trash" /></QcButton>
        </div>
      </article>)}
    </div> : <QcLibraryEmpty title={search || type !== 'all' || kind ? 'No matching templates' : unavailable.length ? 'No templates available to display' : 'Make your next document faster'}
      action={search || type !== 'all' || kind ? <QcButton onClick={() => { setSearch(''); setType('all'); setKind(null); }}>Clear filters</QcButton>
        : <QcButton variant="primary" onClick={() => setCreating('choose')}>Create a template</QcButton>}>
      {search || type !== 'all' || kind ? 'Try a different name or document type.' : 'Create a quote header, order preset or invoice with reusable payment details. Quote structures remain available too.'}
    </QcLibraryEmpty>}
    <p className="qc-flow-description" style={{ marginTop: 20 }}>Applying a template uses its saved name. It does not rename the document or change existing sent documents.</p>

    {creating && <QcJourneyDialog label="New document template" size="md" onRequestClose={() => setCreating(null)}>
      <QcLibrary className="qc-library-dialog-pad">
        <div className="qc-library-dialog-heading"><div><h2>{creating === 'quote' ? 'What would you like to reuse?' : 'New document template'}</h2>
          <p>{creating === 'quote' ? 'Quote presentation and estimating structure serve different purposes.' : 'Choose a document. You will name the template in the next step.'}</p></div>
          <QcButton className="qc-icon-button" aria-label="Close template chooser" onClick={() => setCreating(null)}><QcIcon name="close" /></QcButton></div>
        <div className="qc-library-choices">
          {creating === 'choose' ? <>
            <button type="button" className="qc-flow-card qc-flow-control" onClick={() => setCreating('quote')}><QcIcon name="quote" /><span><strong>Customer quote</strong><p>Header and footer, or reusable components for new quotes.</p></span></button>
            <button type="button" className="qc-flow-card qc-flow-control" onClick={() => { setCreating(null); setOrderEditor('new'); }}><QcIcon name="orders" /><span><strong>Supplier order</strong><p>Supplier, delivery address, colours and order details.</p></span></button>
            <Link className="qc-flow-card qc-flow-control" href={`${base}/resources/invoice-templates/new`}><QcIcon name="invoice" /><span><strong>Invoice</strong><p>Header, footer, payment account or link, notes and terms. Save different payment options with different names.</p></span></Link>
          </> : <>
            <Link className="qc-flow-card qc-flow-control" href={`${base}/customer-quote-templates/create`}><QcIcon name="quote" /><span><strong>Header & footer</strong><p>Company details, logo and footer for customer-facing quotes.</p></span></Link>
            <Link className="qc-flow-card qc-flow-control" href={`${base}/resources/create`}><QcIcon name="pricing" /><span><strong>Quote structure</strong><p>Preselect components, extras, profile and notes for the Quote Builder.</p></span></Link>
          </>}
        </div>
        <div className="qc-flow-dialog-footer"><QcButton onClick={() => creating === 'quote' ? setCreating('choose') : setCreating(null)}>{creating === 'quote' ? 'Back' : 'Cancel'}</QcButton></div>
      </QcLibrary>
    </QcJourneyDialog>}
    {orderEditor && <TemplateManager initialTemplates={orders} initialMode={orderEditor === 'new' ? 'create' : 'edit'}
      initialTemplateId={orderEditor === 'new' ? undefined : orderEditor} singleEditor isOverStorage={isOverStorage}
      onClose={() => { setOrderEditor(null); router.refresh(); }} />}
    <ConfirmModal open={!!pendingDelete} title={`Delete “${pendingDelete?.name ?? 'template'}”?`}
      description="This removes the reusable template. This action cannot be undone." confirmLabel="Delete template" cancelLabel="Keep template"
      destructive pending={deleting} pendingLabel="Deleting…" onCancel={() => setPendingDelete(null)} onConfirm={confirmDelete} />
  </QcLibrary>;
}
