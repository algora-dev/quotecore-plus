import { loadComponentLibrary } from './actions';
import { ComponentList } from './component-list';

export default async function ComponentsPage() {
  const components = await loadComponentLibrary();

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            Component Library
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Master list of reusable components and extras for your templates and quotes.
          </p>
        </div>
      </div>
      <ComponentList initialComponents={components} />
    </div>
  );
}
