'use client';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { QcIcon } from '@/app/components/ui/v2/QcIcon';
import './guided-labour.css';
export function LabourIntroduction({onBack,onNext}:{onBack:()=>void;onNext:()=>void}) {
  return <section className="qc-labour-learn">
    <div className="qc-labour-learn-grid">
      <article className="qc-labour-learn-card"><span className="qc-labour-number">01</span><h3>Include the cost of your time</h3>
        <p>Add what it costs you to do the work, using the measurement type you chose.</p>
        <div className="qc-labour-example"><span>Example only</span><strong>$8.00 per metre</strong></div>
      </article>
      <article className="qc-labour-learn-card"><span className="qc-labour-number">02</span><h3>Not every item needs labour</h3>
        <p>If no labour applies, enter zero. You can still use the component for materials.</p>
        <div className="qc-labour-example"><span>Example only</span><strong>$0.00 labour</strong></div>
      </article>
    </div>
    <p className="qc-labour-learn-note">This is your labour cost, not necessarily the price you charge your customer.</p>
    <footer className="qc-identity-footer"><QcButton onClick={onBack}><QcIcon name="back"/>Back</QcButton>
      <QcButton variant="primary" className="qc-identity-glint" onClick={onNext}>Enter labour cost<QcIcon name="arrow"/></QcButton></footer>
  </section>;
}
