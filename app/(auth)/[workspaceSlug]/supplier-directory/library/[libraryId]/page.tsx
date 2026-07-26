import { getLibraryComponents, searchSupplierLibraries } from '../../actions';
import { LibraryDetail } from './LibraryDetail';

export default async function LibraryDetailPage(props: {
  params: Promise<{ workspaceSlug: string; libraryId: string }>;
}) {
  const { workspaceSlug, libraryId } = await props.params;

  // Verify the library exists and is published
  const libraries = await searchSupplierLibraries({ limit: 200 });
  const lib = libraries.find(l => l.id === libraryId);

  if (!lib) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-slate-400">Library not found or not published.</p>
          <a href={`/${workspaceSlug}/supplier-directory`} className="mt-2 inline-block text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8]">
            Back to Directory
          </a>
        </div>
      </div>
    );
  }

  const components = await getLibraryComponents(libraryId);

  return (
    <LibraryDetail
      workspaceSlug={workspaceSlug}
      library={lib}
      components={components}
    />
  );
}
