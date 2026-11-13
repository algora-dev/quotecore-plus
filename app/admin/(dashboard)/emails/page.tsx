import { loadEmailOutreach } from './actions';
import { EmailsPanel } from './EmailsPanel';

export const dynamic = 'force-dynamic';

export default async function AdminEmailsPage() {
  const result = await loadEmailOutreach();
  return (
    <EmailsPanel
      template={result.ok ? result.template : null}
      previewHtml={result.ok ? result.previewHtml : ''}
      initialRecipients={result.ok ? result.recipients : []}
      initialError={result.ok ? null : result.error}
    />
  );
}
