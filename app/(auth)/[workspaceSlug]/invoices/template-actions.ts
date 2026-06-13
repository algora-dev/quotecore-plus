'use server';

import { requireCompanyContext, createSupabaseServerClient } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { requireInvoiceFeature } from '@/app/lib/billing/entitlements';
import { revalidatePath } from 'next/cache';

export interface InvoiceTemplate {
  id: string;
  company_id: string;
  name: string;
  company_name: string | null;
  company_address: string | null;
  company_email: string | null;
  company_phone: string | null;
  company_logo_url: string | null;
  footer_text: string | null;
  payment_account_name: string | null;
  payment_bank_name: string | null;
  payment_account_number: string | null;
  payment_sort_code: string | null;
  payment_link: string | null;
  default_notes: string | null;
  default_terms: string | null;
  created_at: string;
  updated_at: string;
}

export type InvoiceTemplateInput = Omit<InvoiceTemplate, 'id' | 'company_id' | 'created_at' | 'updated_at'>;

export async function listInvoiceTemplates(): Promise<InvoiceTemplate[]> {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('invoice_templates')
    .select('*')
    .eq('company_id', profile.company_id)
    .order('name');

  if (error) throw error;
  return (data ?? []) as InvoiceTemplate[];
}

export async function createInvoiceTemplate(input: InvoiceTemplateInput): Promise<string> {
  const profile = await requireCompanyContext();
  // H-02: invoice templates are part of the invoices feature.
  await requireInvoiceFeature(profile.company_id);
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('invoice_templates')
    .insert({ ...input, company_id: profile.company_id })
    .select('id')
    .single();

  if (error || !data) throw error ?? new Error('Failed to create template');
  revalidatePath('/[workspaceSlug]/resources/invoice-templates');
  return data.id;
}

export async function updateInvoiceTemplate(id: string, input: Partial<InvoiceTemplateInput>) {
  const profile = await requireCompanyContext();
  // H-02: invoice templates are part of the invoices feature.
  await requireInvoiceFeature(profile.company_id);
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from('invoice_templates')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('company_id', profile.company_id);

  if (error) throw error;
  revalidatePath('/[workspaceSlug]/resources/invoice-templates');
}

export async function deleteInvoiceTemplate(id: string) {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from('invoice_templates')
    .delete()
    .eq('id', id)
    .eq('company_id', profile.company_id);

  if (error) throw error;
  revalidatePath('/[workspaceSlug]/resources/invoice-templates');
}
