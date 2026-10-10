'use client';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { QcIcon } from '@/app/components/ui/v2/QcIcon';
import './guided-review.css';
export function ReviewIntroduction({onBack,onNext}:{onBack:()=>void;onNext:()=>void}) {
 return <section className="qc-final-learn"><div className="qc-final-grid">
 <article><span className="qc-final-number">01</span><h3>Check your details</h3><p>Make sure the name, costs, measurement and rules look right before saving.</p><div className="qc-final-example">You can go back and change anything.</div></article>
 <article><span className="qc-final-number">02</span><h3>Leave a note if useful</h3><p>Notes can remind you or your team about this pricing item.</p><div className="qc-final-example">For example: "Check supplier price before quoting" or "Allow extra for complex valleys".</div></article>
 </div><div className="qc-final-tip"><strong>One last check.</strong> Save this item in your selected library. Your test measurement is only an example, not a customer quote.</div>
 <footer className="qc-identity-footer"><QcButton onClick={onBack}><QcIcon name="back"/>Back</QcButton><QcButton variant="primary" className="qc-identity-glint" onClick={onNext}>Review my component<QcIcon name="arrow"/></QcButton></footer></section>;
}
