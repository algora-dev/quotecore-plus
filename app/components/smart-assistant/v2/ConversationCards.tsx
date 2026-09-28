'use client';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import type { ActionView, ConversationCard, RecordTarget } from '@/app/lib/smart-assistant/v2/contracts';
import s from './assistant.module.css';
import { encodeResolutionChoice } from '@/app/lib/smart-assistant/resolver/wire';
import { targetKey } from '@/app/lib/smart-assistant/v2/navigation';
export function ConversationCards({ cards, actions, busy, canConfirm, onOpen, onReply, onAction, isStale }: {
    isStale?: (card: ConversationCard) => boolean;
    cards: ConversationCard[];
    actions: ActionView[];
    busy: boolean;
    canConfirm: (action: ActionView) => boolean;
    onOpen: (card: ConversationCard, target: RecordTarget) => void;
    onReply: (text: string) => void;
    onAction: (action: ActionView, command: 'confirm' | 'cancel') => void;
}) {
    return <>{cards.map(card => {
            const c = card.content;
            const stale = isStale?.(card) ?? false;
            const action = c.kind === 'proposal' ? actions.find(a => a.id === c.actionId) : null;
            return <section className={s.card} key={card.id} aria-label={c.title} data-sa-card={card.id}>
      <h3>{c.title}</h3>
      {stale && <p className={s.detail}>These choices belong to an earlier task. Send a new request to search again.</p>}
      {c.kind === 'records' && <>{c.note && <p className={s.detail}>{c.note}</p>}
        <div className={s.actions}>{c.options.map(o => <QcButton key={targetKey(o)} disabled={busy} onClick={() => onOpen(card, o)}>
          <span>{o.label}<span className={s.detail}>{o.detail}</span></span>
        </QcButton>)}</div>{c.options.length === 0 && <p>No matching records in your permitted sections.</p>}</>}
      {c.kind === 'choices' && <><p className={s.detail}>Choose a reply. This does not approve changes.</p><div className={s.actions}>{c.options.map((o, i) => <QcButton key={i} disabled={busy || stale} onClick={() => onReply(o.reply)}>{o.label}</QcButton>)}</div></>}
      {c.kind === 'resolution' && <>
        <p className={s.detail}>Select the correct record, or give another clue below. Selecting is not approval to change anything.</p>
        <div className={s.actions}>{c.options.map(o => <QcButton key={o.choiceId} disabled={busy || stale} onClick={() => onReply(encodeResolutionChoice({ version: 1, stateId: c.stateId, choice: o.choiceId }))}>
          <span>{o.label}<span className={s.detail}>{o.detail}</span></span>
        </QcButton>)}</div>
        <p className={s.detail}>None of these? {c.question}</p>
        <div className={s.actions}>
          <QcButton disabled={busy || stale} onClick={() => onReply(encodeResolutionChoice({ version: 1, stateId: c.stateId, choice: 'none' }))}>None of these</QcButton>
          <QcButton disabled={busy || stale} onClick={() => onReply(encodeResolutionChoice({ version: 1, stateId: c.stateId, choice: 'cancel' }))}>Cancel search</QcButton>
        </div>
      </>}
      {c.kind === 'attention' && <><p className={s.detail}>{c.note} Checked {new Date(c.asOf).toLocaleString()}.</p>{c.groups.map(g => <div key={g.key} className={s.card}>
        <h4>{g.title}{g.state === 'available' ? ` (${g.count})` : ''}</h4><p className={s.detail}>{g.note}</p>
        <div className={s.actions}>{g.items.map(o => <QcButton key={targetKey(o)} disabled={busy} onClick={() => onOpen(card, o)}><span>{o.label}<span className={s.detail}>{o.detail}</span></span></QcButton>)}</div>
      </div>)}</>}
      {c.kind === 'proposal' && (!action ? <p>This proposal is no longer available with your current access. Ask for a fresh review.</p> : <>
        <p className={s.detail}>{action.note}</p>
        <dl className={s.proof}>{action.changes.map((change, i) => <div key={i}><dt>{change.label}</dt><dd>{change.before} → <strong>{change.after}</strong></dd></div>)}</dl>
        <p role="status">{({ proposed: 'Not applied yet', applying: 'Saving. Do not submit a second action.', committed: 'Saved', cancelled: 'Cancelled. Nothing applied.', conflict: 'Not applied: the record changed. Ask for a fresh proposal.', needs_review: 'Save outcome needs review. Do not create a duplicate.', failed: 'Not applied.' })[action.status]}</p>
        {action.error && <p role="alert">{action.error}</p>}
        {action.status === 'proposed' && !canConfirm(action) && <p>Edit access and the write phase must be enabled before you can confirm this proposal.</p>}
        <div className={s.actions}>
          {action.status === 'proposed' && <><QcButton variant="primary" disabled={busy || !canConfirm(action)} onClick={() => onAction(action, 'confirm')}>Confirm these changes</QcButton><QcButton disabled={busy} onClick={() => onAction(action, 'cancel')}>Cancel proposal</QcButton></>}
          {action.target && <QcButton disabled={busy} onClick={() => onOpen(card, action.target!)}>{action.status === 'committed' ? 'Review saved record' : 'Open current record'}</QcButton>}
          {['conflict', 'failed'].includes(action.status) && <QcButton disabled={busy || stale} onClick={() => onReply(`Please prepare a fresh proposal for action ${action.id}; the previous one was not applied.`)}>Review again</QcButton>}
        </div>
      </>)}
    </section>;
        })}</>;
}
