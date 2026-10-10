'use client';
import type { MeasurementSystem } from '@/app/lib/types';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { QcIcon } from '@/app/components/ui/v2/QcIcon';
import { COMMON_MEASUREMENT_TYPES, measurementOption } from './measurement-state';
import { MeasurementPicture } from './MeasurementPicture';
import './guided-measurement.css';

export function MeasurementIntroduction({ system, onBack, onNext }: {
  system: MeasurementSystem; onBack: () => void; onNext: () => void;
}) {
  return <section className="qc-measure-introduction" aria-label="Understanding measurement types">
    <div className="qc-measure-learn-content">
      <div className="qc-measure-learn-grid">
        {COMMON_MEASUREMENT_TYPES.map(type => {
          const option = measurementOption(type, system);
          return <article className="qc-measure-learn-card" key={type}>
            <div className="qc-measure-learn-art"><MeasurementPicture kind={option.picture} /><span>{option.amount}</span></div>
            <div><h3>{option.title}</h3><p>{option.short}</p></div>
          </article>;
        })}
      </div>
      <p className="qc-measure-common-note">These are four common examples. You can choose from more measurement types on the next screen.</p>
    </div>
    <footer className="qc-identity-footer"><QcButton onClick={onBack}><QcIcon name="back" />Back</QcButton>
      <QcButton variant="primary" className="qc-identity-glint" onClick={onNext}>Choose a measurement type<QcIcon name="arrow" /></QcButton>
    </footer>
  </section>;
}
