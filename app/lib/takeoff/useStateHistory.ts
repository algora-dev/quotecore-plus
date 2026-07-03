'use client';

import { useRef, useState, useCallback } from 'react';

/**
 * State-only undo/redo hook. Stores plain serializable data snapshots —
 * no Fabric.js canvas JSON. The canvas is redrawn from React state after
 * every undo/redo via `redrawCanvasFromState()`.
 *
 * This fixes the issues that plagued the canvas-JSON approach:
 * - Stale closures in once-bound canvas listeners (undo jumped to start)
 * - Lost custom props (measurementId) during toJSON/loadFromJSON round-trip
 * - Async loadFromJSON races causing the image to flash/disappear
 * - Orphan markers persisting on canvas after undo
 */

export interface UseStateHistoryReturn<T> {
  canUndo: boolean;
  canRedo: boolean;
  /** Capture the current state before a mutation. */
  pushSnapshot: (state: T) => void;
  /** Pop the previous snapshot. Returns it. Pushes current to redo. */
  undo: (currentState: T) => T | null;
  /** Pop the next snapshot from redo. Returns it. Pushes current to undo. */
  redo: (currentState: T) => T | null;
  /** Clear both stacks. */
  clear: () => void;
  /** Current depth of the undo stack. */
  undoDepth: number;
}

export function useStateHistory<T>(maxDepth = 30): UseStateHistoryReturn<T> {
  const undoStackRef = useRef<T[]>([]);
  const redoStackRef = useRef<T[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [undoDepth, setUndoDepth] = useState(0);

  const updateFlags = useCallback(() => {
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(redoStackRef.current.length > 0);
    setUndoDepth(undoStackRef.current.length);
  }, []);

  const pushSnapshot = useCallback(
    (state: T) => {
      // Deep-clone via structuredClone (available in Node 17+ and modern browsers)
      const snapshot = typeof structuredClone === 'function'
        ? structuredClone(state)
        : JSON.parse(JSON.stringify(state));
      undoStackRef.current.push(snapshot);
      if (undoStackRef.current.length > maxDepth) {
        undoStackRef.current.shift();
      }
      redoStackRef.current = [];
      updateFlags();
    },
    [maxDepth, updateFlags],
  );

  const undo = useCallback(
    (currentState: T): T | null => {
      if (undoStackRef.current.length === 0) return null;
      const snapshot = typeof structuredClone === 'function'
        ? structuredClone(currentState)
        : JSON.parse(JSON.stringify(currentState));
      redoStackRef.current.push(snapshot);
      const prev = undoStackRef.current.pop()!;
      updateFlags();
      return prev;
    },
    [updateFlags],
  );

  const redo = useCallback(
    (currentState: T): T | null => {
      if (redoStackRef.current.length === 0) return null;
      const snapshot = typeof structuredClone === 'function'
        ? structuredClone(currentState)
        : JSON.parse(JSON.stringify(currentState));
      undoStackRef.current.push(snapshot);
      const next = redoStackRef.current.pop()!;
      updateFlags();
      return next;
    },
    [updateFlags],
  );

  const clear = useCallback(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    updateFlags();
  }, [updateFlags]);

  return { canUndo, canRedo, pushSnapshot, undo, redo, clear, undoDepth };
}
