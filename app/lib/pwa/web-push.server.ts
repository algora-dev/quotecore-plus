import 'server-only';
import { createCipheriv, createECDH, createHmac, createPrivateKey, randomBytes, sign, timingSafeEqual } from 'node:crypto';
import { request } from 'node:https';
import type { BrowserPushSubscription } from './push-contracts';

/** Deliberately closed: adding a provider is an SSRF/security review, not user configuration. */
export const PUSH_SERVICE_HOSTS = ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com'] as const;
export function pushEndpoint(endpoint: string): URL {
  if (typeof endpoint !== 'string' || endpoint.length > 2048 || /[\s\u0000-\u001f]/.test(endpoint)) throw new Error('Unsupported push endpoint.');
  let url: URL;
  try { url = new URL(endpoint); } catch { throw new Error('Unsupported push endpoint.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash || url.pathname === '/' || !PUSH_SERVICE_HOSTS.includes(url.hostname as typeof PUSH_SERVICE_HOSTS[number]))
    throw new Error('This browser push provider is not enabled.');
  return url;
}
export function decodeKey(value: string, length: number): Buffer {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid push key.');
  const bytes = Buffer.from(value, 'base64url');
  if (bytes.length !== length || bytes.toString('base64url') !== value) throw new Error('Invalid push key.');
  return bytes;
}
export function validateSubscription(input: unknown): BrowserPushSubscription {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Missing browser subscription.');
  const row = input as Record<string, unknown>, keys = row.keys as Record<string, unknown> | undefined;
  if (typeof row.endpoint !== 'string' || !keys || typeof keys !== 'object' || Array.isArray(keys)) throw new Error('Invalid browser subscription.');
  pushEndpoint(row.endpoint);
  const point = decodeKey(keys.p256dh as string, 65);
  if (point[0] !== 4) throw new Error('Invalid browser public key.');
  // computeSecret validates that the point is on P-256, without trusting its label.
  const validator = createECDH('prime256v1'); validator.generateKeys(); validator.computeSecret(point);
  decodeKey(keys.auth as string, 16);
  return { endpoint: row.endpoint, keys: { p256dh: keys.p256dh as string, auth: keys.auth as string } };
}
const hmac = (key: Buffer, data: Buffer) => createHmac('sha256', key).update(data).digest();
const expandOne = (key: Buffer, info: Buffer) => hmac(key, Buffer.concat([info, Buffer.from([1])]));

/** RFC 8291 / RFC 8188 single-record aes128gcm. Uses Node cryptographic primitives.
 * Explicit entropy is a test seam for the RFC known-answer vector; production
 * calls never supply it. This does not support legacy aesgcm or arbitrary records.
 * See docs/sa-workflow-controller-v1-2026-10-02/PUSH_PROTOCOL.md. */
export function encryptWebPush(payload: string, p256dh: string, auth: string, entropy?: { salt: Buffer; privateKey: Buffer }): Buffer {
  const message = Buffer.from(payload, 'utf8');
  if (message.length > 3000) throw new Error('Push payload exceeds the conservative single-record limit.');
  const uaPublic = decodeKey(p256dh, 65), authSecret = decodeKey(auth, 16);
  if (uaPublic[0] !== 4) throw new Error('Invalid browser public key.');
  const ecdh = createECDH('prime256v1');
  if (entropy) ecdh.setPrivateKey(entropy.privateKey); else ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey(), salt = entropy?.salt ?? randomBytes(16);
  if (salt.length !== 16) throw new Error('Invalid encryption salt.');
  const prkKey = hmac(authSecret, ecdh.computeSecret(uaPublic));
  const ikm = expandOne(prkKey, Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]));
  const prk = hmac(salt, ikm);
  const cek = expandOne(prk, Buffer.from('Content-Encoding: aes128gcm\0')).subarray(0, 16);
  const nonce = expandOne(prk, Buffer.from('Content-Encoding: nonce\0')).subarray(0, 12);
  const cipher = createCipheriv('aes-128-gcm', cek, nonce);
  const encrypted = Buffer.concat([cipher.update(Buffer.concat([message, Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const header = Buffer.alloc(21); salt.copy(header); header.writeUInt32BE(4096, 16); header[20] = asPublic.length;
  return Buffer.concat([header, asPublic, encrypted]);
}
export type VapidConfig = { publicKey: string; privateKey: string; subject: string };
export function validateVapid(config: VapidConfig): void {
  const pub = decodeKey(config.publicKey, 65), privateKey = decodeKey(config.privateKey, 32);
  const ecdh = createECDH('prime256v1'); ecdh.setPrivateKey(privateKey);
  if (!timingSafeEqual(pub, ecdh.getPublicKey())) throw new Error('VAPID keys do not form a key pair.');
  if (config.subject.length > 250 || /[\s\u0000-\u001f]/.test(config.subject) || !/^(?:mailto:[^@]+@[^@]+|https:\/\/[^/]+.*)$/.test(config.subject)) throw new Error('A valid VAPID contact is required.');
}
export function vapidAuthorization(endpoint: string, config: VapidConfig, nowSeconds = Math.floor(Date.now() / 1000)): string {
  const url = pushEndpoint(endpoint); validateVapid(config);
  const point = decodeKey(config.publicKey, 65);
  const key = createPrivateKey({ format: 'jwk', key: { kty: 'EC', crv: 'P-256', x: point.subarray(1, 33).toString('base64url'), y: point.subarray(33).toString('base64url'), d: config.privateKey } });
  const encode = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
  const unsigned = `${encode({ typ: 'JWT', alg: 'ES256' })}.${encode({ aud: url.origin, exp: nowSeconds + 12 * 3600, sub: config.subject })}`;
  const signature = sign('sha256', Buffer.from(unsigned), { key, dsaEncoding: 'ieee-p1363' });
  return `vapid t=${unsigned}.${signature.toString('base64url')}, k=${config.publicKey}`;
}
/** No redirects, no arbitrary hosts, no response-body logging, bounded timeout.
 * A transport failure is unknown delivery, not evidence of non-delivery. */
export async function sendWebPush(subscription: BrowserPushSubscription, payload: string, topic: string, config: VapidConfig): Promise<{ status: number; retryAfter?: string }> {
  const url = pushEndpoint(subscription.endpoint);
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(topic)) throw new Error('Invalid push topic.');
  const body = encryptWebPush(payload, subscription.keys.p256dh, subscription.keys.auth);
  return new Promise((resolve, reject) => {
    const req = request(url, { method: 'POST', signal: AbortSignal.timeout(8000), headers: {
      Authorization: vapidAuthorization(subscription.endpoint, config), 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream',
      'Content-Length': String(body.length), TTL: '300', Urgency: 'normal', Topic: topic,
    } }, res => {
      const status = res.statusCode ?? 0;
      // The status is sufficient. Never buffer an untrusted push-service body.
      res.destroy(); resolve({ status, retryAfter: typeof res.headers['retry-after'] === 'string' ? res.headers['retry-after'] : undefined });
    });
    req.on('error', reject); req.end(body);
  });
}
