> Historical Phase 1 reference. For this integrated package, use [Phase 1B integration instructions](../host-roof-scan-phase1b/INTEGRATION.md). They supersede the endpoint, environment and deployment steps below.

# Security, privacy and limits

## No inference-credit pathway

There is no OpenAI API client, API key use or MCP `sampling/createMessage` call in the new feature's inference path. Its model-side work happens only if the connected host performs it. Existing paid scan endpoints are neither imported nor requested. Hosting, storage, image processing and host usage still have costs/limits.

## Anonymous private data

Uploads receive random IDs and are held in a dedicated private store. HMAC-signed bearer references include purpose, image binding and expiration. A user should share those references only with their chosen AI conversation. They are not OAuth, account authentication or permission to touch business records.

Result URLs put bearer references in the fragment, not query strings. The browser clears the fragment after reading it and sends `Referrer-Policy: no-referrer`. Tokens remain visible to a holder and to the conversation when deliberately supplied. This is expected capability behavior, not encryption. Do not log tool arguments, request bodies, raw URLs with signed credentials, image bytes or UI gates.

The normal MCP model output does not include the additional UI review gate, but a holder of a plan reference can open its browser review. The gate prevents the advertised tools from accidentally auto-confirming; it is NOT a strong human-identity or authorization boundary. The endpoint can only review ephemeral geometry, not send messages or change customer data.

## Image safety

- Accepted: PNG, JPEG, WebP; raster signatures and decoder validation are authoritative.
- Rejected: PDF, SVG, animation, corrupt or oversized files.
- Input limits: 3 MiB, 24 million pixels; output: max 2000px longest side, both sides at least 200px, max 2 MiB encoded.
- Canonical preprocessing honors EXIF orientation, flattens transparency, removes metadata and bounds response size.
- Default PNG output; JPEG fallback may be used to keep the prepared raster bounded. The model and UI see the exact same chosen raster.
- No arbitrary remote image hosts. Exact origin allowlist, HTTPS, no credentials or IP-literal URL, no redirects, resolved-address validation and pinned DNS result.
- All text inside uploaded plans is untrusted content, not tool or system instructions. Prompt instructions communicate this, but host prompt-injection resistance is not guaranteed by text alone.

## Geometry and state safety

Outlines must be finite, in-bounds and nondegenerate, with 3 to 160 points. Unknown fields, repeated corners, intersections and nonadjacent self-touch are blocked. No automatic rounding, clamping or simplification of host proposals. Manual dragging is constrained by image bounds.

Signed image/proposal/review references prevent accidental cross-image mixing. Shared pure geometry math is reused, with strict boundary checks added. Optional calibration requires an explicit known reference and two image points at least 10 pixels apart. Null calibration means no physical area/perimeter output. Pitch is null and never inferred in Phase 1.

Review artifacts are immutable. A reviewed token certifies that the UI confirmation protocol ran with those coordinates, not that the shape is physically correct. The local editor invalidates a reviewed state after changes. Historical exports remain historical and must not be treated as live account data.

## Lifecycle

Access expires after 30 minutes. The local memory adapter prunes expired images. Private object storage needs scheduled physical cleanup; TTL in a signed reference does not delete a stored object. The purge utility is dry-run by default and limited to the dedicated namespace. User deletion removes the source object, not provider conversation data or existing exported geometry. A signed reviewed geometry reference may remain readable until its expiry because it contains the reviewed coordinates independently of image storage.

## Deployment limits

Default disabled. Local memory is rejected on Vercel or NODE_ENV=production. Production-mode rate limiting fails closed using the existing database RPC. Public request bodies, upload sizes and downloader timeouts are bounded. New image ingestion has a global staging budget as well as per-IP limits.

CORS is not authentication. UI opaque origins are supported for sandboxed hosts, while nonopaque origins need explicit approval. Endpoint HMAC references are the data-access capabilities. The browser fallback has a script-hash CSP; the embedded View requests only its configured API origin. Host CSP/capability negotiation must be checked live.

No actual ChatGPT, Claude or Grok tenant is connected in the authoring environment. No published-plugin review, model accuracy, tier compatibility, real phone hardware, data residency or legal/commercial compliance certification is claimed.
