/** Terminal error preserves provider usage already incurred on earlier steps. */
export class OrchestratorExecutionError extends Error {
  constructor(readonly errorCode: string, readonly tokensIn: number, readonly tokensOut: number) {
    super(`assistant turn failed: ${errorCode}`);
  }
}
