'use client';
// Mobile takeoff M2: touch presentation shell (spec §3.3/§3.4).
//
// Landscape-first layout: top strip (Back / plan-page label / step indicator /
// Save / Menu), canvas region + right rail, bottom strip (context hint / draft
// status / undo-redo). Portrait shows a dismissible hint — NO CSS rotation and
// NO orientation lock (§3.2). 48×48 targets, 8px gaps, safe-area insets on
// both landscape sides + bottom; operable at 568×320 CSS px.
//
// MOUNT-STABILITY CONTRACT (§3.4): the DOM skeleton (root → mid row → canvas
// slot → children) is ALWAYS mounted, including in desktop presentation, so
// switching Desktop ↔ Mobile/touch never remounts the workstation. In desktop
// presentation every wrapper is `display: contents` / `hidden` and the root
// carries the exact original `w-[125%] -ml-[12.5%]` widening classes — the
// desktop layout is bit-for-bit (extra contents-divs only, no layout effect).
//
// M2 scope: the right rail holds view controls only (Fit plan / zoom ± / Move
// plan — disabled placeholders except view-mode switching); the four-button
// point controller lands in M3. No gestures, no calibration/outline flows.
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useImmersiveTakeoffAttribute } from './immersiveWorkspace';
import type { WorkspaceViewPreference } from './viewMode';

export type TakeoffStep = 'calibrate' | 'outline' | 'components';

interface TouchWorkspaceShellProps {
  /** True = touch presentation; false = desktop presentation (unchanged layout). */
  active: boolean;
  /** All takeoff chrome + the workstation as children (stable mount slot). */
  children: ReactNode;
  /** e.g. "Plan page 1". */
  planLabel: string;
  /** Guided-sequence step indicator state (M2: display only). */
  step: TakeoffStep;
  /** View-mode control wiring (spec §3.1; always reachable via Menu). */
  viewPreference: WorkspaceViewPreference;
  onViewPreferenceChange: (preference: WorkspaceViewPreference) => void;
  /** Compact required-notice lines (entitlement/impersonation), §3.4/L08. */
  compactNotices?: readonly string[];
  /** M3: interaction-surface overlay mounted in the canvas slot (touch only). */
  overlay?: ReactNode;
  /** M3: right-rail content (point controller + view controls); replaces the
   *  M2 placeholder rail when provided. */
  rail?: ReactNode;
  /** M3: bottom-strip content (hint / draft / undo-redo); replaces the M2
   *  placeholder strip when provided. */
  bottom?: ReactNode;
  /** Back navigation target (quote page). */
  backHref: string;
  /** M5/O16: dirty-draft exit guard. When dirty, Back shows a
   *  Save/Discard/Stay sheet instead of navigating away. */
  exitGuard?: {
    dirty: boolean;
    onSave: () => void;
    onDiscard: () => void;
  };
}

const VIEW_OPTIONS: readonly { value: WorkspaceViewPreference; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'desktop', label: 'Desktop' },
  { value: 'mobile-touch', label: 'Mobile / touch' },
];

const STEPS: readonly { value: TakeoffStep; label: string }[] = [
  { value: 'calibrate', label: 'Calibrate' },
  { value: 'outline', label: 'Outline' },
  { value: 'components', label: 'Components' },
];

/** 48×48 minimum touch target button (§3.3), design-system rounded-full. */
function TouchButton({
  onClick,
  children,
  disabled,
  label,
  variant = 'default',
}: {
  onClick?: () => void;
  children: ReactNode;
  disabled?: boolean;
  label: string;
  variant?: 'default' | 'accent';
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-12 min-w-12 items-center justify-center rounded-full px-3 text-xs font-semibold transition-colors disabled:opacity-40 ${
        variant === 'accent'
          ? 'bg-[#FF6B35] text-white hover:bg-[#e55a28]'
          : 'border border-white/20 bg-white/10 text-white hover:bg-white/20'
      }`}
    >
      {children}
    </button>
  );
}

export function TouchWorkspaceShell({
  active,
  children,
  planLabel,
  step,
  viewPreference,
  onViewPreferenceChange,
  compactNotices = [],
  overlay,
  rail,
  bottom,
  backHref,
  exitGuard,
}: TouchWorkspaceShellProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [backGuardOpen, setBackGuardOpen] = useState(false);
  const [portraitHintDismissed, setPortraitHintDismissed] = useState(false);
  const [showPortraitHint, setShowPortraitHint] = useState(false);
  useImmersiveTakeoffAttribute(active);

  // Portrait detection via matchMedia (no orientation lock; §3.2). Dismissal
  // persists for the session only.
  useEffect(() => {
    if (!active) return;
    let mq: MediaQueryList | null = null;
    try {
      mq = window.matchMedia('(orientation: portrait)');
    } catch {
      mq = null;
    }
    if (!mq) return;
    const update = () => setShowPortraitHint(mq!.matches && !portraitHintDismissed);
    // Initial sync deferred out of the effect body (react-hooks lint) while
    // remaining immediate enough to paint with the first landscape frame.
    queueMicrotask(update);
    mq.addEventListener('change', update);
    return () => mq!.removeEventListener('change', update);
  }, [active, portraitHintDismissed]);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const handleBack = useCallback(() => {
    // O16: a dirty outline draft is resolved BEFORE navigation (§11.5).
    if (exitGuard?.dirty) {
      setBackGuardOpen(true);
      return;
    }
    router.push(backHref);
  }, [exitGuard, router, backHref]);

  // Desktop presentation: root keeps the EXACT original widening classes and
  // every intermediate wrapper is display:contents — layout bit-for-bit.
  return (
    <div
      className={
        active
          ? 'fixed inset-0 z-50 flex flex-col bg-slate-900 text-white'
          : 'w-[125%] -ml-[12.5%]'
      }
      style={
        active
          ? {
              paddingLeft: 'env(safe-area-inset-left, 0px)',
              paddingRight: 'env(safe-area-inset-right, 0px)',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
              height: '100dvh',
            }
          : undefined
      }
    >
      {/* Top strip — always mounted (mount stability), hidden in desktop. */}
      <div className={active ? 'flex h-14 shrink-0 items-center gap-2' : 'hidden'}>
        <button
          type="button"
          aria-label="Back to quote"
          onClick={handleBack}
          className="inline-flex h-12 min-w-12 items-center justify-center rounded-full border border-white/20 bg-white/10 px-3 text-xs font-semibold text-white hover:bg-white/20"
        >
          Back
        </button>
        <span className="min-w-0 truncate text-xs font-medium text-slate-300" title={planLabel}>
          {planLabel}
        </span>
        <nav aria-label="Takeoff steps" className="flex min-w-0 items-center gap-1 overflow-x-auto text-[11px]">
          {STEPS.map((s, i) => (
            <span key={s.value} className="flex items-center gap-1 whitespace-nowrap">
              {i > 0 && <span aria-hidden="true" className="text-slate-500">›</span>}
              <span
                className={
                  s.value === step
                    ? 'rounded-full bg-white px-2 py-1 font-semibold text-slate-900'
                    : 'text-slate-400'
                }
                aria-current={s.value === step ? 'step' : undefined}
              >
                {s.label}
              </span>
            </span>
          ))}
        </nav>
        <span className="flex-1" />
        {compactNotices.length > 0 && (
          <span
            aria-live="polite"
            title={compactNotices.join(' · ')}
            className="max-w-[30%] truncate rounded-full bg-amber-500/20 px-2.5 py-1 text-[11px] text-amber-300"
          >
            {compactNotices[0]}
          </span>
        )}
        <TouchButton label="Save takeoff" disabled>
          Save
        </TouchButton>
        <TouchButton label="Workspace menu" onClick={() => setMenuOpen((v) => !v)}>
          Menu
        </TouchButton>
      </div>

      {/* Mid row: canvas region + right rail. */}
      <div className={active ? 'flex min-h-0 flex-1 gap-2 p-2' : 'contents'}>
        {/* Canvas slot — stable mount position for the workstation. */}
        <div className={active ? 'relative min-w-0 flex-1 overflow-hidden rounded-xl bg-slate-950' : 'contents'}>
          {children}
          {active && overlay}
          {/* Portrait hint - dismissible, no CSS rotation (§3.2). z-40 keeps it
              visible above sheets/modals (owner test 2026-09-21). */}
          {active && showPortraitHint && (
            <div className="absolute inset-x-2 top-2 z-40 flex items-center gap-2 rounded-xl bg-slate-800/95 px-3 py-2 text-xs text-slate-200 shadow-lg">
              <span className="min-w-0 flex-1">
                Turn your phone sideways for more drawing space. You can continue in portrait.
              </span>
              <button
                type="button"
                aria-label="Dismiss turn-phone hint"
                onClick={() => setPortraitHintDismissed(true)}
                className="h-12 min-w-12 rounded-full border border-white/20 bg-white/10 px-3 text-xs font-semibold hover:bg-white/20"
              >
                OK
              </button>
            </div>
          )}
        </div>

        {/* Right rail — M3: point controller + view controls when the harness
            provides them; M2 view-only placeholders otherwise. */}
        <div
          className={active ? 'flex w-[120px] shrink-0 flex-col items-stretch gap-2 overflow-y-auto' : 'hidden'}
          aria-label="Point and view controls"
        >
          {active && rail ? (
            rail
          ) : (
            <>
              <div className="text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                View
              </div>
              <TouchButton label="Fit plan to view" disabled>
                Fit plan
              </TouchButton>
              <TouchButton label="Zoom in" disabled>
                Zoom in
              </TouchButton>
              <TouchButton label="Zoom out" disabled>
                Zoom out
              </TouchButton>
              <TouchButton label="Move plan" disabled>
                Move plan
              </TouchButton>
            </>
          )}
        </div>
      </div>

      {/* Bottom strip — context hint / draft status / undo-redo. */}
      <div className={active ? 'flex h-12 shrink-0 items-center gap-2 px-2 text-[11px] text-slate-400' : 'hidden'}>
        {active && bottom ? (
          bottom
        ) : (
          <>
            <span className="min-w-0 truncate">Tap to place a point. Drag elsewhere to adjust.</span>
            <span className="flex-1" />
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-slate-300">Draft</span>
            <TouchButton label="Undo" disabled>
              Undo
            </TouchButton>
            <TouchButton label="Redo" disabled>
              Redo
            </TouchButton>
          </>
        )}
      </div>

      {/* O16: dirty-draft Back guard — Save / Discard / Stay. */}
      {active && backGuardOpen && exitGuard?.dirty && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-4" role="dialog" aria-label="Unsaved outline edits">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setBackGuardOpen(false)} aria-hidden="true" />
          <div className="relative w-72 rounded-2xl border border-white/10 bg-slate-800 p-4 shadow-xl">
            <div className="mb-1 text-sm font-semibold text-white">Unsaved outline edits</div>
            <div className="mb-3 text-xs text-slate-300">
              Save them before leaving, or discard to restore the saved outline.
            </div>
            <div className="flex flex-col gap-1">
              <button
                type="button"
                className="h-12 rounded-full bg-[#FF6B35] px-4 text-xs font-semibold text-white"
                onClick={() => {
                  setBackGuardOpen(false);
                  exitGuard.onSave();
                }}
              >
                Save
              </button>
              <button
                type="button"
                className="h-12 rounded-full border border-white/20 bg-white/10 px-4 text-xs font-semibold text-white"
                onClick={() => {
                  setBackGuardOpen(false);
                  exitGuard.onDiscard();
                }}
              >
                Discard and leave
              </button>
              <button
                type="button"
                className="h-12 rounded-full px-4 text-xs font-semibold text-slate-300"
                onClick={() => setBackGuardOpen(false)}
              >
                Stay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* M7 (§3.1): desktop presentation keeps a discoverable way BACK to the
          touch workspace — without this an explicit Desktop choice on a phone
          had no in-UI return path (the shell strips that host the Menu are
          hidden in desktop presentation). Fixed-position so the desktop
          layout itself is unchanged. */}
      {!active && (
        <button
          type="button"
          aria-label="Switch to touch workspace"
          onClick={() => onViewPreferenceChange('mobile-touch')}
          className="fixed bottom-4 right-4 z-[9999] inline-flex h-12 items-center rounded-full border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 shadow-lg hover:bg-orange-50"
        >
          Mobile / touch view
        </button>
      )}

      {/* Menu sheet — workspace view control always reachable (§3.1). */}
      {active && menuOpen && (
        <div className="absolute inset-0 z-20 flex items-start justify-end p-2" role="dialog" aria-label="Workspace menu">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeMenu} aria-hidden="true" />
          <div className="relative mt-1 mr-1 w-56 rounded-2xl border border-white/10 bg-slate-800 p-3 shadow-xl">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Workspace view
            </div>
            <div role="radiogroup" aria-label="Workspace view" className="flex flex-col gap-1">
              {VIEW_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={viewPreference === option.value}
                  onClick={() => {
                    onViewPreferenceChange(option.value);
                    closeMenu();
                  }}
                  className={`flex h-12 items-center rounded-full px-4 text-left text-xs font-semibold ${
                    viewPreference === option.value
                      ? 'bg-white text-slate-900'
                      : 'text-slate-200 hover:bg-white/10'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="mt-2 border-t border-white/10 pt-2 text-[11px] text-slate-400">
              Saved on this device for takeoff only.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
