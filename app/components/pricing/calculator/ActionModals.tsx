'use client';
import { useState, type ReactNode } from 'react';
import type { CalculatorCatalog, ResultActions, TeamMember } from './types';
import { FocusDialog } from './FocusDialog';
import { Icon } from './Choice';
import { safeNavigationHref } from './persistence';

function Portrait({ member }: { member: TeamMember }) {
  const [failed, setFailed] = useState(false);
  return <div className="qcp-team-person">
    {!failed && safeNavigationHref(member.photoSrc) && <img src={member.photoSrc} alt={member.name} width={44} height={44} loading="lazy" onError={() => setFailed(true)} />}
    <span><strong>{member.name}</strong>{member.role && <small>{member.role}</small>}</span>
  </div>;
}
function TeamStrip({ team }: { team?: TeamMember[] }) {
  const actual = team?.filter(m => m.name.trim() && safeNavigationHref(m.photoSrc)).slice(0, 3) ?? [];
  return <div className="qcp-team-strip">
    {actual.length ? <><p>You’ll speak with our team</p><div className="qcp-team-people">{actual.map((m,i) => <Portrait key={`${m.name}:${i}`} member={m} />)}</div></>
      : <><Icon name="people" size={22} /><p>A real member of the QuoteCore+ team.<span>A conversation about your work, not a sales script.</span></p></>}
  </div>;
}
export function ActionModal({ kind, options, catalog, onClose, action, notice }: {
  kind: 'book-demo' | 'done-for-you'; options: ResultActions; catalog: CalculatorCatalog;
  onClose: () => void; action: ReactNode; notice?: ReactNode;
}) {
  const booking = kind === 'book-demo';
  const setupStartingPrice = catalog.currency === 'NZD' ? 'NZ$899' : 'US$499';
  return <FocusDialog title={booking ? 'See how it could fit the way you work' : 'Let’s get you ready to work'}
    eyebrow={booking ? '20 minutes · Free · No pressure' : 'Done-for-You setup'} onClose={onClose}>
    <p className="qcp-dialog-intro">{booking
      ? 'Tell us how you measure and price today. We’ll share our screen, show the tools that fit and answer your questions.'
      : 'A new app can still take time to learn. We’ll help load your pricing and services, shape your setup around your business and teach you with your own jobs.'}</p>
    <ol className="qcp-dialog-steps">{(booking ? [
      ['Your workflow', 'Tell us how you work today.'],
      ['A relevant demo', 'See the tools that make sense for your business.'],
      ['Your questions', 'Ask what you need. No pressure to sign up.'],
    ] : [
      ['Free 20-minute demo + setup conversation', 'Show us how you work. We’ll demonstrate a relevant workflow and work out what needs configuring for your business.'],
      ['Agree the setup scope', 'We confirm what needs configuring and the one-time setup price before work starts.'],
      ['We configure it. You learn with us.', 'We configure the agreed setup and guide you using the workflow you will actually use.'],
    ]).map(([title, text], i) => <li key={title}><span className="qcp-step-number">0{i + 1}</span><div><strong>{title}</strong><p>{text}</p></div></li>)}</ol>
    {booking ? <TeamStrip team={options.team} /> : <>
      <div className="qcp-service-inclusions"><Icon name="check" size={17} /><p><strong>Done For You Setup starts from {setupStartingPrice}.</strong> Final setup scope and price are agreed before work starts.</p></div>
      <p className="qcp-service-goal"><strong>The goal:</strong> get your QuoteCore+ setup configured around the way your business already measures, prices and quotes.</p>
      <details className="qcp-disclosure"><summary>Setup pricing<Icon name="chevron" size={16} /></summary><div className="qcp-disclosure-content">
      <p>Done For You Setup is a separate one-time service. It is not included in, and does not replace, the calculator’s monthly subscription.</p>
      </div></details>
    </>}
    <div className="qcp-dialog-action">{action}{notice}<p>{booking ? 'Opening this window does not book an appointment.' : 'Start with the free call. No payment or deposit is taken here.'}</p></div>
  </FocusDialog>;
}
