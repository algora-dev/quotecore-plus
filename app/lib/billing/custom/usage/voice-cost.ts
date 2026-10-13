/** Pure transcription-cost settlement helpers. No provider calls or credentials. */
export interface VoiceCostRates {
  inputMicroUsdPerMillionTokens: number;
  outputMicroUsdPerMillionTokens: number;
}

function positiveSafe(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;
}

export function voiceCostRatesFromEnv(env: Record<string, string | undefined>): VoiceCostRates | null {
  const input = Number(env.CUSTOM_VOICE_INPUT_MICROUSD_PER_MILLION_TOKENS ?? '');
  const output = Number(env.CUSTOM_VOICE_OUTPUT_MICROUSD_PER_MILLION_TOKENS ?? '');
  const i = positiveSafe(input);
  const o = positiveSafe(output);
  return i && o ? { inputMicroUsdPerMillionTokens: i, outputMicroUsdPerMillionTokens: o } : null;
}

/**
 * Returns provider cost rounded UP to the next whole micro-USD. Unknown or
 * malformed provider usage returns null so the caller can retain its reserved
 * ceiling conservatively instead of inventing a lower cost.
 */
export function voiceActualMicroUsd(usage: unknown, rates: VoiceCostRates | null): number | null {
  if (!rates || !usage || typeof usage !== 'object' || Array.isArray(usage)) return null;
  const u = usage as { type?: unknown; input_tokens?: unknown; output_tokens?: unknown };
  if (u.type !== 'tokens' || !Number.isSafeInteger(u.input_tokens) || !Number.isSafeInteger(u.output_tokens)
      || (u.input_tokens as number) < 0 || (u.output_tokens as number) < 0) return null;
  const numerator = BigInt(u.input_tokens as number) * BigInt(rates.inputMicroUsdPerMillionTokens)
    + BigInt(u.output_tokens as number) * BigInt(rates.outputMicroUsdPerMillionTokens);
  const microUsd = (numerator + BigInt(999999)) / BigInt(1000000);
  return microUsd <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(microUsd) : null;
}
