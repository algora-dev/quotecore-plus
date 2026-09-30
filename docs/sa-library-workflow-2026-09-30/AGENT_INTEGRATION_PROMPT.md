Please integrate and test the attached **Smart Assistant Library + Draft Workflow** package against the latest authoritative branch.

Start with `RETURN_NOTES.md`. Reconcile rather than blindly overwrite newer fixes.

The goal is to make new-draft creation measurement-first and low-friction:
- assistant-approved libraries/components;
- structural roles/defaults for roof area, ridge, hip, valley, barge, spouting, underlay and fixings;
- retain measurements before products are chosen;
- group all genuine product choices into one card;
- preserve repeated measurements;
- create only through the existing reviewed P4 Confirm flow.

Please preserve all current P1.7.x/P1.7.3 retrieval/task/security work, quota/admission/finish behavior, Luna config, tenant/RLS boundaries, permissions, pricing engines and confirmation/audit rules.

Integration sequence:
1. Merge code with the latest branch and run clean install/typecheck/lint/build + existing Smart Assistant suites.
2. Review/apply only `backend/supabase/migrations/20260930120000_sa_v2_library_workflow.sql` on testing.
3. Test the new Smart Assistant library settings as owner/admin, including whole-library mode, selected-component mode, roles and one-default-per-role enforcement.
4. Keep `SMART_ASSISTANT_LIBRARY_WORKFLOW_ENABLED=false` until DB/security checks pass, then enable only on testing.
5. Run real Luna/phone acceptance using a configured roofing library.

Critical owner test:
> Create a draft for James Smith at 123 Grand Lane. Main roof 100 m2 at 25 degrees, with four hips of 5 m each. Use my configured roofing library.

Acceptance is the **saved database result**, not plausible chat text:
- no request for component IDs/generic "component selections";
- real account products chosen automatically when unambiguous;
- all genuine unresolved choices shown together;
- text/voice choice follow-up retains the working brief;
- site address saved;
- per-area pitch correct;
- four 5m hip entries remain four entries;
- pricing/waste uses existing QuoteCore engines;
- exactly one draft created after explicit Confirm;
- stale/changed library choices fail safely;
- no cross-company component can be selected.

Please return the complete latest source ZIP with applied migration/flags, build/security results, exact conversation transcript, DB verification, timings, failures and any integration fixes. Do not start unrelated UX/voice/PWA work in this integration.
