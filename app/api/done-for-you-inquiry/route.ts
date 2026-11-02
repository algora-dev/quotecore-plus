import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/app/lib/email/send';
import { checkRateLimit, getClientIP } from '@/app/lib/security/rateLimit';

const INBOX = 'info@quote-core.com';
const MEASUREMENT = new Set(['on-site','printed-plans','digital-plans','aerial','supplied','varies','other']);
const PRICING = new Set(['spreadsheet','supplier-lists','estimating-app','business-software','notes','memory','other']);
const QUOTE_VOLUME = new Set(['Up to 10','11–30','31–100','100+']);
const COMPONENT_COUNT = new Set(['Up to 10','11–20','21–50','51–100','100+']);
const HANDOVER = new Set(['live','recorded','either','unsure']);

const measurementLabels: Record<string,string> = {
  'on-site':'Measure on site','printed-plans':'Print plans and measure manually','digital-plans':'Measure digitally from PDFs or plans',
  aerial:'Use satellite or aerial measurements',supplied:'Measurements are supplied to us',varies:'It varies by job',other:'Something else',
};
const pricingLabels: Record<string,string> = {
  spreadsheet:'Spreadsheet','supplier-lists':'Supplier price lists or PDFs','estimating-app':'Another quoting or estimating app',
  'business-software':'Job management or accounting software',notes:'Written price book or notes',memory:'Mostly in my head',other:'Something else',
};
const handoverLabels: Record<string,string> = {
  live:'Live one-to-one',recorded:'Personalised recorded walkthrough',either:'Either works',unsure:'Not sure yet',
};

function clean(value: unknown, max = 2000) { return typeof value === 'string' ? value.trim().slice(0,max) : ''; }
function cleanList(value: unknown, allowed: Set<string>) { return Array.isArray(value) ? [...new Set(value.filter((v): v is string => typeof v === 'string' && allowed.has(v)))].slice(0,12) : []; }
function validEmail(value: string) { return /^\S+@\S+\.\S+$/.test(value); }
function escapeHtml(value: string) { return value.replace(/[&<>'"]/g,(char)=>({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' })[char] || char); }
function normalizeWebsite(value: string) {
  if (!value) return '';
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return ['http:','https:'].includes(url.protocol) ? url.href.slice(0,500) : '';
  } catch { return ''; }
}

export async function POST(req: NextRequest) {
  const ip = getClientIP(req.headers);
  if (!await checkRateLimit(`dfy-inquiry:${ip}`, 6, 60 * 60 * 1000)) {
    return NextResponse.json({ error:'Too many enquiries. Please try again later.' }, { status:429 });
  }

  let body: Record<string,unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error:'Invalid request.' }, { status:400 }); }

  const measurementMethods = cleanList(body.measurementMethods, MEASUREMENT);
  const pricingSources = cleanList(body.pricingSources, PRICING);
  const measurementOther = clean(body.measurementOther, 1200);
  const pricingOther = clean(body.pricingOther, 1200);
  const quoteVolume = clean(body.quoteVolume, 20);
  const componentCount = clean(body.componentCount, 30);
  const handover = clean(body.handover, 20);
  const notes = clean(body.notes, 2500);
  const name = clean(body.name, 160);
  const email = clean(body.email, 320).toLowerCase();
  const businessName = clean(body.businessName, 220);
  const website = normalizeWebsite(clean(body.website, 500));

  if (!name) return NextResponse.json({ error:'Your name is required.' }, { status:400 });
  if (!email || !validEmail(email)) return NextResponse.json({ error:'Enter a valid email address.' }, { status:400 });
  if (!measurementMethods.length || (measurementMethods.includes('other') && !measurementOther)) return NextResponse.json({ error:'Tell us how you usually measure jobs.' }, { status:400 });
  if (!pricingSources.length || (pricingSources.includes('other') && !pricingOther)) return NextResponse.json({ error:'Tell us where your pricing lives today.' }, { status:400 });
  if (!QUOTE_VOLUME.has(quoteVolume) || !COMPONENT_COUNT.has(componentCount) || !HANDOVER.has(handover)) {
    return NextResponse.json({ error:'Complete the quote volume, pricing element and handover questions.' }, { status:400 });
  }

  const measurementText = measurementMethods.map((v)=>measurementLabels[v]).join(', ') + (measurementOther ? `\nOther measurement details: ${measurementOther}` : '');
  const pricingText = pricingSources.map((v)=>pricingLabels[v]).join(', ') + (pricingOther ? `\nOther pricing details: ${pricingOther}` : '');
  const handoverText = handoverLabels[handover];
  const rows: Array<[string,string]> = [
    ['Name',name],
    ['Email',email],
    ['Business name',businessName || 'Not provided'],
    ['Website',website || 'Not provided'],
    ['How do you usually get the measurements for a job?',measurementText],
    ['Where does your pricing live today?',pricingText],
    ['How many quotes do you usually send each week?',quoteVolume],
    ['How many different pricing elements do you currently use?',componentCount],
    ['How would you prefer Shaun to show you your finished setup?',handoverText],
    ['Anything else Shaun should know?',notes || 'None'],
  ];

  const teamHtml = `<div style="font-family:Arial,sans-serif;max-width:720px;margin:0 auto;padding:24px;color:#191B20">
    <h2 style="margin:0 0 4px">New Done For You enquiry</h2>
    <p style="margin:0 0 22px;color:#596273">Submitted through the 60-second Done For You enquiry form.</p>
    <table style="width:100%;border-collapse:collapse">${rows.map(([label,value])=>`<tr><td style="width:255px;padding:11px 14px 11px 0;border-bottom:1px solid #e5e8ed;font-weight:700;vertical-align:top">${escapeHtml(label)}</td><td style="padding:11px 0;border-bottom:1px solid #e5e8ed;white-space:pre-wrap;line-height:1.5">${escapeHtml(value)}</td></tr>`).join('')}</table>
    <p style="margin-top:22px;color:#596273;font-size:13px">Reply directly to this email to respond to ${escapeHtml(name)} at ${escapeHtml(email)}.</p>
  </div>`;
  const teamText = `New Done For You enquiry\n\n${rows.map(([label,value])=>`${label}\n${value}`).join('\n\n')}`;

  const result = await sendEmail({
    to: INBOX,
    subject: `Done For You enquiry: ${businessName || name}`,
    html: teamHtml,
    text: teamText,
    replyTo: email,
    tags: [{ name:'type', value:'dfy-inquiry' }],
  });

  if (!result.ok) {
    return NextResponse.json({ error:'We could not send your enquiry right now. Please try again or book a call with Shaun.' }, { status:503 });
  }
  return NextResponse.json({ ok:true });
}
