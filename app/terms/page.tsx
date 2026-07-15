import Link from 'next/link';
import { LegalPageShell } from '@/app/components/LegalPageShell';
import { hreflangLanguages } from '@/lib/seo/hreflang';

export const metadata = {
  title: 'Terms of Service - QuoteCore+',
  description: 'The terms under which QuoteCore+ is provided.',
  alternates: { canonical: 'https://quote-core.com/terms', languages: hreflangLanguages('/terms') },
};

const TOC = [
  { id: 'who-we-are', label: 'Who we are' },
  { id: 'your-account', label: 'Your account' },
  { id: 'acceptable-use', label: 'Acceptable use' },
  { id: 'your-content', label: 'Your content' },
  { id: 'fees', label: 'Fees and payment' },
  { id: 'availability', label: 'Service availability' },
  { id: 'termination', label: 'Termination' },
  { id: 'disclaimer', label: 'Disclaimer of warranties' },
  { id: 'liability', label: 'Limitation of liability' },
  { id: 'indemnity', label: 'Indemnity' },
  { id: 'governing-law', label: 'Governing law' },
  { id: 'changes', label: 'Changes to these terms' },
  { id: 'contact', label: 'Contact us' },
];

export default function TermsOfServicePage() {
  return (
    <LegalPageShell title="Terms of Service" effectiveDate="9 May 2026 (v1.0 - Beta)" toc={TOC}>
      <div className="not-prose mb-8 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">Beta notice</p>
        <p className="mt-1">
          QuoteCore<span className="text-orange-500">+</span> is currently in
          public beta. These terms are intentionally lightweight and will be
          replaced with a full agreement before paid plans go live. Until then,
          the Service is offered free of charge with no contractual SLA.
        </p>
      </div>

      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) govern your use of the
        QuoteCore<span className="text-orange-500">+</span> web application and
        related services (the &ldquo;Service&rdquo;). By creating an account or
        otherwise using the Service, you agree to these Terms.
      </p>

      <h2 id="who-we-are">Who we are</h2>
      <p>
        The Service is provided by <strong>[Costa Rica Entity Name TBC]</strong>{' '}
        (&ldquo;QuoteCore+&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;), a
        company registered in Costa Rica at [Costa Rica Registered Address TBC].
        You can reach us at{' '}
        <a href="mailto:info@quote-core.com">info@quote-core.com</a>.
      </p>

      <h2 id="your-account">Your account</h2>
      <ul>
        <li>You must be at least 16 years old to create an account.</li>
        <li>You are responsible for keeping your sign-in credentials secret. Use a strong password and turn on two-factor authentication.</li>
        <li>You are responsible for what happens under your account. If you discover unauthorised use, tell us immediately.</li>
        <li>One human, one account. Don&apos;t share accounts. Each member of your team should have their own login (multi-user support is on the roadmap).</li>
      </ul>

      <h2 id="acceptable-use">Acceptable use</h2>
      <p>You agree not to use the Service to:</p>
      <ul>
        <li>Break the law or infringe anyone&apos;s rights</li>
        <li>Send spam, phishing, or unsolicited marketing</li>
        <li>Upload malware, exploit code, or anything designed to harm users</li>
        <li>Reverse-engineer, scrape, or attempt to extract data beyond what&apos;s exposed by the normal user interface</li>
        <li>Interfere with the Service&apos;s operation or other users&apos; access</li>
        <li>Use the Service to store data you have no right to process (the customer data you put into QuoteCore+ must be yours to lawfully process)</li>
      </ul>

      <h2 id="your-content">Your content</h2>
      <p>
        You retain ownership of everything you upload to the Service &mdash;
        your quotes, customer data, files, branding, the lot. You grant us a
        limited licence to store, process, and display that content solely so
        we can provide the Service to you.
      </p>
      <p>
        We don&apos;t use your content to train AI models, share it with
        advertisers, or monetise it in any way other than charging you for the
        Service itself.
      </p>

      <h2 id="fees">Fees and payment</h2>
      <p>
        While in public beta the Service is free of charge. When paid plans
        launch:
      </p>
      <ul>
        <li>We&apos;ll give existing users at least 30 days&apos; notice before any plan becomes a paid plan</li>
        <li>Fees, billing intervals, and payment terms will be set out at the time you subscribe</li>
        <li>Payment processing will be handled by a third-party processor (Stripe) under their own terms</li>
        <li>Taxes (VAT, GST, sales tax) are added on top of fees where applicable</li>
      </ul>

      <h2 id="availability">Service availability</h2>
      <p>
        We work hard to keep QuoteCore<span className="text-orange-500">+</span>{' '}
        running smoothly, but we don&apos;t guarantee uptime during the beta
        period. Maintenance windows, third-party outages (Supabase, Vercel,
        Resend), and software bugs may temporarily affect access.
      </p>
      <p>
        Once paid plans launch, an SLA will be defined in the relevant plan&apos;s terms.
      </p>

      <h2 id="termination">Termination</h2>
      <p>
        You can close your account at any time by contacting us at{' '}
        <a href="mailto:info@quote-core.com">info@quote-core.com</a>. We will
        delete your account and associated personal data within 90 days,
        subject to any legal retention obligations described in our{' '}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>
      <p>
        We may suspend or terminate your account if you breach these Terms,
        engage in fraud or abuse, or do something that materially harms the
        Service or its users. We&apos;ll give reasonable notice where possible.
      </p>

      <h2 id="disclaimer">Disclaimer of warranties</h2>
      <p>
        The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;.
        To the maximum extent permitted by law, we disclaim all implied
        warranties, including merchantability, fitness for a particular purpose,
        and non-infringement.
      </p>
      <p>
        QuoteCore<span className="text-orange-500">+</span> is a tool to help
        you build quotes faster. It does not provide professional, legal,
        engineering, or trade advice. The accuracy of any quote, measurement,
        or calculation produced through the Service is your responsibility.
      </p>

      <h2 id="liability">Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, neither party is liable to the
        other for any indirect, incidental, consequential, special, or
        exemplary damages, including lost profits, lost revenue, lost data, or
        business interruption.
      </p>
      <p>
        Our total aggregate liability for any claim arising out of or related
        to the Service is limited to the greater of: (a) the fees you paid us
        for the Service in the twelve months preceding the claim, or (b)
        US&nbsp;$100.
      </p>
      <p>
        Nothing in these Terms limits liability for fraud, gross negligence,
        wilful misconduct, death, or personal injury where that limitation is
        prohibited by law.
      </p>

      <h2 id="indemnity">Indemnity</h2>
      <p>
        You agree to indemnify and hold us harmless from any third-party claim
        arising from: (a) your use of the Service in breach of these Terms,
        (b) your content, or (c) your violation of any law or third-party
        rights. We&apos;ll let you know promptly of any such claim and let you
        choose counsel.
      </p>

      <h2 id="governing-law">Governing law</h2>
      <p>
        These Terms are governed by the laws of Costa Rica, without regard to
        its conflict-of-laws principles. Any dispute will be resolved in the
        courts of Costa Rica, except where mandatory consumer-protection laws
        in your country of residence give you the right to sue locally.
      </p>

      <h2 id="changes">Changes to these terms</h2>
      <p>
        We may update these Terms from time to time. When we make a material
        change, we&apos;ll update the &ldquo;Effective date&rdquo; at the top
        and notify you by email. Continued use of the Service after the change
        means you accept the updated Terms.
      </p>

      <h2 id="contact">Contact us</h2>
      <p>
        Questions about these Terms:{' '}
        <a href="mailto:info@quote-core.com">info@quote-core.com</a>.
      </p>
    </LegalPageShell>
  );
}
