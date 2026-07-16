import Link from 'next/link';
import { LegalPageShell } from '@/app/components/LegalPageShell';
import { hreflangLanguages } from '@/lib/seo/hreflang';

export const metadata = {
  title: 'Privacy Policy - QuoteCore+',
  description: 'How QuoteCore+ collects, uses, and protects your personal data.',
  alternates: { canonical: 'https://quote-core.com/privacy', languages: hreflangLanguages('/privacy') },
};

const TOC = [
  { id: 'who-we-are', label: 'Who we are' },
  { id: 'what-we-collect', label: 'What we collect' },
  { id: 'why-we-use-it', label: 'Why we use it' },
  { id: 'lawful-basis', label: 'Lawful basis (GDPR)' },
  { id: 'sharing', label: 'Who we share with' },
  { id: 'storage', label: 'Where data is stored' },
  { id: 'retention', label: 'How long we keep it' },
  { id: 'your-rights', label: 'Your rights' },
  { id: 'security', label: 'Security' },
  { id: 'children', label: "Children's data" },
  { id: 'changes', label: 'Changes to this policy' },
  { id: 'contact', label: 'Contact us' },
];

export default function PrivacyPolicyPage() {
  return (
    <LegalPageShell title="Privacy Policy" effectiveDate="17 July 2026" toc={TOC}>
      <p>
        This Privacy Policy explains how QuoteCore<span className="text-orange-500">+</span>{' '}
        (&ldquo;we&rdquo;, &ldquo;our&rdquo;, &ldquo;us&rdquo;) handles your personal data when you use our
        web application at <strong>quote-core.com</strong>, our free tools, and related services
        (collectively, &ldquo;the Service&rdquo;).
      </p>
      <p>
        We are a New Zealand company serving users in many countries. We treat
        every user according to the strictest privacy law that applies to them.
        If you live somewhere with a stronger framework, that framework applies to you too.
      </p>

      <h2 id="who-we-are">Who we are</h2>
      <p>The data controller for the Service is:</p>
      <ul>
        <li><strong>T3 Play Limited</strong></li>
        <li>New Zealand company number: 9148617</li>
        <li>NZBN: 9429051941314</li>
        <li>Registered office: 85 Tongariro Street, Halswell, Christchurch 8025, New Zealand</li>
        <li>Email: <a href="mailto:info@quote-core.com">info@quote-core.com</a></li>
      </ul>
      <p>
        For users in the EU or UK, we have not yet appointed a representative
        under Article 27 of the GDPR / UK GDPR. Until we do, you can contact us
        directly at the email above for any privacy queries and we will respond
        within statutory timeframes.
      </p>

      <h2 id="what-we-collect">What we collect</h2>
      <p>The data we collect falls into these categories:</p>

      <h3>Account data</h3>
      <ul>
        <li>Your email address and a hashed password (we never see your password in plain text)</li>
        <li>Your full name and the company name you use on quotes</li>
        <li>If you sign in with Google: the email address and identity token Google shares with us</li>
        <li>Two-factor authentication: TOTP secrets (managed by Supabase), recovery code hashes, and bcrypt-hashed answers to any account-recovery questions you set</li>
      </ul>

      <h3>Profile and workspace data</h3>
      <ul>
        <li>Company logo (if you upload one)</li>
        <li>Default currency, language, measurement system, profit margins, and tax list</li>
        <li>Your notification and Copilot preferences</li>
      </ul>

      <h3>Quote and customer data (data you put into the app)</h3>
      <ul>
        <li>Customer names, email addresses, postal addresses, phone numbers</li>
        <li>Quote line items, measurements, materials, labour costs, totals</li>
        <li>Files you upload alongside a quote (plans, supporting documents)</li>
        <li>Any text you type into quote templates, email templates, or notes</li>
      </ul>
      <p>
        You are the controller of your customers&apos; data. We process it on
        your behalf as the data <em>processor</em>. A Data Processing Addendum (DPA)
        is available on request — email us at{' '}
        <a href="mailto:info@quote-core.com">info@quote-core.com</a>.
      </p>

      <h3>Activity and security data</h3>
      <ul>
        <li>Sign-in history maintained by Supabase Auth</li>
        <li>Account recovery attempt log (timestamp, IP address, user-agent, outcome) when you use the &ldquo;Lost access to my email&rdquo; flow</li>
        <li>Last email change timestamp (used for our 7-day cooldown)</li>
        <li>Server logs from our hosting provider (Vercel) and our database (Supabase) which include request paths, IP addresses, and user-agent strings</li>
      </ul>

      <h3>What we do NOT collect</h3>
      <ul>
        <li>We do not use analytics platforms (no Google Analytics, no Mixpanel, no Plausible)</li>
        <li>We do not place advertising cookies</li>
        <li>We do not embed social media tracking pixels</li>
        <li>We do not buy or sell personal data, ever</li>
      </ul>

      <h2 id="why-we-use-it">Why we use it</h2>
      <ul>
        <li><strong>To run the Service</strong> — store your quotes, send acceptance links, generate PDFs, etc.</li>
        <li><strong>To authenticate you</strong> — verify your password, manage 2FA, mint sessions</li>
        <li><strong>To send transactional emails</strong> — quote-accepted alerts, password reset links, security notifications. We do not send marketing email.</li>
        <li><strong>To keep your account safe</strong> — detect suspicious recovery attempts via the audit log, enforce cooldowns on sensitive actions</li>
        <li><strong>To provide AI features</strong> — document parsing and smart component assistance via OpenAI&apos;s API. Data sent to OpenAI via API is not used to train their models.</li>
        <li><strong>To comply with the law</strong> — keep records we are legally required to retain</li>
      </ul>

      <h2 id="lawful-basis">Lawful basis (GDPR)</h2>
      <p>If GDPR or UK GDPR applies to you, we rely on:</p>
      <ul>
        <li><strong>Contract</strong> (Art. 6(1)(b)) — to deliver the Service you signed up for</li>
        <li><strong>Legitimate interests</strong> (Art. 6(1)(f)) — to keep the Service secure and working, and to defend against abuse</li>
        <li><strong>Legal obligation</strong> (Art. 6(1)(c)) — to retain records required by law</li>
        <li><strong>Consent</strong> (Art. 6(1)(a)) — only where strictly required (e.g. specific opt-in features added in future)</li>
      </ul>

      <h2 id="sharing">Who we share with</h2>
      <p>We share data with the following third-party processors. Each one is contractually bound to handle data only for the purpose we hire them for.</p>
      <ul>
        <li><strong>Supabase</strong> (database, authentication, file storage). Project hosted in Sydney, Australia (ap-southeast-2).</li>
        <li><strong>Vercel</strong> (web hosting). Edge network with global presence; data may transit through US infrastructure.</li>
        <li><strong>Resend</strong> (transactional email delivery). US-based.</li>
        <li><strong>OpenAI</strong> (AI document parsing and assistance). US-based. API data is not used for model training.</li>
        <li><strong>Stripe</strong> (payment processing). US-based with global infrastructure.</li>
        <li><strong>Google</strong> (only if you choose Google sign-in). Used purely to verify your identity at sign-in.</li>
      </ul>
      <p>
        We do not sell your data and we do not share it with advertisers,
        analytics providers, or social platforms. We may disclose data if
        compelled by a valid legal order, in which case we will tell you unless
        legally barred from doing so.
      </p>

      <h2 id="storage">Where data is stored</h2>
      <p>
        Your primary database and file storage live in Australia
        (Supabase, Sydney region). Email delivery transits the
        United States via Resend. AI processing transits the United States via OpenAI.
        Payment processing transits the United States via Stripe.
        Web traffic is served from the closest Vercel
        edge region to your users. For transfers outside the EEA / UK, we rely
        on Standard Contractual Clauses (SCCs) where applicable.
      </p>

      <h2 id="retention">How long we keep it</h2>
      <ul>
        <li><strong>Active account data</strong> — kept while your account is active and for as long as you use the Service</li>
        <li><strong>Closed accounts</strong> — Customer Data deleted within 30 days of subscription end; account-level personal data deleted within 90 days of account closure, unless we have a legal obligation to retain longer</li>
        <li><strong>Audit logs</strong> (account recovery attempts, sign-in events) — kept indefinitely for security purposes; we can review and reduce this retention window on request</li>
        <li><strong>Server logs</strong> from Vercel/Supabase — held by those providers per their own retention policies</li>
        <li><strong>Email delivery logs</strong> at Resend — held per Resend&apos;s policy (typically 30-90 days)</li>
      </ul>

      <h2 id="your-rights">Your rights</h2>
      <p>You have the following rights over your personal data. Contact us at <a href="mailto:info@quote-core.com">info@quote-core.com</a> to exercise any of them; we&apos;ll respond within one month.</p>
      <ul>
        <li><strong>Access</strong> — get a copy of the personal data we hold about you</li>
        <li><strong>Rectification</strong> — correct inaccurate data</li>
        <li><strong>Erasure</strong> (&ldquo;right to be forgotten&rdquo;) — delete your account and the associated personal data, subject to any legal retention requirements</li>
        <li><strong>Portability</strong> — receive your data in a structured, machine-readable format</li>
        <li><strong>Restriction</strong> — pause our processing of your data while a dispute is resolved</li>
        <li><strong>Objection</strong> — object to processing based on our legitimate interests</li>
        <li><strong>Withdraw consent</strong> — where we process based on consent, you can withdraw it at any time</li>
      </ul>
      <p>
        If you live in California, you also have rights under the CCPA/CPRA
        (right to know, right to delete, right to correct, right to opt-out of
        sale or sharing). We do not sell or share data for advertising
        purposes, so the opt-out is automatic, but the other rights apply and
        you can exercise them via the same email.
      </p>
      <p>
        If you live in Australia, your rights under the Privacy Act 1988 (Cth)
        and the Australian Privacy Principles apply. These broadly mirror the
        GDPR rights above.
      </p>
      <p>
        If you live in New Zealand, your rights under the Privacy Act 2020
        apply, including the right to access and correct your personal
        information.
      </p>
      <p>
        If you are unhappy with how we handle a request, you may complain to
        your local data protection authority (e.g. the Office of the Privacy
        Commissioner in New Zealand, the ICO in the UK, or your national data
        protection regulator in the EU).
      </p>

      <h2 id="security">Security</h2>
      <p>We take reasonable technical and organisational measures to protect your data, including:</p>
      <ul>
        <li>Passwords hashed by Supabase Auth using industry-standard algorithms</li>
        <li>Optional two-factor authentication (TOTP)</li>
        <li>HMAC-signed, short-lived tokens for sensitive flows (e.g. account recovery)</li>
        <li>Row-level security (RLS) policies on the database so users only see their own data</li>
        <li>HTTPS-everywhere in transit</li>
        <li>Encrypted-at-rest storage at our database and storage providers</li>
        <li>Rate-limiting and audit logging for security-sensitive operations</li>
        <li>A 7-day cooldown after every successful email change, plus mandatory password reset following the change</li>
      </ul>
      <p>
        No system is perfectly secure, and we don&apos;t pretend otherwise. If
        we ever suffer a breach that affects your data, we will notify you and
        the relevant regulators within statutory timeframes.
      </p>

      <h2 id="children">Children&apos;s data</h2>
      <p>
        QuoteCore<span className="text-orange-500">+</span> is a business tool
        for trades. It is not intended for, and we do not knowingly collect data
        from, anyone under the age of 18. If you believe a child has signed up,
        contact us and we will delete the account.
      </p>

      <h2 id="changes">Changes to this policy</h2>
      <p>
        When we update this policy materially, we will:
      </p>
      <ul>
        <li>Update the &ldquo;Effective date&rdquo; at the top</li>
        <li>Notify you by email if the change affects how we use your data</li>
      </ul>
      <p>
        Older versions are available on request. The current version always
        lives at <Link href="/privacy">/privacy</Link>.
      </p>

      <h2 id="contact">Contact us</h2>
      <p>
        Privacy queries, requests under your rights, or anything else:{' '}
        <a href="mailto:info@quote-core.com">info@quote-core.com</a>.
      </p>
    </LegalPageShell>
  );
}
