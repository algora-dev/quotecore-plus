// Serialise a touch action without manufacturing a timeout result. The caller
// receives the real acknowledgement or error. A settled failure may be retried.
export function createSingleFlight<Result>() {
  let pending: Promise<Result> | null = null;
  return {
    run(operation: () => Promise<Result>): Promise<Result> {
      if (pending) return pending;
      const task = Promise.resolve().then(operation);
      pending = task;
      const clear = () => { if (pending === task) pending = null; };
      void task.then(clear, clear);
      return task;
    },
    isPending: () => pending != null,
  };
}
