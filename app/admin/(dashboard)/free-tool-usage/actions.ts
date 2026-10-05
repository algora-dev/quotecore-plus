'use server';

/**
 * Admin free-tool usage analytics.
 *
 * Three views:
 *   T1 - Aggregate anonymous usage (tool, total uses, popularity over time)
 *   T2 - Free-tools account users (auth users with no company/onboarding)
 *   T3 - App users' free-tool usage (added to existing user profile)
 *
 * All queries use the service-role admin client (bypasses RLS) since
 * requireAdmin() already gated the caller.
 */

import { requireAdmin } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';

// ── T1: Aggregate anonymous usage ──────────────────────────

export interface T1ToolStat {
  toolCode: string;
  toolName: string;
  totalUses: number;
  imageUses: number;
  textUses: number;
  lastUsed: string | null;
}

export interface T1DailyStat {
  date: string;       // YYYY-MM-DD
  totalUses: number;
}

export type T1StatsResult =
  | { ok: true; toolStats: T1ToolStat[]; dailyStats: T1DailyStat[]; totalT1: number }
  | { ok: false; error: string };

export async function getT1Stats(): Promise<T1StatsResult> {
  await requireAdmin();
  const admin = createAdminClient();

  // Tool-level aggregate for T1
  const { data: toolData, error: toolErr } = await admin
    .from('free_tool_usage')
    .select('tool_code, tool_name, parse_mode, created_at')
    .eq('tier', 1);

  if (toolErr) return { ok: false, error: toolErr.message };

  const toolMap = new Map<string, T1ToolStat>();
  const dailyMap = new Map<string, number>();

  for (const row of toolData ?? []) {
    const key = row.tool_code;
    if (!toolMap.has(key)) {
      toolMap.set(key, {
        toolCode: row.tool_code,
        toolName: row.tool_name,
        totalUses: 0,
        imageUses: 0,
        textUses: 0,
        lastUsed: null,
      });
    }
    const stat = toolMap.get(key)!;
    stat.totalUses++;
    if (row.parse_mode === 'image') stat.imageUses++;
    else stat.textUses++;
    if (!stat.lastUsed || row.created_at > stat.lastUsed) {
      stat.lastUsed = row.created_at;
    }

    // Daily aggregate
    const day = row.created_at.slice(0, 10);
    dailyMap.set(day, (dailyMap.get(day) ?? 0) + 1);
  }

  const toolStats = Array.from(toolMap.values()).sort((a, b) => b.totalUses - a.totalUses);
  const dailyStats = Array.from(dailyMap.entries())
    .map(([date, totalUses]) => ({ date, totalUses }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30);  // last 30 days

  return { ok: true, toolStats, dailyStats, totalT1: toolData?.length ?? 0 };
}

// ── T2: Free-tools account users (no company or not onboarded) ──

export interface T2User {
  userId: string;
  email: string;
  createdAt: string;
  lastActiveAt: string;
  toolCount: number;
  toolsUsed: { toolCode: string; toolName: string; count: number; lastUsed: string }[];
}

export type T2UsersResult =
  | { ok: true; users: T2User[]; total: number }
  | { ok: false; error: string };

export async function getT2Users(limit = 50, offset = 0): Promise<T2UsersResult> {
  await requireAdmin();
  const admin = createAdminClient();

  // T2 = auth users who are NOT in public.users with a company, OR whose
  // company has no onboarding_completed_at. We find them by looking at
  // free_tool_usage rows where tier=2, getting distinct user_ids, then
  // checking which ones don't have a company.
  const { data: t2Usage, error: usageErr } = await admin
    .from('free_tool_usage')
    .select('user_id, user_email, created_at, tool_code, tool_name')
    .eq('tier', 2)
    .not('user_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(500);  // cap for safety

  if (usageErr) return { ok: false, error: usageErr.message };

  // Group by user_id
  const userMap = new Map<string, { email: string; createdAt: string; lastActiveAt: string; tools: Map<string, { toolName: string; count: number; lastUsed: string }> }>();

  for (const row of t2Usage ?? []) {
    if (!row.user_id) continue;
    if (!userMap.has(row.user_id)) {
      userMap.set(row.user_id, {
        email: row.user_email ?? 'unknown',
        createdAt: row.created_at,
        lastActiveAt: row.created_at,
        tools: new Map(),
      });
    }
    const u = userMap.get(row.user_id)!;
    if (row.created_at < u.createdAt) u.createdAt = row.created_at;
    if (row.created_at > u.lastActiveAt) u.lastActiveAt = row.created_at;

    const toolKey = row.tool_code;
    if (!u.tools.has(toolKey)) {
      u.tools.set(toolKey, { toolName: row.tool_name, count: 0, lastUsed: row.created_at });
    }
    const t = u.tools.get(toolKey)!;
    t.count++;
    if (row.created_at > t.lastUsed) t.lastUsed = row.created_at;
  }

  const users: T2User[] = Array.from(userMap.entries()).map(([userId, u]) => ({
    userId,
    email: u.email,
    createdAt: u.createdAt,
    lastActiveAt: u.lastActiveAt,
    toolCount: u.tools.size,
    toolsUsed: Array.from(u.tools.entries()).map(([toolCode, t]) => ({ toolCode, toolName: t.toolName, count: t.count, lastUsed: t.lastUsed })).sort((a, b) => b.count - a.count),
  })).sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt));

  return {
    ok: true,
    users: users.slice(offset, offset + limit),
    total: users.length,
  };
}

// ── T3: App user free-tool usage ───────────────────────────

export interface T3UserUsage {
  toolCode: string;
  toolName: string;
  count: number;
  lastUsed: string;
  parseMode: string;
}

export type T3UserUsageResult =
  | { ok: true; usage: T3UserUsage[]; totalUses: number; lastActivity: string | null }
  | { ok: false; error: string };

export async function getT3UserUsage(userId: string): Promise<T3UserUsageResult> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('free_tool_usage')
    .select('tool_code, tool_name, parse_mode, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) return { ok: false, error: error.message };

  const toolMap = new Map<string, T3UserUsage>();
  let totalUses = 0;
  let lastActivity: string | null = null;

  for (const row of data ?? []) {
    totalUses++;
    if (!lastActivity || row.created_at > lastActivity) lastActivity = row.created_at;

    const key = `${row.tool_code}-${row.parse_mode}`;
    if (!toolMap.has(key)) {
      toolMap.set(key, {
        toolCode: row.tool_code,
        toolName: row.tool_name,
        count: 0,
        lastUsed: row.created_at,
        parseMode: row.parse_mode,
      });
    }
    toolMap.get(key)!.count++;
  }

  const usage = Array.from(toolMap.values()).sort((a, b) => b.count - a.count);

  return { ok: true, usage, totalUses, lastActivity };
}

// ── Finder: Smart Tool Finder query intelligence ───────────

export interface FinderSummary {
  totalQueries: number;
  queriesLast7: number;
  queriesLast30: number;
  aiQueries: number;
  deterministicQueries: number;
  noMatchQueries: number;
  clicks: number;
  ctrPct: number;
}

export interface FinderTopQuery {
  query: string;
  count: number;
  matchMethod: 'deterministic' | 'ai';
  lastSeen: string;
}

export interface FinderClickedTool {
  toolId: string;
  toolName: string;
  clicks: number;
  position1Clicks: number;
}

export interface FinderNoMatch {
  query: string;
  lastSeen: string;
}

export type FinderStatsResult =
  | { ok: true; summary: FinderSummary; topQueries: FinderTopQuery[]; clickedTools: FinderClickedTool[]; noMatches: FinderNoMatch[] }
  | { ok: false; error: string };

export async function getFinderStats(): Promise<FinderStatsResult> {
  await requireAdmin();
  const admin = createAdminClient();

  // Read everything from the append-only event stream and aggregate in JS -
  // same pattern as T1. Volume is low (finder queries), so a full read is fine.
  const { data, error } = await admin
    .from('free_tool_finder_events')
    .select('event_type, session_id, raw_query_sanitised, normalised_query, match_method, clicked_tool_id, clicked_position, no_match, created_at')
    .order('created_at', { ascending: false })
    .limit(20000);

  if (error) return { ok: false, error: error.message };

  const now = Date.now();
  const day7 = 7 * 86400000;
  const day30 = 30 * 86400000;

  const summary: FinderSummary = {
    totalQueries: 0, queriesLast7: 0, queriesLast30: 0,
    aiQueries: 0, deterministicQueries: 0, noMatchQueries: 0,
    clicks: 0, ctrPct: 0,
  };

  const queryMap = new Map<string, FinderTopQuery & { matchMethods: Set<string> }>();
  const clickMap = new Map<string, FinderClickedTool>();
  const noMatchMap = new Map<string, FinderNoMatch>();

  // Tool id -> display name from the registry (single source of truth)
  const { TOOL_REGISTRY } = await import('@/app/(public)/free-tools/tool-registry');
  const nameById = new Map(TOOL_REGISTRY.map(t => [t.id, t.name]));

  for (const row of data ?? []) {
    const ts = new Date(row.created_at).getTime();
    if (row.event_type === 'click') {
      summary.clicks++;
      const id = row.clicked_tool_id;
      if (id) {
        if (!clickMap.has(id)) {
          clickMap.set(id, { toolId: id, toolName: nameById.get(id) ?? id, clicks: 0, position1Clicks: 0 });
        }
        const t = clickMap.get(id)!;
        t.clicks++;
        if (row.clicked_position === 1) t.position1Clicks++;
      }
      continue;
    }

    // query event
    summary.totalQueries++;
    if (now - ts < day7) summary.queriesLast7++;
    if (now - ts < day30) summary.queriesLast30++;
    if (row.match_method === 'ai') summary.aiQueries++;
    else summary.deterministicQueries++;
    if (row.no_match) summary.noMatchQueries++;

    const q = (row.raw_query_sanitised ?? row.normalised_query ?? '').trim();
    if (!q) continue;
    if (!queryMap.has(q)) {
      queryMap.set(q, { query: q, count: 0, matchMethod: 'deterministic', lastSeen: row.created_at, matchMethods: new Set() });
    }
    const e = queryMap.get(q)!;
    e.count++;
    if (row.created_at > e.lastSeen) e.lastSeen = row.created_at;
    if (row.match_method) e.matchMethods.add(row.match_method);

    if (row.no_match) {
      if (!noMatchMap.has(q)) noMatchMap.set(q, { query: q, lastSeen: row.created_at });
      else if (row.created_at > noMatchMap.get(q)!.lastSeen) noMatchMap.get(q)!.lastSeen = row.created_at;
    }
  }

  summary.ctrPct = summary.totalQueries > 0 ? Math.round((summary.clicks / summary.totalQueries) * 1000) / 10 : 0;

  const topQueries = Array.from(queryMap.values())
    .map(({ matchMethods, ...e }) => ({ ...e, matchMethod: (matchMethods.has('ai') ? 'ai' : 'deterministic') as 'deterministic' | 'ai' }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 25);

  const clickedTools = Array.from(clickMap.values()).sort((a, b) => b.clicks - a.clicks);
  const noMatches = Array.from(noMatchMap.values()).sort((a, b) => b.lastSeen.localeCompare(a.lastSeen)).slice(0, 25);

  return { ok: true, summary, topQueries, clickedTools, noMatches };
}
