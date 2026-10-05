'use client';
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { workflowSteps } from './homepage-content';
import { FocusDialog } from './FocusDialog';
import { Icon } from './Icon';
import { trackEvent } from '@/lib/analytics';
import s from './Homepage.module.css';

export function WorkflowExplorer() {
  const id = useId();
  const [active, setActive] = useState(0);
  const [imageIndex, setImageIndex] = useState(0);
  const [enlarged, setEnlarged] = useState(false);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const step = workflowSteps[active];
  const image = step.images[imageIndex] ?? step.images[0];
  function select(index: number, focus = false) {
    setActive(index); setImageIndex(0);
    if (focus) buttons.current[index]?.focus({ preventScroll: true });
    trackEvent('homepage_workflow_step', { step: workflowSteps[index].title });
  }
  function key(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = workflowSteps.length - 1;
    const next = event.key === 'ArrowRight' ? (index + 1) % workflowSteps.length : event.key === 'ArrowLeft' ? (index + last) % workflowSteps.length : event.key === 'Home' ? 0 : event.key === 'End' ? last : -1;
    if (next < 0) return;
    event.preventDefault(); select(next, true);
  }
  return <section id="workflow" className={`${s.section} ${s.dark} ${s.workflow}`} aria-labelledby="workflow-title">
    <div className={s.container}>
      <div className={s.sectionIntro}><div><p className={s.eyebrow}>One job. One connected workflow.</p><h2 className={s.sectionTitle} id="workflow-title">More than takeoffs.<br />The whole job, connected.</h2></div><p className={s.introAside}>From the first measurement to the final invoice. Without starting over at every step.</p></div>
      <div role="tablist" aria-label="Explore the QuoteCore+ workflow" className={s.workflowTabs}>
        {workflowSteps.map((item, i) => <button key={item.title} ref={el => { buttons.current[i] = el; }} type="button" role="tab" id={`${id}-tab-${i}`} aria-controls={`${id}-panel-${i}`} aria-selected={active === i} tabIndex={active === i ? 0 : -1} className={s.workflowTab} onClick={() => select(i)} onKeyDown={e => key(e, i)}><span>0{i + 1}</span>{item.title}{active === i && <Icon name="arrow" size={16} />}</button>)}
      </div>
      {workflowSteps.map((item, i) => <div key={item.title} id={`${id}-panel-${i}`} role="tabpanel" aria-labelledby={`${id}-tab-${i}`} hidden={active !== i} tabIndex={0} className={s.workflowPanel}>
        {active === i && <>
          <div className={s.workflowDescription}><span className={s.stepIndex}>0{i + 1}<span> / 06</span></span><h3>{item.heading}</h3><p>{item.body}</p>{item.note && <small>{item.note}</small>}<a className={s.textLink} href="/features">Explore the features<Icon name="arrow" size={16} /></a></div>
          <div className={s.workflowMedia}>
            <button className={s.workflowImage} type="button" aria-haspopup="dialog" aria-label={`Enlarge ${image.alt}`} onClick={() => setEnlarged(true)}><img src={image.src} width={image.width} height={image.height} alt={image.alt} loading="lazy" decoding="async" /><span className={s.enlargeBadge}><Icon name="expand" size={17} />View screenshot</span></button>
            {item.images.length > 1 && <div className={s.imageSwitcher} aria-label="Choose screenshot">{item.images.map((img, j) => <button key={img.src} type="button" aria-pressed={imageIndex === j} onClick={() => setImageIndex(j)}>{j + 1}<span className={s.srOnly}>: {img.alt}</span></button>)}</div>}
          </div>
        </>}
      </div>)}
    </div>
    {enlarged && <FocusDialog wide title={image.alt} eyebrow="Actual product screenshot" onClose={() => setEnlarged(false)}><img className={s.expandedImage} src={image.src} alt={image.alt} width={image.width} height={image.height} /></FocusDialog>}
  </section>;
}
