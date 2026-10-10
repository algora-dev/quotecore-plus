'use client';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { QcIcon } from '@/app/components/ui/v2/QcIcon';
import './guided-material.css';
export function MaterialIntroduction({ onBack, onNext }: {onBack:()=>void;onNext:()=>void}) {
 return <section className="qc-material-learn">
  <div className="qc-material-learn-grid">
   <article className="qc-material-learn-card"><span className="qc-material-number">01</span><h3>Enter what your material costs</h3><p>Use your own supplier cost. For Valley Flashing, that could be a price per metre.</p><div className="qc-material-example"><span>Example only</span><strong>$24.00 per metre</strong></div></article>
   <article className="qc-material-learn-card"><span className="qc-material-number">02</span><h3>Some materials come in packs</h3><p>If you buy rolls or packs, you may be able to enter their price and size instead.</p><div className="qc-material-example"><span>Example only</span><strong>One 20 m roll</strong></div></article>
  </div>
  <p className="qc-material-learn-note">Enter your material cost here. Labour, waste and other pricing rules come later.</p>
  <footer className="qc-identity-footer"><QcButton onClick={onBack}><QcIcon name="back"/>Back</QcButton><QcButton variant="primary" className="qc-identity-glint" onClick={onNext}>Enter material cost<QcIcon name="arrow"/></QcButton></footer>
 </section>;
}
