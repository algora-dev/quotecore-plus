import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { isIP } from 'node:net';
import { LIMITS, ScanError } from './types';
/** Reject private/special destinations, including mapped IPv4 and rebinding. */
export function publicAddress(ip: string): boolean {
    if (isIP(ip) === 4) {
        const [a, b, c] = ip.split('.').map(Number);
        return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0 && (c === 0 || c === 2)) || (a === 192 && b === 88 && c === 99) || (a === 198 && (b === 18 || b === 19 || b === 51 && c === 100)) || (a === 203 && b === 0 && c === 113));
    }
    if (isIP(ip) === 6) {
        // Expand enough to inspect the prefix numerically; a textual "2:" is not 2000::/3.
        const sides = ip.toLowerCase().split('::');
        const left = sides[0] ? sides[0].split(':') : [];
        const right = sides.length === 2 && sides[1] ? sides[1].split(':') : [];
        const words = sides.length === 2 ? [...left, ...Array(8 - left.length - right.length).fill('0'), ...right] : left;
        const first = parseInt(words[0], 16), second = parseInt(words[1], 16);
        return first >= 0x2000 && first <= 0x3fff && first !== 0x2002 && first !== 0x3fff
            && !(first === 0x2001 && (second < 0x200 || second === 0xdb8));
    }
    return false;
}
export function validateDownloadUrl(value: string, allowedOrigins: readonly string[]): URL {
    if (/^(?:\/mnt\/|sandbox:|file:|data:|blob:|[a-zA-Z]:[\\/])/.test(value))
        throw new ScanError('LOCAL_FILE_REFERENCE', 'This is a local or inline file reference, not a transferable HTTPS attachment. QuoteCore+ cannot read the chat sandbox. Upload the image in the review panel.');
    let url: URL;
    try {
        url = new URL(value);
    }
    catch {
        throw new ScanError('INVALID_FILE_URL', 'The file reference is not a valid HTTPS URL.');
    }
    if (value.length > 8192 || url.protocol !== 'https:' || url.username || url.password || url.hash || (url.port && url.port !== '443') || isIP(url.hostname.replace(/^\[|\]$/g, '')) || !allowedOrigins.includes(url.origin))
        throw new ScanError('FILE_HOST_NOT_ALLOWED', 'This file host is not allowlisted. Upload the image in the QuoteCore+ review panel instead.');
    return url;
}
export async function downloadPlan(value: string, allowedOrigins: readonly string[]): Promise<Buffer> {
    const url = validateDownloadUrl(value, allowedOrigins);
    let addresses: {
        address: string;
        family: number;
    }[];
    try {
        addresses = await lookup(url.hostname, { all: true, verbatim: true });
    }
    catch {
        throw new ScanError('FILE_DOWNLOAD_FAILED', 'The file host could not be resolved. Upload the image in the review panel.');
    }
    if (!addresses.length || addresses.some(a => !publicAddress(a.address)))
        throw new ScanError('UNSAFE_FILE_HOST', 'The file host resolved to a non-public address.');
    const pinned = addresses[0];
    return new Promise<Buffer>((resolve, reject) => {
        let total = 0;
        const chunks: Buffer[] = [];
        const req = request(url, {
            method: 'GET', agent: false, headers: { Accept: 'image/png,image/jpeg,image/webp', 'User-Agent': 'QuoteCore-Host-Outline/1.0' },
            // Pin the validated resolution so a second DNS lookup cannot redirect to an internal service.
            lookup: ((_host: unknown, _options: unknown, callback: (...args: unknown[]) => void) => {
                const opts = _options as {
                    all?: boolean;
                };
                if (opts.all)
                    callback(null, [pinned]);
                else
                    callback(null, pinned.address, pinned.family);
            }) as import('node:net').LookupFunction,
        }, res => {
            const fail = (error: ScanError) => { res.destroy(); reject(error); };
            if (res.statusCode !== 200)
                return fail(new ScanError('FILE_DOWNLOAD_FAILED', 'The image URL expired or redirected. Refresh the attachment or upload it in the review panel.'));
            if (Number(res.headers['content-length'] ?? 0) > LIMITS.uploadBytes)
                return fail(new ScanError('FILE_TOO_LARGE', 'Use an image under 3 MiB.', 413));
            res.on('data', (chunk: Buffer) => { total += chunk.length; if (total > LIMITS.uploadBytes)
                fail(new ScanError('FILE_TOO_LARGE', 'Use an image under 3 MiB.', 413));
            else
                chunks.push(chunk); });
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', () => reject(new ScanError('FILE_DOWNLOAD_FAILED', 'The image download was interrupted.')));
        });
        const timeout = setTimeout(() => req.destroy(new Error('timeout')), 15000);
        req.on('close', () => clearTimeout(timeout));
        req.on('error', () => reject(new ScanError('FILE_DOWNLOAD_FAILED', 'The image download failed or timed out.')));
        req.end();
    });
}
