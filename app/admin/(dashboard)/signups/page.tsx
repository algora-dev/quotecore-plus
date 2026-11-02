import { loadRecentSignups } from './actions';
import { SignupsPanel } from './SignupsPanel';

export const dynamic = 'force-dynamic';

export default async function AdminSignupsPage() {
  const result = await loadRecentSignups(50);
  const signups = result.ok ? result.signups : [];
  const error = result.ok ? null : result.error;
  return <SignupsPanel initialSignups={signups} initialError={error} />;
}
