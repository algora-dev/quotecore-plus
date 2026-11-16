import { NextRequest, NextResponse } from 'next/server';
import { reserveExtractCall, fetchLibraryComponents, insertMeasurementImport, scopedImportContext } from '@/app/lib/measurements-import/storage.server';
import { extractMeasurementLines } from '@/app/lib/measurements-import/extract.server';
export const runtime = 'nodejs';
export const maxDuration = 60;
const MAX_BYTES = 8 * 1024 * 1024;
const uuid = (s: string) => /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(s);
function typeOfFile(name: string, bytes: Buffer): 'csv' | 'xlsx' | 'pdf' | 'image' | 'text' | null {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf' && bytes.subarray(0, 5).toString() === '%PDF-') return 'pdf';
  if (['png', 'jpg', 'jpeg', 'webp'].includes(ext ?? '')) {
    if (bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])) && ext === 'png') return 'image';
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && ['jpg', 'jpeg'].includes(ext ?? '')) return 'image';
    if (bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP' && ext === 'webp') return 'image';
  }
  if (ext === 'xlsx' && bytes[0] === 0x50 && bytes[1] === 0x4b) return 'xlsx';
  if (ext === 'csv' && bytes.indexOf(0) === -1) return 'csv';
  if (ext === 'txt' && bytes.indexOf(0) === -1) return 'text';
  return null;
}
export async function POST(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_MEASUREMENT_IMPORT_ENABLED !== 'true') return NextResponse.json({ error: 'Measurements import is unavailable.' }, { status: 404 });
  try {
    const length = Number(request.headers.get('content-length') || 0);
    if (length > MAX_BYTES + 60000) return NextResponse.json({ error: 'Maximum upload size is 8 MB.' }, { status: 413 });
    const form = await request.formData();
    const quoteId = String(form.get('quoteId') || '');
    const libraryId = String(form.get('libraryId') || '');
    if (!uuid(quoteId) || !uuid(libraryId)) return NextResponse.json({ error: 'Invalid quote or library.' }, { status: 400 });
    const file = form.get('file');
    const text = String(form.get('text') || '').trim();
    if (file instanceof File && text) return NextResponse.json({ error: 'Submit a file or text, not both.' }, { status: 400 });
    if (!(file instanceof File) && (!text || text.length > 20000)) return NextResponse.json({ error: 'Enter your measurements (up to 20,000 characters).' }, { status: 400 });
    const { profile, admin } = await scopedImportContext(quoteId);
    const components = await fetchLibraryComponents(admin, profile.company_id, libraryId);
    if (!components.length) return NextResponse.json({ error: 'This library has no components yet. Pick another library or add components first.' }, { status: 400 });
    // Reserve the daily AI quota before any provider call.
    await reserveExtractCall();
    let kind: 'csv' | 'xlsx' | 'pdf' | 'image' | 'text';
    let sourceName: string;
    let lines;
    if (file instanceof File) {
      if (file.size < 1 || file.size > MAX_BYTES) return NextResponse.json({ error: 'File must be between 1 byte and 8 MB.' }, { status: 413 });
      const bytes = Buffer.from(await file.arrayBuffer());
      const fileKind = typeOfFile(file.name, bytes);
      if (!fileKind) return NextResponse.json({ error: 'Use CSV, XLSX, TXT, PDF, PNG, JPEG or WebP files.' }, { status: 400 });
      kind = fileKind; sourceName = file.name;
      const mime = file.name.toLowerCase().endsWith('.png') ? 'image/png' : file.name.toLowerCase().endsWith('.webp') ? 'image/webp' : 'image/jpeg';
      if (fileKind === 'csv' || fileKind === 'text') {
        lines = await extractMeasurementLines({ kind: 'text', name: sourceName, text: bytes.toString('utf8') });
      } else if (fileKind === 'xlsx') {
        lines = await extractMeasurementLines({ kind: 'xlsx', name: sourceName, bytes });
      } else if (fileKind === 'pdf') {
        lines = await extractMeasurementLines({ kind: 'pdf', name: sourceName, bytes });
      } else {
        lines = await extractMeasurementLines({ kind: 'image', name: sourceName, mime, bytes });
      }
    } else {
      kind = 'text'; sourceName = 'Typed measurements';
      lines = await extractMeasurementLines({ kind: 'text', name: sourceName, text });
    }
    const result = await insertMeasurementImport({ quoteId, kind, name: sourceName, libraryId, defaultBasis: 'plan', lines, components });
    return NextResponse.json({ ok: true, ...result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Import failed.';
    const status = /limit|quota/.test(message.toLowerCase()) ? 429 : /not configured|migration/.test(message.toLowerCase()) ? 503 : 400;
    return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
