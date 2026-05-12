import Link from 'next/link';
import { RecoverFlow } from './RecoverFlow';
import { PublicFooter } from '@/app/components/PublicFooter';

/**
 * Account recovery flow — "I've lost access to my email."
 *
 * The page itself is a thin server shell; all interactive state lives in the
 * client RecoverFlow component below. The flow has 4 visible screens:
 *   1. Identify (enter old email)
 *   2. Verify (answer security questions)  — only if step 1 found an account
 *   3. New email (set the new address)
 *   4. Done (instructions to check the new inbox)
 *
 * On any "no recovery available" branch we surface a single Contact Support
 * card; we never reveal whether an email is registered.
 */
export const dynamic = 'force-dynamic';

export default function RecoverPage() {
  return (
    <main className="min-h-screen flex flex-col bg-slate-50 px-4">
      <div className="w-full max-w-md mx-auto my-auto py-10">
        <div className="text-center mb-8">
          <img src="/logo-email.png" alt="QuoteCore+" className="h-10 inline-block" />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
          <RecoverFlow />
        </div>
        <p className="mt-6 text-center text-sm text-slate-600">
          <Link href="/login" className="text-orange-600 font-medium hover:text-orange-700 transition-colors">
            ← Back to sign in
          </Link>
        </p>
      </div>
      <PublicFooter />
    </main>
  );
}
