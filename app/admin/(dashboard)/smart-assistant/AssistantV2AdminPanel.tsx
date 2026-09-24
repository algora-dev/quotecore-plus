'use client';

import { useId, useState } from 'react';
import { ASSISTANT_SECTIONS, PERMISSION_LEVELS, type SectionPermissions } from '@/app/lib/smart-assistant/section-permissions';
import tokens from '@/app/components/smart-assistant/ui/assistant-v2.tokens.module.css';
import styles from '@/app/components/smart-assistant/ui/assistant-v2.module.css';

export type AdminPermissionEntry = {
  companyId: string;
  name: string;
  permissions: SectionPermissions | null;
  source: 'default' | 'saved' | 'invalid';
  revision: number | null;
};

export function AssistantV2AdminPanel({ entries, error }: { entries: AdminPermissionEntry[]; error: string | null }) {
  const id = useId();
  const [selectedId, setSelectedId] = useState(entries[0]?.companyId ?? '');
  const selected = entries.find((entry) => entry.companyId === selectedId) ?? entries[0];
  return (
    <section className={`${tokens.scope} ${styles.panel}`} data-qc-ui="v2" data-clarity-mask="true" data-testid="sa-v2-admin-permissions" aria-labelledby={`${id}-heading`}>
      <div className={styles.header}>
        <h2 id={`${id}-heading`} className={styles.heading}>V2 permission setup</h2>
        <span className={styles.badge}>Read only</span>
      </div>
      <p className={styles.intro}>Prepared company permissions, separate from rollout access above. These do not change the current assistant.</p>
      <p className={styles.help}>P0 stores configuration only. Action capture starts in a later phase. Private conversations and confirmation transcripts are not shown here.</p>
      {error ? (
        <div className={styles.notice} data-tone="warning" role="alert">{error}</div>
      ) : !selected ? (
        <p className={styles.notice}>No companies are available in this admin view.</p>
      ) : (
        <>
          <label htmlFor={`${id}-company`} className={styles.selectLabel}>Company</label>
          <select id={`${id}-company`} className={styles.select} value={selected.companyId} onChange={(event) => setSelectedId(event.target.value)}>
            {entries.map((entry) => <option key={entry.companyId} value={entry.companyId}>{entry.name}</option>)}
          </select>
          <p className={styles.help}>
            {selected.source === 'saved' ? `Saved configuration, revision ${selected.revision}.` : selected.source === 'default' ? 'No saved override. Showing the agreed defaults.' : 'Stored configuration is invalid. No defaults have been substituted.'}
          </p>
          {selected.permissions && (
            <dl className={styles.summaryList}>
              {ASSISTANT_SECTIONS.map(({ key, label }) => (
                <div key={key} className={styles.summaryRow}>
                  <dt>{label}</dt>
                  <dd>{PERMISSION_LEVELS.find((level) => level.value === selected.permissions?.[key])?.label}</dd>
                </div>
              ))}
            </dl>
          )}
          <p className={styles.help}>Only that workspace&apos;s owner or admin can save its permissions on the Smart Assistant settings page.</p>
        </>
      )}
    </section>
  );
}
