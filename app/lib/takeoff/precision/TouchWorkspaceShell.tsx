'use client';
// Mobile takeoff M8: touch presentation shell — OWNER PRESCRIPTION 2026-09-21
// (refined 16:59: NO step-switching tab row).
//
// FULL-BLEED CANVAS: edge-to-edge, full height. No top strip and no bottom
// strip — the plan canvas gets every pixel that is not the control rail.
//
// Single RIGHT-SIDE RAIL (~160px ≈ 35–40% of a 568px phone landscape width,
// still operable at 568×320) showing ONLY the current step's controls: the
// flow itself drives which control set is rendered (calibration phase →
// calibration controls; advances to outline controls once calibration
// completes). A compact current-step label sits at the rail top next to a
// small Menu (⋯) button hosting the view-mode switch, Back (O16 dirty
// guard), plan label and compact required notices. Rail content scrolls
// internally and can never overflow the screen; safe-area insets are
// respected on the rail side.
//
// Everything else from M2–M7 is preserved: the immersive-workspace contract,
// the dismissible floating portrait hint (no CSS rotation, no orientation
// lock, §3.2), compact notices (L08).
//
// MOUNT-STABILITY CONTRACT (§3.4): the DOM skeleton (root → canvas slot →
// children) is ALWAYS mounted, including in desktop presentation, so
// switching Desktop ↔ Mobile/touch never remounts the workstation. In desktop
// presentation every wrapper is `display: contents` / `hidden` and the root
// carries the exact original `w-[125%] -ml-[12.5%]` widening classes — the
// desktop layout is bit-for-bit (extra contents-divs only, no layout effect).
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useImmersiveTakeoffAttribute } from './immersiveWorkspace';
import type { WorkspaceViewPreference } from './viewMode';
import {
  installTakeoffDiagnostics,
  logTakeoffEvent,
  sendTakeoffDiagnostics,
} from './takeoffDiagnostics';

export type TakeoffTool = 'calibrate' | 'outline';

interface TouchWorkspaceShellProps {
  /** True = touch presentation; false = desktop presentation (unchanged layout). */
  active: boolean;
  /** All takeoff chrome + the workstation as children (stable mount slot). */
  children: ReactNode;
  /** e.g. "Plan page 1". */
  planLabel: string;
  /** M8 (16:59 refinement): compact current-step label at the rail top — the
   *  flow, not a tab row, drives which control set is shown. */
  railTitle: string;
  /** Rail content for the CURRENT step (its own controls only). */
  railContent: ReactNode;
  /** View-mode control wiring (spec §3.1; always reachable via Menu). */
  viewPreference: WorkspaceViewPreference;
  onViewPreferenceChange: (preference: WorkspaceViewPreference) => void;
  /** Compact required-notice lines (entitlement/impersonation), §3.4/L08. */
  compactNotices?: readonly string[];
  /** M3: interaction-surface overlay mounted in the canvas slot (touch only). */
  overlay?: ReactNode;
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

/** 48×48 minimum touch target button (§3.3), design-system rounded-full.
 *  M9: press feedback (scale + brightness, CSS in globals.css scoped to the
 *  immersive attribute) and haptics (navigator.vibrate(10) where supported,
 *  silent no-op otherwise) are applied document-wide while the touch
 *  workspace is active — see the delegated listener in the shell — so every
 *  interactive control gets them, not only TouchButton. */
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
  railTitle,
  railContent,
  viewPreference,
  onViewPreferenceChange,
  compactNotices = [],
  overlay,
  backHref,
  exitGuard,
}: TouchWorkspaceShellProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [backGuardOpen, setBackGuardOpen] = useState(false);
  const [portraitHintDismissed, setPortraitHintDismissed] = useState(false);
  const [showPortraitHint, setShowPortraitHint] = useState(false);
  // M9: owner-run diagnostics — 'Send diagnostics' in the hamburger menu.
  const [diagState, setDiagState] = useState<
    { kind: 'idle' } | { kind: 'sending' } | { kind: 'sent'; id: string } | { kind: 'failed'; error: string }
  >({ kind: 'idle' });
  useImmersiveTakeoffAttribute(active);

  // M9: diagnostics capture hooks (window errors, unhandled rejections,
  // failed fetches) — installed once per page; intentionally never removed.
  useEffect(() => {
    if (!active) return;
    installTakeoffDiagnostics();
  }, [active]);

  // M9 TOUCH FEEL: haptic feedback for every enabled button in the touch
  // presentation via one delegated capture-phase listener — navigator.vibrate
  // is a no-op on platforms without support (iOS Safari), never throws.
  useEffect(() => {
    if (!active) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      const btn = target?.closest?.('button');
      if (btn instanceof HTMLButtonElement && !btn.disabled) {
        try {
          navigator.vibrate?.(10);
        } catch {
          /* no-op where unsupported */
        }
      }
    };
    document.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true });
    return () => document.removeEventListener('pointerdown', onPointerDown, { capture: true });
  }, [active]);

  const handleSendDiagnostics = useCallback(async () => {
    setDiagState({ kind: 'sending' });
    logTakeoffEvent('diagnostics.send.requested');
    const result = await sendTakeoffDiagnostics();
    setDiagState(result.ok ? { kind: 'sent', id: result.id } : { kind: 'failed', error: result.error });
  }, []);

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
    queueMicrotask(update);
    mq.addEventListener('change', update);
    return () => mq!.removeEventListener('change', update);
  }, [active, portraitHintDismissed]);

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
          ? 'fixed inset-0 z-50 flex flex-row bg-slate-900 text-white'
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
      {/* Canvas slot — FULL-BLEED (M8): every pixel left of the rail, full
          height. Stable mount position for the workstation. */}
      <div className={active ? 'relative min-w-0 flex-1 overflow-hidden bg-slate-950' : 'contents'}>
        {children}
        {active && overlay}
        {/* Portrait hint — dismissible, FLOATS over the canvas (M8), no CSS
            rotation (§3.2). z-40 keeps it visible above sheets/modals. */}
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
      </div>

      {/* M8 (16:59 refinement) FLOW-DRIVEN RAIL — no step-switching tabs.
          Compact current-step label + Menu (⋯); only the current step's
          controls; content scrolls internally so the rail can never overflow
          the screen. */}
      <div
        className={active ? 'flex w-40 shrink-0 flex-col border-l border-white/10 bg-slate-900' : 'hidden'}
        aria-label="Takeoff controls"
      >
        <div className="flex shrink-0 items-center gap-1 p-2">
          <span
            aria-live="polite"
            className="min-w-0 flex-1 truncate rounded-full bg-white/10 px-2.5 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-300"
          >
            {railTitle}
          </span>
          <button
            type="button"
            aria-label="Workspace menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className={`h-10 w-10 shrink-0 rounded-full transition-colors ${
              menuOpen ? 'bg-white text-slate-900' : 'border border-white/20 bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {/* M9 (owner prescription): standard hamburger menu icon. */}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {menuOpen ? (
            <div className="flex flex-col gap-2" aria-label="Workspace menu">
              <div className="truncate rounded-full bg-white/10 px-2.5 py-1 text-center text-[11px] font-medium text-slate-300" title={planLabel}>
                {planLabel}
              </div>
              {compactNotices.length > 0 && (
                <div
                  aria-live="polite"
                  className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-2.5 py-2 text-[11px] text-amber-200"
                >
                  {compactNotices.join(' · ')}
                </div>
              )}
              <div className="text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">
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
                      setMenuOpen(false);
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
              <div className="text-center text-[11px] text-slate-500">
                Saved on this device for takeoff only.
              </div>
              {/* M9: owner-run diagnostics — POST the recent-events buffer and
                  surface the stored reference id. */}
              <TouchButton
                label="Send diagnostics"
                disabled={diagState.kind === 'sending'}
                onClick={() => {
                  void handleSendDiagnostics();
                }}
              >
                {diagState.kind === 'sending' ? 'Sending…' : 'Send diagnostics'}
              </TouchButton>
              {diagState.kind === 'sent' && (
                <div role="status" className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-2.5 py-2 text-[11px] text-emerald-200">
                  Diagnostics sent — ref {diagState.id.slice(0, 8)}.
                </div>
              )}
              {diagState.kind === 'failed' && (
                <div role="alert" className="rounded-xl border border-red-400/40 bg-red-500/10 px-2.5 py-2 text-[11px] text-red-200">
                  {diagState.error}
                </div>
              )}
              <TouchButton label="Back to quote" onClick={handleBack}>
                Back
              </TouchButton>
            </div>
          ) : (
            railContent
          )}
        </div>
      </div>

      {/* M7 (§3.1): desktop presentation keeps a discoverable way BACK to the
          touch workspace — the rail that hosts the Menu is hidden in desktop
          presentation. Fixed-position so the desktop layout is unchanged. */}
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
    </div>
  );
}
