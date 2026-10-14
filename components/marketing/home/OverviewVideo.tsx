'use client';
import { useState } from 'react';
import { FocusDialog } from './FocusDialog';
import { Icon } from './Icon';
import { validYouTubeId, type HomepageConfig } from './homepage-config';
import n from './ExploreNextSteps.module.css';

/** Mounted only after an explicit play action. Closing removes the player. */
export function OverviewVideoDialog({ config, onClose }: { config: HomepageConfig; onClose: () => void }) {
  const [failed, setFailed] = useState(false);
  const id = validYouTubeId(config.youtubeId);
  return <FocusDialog wide className={n.videoDialog} title={config.videoTitle} eyebrow="QuoteCore+ · 53-second explainer" onClose={onClose}>
    <div className={n.videoFrame}>
      {id && !failed ? <iframe
        src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&rel=0`}
        title={config.videoTitle}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen referrerPolicy="strict-origin-when-cross-origin" onError={() => setFailed(true)}
      /> : <div className={n.pendingVideo}>
        <span className={n.pendingIcon}><Icon name={failed ? 'play' : 'clock'} size={27} /></span>
        <h3>{failed ? 'Having trouble playing the video?' : 'A quick look is coming soon.'}</h3>
        <p>{failed ? 'You can open the explainer directly on YouTube.' : 'The 53-second explainer is on its way. Explore a sample job in the meantime.'}</p>
        <a className={n.pendingLink} href={failed && id ? `https://www.youtube.com/watch?v=${id}` : config.demoHref}
          target="_blank" rel="noopener noreferrer">{failed ? 'Watch on YouTube' : 'Try the demo'}<Icon name="arrow" size={16} /></a>
      </div>}
    </div>
    {id && <p className={n.videoNote}><span>Turn your phone sideways or use fullscreen for a closer look.</span><a href={`https://www.youtube.com/watch?v=${id}`} target="_blank" rel="noopener noreferrer">Open on YouTube</a></p>}
  </FocusDialog>;
}
