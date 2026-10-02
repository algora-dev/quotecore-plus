import { NextResponse } from 'next/server';
import { sendEmail } from '@/app/lib/email/send';
import { getFreeScanServiceClient } from '@/app/lib/free-tools/aiScanGate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Hourly budget watch for the free-tool AI scan gate (2026-10-02, Darren).
 *
 * Reads today's free_ai_scan_global row and, once per day each:
 *   - at >= warn threshold (FREE_AI_SCAN_WARN_PCT, default 70%): sends a
 *     "getting close to the cap" warning email (Shaun's ask: warning first,
 *     so he can top up the OpenAI account or flip the kill switch)
 *   - at >= cap: sends a "cap reached - free tool degraded to manual-only"
 *     alert email
 *
 * Recipient: FREE_AI_SCAN_ALERT_EMAIL env. If unset, flags still flip (no
 * repeat attempts) and status is readable from this endpoint's response.
 * The scan route's atomic admission check remains the source of truth for
 * actual enforcement - this cron only notifies.
 */

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function emailBody(scans: number, cap: number, capped: boolean): { html: string; text: string } {
  const headline = capped
    ? 'Free-tool AI scans: daily cap reached'
    : 'Free-tool AI scans: approaching daily cap';
  const status = capped
    ? `The cap of ${cap} scans has been hit. The free roof takeoff has automatically degraded to manual-only measurement until UTC midnight.`
    : `${scans} of ${cap} free AI scans used today. When the cap is hit, the free tool automatically degrades to manual-only until UTC midnight.`;
  const actions = `
    <ul>
      <li>Top up the OpenAI account if you want more headroom</li>
      <li>Raise/lower the cap: set <code>FREE_AI_SCAN_GLOBAL_DAILY</code> in Vercel env (no redeploy needed - the cap refreshes on every admission)</li>
      <li>Turn AI off for the free tool entirely: set <code>FREE_AI_SCAN_ENABLED=false</code> and redeploy</li>
      <li>Warnings go to: <code>FREE_AI_SCAN_ALERT_EMAIL</code></li>
    </ul>`;
  return {
    html: `<div style="font-family:system-ui,sans-serif;max-width:560px"><h2 style="margin:0 0 12px">${headline}</h2><p>${status}</p>${actions}<p style="color:#64748b;font-size:12px">Usage detail: free_tool_usage table, tool_code='roof-takeoff'.</p></div>`,
    text: `${headline}\n\n${status}\n\nActions: top up OpenAI; adjust FREE_AI_SCAN_GLOBAL_DAILY; disable with FREE_AI_SCAN_ENABLED=false + redeploy.`,
  };
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[cron/free-ai-scan-budget] CRON_SECRET is not configured');
    return NextResponse.json({ error: 'cron_not_configured' }, { status: 500 });
  }
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const client = getFreeScanServiceClient();
  if (!client) {
    console.error('[cron/free-ai-scan-budget] missing Supabase env');
    return NextResponse.json({ error: 'not_configured' }, { status: 500 });
  }

  const { data, error } = await client
    .from('free_ai_scan_global')
    .select('day, scans, cap_scans, warn_sent, capped_alert_sent')
    .eq('day', todayUtc())
    .maybeSingle();
  if (error) {
    console.error('[cron/free-ai-scan-budget] read failed:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ status: 'ok', scans: 0, cap: null, alerted: false });
  }

  const row = data as { day: string; scans: number; cap_scans: number; warn_sent: boolean; capped_alert_sent: boolean };
  const cap = row.cap_scans;
  const warnPct = Number(process.env.FREE_AI_SCAN_WARN_PCT) || 70;
  const warnAt = Math.ceil((cap * warnPct) / 100);
  const to = process.env.FREE_AI_SCAN_ALERT_EMAIL || null;

  if (row.scans >= cap && !row.capped_alert_sent) {
    const body = emailBody(row.scans, cap, true);
    if (to) {
      await sendEmail({
        to,
        subject: `Free AI scan daily cap reached (${row.scans}/${cap})`,
        html: body.html,
        text: body.text,
        tags: [{ name: 'kind', value: 'free-ai-scan-budget' }],
      });
    }
    await client.from('free_ai_scan_global').update({ capped_alert_sent: true }).eq('day', row.day);
    return NextResponse.json({ status: 'capped', scans: row.scans, cap, alerted: !!to });
  }

  if (row.scans >= warnAt && !row.warn_sent) {
    const body = emailBody(row.scans, cap, false);
    if (to) {
      await sendEmail({
        to,
        subject: `Free AI scan usage at ${row.scans}/${cap} today`,
        html: body.html,
        text: body.text,
        tags: [{ name: 'kind', value: 'free-ai-scan-budget' }],
      });
    }
    await client.from('free_ai_scan_global').update({ warn_sent: true }).eq('day', row.day);
    return NextResponse.json({ status: 'warn', scans: row.scans, cap, alerted: !!to });
  }

  return NextResponse.json({
    status: row.scans >= cap ? 'capped' : row.scans >= warnAt ? 'warn' : 'ok',
    scans: row.scans,
    cap,
    alerted: false,
  });
}
