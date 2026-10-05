import { NextResponse } from 'next/server';
import { requireAdmin } from '@/app/lib/supabase/server';
import { runChatStep } from '@/app/lib/assistant/llmClient';
import { MODEL_CONFIG } from '@/app/lib/assistant/config';

export const runtime = 'nodejs';

/**
 * Admin-only post-deploy canary. This deliberately sends a tiny request WITH a
 * function schema so provider-side reasoning/tool contract changes are caught
 * before an owner discovers them in Smart Assistant. It touches no company
 * data, creates no assistant run and cannot mutate QuoteCore.
 */
export async function POST() {
  try {
    await requireAdmin();
    const started = performance.now();
    const result = await runChatStep({
      messages: [
        { role: 'system', content: 'QuoteCore Smart Assistant provider health check. Do not use the tool. Reply with exactly OK.' },
        { role: 'user', content: 'health check' },
      ],
      tools: [{
        name: 'health_probe_noop',
        description: 'A no-op schema included only to validate the provider function-tool request contract. Do not call it.',
        parameters: { type: 'object', properties: { probe: { type: 'string', maxLength: 8 } }, additionalProperties: false },
      }],
      onToken: () => {},
    });
    const latencyMs = Math.round(performance.now() - started);
    const healthy = result.text.trim().toUpperCase() === 'OK' && result.toolCalls.length === 0;
    return NextResponse.json({
      ok: healthy,
      status: healthy ? 'healthy' : 'degraded',
      model: MODEL_CONFIG.chatModel,
      latencyMs,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      responseShape: result.toolCalls.length ? 'unexpected_tool_call' : result.text.trim() ? 'text' : 'empty',
    }, { status: healthy ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message.replace(/\s+/g, ' ').slice(0, 180) : 'Unknown provider failure';
    console.error('[smart-assistant:health-canary]', message);
    return NextResponse.json({ ok: false, status: 'unavailable', model: MODEL_CONFIG.chatModel, error: message }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
