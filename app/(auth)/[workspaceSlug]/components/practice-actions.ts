'use server';
import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, requireCompanyContext, requireUser } from '@/app/lib/supabase/server';

/** Explicit owner verification after replacing/checking every demo cost and rule. */
export async function verifyPracticeComponent(componentId: string, acknowledged: boolean) {
  if (process.env.NEXT_PUBLIC_PRICING_SETUP_ENABLED !== 'true') return {ok:false,message:'Pricing setup is not enabled.'};
  if (!acknowledged || !/^[a-f0-9-]{36}$/i.test(componentId)) return {ok:false,message:'Review and confirm every cost and rule before verification.'};
  try {
    const profile = await requireCompanyContext();
    const person = await requireUser();
    if (person.is_anonymous) return {ok:false,message:'Sign in to your workspace.'};
    const supabase=await createSupabaseServerClient();
    const {data,error}=await supabase.from('component_library')
      .select('id,pricing_setup_practice,default_material_rate,default_labour_rate,default_waste_type,default_pitch_type')
      .eq('company_id',profile.company_id).eq('id',componentId).maybeSingle();
    if(error||!data)return {ok:false,message:'Component not found in your workspace.'};
    if(!data.pricing_setup_practice)return {ok:false,message:'This component is already using your normal pricing.'};
    if(data.default_material_rate==null||data.default_labour_rate==null)return {ok:false,message:'Provide real material and labour costs before confirming.'};
    const {error:saveError}=await supabase.from('component_library').update({
      pricing_setup_practice:false,pricing_setup_verified_at:new Date().toISOString(),pricing_setup_verified_by:person.id,
    } as never).eq('company_id',profile.company_id).eq('id',componentId).eq('pricing_setup_practice',true);
    if(saveError)return {ok:false,message:'Unable to verify this component.'};
    revalidatePath('/[workspaceSlug]/components','page');
    return {ok:true,message:'Component now uses customer-verified pricing. Existing practice quotes remain practice only.'};
  } catch(error){return {ok:false,message:error instanceof Error?error.message:'Unable to verify component.'};}
}
