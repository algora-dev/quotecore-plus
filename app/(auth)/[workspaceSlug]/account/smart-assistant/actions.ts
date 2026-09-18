'use server';

import { revalidatePath } from 'next/cache';
import { requireCompanyContext } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { getEmbedding } from '@/app/lib/assistant/llmClient';

export type ConfigActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

const MAX_TEXT_BYTES = 2 * 1024 * 1024; // 2MB
const MAX_RULES = 20;
const MAX_RULE_LENGTH = 500;
const CHUNK_CHARS = 900;
const MAX_CHUNKS = 400;

// ---------------------------------------------------------------------------
// Config save (assistant_configs writes are service-role only per RLS)
// ---------------------------------------------------------------------------

export async function saveAssistantConfig(input: {
  name: string;
  greeting: string;
  customRules: string[];
  enabled: boolean;
}): Promise<ConfigActionResult> {
  const profile = await requireCompanyContext();

  const name = input.name.trim().slice(0, 60) || 'Assistant';
  const greeting = input.greeting.trim().slice(0, 500);
  const customRules = input.customRules
    .map((r) => r.trim())
    .filter(Boolean)
    .slice(0, MAX_RULES)
    .map((r) => r.slice(0, MAX_RULE_LENGTH));

  const admin = createAdminClient();
  const { error } = await admin.from('assistant_configs').upsert(
    {
      company_id: profile.company_id,
      name,
      greeting,
      custom_rules: customRules,
      enabled: input.enabled,
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
  let i = 0;
  while (i < clean.length && chunks.length < MAX_CHUNKS) {
    chunks.push(clean.slice(i, i + CHUNK_CHARS));
    i += CHUNK_CHARS;
  }
  return chunks;
}

export async function uploadKnowledgeDoc(
  file: File,
): Promise<ConfigActionResult> {
  const profile = await requireCompanyContext();

  if (!file || file.size === 0) return { ok: false, error: 'Empty file.' };
  if (file.size > MAX_TEXT_BYTES) return { ok: false, error: 'File exceeds the 2MB limit.' };
  const allowed = /\.(txt|md|csv|json)$/i;
  if (!allowed.test(file.name)) {
    return { ok: false, error: 'Only plain text, Markdown, CSV or JSON files are supported in this version.' };
  }

  const text = await file.text();
  if (!text.trim()) return { ok: false, error: 'File contains no readable text.' };

  const admin = createAdminClient();

  // Storage bucket (idempotent)
  await admin.storage.createBucket('assistant-knowledge', { public: false }).catch(() => {});

  const storagePath = `${profile.company_id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.name.slice(0, 80)}`;
  const { error: uploadError } = await admin.storage
    .from('assistant-knowledge')
    .upload(storagePath, file, { contentType: file.type || 'text/plain' });
  if (uploadError) return { ok: false, error: `Upload failed: ${uploadError.message}` };

  // Doc row starts in 'processing'. Atomic publish: status only flips to
  // 'ready' after every chunk + embedding is committed.
  const { data: doc, error: docError } = await admin
    .from('assistant_knowledge_docs')
    .insert({
      company_id: profile.company_id,
      file_name: file.name.slice(0, 200),
      storage_path: storagePath,
      size_bytes: file.size,
      status: 'processing',
      created_by: profile.id,
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
      embedding: string; // pgvector wire format "[0.1,0.2,...]"
    }[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const embedding = await getEmbedding(chunks[i]);
      rows.push({
        doc_id: doc.id,
        company_id: profile.company_id,
        chunk_index: i,
        content: chunks[i],
        token_count: Math.ceil(chunks[i].length / 4),
        embedding: `[${embedding.join(',')}]`,
      });
    }
    const { error: chunkError } = await admin.from('assistant_knowledge_chunks').insert(rows);
    if (chunkError) throw new Error(chunkError.message);

    const { error: publishError } = await admin
      .from('assistant_knowledge_docs')
      .update({ status: 'ready', published_at: new Date().toISOString() })
      .eq('id', doc.id);
    if (publishError) throw new Error(publishError.message);
  } catch (err) {
    await admin
      .from('assistant_knowledge_docs')
      .update({ status: 'failed', error: err instanceof Error ? err.message : 'ingestion failed' })
      .eq('id', doc.id);
    return { ok: false, error: 'Ingestion failed - the document was not published.' };
  }

  revalidatePath('/account/smart-assistant', 'page');
  return { ok: true, message: `"${file.name}" published and searchable.` };
}

export async function withdrawKnowledgeDoc(docId: string): Promise<ConfigActionResult> {
  const profile = await requireCompanyContext();
  if (!/^[0-9a-f-]{36}$/i.test(docId)) return { ok: false, error: 'Invalid document id.' };

  const admin = createAdminClient();
  // Scoped to the company so a foreign id cannot be withdrawn.
  const { data: doc, error: findError } = await admin
    .from('assistant_knowledge_docs')
    .select('id, storage_path')
    .eq('id', docId)
    .eq('company_id', profile.company_id)
    .maybeSingle();
  if (findError || !doc) return { ok: false, error: 'Document not found.' };

  // Withdraw first (searches stop immediately), then clean storage.
  const { error: withdrawError } = await admin
    .from('assistant_knowledge_docs')
    .update({ status: 'withdrawn', withdrawn_at: new Date().toISOString() })
    .eq('id', docId);
  if (withdrawError) return { ok: false, error: withdrawError.message };

  await admin.storage.from('assistant-knowledge').remove([doc.storage_path]).catch(() => {});

  revalidatePath('/account/smart-assistant', 'page');
  return { ok: true, message: 'Document withdrawn.' };
}
