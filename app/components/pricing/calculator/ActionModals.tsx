'use client';
import { useState, type ReactNode } from 'react';
import type { CalculatorCatalog, ResultActions, TeamMember } from './types';
import { FocusDialog } from './FocusDialog';
import { Icon } from './Choice';
import { money } from './description';
import { validSetupRange } from './resultActionUtils';
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
  const currency = options.setupRange?.currency ?? catalog.currency;
  return <FocusDialog title={booking ? 'See how it could fit the way you work' : 'Let’s get you ready to work'}
    eyebrow={booking ? '15 minutes · Free · No pressure' : 'Done-for-You setup'} onClose={onClose}>
    <p className="qcp-dialog-intro">{booking
      ? 'Tell us how you measure and price today. We’ll share our screen, show the tools that fit and answer your questions.'
      : 'A new app can still take time to learn. We’ll help load your pricing and services, shape your setup around your business and teach you with your own jobs.'}</p>
    <ol className="qcp-dialog-steps">{(booking ? [
      ['Your workflow', 'Tell us how you work today.'],
      ['A relevant demo', 'See the tools that make sense for your business.'],
      ['Your questions', 'Ask what you need. No pressure to sign up.'],
    ] : [
      ['Free 20-minute demo + consultation', 'Show us how you work. We’ll demonstrate a relevant workflow and work out which tools, data and training you need.'],
      ['Agree your setup and price', 'Review or adjust our written quote. A ' + money(30000, { ...catalog, currency }) + ' deposit starts the agreed work.'],
      ['We set it up. You learn with us.', 'We help load your agreed products, pricing and services. Your first session uses your own setup, not a generic demo.'],
    ]).map(([title, text], i) => <li key={title}><span className="qcp-step-number">0{i + 1}</span><div><strong>{title}</strong><p>{text}</p></div></li>)}</ol>
    {booking ? <TeamStrip team={options.team} /> : <>
      <div className="qcp-service-inclusions"><Icon name="check" size={17} /><p><strong>3 months</strong> of your agreed subscription, plus your chosen training: up to <strong>three sessions of 60 minutes</strong> each.</p></div>
      <p className="qcp-service-goal"><strong>The goal:</strong> feel confident using your setup sooner, with fewer steps and less time figuring it out alone.</p>
      <details className="qcp-disclosure"><summary>Package price and payment<Icon name="chevron" size={16} /></summary><div className="qcp-disclosure-content">
      {validSetupRange(options.setupRange) && <p>Typically <strong>{money(options.setupRange!.minCents, { ...catalog, currency })} to {money(options.setupRange!.maxCents, { ...catalog, currency })} {currency}</strong>. Your tools, data, setup work and sessions determine the final quote.</p>}
      <p>The {money(30000, { ...catalog, currency })} deposit is part of the agreed total, not an extra charge. Pay the remaining balance when the setup is ready, before it goes live. This service is separate from the calculator’s monthly price.</p>
      </div></details>
    </>}
    <div className="qcp-dialog-action">{action}{notice}<p>{booking ? 'Opening this window does not book an appointment.' : 'Start with the free call. No payment or deposit is taken here.'}</p></div>
  </FocusDialog>;
}
