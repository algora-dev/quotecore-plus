import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Types ──────────────────────────────────────────────

interface ParseRequest {
  type: 'quote' | 'order' | 'invoice';
  mode: 'text' | 'image';
  content?: string;
  image?: string; // base64 data URL or raw base64
  imageMime?: string;
}

interface ParsedLine {
  description: string;
  qty: number;
  unit: string;
  rate: number;
}

interface ParsedDocument {
  companyName: string;
  clientName: string;
  clientEmail: string;
  clientAddress: string;
  quoteDate: string;
  validDays: string;
  notes: string;
  lines: ParsedLine[];
  confidence: 'high' | 'medium' | 'low';
  warnings: string[];
}

// ── Limits ─────────────────────────────────────────────

const MAX_TEXT_LENGTH = 10_000;
const MAX_IMAGE_BASE64_BYTES = 4 * 1024 * 1024;
const MAX_CONTENT_LENGTH_BYTES = 6 * 1024 * 1024;

// ── Magic byte validation ──────────────────────────────

const MAGIC_BYTES: { mime: string; bytes: number[] }[] = [
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46] },
];

function detectImageMime(base64Data: string): string | null {
  try {
    const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64.substring(0, 32), 'base64');
    for (const { mime, bytes } of MAGIC_BYTES) {
      if (bytes.every((byte, i) => buffer[i] === byte)) {
        if (mime === 'image/webp') {
          if (buffer.slice(8, 12).toString('ascii') !== 'WEBP') continue;
        }
        return mime;
      }
    }
    return null;
  } catch {
    return null;
  }
}

// ── System prompt ──────────────────────────────────────

function buildSystemPrompt(type: string): string {
  const typeContext =
    type === 'quote'
      ? 'a quote (pricing estimate given to a customer before work starts)'
      : type === 'order'
        ? 'a purchase order / material order (items being ordered from a supplier)'
        : 'an invoice (bill for work completed or goods delivered)';

  return `You are a document parser for construction/trades ${typeContext}.

You will receive either:
- A TEXT description of the document content, OR
- An IMAGE (photo or screenshot) of a document — possibly handwritten.

Your job: extract the structured data and return it as JSON.

## Output schema (return ONLY valid JSON, no markdown fences)
{
  "companyName": "",
  "clientName": "",
  "clientEmail": "",
  "clientAddress": "",
  "quoteDate": "",
  "validDays": "30",
  "notes": "",
  "lines": [
    { "description": "", "qty": 1, "unit": "", "rate": 0 }
  ],
  "confidence": "high|medium|low",
  "warnings": []
}

## Rules
- "lines" = every distinct chargeable item, material, or service line you can identify.
- "description" = the item name or description (clean up formatting but preserve meaning).
- "qty" = numeric quantity (default 1 if not stated).
- "unit" = unit of measure (e.g. "m²", "m", "pcs", "hrs", "days", "pack"). If not stated, use "".
- "rate" = price per unit as a number (e.g. 25.50). If only a line total is given and qty > 1, divide. If qty is 1, rate = line total.
- "companyName" = the business issuing the document. For orders this might be the supplier.
- "clientName" = the recipient/customer. For orders this might be the buyer.
- "quoteDate" = date on the document (YYYY-MM-DD format). If not found, leave empty.
- "validDays" = how long the quote is valid (default "30" for quotes, empty for orders/invoices).
- "notes" = any terms, conditions, payment notes, or general notes visible on the document.
- "confidence" = how confident you are in the extraction: "high" = clear document, all fields readable; "medium" = some fields unclear; "low" = difficult to read, possible errors.
- "warnings" = list any issues (e.g. "Some text was illegible", "No prices found", "Date format unclear").

## Important
- If the document is handwritten, do your best to read it. Flag low confidence if unsure.
- If you cannot find a field, return an empty string (not null).
- If no lines can be extracted, return an empty lines array and add a warning.
- Return ONLY the JSON object. No preamble, no markdown code fences.`;
}

// ── Route handler ──────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. Authentication — require a valid Supabase session
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  // 2. Early size guard
  const contentLength = parseInt(req.headers.get('content-length') || '0', 10);
  if (contentLength > MAX_CONTENT_LENGTH_BYTES) {
    return NextResponse.json(
      { error: 'Request too large. Maximum file size is 4MB.' },
      { status: 413 }
    );
  }

  // 3. Parse body
  let body: ParseRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { type, mode, content, image } = body;

  // 4. Validate fields
  if (!type || !['quote', 'order', 'invoice'].includes(type)) {
    return NextResponse.json({ error: 'Invalid or missing "type"' }, { status: 400 });
  }

  if (mode === 'text') {
    if (!content?.trim()) {
      return NextResponse.json({ error: 'Missing "content" for text mode' }, { status: 400 });
    }
    if (content.length > MAX_TEXT_LENGTH) {
      return NextResponse.json(
        { error: `Text too long. Maximum ${MAX_TEXT_LENGTH.toLocaleString()} characters.` },
        { status: 413 }
      );
    }
  } else if (mode === 'image') {
    if (!image) {
      return NextResponse.json({ error: 'Missing "image" for image mode' }, { status: 400 });
    }
    if (image.length > MAX_IMAGE_BASE64_BYTES) {
      return NextResponse.json({ error: 'Image too large. Maximum 4MB.' }, { status: 413 });
    }
    const detectedMime = detectImageMime(image);
    if (!detectedMime) {
      return NextResponse.json(
        { error: 'Invalid image format. Please upload a PNG, JPEG, or WebP image.' },
        { status: 415 }
      );
    }
  } else {
    return NextResponse.json({ error: 'Invalid or missing "mode"' }, { status: 400 });
  }

  // 5. Build OpenAI messages
  const systemPrompt = buildSystemPrompt(type);
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
  ];

  if (mode === 'text') {
    messages.push({
      role: 'user',
      content: `Please parse this ${type} information:\n\n${content}`,
    });
  } else {
    let imageUrl: string = image!;
    if (!imageUrl.startsWith('data:')) {
      const detectedMime = detectImageMime(imageUrl)!;
      imageUrl = `data:${detectedMime};base64,${imageUrl}`;
    } else {
      const detectedMime = detectImageMime(imageUrl);
      if (detectedMime) {
        imageUrl = imageUrl.replace(/^data:[^;]+;base64,/, `data:${detectedMime};base64,`);
      }
    }
    messages.push({
      role: 'user',
      content: [
        {
          type: 'text',
          text: `Please parse this ${type} document image. Extract all visible line items, prices, quantities, business/client details, dates, and notes.`,
        },
        {
          type: 'image_url',
          image_url: { url: imageUrl, detail: 'high' },
        } as OpenAI.Chat.Completions.ChatCompletionContentPart,
      ],
    });
  }

  // 6. Call OpenAI
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 2000,
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return NextResponse.json({ error: 'No response from AI model' }, { status: 500 });
    }

    let parsed: ParsedDocument;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: 'AI returned invalid JSON' }, { status: 500 });
    }

    parsed.lines = (parsed.lines || []).map((l, i) => ({
      description: l.description || `Line ${i + 1}`,
      qty: typeof l.qty === 'number' && l.qty > 0 ? l.qty : 1,
      unit: l.unit || '',
      rate: typeof l.rate === 'number' && !isNaN(l.rate) ? l.rate : 0,
    }));

    return NextResponse.json(parsed);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[app/parse-document] OpenAI error:', message);
    return NextResponse.json(
      { error: 'Failed to process document. Please try again or enter details manually.' },
      { status: 500 }
    );
  }
}
