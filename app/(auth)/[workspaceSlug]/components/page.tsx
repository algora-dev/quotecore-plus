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
      <ComponentList initialComponents={components} workspaceSlug={workspaceSlug} />
    </div>
  );
}
