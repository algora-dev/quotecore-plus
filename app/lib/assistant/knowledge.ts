/**
 * AI Assistant - Knowledge Service (Phase 1)
 * ===========================================
 * Semantic retrieval over the doc_chunks index. This is the data source behind
 * the `search_help_docs` tool.
 *
 * Path: embed the query (OpenAI) -> call the SECURITY DEFINER `match_doc_chunks`
 * RPC via the SERVICE client (doc_chunks + RPC are REVOKEd from client roles,
 * so only a service-role caller reaches them). Returns bounded snippets only -
 * never the full raw doc set.
 */

import { createAdminClient } from '@/app/lib/supabase/admin';
import { getEmbedding } from './llmClient';
import { MODEL_CONFIG } from './config';

export interface DocSearchResult {
  slug: string;
  section: string;
  heading: string;
  snippet: string;
  similarity: number;
}

const MAX_K = 8;
const SNIPPET_MAX_CHARS = 700;

export interface SearchHelpDocsArgs {
  query: string;
  section?: string;
  k?: number;
}

/**
 * Semantic search over help docs. Returns up to `k` (default 5, capped {@link MAX_K})
 * chunks ordered by cosine similarity. Snippets are length-bounded so we never
 * dump whole docs into the model context.
 */
export async function searchHelpDocs(
  args: SearchHelpDocsArgs
): Promise<DocSearchResult[]> {
  const query = (args.query ?? '').trim();
  if (!query) return [];

  const k = Math.min(Math.max(1, args.k ?? 5), MAX_K);

  const embedding = await getEmbedding(query);
  if (embedding.length !== MODEL_CONFIG.embeddingDimensions) {
    throw new Error(
      `knowledge.searchHelpDocs: unexpected embedding dims ${embedding.length}`
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('match_doc_chunks', {
    query_embedding: embedding as unknown as string, // pgvector accepts number[] over the wire
    match_count: k,
    filter_section: args.section ?? undefined,
  });

  if (error) {
    throw new Error(`knowledge.searchHelpDocs RPC error: ${error.message}`);
  }

  const rows = (data ?? []) as Array<{
    slug: string;
    section: string;
    heading: string;
    content: string;
    similarity: number;
  }>;

  return rows.map((r) => ({
    slug: r.slug,
    section: r.section,
    heading: r.heading,
    snippet:
      r.content.length > SNIPPET_MAX_CHARS
        ? r.content.slice(0, SNIPPET_MAX_CHARS) + '…'
        : r.content,
    similarity: Number(r.similarity ?? 0),
  }));
}
