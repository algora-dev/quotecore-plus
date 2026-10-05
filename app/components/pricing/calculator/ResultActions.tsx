'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { QcButton, QcLinkButton } from '../../ui/v2/QcButton';
import type { Calculation, CalculatorCatalog, PlanIntent, ResultAction, ResultActions as ActionOptions } from './types';
import { actionHref } from './resultActionUtils';
import { saveSetup } from './persistence';
import { Icon, type IconName } from './Choice';
import { ActionModal } from './ActionModals';

type Modal = 'book-demo' | 'done-for-you';
/** Four compact single-target cards. Demo/tools navigate; human-help cards open real
 * explanatory dialogs before handing off to the host's calendar/enquiry route. */
export function ResultActions({ intent, result, options, catalog, disabled = false }: {
  intent: PlanIntent; result: Calculation; options: ActionOptions; catalog: CalculatorCatalog; disabled?: boolean;
}) {
  const headingId = useId();
  const [modal, setModal] = useState<Modal | null>(null);
  const [pending, setPending] = useState<ResultAction | null>(null);
  const [notice, setNotice] = useState('');
  const [failed, setFailed] = useState(false);
  const busy = useRef(false); const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  function save() { try { saveSetup(window.sessionStorage, intent); } catch { /* Optional preference storage, never a grant of access. */ } }
  async function invoke(action: ResultAction) {
    if (busy.current || disabled || !options.onAction) return;
    busy.current = true; setPending(action); setNotice(''); setFailed(false); save();
    try {
      const response = await options.onAction(action, intent);
      if (active.current) setNotice(response?.message ?? 'Your chosen option was passed to the website. No purchase is confirmed here.');
    } catch { if (active.current) { setNotice('We could not open that option. Your setup is still here. Please try again.'); setFailed(true); } }
    finally { busy.current = false; if (active.current) setPending(null); }
  }
  function open(kind: Modal) { if (disabled || busy.current) return; setNotice(''); setFailed(false); setModal(kind); }
  const trade = options.trade ?? 'roofing';
  const tradeTitle = trade[0].toUpperCase() + trade.slice(1);
  const cards: { key: ResultAction; title: string; subtitle: string; icon: IconName; dialog?: Modal }[] = [
    { key: 'book-demo', title: 'Book a 15-minute demo', subtitle: 'Free · Your workflow, on screen', icon: 'people', dialog: 'book-demo' },
    { key: 'done-for-you', title: 'We can set everything up for you', subtitle: 'Setup + personal training', icon: 'sliders', dialog: 'done-for-you' },
    { key: 'demo', title: 'Try the App Demo', subtitle: 'Free · No signup', icon: 'play' },
    { key: 'free-tools', title: result.digitalEnabled ? `Try ${tradeTitle} Digital Takeoff` : 'Try Digital Takeoff', subtitle: 'Free · Use your own plan', icon: 'ruler' },
  ];
  const noticeNode = notice ? <div className={failed ? 'qcp-error' : 'qcp-note'} role={failed ? 'alert' : 'status'}>{notice}</div> : undefined;
  function modalAction(kind: Modal) {
    const label = kind === 'book-demo' ? 'Choose a time' : 'Book my free consultation';
    const href = actionHref(kind, options);
    if (href && !disabled && !pending) return <QcLinkButton variant="primary" className="qcp-modal-primary" href={href} target="_blank" rel="noopener noreferrer" onClick={save}>{label}<Icon name="arrow" size={18} /></QcLinkButton>;
    return <><QcButton variant="primary" className="qcp-modal-primary" pending={pending === kind} disabled={disabled || !!pending || !options.onAction} onClick={() => void invoke(kind)}>{pending === kind ? 'Opening…' : label}<Icon name="arrow" size={18} /></QcButton>
      {!options.onAction && !href && <p className="qcp-small-note">The {kind === 'book-demo' ? 'booking' : 'enquiry'} link has not been connected yet.</p>}</>;
  }
  return <section className="qcp-result-actions" aria-labelledby={headingId}>
    <div className="qcp-actions-heading"><h3 id={headingId}>Next steps</h3></div>
    <div className="qcp-action-grid">{cards.map(card => {
      const className = 'qcp-clear qcp-action-card';
      const content = <><span className="qcp-card-top"><Icon name={card.icon} size={21} /><Icon name="arrow" size={16} /></span><span className="qcp-card-title">{card.title}</span><span className="qcp-card-subtitle">{card.subtitle}</span></>;
      const href = !card.dialog ? actionHref(card.key, options) : undefined;
      if (href && !disabled && !pending) return <QcLinkButton key={card.key} data-action={card.key} href={href} target="_blank" rel="noopener noreferrer" onClick={save} variant="glass" className={className}>{content}</QcLinkButton>;
      return <QcButton key={card.key} data-action={card.key} variant="glass" className={className}
        aria-haspopup={card.dialog ? 'dialog' : undefined} pending={pending === card.key}
        disabled={disabled || !!pending || (!card.dialog && !options.onAction)}
        onClick={() => card.dialog ? open(card.dialog) : void invoke(card.key)}>{content}</QcButton>;
    })}</div>
    {!modal && noticeNode}
    {modal && <ActionModal kind={modal} options={options} catalog={catalog} onClose={() => setModal(null)} action={modalAction(modal)} notice={noticeNode} />}
  </section>;
}
