'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { findTools } from './tool-registry';
import { trackEvent } from '@/lib/analytics';

const EXAMPLE_CHIPS = [
  'Measure a roof',
  'Price a job',
  'Calculate materials',
  'Create a quote',
  'Create an invoice',
];

/** Below this top deterministic score we ask the server (AI fallback) for help. */
const AI_FALLBACK_THRESHOLD = 8;

interface Recommendation {
  toolId: string;
  reason?: string;
  name: string;
  url: string;
  shortDescription: string;
}

/* ── Backend event logging (fire-and-forget, append-only) ──────────────── */

function getSessionId(): string {
  try {
    const KEY = 'qc-finder-session';
    let id = sessionStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return 'anonymous';
  }
}

function logFinderEvent(payload: Record<string, unknown>) {
  try {
    fetch('/api/free-tools/finder-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: getSessionId(), ...payload }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* non-blocking */
  }
}

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
  const [results, setResults] = useState<Recommendation[] | null>(null);
  const [noMatch, setNoMatch] = useState(false);
  const [searching, setSearching] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [intentBucket, setIntentBucket] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastQueryRef = useRef('');

  useEffect(() => {
    setVoiceSupported(getSpeechCtor() !== null);
  }, []);

  const run = useCallback(async (raw: string) => {
    const q = raw.trim();
    if (!q) return;
    lastQueryRef.current = q;
    setSearching(true);
    setNoMatch(false);

    const matches = findTools(q, 3);
    const bucket = matches[0]?.tool.categories[0] ?? 'no_match';
    setIntentBucket(bucket);
    trackEvent('tool_finder_submit', { query_bucket: bucket, query_length: q.length });

    const highConfidence = matches.length > 0 && matches[0].score >= AI_FALLBACK_THRESHOLD;

    if (highConfidence) {
      const recs: Recommendation[] = matches.map((m) => ({
        toolId: m.tool.id,
        name: m.tool.name,
        url: m.tool.url,
        shortDescription: m.tool.shortDescription,
      }));
      setResults(recs);
      trackEvent('tool_finder_deterministic_match', {
        top_tool: recs[0].toolId,
        count: recs.length,
        score: matches[0].score,
      });
      logFinderEvent({
        query: q,
        queryCategory: bucket,
        matchMethod: 'deterministic',
        confidenceScore: matches[0].score,
        recommendedToolIds: recs.map((r) => r.toolId),
        noMatch: false,
      });
      setSearching(false);
      return;
    }

    // Low confidence → server route (re-runs deterministic, then AI if needed)
    try {
      const res = await fetch('/api/free-tools/finder-recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, clientTopScore: matches[0]?.score ?? 0 }),
      });
      if (res.status === 429 || !res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as {
        matchMethod: 'ai' | 'deterministic';
        recommendations: Recommendation[];
      };

      if (data.recommendations.length > 0) {
        setResults(data.recommendations);
        setIntentBucket(data.recommendations[0].toolId.split('-')[0]);
        if (data.matchMethod === 'ai') {
          trackEvent('tool_finder_ai_fallback');
        } else {
          trackEvent('tool_finder_deterministic_match', {
            top_tool: data.recommendations[0].toolId,
            count: data.recommendations.length,
          });
        }
        logFinderEvent({
          query: q,
          queryCategory: bucket,
          matchMethod: data.matchMethod,
          confidenceScore: matches[0]?.score ?? 0,
          recommendedToolIds: data.recommendations.map((r) => r.toolId),
          noMatch: false,
        });
      } else {
        setResults(null);
        setNoMatch(true);
        trackEvent('tool_finder_no_match');
        logFinderEvent({
          query: q,
          queryCategory: 'no_match',
          matchMethod: data.matchMethod,
          confidenceScore: matches[0]?.score ?? 0,
          recommendedToolIds: [],
          noMatch: true,
        });
      }
    } catch {
      // Network/rate-limit failure → fall back to deterministic results (may be empty)
      if (matches.length > 0) {
        const recs: Recommendation[] = matches.map((m) => ({
          toolId: m.tool.id,
          name: m.tool.name,
          url: m.tool.url,
          shortDescription: m.tool.shortDescription,
        }));
        setResults(recs);
        logFinderEvent({
          query: q,
          queryCategory: bucket,
          matchMethod: 'deterministic',
          confidenceScore: matches[0].score,
          recommendedToolIds: recs.map((r) => r.toolId),
          noMatch: false,
        });
      } else {
        setResults(null);
        setNoMatch(true);
        trackEvent('tool_finder_no_match');
      }
    }
    setSearching(false);
  }, []);

  const onRecommendationClick = useCallback((rec: Recommendation, position: number) => {
    trackEvent('tool_finder_recommendation_click', { tool_id: rec.toolId, position, intent: intentBucket ?? 'unclassified' });
    logFinderEvent({
      clickedToolId: rec.toolId,
      clickedPosition: position,
      query: lastQueryRef.current,
    });
  }, [intentBucket]);

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
      {/* Task 1: make the finder visually distinct from normal search */}
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs md:text-sm font-medium uppercase tracking-wide text-slate-400">Not sure which tool you need?</p>
        <h2 className="mt-1 text-lg md:text-2xl font-semibold tracking-tight text-slate-900">
          Tell us what you&apos;re trying to do.
        </h2>
      </div>

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
          disabled={searching}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-black text-white transition-all hover:shadow-[0_0_16px_rgba(255,107,53,0.45)] disabled:opacity-50"
        >
          {searching ? (
            <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          )}
        </button>
      </form>

      {/* Example chips */}
      <p className="mt-3 text-center text-xs text-slate-400">Or choose a common task:</p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
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
          {results.map((rec, i) => (
            <div
              key={rec.toolId}
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
                    <p className="text-sm font-semibold text-slate-900">{rec.name}</p>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">{rec.reason || rec.shortDescription}</p>
                </div>
                <Link
                  href={`${rec.url}${rec.url.includes('?') ? '&' : '?'}source=tool-finder&intent=${encodeURIComponent(intentBucket ?? 'unclassified')}`}
                  prefetch={false}
                  onClick={() => onRecommendationClick(rec, i + 1)}
                  className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-black px-5 py-2.5 text-xs font-semibold text-white transition-all hover:shadow-[0_0_16px_rgba(255,107,53,0.45)] min-h-[40px]"
                >
                  Open {rec.name}
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
