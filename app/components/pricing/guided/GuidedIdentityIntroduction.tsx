'use client';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { QcIcon } from '@/app/components/ui/v2/QcIcon';
import { EXAMPLE_NAME } from './identity-state';

export function GuidedIdentityIntroduction({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  return <section className="qc-learn" aria-label="Before you start">
    <div className="qc-learn-heading"><span className="qc-identity-eyebrow">BEFORE YOU START</span>
      <h3>Two things to decide.</h3>
      <p>First, give your pricing item a clear name. Then choose where to keep it.</p>
    </div>
    <div className="qc-learn-grid">
      <article className="qc-learn-card"><div className="qc-learn-number">01</div><h4>A name that makes sense</h4>
        <p>Recognise it when pricing a job. Make it clear enough for your customer to read on a quote.</p>
        <div className="qc-learn-example"><span>Example name</span><strong>{EXAMPLE_NAME}</strong></div>
      </article>
      <article className="qc-learn-card"><div className="qc-learn-number">02</div><h4>A library to keep it in</h4>
        <p>Libraries work like folders. Keep everything together, or organise by type of work.</p>
        <div className="qc-learn-folders"><span>Roofing Long Run Materials</span><span>Roofing Shingles Materials</span><span>Roofing Custom Services &amp; Products</span></div>
      </article>
    </div>
    <div className="qc-learn-quote"><div className="qc-learn-quote-top"><strong>How your customer might see it</strong><span>Example only</span></div>
      <div className="qc-learn-quote-row"><strong>{EXAMPLE_NAME}</strong><span>10 m</span><span>$35.00/m</span><b>$350.00</b></div>
      <p>That same name helps you find the item in Quote Builder and Digital Takeoff.</p>
    </div>
    <footer className="qc-identity-footer qc-learn-footer"><QcButton onClick={onBack}><QcIcon name="back" />Back to pricing</QcButton>
      <QcButton variant="primary" className="qc-identity-glint" onClick={onNext}>Got it, enter the details<QcIcon name="arrow" /></QcButton>
    </footer>
  </section>;
}
