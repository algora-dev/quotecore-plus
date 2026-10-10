 'use client';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { QcIcon } from '@/app/components/ui/v2/QcIcon';
import './guided-rules.css';
export function RulesIntroduction({ onBack, onNext, pitchVisible }: {onBack:()=>void;onNext:()=>void;pitchVisible:boolean}) {
 return <section className="qc-rules-learn">
  <div className="qc-rules-learn-grid">
   <article className="qc-rules-learn-card"><span className="qc-rules-number">01</span><h3>Allow for waste, if needed</h3><p>Some jobs need extra material for cuts or offcuts. Choose a percentage or a fixed allowance.</p><div className="qc-rules-example"><span>Example only</span><strong>5% extra material</strong></div></article>
   <article className="qc-rules-learn-card"><span className="qc-rules-number">02</span><h3>Does pitch change the measurement?</h3><p>{pitchVisible ? 'Pitch adjusts top-down plan measurements to account for the roof slope. If you already measured the actual sloped length or area, do not apply pitch again.' : 'Some trades use pitch rules. Your current trade does not require this setting.'}</p><div className="qc-rules-example"><span>Example only</span><strong>{pitchVisible?'Rafter or valley / hip pitch':'No pitch adjustment'}</strong></div></article>
  </div>
  <p className="qc-rules-note">These rules are optional. Smart Components™ apply your chosen settings when calculating quantities.</p>
  <footer className="qc-identity-footer"><QcButton onClick={onBack}><QcIcon name="back"/>Back</QcButton><QcButton variant="primary" className="qc-identity-glint" onClick={onNext}>Choose your rules<QcIcon name="arrow"/></QcButton></footer>
 </section>;
}
