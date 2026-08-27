'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { findTools, type MatchResult } from './tool-registry';
import { trackEvent } from '@/lib/analytics';

const EXAMPLE_CHIPS = [
  'Measure a roof',
  'Price a job',
  'Calculate materials',
  'Create a quote',
  'Create an invoice',
];

/* ── Voice input (browser Speech API, hidden if unsupported) ───────────── */

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function getSpeechCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => SpeechRecognitionLike) | null;
}

/* ── Component ─────────────────────────────────────────────────────────── */

export default function SmartToolFinder() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MatchResult[] | null>(null);
  const [noMatch, setNoMatch] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setVoiceSupported(getSpeechCtor() !== null);
  }, []);

  const run = useCallback((raw: string) => {
    const q = raw.trim();
    if (!q) return;
    // Privacy-safe: classify the query by its best-matched tool's primary category, never log raw text
    const preview = findTools(q, 1);
    const bucket = preview[0]?.tool.categories[0] ?? 'no_match';
    trackEvent('tool_finder_submit', { query_bucket: bucket, query_length: q.length });
    const matches = findTools(q, 3);
    if (matches.length === 0) {
      setResults(null);
      setNoMatch(true);
      trackEvent('tool_finder_no_match');
    } else {
      setResults(matches);
      setNoMatch(false);
      trackEvent('tool_finder_deterministic_match', {
        top_tool: matches[0].tool.id,
        count: matches.length,
        score: matches[0].score,
      });
    }
  }, []);

  const toggleVoice = useCallback(() => {
    const Ctor = getSpeechCtor();
    if (!Ctor) return;
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const rec = new Ctor();
    rec.lang = 'en-GB';
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e) => {
      const transcript = e.results[0]?.[0]?.transcript ?? '';
      if (transcript) {
        setQuery(transcript);
        trackEvent('tool_finder_voice_used');
        run(transcript);
      }
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  }, [listening, run]);

  return (
    <section className="mx-auto max-w-5xl px-2 md:px-6 pt-2 pb-4 md:pb-6">
      {/* Input */}
      <form
        className="mt-5 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(query);
        }}
      >
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="I need to measure a roof from a PDF plan..."
            aria-label="Describe what you need to do"
            className="w-full rounded-full border-2 border-slate-200 bg-white px-5 py-3.5 pr-12 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#FF6B35] focus:outline-none min-h-[48px]"
          />
          {voiceSupported && (
            <button
              type="button"
              onClick={toggleVoice}
              aria-label={listening ? 'Stop voice input' : 'Start voice input'}
              className={`absolute right-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
                listening
                  ? 'bg-[#FF6B35] text-white animate-pulse'
                  : 'text-slate-400 hover:text-[#FF6B35] hover:bg-orange-50'
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                <path d="M19 10v2a7 7 0 01-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </button>
          )}
        </div>
        <button
          type="submit"
          aria-label="Find a tool"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-black text-white transition-all hover:shadow-[0_0_16px_rgba(255,107,53,0.45)]"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </form>

      {/* Example chips */}
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {EXAMPLE_CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => {
              setQuery(chip);
              run(chip);
            }}
            className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-600 transition-all hover:border-[#FF6B35] hover:text-[#BD4A1A] hover:bg-orange-50/40"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Results */}
      {results && results.length > 0 && (
        <div className="mt-6 space-y-3" aria-live="polite">
          <p className="text-center text-xs md:text-sm font-medium text-slate-500">
            Based on what you described, I&apos;d start here:
          </p>
          {results.map((m, i) => (
            <div
              key={m.tool.id}
              className={`rounded-xl border bg-white p-4 transition-all hover:border-[#FF6B35] hover:shadow-[0_0_12px_rgba(255,107,53,0.12)] ${
                i === 0 ? 'border-[#FF6B35]/60' : 'border-slate-200'
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {i === 0 && (
                      <span className="inline-flex items-center rounded-full bg-[#FF6B35] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                        Best match
                      </span>
                    )}
                    <p className="text-sm font-semibold text-slate-900">{m.tool.name}</p>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">{m.tool.shortDescription}</p>
                </div>
                <Link
                  href={m.tool.url}
                  prefetch={false}
                  onClick={() => trackEvent('tool_finder_recommendation_click', { tool_id: m.tool.id, position: i + 1 })}
                  className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-black px-5 py-2.5 text-xs font-semibold text-white transition-all hover:shadow-[0_0_16px_rgba(255,107,53,0.45)] min-h-[40px]"
                >
                  Open {m.tool.name}
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
              </div>
            </div>
          ))}
          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setResults(null);
                setQuery('');
                inputRef.current?.focus();
              }}
              className="text-xs font-medium text-slate-400 transition-colors hover:text-[#BD4A1A]"
            >
              Ask again
            </button>
          </div>
        </div>
      )}

      {/* No match */}
      {noMatch && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-center" aria-live="polite">
          <p className="text-sm text-slate-600">
            I can help you find the right QuoteCore+ tool. Tell me what you need to measure, calculate, price or create.
          </p>
          <div className="mt-2">
            <button
              type="button"
              onClick={() => {
                setNoMatch(false);
                setQuery('');
                inputRef.current?.focus();
              }}
              className="text-xs font-medium text-slate-400 transition-colors hover:text-[#BD4A1A]"
            >
              Ask again
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
