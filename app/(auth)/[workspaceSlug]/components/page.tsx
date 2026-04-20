import { loadComponentLibrary } from './actions';
import { ComponentList } from './component-list';
import Link from 'next/link';

export default async function ComponentsPage(props: {params: Promise<{workspaceSlug: string}>}) {
  const { workspaceSlug } = await props.params;
  let components;
  
  try {
    components = await loadComponentLibrary();
  } catch (error) {
    console.error('Failed to load component library:', error);
    
    return (
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-900 mb-2">Unable to load components</h2>
          <p className="text-sm text-red-700 mb-4">
            {error instanceof Error ? error.message : 'An unexpected error occurred'}
          </p>
          <p className="text-sm text-red-600">
            If this problem persists, please contact support with this error message.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            Component Library
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Master list of reusable components and extras for your templates and quotes.
          </p>
        </div>
        
        {/* Tab/Link to Flashings */}
        <Link
          href={`/${workspaceSlug}/flashings`}
          className="px-4 py-2 text-sm font-medium rounded-full transition text-slate-600 border-2 border-transparent pill-shimmer"
        >
          Flashings →
        </Link>
      </div>
      <ComponentList initialComponents={components} />
    </div>
  );
}
