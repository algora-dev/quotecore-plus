import { NextResponse } from 'next/server';
import { submitSupplierEnquiry, uploadEnquiryFile, type SupplierEnquiryInput } from '@/app/lib/supplier-pricing/supplierEnquiry';

/**
 * POST /api/free-tools/supplier-enquiry
 *
 * Submit an enquiry to a supplier.
 * Body: SupplierEnquiryInput (JSON)
 *
 * Returns: { ok, enquiryId?, error? }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.supplierSlug || typeof body.supplierSlug !== 'string') {
      return NextResponse.json({ ok: false, error: 'supplierSlug is required' }, { status: 400 });
    }
    if (!body.senderName || typeof body.senderName !== 'string') {
      return NextResponse.json({ ok: false, error: 'senderName is required' }, { status: 400 });
    }
    // Validate email format (proper @ and domain)
    if (!body.senderEmail || typeof body.senderEmail !== 'string') {
      return NextResponse.json({ ok: false, error: 'senderEmail is required' }, { status: 400 });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.senderEmail)) {
      return NextResponse.json({ ok: false, error: 'Please enter a valid email address.' }, { status: 400 });
    }

    // Validate message length
    if (body.message && typeof body.message === 'string' && body.message.length > 5000) {
      return NextResponse.json({ ok: false, error: 'Message is too long (max 5000 characters).' }, { status: 400 });
    }

    // Sanitize inputs
    const input: SupplierEnquiryInput = {
      supplierSlug: body.supplierSlug.trim(),
      senderName: body.senderName.trim().slice(0, 200),
      senderEmail: body.senderEmail.trim().toLowerCase(),
      senderPhone: body.senderPhone?.trim().slice(0, 50) || undefined,
      intent: ['detailed_quote', 'order_request', 'pricing_question', 'general_enquiry'].includes(body.intent)
        ? body.intent
        : 'general_enquiry',
      message: body.message?.trim().slice(0, 5000) || '',
      includeQuantities: body.includeQuantities !== false,
      includePricing: body.includePricing !== false,
      includeResultLink: body.includeResultLink !== false,
      resultToken: body.resultToken,
      resultUrl: body.resultUrl,
      totals: body.totals,
      currency: body.currency,
      marketingConsent: body.marketingConsent === true,
      attachmentIds: Array.isArray(body.attachmentIds) ? body.attachmentIds : undefined,
    };

    const result = await submitSupplierEnquiry(input);

    if (result.ok) {
      return NextResponse.json({ ok: true, enquiryId: result.enquiryId });
    } else {
      return NextResponse.json(
        { ok: false, error: result.error || 'Failed to send enquiry' },
        { status: 500 },
      );
    }
  } catch (err) {
    console.error('[supplier-enquiry] Unhandled error:', err);
    return NextResponse.json(
      { ok: false, error: 'An unexpected error occurred. Please try again.' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/free-tools/supplier-enquiry?action=upload
 *
 * Upload an attachment file for a supplier enquiry.
 * Body: multipart/form-data with "file" field
 *
 * Returns: { ok, fileId?, error? }
 */
export async function PUT(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ ok: false, error: 'No file provided' }, { status: 400 });
    }

    const content = Buffer.from(await file.arrayBuffer());
    const result = await uploadEnquiryFile(file.name, content, file.type);

    if (result.ok) {
      return NextResponse.json({ ok: true, fileId: result.fileId });
    } else {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
  } catch (err) {
    console.error('[supplier-enquiry] Upload error:', err);
    return NextResponse.json(
      { ok: false, error: 'Failed to upload file' },
      { status: 500 },
    );
  }
}
