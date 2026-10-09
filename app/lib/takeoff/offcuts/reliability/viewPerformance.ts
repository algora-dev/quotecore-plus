/** Small, bounded UI telemetry. Never part of the solver input or quote math. */
export class ViewPerformance {
  private samples = new Map<string, { count: number; totalMs: number; maxMs: number; recentMs: number[] }>();
  private tasks: Array<{ startMs: number; durationMs: number }> = [];
  private lag: number[] = [];
  private observer: PerformanceObserver | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly started = performance.now();
  measure<T>(name: string, work: () => T): T {
    const at = performance.now(); try { return work(); } finally { this.record(name, performance.now() - at); }
  }
  record(name: string, durationMs: number): void {
    if (!Number.isFinite(durationMs) || durationMs < 0) return;
    const s = this.samples.get(name) ?? { count: 0, totalMs: 0, maxMs: 0, recentMs: [] };
    s.count++; s.totalMs += durationMs; s.maxMs = Math.max(s.maxMs, durationMs);
    s.recentMs.push(durationMs); if (s.recentMs.length > 60) s.recentMs.shift(); this.samples.set(name, s);
  }
  observe(): void {
    if (this.timer) return;
    try {
      this.observer = new PerformanceObserver(list => {
        for (const e of list.getEntries()) if (e.startTime >= this.started) this.tasks.push({ startMs: e.startTime - this.started, durationMs: e.duration });
        this.tasks = this.tasks.slice(-60);
      });
      this.observer.observe({ type: 'longtask', buffered: false });
    } catch { this.observer = null; }
    let last = performance.now();
    this.timer = setInterval(() => {
      const now = performance.now(), gap = Math.max(0, now - last - 250); last = now;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (gap > 50) { this.lag.push(gap); this.lag = this.lag.slice(-60); }
    }, 250);
  }
  snapshot() {
    return { model: 'bounded-ui-timings-v1', timings: Object.fromEntries([...this.samples].map(([name, s]) => [name, { ...s, recentMs: [...s.recentMs] }])),
      longTasks: this.tasks.map(x => ({ ...x })), eventLoopLagMs: [...this.lag],
      note: 'Browser UI timings, not worker search time. Recent observations are bounded; hidden-tab delay is excluded.' };
  }
  destroy(): void { if (this.timer) clearInterval(this.timer); this.timer = null; this.observer?.disconnect(); this.observer = null; }
}
