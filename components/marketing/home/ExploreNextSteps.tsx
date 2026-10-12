'use client';

import { useId, useState } from 'react';
import { trackEvent } from '@/lib/analytics';
import { FitQuizDialog } from './FitQuiz';
import { Icon } from './Icon';
import { OverviewVideoDialog } from './OverviewVideo';
import { validYouTubeId, type HomepageConfig } from './homepage-config';
import n from './ExploreNextSteps.module.css';

/** Small, optional next steps directly after the feature showcase. */
export function ExploreNextSteps({ config, pricingHref = '/pricing', setupHref = '/#setup' }: {
  config: HomepageConfig; pricingHref?: string; setupHref?: string;
}) {
  const panelId = useId();
  const [expanded, setExpanded] = useState(false);
  const [modal, setModal] = useState<'video' | 'quiz' | null>(null);
  const hasVideo = Boolean(validYouTubeId(config.youtubeId));
  function openVideo() {
    setModal('video');
    trackEvent('homepage_overview_open', { connected: hasVideo ? 1 : 0 });
    if (hasVideo) window.dispatchEvent(new CustomEvent('qc:video-play'));
  }
  return <section id="quick-explore" className={n.section} aria-label="Two quick ways to explore QuoteCore+">
    <div className={n.shell} data-expanded={expanded}>
      <button type="button" className={n.summary} aria-expanded={expanded} aria-controls={panelId}
        onClick={() => setExpanded(value => !value)}>
        <span className={n.summaryGroup}>
          <span className={n.summaryIcon}><Icon name="play" size={18} /></span>
          <span><strong>Prefer to watch?</strong><span className={n.summaryDetail}>45-second explainer</span></span>
        </span>
        <span className={n.summaryGroup}>
          <span className={n.summaryIcon}><Icon name="check" size={18} /></span>
          <span><strong>Is QuoteCore+ for you?</strong><span className={n.summaryDetail}>15-second fit check</span></span>
        </span>
        <span className={n.summaryAction}><span>{expanded ? 'Close' : 'Explore'}</span><Icon name="chevron" size={18} /></span>
      </button>
      <div id={panelId} className={n.panel} aria-hidden={!expanded}
        ref={element => { if (element) element.inert = !expanded; }}>
        <div className={n.panelClip}>
          <div className={n.cards}>
            <button type="button" className={`${n.card} ${n.videoCard}`} onClick={openVideo} aria-haspopup="dialog"
              tabIndex={expanded ? 0 : -1} aria-label={hasVideo ? 'Watch the 45-second explainer' : '45-second explainer, coming soon. View details'}>
              <span className={n.poster} aria-hidden="true">
                <img src="/marketing/feature-showcase/assistant-intro.webp" alt="" loading="lazy" width="960" height="600" />
                <span className={n.posterShade} />
                <span className={n.play}><Icon name={hasVideo ? 'play' : 'clock'} size={23} /></span>
                <span className={n.duration}>{hasVideo ? '0:45' : 'Coming soon'}</span>
              </span>
              <span className={n.cardCopy}>
                <span className={n.kicker}>THE QUICK OVERVIEW</span>
                <strong>See it come together.</strong>
                <span className={n.description}>From measurements to a finished quote, in one short explainer.</span>
                <span className={n.cardAction}>{hasVideo ? 'Watch the explainer' : 'Explainer coming soon'}<Icon name="arrow" size={17} /></span>
              </span>
            </button>
            <button type="button" className={`${n.card} ${n.quizCard}`} onClick={() => setModal('quiz')}
              aria-haspopup="dialog" tabIndex={expanded ? 0 : -1}>
              <span className={n.quizMotif} aria-hidden="true">
                <span className={n.motifIcon}><Icon name="check" size={28} /></span>
                <span className={n.motifSteps}><i /><i /><i /><i /></span>
                <span>15 sec</span>
              </span>
              <span className={n.cardCopy}>
                <span className={n.kicker}>YOUR BUSINESS. YOUR WORKFLOW.</span>
                <strong>Is QuoteCore+ for you?</strong>
                <span className={n.description}>Four quick steps. A result based on how you work. No sign-up.</span>
                <span className={n.cardAction}>Take the quick check<Icon name="arrow" size={17} /></span>
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
    {modal === 'video' && <OverviewVideoDialog config={config} onClose={() => setModal(null)} />}
    <FitQuizDialog open={modal === 'quiz'} onClose={() => setModal(null)} demoHref={config.demoHref} pricingHref={pricingHref} setupHref={setupHref} />
  </section>;
}
