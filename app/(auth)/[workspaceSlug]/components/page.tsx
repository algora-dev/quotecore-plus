import { loadComponentLibrary } from './actions';
import { ComponentList } from './component-list';

export default async function ComponentsPage(props: {params: Promise<{workspaceSlug: string}>}) {
  const { workspaceSlug } = await props.params;
  let components;
  
  try {
    components = await loadComponentLibrary();
  } catch (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <h2 className="text-lg font-semibold text-red-900 mb-2">Unable to load components</h2>
        <p className="text-sm text-red-700">
          {error instanceof Error ? error.message : 'An unexpected error occurred'}
        </p>
      </div>
    );
  }

  return <ComponentList initialComponents={components} workspaceSlug={workspaceSlug} />;
}
