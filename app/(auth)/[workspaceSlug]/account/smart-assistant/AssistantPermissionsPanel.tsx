'use client';

import { useId, useRef, useState } from 'react';
import { AssistantButton } from '@/app/components/smart-assistant/ui/AssistantButton';
import tokens from '@/app/components/smart-assistant/ui/assistant-v2.tokens.module.css';
import styles from '@/app/components/smart-assistant/ui/assistant-v2.module.css';
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

  function applyResult(result: PermissionResult) {
    setState(result);
    if (result.ok) {
      setSnapshot(result.snapshot);
      setDraft({ ...result.snapshot.permissions });
    }
    // On error retain both the draft and its revision. Never silently overwrite
    // someone else's later save, or report a network-unknown write as saved.
  }

  async function save() {
    if (inFlight.current || blocked || !snapshot || !draft) return;
    inFlight.current = true;
    setPending('save');
    setSaved(false);
    try {
      const result = await saveAssistantSectionPermissions({ permissions: draft, expectedRevision: snapshot.revision, expectedCompanyId: snapshot.companyId });
      applyResult(result);
      setSaved(result.ok);
    } catch {
      setState(permissionFailure(null));
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  }

  async function reload() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending('reload');
    setSaved(false);
    try {
      applyResult(await loadAssistantSectionPermissions());
    } catch {
      setState(permissionFailure(null));
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  }

  return (
    <section className={`${tokens.scope} ${styles.panel}`} data-qc-ui="v2" data-clarity-mask="true" data-testid="sa-v2-permissions" aria-labelledby={`${id}-heading`}>
      <div className={styles.header}>
        <h2 id={`${id}-heading`} className={styles.heading}>Assistant access</h2>
        <span className={styles.badge}>V2 setup</span>
      </div>
      <p className={styles.intro}>Prepare what your assistant can access in each part of QuoteCore+.</p>
      <div className={styles.notice}>
        <p><strong>Prepared settings, not active restrictions yet.</strong></p>
        <p>These choices are saved for V2. The current read-only assistant is unchanged: Hidden does not hide data from V1, and Edit does not enable actions. V2 tools will enforce these permissions when released.</p>
      </div>
      <p className={styles.help}>Hidden: no access. View: read only. Edit: read and make changes with the required confirmation. Draft quotes have their own setting.</p>

      {!state.ok && (
        <div className={styles.notice} data-tone={state.code === 'migration_required' ? 'warning' : 'danger'} role="alert">
          <p>{state.error}</p>
          <div className={styles.actions}>
            <AssistantButton onClick={() => void reload()} pending={pending === 'reload'} pendingLabel="Loading..." disabled={pending !== null}>
              {dirty ? 'Discard draft and reload' : 'Reload permissions'}
            </AssistantButton>
          </div>
        </div>
      )}

      {snapshot && !snapshot.canManage && (
        <div className={styles.notice} data-tone="warning">
          Only a workspace owner or admin can change these permissions. Team members with permission to manage assistant identity or knowledge cannot change access levels.
        </div>
      )}

      {draft && (
        <div>
          {ASSISTANT_SECTIONS.map((section) => (
            <fieldset key={section.key} className={styles.fieldset} disabled={blocked} aria-describedby={`${id}-${section.key}-help`}>
              <legend className={styles.legend}>{section.label}</legend>
              <p className={styles.help} id={`${id}-${section.key}-help`}>{section.description}</p>
              <div className={styles.choices} data-component-id="C10">
                {PERMISSION_LEVELS.map((level) => (
                  <label key={level.value} className={styles.choice} data-selected={draft[section.key] === level.value} data-disabled={blocked}>
                    <input
                      type="radio"
                      name={`${id}-${section.key}`}
                      value={level.value}
                      checked={draft[section.key] === level.value}
                      onChange={() => {
                        setSaved(false);
                        setDraft((current) => current ? { ...current, [section.key]: level.value } : current);
                      }}
                    />
                    <span>{level.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      )}

      <div role="status" aria-live="polite" aria-atomic="true">
        {saved && state.ok && <p className={styles.notice} data-tone="success">Permissions saved for V2. The current assistant is unchanged.</p>}
        {dirty && <p className={styles.help}>You have unsaved permission changes.</p>}
      </div>
      {snapshot && state.ok && (
        <p className={styles.help}>
          {snapshot.source === 'default' ? 'Using the agreed defaults. No custom permissions have been saved.' : `Saved permissions, revision ${snapshot.revision}.`}
        </p>
      )}
      {snapshot?.canManage && state.ok && (
        <div className={styles.actions}>
          <AssistantButton variant="primary" onClick={() => void save()} pending={pending === 'save'} pendingLabel="Saving permissions..." disabled={blocked || (!dirty && snapshot.source === 'saved')}>Save permissions</AssistantButton>
          {dirty && (
            <AssistantButton disabled={pending !== null} onClick={() => { setDraft({ ...snapshot.permissions }); setSaved(false); }}>Discard changes</AssistantButton>
          )}
        </div>
      )}
    </section>
  );
}
