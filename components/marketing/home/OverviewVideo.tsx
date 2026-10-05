'use client';
import { useState } from 'react';
import { trackEvent } from '@/lib/analytics';
import { FocusDialog } from './FocusDialog';
import { Icon } from './Icon';
import { ProductScreenshot } from './ProductScreenshot';
import { validYouTubeId, type HomepageConfig } from './homepage-config';
import s from './Homepage.module.css';
import controls from '../MarketingButton.module.css';

/** Zero YouTube/thumbnail requests until an explicit play action.
 * No pretend playback controls when the owner's 45-second video is missing. */
export function OverviewVideo({ config }: { config: HomepageConfig }) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const id = validYouTubeId(config.youtubeId);
  function play() {
    setFailed(false); setOpen(true);
    trackEvent('homepage_overview_open', { connected: id ? 1 : 0 });
    if (id) window.dispatchEvent(new CustomEvent('qc:video-play'));
  }
  return <section id="overview" className={`${s.section} ${s.dark} ${s.overview}`} aria-labelledby="overview-title">
    <div className={`${s.container} ${s.overviewGrid}`}>
      <div className={s.overviewCopy}>
        <p className={s.eyebrow}>See QuoteCore+ in action</p>
        <h2 id="overview-title" className={s.sectionTitle}>See how it works<br className={s.desktopBreak} /> for you.<br /><span className={s.mutedHeading}>In 45 seconds.</span></h2>
        <p className={s.bodyCopy}>A quick look at a simpler way to measure, price and quote. See where QuoteCore+ could fit into your working day.</p>
        <button className={`${controls.button} ${controls.glass} ${s.button} ${s.glass}`} type="button" onClick={play} aria-haspopup="dialog"><Icon name="play" />Watch the 45-second overview</button>
      </div>
      <button className={s.videoPoster} type="button" onClick={play} aria-haspopup="dialog" aria-label={id ? `Play ${config.videoTitle} on YouTube` : 'Open the video placeholder. The overview video is not connected yet.'}>
        <div className={s.posterTopline}><span className={s.posterBrand}><img src="/marketing/brand/quotecore-mark-transparent.png" alt="" width={26} height={26} />QuoteCore<span>+</span></span><span className={s.posterDuration}>{id ? '45-second overview' : 'Video placeholder'}</span></div>
        <div className={s.posterScene}>
          <div className={s.posterHeadline}>Your next quote.<br />A better way.</div>
          <div className={s.posterApp}><ProductScreenshot decorative /></div>
        </div>
        <span className={s.playOrb}><Icon name="play" size={31} /></span>
        <span className={s.posterBottom}><span>{id ? 'Play overview' : '45-second overview · coming soon'}</span><Icon name="arrow" size={18} /></span>
      </button>
    </div>
    {open && <FocusDialog wide title={id ? config.videoTitle : 'Your overview video goes here'} eyebrow={id ? 'QuoteCore+ · Video overview' : 'Design preview · Video placeholder'} onClose={() => setOpen(false)}>
      {id && !failed ? <>
        <div className={s.videoEmbed}>
          <iframe src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`} title={config.videoTitle} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" onError={() => setFailed(true)} />
        </div>
        <p className={s.smallNote}>Video hosted by YouTube. <a href={`https://www.youtube.com/watch?v=${id}`} target="_blank" rel="noopener noreferrer">Open on YouTube</a></p>
      </> : <div className={s.videoEmpty}>
        <span className={s.videoEmptyIcon}><Icon name="play" size={30} /></span>
        <h3>{failed ? 'The video could not load.' : 'Ready for the real thing.'}</h3>
        <p>{failed ? 'Your browser or network may be blocking the embedded player.' : 'The final video hasn’t been connected yet. This is the finished player position and interaction — not a playable video.'}</p>
        <a href={failed && id ? `https://www.youtube.com/watch?v=${id}` : config.demoHref} className={`${s.button} ${s.primary}`} target={failed ? '_blank' : undefined} rel={failed ? 'noopener noreferrer' : undefined}>{failed ? 'Watch on YouTube' : 'Try the Demo'}<Icon name="arrow" /></a>
      </div>}
    </FocusDialog>}
  </section>;
}
