import { verifyUnsubscribeToken } from '@/app/lib/marketing/unsubscribeToken';
import { UnsubscribeConfirm } from './UnsubscribeConfirm';

export const dynamic = 'force-dynamic';

/**
 * Public marketing-unsubscribe confirmation page. Mirrors the /m/[token]/stop
 * pattern: GET never writes - the user clicks a button (POST via server
 * action) so email scanners cannot trigger the opt-out.
 */
export default async function MarketingUnsubscribePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ confirmed?: string; error?: string }>;
}) {
  const { token } = await params;
  const { confirmed, error } = await searchParams;

  const secret = process.env.ADMIN_SIGNUPS_API_KEY;
  const valid = secret ? verifyUnsubscribeToken(token, secret) !== null : false;

  return (
    <UnsubscribeConfirm
      token={token}
      valid={valid}
      confirmed={!!confirmed}
      hadError={!!error}
    />
  );
}
