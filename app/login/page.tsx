import LoginClient from './LoginClient';

// Login may be a restored PWA document. Do not statically cache the recovery
// flag or treat rendering this page as proof the visitor is unauthenticated.
export const dynamic = 'force-dynamic';
export default function LoginPage() {
  return <LoginClient sessionRecovery={process.env.PWA_SESSION_RECOVERY_ENABLED === 'true'} />;
}
