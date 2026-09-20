// 6.1 regression suite (calibration hardening audit 2026-09-20): the
// controller's session-start contract. initialCalibrationStartEvent maps each
// start mode to the correct reducer start event, and driving the reducer with
// that event produces the expected session mode - edit preloads the committed
// references as drafts, replace starts a draft-until-commit recalibration.
// Run: node --import tsx --test "app/lib/takeoff/calibration*.test.ts"
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  initialCalibrationStartEvent,
  type CalibrationStartMode,
} from '../../(auth)/[workspaceSlug]/quotes/[id]/takeoff/calibration/useCalibrationController';
import { calibrationSessionReducer, type CalibrationSessionState } from './calibrationSession';
import type { AcceptedReferenceDraft, CalibrationImageDescriptor } from './calibrationTypes';

const IMAGE: CalibrationImageDescriptor = {
  pageId: 'page-1',
  imageRevision: 'sha256-abc-on1',
  frameKey: 'client-page-1',
  sourceWidth: 2000,
  sourceHeight: 1000,
  sceneWidth: 2000,
  sceneHeight: 1000,
  sourceToScene: [1, 0, 0, 1, 0, 0],
  coordinateFrame: 'takeoff-scene-v1',
  geometryVersion: 1,
};

function accepted(id: string): AcceptedReferenceDraft {
  return {
    id,
    source: 'ai_confirmed',
    candidateId: null,
    referenceId: `phys-${id}`,
    candidateRevision: 1,
    sceneP1: { x: 100, y: 100 },
    sceneP2: { x: 1100, y: 100 },
    confirmedDistance: 10,
    confirmedUnit: 'm',
    originalLabelText: '10m',
    valueCorrected: false,
  };
}

function boot(mode: CalibrationStartMode): CalibrationSessionState {
  return calibrationSessionReducer({} as CalibrationSessionState, initialCalibrationStartEvent(mode, 'quote-1', IMAGE));
}

describe('6.1 controller start-mode contract', () => {
  test('default/new start mode dispatches START_NEW with an empty draft', () => {
    const event = initialCalibrationStartEvent({ kind: 'new' }, 'quote-1', IMAGE);
    assert.equal(event.type, 'START_NEW');
    const s = boot({ kind: 'new' });
    assert.equal(s.mode, 'new');
    assert.equal(s.phase, 'idle');
    assert.deepEqual(s.accepted, []);
  });

  test('replace start mode dispatches START_REPLACE: committed calibration stays outside the draft', () => {
    const event = initialCalibrationStartEvent({ kind: 'replace' }, 'quote-1', IMAGE);
    assert.equal(event.type, 'START_REPLACE');
    const s = boot({ kind: 'replace' });
    assert.equal(s.mode, 'replace');
    assert.deepEqual(s.accepted, [], 'draft starts empty; the committed set lives with the parent');
  });

  test('edit start mode dispatches START_EDIT with the committed references preloaded as drafts', () => {
    const initialAccepted = [accepted('ref-1'), accepted('ref-2')];
    const event = initialCalibrationStartEvent({ kind: 'edit', initialAccepted }, 'quote-1', IMAGE);
    assert.equal(event.type, 'START_EDIT');
    const s = boot({ kind: 'edit', initialAccepted });
    assert.equal(s.mode, 'edit');
    assert.equal(s.accepted.length, 2);
    assert.deepEqual(s.accepted.map((r) => r.id), ['ref-1', 'ref-2']);
    // Preloaded references are immediately valid for the draft effective scale.
    assert.equal(s.accepted.every((r) => r.candidateId == null || s.reviews[r.candidateId]?.decision !== 'needs_reconfirmation'), true);
  });

  test('edit start mode caps preloads at the shared 3-reference limit', () => {
    const initialAccepted = [accepted('r1'), accepted('r2'), accepted('r3'), accepted('r4')];
    const s = boot({ kind: 'edit', initialAccepted });
    assert.equal(s.accepted.length, 3);
  });

  test('the start event binds the client frame identity, not a fabricated revision', () => {
    const s = boot({ kind: 'new' });
    assert.equal(s.image.frameKey, IMAGE.frameKey);
    assert.equal(s.image.imageRevision, IMAGE.imageRevision);
  });
});
