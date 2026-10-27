'use client';

import { useCallback, useState } from 'react';
import s from './fastest.module.css';

/**
 * Video proof stage for the fastest-roofing-estimating-software page.
 * YouTube thumbnail as the poster (maxres, hq fallback) with the page's
 * gradient play button; clicking swaps in the youtube-nocookie iframe
 * with autoplay. Zero YouTube JS until click (lite-facade pattern).
 */
export function VideoStage({ videoId, title }: { videoId: string; title: string }) {
  const [playing, setPlaying] = useState(false);
  const [thumbError, setThumbError] = useState(false);
  const activate = useCallback(() => setPlaying(true), []);

  const thumbSrc = thumbError
    ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
    : `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`;

  return (
    <div className={s['video-stage']}>
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
        <button
          type="button"
          className={s['video-stage-open']}
          onClick={activate}
          aria-label={`Play: ${title}`}
        >
          <img
            className={s['video-stage-thumb']}
            src={thumbSrc}
            alt={title}
            loading="lazy"
            onError={() => setThumbError(true)}
          />
          <span className={s.play} aria-hidden="true">▶</span>
        </button>
      )}
      <noscript>
        <a href={`https://www.youtube.com/watch?v=${videoId}`}>Watch: {title} on YouTube</a>
      </noscript>
    </div>
  );
}
