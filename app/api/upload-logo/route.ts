import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    // Get company context
    const profile = await requireCompanyContext();
    
    // Get form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    // Check file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
    }
    
    // Check file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be less than 5MB' }, { status: 400 });
    }
    
    // Create unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `${profile.company_id}/order-logos/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    
    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Upload to Supabase storage
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.storage
      .from('company-logos')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      });
    
    if (error) {
      console.error('[upload-logo] Upload error:', error);
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from('company-logos')
      .getPublicUrl(fileName);
    
    return NextResponse.json({ url: urlData.publicUrl });
  } catch (error) {
    console.error('[upload-logo] Error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
