/**
 * AI Assistant — LLM Client (Phase 1)
 * ====================================
 * Thin, swappable wrapper around the OpenAI SDK. Everything model-specific
 * lives here so the orchestrator never imports the SDK directly and the model
 * can be swapped via config without touching call sites.
 *
 * Exposes:
 *  - getEmbedding(text)         -> number[]   (knowledge retrieval)
 *  - runChatTurn({...})         -> streamed tokens + tool calls + usage
 *
 * The chat turn uses Chat Completions tool-calling (stable streaming + tool
 * surface). Model id comes from MODEL_CONFIG.chatModel.
 */

import OpenAI from 'openai';
import { MODEL_CONFIG, MODEL_LIMITS } from './config';

let cached: OpenAI | null = null;
function client(): OpenAI {
  if (cached) return cached;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('llmClient: OPENAI_API_KEY not set');
  cached = new OpenAI({ apiKey });
  return cached;
}

// ---------------------------------------------------------------------------
// Embeddings
// ---------------------------------------------------------------------------

export async function getEmbedding(text: string): Promise<number[]> {
  const res = await client().embeddings.create({
    model: MODEL_CONFIG.embeddingModel,
    input: text,
  });
  return res.data[0].embedding;
}

// ---------------------------------------------------------------------------
// Chat turn (streaming + tool calls)
// ---------------------------------------------------------------------------

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  /** For assistant messages that requested tools. */
  tool_calls?: LlmToolCall[];
  /** For tool messages: which call this answers. */
  tool_call_id?: string;
}

export interface LlmToolCall {
  id: string;
  name: string;
  /** Raw JSON string arguments as emitted by the model. */
  arguments: string;
}

export interface LlmToolSchema {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ChatTurnInput {
  messages: LlmMessage[];
  tools: LlmToolSchema[];
  /** Called for each streamed text delta. */
  onToken: (text: string) => void;
  signal?: AbortSignal;
}

export interface ChatTurnResult {
  /** Full assistant text for this step. */
  text: string;
  /** Tool calls the model requested (empty when it produced a final answer). */
  toolCalls: LlmToolCall[];
  /** Best-effort token usage for this step (in+out). */
  totalTokens: number;
}

/**
 * Run ONE model step: stream tokens, collect any tool calls + usage. The
 * orchestrator loops this (feeding tool results back) until no tool calls
 * remain or the depth guard trips.
 */
/**
 * Convert our internal LlmMessage shape into the OpenAI Chat Completions wire
 * format. Critically, assistant `tool_calls` must be nested under
 * `{ id, type:'function', function:{ name, arguments } }` — passing our flat
 * `{ id, name, arguments }` shape straight through (the old `as never`) made
 * OpenAI reject any follow-up request after a tool call with a 400, which the
 * route surfaced as the generic "Assistant error."
 */
function toOpenAiMessages(
  messages: LlmMessage[]
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  return messages.map((m) => {
    if (m.role === 'assistant' && m.tool_calls && m.tool_calls.length > 0) {
      return {
        role: 'assistant',
        content: m.content || null,
        tool_calls: m.tool_calls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.name, arguments: tc.arguments },
        })),
      };
    }
    if (m.role === 'tool') {
      return {
        role: 'tool',
        tool_call_id: m.tool_call_id ?? '',
        content: m.content,
      };
    }
    return { role: m.role, content: m.content } as
      OpenAI.Chat.Completions.ChatCompletionMessageParam;
  });
}

export async function runChatStep(input: ChatTurnInput): Promise<ChatTurnResult> {
  const stream = await client().chat.completions.create(
    {
      model: MODEL_CONFIG.chatModel,
      max_completion_tokens: MODEL_LIMITS.maxOutputTokens,
      messages: toOpenAiMessages(input.messages),
      tools: input.tools.map((t) => ({
        type: 'function' as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      })),
      stream: true,
      stream_options: { include_usage: true },
    },
    { signal: input.signal }
  );

  let text = '';
  let usage = 0;
  // Accumulate streamed tool-call fragments by index.
  const toolAcc = new Map<
    number,
    { id: string; name: string; args: string }
  >();

  for await (const chunk of stream) {
    const choice = chunk.choices?.[0];
    const delta = choice?.delta;
    if (delta?.content) {
      text += delta.content;
      input.onToken(delta.content);
    }
    if (delta?.tool_calls) {
      for (const tc of delta.tool_calls) {
        const idx = tc.index ?? 0;
        const cur = toolAcc.get(idx) ?? { id: '', name: '', args: '' };
        if (tc.id) cur.id = tc.id;
        if (tc.function?.name) cur.name = tc.function.name;
        if (tc.function?.arguments) cur.args += tc.function.arguments;
        toolAcc.set(idx, cur);
      }
    }
    if (chunk.usage) usage = chunk.usage.total_tokens ?? usage;
  }

  const toolCalls: LlmToolCall[] = [...toolAcc.values()]
    .filter((t) => t.name)
    .map((t) => ({ id: t.id, name: t.name, arguments: t.args || '{}' }));

  return { text, toolCalls, totalTokens: usage };
}
