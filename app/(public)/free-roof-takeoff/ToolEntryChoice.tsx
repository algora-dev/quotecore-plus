'use client';

import { useState } from 'react';
import Link from 'next/link';

/**
 * Entry flow for the free roof tool (owner 2026-10-03): one base URL, two
 * starting points. "I already have measurements" -> actual-vs-plan sub-choice
 * -> /measurement-to-quote-tool?mode=actual|plan (the builder starts in that
 * configuration). "I need to measure" -> /free-roof-takeoff/measure (the
 * takeoff tool as it begins today). Flow-first build; the external UX agent
 * will restyle to the v2 standard.
 */
export function ToolEntryChoice() {
  const [stage, setStage] = useState<'start' | 'measurements'>('start');

  const cardClass = 'group flex w-full items-start gap-4 rounded-xl border-2 border-slate-200 bg-white p-5 text-left transition-colors hover:border-orange-400 hover:bg-orange-50/40';
  const iconWrap = 'mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white';
  const titleClass = 'block text-base font-semibold text-slate-900';
  const descClass = 'mt-1 block text-sm leading-relaxed text-slate-500';
  const arrow = (
    <svg className="ml-auto mt-3 h-5 w-5 shrink-0 text-slate-300 transition-colors group-hover:text-[#FF6B35]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 12h16m-6-6 6 6-6 6" />
    </svg>
  );

  if (stage === 'measurements') {
    return (
      <div className="mx-auto max-w-2xl px-4">
        <button type="button" onClick={() => setStage('start')} className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition-colors hover:text-slate-800">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4m6-6-6 6 6 6" />
          </svg>
          Back
        </button>
        <h2 className="text-center text-lg font-semibold text-slate-900">What kind of measurements do you have?</h2>
        <p className="mt-1 mb-4 text-center text-sm text-slate-500">This sets how the tool handles roof pitch for you.</p>
        <div className="grid gap-4">
          <Link href="/measurement-to-quote-tool?mode=actual" className={cardClass}>
            <span className={iconWrap}>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.65} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </span>
            <span>
              <span className={titleClass}>Actual measurements</span>
              <span className={descClass}>
                Final, true dimensions - measured on site, from a satellite or aerial report, or another tool.
                Type them straight in. No pitch calculation needed.
              </span>
            </span>
            {arrow}
          </Link>
          <Link href="/measurement-to-quote-tool?mode=plan" className={cardClass}>
            <span className={iconWrap}>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.65} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 19 21 5v14H3ZM15 19v-5h6" />
              </svg>
            </span>
            <span>
              <span className={titleClass}>Plan measurements</span>
              <span className={descClass}>
                Top-down plan dimensions. Enter them with the roof pitch - the tool calculates the real
                sloped lengths and areas for you.
              </span>
            </span>
            {arrow}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4">
      <h2 className="text-center text-lg font-semibold text-slate-900">How do you want to start?</h2>
      <p className="mt-1 mb-4 text-center text-sm text-slate-500">Both paths are free - no signup required.</p>
      <div className="grid gap-4">
        <button type="button" onClick={() => setStage('measurements')} className={`${cardClass} cursor-pointer`}>
          <span className={iconWrap}>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.65} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 8h16v12H4V8Zm2 0V5h12v3M8 5V2h8v3M9 12h6m-6 4h6" />
            </svg>
          </span>
          <span>
            <span className={titleClass}>I already have my measurements</span>
            <span className={descClass}>
              From a site measure, a plan takeoff, a satellite report or another estimating tool. Enter areas,
              lengths and quantities - the tool prices them with your own rates.
            </span>
          </span>
          {arrow}
        </button>
        <Link href="/free-roof-takeoff/measure" className={cardClass}>
          <span className={iconWrap}>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.65} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m4 16 12-12 4 4L8 20l-4-4Zm9-9 3 3m-6 0 2 2m-5 1 3 3" />
            </svg>
          </span>
          <span>
            <span className={titleClass}>I need to measure a plan</span>
            <span className={descClass}>
              Upload a roof plan, drawing or aerial image, set the scale, and measure areas, ridges, hips,
              valleys and eaves in your browser.
            </span>
          </span>
          {arrow}
        </Link>
      </div>
    </div>
  );
}
