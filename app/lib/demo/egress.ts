import 'server-only';
import { headers } from 'next/headers';
import { isDemoCompany } from './context';
import { DemoError } from './errors';
export async function assertDemoExternalAllowed(companyId:string):Promise<void>{
 if(await isDemoCompany(companyId))throw new DemoError('External sending, billing and integrations are disabled in this demo. Use the guided demo customer preview instead.',403,'demo_external_blocked');
}
/** Extra web-request backstop for unscoped mail callers. Background sends are
 * separately guarded by their company-aware outbound-message entry point. */
export async function isDemoWebRequest():Promise<boolean>{
 try{return (await headers()).get('x-qcp-auth-namespace')==='demo';}catch{return false;}
}
