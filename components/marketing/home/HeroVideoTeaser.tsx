'use client';
import { Icon } from './Icon';
import { trackEvent } from '@/lib/analytics';
import s from './Homepage.module.css';

/** Floating hero teaser: the fastest-roofing-estimating-software video
 * thumbnail as a clickable card, same glass/motion language as HeroReview.
 * Links off-page, so it opens a new tab per the marketing CTA rule. */
export function HeroVideoTeaser({
  href = '/fastest-roofing-estimating-software',
  thumb = '/marketing/fastest-roofing/video-thumb.webp',
}: {
  href?: string;
  thumb?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={s.heroVideo}
      data-testid="hero-video-teaser"
      aria-label="Watch the proof: blank plan to customer quote in 2 minutes 27 seconds"
      onClick={() => trackEvent('homepage_video_teaser_click', { location: 'hero' })}
    >
      <span className={s.videoThumb}>
        <img src={thumb} alt="Video thumbnail: can your software beat 2:27, from blank plan to customer quote" width={640} height={360} loading="eager" decoding="async" />
        <span className={s.videoPlay} aria-hidden="true"><Icon name="play" size={20} /></span>
        <span className={s.videoDuration} aria-hidden="true">2:27</span>
      </span>
      <span className={s.videoMeta}>
        <strong>Blank plan to quoted in 2:27</strong>
        <small>Watch the proof <Icon name="arrow" size={13} className={s.videoArrow} /></small>
      </span>
    </a>
  );
}
