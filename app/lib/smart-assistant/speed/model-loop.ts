import type { ChatTurnInput, ChatTurnResult, LlmMessage } from '@/app/lib/assistant/llmClient';
import type { RegisteredTool, ToolContext } from '../orchestrator';
import type { TurnTelemetry } from './telemetry';
import { executeToolBatch, stableArguments } from './tool-batch';
import { OrchestratorExecutionError } from './errors';

export async function runModelLoop(input: {
  messages: LlmMessage[]; registry: Record<string, RegisteredTool>; context: ToolContext;
  guard: () => Promise<void>; step: (input: ChatTurnInput) => Promise<ChatTurnResult>;
  signal: AbortSignal; speed: boolean; telemetry: TurnTelemetry;
}) {
  let tokensIn = 0, tokensOut = 0, totalToolCalls = 0;
  const seen = new Set<string>();
  let synthesisOnly = false;
  let repairRounds = 0;
  let directReadEligible = true;
  const repairable = (result: unknown) => !!result && typeof result === 'object' && 'state' in result
    && ['invalid_query','unsupported_source','unsupported_field'].includes(String(result.state));
  const { messages, registry, signal, telemetry } = input;
  const fail = (code: string): never => { throw new OrchestratorExecutionError(code, tokensIn, tokensOut); };
  const checkpoint = async () => {
    if (signal.aborted) fail('turn_timeout');
    try { await telemetry.measure('access', input.guard); } catch { fail('access_changed'); }
  };
  for (let hop = 0; hop < 5; hop++) {
    await checkpoint();
    let step: ChatTurnResult;
    try {
      telemetry.modelCalls++;
      step = await telemetry.measure('model', () => input.step({
        messages, tools: synthesisOnly ? [] : Object.values(registry).map(t => t.schema),
        onToken: () => telemetry.token(), signal,
      }));
    } catch (error) {
      if (signal.aborted || (error instanceof Error && ['AbortError','TimeoutError'].includes(error.name))) fail('turn_timeout');
      return fail('upstream_error');
    }
    tokensIn += step.tokensIn;
    tokensOut += step.tokensOut;
    if (!step.toolCalls.length) {
      if (!step.text.trim()) fail('empty_completion');
      await checkpoint(); // output is never released before fresh access verification
      return { content: step.text.trim(), tokensIn, tokensOut };
    }
    if (synthesisOnly) fail('repeated_tool_loop');
    totalToolCalls += step.toolCalls.length;
    if (totalToolCalls > 10) fail('tool_call_limit');
    if (hop === 4) fail('model_hop_limit');
    const ids = new Set(step.toolCalls.map(call => call.id));
    if (ids.size !== step.toolCalls.length || step.toolCalls.some(call => !call.id)) fail('invalid_tool_call');
    messages.push({ role: 'assistant', content: step.text, tool_calls: step.toolCalls });
    const results = await executeToolBatch(step.toolCalls,
      call => {
        if (!input.speed || !Object.hasOwn(registry, call.name)) return false;
        const tool = registry[call.name];
        if (tool.parallelSafe === true) return true;
        if (!tool.parallelSafeWhen) return false;
        try {
          const args: unknown = JSON.parse(call.arguments || '{}');
          return !!args && typeof args === 'object' && !Array.isArray(args) && tool.parallelSafeWhen(args as Record<string, unknown>);
        } catch { return false; }
      },
      async call => {
        if (signal.aborted) fail('turn_timeout');
        if (!Object.hasOwn(registry, call.name)) { synthesisOnly = true; return { error: 'This tool is not available. Answer using only verified results or say the operation is unavailable.' }; }
        let args: Record<string, unknown>;
        try {
          const value: unknown = JSON.parse(call.arguments || '{}');
          if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid');
          args = value as Record<string, unknown>;
        } catch { synthesisOnly = true; return { error: 'Invalid tool arguments. No operation was performed.' }; }
        const fingerprint = call.name + ':' + stableArguments(args);
        if (input.speed && seen.has(fingerprint)) {
          telemetry.repeatedCalls++;
          synthesisOnly = true;
          return { error: 'This identical request already ran in this turn. Do not execute it again. Answer from the verified result or explain the missing information.' };
        }
        seen.add(fingerprint);
        telemetry.toolCalls++;
        try {
          return await telemetry.measure('tool:' + call.name, () => registry[call.name].handler(args, input.context));
        } catch (error) {
          // A revoked/uncertain access context is terminal, not model-readable data.
          const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
          if (['access_changed','permissions_changed','unauthenticated'].includes(code)) fail('access_changed');
          if (code === 'turn_timeout') fail('turn_timeout');
          return { error: 'Tool execution failed. Do not guess the missing result or claim success.' };
        }
      }, input.speed ? 3 : 1);
    const failedPlan = results.some((result, index) => registry[step.toolCalls[index].name]?.retrievalPolicy && repairable(result));
    if (failedPlan) {
      repairRounds++;
      telemetry.retrievalPlanFailures++;
      if (repairRounds > 1) { synthesisOnly = true; telemetry.repairBudgetStops++; }
      else telemetry.retrievalRepairs++;
    }
    // Metadata and a rejected plan are not business results requiring synthesis.
    // Only trusted registered code can provide the actual terminal answer. A
    // successful earlier business read/proposal makes this a multi-step workflow.
    const eligibleAfterPlanning = hop === 0 || (directReadEligible && registry[step.toolCalls[0].name]?.retrievalPolicy === true);
    if (eligibleAfterPlanning && step.toolCalls.length === 1 && !synthesisOnly) {
      const tool = registry[step.toolCalls[0].name];
      const content = tool?.terminalReply?.(results[0]);
      if (typeof content === 'string' && content.trim()) {
        await checkpoint();
        telemetry.terminalToolReplies++;
        telemetry.path = 'retrieval';
        return { content: content.trim(), tokensIn, tokensOut };
      }
    }
    if (results.some((result, index) => {
      const tool = registry[step.toolCalls[index].name];
      return !(tool?.planningOnly || (tool?.retrievalPolicy && repairable(result)));
    })) directReadEligible = false;
    results.forEach((result, index) => messages.push({ role: 'tool', tool_call_id: step.toolCalls[index].id, content: JSON.stringify(result) ?? 'null' }));
    if (failedPlan) messages.push({ role: 'system', content: synthesisOnly
      ? 'The single retrieval-plan repair allowance is exhausted. No more tools are available. Explain the precise capability/query limitation using verified results; do not invent data, imply denied permission, or claim that an operation completed.'
      : 'Correct only the rejected part of this retrieval plan once. Preserve the user scope and qualifiers. This is the only repair allowance; do not broaden or invent new statuses.' });
  }
  return fail('model_hop_limit');
}
