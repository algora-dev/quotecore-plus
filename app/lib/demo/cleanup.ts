import 'server-only';
import { cleanupDemoAssistantArtifacts } from './integration.server';
import { createAdminClient } from '@/app/lib/supabase/admin';
/** Destructive work is restricted to an explicit demo session + demo company.
 * Safe to retry. Retain resource ledgers/counters across workspace resets. */
export async function cleanupDemoSession(sessionId: string): Promise<'deleted' | 'skipped' | 'failed'> {
  const db = createAdminClient(); const now = new Date().toISOString();
  const read = await db.from('demo_sessions').select('*').eq('id', sessionId).maybeSingle();
  if (read.error || !read.data) return 'failed';
  const row = read.data;
  if (row.status === 'deleted') return 'deleted';
  if (row.status === 'active' && row.expires_at && row.expires_at > now) return 'skipped';
  if (row.status === 'provisioning' && Date.parse(row.created_at) > Date.now() - 15 * 60_000) return 'skipped';
  const claim = await db.from('demo_sessions').update({ status: 'cleanup_pending', cleanup_started_at: now }).eq('id', sessionId);
  if (claim.error) return 'failed';
  try {
    if (row.company_id) {
      const co = await db.from('companies').select('plan_code').eq('id', row.company_id).maybeSingle();
      if (co.error || (co.data && co.data.plan_code !== 'demo')) throw new Error('Refused non-demo company');
      const active = await db.from('demo_sessions').select('id').eq('company_id', row.company_id)
        .eq('status', 'active').gt('expires_at', now).limit(1).maybeSingle();
      if (active.error || active.data) throw new Error('Company still in use');
      const running = await db.from('smart_assistant_runs').select('id').eq('company_id',row.company_id).in('status',['accepted','running']).gt('started_at',new Date(Date.now()-10*60_000).toISOString()).limit(1).maybeSingle();
      if (running.error || running.data) throw new Error('Assistant operation still in flight');
      await cleanupDemoAssistantArtifacts(row.company_id);
      // All deletes remain tenant scoped; do not delete another reset's user rows.
      for (const table of ['smart_assistant_runs', 'assistant_turn_reservations', 'assistant_usage_events', 'scheduled_messages', 'outbound_messages'] as const) {
        const result = await db.from(table).delete().eq('company_id', row.company_id);
        if (result.error) throw new Error(`delete ${table}: ${result.error.message}`);
      }
      const pending = await db.from('ai_scan_jobs').delete().eq('company_id', row.company_id);
      if (pending.error) throw new Error('Could not remove demo scan jobs');
      for (const bucket of ['QUOTE-DOCUMENTS', 'company-logos']) {
        const storage = db.storage.from(bucket); const queue = [row.company_id]; const visited = new Set<string>(); const files:string[]=[];
        while (queue.length) {
          const prefix=queue.shift()!; if(visited.has(prefix))continue; visited.add(prefix);
          if(visited.size>500)throw new Error('Storage traversal limit');
          // Enumerate before deleting, so pagination cannot skip shifted entries.
          for(let offset=0;;offset+=100){
            const list=await storage.list(prefix,{limit:100,offset}); if(list.error)throw new Error('Could not enumerate demo storage');
            for(const object of list.data??[]){const path=`${prefix}/${object.name}`;if(!path.startsWith(`${row.company_id}/`))throw new Error('Unsafe prefix');if(object.id)files.push(path);else queue.push(path);}
            if(files.length>5000)throw new Error('Storage cleanup size limit');if((list.data?.length??0)<100)break;
          }
        }
        for(let offset=0;offset<files.length;offset+=100){const removed=await storage.remove(files.slice(offset,offset+100));if(removed.error)throw new Error('Could not delete demo objects');}
      }
      const deleted = await db.from('companies').delete().eq('id', row.company_id).eq('plan_code', 'demo');
      if (deleted.error) throw new Error(`Company cleanup: ${deleted.error.message}`);
    }
    // Reset reuses the anonymous identity. Delete it only once no other current
    // workspace/provisioning session and no application profile remain.
    const other = await db.from('demo_sessions').select('id').eq('anon_user_id', row.anon_user_id)
      .neq('id', sessionId).in('status', ['active', 'provisioning']).limit(1).maybeSingle();
    const profile = await db.from('users').select('id').eq('id', row.anon_user_id).maybeSingle();
    if (other.error || profile.error) throw new Error('Could not verify identity cleanup');
    if (!other.data && !profile.data) {
      const auth = await db.auth.admin.getUserById(row.anon_user_id);
      if (auth.data.user && auth.data.user.is_anonymous !== true) throw new Error('Refused permanent auth user');
      if (auth.data.user) { const result = await db.auth.admin.deleteUser(row.anon_user_id); if (result.error) throw new Error('Auth cleanup failed'); }
      else if (auth.error && auth.error.status !== 404) throw new Error('Could not verify auth deletion');
    }
    const final = await db.from('demo_sessions').update({ status: 'deleted', company_id: null, tutorial_state: {},
      cleanup_finished_at: now, failure_context: null }).eq('id', sessionId);
    if (final.error) throw new Error('Could not finalize cleanup');
    return 'deleted';
  } catch (error) {
    console.warn('[demo/cleanup]', sessionId, error instanceof Error ? error.message : 'failed');
    await db.from('demo_sessions').update({ status: 'cleanup_failed', failure_context: { code: 'cleanup_retry_required' } }).eq('id', sessionId);
    return 'failed';
  }
}
