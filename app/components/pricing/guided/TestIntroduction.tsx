'use client';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { QcIcon } from '@/app/components/ui/v2/QcIcon';
import './guided-test.css';
export function TestIntroduction({onBack,onNext}:{onBack:()=>void;onNext:()=>void}){
 return <section className="qc-test-learn"><div className="qc-test-learn-grid">
  <article><span className="qc-test-step-number">01</span><h3>Try a real measurement</h3><p>Enter a length, area or quantity, just as you would when pricing a job.</p><div className="qc-test-learn-example"><small>Example only</small><strong>10 m of Valley Flashing</strong></div></article>
  <article><span className="qc-test-step-number">02</span><h3>See how your costs add up</h3><p>Check the calculated materials, labour, waste and pitch. Change a setting if the result needs adjusting.</p><div className="qc-test-learn-example"><small>No quote created</small><strong>Safe to test and fine-tune</strong></div></article>
 </div><p className="qc-test-learn-note">Testing helps you check your pricing before saving. Your example measurements will not create a customer quote.</p>
 <footer className="qc-identity-footer"><QcButton onClick={onBack}><QcIcon name="back"/>Back</QcButton><QcButton variant="primary" className="qc-identity-glint" onClick={onNext}>Test my component<QcIcon name="arrow"/></QcButton></footer></section>;
}
