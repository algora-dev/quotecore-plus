'use client';
import { useState } from 'react';
import { trackEvent } from '@/lib/analytics';
import { FocusDialog } from './FocusDialog';
import { Icon } from './Icon';
import { safeBookingHref, validYouTubeId } from './homepage-config';
import d from './DoneForYou.module.css';

/** A real founder portrait, with playback only when the owner supplies a video. */
export function FounderVideo({ videoSrc = '', youtubeId = '', captionsSrc = '', preview = false }: {
  videoSrc?: string; youtubeId?: string; captionsSrc?: string; preview?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const src = safeBookingHref(videoSrc);
  const id = validYouTubeId(youtubeId);
  const captions = safeBookingHref(captionsSrc);
  const connected = Boolean(src || id);
  const canOpen = connected || preview;
  const watchUrl = src || (id ? `https://www.youtube.com/watch?v=${id}` : '');
  const posterImage = id ? `https://i.ytimg.com/vi/${id}/maxresdefault.jpg` : '/shaun-smiling.jpg';
  const posterAlt = id ? 'Done For You Setup video thumbnail' : 'Shaun, founder of QuoteCore+ and former roofer';
  function play() {
    setFailed(false);
    setOpen(true);
    trackEvent('homepage_setup_video_open', { connected: connected ? 1 : 0 });
    if (connected) window.dispatchEvent(new CustomEvent('qc:video-play'));
  }
  const poster = <>
    <img src={posterImage} width={id ? 1280 : 795} height={id ? 720 : 1066} alt={posterAlt} loading="lazy" decoding="async" />
    {canOpen && <span className={d.play}><Icon name={connected ? "play" : "clock"} size={25} /></span>}
    <span className={d.videoLabel}>{connected ? 'Why we created Done For You' : 'Founder video coming soon'}</span>
  </>;
  return <div className={d.founder}>
    {canOpen ? <button type="button" className={d.poster} onClick={play} aria-haspopup="dialog"
      aria-label={connected ? 'Play Shaun’s introduction to Done For You Setup' : 'Founder video coming soon. View details.'}>{poster}</button>
      : <div className={d.poster}>{poster}</div>}
    <div className={d.byline}>
      <span><strong>Meet Shaun</strong><span>Founder &amp; former roofer</span></span>
      <span className={d.founderNote}>You’ll speak directly with Shaun.<br />20+ years in roofing &amp; construction.</span>
    </div>
    {open && <FocusDialog wide title={connected ? 'Why we created Done For You.' : 'Meet Shaun. Your setup, made personal.'}
      eyebrow="Done For You Setup · Meet the founder" onClose={() => setOpen(false)}>
      {connected && !failed ? <div className={d.player}>
        {src ? <video controls autoPlay playsInline preload="metadata" poster="/shaun-smiling.jpg" onError={() => setFailed(true)} aria-label="Shaun introduces Done For You Setup">
          <source src={src} />
          {captions && <track kind="captions" src={captions} srcLang="en" label="English" default />}
          Your browser does not support this video. <a href={src} target="_blank" rel="noopener noreferrer">Open the video</a>.
        </video> : <iframe src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&rel=0`} title="Shaun introduces Done For You Setup"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" onError={() => setFailed(true)} />}
      </div> : <div className={d.videoMessage}>
        <Icon name="play" size={30} />
        <h3>{failed ? 'The video could not load.' : 'Shaun’s introduction is coming soon.'}</h3>
        <p>{failed ? 'You can open the video directly using the link below.' : 'Hear why we created Done For You and how we can configure QuoteCore+ around the way you already work.'}</p>
      </div>}
      {connected && <p className={d.videoLink}><a href={watchUrl} target="_blank" rel="noopener noreferrer">Open video in a new tab<Icon name="arrow" size={15} /></a></p>}
    </FocusDialog>}
  </div>;
}
