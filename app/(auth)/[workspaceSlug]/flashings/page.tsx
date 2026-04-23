import { loadFlashingLibrary } from './actions';
import { FlashingList } from './flashing-list';
import { BackButton } from '@/app/components/BackButton';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ workspaceSlug: string }>;
}

export default async function FlashingsPage(props: Props) {
  const { workspaceSlug } = await props.params;
  const flashings = await loadFlashingLibrary();

  return (
    <section className="space-y-5">
      <BackButton />
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Flashings</h1>
        <p className="text-sm text-slate-500 mt-1">Manage flashing designs for material orders.</p>
      </div>
      <FlashingList initialFlashings={flashings} workspaceSlug={workspaceSlug} />
    </section>
  );
}
