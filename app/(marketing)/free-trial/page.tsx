import { redirect } from 'next/navigation';

/**
 * Free-workspace model (owner decision 2026-11-01): there is no separate
 * free-trial page anymore. The free workspace IS the trial: everyone gets a
 * full-access workspace with just their email, so this page now sends
 * visitors straight to the signup.
 */
export default function FreeTrialPage() {
  redirect('/signup');
}
