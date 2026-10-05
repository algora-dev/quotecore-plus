# Phase P5 — Vision discovery + endpoint refinement service

Status: complete (code + unit tests; live-provider smoke deferred to P7 per spec)

Changed files:
- `app/lib/takeoff/calibrationVision.ts` (new): server-only bounded vision service. Sharp overview prep (EXIF auto-orientation via `.rotate()`, final dims from `toBuffer({resolveWithObject:true}).info` — never `metadata()`; 2000px longest-edge cap matching existing preprocessing; full-resolution oriented buffer preserved for native-detail crops). ONE discovery call (structured output, explicit strict JSON schema, max 10 hypotheses, nullable fields) + at most ONE batched refinement call (up to 3 best eligible hypotheses; endpoint-A/endpoint-B/label crops at native detail, each with explicit `AnalysisImageDescriptor` + `inputImageId`; overview included as binding context). Model: `process.env.AI_CALIBRATION_MODEL || 'gpt-4.1'` (ai-scan-v3 env-override pattern); client created lazily with `timeout: 90s, maxRetries: 1`; explicit refusal / `finish_reason:'length'` / empty / bad-JSON handling via typed `CalibrationVisionError` BEFORE normalisation. Prompts adapt spec 6.7 verbatim intent incl. the image-content-is-untrusted injection guard; version-tagged (`PROMPT_VERSION = 'cal-discovery-v1'`, `REFINEMENT_PROMPT_VERSION = 'cal-refinement-v1'`, `DETECTOR_VERSION`). Pure exports for tests: `validateRawDetection`, `normaliseDetection` (validation order per 6.6: validate → eligibility → independent parse → dedup via `deduplicateByGeometry`/`pairDistance` → rank by descending scene pixel span), `selectRefinementHypotheses`, `computeReferenceId` (jitter/order-stable physical-reference identity), HMAC round-token helpers.
- `app/api/takeoff/calibration/route.ts` (new): POST `{ action: 'search'|'refine', quoteId, pageId, round, strategy, roundToken, refineReferenceIds?, excludeReferenceIds? }`. Security order: `requireCompanyContext` → quote-belongs-to-company → **page-belongs-to-quote verified before anything else** (fixes the ai-scan-v3 gap the baseline flagged) → `companyHasAiCalibration` flag → `getCalibrationImageRevision` (null → 503 unsupported) → round-token budget → point charge → bounded provider work. Source bytes resolved server-side from `QUOTE-DOCUMENTS` (never client URLs). Response: status + ≤3 normalised candidates + notes + roundToken + points info; typed error codes; provider payloads never exposed.
- `app/lib/takeoff/pointCost.ts`: added `CALIBRATION_SEARCH_POINT_COST = 1` (client-safe single source; calibrationVision re-exports).
- `app/lib/takeoff/calibrationVision.test.ts` (new): 24 pure tests, no network.

Requirements covered: R03/R04/R05 (up-to-3 honest offers, span-ranked, unreadable-text-eligible), spec 5.4 orientation/dims, 6.3 bounded pipeline, 6.4 raw schema re-validation, 6.5 deterministic parsing/normalisation, 6.6 eligibility-then-span ranking, 6.7 prompt templates, 7.3 physical-reference identity, 12 API/security/points.

Validation actually run:
- `npm run test:calibration` — 106 pass, 0 fail (82 pre-existing + 24 new).
- `npx eslint` on all new/changed files — clean.
- `npm run build` — passed.
- Em-dash scan on new files — clean.

Not yet validated:
- Live provider behaviour (refusal/timeout/refinement quality) — controlled smoke test belongs to P7 with a real key + fixture corpus (spec 13-P5 task 7 / 14.3); no labelled corpus exists yet.
- Route integration tests were skipped: the repo's `node --import tsx --test` setup has no module-mocking registry, so OpenAI/Supabase cannot be cheaply stubbed at route level. The route's pipeline pieces are unit-tested through the shared pure exports. Noted, not hidden.

Migration / compatibility notes:
- No new tables/migrations; stateless rescan budget via HMAC round tokens (scheme documented in calibrationVision.ts + route comments): round-0 success returns a token authorising exactly one round-1 request bound to the same {pageId, imageRevision}, 24h max age; round-1 responses never mint another token.
- Point-cost interaction found and used: `check_and_deduct_ai_points(p_company_id, p_points_to_spend)` via service-role client — identical call shape to ai-scan-v3 stage `scan1`. That RPC has NO idempotency/reservation parameter, and `refund_ai_scan_points(p_job_id)` is bound to the `ai_scan_jobs` table (unusable without a job row). Therefore: ONE charge of 1 point per round, deducted before the model call (precedent); on technical failure (refusal/timeout/invalid output) the route refunds via a service-role read-modify-write of `companies.ai_assist_points_used` mirroring the refund RPC's UPDATE, so a retried failed round nets one charge once it completes. Valid empty searches are performed searches and are not refunded. Honest limitations (also in code comments): without a persistent ledger a replayed `requestId` cannot be detected and a claimed prior failure cannot be proven — full 12.4 semantics remain a P4-ledger concern.
- `CALIBRATION_TOKEN_SECRET` env var is optional (falls back to `OPENAI_API_KEY` as HMAC secret); set a dedicated secret when convenient.

Remaining work and next phase:
- P6: wire the desktop controller/UI (currently mock-driven) to this endpoint, accepted-reference retention, stale-completion guards, and retire mock data. No commit or push performed (working tree left uncommitted with prior phases, as instructed).
