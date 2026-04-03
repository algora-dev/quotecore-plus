import { loadCompanyContext } from '@/app/lib/data/company-context';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { MeasurementSystemSelector } from './MeasurementSystemSelector';
import { AccountSettings } from './AccountSettings';
import { LogoUploader } from './LogoUploader';

export default async function AccountPage() {
  const { company, profile } = await loadCompanyContext();
  
  // Load company logo if exists
  const supabase = await createSupabaseServerClient();
  const { data: logoFile } = await supabase
    .from('quote_files')
    .select('storage_path')
    .eq('company_id', company.id)
    .eq('file_type', 'logo')
    .order('uploaded_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  let logoUrl = null;
  if (logoFile) {
    const { data: urlData } = supabase.storage
      .from('COMPANY-LOGOS')
      .getPublicUrl(logoFile.storage_path);
    logoUrl = urlData.publicUrl;
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Account & permissions</h1>
        <p className="text-slate-600">
          Manage company settings, primary contact details, and (soon) invite additional teammates.
        </p>
      </div>

      <AccountSettings company={company} profile={profile} />

      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-6">
        <LogoUploader companyId={company.id} currentLogoUrl={logoUrl} />
        
        <div className="border-t pt-6">
          <MeasurementSystemSelector currentSystem={company.default_measurement_system} />
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm text-amber-800">
          <strong>Coming soon:</strong> Invite teammates, manage permissions, and customize company branding.
        </p>
      </div>
    </section>
  );
}
