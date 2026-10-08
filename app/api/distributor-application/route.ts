import { NextRequest, NextResponse } from "next/server";

const RESEND_API_KEY = process.env.RESEND_API_KEY;

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function clean(val: unknown, max = 2000): string {
  if (typeof val !== "string") return "";
  return val.trim().slice(0, max);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Honeypot: silently accept bot submissions
  if (clean(body.company_website, 500)) {
    return NextResponse.json({ ok: true });
  }

  const name = clean(body.name, 200);
  const email = clean(body.email, 320).toLowerCase();
  const promotionMethods = Array.isArray(body.promotion_methods)
    ? body.promotion_methods.filter((m): m is string => typeof m === "string").slice(0, 20).map((m) => clean(m, 100)).filter(Boolean)
    : [];
  const audienceRange = clean(body.audience_range, 100);
  let link = clean(body.link, 500);
  if (link && !/^https?:\/\//i.test(link)) {
    link = `https://${link}`;
  }
  const customDeal = body.custom_deal === true;
  const message = clean(body.message, 5000);

  if (!name) {
    return NextResponse.json({ error: "Name, channel or business is required" }, { status: 400 });
  }
  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }
  if (promotionMethods.length === 0) {
    return NextResponse.json({ error: "Select at least one promotion method" }, { status: 400 });
  }

  if (RESEND_API_KEY) {
    const notificationHtml = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <h2 style="color:#111;margin-bottom:4px;">New partner/distributor application</h2>
        <p style="color:#666;margin-top:0;font-size:14px;">Received via quote-core.com/distributors</p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0;">
          <tr><td style="padding:8px 0;font-weight:700;width:160px;color:#333;">Name / channel / business</td><td style="padding:8px 0;color:#111;">${escapeHtml(name)}</td></tr>
          <tr><td style="padding:8px 0;font-weight:700;color:#333;">Email</td><td style="padding:8px 0;"><a href="mailto:${escapeHtml(email)}" style="color:#FF6B35;">${escapeHtml(email)}</a></td></tr>
          <tr><td style="padding:8px 0;font-weight:700;color:#333;">Promotion methods</td><td style="padding:8px 0;color:#111;">${promotionMethods.map(escapeHtml).join(", ")}</td></tr>
          <tr><td style="padding:8px 0;font-weight:700;color:#333;">Audience / reach</td><td style="padding:8px 0;color:#111;">${audienceRange ? escapeHtml(audienceRange) : "—"}</td></tr>
          <tr><td style="padding:8px 0;font-weight:700;color:#333;">Link</td><td style="padding:8px 0;">${link ? `<a href="${escapeHtml(link)}" target="_blank" style="color:#FF6B35;">${escapeHtml(link)}</a>` : "—"}</td></tr>
          <tr><td style="padding:8px 0;font-weight:700;color:#333;">Custom deal requested</td><td style="padding:8px 0;color:#111;">${customDeal ? "<strong style=\"color:#FF6B35;\">YES — review for bespoke terms</strong>" : "No"}</td></tr>
        </table>
        ${message ? `
        <div style="background:#f8f8f8;border-radius:8px;padding:16px;">
          <p style="font-weight:700;margin:0 0 8px;color:#333;">Additional message</p>
          <p style="margin:0;color:#111;white-space:pre-wrap;line-height:1.6;">${escapeHtml(message)}</p>
        </div>
        ` : ""}
      </div>
    `;

    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "QuoteCore+ <info@quote-core.com>",
          to: ["info@quote-core.com"],
          reply_to: email,
          subject: `New partner application: ${name}${customDeal ? " [CUSTOM DEAL]" : ""}`,
          html: notificationHtml,
        }),
      });
    } catch (err) {
      console.error("Resend error:", err);
      // Still return ok — the applicant did their part; we get the retry signal from logs.
    }
  } else {
    console.warn("RESEND_API_KEY not set — distributor application not emailed:", { name, email });
  }

  return NextResponse.json({ ok: true });
}
