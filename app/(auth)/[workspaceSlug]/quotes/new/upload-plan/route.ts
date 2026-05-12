import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { loadCompanyContext } from '@/app/lib/data/company-context';
import { BUCKETS } from '@/app/lib/storage/buckets';

export async function POST(request: NextRequest) {
  try {
    const { company } = await loadCompanyContext();
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const quoteId = formData.get('quoteId') as string;

    if (!file || !quoteId) {
      return NextResponse.json({ error: 'Missing file or quoteId' }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();

    // Verify the quote belongs to the caller's company before writing into
    // its storage prefix. Without this an authenticated user could upload
    // into any other company's quote folder.
    const { data: ownedQuote } = await supabase
      .from('quotes')
      .select('id')
      .eq('id', quoteId)
      .eq('company_id', company.id)
      .maybeSingle();
    if (!ownedQuote) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    const fileExt = file.name.split('.').pop();
    const fileName = `plan-${Date.now()}.${fileExt}`;
    const storagePath = `${company.id}/${quoteId}/${fileName}`;

    // Convert File to ArrayBuffer then upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from(BUCKETS.QUOTE_DOCUMENTS)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // Save metadata. company_id and mime_type are NOT NULL on quote_files;
    // previously these inserts were silently failing with a constraint
    // violation (the typed Supabase pass on 2026-05-12 surfaced this).
    const { error: metadataError } = await supabase.from('quote_files').insert({
      company_id: company.id,
      quote_id: quoteId,
      file_name: file.name,
      file_type: 'plan',
      file_size: file.size,
      mime_type: file.type || 'application/octet-stream',
      storage_path: storagePath,
    });

    if (metadataError) {
      console.error('[Upload] Metadata insert error:', metadataError);
      return NextResponse.json({ error: `Metadata error: ${metadataError.message}` }, { status: 500 });
    }

    console.log('[Upload] Success! File saved:', storagePath);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
