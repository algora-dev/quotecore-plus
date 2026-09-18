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

  // Mobile three-destination bar (Assistant / Messages / Settings): keeps the
  // phone experience to the three surfaces that matter, per the V1.5 spec.
  const mobileNav = (
    <nav className="md:hidden sticky top-0 z-10 flex border-b border-slate-200 bg-white">
      <span className="flex flex-1 items-center justify-center gap-1.5 border-b-2 border-slate-900 py-2.5 text-xs font-semibold text-slate-900">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
        Assistant
      </span>
      <a
        href={`/${workspaceSlug}/inbox`}
        className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-slate-500 hover:text-slate-900"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
        Messages
      </a>
      <a
        href={`/${workspaceSlug}/account/smart-assistant`}
        className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-slate-500 hover:text-slate-900"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 008 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.6 1.65 1.65 0 0010 3.09V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9c.14.31.4.55.71.66H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>
        Settings
      </a>
    </nav>
  );

  return (
    <div className="md:space-y-4">
      {mobileNav}
      <ChatClient
      initialConversations={conversations}
      assistantName={config?.enabled === false ? 'Assistant (disabled)' : (config?.name ?? 'Assistant')}
      greeting={config?.greeting ?? ''}
      settingsHref={`/${workspaceSlug}/account/smart-assistant`}
    />
    </div>
  );
}
