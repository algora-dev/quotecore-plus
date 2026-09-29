"use client";
import { PRICING_EXPERIENCE_LABEL, resolvePricingExperience } from './quoteJourney';
import './quote-entry.css';

/** C73: one arrival vocabulary for both existing builders. This component never
 * hydrates measurements, sets phases, refreshes the route or changes pitch.
 * Guided stays dark; this is not a mode selector or a second editor.
 */
export function QuoteJourneyContext({ digital, hasMeasurements, pitchRelevant }: {
  digital: boolean; hasMeasurements: boolean; pitchRelevant: boolean;
}) {
  return <details className="qce-context" data-qc-component="C73" data-pricing-experience={resolvePricingExperience()}>
    <summary><span className="qce-context-title">{PRICING_EXPERIENCE_LABEL} workspace</span>
      <span className="qce-context-summary">{hasMeasurements ? 'Check measurements, then pricing' : 'Add measurements to price this job'}</span>
      <span className="qce-context-help">How it works</span></summary>
    <div className="qce-context-body">
      <p>{digital && hasMeasurements
        ? 'Saved Takeoff measurements are loaded here. Check the areas and components, add anything missing, then review the price.'
        : digital ? 'Add or check the measurements for this job. The existing Digital Takeoff action remains available when you need to measure a plan.'
        : 'Use measurements from any source. Areas let you reuse a total across components. You can also go straight to Components and enter an area, length or quantity there.'}</p>
      {pitchRelevant && <p><strong>Plan or actual?</strong> Choose this on each component. Plan measurements can use its pitch rule; actual measurements are already measured along the surface. Waste and purchasing rules still apply. Keep different measurement types separate.</p>}
      <p>Both entry paths use this same pricing workspace. Review margins and tax before creating the customer quote.</p>
    </div>
  </details>;
}

/** Read-only interpretation help. The existing component handler owns input_mode.
 * Never infer that all measurements in a job share a pitch/basis.
 */
export function MeasurementBasisHelp({ isPlan, hasPitch }: { isPlan: boolean; hasPitch: boolean }) {
  return <p className="qce-basis-help">
    {!hasPitch ? 'This component has no pitch adjustment. Waste and purchasing rules still apply.'
      : isPlan ? 'Measured from above. The component’s pitch rule uses the area pitch or a custom angle below.'
      : 'Already measured along the surface. No pitch is added; waste and purchasing rules still apply.'}
  </p>;
}
