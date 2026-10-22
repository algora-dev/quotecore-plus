import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getAdvice } from '@/app/(public)/free-tools/finder-advice';
import { recommendedMcpAction } from './routing-actions';

test('MCP routing reuses the Free Tools measure clarification', () => {
  const advice = getAdvice('I need to measure a roof');
  assert.equal(advice.kind, 'clarify');
  if (advice.kind !== 'clarify') return;
  assert.match(advice.message, /plan/i);
  assert.equal(advice.choices.length, 2);
  assert.match(advice.choices[0].query, /plan/i);
  assert.match(advice.choices[1].query, /already have/i);
});

test('Free Tools router distinguishes plan takeoff from existing measurements', () => {
  const plan = getAdvice('measure a roof from a plan image');
  assert.equal(plan.kind, 'match');
  if (plan.kind === 'match') assert.equal(plan.tools[0]?.id, 'free-roof-takeoff');

  const priced = getAdvice('I already have roof measurements and need pricing');
  assert.equal(priced.kind, 'match');
  if (priced.kind === 'match') assert.equal(priced.tools[0]?.id, 'measurement-to-quote-tool');
});

test('Free Tools router keeps the document generators distinct', () => {
  for (const [query, id] of [
    ['create a quote for my customer', 'free-quote-generator'],
    ['create an invoice for my customer', 'free-invoice-generator'],
    ['create a purchase order for my supplier', 'free-purchase-order-generator'],
  ] as const) {
    const advice = getAdvice(query);
    assert.equal(advice.kind, 'match');
    if (advice.kind === 'match') assert.equal(advice.tools[0]?.id, id);
  }
});


test('Free Tools router keeps specialist calculators in the Calculate lane', () => {
  for (const [query, id] of [
    ['calculate how much concrete I need for a slab', 'free-concrete-calculator'],
    ['work out roof pitch from rise and run', 'free-roof-pitch-calculator'],
    ['calculate my profit margin', 'free-margin-calculator'],
  ] as const) {
    const advice = getAdvice(query);
    assert.equal(advice.kind, 'match');
    if (advice.kind === 'match') assert.equal(advice.tools[0]?.id, id);
  }
});


test('website recommendations advertise the richer MCP-native continuation when one exists', () => {
  assert.deepEqual(recommendedMcpAction('free-roof-takeoff'), { name: 'start_roof_takeoff', requires: 'plan_attachment' });
  assert.deepEqual(recommendedMcpAction('free-cladding-takeoff'), { name: 'start_cladding_takeoff', requires: 'plan_attachment' });
  assert.deepEqual(recommendedMcpAction('free-flooring-takeoff'), { name: 'start_flooring_takeoff', requires: 'plan_attachment' });
  assert.deepEqual(recommendedMcpAction('measurement-to-quote-tool'), { name: 'start_measurements_to_pricing', requires: 'none' });
  assert.deepEqual(recommendedMcpAction('free-quote-generator'), { name: 'create_quote', requires: 'none' });
  assert.equal(recommendedMcpAction('free-concrete-calculator'), null);
});
