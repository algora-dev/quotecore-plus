'use server';
import { createAdminClient } from '@/app/lib/supabase/admin';

// Validate token format (must be a UUID)
function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

export async function respondToQuote(token: string, action: 'accept' | 'decline') {
  // Input validation
  if (!token || !isValidUUID(token)) {
    throw new Error('Invalid link');
  }
  if (action !== 'accept' && action !== 'decline') {
    throw new Error('Invalid action');
  }

  const supabase = createAdminClient();

  // Load quote by token — select ONLY needed fields
  const { data: quote, error: fetchErr } = await supabase
    .from('quotes')
    .select('id, company_id, customer_name, quote_number, accepted_at, declined_at, acceptance_token_expires_at')
    .eq('acceptance_token', token)
    .single();

  if (fetchErr || !quote) throw new Error('Quote not found');
  if (quote.accepted_at || quote.declined_at) throw new Error('This quote has already been responded to');

  // Check token expiry
  if ((quote as any).acceptance_token_expires_at && new Date((quote as any).acceptance_token_expires_at) < new Date()) {
    throw new Error('This link has expired. Please contact the sender for a new link.');
  }

  const now = new Date().toISOString();
  const isAccept = action === 'accept';

  // Update quote — double-check token matches (prevents parameter manipulation)
  const { error } = await supabase
    .from('quotes')
    .update(isAccept
      ? { accepted_at: now, job_status: 'accepted' }
      : { declined_at: now, job_status: 'declined' }
    )
    .eq('id', quote.id)
    .eq('acceptance_token', token); // Double verification

  if (error) throw new Error('Failed to process response');

  // Create alert (scoped to the quote's company)
  await supabase.from('alerts').insert({
    company_id: quote.company_id,
    quote_id: quote.id,
    alert_type: isAccept ? 'quote_accepted' : 'quote_declined',
    title: `Quote #${quote.quote_number} ${isAccept ? 'Accepted' : 'Declined'}`,
    message: `${quote.customer_name} has ${isAccept ? 'accepted' : 'declined'} Quote #${quote.quote_number}.`,
  });
}
