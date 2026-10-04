# Demo V2.2 return notes

Start with `START_HERE_DEMO_V22_RETURN.md`. This cumulative return replaces the previous demo Increment 1 package and is based on `77e99efd`.

## Implemented

The seed, guide, reset, prepared scan adapter, real-save/customer-editor bridge, expiring customer preview, optional verified self-send, conservative resource guards and expiry cleanup are source implementations, not simulated success placeholders. See `IMPLEMENTATION_NOTES.md` for exact paths and boundaries.

### Protected-file impact

This patch deliberately touches middleware/auth factories, real quote/component server actions, selected Takeoff entry/save UI hooks, customer editor/normal public document gates, outbound libraries and paid-route wrappers. These are narrow demo integration changes requested by the owner, not changes to the underlying pricing, Takeoff geometry or assistant business engines. All touched paths and hashes are in `FILE_CHANGES.json`.

No changes were made under the owner-protected free-roof-takeoff, Message Center/inbox, public measurement-to-quote-tool or `app/components/smart-assistant/` trees. Pricing/precision/calibration/topology implementation files and the generated database types remain unchanged. No package.json/lockfile edits, dependency additions, DB migration files, existing route deletions or changes to normal route names are returned. New demo routes are additive. The approved demo hostname redirect changes which host serves demos; test app/marketing/preview host behavior before enabling it.

### Deliberate corrections to the earlier increment

- Never clone an arbitrary existing customer company; author every fixture explicitly.
- Reset removes visitor changes and reseeds; retains the visitor/IP allowance identity.
- Neither client-controlled step numbers nor routes grant capabilities. Server state is parsed and events follow successful actual operations.
- Precomputed scan is labeled honestly. It is not a paid model invocation.
- Email verification precedes quote self-send. "Provider accepted" is not described as "delivered". Marketing consent is never inferred.
- Normal public quote/order/invoice/mobile/attachment paths explicitly reject demo companies, including preexisting database-generated tokens.
- Paid text, voice transcription and speech routes receive guards; alternate paid routes cannot become a bypass by replaying a request on a normal host.
- Expired/reset workspace cleanup knows about protected assistant audit tables rather than pretending all rows cascade.

## Integration-owned work, not applied by this package

The assistant cleanup helper in `DATABASE_GATES.md` needs live-schema review, a testing migration under Gavin's ownership and verification before real assistant writes are enabled. No general audit-table delete grant is requested. The supplied DB types lag some assistant-owned tables; a narrow typed integration client describes their existing contract without rewriting the generated types.

Live DB policy/column grants must prevent anonymous profile/tenant/plan escalation and enforce expiry for direct Supabase calls. Source route guards alone cannot prove that. Storage quotas and generic record caps need testing against the actual demo plan. The prepared Takeoff path does not grant arbitrary freestyle authenticated scanning/upload sessions.

## Known validation/product limits

- Full install/build/lint/semantic app typecheck and browser/live-service acceptance tests were not possible here; see `VALIDATION.md`.
- Existing counters use per-bucket atomic CAS. Partial multi-bucket failure retains earlier debits; no rollback/refund is claimed. Reservations are conservative charges, not measured provider spending guarantees.
- Existing seed writes are checked and failure-compensated, not one all-table SQL transaction. A interrupted provisioning/cleanup run may need cron retry.
- Guide records actual Takeoff save, but does not yet separately prove the visitor drew the required rectangle. Finish-to-customer behavior and final-canvas pricing must be browser-tested with additions/removals.
- Other record/storage caps largely inherit the demo plan; component creation additionally has a conservative 80-new-component visitor/IP allowance. Do not claim bespoke 25/20/20 limits were all implemented.
- Raw email appears in the authenticated verification challenge/client and the delivery provider, not as a plaintext email field in the demo usage ledger. Provider logs/retention are separate from DB cleanup.
- Metadata retention is seven days after expiry/deletion. Cleanup retries on errors; investigate persistent cleanup_failed sessions rather than suppressing them.

No deployment, live database mutation, email delivery or provider/model call was performed by this implementation session.
