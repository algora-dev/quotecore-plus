"use client";
import { forwardRef } from 'react';
import type { QuoteEntryMode } from './quoteJourney';
import './quote-entry.css';

/** C72: acquisition choice only. Click never creates a quote or grants access. */
export const MeasurementChoiceCards = forwardRef<HTMLDivElement, {
  value: QuoteEntryMode | null; onSelect: (value: 'manual' | 'digital') => void;
  digitalAvailable: boolean; disabled?: boolean; describedBy?: string;
  /** Third start option (owner 2026-11-16): line-by-line quote as an equal card. */
  blankSelected?: boolean; onSelectBlank?: () => void;
}>(function MeasurementChoiceCards({ value, onSelect, digitalAvailable, disabled, describedBy, blankSelected, onSelectBlank }, ref) {
  return <div ref={ref} tabIndex={-1} className="qce-paths" role="group"
    aria-label="How do you want to start this quote?" aria-describedby={describedBy} data-qc-component="C72">
    <button type="button" className="qce-path" aria-pressed={value === 'manual'} disabled={disabled}
      onClick={() => onSelect('manual')}>
      <span className="qce-path-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M5 3h10l4 4v14H5V3Zm4 6h6M9 13h2m-2 4h2m3-2 2 2 4-5" /></svg></span>
      <span className="qce-path-copy"><strong>I have measurements</strong>
        <span>From site, a survey, or someone else.</span><small>Enter them and price the job</small></span>
      <span className="qce-path-check" aria-hidden="true">{value === 'manual' ? '✓' : '→'}</span>
    </button>
    <button type="button" className="qce-path" aria-pressed={value === 'digital'} disabled={disabled}
      onClick={() => onSelect('digital')}>
      <span className="qce-path-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4h16v16H4V4Zm3 3h4m-4 4v2m0 4h10M13 7h4v6m-6-2 2 2 4-4" /></svg></span>
      <span className="qce-path-copy"><strong>I need to measure</strong>
        <span>Use a plan or image in Digital Takeoff.</span><small>{digitalAvailable ? 'Measure first, then price the job' : 'View upgrade options for Digital Takeoff'}</small></span>
      <span className="qce-path-check" aria-hidden="true">{value === 'digital' ? '✓' : '→'}</span>
    </button>
    {onSelectBlank && (
      <button type="button" className="qce-path" aria-pressed={blankSelected || undefined} disabled={disabled}
        onClick={onSelectBlank}>
        <span className="qce-path-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M4.75 20.25h14.5" /></svg></span>
        <span className="qce-path-copy"><strong>Write a line-by-line quote</strong>
          <span>No measurements needed for this job.</span><small>Write → review → send</small></span>
        <span className="qce-path-check" aria-hidden="true">{blankSelected ? '✓' : '→'}</span>
      </button>
    )}
  </div>;
});
