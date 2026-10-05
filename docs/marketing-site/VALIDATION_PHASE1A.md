# VALIDATION — Marketing V2 Phase 1A

## Environment

The supplied source archive did not include `node_modules`.

A dependency install was attempted in a fresh, untouched baseline copy using:

```sh
npm ci
```

The environment could not resolve packages from the npm registry and the npm log ended with repeated `EAI_AGAIN` fetch failures. The dependency installation did not complete. No dependency or lockfile changes are included in the return package.

Because the locked dependencies were unavailable, a valid baseline/post-change `npx tsc --noEmit` and `npm run build` could not be executed here. They remain mandatory integration checks.

## SEO source checker

Baseline command:

```sh
node scripts/seo-check.mjs
```

Result:

```text
✅ All checks passed. 66 warning(s).
```

Post-change command:

```sh
node scripts/seo-check.mjs
```

Result:

```text
✅ All checks passed. 66 warning(s).
```

The warning count is unchanged.

## Scope verification

Before return-documentation files were added, a byte comparison against a freshly extracted baseline found exactly these six changed source files:

```text
app/(marketing)/layout.tsx
app/(marketing)/pricing/page.tsx
app/(marketing)/roofing-estimating-software/page.tsx
app/(marketing)/roofing-quoting-software/page.tsx
app/(marketing)/roofing-takeoff-software/page.tsx
components/competitor-pages/competitor-page.tsx
```

No protected product/app file differed.

The root homepage `app/page.tsx` remained byte-identical. SHA-256 on both baseline and return working copy:

```text
de7c1796db3757fa94ae97d1243438a24fc00baf06c7b9df5fd3fbf04bed585f
```

## Targeted-string verification

The following stale phrases have no remaining occurrence in the six edited contexts:

```text
Plans from free to $59/month
plans from free
No card required. Cancel anytime.
```

This does not assert those phrases are absent from the entire repository; broader cleanup is intentionally outside Phase 1A.

## Line endings

All six changed source files and Phase 1A return-documentation files were verified to use LF line endings.
