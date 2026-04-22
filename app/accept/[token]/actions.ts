'use server';
import { createAdminClient } from '@/app/lib/supabase/admin';

export async function respondToQuote(token: string, action: 'accept' | 'decline') {
  const supabase = createAdminClient();

  // Load quote by token
  const { data: quote, error: fetchErr } = await supabase
    .from('quotes')
    .select('id, company_id, customer_name, quote_number, accepted_at, declined_at')
    .eq('acceptance_token', token)
    .single();

  if (fetchErr || !quote) throw new Error('Quote not found');
  if (quote.accepted_at || quote.declined_at) throw new Error('Quote already responded to');

  const now = new Date().toISOString();

  if (action === 'accept') {
    // Update quote
    const { error } = await supabase
      .from('quotes')
      .update({ accepted_at: now, job_status: 'accepted' })
      .eq('id', quote.id);
    if (error) throw new Error(error.message);

    // Create alert
    await supabase.from('alerts').insert({
      company_id: quote.company_id,
      quote_id: quote.id,
      alert_type: 'quote_accepted',
      title: `Quote #${quote.quote_number} Accepted`,
      message: `${quote.customer_name} has accepted Quote #${quote.quote_number}.`,
    });
  } else {
    // Update quote
    const { error } = await supabase
      .from('quotes')
      .update({ declined_at: now, job_status: 'declined' })
      .eq('id', quote.id);
    if (error) throw new Error(error.message);

    // Create alert
    await supabase.from('alerts').insert({
      company_id: quote.company_id,
      quote_id: quote.id,
      alert_type: 'quote_declined',
      title: `Quote #${quote.quote_number} Declined`,
      message: `${quote.customer_name} has declined Quote #${quote.quote_number}.`,
    });
  }
}
