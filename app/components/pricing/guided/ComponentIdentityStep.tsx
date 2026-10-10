'use client';
import { useId, useRef, useState, type FormEvent } from 'react';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { QcField, QcInput, QcSelect } from '@/app/components/ui/v2/QcField';
import { QcIcon } from '@/app/components/ui/v2/QcIcon';
import { EXAMPLE_NAME, normaliseIdentity, validateIdentity, validateLibraryName,
  type CreateLibraryResult, type IdentityErrors, type IdentityFields, type IdentityLibrary } from './identity-state';
import './guided-identity.css';

export interface ComponentIdentityStepProps {
  value: IdentityFields;
  onChange: (value: IdentityFields) => void;
  libraries: readonly IdentityLibrary[];
  libraryId: string;
  onLibraryChange: (id: string) => void;
  onCreateLibrary: (name: string) => Promise<CreateLibraryResult>;
  /** Keep the dialog/controller locked during the same awaited library request. */
  onPendingChange?: (pending: boolean) => void;
  onDraftInteraction?: () => void;
  onLibraryFormChange?: (open: boolean) => void;
  supplierSkuRequired?: boolean;
  onContinue: (value: IdentityFields) => void;
  onBack: () => void;
}

export function ComponentIdentityStep(props: ComponentIdentityStepProps) {
  const { value, libraries, libraryId, supplierSkuRequired = false } = props;
  const id = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const skuRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLSelectElement>(null);
  const newLibraryRef = useRef<HTMLInputElement>(null);
  const creatingRef = useRef(false);
  const [errors, setErrors] = useState<IdentityErrors>({});
  const [showCode, setShowCode] = useState(Boolean(value.sku));
  const [showNewLibrary, setShowNewLibrary] = useState(false);
  const [newName, setNewName] = useState('');
  const [libraryError, setLibraryError] = useState('');
  const [libraryStatus, setLibraryStatus] = useState('');
  const [pending, setPending] = useState(false);
  const codeVisible = showCode || !!value.sku || supplierSkuRequired;

  function update(patch: Partial<IdentityFields>) {
    props.onChange({ ...value, ...patch });
    setErrors(previous => ({ ...previous, ...(patch.name !== undefined ? { name: undefined } : {}), ...(patch.sku !== undefined ? { sku: undefined } : {}) }));
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    // A half-written library must not silently be discarded by Continue.
    if (showNewLibrary) { setLibraryError('Create this library, or cancel to keep your current selection.'); newLibraryRef.current?.focus(); return; }
    const nextErrors = validateIdentity(value, libraryId, libraries, supplierSkuRequired);
    setErrors(nextErrors);
    if (nextErrors.name) nameRef.current?.focus();
    else if (nextErrors.sku) { setShowCode(true); requestAnimationFrame(() => skuRef.current?.focus()); }
    else if (nextErrors.library) libraryRef.current?.focus();
    else props.onContinue(normaliseIdentity(value));
  }
  async function createLibrary() {
    if (creatingRef.current) return;
    const error = validateLibraryName(newName, libraries);
    if (error) { setLibraryError(error); newLibraryRef.current?.focus(); return; }
    creatingRef.current = true; setPending(true); props.onPendingChange?.(true); setLibraryError('');
    try {
      const result = await props.onCreateLibrary(newName.trim());
      if (!result.ok) { setLibraryError(result.message); return; }
      props.onLibraryChange(result.id);
      setLibraryStatus(`“${result.name}” created and selected.`);
      setErrors(previous => ({ ...previous, library: undefined }));
      setShowNewLibrary(false); props.onLibraryFormChange?.(false); setNewName('');
      requestAnimationFrame(() => libraryRef.current?.focus());
    } catch {
      setLibraryError('We could not create the library. Please try again. Your component details are still here.');
    } finally { creatingRef.current = false; setPending(false); props.onPendingChange?.(false); }
  }

  return <form className="qc-identity-form" onSubmit={submit} noValidate aria-busy={pending || undefined}>
    <fieldset disabled={pending} className="qc-identity-fieldset">
      <div className="qc-identity-grid">
        <div className="qc-identity-fields">
          <div className="qc-identity-block">
            <QcField htmlFor={`${id}-name`} label="Component name">
              <QcInput ref={nameRef} id={`${id}-name`} name="name" required autoComplete="off" spellCheck
                value={value.name} placeholder="e.g. Valley Flashing 0.55g (Color Steel)" aria-invalid={!!errors.name}
                aria-describedby={errors.name ? `${id}-name-error` : undefined}
                onChange={event => update({ name: event.target.value })} />
            </QcField>
            {errors.name && <p className="qc-identity-error" id={`${id}-name-error`} role="alert">{errors.name}</p>}
            <div className="qc-identity-example"><span>Need an example?</span><button type="button" className="qc-guided-text-link"
              onClick={() => { update({ name: EXAMPLE_NAME }); nameRef.current?.focus(); }}>Use example name</button></div>
            {!codeVisible ? <button type="button" className="qc-minimal-text-action" onClick={() => { setShowCode(true); requestAnimationFrame(() => skuRef.current?.focus()); }}>
              Add a product code <span>(optional)</span>
            </button> : <div className="qc-identity-code">
              <QcField htmlFor={`${id}-sku`} label={supplierSkuRequired ? 'Product code (required for this library)' : 'Product code (optional)'}
                helpId={`${id}-sku-help`} help={supplierSkuRequired ? 'Published supplier libraries require a product code.' : 'An extra reference for finding this item. It does not replace its name.'}>
                <QcInput ref={skuRef} id={`${id}-sku`} name="sku" value={value.sku} autoComplete="off" placeholder="e.g. VAL-001"
                  required={supplierSkuRequired} aria-invalid={!!errors.sku} aria-describedby={`${id}-sku-help${errors.sku ? ` ${id}-sku-error` : ''}`}
                  onChange={event => update({ sku: event.target.value })} />
              </QcField>
              {errors.sku && <p className="qc-identity-error" id={`${id}-sku-error`} role="alert">{errors.sku}</p>}
            </div>}
          </div>

          <section className="qc-identity-library-block" aria-labelledby={`${id}-library-title`}>
            <div className="qc-identity-section-label"><QcIcon name="folder" /><h3 id={`${id}-library-title`}>Where should it live?</h3></div>
            <p className="qc-identity-library-intro">Choose an existing library, or create one with a name that describes what belongs in it.</p>
            <QcField htmlFor={`${id}-library`} label="Save to library">
              <QcSelect ref={libraryRef} id={`${id}-library`} value={libraryId} aria-invalid={!!errors.library}
                aria-describedby={`${id}-library-help${errors.library ? ` ${id}-library-error` : ''}`}
                onChange={event => { props.onLibraryChange(event.target.value); setErrors(previous => ({ ...previous, library: undefined })); setLibraryStatus(''); }}>
                {(!libraryId || !libraries.length) && <option value="">{libraries.length ? 'Choose a library' : 'No library selected'}</option>}
                {libraries.map(library => <option value={library.id} key={library.id}>{library.name}{library.is_bootstrap ? ' (default)' : ''}</option>)}
              </QcSelect>
            </QcField>
            <p className="qc-identity-muted qc-identity-library-help" id={`${id}-library-help`}>{libraries.length ? 'Your default library is fine. Your existing libraries appear here.' : 'No account library is available. Create one here, or return to Pricing to reload.'}</p>
            {errors.library && <p className="qc-identity-error" id={`${id}-library-error`} role="alert">{errors.library}</p>}
            {!showNewLibrary ? <button type="button" className="qc-minimal-text-action" onClick={() => {
              setShowNewLibrary(true); props.onLibraryFormChange?.(true); setLibraryError(''); setLibraryStatus(''); requestAnimationFrame(() => newLibraryRef.current?.focus());
            }}>Create a new library</button> : <div className="qc-identity-new-library">
              <QcField htmlFor={`${id}-new-library`} label="New library name" help="Use a name that describes the work or products inside." helpId={`${id}-new-library-help`}>
                <QcInput ref={newLibraryRef} id={`${id}-new-library`} value={newName} maxLength={80} autoComplete="off"
                  placeholder="e.g. Roofing Long Run Materials" aria-invalid={!!libraryError}
                  aria-describedby={`${id}-new-library-help${libraryError ? ` ${id}-library-create-error` : ''}`}
                  onChange={event => { setNewName(event.target.value); setLibraryError(''); props.onDraftInteraction?.(); }}
                  onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void createLibrary(); } }} />
              </QcField>
              {libraryError && <p className="qc-identity-error" id={`${id}-library-create-error`} role="alert">{libraryError}</p>}
              <div className="qc-identity-inline-actions"><QcButton variant="primary" pending={pending} onClick={() => { void createLibrary(); }}>{pending ? 'Creating…' : 'Create library'}</QcButton>
                <QcButton onClick={() => { setShowNewLibrary(false); props.onLibraryFormChange?.(false); setNewName(''); setLibraryError(''); libraryRef.current?.focus(); }}>Cancel</QcButton></div>
              <p className="qc-identity-fine-print">Creates an empty library now. Your component is saved later.</p>
            </div>}
            <p className="qc-identity-library-status" role="status">{libraryStatus}</p>
          </section>
        </div>

      </div>
      <footer className="qc-identity-footer"><QcButton onClick={() => { if (showNewLibrary) { setLibraryError('Create this library, or cancel before going back.'); newLibraryRef.current?.focus(); return; } props.onBack(); }}><QcIcon name="back" />Back</QcButton>
        <div className="qc-identity-footer-next"><span>Next: how you measure it</span><QcButton className="qc-identity-glint" type="submit" variant="primary">Continue<QcIcon name="arrow" /></QcButton></div>
      </footer>
    </fieldset>
  </form>;
}
