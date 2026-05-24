import Link from 'next/link';
import { LegalPageShell } from '@/app/components/LegalPageShell';

export const metadata = {
  title: 'Cookie Policy - QuoteCore+',
  description: 'Which cookies QuoteCore+ uses and why.',
};

const TOC = [
  { id: 'what-cookies-are', label: 'What cookies are' },
  { id: 'cookies-we-use', label: 'Cookies we use' },
  { id: 'no-tracking', label: 'No tracking cookies' },
  { id: 'how-to-control', label: 'How to control cookies' },
  { id: 'changes', label: 'Changes to this policy' },
  { id: 'contact', label: 'Contact us' },
];

export default function CookiePolicyPage() {
  return (
    <LegalPageShell title="Cookie Policy" effectiveDate="9 May 2026" toc={TOC}>
      <p>
        This page lists every cookie QuoteCore<span className="text-orange-500">+</span>{' '}
        sets when you use the Service, what each one does, and how long it
        sticks around. This policy is companion to our{' '}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>

      <h2 id="what-cookies-are">What cookies are</h2>
      <p>
        A cookie is a small text file a website saves in your browser. Some are
        necessary for the site to work (signing you in, remembering your session)
        and some are used for things like analytics or advertising. We only use
        the necessary kind.
      </p>

      <h2 id="cookies-we-use">Cookies we use</h2>
      <p>
        Every cookie below is <strong>strictly necessary</strong> &mdash; meaning
        the Service cannot function without it. Under the EU/UK ePrivacy
        Directive, strictly-necessary cookies are exempt from prior consent, but
        we still want you to know they exist.
      </p>

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Purpose</th>
            <th>Set by</th>
            <th>Expires</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>sb-&lt;project&gt;-auth-token</code></td>
            <td>Keeps you signed in. Without this cookie you would have to re-enter your password on every page.</td>
            <td>Supabase Auth</td>
            <td>1 hour (refreshed automatically while you&apos;re active)</td>
          </tr>
          <tr>
            <td><code>sb-&lt;project&gt;-auth-token-code-verifier</code></td>
            <td>Used during the sign-in handshake (PKCE flow). Set briefly when you click a magic link or OAuth button.</td>
            <td>Supabase Auth</td>
            <td>~10 minutes</td>
          </tr>
          <tr>
            <td><code>qcp_recovery</code></td>
            <td>Tracks your progress through the &ldquo;Lost access to my email&rdquo; recovery flow. Signed with HMAC and only readable by our server.</td>
            <td>QuoteCore+</td>
            <td>15 minutes (single use, cleared on completion)</td>
          </tr>
        </tbody>
      </table>

      <p>
        Vercel (our hosting provider) may also set short-lived cookies for things
        like geo-routing and load-balancer affinity. These don&apos;t identify
        you and are not used for analytics or advertising.
      </p>

      <h2 id="no-tracking">No tracking cookies</h2>
      <p>We don&apos;t use any of the following:</p>
      <ul>
        <li>Analytics cookies (Google Analytics, Mixpanel, Plausible, Heap, etc.)</li>
        <li>Advertising cookies (Google Ads, Facebook Pixel, etc.)</li>
        <li>Social-media tracking pixels</li>
        <li>Heatmap or session-replay tools</li>
      </ul>
      <p>
        If we ever do add an analytics or marketing cookie, this page will be
        updated <strong>before</strong> the cookie is set, the consent banner
        will be upgraded to a full Accept/Reject control, and existing users
        will see the new consent UI on their next visit.
      </p>

      <h2 id="how-to-control">How to control cookies</h2>
      <p>
        Because every cookie we set is strictly necessary, blocking them will
        break the Service (you won&apos;t be able to sign in). If you still want
        to control cookies in your browser, you can:
      </p>
      <ul>
        <li>Open your browser&apos;s privacy settings and clear or block cookies for <code>quote-core.com</code></li>
        <li>Use private / incognito mode &mdash; cookies will be cleared when you close the window</li>
      </ul>

      <h2 id="changes">Changes to this policy</h2>
      <p>
        When we add, remove, or change a cookie, we update this page and bump
        the cookie banner so it reappears for everyone. The &ldquo;Effective
        date&rdquo; at the top reflects the most recent change.
      </p>

      <h2 id="contact">Contact us</h2>
      <p>
        Questions about cookies:{' '}
        <a href="mailto:info@quote-core.com">info@quote-core.com</a>.
      </p>
    </LegalPageShell>
  );
}
