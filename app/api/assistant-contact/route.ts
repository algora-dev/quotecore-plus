import { NextRequest, NextResponse } from "next/server";

function clean(value: unknown, max = 2000) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(value: string) {
  return value
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
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const name = clean(body.name, 200);
  const email = clean(body.email, 320).toLowerCase();
  const message = clean(body.message, 5000);
  const source = clean(body.source, 100) || "site-assistant";
  const pageUrl = clean(body.pageUrl, 1000);
  const timestamp = clean(body.timestamp, 100) || new Date().toISOString();

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  if (!message) {
    return NextResponse.json({ error: "Please enter a short message." }, { status: 400 });
  }

  const resendApiKey = process.env.RESEND_API_KEY;

  if (resendApiKey) {
    const safeName = escapeHtml(name || "Website visitor");
    const safeEmail = escapeHtml(email);
    const safeMessage = escapeHtml(message);
    const safePageUrl = escapeHtml(pageUrl);
    const safeSource = escapeHtml(source);
    const safeTimestamp = escapeHtml(timestamp);

    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "QuoteCore+ <info@quote-core.com>",
          to: ["info@quote-core.com"],
          reply_to: email,
          subject: `Website assistant message from ${name || email}`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;padding:24px;">
              <h2 style="margin:0 0 8px;color:#111;">New website assistant message</h2>
              <p style="margin:0 0 20px;color:#666;font-size:14px;">Source: ${safeSource}</p>
              <table style="width:100%;border-collapse:collapse;margin:0 0 20px;">
                <tr><td style="padding:6px 0;font-weight:700;width:120px;">Name/company</td><td>${safeName}</td></tr>
                <tr><td style="padding:6px 0;font-weight:700;">Email</td><td><a href="mailto:${safeEmail}" style="color:#FF6B35;">${safeEmail}</a></td></tr>
                <tr><td style="padding:6px 0;font-weight:700;">Page</td><td>${safePageUrl || "Not supplied"}</td></tr>
                <tr><td style="padding:6px 0;font-weight:700;">Time</td><td>${safeTimestamp}</td></tr>
              </table>
              <div style="background:#f7f7f7;border-radius:12px;padding:16px;">
                <p style="margin:0 0 8px;font-weight:700;color:#333;">Message</p>
                <p style="white-space:pre-wrap;line-height:1.6;margin:0;color:#111;">${safeMessage}</p>
              </div>
            </div>
          `,
        }),
      });
    } catch (error) {
      console.error("Assistant contact email failed:", error);
      return NextResponse.json({ error: "We could not send that just now. Please try again." }, { status: 500 });
    }
  } else {
    // Email is intentionally server-side only. Add RESEND_API_KEY in production
    // to enable delivery, or connect this route to Supabase/another CRM here.
    console.info("Assistant contact received without RESEND_API_KEY configured", {
      name,
      email,
      message,
      source,
      pageUrl,
      timestamp,
    });
  }

  return NextResponse.json({ ok: true });
}
