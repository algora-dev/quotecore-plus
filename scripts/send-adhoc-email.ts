/**
 * Ad-hoc email sender (manual, one-off sends).
 *
 * Usage:
 *   PREVIEW (default - renders + prints email, NEVER sends):
 *     npx tsx scripts/send-adhoc-email.ts --preview
 *   TEST (sends ONLY to the configured test addresses, never the real recipient):
 *     npx tsx scripts/send-adhoc-email.ts --test
 *   SEND (sends ONLY the approved version to the real recipient):
 *     npx tsx scripts/send-adhoc-email.ts --send --to real@recipient.com
 *
 * Data is read from a simple JSON file (`--input ./emails/foo.json`) so the
 * content/mode is explicit and auditable. Nothing campaign-specific is
 * hardcoded.
 *
 * Modes are mutually exclusive. Default mode is PREVIEW.
 * Authorized send modes (--test / --send) require the matching flag - a
 * bare invocation never sends.
 *
 * Env needs: RESEND_API_KEY (from the QuoteCore+ Vercel project).
 */

import 'dotenv/config';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { renderAdhocEmail, type AdhocEmailInput } from '../app/lib/email/templates/adhoc';
import { sendEmail } from '../app/lib/email/send';

/**
 * Test recipients for --test mode. Both kept so we can eyeball the preview
 * difference across Gmail and Outlook/Hotmail rendering. Override with
 * --testTo <addr> to send to a single address if preferred.
 */
const DEFAULT_TEST_TO = ['cececarson1993@gmail.com', 'cece.carson1@hotmail.com'];

function parseArgs(): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--preview') out.preview = true;
    else if (a === '--test') out.test = true;
    else if (a === '--send') out.send = true;
    else if (a === '--to') out.to = argv[++i];
    else if (a === '--testTo') out.testTo = argv[++i];
    else if (a === '--input') out.input = argv[++i];
    else throw new Error(`Unknown arg: ${a}`);
  }
  return out;
}

async function main() {
  const args = parseArgs();
  const inputPath = args.input ? resolve(args.input as string) : resolve(__dirname, '../emails/adhoc-sample.json');
  const input = JSON.parse(readFileSync(inputPath, 'utf8')) as AdhocEmailInput;

  // Validate
  if (!input.firstName || !input.subject || !input.heading || !input.ctaLabel || !input.ctaUrl) {
    throw new Error('Missing required email fields (firstName, subject, heading, ctaLabel, ctaUrl).');
  }
  if (!input.body && !input.bodyHtml) {
    throw new Error('Provide either body or bodyHtml.');
  }

  const { subject, html, text } = renderAdhocEmail(input);

  const modes = [args.preview ? 'preview' : null, args.test ? 'test' : null, args.send ? 'send' : null].filter(Boolean);
  if (modes.length > 1) throw new Error('Choose only one of --preview / --test / --send.');

  const mode = (args.send ? 'send' : args.test ? 'test' : 'preview') as 'preview' | 'test' | 'send';

  // Recipient is resolved only in active send modes.
  let sendRecipient: string | null = null;
  let sendRecipients: string[] = [];
  if (mode === 'test') {
    sendRecipients = args.testTo ? [args.testTo as string] : DEFAULT_TEST_TO;
  } else if (mode === 'send') {
    if (!args.to) throw new Error('--send requires --to <real recipient email>');
    sendRecipients = [args.to as string];
  }

  console.log(`\n========== AD-HOC EMAIL (${mode.toUpperCase()} MODE) ==========`);
  console.log(`Subject: ${subject}`);
  if (mode !== 'preview') console.log(`To:      ${sendRecipient}`);
  console.log('--------------------------------------------------------');
  console.log(`\n[PLAIN TEXT PREVIEW]\n${text}\n`);
  console.log(`[HTML LENGTH] ${html.length} chars`);
  console.log('[HTML PREVIEW - first 600 chars]');
  console.log(html.slice(0, 600) + '...');
  console.log('--------------------------------------------------------');

  if (mode === 'preview') {
    console.log('PREVIEW ONLY - nothing sent. Say "send a test" to test, or "send it" to release.');
    return;
  }

  if (sendRecipient) {
    const result = await sendEmail({ to: sendRecipient, subject, html, text });
    if (result.ok) {
      console.log(`SENT (${mode}) -> ${sendRecipient} | Resend id: ${result.id}`);
    } else {
      console.error(`SEND FAILED (${mode}) -> ${result.error}`);
      process.exitCode = 1;
    }
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exitCode = 1;
});
