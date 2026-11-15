import 'server-only';
import type Stripe from 'stripe';
import type {SupabaseClient} from '@supabase/supabase-js';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { sendEmail } from '@/app/lib/email/send';

/** Called only AFTER the existing Stripe endpoint verified its signature and mode. */
export async function handlePricingQuickStartStripeEvent(event:Stripe.Event):Promise<string|null>{
 if(!['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed'].includes(event.type))return null;
 const checkout=event.data.object as Stripe.Checkout.Session;
 if(checkout.metadata?.pricing_setup_product!=='quick_start')return null;
 const orderId=checkout.metadata.order_id,companyId=checkout.metadata.company_id;
 if(!orderId||!companyId||checkout.mode!=='payment'||checkout.currency?.toLowerCase()!=='usd'||checkout.amount_subtotal!==9900)
  return 'quarantined:invalid_quick_start_checkout';
 const admin=createAdminClient() as unknown as SupabaseClient;
 const {data:order,error}=await admin.from('pricing_quick_start_orders').select('id,company_id,status,stripe_session_id,contact_email')
  .eq('id',orderId).eq('company_id',companyId).maybeSingle();
 if(error)throw new Error('Quick Start order lookup failed.');
 if(!order)return 'quarantined:unknown_quick_start_order';
 if(order.stripe_session_id&&order.stripe_session_id!==checkout.id)return 'quarantined:quick_start_checkout_mismatch';
 if(['paid','in_progress','ready_for_review','completed'].includes(order.status))return 'ok:quick_start_already_paid';
 const failed=event.type==='checkout.session.async_payment_failed';
 if(!failed&&checkout.payment_status!=='paid')return 'ok:quick_start_awaiting_payment';
 const {error:updateError}=await admin.from('pricing_quick_start_orders').update({
  stripe_session_id:checkout.id,status:failed?'payment_failed':'paid',
  paid_at:failed?null:new Date().toISOString(),updated_at:new Date().toISOString(),
 }).eq('id',orderId).eq('company_id',companyId).in('status',['pending_payment','payment_failed']);
 if(updateError)throw new Error('Quick Start order update failed.');
 if(!failed){
  // Non-critical notification; paid orders remain queryable in the admin console.
  try{await sendEmail({to:'info@quote-core.com',subject:`Quick Start payment received: ${orderId}`,
   text:`A US$49 Quick Start payment has been verified.\nOrder: ${orderId}\nCustomer: ${order.contact_email}\nOpen the internal Quick Start queue to review their private files and fulfill the order.`,
   html:`<p>A US$49 Quick Start payment has been verified.</p><p>Order ID: ${orderId}</p><p>Customer: ${String(order.contact_email).replace(/[&<>]/g,'')}</p><p>Review it in the internal Quick Start queue.</p>`});}catch{/* Queryable in admin. */}
 }
 return failed?'ok:quick_start_payment_failed':'ok:quick_start_paid';
}
