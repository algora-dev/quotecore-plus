'use client';
import { useEffect, useState } from 'react';
import { ShowcaseIcon } from './ShowcaseIcon';
import type { Capture, CaptureRole, ShowcaseScene } from './showcase-types';
import s from './FeatureShowcase.module.css';

type Props = { scene: ShowcaseScene; role: CaptureRole; onExpand: (capture: Capture, role: CaptureRole) => void; onUnavailable: (src: string) => void; onAvailable: (src: string) => void };

export function CapturePanel({ scene, role, onExpand, onUnavailable, onAvailable }: Props) {
  const capture = scene[role];
  const [failedSrc, setFailedSrc] = useState('');
  useEffect(() => { setFailedSrc(''); }, [capture.src]);
  const available = Boolean(capture.src && capture.src !== failedSrc);
  const isRequest = role === 'request';
  return <figure className={`${s.capture} ${isRequest ? s.requestCapture : s.resultCapture}`} data-capture={role}>
    <div className={s.captureHeading}><span className={s.captureNumber}>{isRequest ? '01' : '02'}</span><span>{capture.label}</span>{available && <span className={s.realLabel}>Product capture</span>}</div>
    {available ? <button className={s.captureImageButton} data-capture-trigger="true" type="button" aria-haspopup="dialog" aria-label={`Enlarge: ${capture.alt}`} onClick={() => onExpand(capture, role)}>
      <img src={capture.src} alt={capture.alt} width={capture.width} height={capture.height} loading="lazy" decoding="async" onLoad={() => onAvailable(capture.src || '')} onError={() => { setFailedSrc(capture.src || ''); onUnavailable(capture.src || ''); }} />
      <span className={s.expandBadge}><ShowcaseIcon name="expand" size={15} /><span>Enlarge</span></span>
    </button> : <div className={`${s.placeholder} ${isRequest ? s.requestPlaceholder : s.resultPlaceholder}`}>
      {isRequest ? <>
        <div className={s.inputEmblem}><ShowcaseIcon name={scene.icon} size={23} /></div>
        <p className={s.placeholderEyebrow}>{scene.inputLabel}</p>
        <p className={s.sampleRequest}>{scene.input}</p>
        {scene.icon === 'mic' && <div className={s.waveform} aria-hidden="true">{[12,22,16,30,40,24,16,32,44,28,20,12,30,36,20,14,26,18,10].map((height, i) => <span key={i} style={{ height }} />)}</div>}
      </> : <>
        <div className={s.resultEmblem}><ShowcaseIcon name={scene.icon === 'mic' ? 'document' : scene.icon} size={27} /><span><ShowcaseIcon name="check" size={12} /></span></div>
        <p className={s.outputTitle}>{scene.outputTitle}</p><p className={s.outputSubtitle}>{scene.outputSubtitle}</p>
        <dl className={s.outputRows}>{scene.outputRows.map(row => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>
      </>}
      <p className={s.capturePlaceholderLabel}><ShowcaseIcon name="image" size={14} /><span>{failedSrc && capture.src === failedSrc ? 'Image unavailable. Showing placeholder.' : `${isRequest ? 'Request' : 'Result'} screenshot goes here`}</span></p>
    </div>}
    <figcaption>{capture.caption}</figcaption>
  </figure>;
}
