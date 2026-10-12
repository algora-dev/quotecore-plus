'use client';

import { useEffect, useRef, useState } from 'react';
import { MarketingButton } from '../../MarketingButton';
import { ShowcaseIcon } from './ShowcaseIcon';
import type { ShowcaseEvent, ShowcaseFeature } from './showcase-types';
import s from './FeatureShowcase.module.css';

const TAG = 'qc-pricing-showcase-animation';
const SCRIPT = '/marketing/feature-showcase/qc-pricing-animation-v214.js';
const chapters = [
  { id: 'create-test', label: 'Create & test' },
  { id: 'spreadsheet', label: 'Spreadsheet' },
] as const;

type AnimationState = { chapter: number; playing: boolean; exploring: boolean; time: number };
interface PricingElement extends HTMLElement {
  ready: Promise<PricingElement>;
  setVisibility: (visible: boolean) => void;
  jumpTo: (chapter: number) => void;
  getState: () => AnimationState;
}
let pendingScript: Promise<void> | undefined;

/** Load only on first activation. The offline preview registers the same element
 * before React mounts, so it never makes a network request. No eval or CDN. */
function loadAnimation(): Promise<void> {
  if (customElements.get(TAG)) return Promise.resolve();
  if (pendingScript) return pendingScript;
  pendingScript = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT;
    script.async = true;
    script.dataset.qcPricingShowcase = '2.14';
    let settled = false;
    const fail = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      script.remove();
      reject(new Error('The pricing animation could not be loaded.'));
    };
    const timer = window.setTimeout(fail, 15000);
    script.onload = () => {
      if (settled) return;
      if (!customElements.get(TAG)) { fail(); return; }
      settled = true;
      clearTimeout(timer);
      resolve();
    };
    script.onerror = fail;
    document.head.appendChild(script);
  }).catch(error => { pendingScript = undefined; throw error; });
  return pendingScript;
}

export function PricingShowcase({ active, feature, demoHref, onEvent }: {
  active: boolean;
  feature: ShowcaseFeature;
  demoHref: string;
  onEvent: (event: ShowcaseEvent) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const element = useRef<PricingElement | null>(null);
  const activeRef = useRef(active);
  const [started, setStarted] = useState(active);
  const [retry, setRetry] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [chapter, setChapter] = useState(0);
  const [exploring, setExploring] = useState(false);
  const story = feature.scenes[0];
  activeRef.current = active;

  useEffect(() => {
    if (active) setStarted(true);
    // This preserves deliberate Pause and reduced-motion state. Calling play()
    // here would override the visitor's choice when switching tabs.
    element.current?.setVisibility(active);
  }, [active]);

  useEffect(() => {
    if (!started) return;
    let cancelled = false;
    let instance: PricingElement | null = null;
    const update = () => {
      if (cancelled || !instance) return;
      const state = instance.getState();
      setChapter(state.chapter === 1 ? 1 : 0);
      setExploring(Boolean(state.exploring));
    };
    setStatus('loading');
    loadAnimation().then(() => {
      if (cancelled || !host.current) return;
      instance = document.createElement(TAG) as PricingElement;
      instance.setAttribute('showcase-fit', '');
      instance.setAttribute('autoplay', '');
      instance.setAttribute('loop', '');
      instance.setAttribute('aria-label', 'Smart Components™ pricing demonstration with playback controls and a local test calculator');
      instance.setVisibility(activeRef.current);
      instance.addEventListener('quotecore-state', update);
      host.current.replaceChildren(instance);
      element.current = instance;
      return instance.ready.then(() => {
        if (cancelled || !instance) return;
        instance.setVisibility(activeRef.current);
        update();
        setStatus('ready');
      });
    }).catch(() => { if (!cancelled) setStatus('error'); });
    return () => {
      cancelled = true;
      if (instance) {
        instance.setVisibility(false);
        instance.removeEventListener('quotecore-state', update);
        instance.remove(); // Native disconnectedCallback cancels RAF/observers.
      }
      if (element.current === instance) element.current = null;
    };
  }, [started, retry]);

  function chooseChapter(index: number, source: ShowcaseEvent['source']) {
    element.current?.jumpTo(index);
    onEvent({ action: 'scene_select', feature: 'components', scene: chapters[index].id, source });
  }

  return <div className={s.carousel} role="group" aria-label="Smart Components™ pricing animation">
    <div className={`${s.sceneNav} ${s.pricingNav}`}>
      <button type="button" className={`${s.clear} ${s.railArrow}`} aria-label="Previous pricing chapter" disabled={chapter === 0 || status !== 'ready'} onClick={() => chooseChapter(0, 'previous')}><ShowcaseIcon name="left" size={22} /></button>
      <div className={s.scenePicker} role="group" aria-label="Pricing animation chapters">
        {chapters.map((item, index) => <button key={item.id} type="button" className={s.sceneButton} aria-pressed={chapter === index} disabled={status !== 'ready'} onClick={() => chooseChapter(index, 'picker')}>{item.label}</button>)}
      </div>
      <span className={s.sceneCount} aria-label={`Chapter ${chapter + 1} of 2`}>{chapter + 1}/2</span>
      <button type="button" className={`${s.clear} ${s.railArrow}`} aria-label="Next pricing chapter" disabled={chapter === 1 || status !== 'ready'} onClick={() => chooseChapter(1, 'next')}><ShowcaseIcon name="right" size={22} /></button>
    </div>
    <div className={`${s.scene} ${s.pricingScene}`} role="group" aria-label="Pricing showcase">
      <div className={s.editorial}>
        <div className={s.storyCopy}>
          <div className={s.featureEyebrow}>{feature.eyebrow}</div>
          <h3>{story.heading}</h3>
          <p className={s.body}>{story.body}</p>
          <ul className={s.benefits}>{story.benefit.split('|').map(point => <li key={point}><ShowcaseIcon name="check" size={15} /><span>{point}</span></li>)}</ul>
        </div>
        <div className={s.actions}>
          <MarketingButton href={demoHref} variant="primary" size="large" className={s.demo} onClick={() => onEvent({ action: 'demo_click', feature: 'components', scene: chapters[chapter].id })}>Try the Demo<ShowcaseIcon name="arrow" size={18} /></MarketingButton>
          <p>Explore a sample job. No signup.</p>
        </div>
      </div>
      <div className={s.pricingVisual} aria-busy={status === 'loading'}>
        <div ref={host} className={s.animationHost} />
        {status !== 'ready' && <div className={s.animationFallback} role="status">
          <ShowcaseIcon name="components" size={28} />
          <p>{status === 'error' ? 'The pricing demonstration could not load.' : 'Loading the pricing demonstration…'}</p>
          {status === 'error' && <button type="button" className={s.clear} onClick={() => setRetry(value => value + 1)}>Retry animation</button>}
        </div>}
        <span className={s.srOnly} aria-live="polite">{status === 'ready' ? exploring ? 'Interactive example. No changes are saved.' : `Pricing chapter ${chapter + 1}: ${chapters[chapter].label}.` : ''}</span>
      </div>
    </div>
  </div>;
}
