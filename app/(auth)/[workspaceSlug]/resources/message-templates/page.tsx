import { requireCompanyContext } from '@/app/lib/supabase/server';
import { BackButton } from '@/app/components/BackButton';
import { loadEmailTemplates } from '../email-actions';
import { loadAttachments, loadAttachmentEntitlements } from '../../attachments/actions';
import { MessageTemplateLibrary } from './MessageTemplateLibrary';

export default async function MessageTemplatesPage({ params }: { params: Promise<{ workspaceSlug: string }> }) {
  const { workspaceSlug } = await params;
  await requireCompanyContext();
  const entitlements = await loadAttachmentEntitlements();
  const [templates, attachments] = await Promise.allSettled([loadEmailTemplates(), loadAttachments()]);
  return <>
    <BackButton href={`/${workspaceSlug}/resources`} label="Back to Resources" />
    <MessageTemplateLibrary workspaceSlug={workspaceSlug} templates={templates.status === 'fulfilled' ? templates.value : []}
      loadError={templates.status === 'rejected'} attachmentLoadError={attachments.status === 'rejected'}
      attachments={attachments.status === 'fulfilled' ? attachments.value : []} attachmentsEnabled={entitlements.attachmentsEnabled} />
  </>;
}
