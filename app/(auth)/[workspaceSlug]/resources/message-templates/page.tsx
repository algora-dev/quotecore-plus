import { ResourcesSection } from '../ResourcesSection';
import { BackButton } from '@/app/components/BackButton';

export default async function MessageTemplatesSectionPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  return (
    <section className="space-y-5">
      <BackButton />
      <ResourcesSection workspaceSlug={workspaceSlug} tab="email" />
    </section>
  );
}
