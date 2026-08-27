/**
 * Tool Registry — single source of truth for the free-tools hub.
 *
 * Used by: Smart Tool Finder (deterministic matching), Browse All Tools
 * (search + filters), and the task accordions' link data.
 *
 * Base list derives from tools-data.ts (real routes only — never invent URLs).
 * Rich intent/alias data lives here for the finder.
 */

import { TOOLS, type ToolEntry } from './tools-data';

export interface FreeTool {
  id: string;
  name: string;
  url: string;
  shortDescription: string;
  categories: string[];
  intents: string[];
  keywords: string[];
  aliases?: string[];
  priority?: number;
  /** Visibility flags — registry is the single source of truth (default: true) */
  showInFinder?: boolean;
  showInDirectory?: boolean;
  showInSchema?: boolean;
}

/** Extra tools that exist as routes but aren't in tools-data TOOLS yet. */
const EXTRA_TOOLS: FreeTool[] = [
  {
    id: 'free-roof-takeoff',
    name: 'Free Roof Takeoff',
    url: '/free-roof-takeoff',
    shortDescription: 'Upload your own roof plan (PDF/image), calibrate the scale and measure roof areas and linear components directly on screen.',
    categories: ['roofing', 'takeoff', 'measurement'],
    intents: ['measure roof from plan', 'measure pdf', 'digital roof takeoff', 'measure a plan', 'measure from drawing'],
    keywords: ['roof', 'measure', 'plan', 'pdf', 'drawing', 'takeoff', 'area', 'ridge', 'valley', 'calibrate', 'upload', 'image'],
    aliases: ['roof measurement tool', 'plan measure', 'digital takeoff', 'measure my plan'],
    priority: 100,
  },
];

/** Finder/search enrichment for key tools (matched by slug). */
const RICH: Record<string, Partial<FreeTool>> = {
  'free-roofing-takeoff-builder': {
    intents: ['already have measurements', 'have measurements', 'enter measurements manually', 'manual takeoff', 'build takeoff from measurements'],
    aliases: ['takeoff builder', 'manual takeoff'],
    priority: 95,
    categories: ['roofing', 'takeoff', 'measurement'],
    // Hidden from the hub for now — route stays live and stays in schema
    showInFinder: false,
    showInDirectory: false,
  },
  'measurement-to-quote-tool': {
    intents: ['turn measurements into a price', 'price from measurements', 'measurement to quote'],
    aliases: ['measure to quote'],
    priority: 90,
    categories: ['takeoff', 'pricing', 'documents'],
  },
  'free-quote-generator': {
    intents: ['create a quote', 'make a quote', 'send a quote', 'price a job', 'quote for customer'],
    aliases: ['quote maker', 'quotation generator', 'estimate generator'],
    priority: 100,
    categories: ['documents', 'pricing'],
  },
  'free-invoice-generator': {
    intents: ['create an invoice', 'make an invoice', 'send an invoice', 'bill a customer'],
    aliases: ['invoice maker', 'billing tool'],
    priority: 100,
    categories: ['documents'],
  },
  'free-purchase-order-generator': {
    intents: ['create a purchase order', 'make a po', 'order materials', 'send a po to supplier'],
    aliases: ['po generator', 'purchase order maker'],
    priority: 100,
    categories: ['documents'],
  },
  'free-roof-pitch-calculator': {
    intents: ['work out roof pitch', 'calculate roof pitch', 'roof angle', 'pitch from rise and run'],
    priority: 90,
  },
  'free-roof-pricing-calculator': {
    intents: ['price a roof', 'roof cost', 'how much for a roof'],
    priority: 90,
    categories: ['pricing', 'roofing'],
  },
  'free-concrete-calculator': {
    intents: ['calculate concrete', 'how much concrete'],
    priority: 90,
  },
  'free-margin-calculator': {
    intents: ['calculate margin', 'margin vs markup', 'work out profit'],
    priority: 85,
    categories: ['pricing'],
  },
  'free-roofing-calculator': {
    intents: ['calculate roofing materials', 'roof material quantities'],
    priority: 85,
  },
  'free-smart-component-creator': {
    intents: ['build a priced component', 'create smart component', 'component with materials and waste'],
    priority: 70,
  },
};

function toFreeTool(t: ToolEntry): FreeTool {
  const base: FreeTool = {
    id: t.slug,
    name: t.name,
    url: `/${t.slug}`,
    shortDescription: t.description,
    categories: [t.industry.toLowerCase(), t.category === 'calculator' ? 'calculators' : t.category],
    intents: [],
    keywords: t.keywords,
    priority: t.isCore ? 50 : 10,
  };
  return { ...base, ...RICH[t.slug] };
}

export const TOOL_REGISTRY: FreeTool[] = [
  ...EXTRA_TOOLS,
  ...TOOLS.map(toFreeTool),
];

export const TOOL_COUNT = TOOL_REGISTRY.length;

export function getTool(id: string): FreeTool | undefined {
  return TOOL_REGISTRY.find((t) => t.id === id);
}

/* ── Deterministic matcher ─────────────────────────────────────────────── */

export interface MatchResult {
  tool: FreeTool;
  score: number;
  reason?: string;
}

export function normaliseQuery(q: string): string {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Score every tool against the query and return up to `limit` matches.
 * Scoring: intent phrase (8) > alias (5) > tool-name words (3) > keyword (2) > category (1).
 * Confidence threshold for a usable recommendation: score >= 4.
 */
export function findTools(rawQuery: string, limit = 3): MatchResult[] {
  const q = normaliseQuery(rawQuery);
  if (!q) return [];
  const words = q.split(' ');

  const scored = TOOL_REGISTRY
    .filter((t) => t.showInFinder !== false)
    .map((tool) => {
    let score = 0;

    for (const intent of tool.intents) {
      if (q.includes(intent)) score += 8;
      else if (intent.split(' ').some((w) => w.length > 4 && words.includes(w))) score += 2;
    }
    for (const alias of tool.aliases ?? []) {
      if (q.includes(alias)) score += 5;
    }

    const nameWords = normaliseQuery(tool.name).split(' ');
    for (const w of words) {
      if (w.length > 2 && nameWords.includes(w)) score += 3;
    }

    for (const k of tool.keywords) {
      if (q.includes(k)) score += 2;
      else if (words.includes(k)) score += 1;
    }

    for (const c of tool.categories) {
      if (words.includes(c) || words.includes(c.replace(/s$/, ''))) score += 1;
    }

    score += Math.min((tool.priority ?? 0) / 50, 2); // mild popularity boost

    return { tool, score } satisfies MatchResult;
    });

  return scored
    .filter((m) => m.score >= 4)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
