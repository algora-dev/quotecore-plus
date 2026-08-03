import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { sendEmail, type EmailAttachment } from '@/app/lib/email/send';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function getSupabase() {
  return createClient(supabaseUrl, supabaseKey);
}

export interface SupplierEnquiryInput {
  supplierSlug: string;
  senderName: string;
  senderEmail: string;
  senderPhone?: string;
  intent: 'detailed_quote' | 'order_request' | 'pricing_question' | 'general_enquiry';
  message: string;
  includeQuantities: boolean;
  includePricing: boolean;
  includeResultLink: boolean;
  resultToken?: string;
  resultUrl?: string;
  totals?: Record<string, any>;
  currency?: string;
  marketingConsent: boolean;
  attachmentIds?: string[]; // IDs of previously uploaded files
}

export interface SupplierEnquiryResult {
  ok: boolean;
  enquiryId?: string;
  error?: string;
}

/**
 * Submit a supplier enquiry: store in DB + send email via Resend.
 */
export async function submitSupplierEnquiry(
  input: SupplierEnquiryInput,
): Promise<SupplierEnquiryResult> {
  const sb = getSupabase();

  // 1. Load supplier profile
  const { data: supplier, error: supError } = await sb
    .from('supplier_profiles')
    .select('id, supplier_name, slug, enquiry_email, enquiries_enabled, country, currency')
    .eq('slug', input.supplierSlug)
    .eq('status', 'approved')
    .single();

  if (supError || !supplier) {
    return { ok: false, error: 'Supplier not found or not approved' };
  }

  if (!supplier.enquiries_enabled || !supplier.enquiry_email) {
    return { ok: false, error: 'This supplier is not accepting enquiries' };
  }

  // 2. Load collection info if result token present
  let collectionId: string | null = null;
  let publishedVersion: number | null = null;

  if (input.resultToken) {
    // Try to extract supplierLib from the token's query params
    try {
      const { verifyResultToken } = await import('@/app/(public)/free-roofing-takeoff-builder/result-token');
      const payload = verifyResultToken(input.resultToken);
      if (payload) {
        const params = new URLSearchParams(payload.q);
        const lib = params.get('supplierLib');
        const ver = params.get('supplierVer');
        if (lib) collectionId = lib;
        if (ver) publishedVersion = Number(ver);
      }
    } catch {}
  }

  // 3. Insert enquiry record
  const { data: enquiry, error: enquiryError } = await sb
    .from('supplier_takeoff_enquiries')
    .insert({
      supplier_profile_id: supplier.id,
      collection_id: collectionId,
      published_version: publishedVersion,
      sender_name: input.senderName,
      sender_email: input.senderEmail,
      sender_phone: input.senderPhone || null,
      intent: input.intent,
      message: input.message,
      include_quantities: input.includeQuantities,
      include_pricing: input.includePricing,
      include_result_link: input.includeResultLink,
      include_files: (input.attachmentIds?.length ?? 0) > 0,
      result_token: input.resultToken || null,
      canonical_url: input.resultUrl || null,
      totals: input.totals || null,
      currency: input.currency || supplier.currency,
      marketing_consent: input.marketingConsent,
      consent_version: 'v1',
      delivery_status: 'pending',
    })
    .select('id')
    .single();

  if (enquiryError || !enquiry) {
    return { ok: false, error: 'Failed to create enquiry record' };
  }

  const enquiryId = enquiry.id;

  // 4. Link uploaded files to this enquiry + load attachments
  let attachments: EmailAttachment[] = [];
  if (input.attachmentIds && input.attachmentIds.length > 0) {
    // Update file records with the real enquiry ID
    await sb
      .from('supplier_takeoff_enquiry_files')
      .update({ enquiry_id: enquiryId })
      .in('id', input.attachmentIds);

    const { data: files } = await sb
      .from('supplier_takeoff_enquiry_files')
      .select('filename, storage_path, content_type, size_bytes')
      .in('id', input.attachmentIds);

    if (files && files.length > 0) {
      for (const file of files) {
        try {
          const { data: fileData } = await sb.storage
            .from('supplier-enquiry-files')
            .download(file.storage_path);

          if (fileData) {
            const buf = Buffer.from(await fileData.arrayBuffer());
            attachments.push({
              filename: file.filename,
              content: buf,
            });
          }
        } catch (err) {
          console.error('[supplier-enquiry] Failed to load attachment:', err);
        }
      }
    }
  }

  // 5. Build email content
  const intentLabels: Record<string, string> = {
    detailed_quote: 'Request for Detailed Quote',
    order_request: 'Order Request',
    pricing_question: 'Pricing Question',
    general_enquiry: 'General Enquiry',
  };

  const subject = `${intentLabels[input.intent] || 'Enquiry'} from ${input.senderName} via QuoteCore+`;

  const totalsText = input.totals
    ? Object.entries(input.totals)
        .filter(([_, val]) => {
          if (typeof val === 'object' && val !== null) {
            return (val as any).count > 0;
          }
          return false;
        })
        .map(([key, val]) => {
          const v = val as any;
          const label = v.label || key;
          const unit = v.unit || '';
          const raw = v.rawTotal != null ? Number(v.rawTotal).toFixed(2) : '-';
          const waste = v.withWaste != null ? Number(v.withWaste).toFixed(2) : '-';
          const wastePct = v.wastePercent || 0;
          const material = v.materialCost != null ? Number(v.materialCost).toFixed(2) : '0.00';
          const labour = v.labourCost != null ? Number(v.labourCost).toFixed(2) : '0.00';
          const total = v.totalCost != null ? Number(v.totalCost).toFixed(2) : '0.00';
          const cur = input.currency || '';
          return `<tr>
            <td style="padding:8px 12px 8px 0;font-weight:600;color:#1e293b;border-bottom:1px solid #f1f5f9;">${escapeHtml(label)}</td>
            <td style="padding:8px 12px 8px 0;color:#64748b;border-bottom:1px solid #f1f5f9;text-align:right;">${raw} ${unit}</td>
            <td style="padding:8px 12px 8px 0;color:#64748b;border-bottom:1px solid #f1f5f9;text-align:right;">+${wastePct}% = ${waste} ${unit}</td>
            <td style="padding:8px 0;color:#1e293b;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:500;">${cur}${material}</td>
          </tr>`;
        })
        .join('')
    : '';

  const grandMaterial = input.totals
    ? Object.values(input.totals).reduce((s, v: any) => s + (v.materialCost || 0), 0)
    : 0;
  const grandLabour = input.totals
    ? Object.values(input.totals).reduce((s, v: any) => s + (v.labourCost || 0), 0)
    : 0;
  const grandTotal = grandMaterial + grandLabour;
  const cur = input.currency || '';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
      <div style="background:#0f172a;padding:20px 24px;">
        <h1 style="margin:0;color:#fff;font-size:18px;font-weight:600;">New enquiry from QuoteCore+</h1>
        <p style="margin:4px 0 0;color:#94a3b8;font-size:13px;">${supplier.supplier_name} - Roof Takeoff Enquiry</p>
      </div>
      <div style="padding:24px;">
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
          <tr><td style="padding:4px 12px 4px 0;color:#64748b;width:120px;">From:</td><td style="padding:4px 0;font-weight:500;">${input.senderName}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#64748b;">Email:</td><td style="padding:4px 0;"><a href="mailto:${input.senderEmail}" style="color:#FF6B35;text-decoration:none;">${input.senderEmail}</a></td></tr>
          ${input.senderPhone ? `<tr><td style="padding:4px 12px 4px 0;color:#64748b;">Phone:</td><td style="padding:4px 0;">${input.senderPhone}</td></tr>` : ''}
          <tr><td style="padding:4px 12px 4px 0;color:#64748b;">Intent:</td><td style="padding:4px 0;">${intentLabels[input.intent] || input.intent}</td></tr>
          ${input.currency ? `<tr><td style="padding:4px 12px 4px 0;color:#64748b;">Currency:</td><td style="padding:4px 0;">${input.currency}</td></tr>` : ''}
        </table>

        ${input.message ? `
        <div style="margin:20px 0;">
          <h3 style="margin:0 0 8px;font-size:14px;color:#475569;">Message:</h3>
          <div style="background:#f8fafc;border-radius:8px;padding:12px 16px;font-size:14px;line-height:1.6;color:#334155;white-space:pre-wrap;">${escapeHtml(input.message)}</div>
        </div>
        ` : ''}

        ${totalsText && input.includeQuantities ? `
        <div style="margin:20px 0;">
          <h3 style="margin:0 0 8px;font-size:14px;color:#475569;">Takeoff Breakdown:</h3>
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead>
              <tr style="border-bottom:2px solid #e2e8f0;">
                <th style="padding:6px 12px 6px 0;text-align:left;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">Component</th>
                <th style="padding:6px 12px 6px 0;text-align:right;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">Raw Qty</th>
                <th style="padding:6px 12px 6px 0;text-align:right;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">With Waste</th>
                <th style="padding:6px 0;text-align:right;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">Material</th>
              </tr>
            </thead>
            <tbody>
              ${totalsText}
            </tbody>
            <tfoot>
              <tr style="border-top:2px solid #e2e8f0;">
                <td colspan="3" style="padding:8px 12px 8px 0;font-weight:600;color:#1e293b;text-align:right;">Total Materials:</td>
                <td style="padding:8px 0;font-weight:700;color:#1e293b;text-align:right;">${cur}${grandMaterial.toFixed(2)}</td>
              </tr>
              ${grandLabour > 0 ? `<tr><td colspan="3" style="padding:4px 12px 4px 0;font-weight:600;color:#1e293b;text-align:right;">Total Labour:</td><td style="padding:4px 0;font-weight:700;color:#1e293b;text-align:right;">${cur}${grandLabour.toFixed(2)}</td></tr>` : ''}
              <tr>
                <td colspan="3" style="padding:8px 12px 8px 0;font-weight:700;color:#0f172a;text-align:right;font-size:14px;">Grand Total:</td>
                <td style="padding:8px 0;font-weight:700;color:#0f172a;text-align:right;font-size:14px;">${cur}${grandTotal.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        ` : ''}

        ${input.resultUrl && input.includeResultLink ? `
        <div style="margin:20px 0;">
          <h3 style="margin:0 0 8px;font-size:14px;color:#475569;">Takeoff Result:</h3>
          <a href="${input.resultUrl}" style="display:inline-block;background:#FF6B35;color:#fff;text-decoration:none;padding:10px 20px;border-radius:9999px;font-size:13px;font-weight:500;">View Full Takeoff Result</a>
        </div>
        ` : ''}

        ${attachments.length > 0 ? `
        <div style="margin:20px 0;">
          <h3 style="margin:0 0 8px;font-size:14px;color:#475569;">Attachments (${attachments.length}):</h3>
          <p style="font-size:13px;color:#64748b;">See attached files with this email.</p>
        </div>
        ` : ''}

        <div style="margin:24px 0 0;padding-top:16px;border-top:1px solid #e2e8f0;">
          <p style="margin:0;font-size:12px;color:#94a3b8;">
            This enquiry was submitted via QuoteCore+ free roof takeoff builder.
            ${input.marketingConsent ? 'The sender has opted in to receive marketing communications.' : 'The sender has not opted in to marketing communications.'}
          </p>
          <p style="margin:8px 0 0;font-size:12px;color:#94a3b8;">
            Reply directly to this email to respond to ${input.senderName} at ${input.senderEmail}.
          </p>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  const textTotals = input.totals
    ? Object.entries(input.totals)
        .filter(([_, val]) => {
          if (typeof val === 'object' && val !== null) {
            return (val as any).count > 0;
          }
          return false;
        })
        .map(([key, val]) => {
          const v = val as any;
          const label = v.label || key;
          const unit = v.unit || '';
          const raw = v.rawTotal != null ? Number(v.rawTotal).toFixed(2) : '-';
          const waste = v.withWaste != null ? Number(v.withWaste).toFixed(2) : '-';
          const material = v.materialCost != null ? Number(v.materialCost).toFixed(2) : '0.00';
          return `${label}: ${raw} ${unit} (+${v.wastePercent || 0}% waste = ${waste} ${unit}) - Material: ${cur}${material}`;
        })
        .join('\n')
    : '';

  const text = `
New enquiry from QuoteCore+

Supplier: ${supplier.supplier_name}
From: ${input.senderName} <${input.senderEmail}>
${input.senderPhone ? `Phone: ${input.senderPhone}\n` : ''}Intent: ${intentLabels[input.intent] || input.intent}
${input.currency ? `Currency: ${input.currency}\n` : ''}
Message:
${input.message || '(no message)'}

${totalsText && input.includeQuantities ? `Takeoff Breakdown:\n${textTotals}\n\nTotal Materials: ${cur}${grandMaterial.toFixed(2)}\n${grandLabour > 0 ? `Total Labour: ${cur}${grandLabour.toFixed(2)}\n` : ''}Grand Total: ${cur}${grandTotal.toFixed(2)}\n` : ''}${input.includeResultLink && input.resultUrl ? `Takeoff Result: ${input.resultUrl}\n` : ''}${attachments.length > 0 ? `Attachments: ${attachments.length} file(s)\n` : ''}
---
This enquiry was submitted via QuoteCore+ free roof takeoff builder.
Reply directly to this email to respond to ${input.senderName} at ${input.senderEmail}.
  `.trim();

  // 6. Send email
  const emailResult = await sendEmail({
    to: supplier.enquiry_email,
    subject,
    html,
    text,
    replyTo: input.senderEmail,
    from: `"${input.senderName} via QuoteCore+" <noreply@quote-core.com>`,
    tags: [
      { name: 'type', value: 'supplier_enquiry' },
      { name: 'supplier', value: supplier.slug },
      { name: 'intent', value: input.intent },
    ],
    attachments: attachments.length > 0 ? attachments : undefined,
  });

  // 7. Update enquiry record with result
  if (emailResult.ok) {
    await sb
      .from('supplier_takeoff_enquiries')
      .update({
        delivery_status: 'sent',
        provider_id: emailResult.id,
        sent_at: new Date().toISOString(),
      })
      .eq('id', enquiryId);

    // Log attempt
    await sb
      .from('supplier_takeoff_enquiry_attempts')
      .insert({
        enquiry_id: enquiryId,
        attempt_number: 1,
        status: 'success',
        provider_id: emailResult.id,
      });
  } else {
    await sb
      .from('supplier_takeoff_enquiries')
      .update({
        delivery_status: 'failed',
        provider_error: emailResult.error,
      })
      .eq('id', enquiryId);

    await sb
      .from('supplier_takeoff_enquiry_attempts')
      .insert({
        enquiry_id: enquiryId,
        attempt_number: 1,
        status: 'failed',
        error: emailResult.error,
      });

    return { ok: false, error: emailResult.error, enquiryId };
  }

  return { ok: true, enquiryId };
}

/**
 * Upload an attachment file for a supplier enquiry.
 * Returns the file record ID for inclusion in the enquiry submission.
 */
export async function uploadEnquiryFile(
  fileName: string,
  fileContent: Buffer,
  contentType: string,
): Promise<{ ok: boolean; fileId?: string; error?: string }> {
  const sb = getSupabase();

  // Validate file type
  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(contentType)) {
    return { ok: false, error: 'File type not allowed. Accepted: PDF, JPG, PNG, WebP.' };
  }

  // Validate file size (10MB max)
  const maxSize = 10 * 1024 * 1024;
  if (fileContent.length > maxSize) {
    return { ok: false, error: 'File exceeds 10MB limit.' };
  }

  // Upload to storage
  const storagePath = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${fileName}`;
  const { error: uploadError } = await sb.storage
    .from('supplier-enquiry-files')
    .upload(storagePath, fileContent, {
      contentType,
      upsert: false,
    });

  if (uploadError) {
    return { ok: false, error: 'Failed to upload file' };
  }

  // Create a placeholder enquiry file record (linked to enquiry later)
  const { data: fileRecord, error: dbError } = await sb
    .from('supplier_takeoff_enquiry_files')
    .insert({
      enquiry_id: '00000000-0000-0000-0000-000000000000', // placeholder, updated when enquiry is created
      filename: fileName,
      storage_path: storagePath,
      content_type: contentType,
      size_bytes: fileContent.length,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select('id')
    .single();

  if (dbError || !fileRecord) {
    // Clean up uploaded file
    await sb.storage.from('supplier-enquiry-files').remove([storagePath]);
    return { ok: false, error: 'Failed to create file record' };
  }

  return { ok: true, fileId: fileRecord.id };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
