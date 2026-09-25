import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Access, CardContent, EntityHit, RecordTarget } from '../v2/contracts';
import { ENTITY_SECTIONS, ENTITY_KINDS } from '../v2/contracts';
import type { AssistantSection } from '../section-permissions';
import { searchRecords, readRecord } from '../v2/entities.server';
import type { FastIntent, RecordRequest } from './intent';
import { compactHit, resolveRecords } from './records';
import { factsEnabled } from './config';
export type SpeedOperations = ReturnType<typeof createSpeedOperations>;
export function createSpeedOperations(input: {
  client: SupabaseClient; access: Access; runId: string;
  current: () => Promise<RecordTarget | null>;
  emit: (sections: AssistantSection[], content: CardContent) => Promise<string>;
}) {
  const { client, access } = input;
  const resolve = (request: RecordRequest) => resolveRecords(request, {
    permissions: access.permissions, current: input.current,
    search: (kind, query) => searchRecords(client, access, kind, query),
    read: target => readRecord(client, access, target),
  });
  const present = async (request: RecordRequest) => {
    const resolution = await resolve(request);
    const sections = resolution.records.map(hit => hit.section);
    for (const hit of resolution.records) if (hit.kind === 'customer') sections.push(hit.fields.source_status === 'draft' ? 'draft_quotes' : 'quotes');
    const cardId = resolution.records.length ? await input.emit(sections, {
      kind: 'records', title: resolution.state === 'selected' ? resolution.records[0].label : 'Matching records',
      options: resolution.records.map(({ kind, id, label, detail }) => ({ kind, id, label, detail })),
      autoOpen: resolution.autoOpen,
      note: request.selector === 'latest' || request.selector === 'list' ? 'Recency is by last update, not creation date. This is a bounded list, not an aggregate.' : null,
    }) : null;
    return { ...resolution, cardId };
  };
  const quoteTotal = async (request: RecordRequest) => {
    const resolution = await present(request);
    if (resolution.state !== 'selected') return { ...resolution, records: resolution.records.map(compactHit) };
    const hit = resolution.records[0];
    if (hit.kind !== 'quote' && hit.kind !== 'draft_quote') return { answer: 'Choose a quote or draft for a quote total.' };
    const { readQuoteTotals } = await import('./facts.server');
    const totals = await readQuoteTotals(client, access, input.runId, hit.id);
    return { ...totals, cardId: resolution.cardId, record: compactHit(hit), answer: `${hit.label}\n${totals.answer}` };
  };
  const capabilities = () => {
    const sections = ENTITY_KINDS.filter(kind => access.permissions[ENTITY_SECTIONS[kind]] !== 'hidden').map(kind => ENTITY_SECTIONS[kind].replaceAll('_', ' '));
    if (!sections.length) return 'All record sections are hidden in your assistant permissions. I can still answer general QuoteCore questions.';
    return `I can find, read and open your permitted ${sections.join(', ')}.${factsEnabled() && (access.permissions.quotes !== 'hidden' || access.permissions.draft_quotes !== 'hidden') ? ' I can also count permitted quotes/drafts and verify their available totals.' : ''}${access.phases.p2 ? ' Attention summaries are available.' : ''}${access.phases.p3 ? ' Supported changes require review and a Confirm button; not every domain has an edit operation yet.' : ' Editing is not switched on for this workspace yet.'}`;
  };
  return {
    resolve, present, quoteTotal, capabilities,
    async modelResolve(request: RecordRequest) {
      const result = await present(request);
      const records: EntityHit[] = result.state === 'selected' && request.presentation === 'read' && request.selector !== 'current'
        ? [await readRecord(client, access, result.records[0])]
        : result.records;
      return { ...result, records: records.map(compactHit), note: 'Use this result to answer now. A card is already prepared; do not call open_record again. Do not infer any totals or counts from this bounded result.' };
    },
    async fast(intent: FastIntent): Promise<string | null> {
      if (intent.type === 'records') return (await present(intent.request)).answer;
      if (intent.type === 'capabilities') return capabilities();
      if (!factsEnabled()) return null; // optional migration capability is independently gated
      if (intent.type === 'quote_total') return (await quoteTotal(intent.request)).answer;
      if (access.permissions[ENTITY_SECTIONS[intent.request.kind]] === 'hidden') return 'That section is hidden in your Smart Assistant permissions.';
      const { countRecords } = await import('./facts.server');
      return (await countRecords(client, access, input.runId, intent.request)).answer;
    },
  };
}
