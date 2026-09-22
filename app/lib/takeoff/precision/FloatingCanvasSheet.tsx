'use client';
// Mobile takeoff U2 (plan section 4): shared draggable canvas sheet.
//
// One presentation primitive for every form/guard floating over the plan
// (calibration distance entry, name/pitch, exit/replacement confirmations).
//
// CONTRACT (plan 4.1/4.2):
// - Only the labelled drag handle begins a drag; inputs, buttons and
//   scrollable content keep their normal behaviour. The initiating pointer is
//   captured; the sheet moves by client-space deltas (no jump under finger).
// - A drag changes SHEET POSITION ONLY: zero scene-camera or point-geometry
//   change (the sheet never dispatches into the canvas gesture machine).
// - Pointer up commits; cancel, capture loss and viewport resize end the drag
//   safely and re-clamp. A second contact never becomes a canvas pinch.
// - The complete sheet stays inside the canvas viewport rectangle (its
//   offsetParent = the canvas slot, which already excludes the rail); no
//   unrecoverable sliver, no disappearing sheet.
// - Non-drag alternative (W6): "Move panel" menu offers dock positions and
//   Reset. Keyboard: focus the handle and use arrow keys (16px steps), Home
//   resets. No autofocus (never unexpectedly opens the keyboard).
// - Dragging must not steal focus or reset input values; children own their
//   state and are never remounted by position changes.

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';

const SHEET_MARGIN = 8;
const KEYBOARD_STEP = 16;

export interface FloatingCanvasSheetProps {
  /** Accessible name for the sheet region (e.g. "Calibration"). */
  label: string;
  children: ReactNode;
  /**
   * Modal semantics (destructive confirmations): canvas editing is blocked by
   * a backdrop until resolved. Still draggable by handle. Default: nonmodal
   * (plan 4.2: a distance panel must not dim the plan it needs to read).
   */
  modal?: boolean;
  /** Extra controls in the header row (right of the Move-panel menu). */
  headerExtra?: ReactNode;
  /** Compact header (no drag row) for very short sheets. Default false. */
  compact?: boolean;
  /** Extra classes for the sheet surface (e.g. max-h). */
  className?: string;
  /** Use dialog semantics (guards/confirmations) instead of a region. */
  dialog?: boolean;
}

interface Offset {
  x: number;
  y: number;
}

const OFFSET_ZERO: Offset = { x: 0, y: 0 };

export function FloatingCanvasSheet({
  label,
  children,
  modal = false,
  headerExtra,
  compact = false,
  className = '',
  dialog = false,
}: FloatingCanvasSheetProps) {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const [offset, setOffset] = useState<Offset>(OFFSET_ZERO);
  const [menuOpen, setMenuOpen] = useState(false);
  const dragStateRef = useRef<{ pointerId: number; startClient: { x: number; y: number }; startOffset: Offset } | null>(null);

  // Bounds used for clamping: the sheet's offsetParent (canvas slot) rect
  // minus margins, in the sheet's own coordinate space. Null when unmeasured.
  const allowedRange = useCallback((): { minX: number; maxX: number; minY: number; maxY: number } | null => {
    const sheet = sheetRef.current;
    const parent = sheet?.offsetParent;
    if (!(sheet instanceof Element) || !(parent instanceof HTMLElement)) return null;
    const parentRect = parent.getBoundingClientRect();
    const sheetRect = sheet.getBoundingClientRect();
    const baseLeft = sheetRect.left - offset.x;
    const baseTop = sheetRect.top - offset.y;
    const minX = parentRect.left + SHEET_MARGIN - baseLeft;
    const maxX = parentRect.right - SHEET_MARGIN - sheetRect.width - baseLeft;
    const minY = parentRect.top + SHEET_MARGIN - baseTop;
    const maxY = parentRect.bottom - SHEET_MARGIN - sheetRect.height - baseTop;
    return { minX, maxX, minY, maxY };
  }, [offset]);

  const clamp = useCallback((candidate: Offset): Offset => {
    const range = allowedRange();
    if (!range) return candidate;
    const clampNum = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
    // Guard inverted ranges (sheet larger than the viewport): prefer keeping
    // the top/left reachable so the handle is never lost off-screen.
    return {
      x: range.maxX < range.minX ? range.minX : clampNum(candidate.x, range.minX, range.maxX),
      y: range.maxY < range.minY ? range.minY : clampNum(candidate.y, range.minY, range.maxY),
    };
  }, [allowedRange]);

  const endDrag = useCallback(() => {
    dragStateRef.current = null;
  }, []);

  // ── Handle drag: pointer capture + client-space deltas ───────────────────
  const onHandlePointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const target = e.currentTarget;
    try {
      target.setPointerCapture(e.pointerId);
    } catch {
      // Without capture we still track by pointerId; cancel ends safely.
    }
    dragStateRef.current = {
      pointerId: e.pointerId,
      startClient: { x: e.clientX, y: e.clientY },
      startOffset: offset,
    };
    setMenuOpen(false);
  }, [offset]);

  const onHandlePointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    setOffset(clamp({
      x: drag.startOffset.x + (e.clientX - drag.startClient.x),
      y: drag.startOffset.y + (e.clientY - drag.startClient.y),
    }));
  }, [clamp]);

  // ── Keyboard: arrow keys move, Home resets (W6 alternative) ──────────────
  const onHandleKeyDown = useCallback((e: ReactKeyboardEvent<HTMLDivElement>) => {
    let next: Offset | null = null;
    if (e.key === 'ArrowLeft') next = { x: offset.x - KEYBOARD_STEP, y: offset.y };
    else if (e.key === 'ArrowRight') next = { x: offset.x + KEYBOARD_STEP, y: offset.y };
    else if (e.key === 'ArrowUp') next = { x: offset.x, y: offset.y - KEYBOARD_STEP };
    else if (e.key === 'ArrowDown') next = { x: offset.x, y: offset.y + KEYBOARD_STEP };
    else if (e.key === 'Home') next = OFFSET_ZERO;
    if (!next) return;
    e.preventDefault();
    setOffset(clamp(next));
  }, [clamp, offset]);

  // ── Viewport/resize re-clamp: never an unrecoverable sliver ─────────────
  useEffect(() => {
    if (offset.x === 0 && offset.y === 0) return;
    const reclamp = () => setOffset((current) => clamp(current));
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    vv?.addEventListener('resize', reclamp);
    window.addEventListener('resize', reclamp);
    window.addEventListener('orientationchange', reclamp);
    return () => {
      vv?.removeEventListener('resize', reclamp);
      window.removeEventListener('resize', reclamp);
      window.removeEventListener('orientationchange', reclamp);
    };
  }, [clamp, offset.x, offset.y]);

  // ── Dock targets (Move panel menu, W6 non-drag alternative) ─────────────
  const dockTo = useCallback((side: 'bottom' | 'top' | 'left' | 'right') => {
    const sheet = sheetRef.current;
    const parent = sheet?.offsetParent;
    setMenuOpen(false);
    if (!(sheet instanceof Element) || !(parent instanceof HTMLElement)) return;
    const parentRect = parent.getBoundingClientRect();
    const sheetRect = sheet.getBoundingClientRect();
    const baseLeft = sheetRect.left - offset.x;
    const baseTop = sheetRect.top - offset.y;
    const target =
      side === 'bottom'
        ? { x: 0, y: parentRect.bottom - SHEET_MARGIN - sheetRect.height - baseTop }
        : side === 'top'
          ? { x: 0, y: parentRect.top + SHEET_MARGIN - baseTop }
          : side === 'left'
            ? { x: parentRect.left + SHEET_MARGIN - baseLeft, y: 0 }
            : { x: parentRect.right - SHEET_MARGIN - sheetRect.width - baseLeft, y: 0 };
    setOffset(clamp(target));
  }, [clamp, offset]);

  return (
    <div
      className={`absolute inset-x-2 bottom-2 z-20 w-auto max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-slate-900/95 shadow-xl ${className}`}
      role={dialog ? 'dialog' : 'region'}
      aria-label={label}
      aria-modal={modal || undefined}
      ref={sheetRef}
      style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
    >
      {!compact && (
        <div className="sticky top-0 z-10 flex items-center gap-1 rounded-t-2xl bg-slate-900/95 px-2 pt-2">
          <div
            role="toolbar"
            aria-label={`Move ${label} panel`}
            tabIndex={0}
            onPointerDown={onHandlePointerDown}
            onPointerMove={onHandlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onLostPointerCapture={endDrag}
            onKeyDown={onHandleKeyDown}
            className="flex h-12 min-w-12 flex-1 cursor-grab touch-none select-none items-center justify-center rounded-full text-slate-400 hover:text-slate-200"
          >
            {/* Grip: small visual, generous hit area (the whole toolbar). */}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true" className="h-5 w-5">
              <path d="M8 7h8M8 12h8M8 17h8" />
            </svg>
            <span className="sr-only">{`Drag to move ${label} panel. Arrow keys move it. Home resets.`}</span>
          </div>
          <button
            type="button"
            aria-label={`Move ${label} panel menu`}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="h-12 min-w-12 rounded-full border border-white/20 bg-white/10 text-xs font-semibold text-white hover:bg-white/20"
          >
            ⋮
          </button>
          {headerExtra}
          {menuOpen && (
            <div className="absolute right-2 top-full mt-1 flex flex-col gap-1 rounded-xl border border-white/10 bg-slate-800 p-2 shadow-xl" role="menu">
              <button type="button" role="menuitem" onClick={() => dockTo('top')} className="h-12 rounded-full px-4 text-left text-xs font-semibold text-white hover:bg-white/10">Dock top</button>
              <button type="button" role="menuitem" onClick={() => dockTo('bottom')} className="h-12 rounded-full px-4 text-left text-xs font-semibold text-white hover:bg-white/10">Dock bottom</button>
              <button type="button" role="menuitem" onClick={() => dockTo('left')} className="h-12 rounded-full px-4 text-left text-xs font-semibold text-white hover:bg-white/10">Dock left</button>
              <button type="button" role="menuitem" onClick={() => dockTo('right')} className="h-12 rounded-full px-4 text-left text-xs font-semibold text-white hover:bg-white/10">Dock right</button>
              <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); setOffset(clamp(OFFSET_ZERO)); }} className="h-12 rounded-full px-4 text-left text-xs font-semibold text-white hover:bg-white/10">Reset position</button>
            </div>
          )}
        </div>
      )}
      <div className={compact ? '' : 'p-3 pt-1'}>{children}</div>
      {modal && <div className="pointer-events-none absolute inset-0 -z-10 rounded-2xl bg-black/30" aria-hidden="true" />}
    </div>
  );
}
