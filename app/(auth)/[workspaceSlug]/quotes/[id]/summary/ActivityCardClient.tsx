'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';

/**
 * Tabbed Activity card shell.
 *
 * Owns:
 *   - Active tab selection (default chosen by priority: unresolved
 *     first, then scheduled, then sent).
 *   - Collapse/expand state, persisted in localStorage per quoteId so
 *     a user who closes the card on a particular quote doesn't get it
 *     re-expanded every page load.
 *   - Auto-expand override: if there are open unresolved requests or
 *     pending scheduled rows, the card opens regardless of the stored
 *     collapse preference. The user can still collapse it manually
 *     after that.
 *
 * Server data + tab content is passed in via props so this component
 * stays small and runtime-free.
 */

type TabId = 'unresolved' | 'scheduled' | 'sent';

interface Counts {
  unresolved: number;
  scheduled: number;
  sent: number;
}

interface Props {
  quoteId: string;
  counts: Counts;
  /** CTAs rendered on the right side of the header. The card owns the
   *  rest of the header chrome. */
  headerCtas?: ReactNode;
  /** Pre-rendered tab bodies. We swap between them rather than mount
   *  one at a time so each tab keeps its own internal state if the
   *  user flips between them. */
  tabs: {
    unresolved: ReactNode;
    scheduled: ReactNode;
    sent: ReactNode;
  };
}

const STORAGE_KEY_PREFIX = 'quotecore.activityCard.collapsed.';

function storageKey(quoteId: string) {
  return `${STORAGE_KEY_PREFIX}${quoteId}`;
}

export function ActivityCardClient({ quoteId, counts, headerCtas, tabs }: Props) {
  const defaultTab: TabId = useMemo(() => {
    if (counts.unresolved > 0) return 'unresolved';
    if (counts.scheduled > 0) return 'scheduled';
    return 'sent';
  }, [counts.unresolved, counts.scheduled]);

  const [active, setActive] = useState<TabId>(defaultTab);
  // SSR-safe: assume expanded on first paint so server and client
  // markup match. We rehydrate from localStorage in the effect below.
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [hydrated, setHydrated] = useState(false);

  // Auto-expand when there's something demanding attention. We use
  // this as the source of truth on the initial render and on count
  // changes (e.g. the user just resolved the last request, the page
  // re-renders, the card stays collapsed).
  const needsAttention = counts.unresolved > 0 || counts.scheduled > 0;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(storageKey(quoteId));
    } catch {
      // Safari private mode / disabled storage \u2014 fall through with no
      // persisted preference. The default heuristic still applies.
    }
    if (stored === 'collapsed') {
      // User explicitly collapsed this quote's card. Honour that even
      // when there's attention pending \u2014 they made a deliberate call.
      // We DO still auto-expand on first load if there's attention and
      // they've never collapsed, which is the default branch below.
      setCollapsed(true);
    } else if (stored === 'expanded') {
      setCollapsed(false);
    } else {
      // No stored preference \u2014 collapsed by default when nothing
      // needs attention. Counter-intuitive but matches the screenshot
      // goal: less clutter when there's nothing to do.
      setCollapsed(!needsAttention);
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteId]);

  // If counts change after hydration (e.g. user resolves a request,
  // page re-renders) and there's no longer anything to attend to and
  // the user never explicitly expanded, collapse automatically.
  useEffect(() => {
    if (!hydrated) return;
    if (typeof window === 'undefined') return;
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(storageKey(quoteId));
    } catch {
      // ignore
    }
    if (stored !== 'expanded' && stored !== 'collapsed') {
      setCollapsed(!needsAttention);
    }
  }, [needsAttention, hydrated, quoteId]);

  // Whenever a tab gains rows the parent might want us to switch to
  // it. We don't aggressively re-set the active tab on every count
  // change (would steal focus from the user); we only nudge the
  // active tab toward priority on first render or when the count for
  // the current tab drops to zero.
  useEffect(() => {
    const activeCount =
      active === 'unresolved' ? counts.unresolved : active === 'scheduled' ? counts.scheduled : counts.sent;
    if (activeCount === 0) {
      setActive(defaultTab);
    }
  }, [defaultTab, active, counts.unresolved, counts.scheduled, counts.sent]);

  function persistCollapsed(next: boolean) {
    setCollapsed(next);
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(storageKey(quoteId), next ? 'collapsed' : 'expanded');
    } catch {
      // ignore
    }
  }

  // Don't render anything at all when there's literally zero activity
  // anywhere AND the user has no CTAs to fire \u2014 keeps fresh quotes
  // clean. Auto-evaluate on every render so the card appears as soon
  // as something happens.
  const totallyEmpty = counts.unresolved === 0 && counts.scheduled === 0 && counts.sent === 0;
  if (totallyEmpty && !headerCtas) return null;

  const summaryParts: string[] = [];
  if (counts.unresolved > 0) summaryParts.push(`${counts.unresolved} unresolved`);
  if (counts.scheduled > 0) summaryParts.push(`${counts.scheduled} scheduled`);
  if (counts.sent > 0) summaryParts.push(`${counts.sent} sent`);
  const summary = summaryParts.length > 0 ? summaryParts.join(' \u00b7 ') : 'No activity yet';

  return (
    <div
      className={`data-exclude-pdf rounded-2xl border bg-white ${
        counts.unresolved > 0 ? 'border-orange-300' : 'border-slate-200'
      }`}
    >
      {/* Header row: title + summary on the left, CTAs + collapse on
          the right. Always rendered so the Schedule follow-up CTA stays
          reachable even when the card is collapsed. */}
      <div className="flex items-center justify-between gap-3 flex-wrap p-4">
        <button
          type="button"
          onClick={() => persistCollapsed(!collapsed)}
          className="flex items-center gap-2 text-left flex-1 min-w-0 group"
          aria-expanded={!collapsed}
          aria-controls={`activity-card-body-${quoteId}`}
        >
          <span
            className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
              counts.unresolved > 0 ? 'bg-orange-100' : 'bg-slate-100'
            }`}
          >
            <svg
              className={`w-5 h-5 ${counts.unresolved > 0 ? 'text-orange-600' : 'text-slate-500'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
              />
            </svg>
          </span>
          <span className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-slate-900">Activity</span>
            <span className="text-xs text-slate-500 truncate">{summary}</span>
          </span>
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${
              collapsed ? '' : 'rotate-180'
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {headerCtas ? (
          <div className="flex items-center gap-2 flex-wrap">{headerCtas}</div>
        ) : null}
      </div>

      {!collapsed ? (
        <div id={`activity-card-body-${quoteId}`} className="border-t border-slate-200">
          {/* Tabs */}
          <div className="flex items-center gap-1 px-3 pt-2 overflow-x-auto">
            <TabButton
              label="Unresolved"
              count={counts.unresolved}
              isActive={active === 'unresolved'}
              highlight={counts.unresolved > 0}
              onClick={() => setActive('unresolved')}
            />
            <TabButton
              label="Scheduled"
              count={counts.scheduled}
              isActive={active === 'scheduled'}
              onClick={() => setActive('scheduled')}
            />
            <TabButton
              label="Sent"
              count={counts.sent}
              isActive={active === 'sent'}
              onClick={() => setActive('sent')}
            />
          </div>

          {/* Tab body */}
          <div className="p-4 pt-3">
            {active === 'unresolved' ? tabs.unresolved : null}
            {active === 'scheduled' ? tabs.scheduled : null}
            {active === 'sent' ? tabs.sent : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TabButton({
  label,
  count,
  isActive,
  highlight = false,
  onClick,
}: {
  label: string;
  count: number;
  isActive: boolean;
  highlight?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative px-3 py-2 text-xs font-medium rounded-t-lg transition-colors ${
        isActive
          ? 'text-slate-900 bg-slate-100 border-b-2 border-slate-900'
          : 'text-slate-500 hover:text-slate-700 border-b-2 border-transparent'
      }`}
    >
      <span className="flex items-center gap-1.5">
        {label}
        <span
          className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] rounded-full ${
            count === 0
              ? 'bg-slate-100 text-slate-400'
              : highlight
                ? 'bg-orange-100 text-orange-700'
                : isActive
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-200 text-slate-700'
          }`}
        >
          {count}
        </span>
      </span>
    </button>
  );
}
