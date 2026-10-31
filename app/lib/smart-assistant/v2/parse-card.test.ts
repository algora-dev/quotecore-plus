import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCard } from './contracts';

/**
 * Regression (owner incident 2026-10-31): the draft-workflow basis question
 * stores literal option ids 'plan'/'actual' (see applyDraftChoice and
 * decodeDraftChoice), but parseCard validated every option id as a UUID.
 * The card failed parse, readSession failed closed, and the ENTIRE conversation
 * snapshot became unreadable - the user saw no reply, no card, nothing after
 * the turn that created the card. This is the exact card stored in the DB for
 * that incident (conversation ede5e805, card fd08271c).
 */
const incidentCard = {
  id: 'fd08271c-d4a6-469a-97f2-7a3f2d414f88',
  run_id: 'a57c3649-b482-49e4-95ea-f7c8bb41f103',
  created_at: '2026-10-31T18:39:12.662614+00:00',
  content: {
    kind: 'draft_workflow', title: 'Finish this draft',
    issues: ['What is the customer name?', 'What should this job be called?'],
    taskId: 'ede5e805-3854-4af6-915c-51f487be493e',
    stateId: '0e8257c8-aeb7-4dc9-914d-c74216fb949a',
    summary: [
      'Customer needed - Job name needed', 'Library: RS Roofing Standard Library',
      'Main roof: 182 m2, surface; pitch needed°', 'Hip: 5 m + 5 m + 5 m + 5 m (actual)',
      'Ridge: 2 m + 3.2 m (actual)', 'Barge: 2.3 m + 2.3 m (actual)',
      'Spouting / gutter: 52 m (actual)', 'Valley: 4 m + 4 m (actual)',
      'Roof covering / Main roof: 182 m2 (actual, follows area)',
    ],
    revision: 1,
    questions: [{
      key: 'basis', role: 'roof_area', label: 'Are these measurements plan or actual?',
      options: [
        { id: 'plan', label: 'Plan measurements', detail: 'Measured flat / from the drawing - pitch is applied' },
        { id: 'actual', label: 'Actual measurements', detail: 'Measured on the roof surface - pitch already included' },
      ],
    }],
    workflowState: 'needs_choices',
  },
};

test('incident card: basis plan/actual literal option ids must parse', () => {
  const card = parseCard(incidentCard);
  assert.ok(card, 'the incident card must parse');
  assert.equal(card.content.kind, 'draft_workflow');
  if (card.content.kind === 'draft_workflow') {
    assert.equal(card.content.questions.length, 1);
    assert.deepEqual(card.content.questions[0].options.map(o => o.id), ['plan', 'actual']);
  }
});

test('basis question rejects ids other than the plan/actual literals', () => {
  const bad = structuredClone(incidentCard);
  bad.content.questions[0].options[0].id = 'sideways';
  assert.equal(parseCard(bad), null);
  const uuidId = structuredClone(incidentCard);
  uuidId.content.questions[0].options[0].id = '0e8257c8-aeb7-4dc9-914d-c74216fb949a';
  assert.equal(parseCard(uuidId), null, 'basis options are literals only, never UUIDs');
});

test('product/collection questions still require UUID option ids', () => {
  const product = structuredClone(incidentCard);
  product.content.questions = [{
    key: 'concept:hip', role: 'hip', label: 'Hip',
    options: [{ id: '3b32620b-2a84-4fa1-b5cc-17a6ff968434', label: 'Hip product', detail: 'RS Roofing Standard Library' }],
  }];
  const ok = parseCard(product);
  assert.ok(ok && ok.content.kind === 'draft_workflow');
  const badProduct = structuredClone(product);
  badProduct.content.questions[0].options[0].id = 'plan';
  assert.equal(parseCard(badProduct), null, 'non-basis questions must keep UUID ids');
});
