# Baseline evidence, not production source

`source/` contains LF-normalized original contents of the 58 modified application files for AST comparison and review. `RETURN_NOTES-SMART-ASSISTANT-P17.md` preserves the previous root note's text with LF line endings. Exact original bytes for these files are retained in `ORIGINAL_CHANGED_FILES.zip`, whose internal paths match the original repository. The full original handoff ZIP remains the three-way merge ancestor.

Do not copy this baseline folder over production files. The current implementation is in the application's normal source paths, and FILE_CHANGES.json identifies their original and returned hashes.

## Non-compiling evidence files

Baseline inspection copies deliberately end in `.source.txt`; the unchanged tsconfig includes all `.ts` / `.tsx` files recursively. This prevents archived originals from becoming duplicate compilation inputs. The source-check tool reads those text copies explicitly, and the ZIP retains exact original bytes. No tsconfig exclusion or dependency change was needed.
