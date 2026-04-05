import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { loadCompanyContext } from '@/app/lib/data/company-context';

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
    
    const fileExt = file.name.split('.').pop();
    const fileName = `plan-${Date.now()}.${fileExt}`;
    const storagePath = `${company.id}/${quoteId}/${fileName}`;

    // Convert File to ArrayBuffer then upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from('QUOTE-DOCUMENTS')
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // Save metadata
    await supabase.from('quote_files').insert({
      quote_id: quoteId,
      file_name: file.name,
      file_type: 'plan',
      file_size: file.size,
      storage_path: storagePath,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
