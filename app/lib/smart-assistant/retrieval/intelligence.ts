/** P1.7 is staged independently of the already-live P1.6 reader. */
export function intelligenceEnabled(): boolean {
  return process.env.SMART_ASSISTANT_RETRIEVAL_V17_ENABLED === 'true';
}
export function intelligenceAvailable(capabilities: { enabled: boolean; intelligenceVersion?: number }): boolean {
  return intelligenceEnabled() && capabilities.enabled && capabilities.intelligenceVersion === 1;
}
