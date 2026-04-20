import { loadFlashingLibrary } from './actions';
import { FlashingList } from './flashing-list';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ workspaceSlug: string }>;
}

export default async function FlashingsPage(props: Props) {
  const { workspaceSlug } = await props.params;
  const flashings = await loadFlashingLibrary();

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">Flashing Library</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage standard flashing designs for material order forms
          </p>
        </div>
        
        {/* Back link to Components */}
        <Link
          href={`/${workspaceSlug}/components`}
          className="px-4 py-2 text-sm font-medium rounded-full transition text-slate-600 border-2 border-transparent pill-shimmer"
        >
          ← Components
        </Link>
      </div>
      <FlashingList initialFlashings={flashings} workspaceSlug={workspaceSlug} />
    </div>
  );
}
