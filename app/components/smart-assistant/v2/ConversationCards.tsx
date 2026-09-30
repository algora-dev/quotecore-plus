'use client';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import type { ActionView, ConversationCard, RecordTarget, RecordOption } from '@/app/lib/smart-assistant/v2/contracts';
import { encodeResolutionChoice } from '@/app/lib/smart-assistant/resolver/wire';
import { targetKey } from '@/app/lib/smart-assistant/v2/navigation';
import { DraftWorkflowCard } from './DraftWorkflowCard';
import { AssistantIcon, type AssistantIconName } from './AssistantIcon';
import s from './assistant.module.css';
const icons: Record<RecordTarget['kind'], AssistantIconName> = { quote: 'quote', draft_quote: 'draft', order: 'order', invoice: 'invoice', component: 'component', customer: 'customer' };

/** Authoritative cards only. Styling never changes a selection into confirmation. */
export function ConversationCards({ cards, actions, busy, canConfirm, onOpen, onReply, onAction, isStale }: {
  isStale?: (card: ConversationCard) => boolean;
  cards: ConversationCard[]; actions: ActionView[]; busy: boolean;
  canConfirm: (action: ActionView) => boolean;
  onOpen: (card: ConversationCard, target: RecordTarget) => void;
  onReply: (text: string) => void;
  onAction: (action: ActionView, command: 'confirm' | 'cancel') => void;
}) {
  const record = (card: ConversationCard, option: RecordOption) => <QcButton key={targetKey(option)} className={s.recordChoice} disabled={busy} onClick={() => onOpen(card, option)} aria-label={`Open ${option.label} and hide assistant`}>
    <span className={s.recordIcon}><AssistantIcon name={option.focus ? 'component' : icons[option.kind]}/></span>
    <span className={s.recordCopy}><strong>{option.label}</strong>{option.detail && <small>{option.detail}</small>}</span>
    <AssistantIcon name="chevron"/>
  </QcButton>;
  return <>{cards.map(card => {
    const c = card.content; const stale = isStale?.(card) ?? false;
    const action = c.kind === 'proposal' ? actions.find(a => a.id === c.actionId) : null;
    return <section className={s.card} key={card.id} aria-label={c.title} data-sa-card={card.id} data-kind={c.kind}>
      <h3>{c.title}</h3>
      {stale && <p className={s.detail}>These choices belong to an earlier task. Send a new request to search again.</p>}
      {c.kind === 'records' && <>
        {c.note && <p className={s.detail}>{c.note}</p>}
        <div className={s.actions}>{c.options.map(o => record(card, o))}</div>
        {c.options.length === 0 && <p className={s.detail}>No matching records in your permitted sections.</p>}
      </>}
      {c.kind === 'choices' && <><p className={s.detail}>Choose a reply. This does not approve changes.</p><div className={s.actions}>{c.options.map((o, i) => <QcButton key={i} disabled={busy || stale} onClick={() => onReply(o.reply)}>{o.label}<AssistantIcon name="chevron"/></QcButton>)}</div></>}
      {c.kind === 'resolution' && <>
        <p className={s.detail}>Is it one of these? Selecting a record does not approve any changes.</p>
        <div className={s.actions}>{c.options.map(o => <QcButton key={o.choiceId} className={s.recordChoice} disabled={busy || stale} onClick={() => onReply(encodeResolutionChoice({ version: 1, stateId: c.stateId, choice: o.choiceId }))}>
          <span className={s.recordIcon}><AssistantIcon name="search"/></span>
          <span className={s.recordCopy}><strong>{o.label}</strong>{o.detail && <small>{o.detail}</small>}</span><AssistantIcon name="chevron"/>
        </QcButton>)}</div>
        <p className={s.detail}>None of these? {c.question}</p>
        <div className={s.cardFooter}>
          <QcButton disabled={busy || stale} onClick={() => onReply(encodeResolutionChoice({ version: 1, stateId: c.stateId, choice: 'none' }))}>None of these</QcButton>
          <QcButton disabled={busy || stale} onClick={() => onReply(encodeResolutionChoice({ version: 1, stateId: c.stateId, choice: 'cancel' }))}>Cancel search</QcButton>
        </div>
      </>}
      {c.kind === 'draft_workflow' && <DraftWorkflowCard card={c} disabled={busy || stale} onReply={onReply} />}
      {c.kind === 'attention' && <><p className={s.detail}>{c.note} Checked {new Date(c.asOf).toLocaleString()}.</p>{c.groups.map(g => <div key={g.key}>
        <h4>{g.title}{g.state === 'available' ? ` (${g.count})` : ''}</h4><p className={s.detail}>{g.note}</p>
        <div className={s.actions}>{g.items.map(o => record(card, o))}</div>
      </div>)}</>}
      {c.kind === 'proposal' && (!action ? <p className={s.detail}>This proposal is no longer available with your current access. Ask for a fresh review.</p> : <>
        <p className={s.detail}>{action.note}</p>
        <dl className={s.proof}>{action.changes.map((change, i) => <div key={i}><dt>{change.label}</dt><dd>{change.before} <span aria-hidden="true">→</span><span className="sr-only"> changes to </span> <strong>{change.after}</strong></dd></div>)}</dl>
        <p className={s.actionStatus} role="status" data-state={action.status}>{({ proposed: 'Not applied yet — review before confirming', applying: 'Saving. Do not submit a second action.', committed: 'Saved', cancelled: 'Cancelled. Nothing applied.', conflict: 'Not applied: the record changed. Ask for a fresh proposal.', needs_review: 'Save outcome needs review. Do not create a duplicate.', failed: 'Not applied.' })[action.status]}</p>
        {action.error && <p role="alert">{action.error}</p>}
        {action.status === 'proposed' && !canConfirm(action) && <p className={s.detail}>Edit access and the write phase must be enabled before you can confirm.</p>}
        <div className={s.actions}>
          {action.status === 'proposed' && <><QcButton variant="primary" disabled={busy || !canConfirm(action)} onClick={() => onAction(action, 'confirm')}><AssistantIcon name="check"/>Confirm these changes</QcButton><QcButton disabled={busy} onClick={() => onAction(action, 'cancel')}>Cancel proposal</QcButton></>}
          {action.target && <QcButton disabled={busy} onClick={() => onOpen(card, action.target!)}>{action.status === 'committed' ? 'Review saved record' : 'Open current record'}<AssistantIcon name="chevron"/></QcButton>}
          {['conflict', 'failed'].includes(action.status) && <QcButton disabled={busy || stale} onClick={() => onReply(`Please prepare a fresh proposal for action ${action.id}; the previous one was not applied.`)}>Review again</QcButton>}
        </div>
      </>)}
    </section>;
  })}</>;
}
