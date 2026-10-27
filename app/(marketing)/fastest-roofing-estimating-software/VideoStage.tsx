'use client';

import { useCallback, useState } from 'react';
import s from './fastest.module.css';

/**
 * Video proof stage for the fastest-roofing-estimating-software page.
 * Lite-facade pattern (same principles as components/YouTubeLite.tsx):
 * the designed evidence poster renders instantly with zero YouTube JS;
 * clicking anywhere on the stage swaps in the youtube-nocookie iframe
 * with autoplay. Overlays (tag + timer) are dropped once playing so
 * they never block the player controls, and the stage snaps to 16:9.
 * VideoObject metadata ships as JSON-LD from the page schema.
 */
export function VideoStage({ videoId, title, blankSrc, measuredSrc }: {
  videoId: string;
  title: string;
  blankSrc: string;
  measuredSrc: string;
}) {
  const [playing, setPlaying] = useState(false);
  const activate = useCallback(() => setPlaying(true), []);

  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`;

  return (
    <div className={`${s['video-stage']} ${playing ? s['video-stage-playing'] : ''}`}>
      {playing ? (
        <iframe
          src={embedUrl}
          title={title}
          className={s['video-stage-frame']}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
          style={{ border: 0 }}
        />
      ) : (
        <>
          <button
            type="button"
            className={s['video-stage-open']}
            onClick={activate}
            aria-label={`Play: ${title}`}
          >
            <span className={s['video-proof-poster']} aria-hidden="true">
              <span className={s['video-figure']}>
                <img alt="" src={blankSrc} />
                <span className={s['video-figcaption']}>Start · unmeasured plan</span>
              </span>
              <span className={s['video-figure']}>
                <img alt="" src={measuredSrc} />
                <span className={s['video-figcaption']}>Measured · priced next</span>
              </span>
            </span>
            <span className={s.play} aria-hidden="true">▶</span>
          </button>
          <div className={s['video-evidence-tag']}>Actual roof · actual Quote #1040 · uncut recording</div>
          <div className={s['video-timer']}><span className={s['gradient-time']}>2:27</span></div>
        </>
      )}
      <noscript>
        <a href={`https://www.youtube.com/watch?v=${videoId}`}>Watch: {title} on YouTube</a>
      </noscript>
    </div>
  );
}
