'use server';

import { requireCompanyContext } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

export interface PaymentDetails {
  accountName: string;
  bankName: string;
  accountNumber: string;
  sortCode: string;
  paymentLink: string;
}

export async function savePaymentDetails(details: PaymentDetails) {
  const profile = await requireCompanyContext();
  const admin = createAdminClient();

  const { error } = await admin
    .from('companies')
    .update({ payment_details: details as never })
    .eq('id', profile.company_id);

  if (error) throw error;
  revalidatePath('/[workspaceSlug]/account');
}

export async function loadPaymentDetails(): Promise<PaymentDetails> {
  const profile = await requireCompanyContext();
  const admin = createAdminClient();

  const { data } = await admin
    .from('companies')
    .select('payment_details')
    .eq('id', profile.company_id)
    .single();

  const raw = (data?.payment_details ?? {}) as Partial<PaymentDetails>;
  return {
    accountName: raw.accountName ?? '',
    bankName: raw.bankName ?? '',
    accountNumber: raw.accountNumber ?? '',
    sortCode: raw.sortCode ?? '',
    paymentLink: raw.paymentLink ?? '',
  };
}
