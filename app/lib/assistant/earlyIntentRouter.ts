/**
 * AI Assistant - Early Intent Router
 * ==================================
 * Provides deterministic, pre-written responses for common early-stage
 * user questions. Instead of letting the LLM improvise answers to
 * "where do I start?" or "what are Smart Components?", we classify the
 * intent and return a fixed, proven response.
 *
 * WHY: New users' first few interactions with Q determine trust. The LLM
 * sometimes pulls from docs and slightly misdirects or over-explains.
 * This router guarantees consistent, accurate, simple answers for the
 * most common early questions.
 *
 * HOW: A fast LLM classification call maps the user's message to one of
 * the defined intents (or "none"). If matched, the fixed response is
 * streamed back with zero orchestrator token cost. If no match, the
 * normal Q conversation flow runs.
 *
 * GATING: Only activates for "new" users — defined as account created
 * within the last 14 days AND fewer than 3 quotes created. This prevents
 * the router from intercepting questions from experienced users who
 * might ask "what is a Smart Component?" in a deeper context.
 */

import OpenAI from 'openai';
import { MODEL_CONFIG } from './config';

// ---------------------------------------------------------------------------
// Intent definitions + fixed responses
// ---------------------------------------------------------------------------

export type EarlyIntent =
  | 'getting_started'
  | 'learning_components'
  | 'creating_quotes'
  | 'navigation'
  | 'none';

interface IntentDef {
  id: EarlyIntent;
  label: string;
  description: string;
  examples: string[];
  response: string;
}

const INTENTS: IntentDef[] = [
  {
    id: 'getting_started',
    label: 'Getting Started',
    description:
      'User is new and wants to know where to begin, how to learn the app, or what to do first.',
    examples: [
      'Where do I start?',
      "I'm new, what should I do first?",
      'How do I learn QuoteCore+?',
      'Is there a tutorial?',
      'Where are the tutorials?',
      "I don't know where to start.",
      'Help me get started.',
      "I'm using QuoteCore+ for the first time.",
      'Show me the basics.',
      'What should I watch first?',
      'I just signed up, what now?',
      "What's this app for?",
    ],
    response:
      "Great question — the best place to start is the Tutorials section on the Resources page. Begin with **Smart Components**, then **Creating Your First Component**, followed by **Creating Your First Quote**. Those three will give you a solid foundation for how QuoteCore+ works. If you'd like, I can help you navigate there or answer any questions as you go.",
  },
  {
    id: 'learning_components',
    label: 'Learning Components',
    description:
      'User is asking about what Smart Components are, how components work, or how to create one.',
    examples: [
      'What are Smart Components?',
      'What is a Smart Component?',
      'Explain components.',
      'How do components work?',
      'Why do I need components?',
      "I don't understand components.",
      'How do I make a component?',
      'First component.',
      'Component tutorial.',
      'Teach me components.',
    ],
    response:
      "Smart Components are the building blocks of QuoteCore+ — they're reusable items (like materials or labour) that you create once and then drop into any quote. Start with the **Smart Components** tutorial on the Resources page. It explains the concept, why components are the foundation of everything here, and walks you through creating your first one. Once you've got that, the rest of the app becomes much easier to understand.",
  },
  {
    id: 'creating_quotes',
    label: 'Creating Quotes',
    description:
      'User wants to know how to create a quote, start a quote, or learn about quoting.',
    examples: [
      'How do I create a quote?',
      'Make a quote.',
      'Start a quote.',
      'New quote.',
      'How do quotes work?',
      'How do I quote a customer?',
      'First quote.',
      'Teach me quoting.',
    ],
    response:
      "Once you've got a few Smart Components set up, creating a quote is straightforward. Head to the **Quotes** page and click **New Quote**. You can build it line-by-line or pull in your existing components. There's a full walkthrough in the **Creating Your First Quote** tutorial on the Resources page — I'd recommend running through that first so you see the full flow. Want me to take you to the Quotes page to get started?",
  },
  {
    id: 'navigation',
    label: 'Navigation',
    description:
      'User is looking for where something is — Resources, tutorials, help section, guides.',
    examples: [
      'Where is Resources?',
      'Where are the tutorials?',
      "I can't find the tutorials.",
      'Where do I learn?',
      "Where's the help section?",
      'Where are the guides?',
      'Show me the tutorials.',
    ],
    response:
      "No problem — switch on **Guide Me** here in the chat (the toggle at the bottom) and I can show you exactly where to go by highlighting the next step on your screen. Or if you prefer, the Resources link is in the top navigation bar — click that and you'll see the Tutorials section right there.",
  },
];

// ---------------------------------------------------------------------------
// Newness check
// ---------------------------------------------------------------------------

export interface UserNewness {
  isNew: boolean;
  daysSinceSignup: number;
  quoteCount: number;
}

/**
 * Determine if a user qualifies as "new" for early-intent routing.
 * New = account created within 14 days AND fewer than 3 quotes.
 */
export async function checkUserNewness(
  userId: string,
  companyId: string
): Promise<UserNewness> {
  const { createAdminClient } = await import('@/app/lib/supabase/admin');
  const admin = createAdminClient();

  // Fetch user created_at
  const { data: userRow } = await admin
    .from('users')
    .select('created_at')
    .eq('id', userId)
    .maybeSingle();

  const createdAt = (userRow as { created_at?: string } | null)?.created_at;
  const daysSinceSignup = createdAt
    ? Math.floor(
        (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)
      )
    : 999;

  // Count quotes
  const { count: quoteCount } = await admin
    .from('quotes')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId);

  // TEMP TESTING: widened to 365 days / 50 quotes so Shaun can test with his existing account.
  // Revert to 14 / 3 after testing.
  const isNew = daysSinceSignup <= 365 && (quoteCount ?? 0) < 50;

  return { isNew, daysSinceSignup, quoteCount: quoteCount ?? 0 };
}

// ---------------------------------------------------------------------------
// Intent classification
// ---------------------------------------------------------------------------

/**
 * Classify the user's message into an early-stage intent using a fast,
 * cheap LLM call. Returns 'none' if no intent matches or if the message
 * is clearly not an early-stage question.
 */
export async function classifyEarlyIntent(
  userMessage: string
): Promise<EarlyIntent> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return 'none';

  const openai = new OpenAI({ apiKey });

  const intentDescriptions = INTENTS.filter((i) => i.id !== 'none')
    .map(
      (i) =>
        `- ${i.label}: ${i.description} Examples: ${i.examples.slice(0, 4).join(' | ')}`
    )
    .join('\n');

  const systemPrompt = `You are an intent classifier for QuoteCore+, a construction/roofing quoting app.
Classify the user's message into exactly ONE of these intents, or "none":

${intentDescriptions}

- none: anything that doesn't clearly match the above intents (e.g. questions about specific features, pricing, a specific quote they're working on, small talk, etc.)

Rules:
- If the message could match multiple intents, pick the MOST specific one.
- If the user is asking about a specific task they're stuck on (not a general "how do I start" question), return "none".
- Respond with ONLY the intent id (getting_started, learning_components, creating_quotes, navigation, or none). No other text.`;

  try {
    const response = await openai.chat.completions.create({
      model: MODEL_CONFIG.chatModel,
      max_completion_tokens: 20,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0,
    });

    const raw = response.choices[0]?.message?.content?.trim().toLowerCase() ?? '';
    const valid: EarlyIntent[] = [
      'getting_started',
      'learning_components',
      'creating_quotes',
      'navigation',
      'none',
    ];
    return valid.includes(raw as EarlyIntent) ? (raw as EarlyIntent) : 'none';
  } catch {
    return 'none';
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export interface EarlyIntentResult {
  matched: boolean;
  intent: EarlyIntent;
  response: string;
  tokensUsed: number;
}

/**
 * Check if a user message matches an early-stage intent and return a
 * fixed response if so. Returns null if no match (fall through to
 * normal orchestrator).
 */
export async function tryEarlyIntent(
  userMessage: string,
  newness: UserNewness
): Promise<EarlyIntentResult | null> {
  // Only route for new users
  if (!newness.isNew) return null;

  // Quick keyword pre-filter: if the message is very short or clearly
  // not a question, skip the classification call entirely.
  const trimmed = userMessage.trim();
  if (trimmed.length < 3) return null;

  const intent = await classifyEarlyIntent(userMessage);
  if (intent === 'none') return null;

  const def = INTENTS.find((i) => i.id === intent);
  if (!def) return null;

  return {
    matched: true,
    intent,
    response: def.response,
    tokensUsed: 0, // classification tokens are negligible; tracked separately
  };
}
