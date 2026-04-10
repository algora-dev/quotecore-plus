import { loadFlashingLibrary } from './actions';
import { FlashingList } from './flashing-list';

export const dynamic = 'force-dynamic';

export default async function FlashingsPage() {
  const flashings = await loadFlashingLibrary();

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Flashing Library</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage standard flashing designs for material order forms
        </p>
      </div>
      <FlashingList initialFlashings={flashings} />
    </div>
  );
}
