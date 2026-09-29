/** Diagnostics only: no transcript, tool arguments, record values or credentials. */
export type SpeedPath = 'resolver' | 'legacy' | 'model' | 'retrieval' | 'fast_records' | 'fast_count' | 'fast_total' | 'fast_capabilities';
/** Tool failures worth one DB query of diagnosis. Tool name + error class only;
 * never arguments, record text or user content. */
const TOOL_ERROR_STATES = new Set(['read_failed', 'too_broad', 'setup_required', 'feature_disabled', 'permission_denied']);
export class TurnTelemetry {
  private started = performance.now();
  private spans: { stage: string; ms: number }[] = [];
  path: SpeedPath = 'legacy';
  modelCalls = 0;
  toolCalls = 0;
  repeatedCalls = 0;
  terminalToolReplies = 0;
  retrievalPlanFailures = 0;
  retrievalRepairs = 0;
  repairBudgetStops = 0;
  firstTokenMs: number | null = null;
  toolErrors: string[] = [];
  constructor(readonly runId: string, readonly model: string) {}
  /** Compact sanitized `tool:class` markers (bounded, identifier-only). */
  recordToolError(tool: string, errorClass: string): void {
    const safeTool = tool.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 40);
    const safeClass = errorClass.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 40);
    if (!safeTool || !safeClass) return;
    const entry = `${safeTool}:${safeClass}`;
    if (this.toolErrors.length < 4 && !this.toolErrors.includes(entry)) this.toolErrors.push(entry);
  }
  recordToolResultState(tool: string, result: unknown): void {
    if (!result || typeof result !== 'object' || !('state' in result)) return;
    const state = String((result as { state: unknown }).state);
    if (TOOL_ERROR_STATES.has(state)) this.recordToolError(tool, state);
  }
  async measure<T>(stage: string, work: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try { return await work(); } finally {
      if (this.spans.length < 80) this.spans.push({ stage, ms: Math.round(performance.now() - start) });
    }
  }
  token(): void { if (this.firstTokenMs === null) this.firstTokenMs = Math.round(performance.now() - this.started); }
  snapshot(status: string, tokensIn = 0, tokensOut = 0) {
    return { event: 'sa_turn_performance', version: 1, runId: this.runId, model: this.model, path: this.path,
      status, pipelineMs: Math.round(performance.now() - this.started), modelCalls: this.modelCalls,
      toolCalls: this.toolCalls, retrievalPlanFailures: this.retrievalPlanFailures, retrievalRepairs: this.retrievalRepairs, repairBudgetStops: this.repairBudgetStops, repeatedCalls: this.repeatedCalls, terminalToolReplies: this.terminalToolReplies, firstModelTokenMs: this.firstTokenMs,
      toolErrors: this.toolErrors.slice(),
      tokensIn, tokensOut, stages: this.spans.slice() };
  }
}
