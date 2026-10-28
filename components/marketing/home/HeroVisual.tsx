'use client';
import type { Testimonial } from './homepage-content';
import { HeroReview } from './HeroReview';
import { HeroVideoTeaser } from './HeroVideoTeaser';
import { ProductScreenshot } from './ProductScreenshot';
import { useHeroMotion } from './useHeroMotion';
import s from './Homepage.module.css';

/** Negative resting Y/Z perspective still turns the panel into the copy.
 * The glass chassis and proof are separate siblings in one perspective scene.
 */
export function HeroVisual({ review }: { review: Testimonial }) {
  const root = useHeroMotion();
  return <div ref={root} className={s.heroVisual} data-testid="hero-scene">
    <div className={s.heroApp} data-testid="hero-app">
      <div className={s.appChrome} aria-hidden="true">
        <span className={s.windowDots}><i /><i /><i /></span>
        <span>QuoteCore+ <span className={s.chromeSlash}>/</span> Digital takeoff</span>
        <span className={s.chromeIndicator} />
      </div>
      <div className={s.appViewport}><ProductScreenshot eager /></div>
    </div>
    <HeroReview review={review} />
    <HeroVideoTeaser />
  </div>;
}
