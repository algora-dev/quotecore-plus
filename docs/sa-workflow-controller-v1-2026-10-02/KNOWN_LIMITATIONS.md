# Known limitations / remaining release gates

## Verification gaps

Dependency installation failed in this restricted network environment. Full semantic typecheck, lint and Next build have **not passed**. Syntax transpilation is a narrower check. SQL was reviewed as source but never parsed/executed by PostgreSQL here. RLS, triggers, locking/deadlock behavior, exact deployed function signatures, transaction rollback and real concurrency remain staging gates. No real model/provider conversation, browser rendering, installed iPhone/Android PWA session, Web Push provider delivery or user-visible latency/effort test was run.

Several existing regression harnesses require fixtures absent from the lean ZIP or modules that could not be installed. Some metrics suites report assertion failures because their subprocess harness exits early; those failures were recorded, not converted into passes. Restore the canonical fixtures/dependencies and rerun.

## Deliberate product bounds

- Workflow limits: 12 areas, 24 measured component groups, 200 entries per group, 600 total entries, 40 deltas per correction. Reviews cap at 80 rows; very large differences refuse rather than hide material changes. Context shows 20 entries per group; the paginated reader exposes up to 50 at a time.
- Vocabulary: eight immutable built-in identities/behaviors plus at most twelve custom concepts using a supported behavior. Alias normalization is intentionally conservative ASCII normalization; it is not a multilingual semantic synonym engine.
- The library editor refuses partial saves beyond 500 components in one library; server reads are bounded and reject truncation/oversize instead of assuming completeness. Large catalogues need a separate paginated editor rather than a larger unverified bulk save.
- Same-draft correction is for a controller-created, owned, manual, unsent draft with a committed baseline. It does not import arbitrary historical drafts, measured/takeoff child structures, or legacy working briefs. Existing direct quote/builder capabilities remain separate.
- No automatic rebase after a human edits the draft elsewhere. Open the same draft in the builder and reconcile intentionally. Deleted/bound/uncertain drafts must not cause replacement creation. A failed initial create may leave a known/uncertain empty parent under the existing P4 recovery policy; inspect/audit it, never blindly retry creation.
- Confirmation races can surface the existing conflict error rather than a fresh replacement proposal. A stale card cannot save; request a current review. External-change conflicts remain builder reconciliation, not a hidden overwrite.
- Measurement system, trade and currency cannot change during a bound revision. Product/rate recalculation stays with QuoteCore; changing a workspace default does not silently swap an existing draft's product. Review/canonical component costs exclude quote-level margins/taxes, whose final presentation stays in the builder.
- Full workflow task-boundary behavior requires the existing task-context/resolver/retrieval rollout and capability versions. Do not enable the workflow flag alone and assume the full continuous-conversation acceptance is supported. No general task/resolver redesign was attempted.

## Push/PWA bounds

The first notification release intentionally uses generic lock-screen text. It delivers existing alerts, not a new proactive digest and not arbitrary AI-authored push. Supported endpoint hosts are exactly FCM, Mozilla and Apple; other push providers fail closed until explicitly security-reviewed and tested. HTTPS/browser permission and installed-PWA support must be verified on actual target devices.

The outbox provides unique event/subscription identities and lease-checked retries. Transport is **at least once, not guaranteed exactly once**: a timeout after provider acceptance may cause a retry. Stable Topic and notification tags reduce duplicates but do not prove device delivery. Provider 2xx means accepted by provider, not displayed by a device. Bounded dispatch handles at most 20 deliveries per invocation and a short retry/retention window; load/backlog tests are still required.

Logout's subscription disable is best effort. During database/network failure the server may not immediately revoke an existing browser subscription; a generic push could still arrive. Lock-screen content contains no customer/quote details, and tap resolution always reauthenticates. Browser permission revocation is reconciled on foreground/online or provider expiry; do not claim instant remote revocation. A message already in flight cannot be recalled.

Native Node protocol code passes the RFC ciphertext vector, independent randomized decryptions and signature verification, but has not had an independent security audit or provider interoperability test. No offline app cache, background AI, Realtime/WebRTC, photo extraction, or push analytics console was added.
