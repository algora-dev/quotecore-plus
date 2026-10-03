# Web Push protocol, security boundaries and operation

## Scope and evidence

Implementation: `app/lib/pwa/web-push.server.ts`, using Node's P-256 ECDH, HMAC-SHA-256/HKDF expansion, AES-128-GCM and ES256 signing primitives. No external npm dependency was added because the package lock is retained and dependencies could not be fetched in this environment. This is a small single-record implementation, not a general-purpose cryptography library or a claim of independent audit.

The executable test reproduces the entire ciphertext in RFC 8291 §5, decrypts randomized messages with an independently written HKDF-based decoder, rejects tampering/invalid keys, and independently verifies VAPID JWT signatures. These prove those offline cases, **not live browser/provider interoperability**. Run actual FCM/Firefox/Apple delivery before enabling.

Reference specifications used for implementation:

- RFC 8291, Web Push Message Encryption, particularly §3 and the §5 known-answer example: `https://www.rfc-editor.org/rfc/rfc8291.html`
- RFC 8188, HTTP Encrypted Content-Encoding (single final record delimiter and framing): `https://www.rfc-editor.org/rfc/rfc8188.html`
- RFC 8292, VAPID: `https://www.rfc-editor.org/rfc/rfc8292.html`

## Construction

Each send uses a fresh P-256 ephemeral ECDH key pair and 16-byte salt. Browser `p256dh` must be a valid uncompressed P-256 point; auth secret must decode canonically to 16 bytes. ECDH output is authenticated through the RFC WebPush info HKDF, then per-message salt derives a 16-byte AES key and 12-byte nonce. The final plaintext record uses delimiter `0x02`; ciphertext carries the GCM authentication tag and RFC aes128gcm header/key-id. UTF-8 payloads are limited to 3000 bytes below the single-record ceiling. The optional entropy seam exists solely for the public RFC test vector; production never supplies it.

VAPID uses a separately configured persistent P-256 pair, ES256 raw `(r,s)` JWT signatures, exact provider-origin audience, contact subject and twelve-hour expiry. Encryption key and authentication key are distinct. VAPID private key stays server-side; the public key is provided to browser subscription calls. Key rotation invalidates the stored key association and requires deliberate resubscription rather than attempting to send with a mismatched key.

## Endpoint and payload policy

Only HTTPS endpoints on these **exact** hosts are accepted: `fcm.googleapis.com`, `updates.push.services.mozilla.com`, `web.push.apple.com`. Credentials, custom ports, fragments, arbitrary hosts and redirects are rejected. Provider expansion requires code review/tests, not user-supplied configuration. Requests time out after eight seconds. Response bodies/endpoints/key material are not logged.

Payload is only `{version:1, kind:'quotecore_alert', deliveryId:<UUID>}`. Fixed generic service-worker text contains no customer name, address, amount, quote number or URL. Tap resolution fetches the owned delivery, current alert and current same-workspace entity, then constructs an allowed internal URL. No URL from AI or a push payload is used. Cross-account/missing records fall back to the current workspace's Message Center rather than leaking another tenant's destination.

## Delivery / consent semantics

Explicit UI interaction requests permission and registers the push-only service worker. Subscription RPCs derive actor/company from authentication, apply the existing MFA requirement and refuse endpoint takeover by a different account. At most ten active devices per user are allowed. Heartbeats never reenable a disabled subscription. Existing company alert preferences and per-device categories gate delivery.

Each eligible inserted alert produces at most one outbox row per subscription. Claim uses bounded `SKIP LOCKED` leases, rechecks current eligibility before send, retries network/408/429/5xx outcomes up to five attempts, and disables expired 404/410 endpoints. Acknowledgement uses the exact lease token. TTL is 300 seconds; queue events older than 24 hours are dropped; stale devices are disabled after 90 days; terminal delivery/disabled subscription retention is bounded. Dispatch runs via the protected cron route (at most 20 deliveries/invocation); monitoring/load capacity must be established during integration.

A provider-accepted message whose acknowledgement is lost can be retried. The delivery UUID supplies a stable Topic/notification tag, but exactly-once display is **not** guaranteed. Logout/revocation cannot recall a message already sent; server revocation is best effort during outages. Details always require authentication after tapping.
