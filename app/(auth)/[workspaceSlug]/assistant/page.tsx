import { notFound } from 'next/navigation';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import { ChatClient } from './ChatClient';
import type { ConversationRow } from './actions';

export const dynamic = 'force-dynamic';

/**
 * Smart Assistant chat (dark launch). Flag-off companies get a 404.
 */
export default async function SmartAssistantChatPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const { data: flagOn } = await supabase.rpc('smart_assistant_enabled', {
    p_company_id: profile.company_id,
  });
  if (!flagOn) notFound();

  const [{ data: config }, { data: convos }] = await Promise.all([
    supabase
      .from('assistant_configs')
      .select('name, greeting, enabled')
      .eq('company_id', profile.company_id)
      .maybeSingle(),
    supabase
      .from('smart_assistant_conversations')
      .select('id, title, last_active_at')
      .order('last_active_at', { ascending: false })
      .limit(50),
  ]);

  const conversations: ConversationRow[] = (convos ?? []) as ConversationRow[];

  return (
    <ChatClient
      initialConversations={conversations}
      assistantName={config?.enabled === false ? 'Assistant (disabled)' : (config?.name ?? 'Assistant')}
      greeting={config?.greeting ?? ''}
      settingsHref={`/${workspaceSlug}/account/smart-assistant`}
    />
  );
}
