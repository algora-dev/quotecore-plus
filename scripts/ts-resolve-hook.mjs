// Node loader hook: resolve extensionless relative imports (TS style) to .ts
// so offline tests can import production modules with node --experimental-strip-types.
// Usage: node --experimental-strip-types --import ./scripts/register-ts-resolver.mjs scripts/<test>.mts
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (specifier.startsWith('.') && !specifier.endsWith('.ts') && !specifier.endsWith('.js')) {
      return await nextResolve(specifier + '.ts', context);
    }
    throw err;
  }
}
