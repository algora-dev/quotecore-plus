/**
 * Distributed rate limiter, backed by the `public.consume_rate_limit` RPC.
 *
 * Earlier this module was an in-memory Map that reset on every Vercel cold
 * start (Gerald audit M-03). It now atomically increments a Postgres-backed
 * counter via SECURITY DEFINER RPC so the budget is shared across replicas
 * and survives cold starts.
 *
 * Public API stays the same shape, but `checkRateLimit` is now async. All
 * existing call sites are inside async server actions / async route handlers
 * so this is a safe, contained change.
 *
 * On RPC failure we **fail open** (return `true`) and log a warning, because
 * silently locking real users out is worse than a brief gap in rate-limit
 * coverage. If you have a high-sensitivity path that should fail closed,
 * pass `{ failClosed: true }` explicitly.
 */

import { createClient as createServiceClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let cachedClient: ReturnType<typeof createServiceClient> | null = null;

/**
 * One module-scoped admin client. We deliberately use service_role here
 * because the RPC is SECURITY DEFINER and bucket keys are opaque strings —
 * there's no user-data leakage surface to widen. Using an RLS-bound user
 * client would force every caller to wire one in; not worth it.
 */
function getClient() {
  if (cachedClient) return cachedClient;
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error(
      'rateLimit: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
    );
  }
  cachedClient = createServiceClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedClient;
}

export interface RateLimitOptions {
  /**
   * When `true`, treat RPC errors as "rate limited" (return false). Default
   * is fail-open (return true) so a transient DB blip doesn't lock real
   * users out of the recovery flow. Use this for high-value buckets where
   * lockouts are preferable to leaks.
   */
  failClosed?: boolean;
}

/**
 * Check if a request is within rate limits.
 *
 * @param key         Unique bucket identifier (e.g. `"recovery-lookup-ip:1.2.3.4"`).
 * @param maxAttempts Maximum hits allowed within the window.
 * @param windowMs    Window size in milliseconds.
 * @param opts        Optional behaviour flags.
 * @returns Promise resolving to true when allowed, false when rate-limited.
 */
export async function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number,
  opts: RateLimitOptions = {}
): Promise<boolean> {
  try {
    const supabase = getClient();
    // The Supabase generated DB types don't know about our new
    // `consume_rate_limit` RPC, so the `.rpc<T>(name, args)` overload
    // tightens `args` to `undefined`. Cast through `unknown` keeps the
    // call typed at the boundary without polluting the rest of the file.
    type RpcArgs = { p_key: string; p_max: number; p_window_ms: number };
    const { data, error } = await (
      supabase.rpc as unknown as (
        fn: 'consume_rate_limit',
        args: RpcArgs
      ) => Promise<{ data: unknown; error: { message: string } | null }>
    )('consume_rate_limit', {
      p_key: key,
      p_max: maxAttempts,
      p_window_ms: windowMs,
    });
    if (error) {
      console.warn('[rateLimit] RPC error:', error.message);
      return opts.failClosed ? false : true;
    }
    return data === true;
  } catch (err) {
    console.warn('[rateLimit] unexpected error:', err);
    return opts.failClosed ? false : true;
  }
}

/**
 * Extract client IP from request headers (works on Vercel + behind proxies).
 *
 * Trim the `x-forwarded-for` chain to the first hop because intermediate
 * proxies may append themselves; we want the originating client.
 */
export function getClientIP(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    'unknown'
  );
}
