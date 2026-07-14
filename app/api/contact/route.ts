import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function clean(val: unknown, max = 2000): string {
  if (typeof val !== "string") return "";
  return val.trim().slice(0, max);
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = clean(body.name, 200);
  const email = clean(body.email, 320).toLowerCase();
  const message = clean(body.message, 5000);
  const company = clean(body.company, 200);
  const subject = clean(body.subject, 300);

  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!email || !isValidEmail(email)) return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  if (!message) return NextResponse.json({ error: "Message is required" }, { status: 400 });

  // 1. Save to Supabase
  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const sbRes = await fetch(`${SUPABASE_URL}/rest/v1/contact_enquiries`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          name,
          email,
          company: company || null,
          subject: subject || null,
          message,
          created_at: new Date().toISOString(),
          source: "quotecore-contact-form",
        }),
      });
      if (!sbRes.ok) {
        const t = await sbRes.text();
        console.error("Supabase insert failed:", sbRes.status, t);
      }
    } catch (err) {
      console.error("Supabase save error:", err);
    }
  } else {
    console.info("Contact enquiry received without Supabase configured", {
      name,
      email,
      company,
      subject,
    });
  }

  // 2. Send emails via Resend
  if (RESEND_API_KEY) {
    const teamHtml = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <h2 style="color:#111;margin-bottom:4px;">New contact enquiry</h2>
        <p style="color:#666;margin-top:0;font-size:14px;">Received via quote-core.com/contact</p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0;">
          <tr><td style="padding:8px 0;font-weight:700;width:100px;color:#333;">Name</td><td style="padding:8px 0;color:#111;">${name}</td></tr>
          <tr><td style="padding:8px 0;font-weight:700;color:#333;">Email</td><td style="padding:8px 0;"><a href="mailto:${email}" style="color:#FF6B35;">${email}</a></td></tr>
          ${company ? `<tr><td style="padding:8px 0;font-weight:700;color:#333;">Company</td><td style="padding:8px 0;color:#111;">${company}</td></tr>` : ""}
          ${subject ? `<tr><td style="padding:8px 0;font-weight:700;color:#333;">Subject</td><td style="padding:8px 0;color:#111;">${subject}</td></tr>` : ""}
        </table>
        <div style="background:#f8f8f8;border-radius:8px;padding:16px;">
          <p style="font-weight:700;margin:0 0 8px;color:#333;">Message</p>
          <p style="margin:0;color:#111;white-space:pre-wrap;line-height:1.6;">${message}</p>
        </div>
        <p style="margin-top:24px;font-size:13px;color:#999;">Reply directly to this email to respond to ${name}.</p>
      </div>
    `;

    const senderHtml = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <img src="https://quote-core.com/MainQCP.png" alt="QuoteCore+" style="height:36px;margin-bottom:24px;" />
        <h2 style="color:#111;margin-bottom:8px;">We've got your message, ${name}.</h2>
        <p style="color:#444;line-height:1.6;">Thanks for getting in touch. We'll reply within 24 hours - usually much sooner.</p>
        <div style="background:#f8f8f8;border-radius:8px;padding:16px;margin:24px 0;">
          <p style="font-weight:700;margin:0 0 8px;color:#333;font-size:13px;text-transform:uppercase;letter-spacing:0.05em;">Your message</p>
          <p style="margin:0;color:#555;white-space:pre-wrap;line-height:1.6;font-size:15px;">${message}</p>
        </div>
        <p style="color:#444;line-height:1.6;">If you'd prefer to jump on a quick call, you can <a href="https://calendly.com/quote-core-info/15-minute-meeting" style="color:#FF6B35;">book a free 15-minute chat here</a>.</p>
        <p style="color:#444;line-height:1.6;margin-top:24px;">Talk soon,<br/><strong>The QuoteCore+ team</strong></p>
        <hr style="border:none;border-top:1px solid #eee;margin:32px 0;" />
        <p style="font-size:12px;color:#999;margin:0;">QuoteCore+ - quoting software for contractors and trade businesses.<br/><a href="https://quote-core.com" style="color:#999;">quote-core.com</a></p>
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
          subject: `New enquiry from ${name}${subject ? ` - ${subject}` : ""}`,
          html: teamHtml,
        }),
      });
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "QuoteCore+ <info@quote-core.com>",
          to: [email],
          subject: "We've received your message - QuoteCore+",
          html: senderHtml,
        }),
      });
    } catch (err) {
      console.error("Resend error:", err);
    }
  }

  return NextResponse.json({ ok: true });
}
