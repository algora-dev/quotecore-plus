import type { ComponentProps } from 'react';
import type { SmartComponentEditor, ComponentEditorInitial } from '../SmartComponentEditor';
import type { createComponentCollection } from '@/app/(auth)/[workspaceSlug]/components/actions';

// Projection of the existing editor contract, NOT a parallel component schema.
export type IdentityFields = Pick<ComponentEditorInitial, 'name' | 'sku'>;
export type IdentityLibrary = ComponentProps<typeof SmartComponentEditor>['collections'][number] & {
  visibility?: string | null;
};
export type CreateLibraryResult = Awaited<ReturnType<typeof createComponentCollection>>;
export type IdentityErrors = Partial<Record<'name' | 'sku' | 'library', string>>;

export const EXAMPLE_NAME = 'Valley Flashing 0.55g (Color Steel)';
export const LIBRARY_EXAMPLES = [
  { name: 'Roofing Long Run Materials', description: 'The materials you use for long-run roofing.' },
  { name: 'Roofing Shingles Materials', description: 'The materials you use for shingle roofing.' },
  { name: 'Roofing Custom Services and Products', description: 'Your specialist products and services.' },
] as const;

export function needsProductCode(isSupplier: boolean, libraries: readonly IdentityLibrary[], libraryId: string) {
  return isSupplier && libraries.some(library => library.id === libraryId && library.visibility === 'published');
}

// Step-specific feedback only. Canonical component validation still owns final save.
export function validateIdentity(fields: IdentityFields, libraryId: string, libraries: readonly IdentityLibrary[], skuRequired: boolean): IdentityErrors {
  const errors: IdentityErrors = {};
  if (!fields.name.trim()) errors.name = 'Give this item a name, such as Valley Flashing.';
  if (skuRequired && !fields.sku.trim()) errors.sku = 'Add a product code for this published supplier library.';
  if (libraryId && !libraries.some(library => library.id === libraryId)) errors.library = 'Choose an available library.';
  if (!libraryId || libraries.length === 0) errors.library = 'Choose an account library, or create one for this item.';
  return errors;
}

export function normaliseIdentity(fields: IdentityFields): IdentityFields {
  return { name: fields.name.trim(), sku: fields.sku.trim() };
}

export function validateLibraryName(name: string, libraries: readonly IdentityLibrary[]): string | undefined {
  const trimmed = name.trim();
  if (!trimmed) return 'Give your new library a name.';
  if (trimmed.length > 80) return 'Use 80 characters or fewer.';
  if (libraries.some(library => library.name.trim().toLocaleLowerCase() === trimmed.toLocaleLowerCase())) {
    return 'You already have a library with this name. Choose it from the list.';
  }
  return undefined;
}
