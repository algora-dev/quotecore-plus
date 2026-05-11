import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';

/**
 * Logo upload endpoint for material-order branding.
 *
 * Hardened 2026-05-11 (Gerald audit M-01):
 *   - Allowlist raster MIME only: png, jpeg, webp. SVG is explicitly
 *     forbidden because the logos bucket is PUBLIC, and a public SVG URL
 *     is a content-injection / XSS footgun (SVG can carry inline scripts
 *     and event handlers, which some embedding contexts will execute).
 *   - Magic-byte sniff (first ~12 bytes of the upload) cross-checks the
 *     declared MIME so a `file.type = 'image/png'` claim with a non-PNG
 *     payload is rejected.
 *   - Extension is derived from the VALIDATED MIME, not the user's
 *     `file.name`. The original filename is allowed to contain anything;
 *     we don't trust it.
 */

interface AllowedKind {
  mime: 'image/png' | 'image/jpeg' | 'image/webp';
  ext: 'png' | 'jpg' | 'webp';
  /** First bytes that must be present for this kind to match (Uint8 array). */
  magic: number[];
  /** Optional offset into the file where the magic starts. */
  magicOffset?: number;
  /** Optional secondary check (e.g. WEBP's RIFF / WEBP header pair). */
  also?: { offset: number; bytes: number[] };
}

const ALLOWED_KINDS: AllowedKind[] = [
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  { mime: 'image/png',  ext: 'png',  magic: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] },
  // JPEG: FF D8 FF
  { mime: 'image/jpeg', ext: 'jpg',  magic: [0xFF, 0xD8, 0xFF] },
  // WEBP: RIFF....WEBP (bytes 0–3 = "RIFF", bytes 8–11 = "WEBP")
  { mime: 'image/webp', ext: 'webp', magic: [0x52, 0x49, 0x46, 0x46], also: { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] } },
];

function detectKind(buf: Uint8Array): AllowedKind | null {
  outer: for (const k of ALLOWED_KINDS) {
    const offset = k.magicOffset ?? 0;
    if (buf.length < offset + k.magic.length) continue;
    for (let i = 0; i < k.magic.length; i++) {
      if (buf[offset + i] !== k.magic[i]) continue outer;
    }
    if (k.also) {
      if (buf.length < k.also.offset + k.also.bytes.length) continue;
      for (let i = 0; i < k.also.bytes.length; i++) {
        if (buf[k.also.offset + i] !== k.also.bytes[i]) continue outer;
      }
    }
    return k;
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const profile = await requireCompanyContext();

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Cheap pre-check on the declared MIME so we can reject early without
    // reading the whole upload. The authoritative check is the magic-byte
    // sniff below.
    const declared = (file.type || '').toLowerCase();
    const declaredOk = declared === 'image/png' || declared === 'image/jpeg' || declared === 'image/webp';
    if (!declaredOk) {
      return NextResponse.json(
        { error: 'Logo must be a PNG, JPEG, or WEBP image. SVG and other formats are not supported.' },
        { status: 400 },
      );
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be less than 5MB' }, { status: 400 });
    }

    // Read the upload into memory and verify the magic bytes match a
    // supported raster format.
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const head = new Uint8Array(arrayBuffer.slice(0, 16));
    const kind = detectKind(head);
    if (!kind) {
      return NextResponse.json(
        { error: 'File contents do not look like a PNG, JPEG, or WEBP image.' },
        { status: 400 },
      );
    }
    if (kind.mime !== declared) {
      // The user claimed one format but uploaded another. Refuse rather
      // than silently re-typing the file.
      return NextResponse.json(
        { error: `Declared type ${declared} does not match the file contents.` },
        { status: 400 },
      );
    }

    // Build the storage key from the VALIDATED extension, not the user's
    // filename. Random suffix prevents collisions inside the company prefix.
    const random = Math.random().toString(36).substring(2, 9);
    const fileName = `${profile.company_id}/order-logos/${Date.now()}-${random}.${kind.ext}`;

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.storage
      .from('company-logos')
      .upload(fileName, buffer, {
        contentType: kind.mime,
        upsert: false,
      });

    if (error) {
      console.error('[upload-logo] Upload error:', error);
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }

    const { data: urlData } = supabase.storage
      .from('company-logos')
      .getPublicUrl(fileName);

    return NextResponse.json({ url: urlData.publicUrl });
  } catch (error) {
    console.error('[upload-logo] Error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
