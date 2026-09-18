'use server';

import { revalidatePath } from 'next/cache';
import { requireCompanyContext, createSupabaseServerClient } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { getEmbedding } from '@/app/lib/assistant/llmClient';

export type ConfigActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

const MAX_TEXT_BYTES = 2 * 1024 * 1024; // 2 MiB
const MAX_CONTENT_CHARS = 360_000; // 400 chunks * 900 chars - reject, never truncate
const CHUNK_CHARS = 900;
const MAX_CHUNKS = 400;
const MAX_RULES = 20;
const MAX_RULE_LENGTH = 500;

/**
 * Hardened permission gate: only owner/admin may change shared assistant
 * config/knowledge, unless the owner has enabled members_can_manage.
 * Also refuses when the rollout flag is off (no privileged work for
 * hidden/disabled companies).
 */
async function requireAssistantManager(): Promise<
  { ok: true; companyId: string; userId: string } | { ok: false; error: string }
> {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const { data: flagOn } = await supabase.rpc('smart_assistant_enabled', {
    p_company_id: profile.company_id,
  });
  if (!flagOn) return { ok: false, error: 'Smart Assistant is not enabled for this workspace.' };

  const { data: user } = await supabase
    .from('users')
    .select('role')
    .eq('id', profile.id)
    .maybeSingle();
  const role = user?.role ?? 'member';
  if (role === 'owner' || role === 'admin') {
    return { ok: true, companyId: profile.company_id, userId: profile.id };
  }

  const { data: config } = await supabase
    .from('assistant_configs')
    .select('members_can_manage')
    .eq('company_id', profile.company_id)
    .maybeSingle();
  if (!config?.members_can_manage) {
    return { ok: false, error: 'Only the workspace owner or an admin can change assistant settings.' };
  }
  return { ok: true, companyId: profile.company_id, userId: profile.id };
}

// ---------------------------------------------------------------------------
// Config save (service-role write; manager gate enforced above)
// ---------------------------------------------------------------------------

export async function saveAssistantConfig(input: {
  name: string;
  greeting: string;
  customRules: string[];
  enabled: boolean;
  membersCanManage?: boolean;
}): Promise<ConfigActionResult> {
  const gate = await requireAssistantManager();
  if (!gate.ok) return gate;

  const supabase = await createSupabaseServerClient();
  const name = input.name.trim().slice(0, 60) || 'Assistant';
  const greeting = input.greeting.trim().slice(0, 500);
  const customRules = input.customRules
    .map((r) => r.trim())
    .filter(Boolean)
    .slice(0, MAX_RULES)
    .map((r) => r.slice(0, MAX_RULE_LENGTH));

  // members_can_manage is itself owner/admin-controlled: members who were
  // granted management cannot escalate others.
  let membersCanManage: boolean | undefined;
  if (typeof input.membersCanManage === 'boolean') {
    const { data: me } = await supabase.from('users').select('role').eq('id', gate.userId).maybeSingle();
    if (me?.role === 'owner' || me?.role === 'admin') {
      membersCanManage = input.membersCanManage;
    }
  }

  const admin = createAdminClient();
  const { error } = await admin.from('assistant_configs').upsert(
    {
      company_id: gate.companyId,
      name,
      greeting,
      custom_rules: customRules,
      enabled: input.enabled,
      ...(membersCanManage !== undefined ? { members_can_manage: membersCanManage } : {}),
      config_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'company_id' },
  );

  if (error) return { ok: false, error: error.message };
  revalidatePath('/account/smart-assistant', 'page');
  return { ok: true, message: 'Assistant settings saved.' };
}

// ---------------------------------------------------------------------------
// Knowledge upload + ingestion with atomic publish
// ---------------------------------------------------------------------------

function chunkText(text: string): string[] {
  const clean = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  const chunks: string[] = [];
  for (let i = 0; i < clean.length && chunks.length < MAX_CHUNKS; i += CHUNK_CHARS) {
    chunks.push(clean.slice(i, i + CHUNK_CHARS));
  }
  return chunks;
}

export async function uploadKnowledgeDoc(file: File): Promise<ConfigActionResult> {
  const gate = await requireAssistantManager();
  if (!gate.ok) return gate;

  if (!file || file.size === 0) return { ok: false, error: 'Empty file.' };
  if (file.size > MAX_TEXT_BYTES) return { ok: false, error: 'File exceeds the 2MB limit.' };
  const allowed = /\.(txt|md|csv|json)$/i;
  if (!allowed.test(file.name)) {
    return { ok: false, error: 'Only plain text, Markdown, CSV or JSON files are supported in this version.' };
  }

  const text = await file.text();
  if (!text.trim()) return { ok: false, error: 'File contains no readable text.' };
  // Explicit rejection: never partially index an oversized document.
  if (text.length > MAX_CONTENT_CHARS) {
    return {
      ok: false,
      error: `Document is ${text.length.toLocaleString()} characters; the maximum is ${MAX_CONTENT_CHARS.toLocaleString()}. Split the file and upload in parts.`,
    };
  }

  const admin = createAdminClient();

  await admin.storage.createBucket('assistant-knowledge', { public: false }).catch(() => {});

  const storagePath = `${gate.companyId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.name.slice(0, 80)}`;
  const { error: uploadError } = await admin.storage
    .from('assistant-knowledge')
    .upload(storagePath, file, { contentType: file.type || 'text/plain' });
  if (uploadError) return { ok: false, error: `Upload failed: ${uploadError.message}` };

  const { data: doc, error: docError } = await admin
    .from('assistant_knowledge_docs')
    .insert({
      company_id: gate.companyId,
      file_name: file.name.slice(0, 200),
      storage_path: storagePath,
      size_bytes: file.size,
      status: 'processing',
      created_by: gate.userId,
    })
    .select('id')
    .single();
  if (docError || !doc) return { ok: false, error: 'Could not create document record.' };

  try {
    const chunks = chunkText(text);
    const rows: {
      doc_id: string;
      company_id: string;
      chunk_index: number;
      content: string;
      token_count: number | null;
      embedding: string;
    }[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const embedding = await getEmbedding(chunks[i]);
      rows.push({
        doc_id: doc.id,
        company_id: gate.companyId,
        chunk_index: i,
        content: chunks[i],
        token_count: Math.ceil(chunks[i].length / 4),
        embedding: `[${embedding.join(',')}]`,
      });
    }
    const { error: chunkError } = await admin.from('assistant_knowledge_chunks').insert(rows);
    if (chunkError) throw new Error(chunkError.message);

    // CONDITIONAL publish: only flips processing -> ready. If the document
    // was withdrawn during ingestion, this affects no row.
    const { data: published, error: publishError } = await admin
      .from('assistant_knowledge_docs')
      .update({ status: 'ready', published_at: new Date().toISOString() })
      .eq('id', doc.id)
      .eq('company_id', gate.companyId)
      .eq('status', 'processing')
      .select('id');
    if (publishError) throw new Error(publishError.message);
    if (!published?.length) {
      // Withdrawn mid-flight: clean up the now-orphaned chunks.
      await admin.from('assistant_knowledge_chunks').delete().eq('doc_id', doc.id);
      return { ok: false, error: 'The document was withdrawn during processing and was not published.' };
    }
  } catch (err) {
    // failed only while still processing (never overwrites withdrawn).
    await admin
      .from('assistant_knowledge_docs')
      .update({ status: 'failed', error: err instanceof Error ? err.message : 'ingestion failed' })
      .eq('id', doc.id)
      .eq('status', 'processing');
    return { ok: false, error: 'Ingestion failed - the document was not published.' };
  }

  revalidatePath('/account/smart-assistant', 'page');
  return { ok: true, message: `"${file.name}" published and searchable.` };
}

export async function withdrawKnowledgeDoc(docId: string): Promise<ConfigActionResult> {
  const gate = await requireAssistantManager();
  if (!gate.ok) return gate;
  if (!/^[0-9a-f-]{36}$/i.test(docId)) return { ok: false, error: 'Invalid document id.' };

  const admin = createAdminClient();
  const { data: doc, error: findError } = await admin
    .from('assistant_knowledge_docs')
    .select('id, storage_path')
    .eq('id', docId)
    .eq('company_id', gate.companyId)
    .maybeSingle();
  if (findError || !doc) return { ok: false, error: 'Document not found.' };

  // Withdraw FIRST (searches stop immediately); unconditional on purpose:
  // it must beat any in-flight publish, and publish is conditional on
  // status='processing', so this can never be undone by a late upload.
  const { error: withdrawError } = await admin
    .from('assistant_knowledge_docs')
    .update({ status: 'withdrawn', withdrawn_at: new Date().toISOString() })
    .eq('id', docId)
    .eq('company_id', gate.companyId)
    .in('status', ['uploaded', 'processing', 'ready', 'failed']);
  if (withdrawError) return { ok: false, error: withdrawError.message };

  await admin.storage.from('assistant-knowledge').remove([doc.storage_path]).catch(() => {});

  revalidatePath('/account/smart-assistant', 'page');
  return { ok: true, message: 'Document withdrawn.' };
}
