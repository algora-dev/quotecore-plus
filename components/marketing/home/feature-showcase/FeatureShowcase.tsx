'use client';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { MarketingButton } from '../../MarketingButton';
import { CapturePanel } from './CapturePanel';
import { DocumentsShowcase } from './DocumentsShowcase';
import { FollowUpShowcase } from './FollowUpShowcase';
import { PricingShowcase, chapters } from './PricingShowcase';
import { ShowcaseIcon } from './ShowcaseIcon';
import { showcaseFeatures } from './showcase-content';
import { boundedIndex, safeDemoHref, swipeDirection, tabDestination, validFeatures } from './showcase-model';
import type { Capture, CaptureRole, FeatureId, ShowcaseEvent, ShowcaseFeature } from './showcase-types';
import s from './FeatureShowcase.module.css';
import { Icon } from '../Icon';
import { OverviewVideoDialog } from '../OverviewVideo';
import { homepageConfig, type HomepageConfig } from '../homepage-config';

export interface FeatureShowcaseProps {
  id?: string;
  config?: HomepageConfig;
  /** Optional review/deep-link entry. Production still starts on Smart Assistant. */
  initialFeature?: FeatureId;
  /** Optional review entry within the initial feature. Unknown scenes use its first scene. */
  initialScene?: string;
  demoHref?: string;
  features?: readonly ShowcaseFeature[];
  onEvent?: (event: ShowcaseEvent) => void;
}

/** Approved product artwork, not a screenshot of the surrounding feature section. */
const measurementsCapture: Capture = {
  src: '/marketing/current-ux/quote-builder-components-measurements.webp',
  label: 'Enter Your Measurements',
  alt: 'QuoteCore+ Quote Builder showing Smart Components with entered measurements and pricing.',
  caption: 'Enter areas, lengths and quantities, then review the component measurements and pricing in the quote builder.',
  width: 2048,
  height: 1112,
};

const takeoffCapture: Capture = {
  src: '/marketing/current-ux/digital-takeoff-manual.webp',
  label: 'Measure in App',
  alt: 'QuoteCore+ Digital Takeoff workspace with a roof plan open and a manual line measurement in progress.',
  caption: 'Measure directly on the plan with the same editable takeoff workspace used by AI Scan Assist.',
  width: 2048,
  height: 1114,
};

/** Isolated marketing section. No assistant API, microphone, account writes,
 * automatic carousel rotation, remote fonts or new production dependencies.
 */
export function FeatureShowcase({ id = 'workflow', config = homepageConfig, initialFeature, initialScene, demoHref = '/takeoff-demo', features: suppliedFeatures = showcaseFeatures, onEvent }: FeatureShowcaseProps) {
  const candidates = validFeatures(suppliedFeatures);
  const features = candidates.length ? candidates : showcaseFeatures;
  const initialId = features.some(f => f.id === initialFeature) ? initialFeature! : features[0].id;
  const uid = useId();
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [activeId, setActiveId] = useState<FeatureId>(initialId);
  const [focusId, setFocusId] = useState<FeatureId>(initialId);
  const [sceneIndices, setSceneIndices] = useState<Record<string, number>>(() => ({
    [initialId]: Math.max(0, features.find(feature => feature.id === initialId)!.scenes.findIndex(scene => scene.id === initialScene)),
  }));
  const [captureViews, setCaptureViews] = useState<Record<string, CaptureRole>>({});
  const [announcement, setAnnouncement] = useState('');
  const [expanded, setExpanded] = useState<Capture | null>(null);
  const [expandedError, setExpandedError] = useState(false);
  const [failedCaptures, setFailedCaptures] = useState<Record<string, boolean>>({});
  const section = useRef<HTMLElement>(null);
  const tabs = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const pickers = useRef<(HTMLDivElement | null)[]>([]);
  const dialog = useRef<HTMLDialogElement>(null);
  const focusBeforeDialog = useRef<HTMLElement | null>(null);
  const touch = useRef<{ x: number; y: number; feature: FeatureId; pointer: number } | null>(null);
  const preventClickUntil = useRef(0);
  const viewed = useRef(false);
  const eventRef = useRef(onEvent);
  const chosen = features.find(f => f.id === activeId) ?? features[0];
  const focusable = features.some(f => f.id === focusId) ? focusId : chosen.id;
  const href = safeDemoHref(demoHref);
  useEffect(() => { eventRef.current = onEvent; }, [onEvent]);

  function emit(event: ShowcaseEvent) {
    // Analytics failure must never interrupt navigation or the showcase.
    try { eventRef.current?.(event); } catch { /* Host analytics is optional. */ }
  }

  useEffect(() => {
    const element = section.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting) && !viewed.current) {
        viewed.current = true;
        emit({ action: 'view', feature: features[0].id, scene: features[0].scenes[0].id });
        observer.disconnect();
      }
    }, { threshold: 0.2 });
    observer.observe(element);
    return () => observer.disconnect();
    // Count one section view per mount, not a view on every scene change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const element = dialog.current;
    if (!element) return;
    focusBeforeDialog.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setExpandedError(false);
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    element.showModal();
    return () => {
      element.close();
      document.documentElement.style.overflow = previousOverflow;
      if (focusBeforeDialog.current?.isConnected) focusBeforeDialog.current.focus({ preventScroll: true });
    };
  }, [expanded]);

  function revealHorizontally(element: HTMLElement | null, parent: HTMLElement | null) {
    if (!element || !parent) return;
    const a = element.getBoundingClientRect();
    const b = parent.getBoundingClientRect();
    if (a.left < b.left + 8) parent.scrollLeft -= b.left + 8 - a.left;
    else if (a.right > b.right - 8) parent.scrollLeft += a.right - b.right + 8;
  }

  // Keep a directly selected feature visible in the horizontal rail on phones.
  // This affects scrolling within the rail only, never the scene dimensions.
  useEffect(() => {
    const parent = tabs.current;
    if (!parent) return;
    const reveal = () => revealHorizontally(parent.querySelector<HTMLButtonElement>('[aria-selected="true"]'), parent);
    reveal();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(reveal);
    observer.observe(parent);
    return () => observer.disconnect();
  }, [chosen.id]);

  function chooseFeature(feature: ShowcaseFeature, index: number) {
    setActiveId(feature.id); setFocusId(feature.id);
    revealHorizontally(tabRefs.current[index], tabs.current);
    emit({ action: 'feature_select', feature: feature.id, scene: feature.scenes[boundedIndex(sceneIndices[feature.id] ?? 0, feature.scenes.length)].id, source: 'tab' });
  }

  function tabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = tabDestination(event.key, index, features.length);
    if (next === null) return;
    event.preventDefault();
    setFocusId(features[next].id);
    tabRefs.current[next]?.focus({ preventScroll: true });
    revealHorizontally(tabRefs.current[next], tabs.current);
    // Manual activation keeps large screenshots from loading just because
    // someone arrows through the tab names. Enter/Space activate the button.
  }

  function chooseScene(feature: ShowcaseFeature, featureIndex: number, target: number, source: ShowcaseEvent['source']) {
    const next = boundedIndex(target, feature.scenes.length);
    const current = boundedIndex(sceneIndices[feature.id] ?? 0, feature.scenes.length);
    if (next === current) return;
    setSceneIndices(values => ({ ...values, [feature.id]: next }));
    setCaptureViews(values => ({ ...values, [feature.id]: 'request' }));
    const scene = feature.scenes[next];
    setAnnouncement(`${feature.label}. Example ${next + 1} of ${feature.scenes.length}: ${scene.label}.`);
    emit({ action: 'scene_select', feature: feature.id, scene: scene.id, source });
    const picker = pickers.current[featureIndex];
    revealHorizontally(picker?.children[next] as HTMLElement | null, picker);
  }

  function startSwipe(event: PointerEvent<HTMLDivElement>, feature: FeatureId) {
    if (event.pointerType === 'mouse' || !event.isPrimary) return;
    const control = (event.target as HTMLElement).closest('button, a, input, select, textarea');
    if (control && !control.hasAttribute('data-capture-trigger')) return;
    touch.current = { x: event.clientX, y: event.clientY, feature, pointer: event.pointerId };
  }

  function finishSwipe(event: PointerEvent<HTMLDivElement>, feature: ShowcaseFeature, featureIndex: number) {
    const start = touch.current; touch.current = null;
    if (!start || start.feature !== feature.id || start.pointer !== event.pointerId) return;
    const direction = swipeDirection(event.clientX - start.x, event.clientY - start.y);
    if (!direction) return;
    preventClickUntil.current = Date.now() + 350;
    chooseScene(feature, featureIndex, (sceneIndices[feature.id] ?? 0) + direction, 'swipe');
  }

  return <section ref={section} id={id} className={s.root} aria-labelledby={`${uid}-heading`}>
    <div className={s.container}>
      <header className={s.intro}>
        <div><p className={s.eyebrow}>QuoteCore+ features</p><h2 id={`${uid}-heading`}>Explore the features that save you time and make estimating easier.</h2></div>
        <div className={s.introGuide}><p className={s.introAside}>Explore each feature tab and use the slider arrows to see the main features and how they work.</p><button type="button" className={s.overviewLink} onClick={() => setOverviewOpen(true)}><Icon name="play" size={17} />Watch the 53-second overview</button></div>
      </header>

      <div className={s.showcase}>
        <div className={s.mobileTabHint}><span>Choose a feature</span><span>Swipe to explore <ShowcaseIcon name="arrow" size={13} /></span></div>
        <div ref={tabs} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusId(chosen.id); }} role="tablist" aria-label="Explore QuoteCore+ features" className={s.featureTabs}>
          {features.map((feature, index) => {
            const slideTotal = feature.id === 'components' ? chapters.length : feature.scenes.length;
            const slideIndex = boundedIndex(sceneIndices[feature.id] ?? 0, slideTotal);
            return <button key={feature.id} type="button" ref={el => { tabRefs.current[index] = el; }} id={`${uid}-tab-${feature.id}`} role="tab" aria-selected={chosen.id === feature.id} aria-controls={`${uid}-panel-${feature.id}`} tabIndex={focusable === feature.id ? 0 : -1} className={`${s.featureTab} ${feature.outcome ? s.outcomeTab : ''}`} onKeyDown={event => tabKey(event, index)} onClick={() => chooseFeature(feature, index)} data-feature={feature.id}>
              <span>{feature.label}</span>
              {slideTotal > 1 && <span className={s.tabCount} aria-hidden="true">{slideIndex + 1}/{slideTotal}</span>}
            </button>;
          })}
        </div>

        {features.map((feature, featureIndex) => {
          if (feature.id === 'components') return (
            <div key={feature.id} id={`${uid}-panel-${feature.id}`} role="tabpanel" aria-labelledby={`${uid}-tab-${feature.id}`} hidden={chosen.id !== feature.id} tabIndex={0} className={s.featurePanel}>
              <PricingShowcase active={chosen.id === feature.id} feature={feature} demoHref={href} onChapterChange={index => setSceneIndices(values => ({ ...values, components: index }))} onEvent={emit} />
            </div>
          );
          const index = boundedIndex(sceneIndices[feature.id] ?? 0, feature.scenes.length);
          const scene = feature.scenes[index];
          const view = captureViews[feature.id] ?? 'request';
          const hasPlaceholders = !scene.request.src || !scene.result.src || Boolean(failedCaptures[scene.request.src] || failedCaptures[scene.result.src]);
          const isDocumentsScene = feature.id === 'workflow' && scene.id === 'create-documents';
          const isFollowUpScene = feature.id === 'workflow' && scene.id === 'track-follow-up';
          return <div key={feature.id} id={`${uid}-panel-${feature.id}`} role="tabpanel" aria-labelledby={`${uid}-tab-${feature.id}`} hidden={chosen.id !== feature.id} tabIndex={0} className={s.featurePanel}>
            <div className={s.carousel} role="group" aria-roledescription="carousel" aria-label={`${feature.label} examples`}>
              {feature.scenes.length > 1 && <div className={s.sceneNav}>
                <button type="button" className={`${s.clear} ${s.railArrow}`} aria-label="Previous example" disabled={index === 0} onClick={() => chooseScene(feature, featureIndex, index - 1, 'previous')}><ShowcaseIcon name="left" size={22} /></button>
                <div className={s.scenePicker} role="group" aria-label={`${feature.label}: choose an example`} ref={el => { pickers.current[featureIndex] = el; }}>
                  {feature.scenes.map((item, j) => <button key={item.id} type="button" aria-pressed={index === j} aria-label={`Example ${j + 1} of ${feature.scenes.length}: ${item.label}`} onClick={() => chooseScene(feature, featureIndex, j, 'picker')} className={s.sceneButton}><span>{item.label}</span></button>)}
                </div>
                <span className={s.sceneCount} aria-label={`Step ${index + 1} of ${feature.scenes.length}`}>{index + 1}/{feature.scenes.length}</span>
                <button type="button" className={`${s.clear} ${s.railArrow}`} aria-label="Next example" disabled={index === feature.scenes.length - 1} onClick={() => chooseScene(feature, featureIndex, index + 1, 'next')}><ShowcaseIcon name="right" size={22} /></button>
              </div>}
              <div className={`${s.scene} ${feature.id === 'takeoff' ? s.takeoffScene : ''}`} role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${feature.scenes.length}: ${scene.label}`}>
                <div className={s.editorial}>
                  <div className={s.storyCopy} key={scene.id}>
                    <div className={s.featureEyebrow}><span>{feature.eyebrow}</span>{feature.beta && <span className={s.beta}>V1 Beta</span>}</div>
                    <h3>{scene.heading}</h3>
                    <p className={s.body}>{scene.body}</p>
                    <ul className={s.benefits}>{scene.benefit.split("|").map((point, pointIndex) => <li key={pointIndex}><ShowcaseIcon name="check" size={15} /><span>{point}</span></li>)}</ul>
                    
                  </div>
                  <div className={s.actions}>
                    <MarketingButton href={href} variant="primary" size="large" className={s.demo} onClick={() => emit({ action: 'demo_click', feature: feature.id, scene: scene.id })}>Try the Demo<ShowcaseIcon name="arrow" size={18} /></MarketingButton>
                    <p>Explore a sample job. No signup.</p>
                  </div>
                </div>

                <div className={`${s.visual} ${isDocumentsScene ? s.documentsVisual : isFollowUpScene ? s.followUpVisual : ''}`}>
                  {isDocumentsScene ? (
                    <div className={s.documentsStage}
                      onPointerDown={event => startSwipe(event, feature.id)}
                      onPointerUp={event => finishSwipe(event, feature, featureIndex)}
                      onPointerCancel={() => { touch.current = null; }}
                      onClickCapture={event => { if (Date.now() < preventClickUntil.current) { event.preventDefault(); event.stopPropagation(); } }}>
                      <DocumentsShowcase capture={scene.result} onExpand={capture => { setExpanded(capture); emit({ action: 'capture_expand', feature: feature.id, scene: scene.id, capture: 'result' }); }} />
                    </div>
                  ) : isFollowUpScene ? (
                    <div className={s.followUpStage}
                      onPointerDown={event => startSwipe(event, feature.id)}
                      onPointerUp={event => finishSwipe(event, feature, featureIndex)}
                      onPointerCancel={() => { touch.current = null; }}>
                      <FollowUpShowcase />
                    </div>
                  ) : feature.id === 'measurements' && scene.id === 'enter-quantities' ? (
                    <div className={`${s.voiceCompositeStage} ${s.measurementsCompositeStage}`} role="group" aria-label="Enter measurements on mobile or desktop">
                      <button
                        type="button"
                        className={s.voiceCompositeButton}
                        aria-label="Enlarge the Enter Your Measurements product showcase"
                        onClick={() => {
                          setExpanded(measurementsCapture);
                          emit({ action: 'capture_expand', feature: feature.id, scene: scene.id, capture: 'result' });
                        }}
                      >
                        <img
                          className={`${s.voiceCompositeImage} ${s.measurementsCompositeImage}`}
                          src={measurementsCapture.src}
                          alt={measurementsCapture.alt}
                          width={measurementsCapture.width}
                          height={measurementsCapture.height}
                          loading="lazy"
                          decoding="async"
                        />
                      </button>
                    </div>
                  ) : feature.id === 'takeoff' && scene.id === 'measure-a-plan' ? (
                    <div className={`${s.voiceCompositeStage} ${s.measurementsCompositeStage}`} role="group" aria-label="Digital roof measurement on laptop and phone">
                      <button type="button" className={s.voiceCompositeButton} aria-label="Enlarge the Measure in App showcase" onClick={() => { setExpanded(takeoffCapture); emit({ action: 'capture_expand', feature: feature.id, scene: scene.id, capture: 'result' }); }}>
                        <img className={`${s.voiceCompositeImage} ${s.measurementsCompositeImage}`} src={takeoffCapture.src} alt={takeoffCapture.alt} width={takeoffCapture.width} height={takeoffCapture.height} loading="lazy" decoding="async" />
                      </button>
                    </div>
                  ) : feature.id === 'assistant' && scene.id === 'meet-assistant' ? (
                    <div className={s.deviceStage} role="img" aria-label="QuoteCore+ Smart Assistant shown on a phone alongside the QuoteCore+ desktop app on a laptop">
                      <img className={s.deviceComposition} src="/marketing/feature-showcase/assistant-intro.webp" alt="" width={1632} height={1024} loading="eager" />
                    </div>
                  ) : feature.id === 'assistant' && scene.id === 'voice-to-quote' ? (
                    <div className={s.voiceCompositeStage} role="group" aria-label="Voice to quote, from a voice request to a finished customer quotation">
                      <button type="button" className={s.voiceCompositeButton} aria-label="Enlarge the Voice to Quote product showcase" onClick={() => { setExpanded({ src: '/marketing/feature-showcase/assistant-voice-composite.webp', label: 'Voice to Quote', alt: 'Two phones, one showing the Smart Assistant voice request and the other a completed customer quotation', caption: 'Describe the job by voice, then review the resulting customer quotation.', width: 1672, height: 941 }); emit({ action: 'capture_expand', feature: feature.id, scene: scene.id, capture: 'result' }); }}>
                        <img className={s.voiceCompositeImage} src="/marketing/feature-showcase/assistant-voice-composite.webp" alt="A phone showing a roofing quote voice request alongside a phone displaying quotation 1025" width={1672} height={941} loading="eager" />
                      </button>
                    </div>
                  ) : feature.id === 'assistant' && scene.id === 'find-details' ? (
                    <div className={s.voiceCompositeStage} role="group" aria-label="Find the detail, from voice question to answer">
                      <button type="button" className={s.voiceCompositeButton} aria-label="Enlarge the Find the Detail product showcase" onClick={() => { setExpanded({ src: '/marketing/feature-showcase/assistant-find-details-composite.webp', label: 'Find the Detail', alt: 'Two phones showing the Alex Smith roof area question and the Smart Assistant answer', caption: 'Ask the Smart Assistant for a quote detail and get the answer.', width: 1672, height: 941 }); emit({ action: 'capture_expand', feature: feature.id, scene: scene.id, capture: 'result' }); }}>
                        <img className={s.voiceCompositeImage} src="/marketing/feature-showcase/assistant-find-details-composite.webp" alt="Two phones showing the Smart Assistant finding roof measurements in Alex Smith quote 1025" width={1672} height={941} loading="lazy" />
                      </button>
                    </div>
                  ) : feature.id === 'assistant' && scene.id === 'manage-pricing' ? (
                    <div className={s.voiceCompositeStage} role="group" aria-label="Update pricing, from a component creation request to a reviewed change summary">
                      <button type="button" className={s.voiceCompositeButton} aria-label="Enlarge the Update Pricing product showcase" onClick={() => { setExpanded({ src: '/marketing/feature-showcase/assistant-manage-pricing-composite.webp', label: 'Update pricing', alt: 'Two phones showing a Smart Assistant request to create a new component and the resulting reviewed change summary', caption: 'Create or update Smart Components™ by voice, then review the proposed settings before confirming.', width: 1792, height: 1024 }); emit({ action: 'capture_expand', feature: feature.id, scene: scene.id, capture: 'result' }); }}>
                        <img className={s.voiceCompositeImage} src="/marketing/feature-showcase/assistant-manage-pricing-composite.webp" alt="Two phones showing a component creation request and the reviewed pricing configuration" width={1792} height={1024} loading="lazy" />
                      </button>
                    </div>
                  ) : feature.id === 'assistant' && scene.id === 'stay-organised' ? (
                    <div className={s.voiceCompositeStage} role="group" aria-label="Know what is next, from a mobile request to a desktop and assistant overview">
                      <button type="button" className={s.voiceCompositeButton} aria-label="Enlarge the Know What's Next product showcase" onClick={() => { setExpanded({ src: '/marketing/feature-showcase/assistant-know-whats-next-composite.webp', label: "Know what's next", alt: 'A phone showing the Smart Assistant question alongside a laptop showing the desktop workspace and the assistant overview', caption: 'Ask which quotes need attention and review the answer across mobile and desktop.', width: 1664, height: 936 }); emit({ action: 'capture_expand', feature: feature.id, scene: scene.id, capture: 'result' }); }}>
                        <img className={s.voiceCompositeImage} src="/marketing/feature-showcase/assistant-know-whats-next-composite.webp" alt="A phone with the Smart Assistant question beside a laptop showing the workspace and to-do list answer" width={1664} height={936} loading="lazy" />
                      </button>
                    </div>
                  ) : (<>
                  <div className={s.visualTopline}><span><ShowcaseIcon name={feature.id === 'assistant' ? 'phone' : feature.id} size={15} />{feature.id === 'assistant' ? 'On your phone. In your workflow.' : feature.descriptor}</span><span className={s.storyboardBadge}>{hasPlaceholders ? 'Illustrative storyboard' : 'Product screenshots'}</span></div>
                  <div className={s.mobileCaptureToggle} role="group" aria-label="Choose which screenshot to view">
                    {(['request', 'result'] as const).map(role => <button type="button" key={role} aria-pressed={view === role} onClick={() => { setCaptureViews(values => ({ ...values, [feature.id]: role })); emit({ action: 'capture_select', feature: feature.id, scene: scene.id, capture: role, source: 'capture' }); }}><span>{role === 'request' ? '01' : '02'}</span>{scene[role].label}</button>)}
                  </div>
                  <div className={s.captures} data-view={view} key={scene.id} onPointerDown={event => startSwipe(event, feature.id)} onPointerUp={event => finishSwipe(event, feature, featureIndex)} onPointerCancel={() => { touch.current = null; }} onClickCapture={event => { if (Date.now() < preventClickUntil.current) { event.preventDefault(); event.stopPropagation(); } }}>
                    <CapturePanel scene={scene} role="request" onUnavailable={src => setFailedCaptures(values => ({ ...values, [src]: true }))} onAvailable={src => setFailedCaptures(values => values[src] ? { ...values, [src]: false } : values)} onExpand={(capture, role) => { setExpanded(capture); emit({ action: 'capture_expand', feature: feature.id, scene: scene.id, capture: role }); }} />
                    <span className={s.captureConnector} aria-hidden="true"><ShowcaseIcon name="arrow" size={17} /></span>
                    <CapturePanel scene={scene} role="result" onUnavailable={src => setFailedCaptures(values => ({ ...values, [src]: true }))} onAvailable={src => setFailedCaptures(values => values[src] ? { ...values, [src]: false } : values)} onExpand={(capture, role) => { setExpanded(capture); emit({ action: 'capture_expand', feature: feature.id, scene: scene.id, capture: role }); }} />
                  </div>
                  <p className={s.visualNote}>{hasPlaceholders ? 'Layout examples only. These are not screenshots of the live app.' : 'Select a screenshot to take a closer look.'}</p>
                  </>)}
                </div>
              </div>


            </div>
          </div>;
        })}
      </div>
      {features.some(feature => feature.beta) && <p className={s.betaNote}>Smart Assistant V1 Beta: capabilities are developing, and some steps may need manual completion.</p>}
      <span className={s.srOnly} role="status" aria-live="polite" aria-atomic="true">{announcement}</span>
    </div>

    {overviewOpen && <OverviewVideoDialog config={config} onClose={() => setOverviewOpen(false)} />}
    {expanded && <dialog ref={dialog} className={s.dialog} aria-labelledby={`${uid}-capture-title`} onCancel={() => setExpanded(null)} onClose={() => setExpanded(null)} onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setExpanded(null); } }}>
      <div className={s.dialogHeader}><div><p>Product screenshot</p><h4 id={`${uid}-capture-title`}>{expanded.label}</h4></div><button type="button" className={s.clear} aria-label="Close screenshot" onClick={() => setExpanded(null)}><ShowcaseIcon name="close" /></button></div>
      {expandedError ? <p className={s.imageError}>This screenshot could not be loaded. Close this view to continue.</p> : <img className={s.enlargedImage} src={expanded.src} alt={expanded.alt} width={expanded.width} height={expanded.height} onError={() => setExpandedError(true)} />}
      <p className={s.dialogCaption}>{expanded.caption}</p>
    </dialog>}
  </section>;
}
