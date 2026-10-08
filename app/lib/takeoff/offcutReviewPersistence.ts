import { withTimeout } from './offcuts/reliability/timeout';
/**
 * Host adapter: connects the isolated Find Offcuts module's account review
 * repository to the app's authenticated Supabase browser client.
 *
 * The SQL (backend/supabase/migrations/20261001120000_offcut_reviews.sql) is
 * security-invoker with RLS + auth.uid() ownership; this adapter always uses
 * the logged-in browser session client and NEVER a service-role key.
 * Unrecognised RPC names are invisible to the generated Database types, so the
 * rpc call is cast to the module's minimal structural interface.
 */
import type { ReviewRpcClient } from '@/app/lib/takeoff/offcuts/persistence/browserReviewStore';
import type { ReviewRepository } from '@/app/lib/takeoff/offcuts/persistence/reviews';

const RPC_TIMEOUT_MS = 25_000;

let cached: ReviewRepository | null = null;

/** Creates the account review repository on first use; null when unavailable. */
export async function getAccountReviewRepository(): Promise<ReviewRepository | null> {
  if (cached) return cached;
  try {
    const { createClient } = await import('@/app/lib/supabase/client');
    const { createAccountReviewRepository } = await import('@/app/lib/takeoff/offcuts/persistence/browserReviewStore');
    const client = createClient();
    type Abortable = ReturnType<ReviewRpcClient['rpc']> & {abortSignal(signal:AbortSignal):ReturnType<ReviewRpcClient['rpc']>};
    const rpcLike = client.rpc.bind(client) as unknown as (name:string,args:Record<string,unknown>)=>Abortable;
    const rpc: ReviewRpcClient = {rpc:(name,args)=>{
      const abort=new AbortController();
      return withTimeout(rpcLike(name,args).abortSignal(abort.signal),RPC_TIMEOUT_MS,
        'The offcut draft store did not respond. Reload its saved revision or export before retrying.',()=>abort.abort());
    }};
    cached = createAccountReviewRepository(rpc);
    return cached;
  } catch {
    return null;
  }
}
