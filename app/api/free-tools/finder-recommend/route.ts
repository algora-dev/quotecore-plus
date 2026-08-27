import { NextRequest, NextResponse } from 'next/server';
import { TOOL_REGISTRY, findTools, type FreeTool } from '@/app/(public)/free-tools/tool-registry';
import { checkRateLimit, getClientIP } from '@/app/lib/security/rateLimit';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Smart Tool Finder - AI fallback endpoint (Ron's free-tools hub).
 *
 * Called by the frontend only when the deterministic matcher is weak
 * (no matches / top score below threshold). The route NEVER trusts
 * client-claimed scores: it re-runs findTools() server-side and only
 * spends an OpenAI call when genuinely needed.
 *
 * Hard rules:
 * - the model may only return registry IDs; the server resolves IDs to
 *   real names/URLs from the single-source-of-truth registry
 * - unknown IDs are dropped silently
 * - on OpenAI failure/timeout the deterministic results are returned
 *   (matchMethod: 'deterministic') so the UX never breaks
 */

const SCORE_THRESHOLD = 8;
const MAX_RECOMMENDATIONS = 3;
const AI_TIMEOUT_MS = 9000;

/** Compact registry subset sent to the model - no URLs, no client-only data. */
const COMPACT_REGISTRY = TOOL_REGISTRY
  .filter(t => t.showInFinder !== false)
  .map(t => ({
    id: t.id,
    name: t.name,
    description: t.shortDescription,
    categories: t.categories,
    intents: t.intents,
    aliases: t.aliases ?? [],
  }));

interface AiRecommendation { toolId: string; reason: string }

function deterministicResponse(query: string) {
  const matches = findTools(query, MAX_RECOMMENDATIONS);
  return NextResponse.json({
    matchMethod: 'deterministic' as const,
    recommendations: matches.map(m => ({
      toolId: m.tool.id,
      reason: m.reason ?? '',
      name: m.tool.name,
      url: m.tool.url,
      shortDescription: m.tool.shortDescription,
    })),
  });
}

async function aiRecommendations(query: string): Promise<AiRecommendation[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const model = process.env.FINDER_AI_MODEL || 'gpt-4o-mini';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 300,
        messages: [
          {
            role: 'system',
            content: [
              'You recommend tools from a fixed registry for construction/roofing trade users.',
              'You may ONLY return tool IDs from the registry. Never invent IDs, URLs or tool names.',
              'Return at most 3 recommendations, best first, each with a one-sentence reason.',
              'If nothing in the registry genuinely fits the request, return an empty recommendations array - do not force a weak match.',
            ].join(' '),
          },
          {
            role: 'user',
            content: `Registry:\n${JSON.stringify(COMPACT_REGISTRY)}\n\nUser query: ${query}`,
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'tool_recommendations',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                recommendations: {
                  type: 'array',
                  maxItems: MAX_RECOMMENDATIONS,
                  items: {
                    type: 'object',
                    properties: {
                      toolId: { type: 'string' },
                      reason: { type: 'string' },
                    },
                    required: ['toolId', 'reason'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['recommendations'],
              additionalProperties: false,
            },
          },
        },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json() as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { recommendations?: AiRecommendation[] };
    if (!Array.isArray(parsed.recommendations)) return null;
    return parsed.recommendations;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(req: NextRequest) {
  let query = '';
  try {
    const body = await req.json() as { query?: unknown };
    if (typeof body.query === 'string') query = body.query.trim().slice(0, 300);
  } catch { /* fall through to validation */ }
  if (!query) {
    return NextResponse.json({ error: 'query required' }, { status: 400 });
  }

  const ip = getClientIP(req.headers);
  const allowed = await checkRateLimit(`ft-finder-rec:${ip}`, 10, 60 * 1000);
  if (!allowed) {
    return NextResponse.json({ error: 'rate limited' }, { status: 429 });
  }

  // Server-side truth first: a confident deterministic match never spends
  // an OpenAI call, regardless of what the client claimed.
  const matches = findTools(query, MAX_RECOMMENDATIONS);
  if (matches.length > 0 && matches[0].score >= SCORE_THRESHOLD) {
    return deterministicResponse(query);
  }

  const ai = await aiRecommendations(query);
  if (ai == null) {
    // OpenAI unavailable/failed/timed out - deterministic fallback
    return deterministicResponse(query);
  }

  // Resolve model IDs against the registry (single source of truth);
  // unknown IDs are dropped silently.
  const byId = new Map<string, FreeTool>(TOOL_REGISTRY.map(t => [t.id, t]));
  const recommendations = ai
    .filter(r => typeof r?.toolId === 'string' && typeof r?.reason === 'string')
    .map(r => ({ tool: byId.get(r.toolId), reason: String(r.reason).slice(0, 200) }))
    .filter((r): r is { tool: FreeTool; reason: string } => r.tool != null && r.tool.showInFinder !== false)
    .slice(0, MAX_RECOMMENDATIONS)
    .map(({ tool, reason }) => ({
      toolId: tool.id,
      reason,
      name: tool.name,
      url: tool.url,
      shortDescription: tool.shortDescription,
    }));

  return NextResponse.json({ matchMethod: 'ai', recommendations });
}
