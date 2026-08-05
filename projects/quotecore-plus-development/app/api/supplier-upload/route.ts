import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';

/**
 * Supplier asset upload endpoint.
 * Handles three asset types: logo, banner, price-list.
 * Files are stored in the "supplier-assets" Supabase Storage bucket.
 */

type AssetKind = 'logo' | 'banner' | 'price-list';

interface ImageKind {
  mime: 'image/png' | 'image/jpeg' | 'image/webp';
  ext: string;
  magic: number[];
  magicOffset?: number;
  also?: { offset: number; bytes: number[] };
}

const IMAGE_KINDS: ImageKind[] = [
  { mime: 'image/png', ext: 'png', magic: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] },
  { mime: 'image/jpeg', ext: 'jpg', magic: [0xFF, 0xD8, 0xFF] },
  { mime: 'image/webp', ext: 'webp', magic: [0x52, 0x49, 0x46, 0x46], also: { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] } },
];

function detectImageKind(buf: Uint8Array): ImageKind | null {
  outer: for (const k of IMAGE_KINDS) {
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

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB for logos/banners
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB for price lists

export async function POST(request: NextRequest) {
  try {
    const profile = await requireCompanyContext();

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const assetKind = formData.get('kind') as AssetKind;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!assetKind || !['logo', 'banner', 'price-list'].includes(assetKind)) {
      return NextResponse.json({ error: 'Invalid asset kind' }, { status: 400 });
    }

    // Verify the company is a supplier
    const supabase = await createSupabaseServerClient();
    const { data: supplier } = await supabase
      .from('supplier_profiles')
      .select('id, slug')
      .eq('company_id', profile.company_id)
      .maybeSingle();

    if (!supplier) {
      return NextResponse.json({ error: 'No supplier profile found for this company' }, { status: 403 });
    }

    const declared = (file.type || '').toLowerCase();

    if (assetKind === 'price-list') {
      // PDF or CSV only
      if (declared !== 'application/pdf' && declared !== 'text/csv') {
        return NextResponse.json(
          { error: 'Price list must be a PDF or CSV file' },
          { status: 400 },
        );
      }
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: 'File size must be less than 10MB' }, { status: 400 });
      }

      const ext = declared === 'application/pdf' ? 'pdf' : 'csv';
      const random = Math.random().toString(36).substring(2, 9);
      const fileName = `${profile.company_id}/price-list-${Date.now()}-${random}.${ext}`;

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { error: uploadError } = await supabase.storage
        .from('supplier-assets')
        .upload(fileName, buffer, {
          contentType: declared,
          upsert: false,
        });

      if (uploadError) {
        console.error('[supplier-upload] Price list upload error:', uploadError);
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
      }

      const { data: urlData } = supabase.storage
        .from('supplier-assets')
        .getPublicUrl(fileName);

      return NextResponse.json({
        url: urlData.publicUrl,
        filename: file.name,
        contentType: declared,
      });
    }

    // Logo or banner ÔÇö image validation
    const declaredOk = declared === 'image/png' || declared === 'image/jpeg' || declared === 'image/webp';
    if (!declaredOk) {
      return NextResponse.json(
        { error: `${assetKind === 'logo' ? 'Logo' : 'Banner'} must be a PNG, JPEG, or WEBP image` },
        { status: 400 },
      );
    }

    if (file.size > MAX_IMAGE_SIZE) {
      return NextResponse.json({ error: 'Image size must be less than 5MB' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const head = new Uint8Array(arrayBuffer.slice(0, 16));
    const kind = detectImageKind(head);

    if (!kind) {
      return NextResponse.json(
        { error: 'File contents do not match a PNG, JPEG, or WEBP image' },
        { status: 400 },
      );
    }

    if (kind.mime !== declared) {
      return NextResponse.json(
        { error: `Declared type ${declared} does not match the file contents` },
        { status: 400 },
      );
    }

    const random = Math.random().toString(36).substring(2, 9);
    const folder = assetKind === 'logo' ? 'logos' : 'banners';
    const fileName = `${profile.company_id}/${folder}/${Date.now()}-${random}.${kind.ext}`;

    const { error: uploadError } = await supabase.storage
      .from('supplier-assets')
      .upload(fileName, buffer, {
        contentType: kind.mime,
        upsert: false,
      });

    if (uploadError) {
      console.error('[supplier-upload] Image upload error:', uploadError);
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }

    const { data: urlData } = supabase.storage
      .from('supplier-assets')
      .getPublicUrl(fileName);

    return NextResponse.json({ url: urlData.publicUrl });
  } catch (error) {
    console.error('[supplier-upload] Error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
