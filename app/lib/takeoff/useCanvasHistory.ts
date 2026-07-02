'use client';

import { useRef, useState, useCallback } from 'react';

/**
 * Canvas-rework: Reusable undo/redo hook for Fabric.js canvases.
 *
 * Snapshots BOTH the canvas JSON AND arbitrary React state together.
 * This is the key fix for the old FlashingCanvas history system that was
 * removed "because it caused issues with canvas state sync" — that system
 * only restored canvas JSON without同步-ing the React state, causing the
 * sidebar to show measurements that no longer existed on the canvas.
 *
 * Usage:
 *   const { canUndo, canRedo, pushSnapshot, undo, redo, clear } = useCanvasHistory(20);
 *
 *   // Before a mutation:
 *   pushSnapshot(canvas, { componentMeasurements, roofAreas, calibrations });
 *   // ... mutate canvas ...
 *
 *   // On undo:
 *   const snapshot = undo(canvas);
 *   if (snapshot) {
 *     canvas.loadFromJSON(snapshot.canvasJSON, () => {
 *       canvas.renderAll();
 *       // Restore React state from snapshot.reactState
 *       setComponentMeasurements(snapshot.reactState.componentMeasurements);
 *       // etc.
 *     });
 *   }
 */

export interface CanvasSnapshot {
  /** Serialised Fabric.js canvas (result of canvas.toJSON()). */
  canvasJSON: string;
  /** Arbitrary React state captured alongside the canvas. */
  reactState: Record<string, unknown>;
}

export interface UseCanvasHistoryReturn {
  canUndo: boolean;
  canRedo: boolean;
  /** Capture the current canvas + state before a mutation. */
  pushSnapshot: (
    canvas: { toJSON: () => Record<string, unknown> },
    reactState: Record<string, unknown>,
  ) => void;
  /** Pop the previous snapshot. Returns it so the caller can restore.
   *  Pushes the current state to the redo stack. */
  undo: (
    canvas: { toJSON: () => Record<string, unknown> },
    reactState: Record<string, unknown>,
  ) => CanvasSnapshot | null;
  /** Pop the next snapshot from redo. Returns it so the caller can restore.
   *  Pushes the current state to the undo stack. */
  redo: (
    canvas: { toJSON: () => Record<string, unknown> },
    reactState: Record<string, unknown>,
  ) => CanvasSnapshot | null;
  /** Clear both stacks (e.g. on page switch, save, or mode change). */
  clear: () => void;
  /** Current depth of the undo stack (for UI display). */
  undoDepth: number;
}

export function useCanvasHistory(maxDepth = 20): UseCanvasHistoryReturn {
  const undoStackRef = useRef<CanvasSnapshot[]>([]);
  const redoStackRef = useRef<CanvasSnapshot[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [undoDepth, setUndoDepth] = useState(0);

  const updateFlags = useCallback(() => {
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(redoStackRef.current.length > 0);
    setUndoDepth(undoStackRef.current.length);
  }, []);

  const pushSnapshot = useCallback(
    (
      canvas: { toJSON: () => Record<string, unknown> },
      reactState: Record<string, unknown>,
    ) => {
      const snapshot: CanvasSnapshot = {
        canvasJSON: JSON.stringify(canvas.toJSON()),
        reactState,
      };
      undoStackRef.current.push(snapshot);
      // Cap the stack depth.
      if (undoStackRef.current.length > maxDepth) {
        undoStackRef.current.shift();
      }
      // Clear redo on new mutation.
      redoStackRef.current = [];
      updateFlags();
    },
    [maxDepth, updateFlags],
  );

  const undo = useCallback(
    (
      canvas: { toJSON: () => Record<string, unknown> },
      reactState: Record<string, unknown>,
    ): CanvasSnapshot | null => {
      if (undoStackRef.current.length === 0) return null;

      // Push current state to redo.
      const currentSnapshot: CanvasSnapshot = {
        canvasJSON: JSON.stringify(canvas.toJSON()),
        reactState,
      };
      redoStackRef.current.push(currentSnapshot);

      const prev = undoStackRef.current.pop()!;
      updateFlags();
      return prev;
    },
    [updateFlags],
  );

  const redo = useCallback(
    (
      canvas: { toJSON: () => Record<string, unknown> },
      reactState: Record<string, unknown>,
    ): CanvasSnapshot | null => {
      if (redoStackRef.current.length === 0) return null;

      // Push current state to undo.
      const currentSnapshot: CanvasSnapshot = {
        canvasJSON: JSON.stringify(canvas.toJSON()),
        reactState,
      };
      undoStackRef.current.push(currentSnapshot);

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
