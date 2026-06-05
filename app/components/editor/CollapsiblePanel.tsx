'use client';

// Shared collapsible editor side-panel primitive (2026-06-05).
//
// Goal: let every editor (line-by-line order, components/column order, customer
// quote, labor sheet) collapse its LEFT control panel to declutter the view and
// let the preview expand into the freed space — fully reversible, smooth, and
// WITHOUT touching any data / save / autosave / hydration logic.
//
// CRITICAL DESIGN CHOICE: collapse, do NOT unmount.
//   The panel children stay mounted at all times. We only animate the wrapper's
//   width -> 0 (+ fade/scale the content) and clip overflow. Conditionally
//   unmounting the panel would re-trigger the ref-guarded hydration effects we
//   stabilised across these editors and risk wiping in-progress edits. So this
//   primitive is purely a visual shell: the React subtree never leaves the DOM.
//
// Layout contract: the PARENT must be a flex row (`flex flex-row`) where the
// preview/right side is `flex-1 min-w-0`. This panel renders a fixed-basis box
// that shrinks to 0 on collapse; the sibling preview then auto-fills via flex.
// An ExpandTab is rendered (by the parent, using the exported component) on the
// preview side so it is never clipped by this panel's own overflow.

import type { ReactNode } from 'react';

interface CollapsiblePanelProps {
  /** When true, the panel is collapsed (width 0, content hidden). */
  collapsed: boolean;
  /** Expanded width (Tailwind class controls this via `widthClass`). */
  children: ReactNode;
  /**
   * Tailwind sizing class(es) applied when expanded, e.g. "lg:w-[400px]" (fixed)
   * or "lg:flex-1 lg:basis-1/2" (half a flex row). Must fully describe the
   * expanded width: for a FIXED width also pass the matching shrink behaviour
   * implicitly (fixed w- classes don't shrink under flex by default); for a
   * FLEX-basis panel pass flex-1/basis-*. Animates to 0 on collapse.
   */
  widthClass: string;
  /** Optional extra classes for the inner content box (padding handled by caller). */
  className?: string;
}

/**
 * The collapsible left panel. Keeps children mounted; animates width + opacity.
 */
export function CollapsiblePanel({
  collapsed,
  children,
  widthClass,
  className = '',
}: CollapsiblePanelProps) {
  return (
    <div
      // Outer animates width. min-w-0 + overflow-hidden lets the content be
      // clipped cleanly as the box closes. flex-shrink-0 so flex doesn't fight
      // the explicit width while expanded.
      className={[
        'transition-all duration-300 ease-in-out overflow-hidden',
        collapsed
          ? 'w-0 lg:w-0 lg:flex-none lg:basis-0 opacity-0 pointer-events-none'
          : `w-full ${widthClass} opacity-100`,
        className,
      ].join(' ')}
      aria-hidden={collapsed}
    >
      {/* Inner keeps a stable min-width while open so text doesn't reflow mid
          animation; the outer overflow-hidden clips it as width -> 0. */}
      <div className={collapsed ? 'pointer-events-none' : ''}>{children}</div>
    </div>
  );
}

interface CollapseButtonProps {
  collapsed: boolean;
  onToggle: () => void;
  /** Accessible label / tooltip. */
  label?: string;
  className?: string;
}

/**
 * Small inline collapse control to place in a panel header (the "«" button).
 * Hidden when collapsed (the ExpandTab takes over the expand affordance).
 */
export function CollapseButton({
  collapsed,
  onToggle,
  label = 'Collapse panel',
  className = '',
}: CollapseButtonProps) {
  if (collapsed) return null;
  return (
    <button
      type="button"
      onClick={onToggle}
      title={label}
      aria-label={label}
      className={[
        'hidden lg:inline-flex items-center justify-center rounded-lg border border-slate-200',
        'p-1.5 text-slate-400 hover:text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-colors',
        className,
      ].join(' ')}
    >
      {/* Chevrons-left (collapse to the left) */}
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
      </svg>
    </button>
  );
}

interface ExpandTabProps {
  /** Only renders when collapsed. */
  collapsed: boolean;
  onToggle: () => void;
  label?: string;
  className?: string;
}

/**
 * Vertical expand tab pinned to the left edge of the preview area. Rendered by
 * the PARENT on the preview side (not inside CollapsiblePanel) so it is never
 * clipped by the collapsing panel's overflow. Always clearly visible while the
 * panel is collapsed.
 */
export function ExpandTab({ collapsed, onToggle, label = 'Show panel', className = '' }: ExpandTabProps) {
  if (!collapsed) return null;
  return (
    // Top-aligned (self-start) and compact (fixed py height) so the tab sits
    // next to the TOP of the preview — not stretched down the full column. The
    // sticky offset keeps it in view if the preview is tall and the user
    // scrolls. flex-shrink-0 so it never gets squeezed by the flex row.
    <button
      type="button"
      onClick={onToggle}
      title={label}
      aria-label={label}
      className={[
        'hidden lg:flex flex-shrink-0 self-start lg:sticky lg:top-4',
        'flex-col items-center justify-start gap-2 pt-3 pb-3 w-7',
        'rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm',
        'hover:text-orange-600 hover:border-orange-300 hover:bg-orange-50 transition-colors',
        className,
      ].join(' ')}
    >
      {/* Chevrons-right (expand outward to the right) */}
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
      </svg>
      <span className="text-[10px] font-semibold uppercase tracking-wider [writing-mode:vertical-rl]">
        {label}
      </span>
    </button>
  );
}
