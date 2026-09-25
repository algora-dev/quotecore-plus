/** Server-only rollout switches. Never change the existing V2/company/quota gates. */
export function speedEnabled(): boolean {
  return process.env.SMART_ASSISTANT_SPEED_ENABLED === 'true';
}
export function factsEnabled(): boolean {
  return speedEnabled() && process.env.SMART_ASSISTANT_FACTS_ENABLED === 'true';
}
