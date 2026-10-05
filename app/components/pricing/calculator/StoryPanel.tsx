import { Icon } from './Choice';
import type { CalculatorAnswers } from './types';
import type { Screen } from './flow';
/** Desktop reading surface. The essential proposition is also shown on mobile. */
export function StoryPanel({ screen, answers }: { screen: Screen; answers: CalculatorAnswers }) {
  const opening = screen === 'device';
  const assistant = screen === 'assistant';
  const copy = assistant
    ? { first: 'Tell it what to do.', accent: 'Keep your day moving.', paragraphs: [
        'Create or edit quotes, change prices, find information and send quotes using text or voice.',
        'On site or at your desk, give Smart Assistant a task instead of working through every screen.',
        'Review changes and confirm before sending. Roof Scan Assist is a separate tool.'
      ], foot: answers.device === 'mobile' ? 'On your phone? Talk instead of tap.' : 'Less clicking. Less repeat admin.' }
    : screen === 'tools' || screen === 'measurements'
      ? { first: 'Keep what works.', accent: 'Cut out extra steps.', paragraphs: [
          'Already have measurements? Enter them. Working from a plan or image? Measure on screen.',
          'Choose help with the parts you would rather spend less time on.'
        ], foot: 'Your way of working, with fewer steps.' }
      : screen === 'workload'
        ? { first: 'Your workload.', accent: 'Not someone else’s.', paragraphs: [
            'Choose space and allowances for the jobs you really price in a month.',
            'We suggest a level from your answer. You can choose more or less.'
          ], foot: 'Quotes and storage, sized around your work.' }
        : { first: 'Not another', accent: 'one-size-fits-all plan.', paragraphs: [
            'Roofing and construction businesses work differently. Your subscription should too.',
            'Choose the tools that make measuring and pricing easier. Leave out the ones you won’t use.',
            'Tell us how you work. We’ll put together your setup and show you the price.'
          ], foot: 'Less than a minute. No signup required.' };
  return <aside className="qcp-story-panel" aria-label={opening ? 'Why pricing works this way' : 'Solutions for your working day'}>
    <p className="qcp-eyebrow"><span className="qcp-brand-dot" />Your work. Your setup.</p>
    <div className="qcp-story-heading">{copy.first}<br /><span>{copy.accent}</span></div>
    <div className="qcp-story-copy">{copy.paragraphs.map(text => <p key={text}>{text}</p>)}</div>
    <p className="qcp-story-callout">{copy.foot}</p>
    <div className="qcp-story-signoff"><Icon name="shield" size={16} />Only pay for what you choose.</div>
  </aside>;
}
