import type { ReactNode } from 'react';
import s from './FollowUpShowcase.module.css';

type IconName = 'document' | 'send' | 'eye' | 'bell' | 'check' | 'close' | 'rule' | 'arrow';

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    document: <><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z" /><path d="M14 3v5h5M9 12h6M9 16h6" /></>,
    send: <><path d="m21 3-7 18-4-7-7-4 18-7Z" /><path d="m10 14 5-5" /></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="m7 7 10 10M17 7 7 17" />,
    rule: <><path d="M7 7v10a2 2 0 0 0 2 2h6M7 7h8M12 4l3 3-3 3M12 16l3 3-3 3" /><circle cx="7" cy="4" r="2" /></>,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}

/** A workflow illustration with alternative quote responses and example
 * auto follow-up rules. No live activity, controls or automatic progression.
 */
export function FollowUpShowcase() {
  return <div className={s.stage}>
    <figure className={s.composition} aria-label="Send documents, track quote activity and set auto follow-up rules">
      <div className={s.activity}>
        <div className={s.documentHeader}>
          <span className={s.documentIcon}><Icon name="document" /></span>
          <div className={s.documentName}><strong>Quote #1022</strong><span><Icon name="send" />Sent from QuoteCore+</span></div>
          <span className={s.alert} role="img" aria-label="Quote activity alerts"><Icon name="bell" /><i /></span>
        </div>
        <div className={s.activityStates}>
          <span className={s.read}><Icon name="eye" />Quote read</span>
          <span className={s.stateArrow}><Icon name="arrow" /></span>
          <div className={s.outcomes} aria-label="Possible quote responses">
            <span className={s.accepted}><Icon name="check" />Accepted</span>
            <span className={s.or}>or</span>
            <span className={s.declined}><Icon name="close" />Declined</span>
          </div>
        </div>
      </div>

      <div className={s.rules}>
        <div className={s.ruleHeader}><span><Icon name="rule" />Auto follow-up rules</span><span className={s.example}>Examples</span></div>
        <table className={s.ruleTable} aria-label="Example auto follow-up rules">
          <colgroup><col className={s.triggerColumn} /><col className={s.arrowColumn} /><col /></colgroup>
          <thead><tr><th scope="col">When</th><td /><th scope="col">Auto send</th></tr></thead>
          <tbody>
            <tr className={s.acceptedRule}>
              <th scope="row"><span className={s.trigger}><span className={s.triggerIcon}><Icon name="check" /></span><span>Accepted</span></span></th>
              <td className={s.ruleArrow}><Icon name="arrow" /></td>
              <td className={s.action}>Job confirmation<br />doc or pack</td>
            </tr>
            <tr className={s.readRule}>
              <th scope="row"><span className={s.trigger}><span className={s.triggerIcon}><Icon name="eye" /></span><span>Read, no response<small>after 7 days</small></span></span></th>
              <td className={s.ruleArrow}><Icon name="arrow" /></td>
              <td className={s.action}>A polite<br />auto follow-up</td>
            </tr>
            <tr className={s.declinedRule}>
              <th scope="row"><span className={s.trigger}><span className={s.triggerIcon}><Icon name="close" /></span><span>Declined</span></span></th>
              <td className={s.ruleArrow}><Icon name="arrow" /></td>
              <td className={s.action}>A thank-you or<br />feedback request</td>
            </tr>
          </tbody>
        </table>
      </div>
      <figcaption className={s.caption}>Set the rule once. It sends automatically.</figcaption>
    </figure>
  </div>;
}
