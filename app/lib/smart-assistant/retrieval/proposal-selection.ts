/** A selection prepares an existing P3 proposal; it never confirms or commits.
 * Dependencies make the relationship/race boundary executable in offline tests.
 */
import { isRecord } from '../section-permissions';
import { isUuid } from '../v2/contracts';
import type { RegisteredTool } from '../orchestrator';
import { selectedRow, type CompositeResult } from './relationships';
import { compositeSelectionSchema } from './tools.server';

export function withComponentSelection(input: {
  legacy: RegisteredTool;
  resolve: (selection: unknown, signal?: AbortSignal) => Promise<CompositeResult>;
  guard: () => Promise<void>;
  propose: (args: Record<string, unknown>, expectedParentId: string) => Promise<unknown>;
}): RegisteredTool {
  const parameters = input.legacy.schema.parameters;
  const properties = isRecord(parameters.properties) ? parameters.properties : {};
  return {
    ...input.legacy,
    retrievalPolicy: true,
    schema: { ...input.legacy.schema,
      description: input.legacy.schema.description + ' Prefer selection for a named/current draft + named component: resolves BOTH inside this operation. Supply exactly one of component_id or selection. Ambiguity returns choices and performs no proposal. Nothing is applied until the existing Confirm button.',
      parameters: { ...parameters, properties: { ...properties, selection: compositeSelectionSchema(['quotes.components']) }, required: ['changes','quantity_unit','rate_unit'] },
    },
    handler: async (args, context) => {
      const bad = (error: string) => ({ state: 'invalid_query', error, applied: false });
      if (Object.keys(args).some(k => !['component_id','selection','changes','quantity_unit','rate_unit'].includes(k)) || (args.component_id === undefined) === (args.selection === undefined)) return bad('Choose exactly one component_id or selection; unknown arguments are not ignored.');
      if (args.selection === undefined) return input.legacy.handler(args, context);
      if (!isRecord(args.selection) || args.selection.relationship !== 'quotes.components' || !isRecord(args.selection.child) || !Object.hasOwn(args.selection.child, 'text') && !Object.hasOwn(args.selection.child, 'id')) return bad('A component proposal requires quotes.components with an explicit child name or ID.');
      await input.guard();
      const result = await input.resolve(args.selection, context.signal);
      const row = selectedRow(result), relationship = result.relationship;
      if (!row || relationship?.verified !== true || relationship.name !== 'quotes.components' || relationship.childSource !== 'quote_components') return { ...result, applied: false, proposalPrepared: false };
      const componentId = row._row_id ?? row.id;
      if (!isUuid(componentId) || !isUuid(relationship.parentId)) return { state: 'read_failed', error: 'The selected relationship has no valid record identity. Nothing was proposed.', applied: false };
      if (context.signal?.aborted) throw Object.assign(new Error('The request timed out.'), { code: 'turn_timeout' });
      await input.guard();
      // Parent ID is an internal argument, never a model-authored proof. The P3
      // snapshot rechecks it immediately before preparing the reviewed diff.
      const { selection: _selection, ...rest } = args;
      return input.propose({ ...rest, component_id: componentId }, relationship.parentId);
    },
  };
}
