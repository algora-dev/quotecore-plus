'use client';

import { useEffect, useRef, useState } from 'react';
import { MarketingButton } from '@/components/marketing/MarketingButton';
import { Icon } from './Icon';
import s from './BenchmarkStrip.module.css';

type ProofImage = {
  src: string;
  label: string;
  alt: string;
  quote?: boolean;
};

const proofImages: ProofImage[] = [
  {
    src: '/marketing/home/benchmark/benchmark-blank.png',
    label: 'Blank plan',
    alt: 'Blank multi-face residential roof plan before measurement',
  },
  {
    src: '/marketing/home/benchmark/benchmark-measured.png',
    label: 'Measured roof',
    alt: 'The same multi-face residential roof measured in QuoteCore+',
  },
  {
    src: '/marketing/home/benchmark/benchmark-quote.png',
    label: 'Sent quote',
    alt: 'Customer roofing quote produced from the measured roof in QuoteCore+',
    quote: true,
  },
];

export function BenchmarkStrip() {
  const [active, setActive] = useState<ProofImage | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const lastTrigger = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (active && !dialog.open) {
      dialog.showModal();
      document.documentElement.classList.add(s.modalOpen);
    } else if (!active && dialog.open) {
      dialog.close();
      document.documentElement.classList.remove(s.modalOpen);
    }
  }, [active]);

  useEffect(() => () => document.documentElement.classList.remove(s.modalOpen), []);

  const openImage = (image: ProofImage, trigger: HTMLButtonElement) => {
    lastTrigger.current = trigger;
    setActive(image);
  };

  const closeImage = () => {
    setActive(null);
    window.requestAnimationFrame(() => lastTrigger.current?.focus());
  };

  return (
    <section className={s.band} aria-labelledby="benchmark-band-title">
      <div className={s.container}>
        <div className={s.card}>
          <div className={s.timeBlock}>
            <span>Roofing speed benchmark</span>
            <strong>2:27</strong>
            <small>Blank plan to quote sent</small>
          </div>

          <div className={s.copy}>
            <h2 id="benchmark-band-title">Blank multi-face roof plan to customer quote sent in 2:27.</h2>
            <p>Every roof component measured and priced, not just roof area × a rate.</p>
          </div>

          <div className={s.proof} aria-label="Benchmark proof: blank plan, measured roof and sent quote">
            {proofImages.map((image, index) => (
              <div className={s.proofStep} key={image.src}>
                <button
                  type="button"
                  className={`${s.thumbButton} ${image.quote ? s.quoteThumb : ''}`}
                  onClick={(event) => openImage(image, event.currentTarget)}
                  aria-label={`Open larger image: ${image.label}`}
                >
                  <img src={image.src} alt={image.alt} loading="lazy" decoding="async" />
                  <span className={s.zoomCue} aria-hidden="true"><Icon name="expand" size={16} /></span>
                </button>
                <span className={s.caption}>{image.label}</span>
                {index < proofImages.length - 1 ? <span className={s.arrow} aria-hidden="true">→</span> : null}
              </div>
            ))}
          </div>

          <MarketingButton
            href="/fastest-roofing-estimating-software"
            variant="primary"
            size="large"
            className={s.cta}
            icon={<Icon name="arrow" size={18} />}
          >
            See How Here
          </MarketingButton>
        </div>
      </div>

      <dialog
        ref={dialogRef}
        className={s.dialog}
        aria-labelledby="benchmark-image-title"
        onClose={() => setActive(null)}
        onCancel={(event) => {
          event.preventDefault();
          closeImage();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeImage();
        }}
      >
        {active ? (
          <div className={s.dialogPanel}>
            <div className={s.dialogHeader}>
              <div>
                <span>2:27 benchmark evidence</span>
                <h3 id="benchmark-image-title">{active.label}</h3>
              </div>
              <button type="button" className={s.closeButton} onClick={closeImage} aria-label="Close image preview"><Icon name="close" size={20} /></button>
            </div>
            <div className={`${s.dialogImageWrap} ${active.quote ? s.dialogQuote : ''}`}>
              <img src={active.src} alt={active.alt} />
            </div>
          </div>
        ) : null}
      </dialog>
    </section>
  );
}
