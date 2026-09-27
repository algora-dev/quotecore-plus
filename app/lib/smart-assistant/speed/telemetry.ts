/** Diagnostics only: no transcript, tool arguments, record values or credentials. */
export type SpeedPath = 'resolver' | 'legacy' | 'model' | 'retrieval' | 'fast_records' | 'fast_count' | 'fast_total' | 'fast_capabilities';
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
  constructor(readonly runId: string, readonly model: string) {}
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
      tokensIn, tokensOut, stages: this.spans.slice() };
  }
}
