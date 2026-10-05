'use client';
import { Icon } from './Choice';
import { TIERS, type UsageTier } from './types';
import { TIER_LABELS } from './description';
/** Compact native radio group. No prices: workload and allowance choices come first. */
export function AllowanceControl({ id, label, selected, recommended, details, onChange }: {
  id: string; label: string; selected: UsageTier; recommended: UsageTier;
  details: Record<UsageTier, string>; onChange: (tier: UsageTier) => void;
}) {
  return <fieldset className="qcp-fieldset qcp-tier-control"><legend className="qcp-sr-only">{label}</legend>
    <div className="qcp-tier-options">{TIERS.map(tier => <label key={tier} data-selected={selected === tier || undefined}>
      <input type="radio" name={id} value={tier} checked={selected === tier} onChange={() => onChange(tier)} form={`${id}-detached`} />
      <span className="qcp-tier-title">{TIER_LABELS[tier]}<span className="qcp-check" aria-hidden="true">{selected === tier && <Icon name="check" size={12} />}</span></span>
      <span className="qcp-tier-detail">{details[tier]}</span>
      {tier === recommended && <span className="qcp-tier-recommended">Recommended</span>}
    </label>)}</div>
    <p className="qcp-tier-context">Recommended based on your workload. You can choose more or less.</p>
  </fieldset>;
}
