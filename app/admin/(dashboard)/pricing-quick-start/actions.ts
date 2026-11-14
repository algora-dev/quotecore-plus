'use server';
import type {SupabaseClient} from '@supabase/supabase-js';
import { requireAdmin } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import {revalidatePath} from 'next/cache';
const isUuid=(id:string)=>/^[\da-f]{8}-[\da-f]{4}-[1-8][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(id);
export async function quickStartFileLink(orderId:string,filePath:string):Promise<{ok:boolean;url?:string;message?:string}>{
 await requireAdmin();
 if(!isUuid(orderId)||filePath.length>600)return {ok:false,message:'Invalid file request.'};
 const admin=createAdminClient() as unknown as SupabaseClient;
 const {data:order}=await admin.from('pricing_quick_start_orders').select('file_paths').eq('id',orderId).maybeSingle();
 if(!order||!Array.isArray(order.file_paths)||!order.file_paths.includes(filePath))return {ok:false,message:'File not found for this order.'};
 const {data,error}=await admin.storage.from('pricing-quick-start').createSignedUrl(filePath,300);
 if(error||!data?.signedUrl)return {ok:false,message:'Unable to open the private file.'};
 return {ok:true,url:data.signedUrl};
}
export async function setQuickStartStatus(id:string,status:'in_progress'|'ready_for_review'|'completed'){
 await requireAdmin();
 if(!isUuid(id)||!['in_progress','ready_for_review','completed'].includes(status))return {ok:false,message:'Invalid request.'};
 const admin=createAdminClient() as unknown as SupabaseClient;
 const from=status==='in_progress'?['paid']:status==='ready_for_review'?['in_progress']:['ready_for_review'];
 const {data,error}=await admin.from('pricing_quick_start_orders').update({status,updated_at:new Date().toISOString()})
  .eq('id',id).in('status',from).select('id').maybeSingle();
 if(error||!data)return {ok:false,message:'Status was changed elsewhere or this transition is not allowed.'};
 revalidatePath('/admin/pricing-quick-start','page');return {ok:true};
}
