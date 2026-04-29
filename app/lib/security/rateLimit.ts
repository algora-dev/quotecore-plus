/**
 * Simple in-memory rate limiter.
 * Note: Resets on Vercel cold starts. For production scale, use Upstash Redis.
 */

const store = new Map<string, { count: number; resetAt: number }>();

// Clean up expired entries periodically (prevent memory leak)
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of store) {
    if (now > record.resetAt) {
      store.delete(key);
    }
  }
}, 60_000); // Clean every 60 seconds

/**
 * Check if a request is within rate limits.
 * @param key - Unique identifier (e.g., IP address, user ID)
 * @param maxAttempts - Maximum attempts allowed in the window
 * @param windowMs - Time window in milliseconds
 * @returns true if allowed, false if rate limited
 */
export function checkRateLimit(key: string, maxAttempts: number, windowMs: number): boolean {
  const now = Date.now();
  const record = store.get(key);

  if (!record || now > record.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (record.count >= maxAttempts) {
    return false;
  }

  record.count++;
  return true;
}

/**
 * Extract client IP from request headers (works on Vercel).
 */
export function getClientIP(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    'unknown'
  );
}
