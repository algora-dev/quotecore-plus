# Package verification

Packaging checks performed after code/tests/documentation were finalised:

- Full source ZIP preserves the supplied `quotecore-plus/` top-level structure and every original file.
- Original source outside the assistant module, original migrations, package manifests, generated database types, model client/hotfix, turn route and admission/finish code were compared byte-for-byte; 1,422 locked/external files match (`LOCKED_FILES.json`).
- The optional Git patch was applied to a clean copy of the exact 26 September baseline, then every resulting file byte-compared to the return tree, including added files.
- The ZIP CRC/integrity test passed, its member names match the returned source tree, and every extracted member's SHA-256 matches that tree.
- `CHANGED_FILES.json` records added/modified/deleted statuses and content hashes; its own self-reference is excluded.
- A sibling `.zip.sha256` records the final archive hash.
- No incomplete dependency tree, `.git`, environment secrets or new build artifacts are packaged. Original user-supplied source/assets are retained.

Archive/patch integrity does **not** establish successful compilation, SQL execution, live security or measured model performance. Those are the outstanding integration gates documented in `VALIDATION.md`.
