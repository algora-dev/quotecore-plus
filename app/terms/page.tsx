import Link from 'next/link';
import { LegalPageShell } from '@/app/components/LegalPageShell';
import { hreflangLanguages } from '@/lib/seo/hreflang';

export const metadata = {
  title: 'Terms of Service - QuoteCore+',
  description: 'The terms under which QuoteCore+ is provided.',
  alternates: { canonical: 'https://quote-core.com/terms', languages: hreflangLanguages('/terms') },
};

const TOC = [
  { id: 'who-we-are', label: '1. Who we are' },
  { id: 'business-service', label: '2. Business service' },
  { id: 'accounts-and-workspaces', label: '3. Accounts and Workspaces' },
  { id: 'trials-and-free-access', label: '4. Trials and free access' },
  { id: 'paid-subscriptions', label: '5. Paid subscriptions' },
  { id: 'prices-and-plan-changes', label: '6. Prices and Plan changes' },
  { id: 'cancellation-and-refunds', label: '7. Cancellation and refunds' },
  { id: 'acceptable-use', label: '8. Acceptable use' },
  { id: 'customer-data', label: '9. Customer Data' },
  { id: 'data-protection', label: '10. Data protection and privacy' },
  { id: 'data-retention', label: '11. Data retention, export and deletion' },
  { id: 'security', label: '12. Security' },
  { id: 'quote-outputs', label: '13. Quote, takeoff and calculation outputs' },
  { id: 'ai-features', label: '14. Artificial-intelligence features' },
  { id: 'free-tools', label: '15. Free Tools' },
  { id: 'beta-features', label: '16. Beta, preview and early-access' },
  { id: 'intellectual-property', label: '17. Intellectual property' },
  { id: 'third-party-services', label: '18. Third-party services' },
  { id: 'availability', label: '19. Availability, maintenance and support' },
  { id: 'suspension-and-termination', label: '20. Suspension and termination' },
  { id: 'confidentiality', label: '21. Confidentiality' },
  { id: 'service-warranties', label: '22. Service warranties' },
  { id: 'limitation-of-liability', label: '23. Limitation of liability' },
  { id: 'indemnities', label: '24. Indemnities' },
  { id: 'changes-to-terms', label: '25. Changes to these Terms' },
  { id: 'governing-law', label: '26. Governing law and disputes' },
  { id: 'dmca', label: '27. DMCA and IP takedown' },
  { id: 'export-controls', label: '28. Export controls and sanctions' },
  { id: 'general-provisions', label: '29. General provisions' },
];

export default function TermsOfServicePage() {
  return (
    <LegalPageShell title="Terms of Service" effectiveDate="17 July 2026 (v2.0)" toc={TOC}>
      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) govern access to and use of the QuoteCore<span className="text-orange-500">+</span> websites, applications, free tools and related services.
      </p>
      <p>
        Please read these Terms carefully. By creating an account, starting a trial, purchasing a subscription, accepting an invitation to a workspace, or otherwise using QuoteCore<span className="text-orange-500">+</span>, you agree to be bound by them.
      </p>
      <p>
        If you use QuoteCore<span className="text-orange-500">+</span> for a company, partnership, sole-trader business or other organisation, you confirm that you have authority to accept these Terms on its behalf. In that case, &ldquo;you&rdquo; and &ldquo;your&rdquo; refer to that organisation and its authorised users.
      </p>

      <h2 id="who-we-are">1. Who we are</h2>
      <p>QuoteCore<span className="text-orange-500">+</span> is operated by:</p>
      <ul>
        <li><strong>T3 Play Limited</strong></li>
        <li>New Zealand company number: 9148617</li>
        <li>NZBN: 9429051941314</li>
        <li>Registered office: 85 Tongariro Street, Halswell, Christchurch 8025, New Zealand</li>
        <li>Email: <a href="mailto:info@quote-core.com">info@quote-core.com</a></li>
      </ul>
      <p>In these Terms, &ldquo;QuoteCore<span className="text-orange-500">+</span>&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo; and &ldquo;our&rdquo; mean T3 Play Limited.</p>

      <h2 id="business-service">2. Business service</h2>
      <p>QuoteCore<span className="text-orange-500">+</span> is a software platform designed to help tradespeople, contractors and construction businesses prepare quotations, organise jobs, manage materials, create documents and perform related business activities.</p>
      <p>The Service is intended primarily for business and professional use. You must:</p>
      <ul>
        <li>be at least 18 years old;</li>
        <li>have legal capacity to enter into a contract; and</li>
        <li>have authority to act for any business or organisation whose account or workspace you create or use.</li>
      </ul>
      <p>You must not create an account on behalf of another person or organisation without authority.</p>
      <p>Where mandatory consumer laws apply despite the business purpose of the Service, nothing in these Terms excludes or limits rights that cannot legally be excluded or limited.</p>

      <h2 id="accounts-and-workspaces">3. Accounts and Workspaces</h2>
      <h3>3.1 Account information</h3>
      <p>You must provide accurate and current information when creating or managing an Account.</p>
      <p>You are responsible for:</p>
      <ul>
        <li>protecting your login credentials;</li>
        <li>using a strong and unique password;</li>
        <li>enabling multi-factor authentication where available;</li>
        <li>keeping your contact and billing information current;</li>
        <li>restricting access to authorised people; and</li>
        <li>all activity occurring through your Account or Workspace, except to the extent caused by our breach of these Terms.</li>
      </ul>
      <p>You must notify us promptly if you suspect unauthorised access, credential theft or another security incident.</p>
      <h3>3.2 Individual logins</h3>
      <p>Each person must use their own Account. Login credentials must not be shared between users.</p>
      <p>You may only permit the number of Authorised Users included in your Plan. We may require you to purchase additional seats where applicable.</p>
      <h3>3.3 Workspace administrators</h3>
      <p>A Workspace administrator may manage users, permissions, billing and Customer Data for that Workspace.</p>
      <p>You are responsible for selecting appropriate administrators and managing access when a user changes role or leaves your organisation.</p>
      <p>If a Workspace ownership dispute arises, we may request reasonable evidence of authority before changing control. We are not required to resolve internal employment, ownership or commercial disputes between users.</p>
      <h3>3.4 Account security</h3>
      <p>We may temporarily restrict access where we reasonably believe that:</p>
      <ul>
        <li>an Account has been compromised;</li>
        <li>continued access creates a security risk;</li>
        <li>activity is fraudulent or unlawful; or</li>
        <li>immediate action is necessary to protect the Service, our users or third parties.</li>
      </ul>
      <p>Where reasonably possible, we will explain the restriction and provide a way to restore access.</p>

      <h2 id="trials-and-free-access">4. Trials and free access</h2>
      <p>We may offer free trials, free Plans or promotional access.</p>
      <p>Unless stated otherwise at signup:</p>
      <ul>
        <li>the standard trial period is 14 days;</li>
        <li>no payment details are required to begin the trial; and</li>
        <li>the trial does not automatically become a paid subscription unless you actively select a paid Plan and authorise payment.</li>
      </ul>
      <p>At the end of a trial, access will move to a limited free state with restricted features, storage and usage limits. The applicable limits will be explained at signup or before the trial ends.</p>
      <p>We may change or withdraw trials and free Plans for future users. Where reasonably possible, we will allow an existing trial to run for the period originally offered.</p>
      <p>Free and trial access may have different storage, support, usage and feature limits from paid Plans.</p>

      <h2 id="paid-subscriptions">5. Paid subscriptions</h2>
      <h3>5.1 Plans</h3>
      <p>Paid Plan features, limits, billing intervals and prices are shown on the pricing or checkout page when you subscribe.</p>
      <p>Your Order and these Terms form the agreement for your subscription. If an Order expressly conflicts with these Terms, the Order takes priority only for that specific commercial detail.</p>
      <h3>5.2 Monthly and annual billing</h3>
      <p>Subscriptions are currently offered on a monthly billing cycle. Annual billing may be offered in the future — where available, the billing interval and any discount will be displayed at checkout.</p>
      <p>You authorise us and our payment processor to charge the payment method you provide:</p>
      <ul>
        <li>when your paid subscription starts; and</li>
        <li>at the beginning of each renewal period.</li>
      </ul>
      <p>The billing date, billing interval, currency and amount will be displayed before you confirm payment.</p>
      <h3>5.3 Automatic renewal</h3>
      <p>Paid subscriptions renew automatically for the same billing interval unless cancelled before the renewal date.</p>
      <p>We will make automatic renewal clear during checkout. You can cancel through your Account settings or by contacting us.</p>
      <p>Cancellation takes effect at the end of the current paid billing period unless we state otherwise or applicable law requires a different outcome.</p>
      <h3>5.4 Payment processing</h3>
      <p>Payments are processed by Stripe or another payment provider identified at checkout.</p>
      <p>We do not normally receive or store your full payment-card details. Your use of payment services may also be subject to the payment provider&apos;s terms and privacy practices.</p>
      <h3>5.5 Taxes and currency</h3>
      <p>Prices are charged in USD at checkout. Stripe may present prices in your local currency for display purposes, but the charge is processed in USD.</p>
      <p>Prices are inclusive of applicable GST, VAT, sales tax or other taxes where required by law, or exclusive where clearly shown before payment. You are responsible for applicable taxes except taxes imposed on our net income.</p>
      <p>Your payment provider or bank may apply currency-conversion or international transaction charges. We do not control those charges.</p>
      <h3>5.6 Failed payments</h3>
      <p>If payment fails, we may:</p>
      <ul>
        <li>retry the payment method;</li>
        <li>notify the billing contact;</li>
        <li>provide a reasonable grace period;</li>
        <li>restrict paid features;</li>
        <li>place the Workspace into a limited or read-only state; or</li>
        <li>suspend the subscription.</li>
      </ul>
      <p>We will not intentionally delete Customer Data immediately because of a single failed payment.</p>
      <p>If payment remains unresolved, we may terminate the subscription in accordance with section 20.</p>
      <h3>5.7 Upgrades and downgrades</h3>
      <p>Plan upgrades may take effect immediately and may result in a prorated charge.</p>
      <p>Plan downgrades normally take effect at the next renewal date unless stated otherwise. A downgrade may reduce features, storage, users or usage limits.</p>
      <p>Before downgrading, you are responsible for reviewing whether your current use exceeds the new Plan&apos;s limits.</p>

      <h2 id="prices-and-plan-changes">6. Prices and Plan changes</h2>
      <p>We may change Plan prices or packaging.</p>
      <p>For existing paid subscriptions:</p>
      <ul>
        <li>price increases will not apply retrospectively;</li>
        <li>we will give at least 30 days&apos; notice before a price increase takes effect; and</li>
        <li>a price increase will normally take effect at your next renewal.</li>
      </ul>
      <p>If you do not accept the change, you may cancel before the new price takes effect.</p>
      <p>We may make reasonable changes to features where necessary to:</p>
      <ul>
        <li>improve the Service;</li>
        <li>respond to user feedback;</li>
        <li>maintain security or legal compliance;</li>
        <li>replace third-party technology;</li>
        <li>prevent abuse; or</li>
        <li>reflect technical or commercial developments.</li>
      </ul>
      <p>We will provide reasonable notice where a change materially reduces the core functionality of a paid Plan.</p>
      <p>If we permanently remove a material paid feature during a prepaid subscription period and do not provide a reasonably equivalent alternative, you may contact us. Where appropriate, we may offer a remedy such as an alternative Plan, credit or pro-rata refund.</p>

      <h2 id="cancellation-and-refunds">7. Cancellation and refunds</h2>
      <h3>7.1 Cancellation by you</h3>
      <p>You may cancel at any time through your Account settings or by contacting us.</p>
      <p>Unless applicable law or your Order states otherwise:</p>
      <ul>
        <li>cancellation stops future renewals;</li>
        <li>you retain access until the end of the current paid billing period; and</li>
        <li>fees already paid are not automatically refundable.</li>
      </ul>
      <h3>7.2 Refund requests</h3>
      <p>We may consider refund requests on a case-by-case basis, including where:</p>
      <ul>
        <li>you were charged after cancelling correctly;</li>
        <li>there was a duplicate or incorrect charge;</li>
        <li>a material failure prevented reasonable use of the paid Service;</li>
        <li>we terminated a prepaid subscription without cause; or</li>
        <li>applicable law requires a refund.</li>
      </ul>
      <p>We are not required to refund fees merely because you did not use the Service or forgot to cancel before renewal, except where required by law.</p>
      <h3>7.3 Service withdrawal</h3>
      <p>If we permanently discontinue the paid Service and do not provide a reasonably comparable replacement, we will provide reasonable notice and refund prepaid fees covering the period after termination.</p>
      <h3>7.4 Statutory rights</h3>
      <p>Nothing in this section affects any statutory right or remedy that cannot legally be excluded.</p>

      <h2 id="acceptable-use">8. Acceptable use</h2>
      <p>You may use the Service only for lawful internal business purposes.</p>
      <p>You must not, and must not assist another person to:</p>
      <ul>
        <li>break any law or regulation;</li>
        <li>infringe intellectual-property, privacy or other rights;</li>
        <li>upload content you are not authorised to use;</li>
        <li>send spam, phishing messages or unlawful marketing;</li>
        <li>introduce malware, malicious code or harmful material;</li>
        <li>gain or attempt to gain unauthorised access;</li>
        <li>bypass security, authentication, rate limits or Plan restrictions;</li>
        <li>probe, scan or test vulnerabilities without our written permission;</li>
        <li>disrupt the Service or another user&apos;s access;</li>
        <li>scrape, mirror or harvest the Service through automated means except through an authorised interface;</li>
        <li>reverse-engineer, decompile or attempt to obtain source code, except where this restriction is prohibited by law;</li>
        <li>rent, resell, sublicense or commercially provide access to the Service without our written agreement;</li>
        <li>use the Service to develop or train a directly competing product through systematic extraction;</li>
        <li>impersonate another person or misrepresent your authority;</li>
        <li>upload highly sensitive data that the Service is not designed to process; or</li>
        <li>use the Service in a manner that creates an unreasonable security, legal or operational risk.</li>
      </ul>
      <h3>8.1 AI-specific acceptable use</h3>
      <p>Where the Service provides artificial-intelligence or automated processing features, you must not:</p>
      <ul>
        <li>use AI features to generate unlawful, defamatory, fraudulent, or infringing content;</li>
        <li>use AI features to create deepfakes, synthetic media, or impersonations of real persons without their consent;</li>
        <li>submit content to AI features that infringes third-party intellectual-property rights;</li>
        <li>use AI features to process special-category personal data unless you have a lawful basis and have obtained any necessary consent;</li>
        <li>attempt to extract, reconstruct, or replicate the underlying AI models; or</li>
        <li>use AI outputs in a manner that violates applicable law or third-party rights.</li>
      </ul>
      <p>Reasonable use of published APIs or authorised integrations is permitted in accordance with their documentation and applicable limits.</p>

      <h2 id="customer-data">9. Customer Data</h2>
      <h3>9.1 Ownership</h3>
      <p>As between you and us, you retain ownership of Customer Data.</p>
      <p>You grant us a limited, non-exclusive licence to host, copy, transmit, display, back up and otherwise process Customer Data only as reasonably necessary to:</p>
      <ul>
        <li>provide and secure the Service;</li>
        <li>provide support requested by you;</li>
        <li>prevent fraud or abuse;</li>
        <li>comply with law; and</li>
        <li>exercise our rights under these Terms.</li>
      </ul>
      <p>This licence ends when Customer Data is deleted from our active systems, subject to backups, legal retention and the other provisions of these Terms.</p>
      <h3>9.2 Your responsibilities</h3>
      <p>You are responsible for:</p>
      <ul>
        <li>the accuracy and legality of Customer Data;</li>
        <li>obtaining required permissions and notices;</li>
        <li>having a lawful basis to process personal information;</li>
        <li>responding to your own customers and data subjects;</li>
        <li>configuring access and permissions appropriately;</li>
        <li>reviewing information before sending or relying on it; and</li>
        <li>maintaining exports or independent records where commercially necessary.</li>
      </ul>
      <p>You must not instruct us to process Customer Data unlawfully.</p>
      <h3>9.3 Our role</h3>
      <p>For personal information we process on your behalf within quotes, jobs, customer records and similar business content, you will generally act as the responsible business or data controller and we will act as your service provider or processor.</p>
      <p>Our separate Data Processing Addendum, where applicable, forms part of these Terms.</p>
      <p>For information we collect to administer Accounts, subscriptions, security and our own business operations, we act as described in our <Link href="/privacy">Privacy Policy</Link>.</p>
      <h3>9.4 Aggregated data</h3>
      <p>We may create and use statistics derived from use of the Service where those statistics have been aggregated or de-identified so that they do not identify you, your customers or another individual.</p>
      <p>We may use that information to:</p>
      <ul>
        <li>operate and improve the Service;</li>
        <li>understand feature usage;</li>
        <li>monitor reliability and security; and</li>
        <li>produce general business analytics.</li>
      </ul>
      <p>We will not sell identifiable Customer Data or use it for third-party advertising.</p>
      <h3>9.5 Artificial-intelligence training</h3>
      <p>We do not use identifiable Customer Data to train artificial-intelligence models.</p>
      <p>Where an AI feature uses a third-party provider (currently OpenAI), the applicable feature notice or Privacy Policy will explain the relevant data handling. We use OpenAI&apos;s API services for document parsing and assistance features. Data sent to OpenAI via API is processed under OpenAI&apos;s enterprise data terms, which prohibit the use of customer API data for training their models.</p>

      <h2 id="data-protection">10. Data protection and privacy</h2>
      <p>Our collection and use of personal information is described in our <Link href="/privacy">Privacy Policy</Link>.</p>
      <p>Our use of cookies and similar technologies is described in our <Link href="/cookie-policy">Cookie Policy</Link>.</p>
      <h3>10.1 Data Processing Addendum</h3>
      <p>We make a Data Processing Addendum (DPA) available to customers who require one for GDPR or similar compliance. The DPA forms part of these Terms when executed. A copy is available on request at <a href="mailto:info@quote-core.com">info@quote-core.com</a>.</p>
      <h3>10.2 Subprocessors</h3>
      <p>We use the following categories of subprocessors to provide the Service:</p>
      <table>
        <thead>
          <tr><th>Category</th><th>Provider</th><th>Purpose</th><th>Data location</th></tr>
        </thead>
        <tbody>
          <tr><td>Database, auth, storage</td><td>Supabase</td><td>Primary data store, user auth, file storage</td><td>Sydney, Australia</td></tr>
          <tr><td>Web hosting</td><td>Vercel</td><td>Application hosting, edge delivery</td><td>Global edge; primary data in US</td></tr>
          <tr><td>Transactional email</td><td>Resend</td><td>Password resets, quote alerts, security notifications</td><td>US-based</td></tr>
          <tr><td>AI processing</td><td>OpenAI</td><td>Document parsing, smart component assistance</td><td>US-based (API data not used for training)</td></tr>
          <tr><td>Payment processing</td><td>Stripe</td><td>Subscription billing</td><td>US-based (global infrastructure)</td></tr>
          <tr><td>Identity provider</td><td>Google</td><td>Google sign-in option</td><td>US-based</td></tr>
        </tbody>
      </table>
      <p>We remain responsible for our obligations under these Terms and the DPA. We will provide advance notice of material changes to subprocessors where required by applicable law.</p>
      <h3>10.3 International data transfers</h3>
      <p>Providing the Service may involve processing in countries other than your own, including the United States, Australia and New Zealand. For transfers of personal data from the EEA, UK or Switzerland, we rely on Standard Contractual Clauses (SCCs) as adopted by the European Commission, or other lawful transfer mechanisms where applicable.</p>
      <h3>10.4 UK GDPR and EU GDPR</h3>
      <p>Where you are located in the EEA or UK, we process personal data in accordance with the GDPR and UK GDPR respectively. You act as the data controller for Customer Data containing personal information of your customers, and we act as your data processor. Our Privacy Policy and DPA describe the terms of that processing.</p>
      <h3>10.5 Australian Consumer Law</h3>
      <p>If you are located in Australia, nothing in these Terms excludes, restricts or modifies any non-excludable consumer guarantee, right or remedy conferred by the Australian Consumer Law (Schedule 2 of the Competition and Consumer Act 2010 (Cth)) or any other applicable Australian law. Where such a non-excludable right is breached, our liability is limited, to the maximum extent permitted by law, to re-supplying the affected Service or paying the cost of having the Service re-supplied.</p>

      <h2 id="data-retention">11. Data retention, export and deletion</h2>
      <h3>11.1 During your subscription</h3>
      <p>You may access and export Customer Data using the export features made available under your Plan.</p>
      <p>You should regularly export commercially critical records. QuoteCore<span className="text-orange-500">+</span> is not intended to be your only permanent archive for records that you are legally required to retain.</p>
      <h3>11.2 After cancellation or termination</h3>
      <p>Unless otherwise stated:</p>
      <ul>
        <li>access continues until the end of your paid billing period;</li>
        <li>after access ends, we may place the Workspace into a restricted or read-only state;</li>
        <li>Customer Data will remain available for export for up to 30 days; and</li>
        <li>after that period, we may delete Customer Data from active systems.</li>
      </ul>
      <p>You are responsible for completing exports before the deadline.</p>
      <h3>11.3 Backups and retained records</h3>
      <p>Deleted information may remain temporarily in encrypted backups until those backups are overwritten through our ordinary retention cycle.</p>
      <p>We may retain limited information where reasonably necessary for:</p>
      <ul>
        <li>tax and accounting obligations;</li>
        <li>fraud prevention;</li>
        <li>security records;</li>
        <li>dispute resolution;</li>
        <li>legal claims;</li>
        <li>enforcing these Terms; or</li>
        <li>complying with law.</li>
      </ul>
      <p>Backup and legally retained data will remain protected and will not be restored to active use except where necessary for recovery, security or legal compliance.</p>

      <h2 id="security">12. Security</h2>
      <p>We use reasonable technical and organisational safeguards designed to protect the Service and Customer Data.</p>
      <p>These include encryption in transit (HTTPS/TLS), encryption at rest, access controls, authentication controls (including optional two-factor authentication), row-level security policies on the database, rate-limiting on security-sensitive operations, logging, backups and database security measures.</p>
      <p>No online service can guarantee absolute security. You are responsible for:</p>
      <ul>
        <li>securing your devices and networks;</li>
        <li>managing Authorised Users;</li>
        <li>keeping credentials confidential;</li>
        <li>using multi-factor authentication where available; and</li>
        <li>promptly reporting suspected security incidents.</li>
      </ul>
      <p>If we become aware of a security incident affecting Customer Data, we will investigate and provide notifications required by applicable law and any applicable Data Processing Addendum.</p>
      <p>You may not conduct penetration testing or vulnerability scanning without our written permission. Security concerns may be reported to <a href="mailto:info@quote-core.com">info@quote-core.com</a>.</p>

      <h2 id="quote-outputs">13. Quote, takeoff and calculation outputs</h2>
      <p>QuoteCore<span className="text-orange-500">+</span> assists with business calculations and document preparation. It does not replace professional judgment.</p>
      <p>Outputs may depend on information and settings supplied by you, including:</p>
      <ul>
        <li>measurements;</li>
        <li>dimensions and quantities;</li>
        <li>labour and material rates;</li>
        <li>price lists and catalogues;</li>
        <li>waste factors;</li>
        <li>pitch and coverage assumptions;</li>
        <li>margins and mark-ups;</li>
        <li>tax and VAT settings;</li>
        <li>templates;</li>
        <li>Smart Components;</li>
        <li>imported files; and</li>
        <li>rounding rules.</li>
      </ul>
      <p>You are responsible for checking all inputs and outputs before:</p>
      <ul>
        <li>relying on them;</li>
        <li>ordering materials;</li>
        <li>beginning work;</li>
        <li>agreeing a price;</li>
        <li>issuing a quote, invoice or order; or</li>
        <li>providing them to another person.</li>
      </ul>
      <p>Generated measurements, quantities, prices, margins and documents may contain errors caused by incorrect inputs, configuration, third-party information or software limitations.</p>
      <p>QuoteCore<span className="text-orange-500">+</span> does not provide:</p>
      <ul>
        <li>surveying or quantity-surveying services;</li>
        <li>structural-engineering advice;</li>
        <li>architectural advice;</li>
        <li>legal or tax advice;</li>
        <li>health-and-safety advice;</li>
        <li>building-code approval;</li>
        <li>manufacturer approval; or</li>
        <li>a guarantee that work complies with local laws, standards or specifications.</li>
      </ul>
      <p>You remain responsible for professional checks, site verification and contractual commitments made to your own customers and suppliers.</p>

      <h2 id="ai-features">14. Artificial-intelligence features</h2>
      <p>Some features may use artificial intelligence or automated processing, including document parsing, measurement assistance, and Smart Component generation.</p>
      <p>AI-generated content may be incomplete, inaccurate or unsuitable. You must review AI output before using, publishing, sending or relying on it.</p>
      <p>You must not use AI features to make decisions that legally require human judgment or qualified professional advice.</p>
      <p>You are responsible for ensuring that material submitted to an AI feature:</p>
      <ul>
        <li>may lawfully be processed;</li>
        <li>does not contain unnecessary sensitive information;</li>
        <li>does not violate confidentiality obligations; and</li>
        <li>does not infringe third-party rights.</li>
      </ul>
      <p>We may impose additional conditions or usage limits for particular AI features.</p>

      <h2 id="free-tools">15. Free Tools</h2>
      <p>Free Tools are provided for convenience and general informational use.</p>
      <p>Results are estimates based on the information entered and the assumptions built into the relevant tool. They may not reflect:</p>
      <ul>
        <li>actual site conditions;</li>
        <li>product-specific installation requirements;</li>
        <li>local building standards;</li>
        <li>supplier pricing;</li>
        <li>labour requirements;</li>
        <li>applicable taxes; or</li>
        <li>all waste, risk and contingency factors.</li>
      </ul>
      <p>You must independently verify results before relying on them.</p>
      <p>We may modify, limit or withdraw a Free Tool at any time. Free Tools may not receive the same support, availability commitments or data-retention features as paid Plans.</p>
      <p>Free Tools are covered by these Terms. By using Free Tools, you agree to be bound by these Terms whether or not you have a paid Account.</p>

      <h2 id="beta-features">16. Beta, preview and early-access features</h2>
      <p>We may make beta, preview, experimental or early-access features available.</p>
      <p>We will identify these features where reasonably practical.</p>
      <p>Such features:</p>
      <ul>
        <li>may be incomplete;</li>
        <li>may change materially;</li>
        <li>may have errors;</li>
        <li>may be subject to additional limits;</li>
        <li>may not be covered by support or availability commitments; and</li>
        <li>may be withdrawn.</li>
      </ul>
      <p>You should not use an experimental feature as the sole basis for a critical business decision.</p>
      <p>The rest of the paid Service is not treated as beta merely because an individual feature is experimental.</p>

      <h2 id="intellectual-property">17. Intellectual property</h2>
      <p>We and our licensors own all rights in the Service, including:</p>
      <ul>
        <li>software and source code;</li>
        <li>user-interface designs;</li>
        <li>Documentation;</li>
        <li>databases and platform structure;</li>
        <li>trademarks, logos and branding;</li>
        <li>default templates (quote, invoice, purchase order, and other templates supplied by us); and</li>
        <li>improvements and derivative works.</li>
      </ul>
      <p>Subject to these Terms and payment of applicable fees, we grant you a limited, non-exclusive, non-transferable and revocable right to access and use the Service during your subscription for your internal business purposes.</p>
      <p>This right does not permit you to copy, sell, sublicense or create a competing service from QuoteCore<span className="text-orange-500">+</span>.</p>
      <h3>17.1 Your materials</h3>
      <p>You retain ownership of your:</p>
      <ul>
        <li>business branding;</li>
        <li>uploaded material;</li>
        <li>customer records;</li>
        <li>original templates created by you;</li>
        <li>Smart Components (including the component data, specifications, pricing and configuration you create);</li>
        <li>quotes, invoices and orders; and</li>
        <li>other Customer Data.</li>
      </ul>
      <h3>17.2 Feedback</h3>
      <p>If you provide suggestions or feedback, you grant us permission to use them to improve and develop the Service without payment or restriction.</p>
      <p>This does not transfer ownership of your Customer Data or confidential information.</p>

      <h2 id="third-party-services">18. Third-party services</h2>
      <p>The Service relies on third-party infrastructure and may integrate with third-party products.</p>
      <p>Third-party services include hosting (Vercel), databases and authentication (Supabase), storage (Supabase), payment processing (Stripe), email delivery (Resend), artificial intelligence (OpenAI), file processing and external catalogues.</p>
      <p>We remain responsible for our obligations under these Terms, but we do not control every aspect of third-party systems.</p>
      <p>A third-party outage, change or restriction may temporarily affect a feature. Where practical, we will take reasonable steps to restore service or provide an alternative.</p>
      <p>Your direct use of a third-party product may be governed by that provider&apos;s terms.</p>

      <h2 id="availability">19. Availability, maintenance and support</h2>
      <p>We aim to provide a reliable Service but do not guarantee uninterrupted or error-free operation. The Service is provided on a best-efforts basis without a guaranteed uptime or service-level commitment unless a separate written service-level agreement expressly applies.</p>
      <p>We may perform:</p>
      <ul>
        <li>planned maintenance;</li>
        <li>emergency maintenance;</li>
        <li>security updates;</li>
        <li>infrastructure changes; and</li>
        <li>temporary restrictions necessary to protect the Service.</li>
      </ul>
      <p>Where practical, we will provide at least 48 hours&apos; advance notice of planned maintenance that is likely to cause significant disruption.</p>
      <p>Support is available via email (info@quote-core.com) and phone. Our aim is to respond to support enquiries within 24 hours during business days. Response times are targets and not guaranteed resolution times. Support channels and response targets may depend on your Plan.</p>

      <h2 id="suspension-and-termination">20. Suspension and termination</h2>
      <h3>20.1 Suspension</h3>
      <p>We may suspend or restrict access where reasonably necessary because of:</p>
      <ul>
        <li>overdue payment;</li>
        <li>material breach of these Terms;</li>
        <li>suspected fraud or unlawful activity;</li>
        <li>a security incident or compromised Account;</li>
        <li>excessive or harmful usage;</li>
        <li>risk to other users or infrastructure;</li>
        <li>a legal requirement; or</li>
        <li>use that may expose us or another person to material liability.</li>
      </ul>
      <p>Where the issue can reasonably be remedied, we will normally provide notice and an opportunity to do so.</p>
      <p>We may act without advance notice where urgent action is reasonably required for security, safety, fraud prevention or legal compliance.</p>
      <h3>20.2 Termination by you</h3>
      <p>You may terminate your subscription by cancelling it in accordance with section 7.</p>
      <h3>20.3 Termination by us for breach</h3>
      <p>We may terminate your Account or subscription if:</p>
      <ul>
        <li>you materially breach these Terms and do not remedy the breach within a reasonable period after notice;</li>
        <li>the breach cannot reasonably be remedied;</li>
        <li>you repeatedly breach these Terms;</li>
        <li>your activity is fraudulent or unlawful;</li>
        <li>continued provision would create a material security or legal risk; or</li>
        <li>payment remains overdue after reasonable notice.</li>
      </ul>
      <h3>20.4 Termination by us without cause</h3>
      <p>We may discontinue your paid subscription without cause by giving reasonable advance notice.</p>
      <p>If we terminate a prepaid paid subscription without cause, we will provide a pro-rata refund for the unused period, unless we provide a reasonably equivalent replacement service accepted by you.</p>
      <h3>20.5 Inactive free Accounts</h3>
      <p>We may close an inactive free Account after 6 months of inactivity. We will give reasonable notice and an opportunity to export available Customer Data before closure.</p>
      <h3>20.6 Consequences</h3>
      <p>When access ends:</p>
      <ul>
        <li>your right to use the Service ends;</li>
        <li>unpaid fees remain payable;</li>
        <li>data export and deletion are handled under section 11; and</li>
        <li>provisions intended by their nature to continue will survive.</li>
      </ul>

      <h2 id="confidentiality">21. Confidentiality</h2>
      <p>Each party may receive confidential information from the other.</p>
      <p>Confidential information includes non-public commercial, technical, security and business information, as well as Customer Data.</p>
      <p>The receiving party must:</p>
      <ul>
        <li>use confidential information only for the purposes of the relationship;</li>
        <li>protect it using reasonable care;</li>
        <li>disclose it only to people who need it and are subject to appropriate confidentiality obligations; and</li>
        <li>not disclose it to third parties except as permitted by these Terms.</li>
      </ul>
      <p>These obligations do not apply to information that:</p>
      <ul>
        <li>is or becomes public without breach;</li>
        <li>was lawfully known without restriction;</li>
        <li>is independently developed without use of the confidential information; or</li>
        <li>is lawfully received from another source.</li>
      </ul>
      <p>A party may disclose confidential information where legally required, provided it gives notice where legally permitted.</p>

      <h2 id="service-warranties">22. Service warranties</h2>
      <p>We warrant that during a paid subscription:</p>
      <ul>
        <li>we will provide the Service with reasonable care and skill;</li>
        <li>the Service will materially conform to its published Documentation; and</li>
        <li>we will use reasonable efforts to investigate and correct reproducible material defects reported to us.</li>
      </ul>
      <p>Your primary remedy for breach of this section is for us to reperform the affected service or correct the material defect within a reasonable period.</p>
      <p>If we cannot do so, you may terminate the materially affected paid subscription and request a pro-rata refund for the unused prepaid period.</p>
      <p>These warranties do not apply where an issue is caused by:</p>
      <ul>
        <li>incorrect data or configuration supplied by you;</li>
        <li>unauthorised modification or use;</li>
        <li>unsupported devices or software;</li>
        <li>third-party services outside our reasonable control;</li>
        <li>failure to follow Documentation; or</li>
        <li>beta, preview or Free Tool functionality.</li>
      </ul>
      <p>Except as expressly stated and to the maximum extent permitted by law, we exclude implied warranties, conditions and representations.</p>
      <p>Nothing in these Terms excludes a guarantee or remedy that cannot lawfully be excluded.</p>

      <h2 id="limitation-of-liability">23. Limitation of liability</h2>
      <h3>23.1 Excluded losses</h3>
      <p>To the maximum extent permitted by law, neither party will be liable for:</p>
      <ul>
        <li>indirect or consequential loss;</li>
        <li>loss of anticipated profit;</li>
        <li>loss of anticipated revenue;</li>
        <li>loss of business opportunity;</li>
        <li>loss of goodwill; or</li>
        <li>loss arising from a decision made using an output that the customer failed to review reasonably.</li>
      </ul>
      <p>This exclusion does not apply where such loss is a direct and reasonably foreseeable result of a breach for which liability cannot lawfully be excluded.</p>
      <h3>23.2 General liability cap</h3>
      <p>Subject to sections 23.3 and 23.4, each party&apos;s total aggregate liability arising out of or relating to the Service or these Terms during any rolling 12-month period will not exceed the fees paid or payable by you for the Service during the 12 months immediately preceding the event giving rise to liability.</p>
      <p>For a claim arising during a free trial or free Plan, our aggregate liability will not exceed NZD 100.</p>
      <h3>23.3 Data, confidentiality and security cap</h3>
      <p>Our total aggregate liability for breach of confidentiality, breach of applicable data-protection obligations, or a security incident caused by our failure to use reasonable safeguards will not exceed two times (2x) the fees paid or payable by you for the Service during the 12 months immediately preceding the event giving rise to liability.</p>
      <h3>23.4 Liability that is not limited</h3>
      <p>Nothing in these Terms excludes or limits liability for:</p>
      <ul>
        <li>fraud or fraudulent misrepresentation;</li>
        <li>wilful misconduct;</li>
        <li>death or personal injury caused by negligence where liability cannot be limited;</li>
        <li>infringement for which liability cannot lawfully be limited;</li>
        <li>payment obligations;</li>
        <li>breach of a law that prohibits limitation; or</li>
        <li>any other liability that cannot legally be excluded or limited.</li>
      </ul>
      <h3>23.5 Customer responsibility</h3>
      <p>We are not responsible for losses to the extent caused by:</p>
      <ul>
        <li>inaccurate or incomplete Customer Data;</li>
        <li>failure to review calculations or documents;</li>
        <li>unauthorised Account access resulting from your security failure;</li>
        <li>use contrary to Documentation;</li>
        <li>your contract with a customer, supplier or other third party; or</li>
        <li>failure to retain an independent copy of records where reasonably necessary.</li>
      </ul>
      <p>Each party must take reasonable steps to mitigate loss.</p>

      <h2 id="indemnities">24. Indemnities</h2>
      <h3>24.1 Your indemnity</h3>
      <p>You will indemnify us against a third-party claim to the extent it arises from:</p>
      <ul>
        <li>unlawful Customer Data;</li>
        <li>an allegation that Customer Data infringes third-party rights;</li>
        <li>your unlawful or unauthorised use of the Service; or</li>
        <li>your material breach of section 8.</li>
      </ul>
      <p>This indemnity does not apply to the extent the claim was caused by our breach, negligence, unauthorised modification or instructions.</p>
      <h3>24.2 Our intellectual-property indemnity</h3>
      <p>We will defend you against a third-party claim alleging that your authorised use of the unmodified paid Service infringes that third party&apos;s intellectual-property rights, and will pay damages finally awarded or agreed in settlement by us.</p>
      <p>This does not apply where a claim arises from:</p>
      <ul>
        <li>Customer Data;</li>
        <li>use with products not supplied or approved by us;</li>
        <li>modification not made by us;</li>
        <li>continued use after we provide a non-infringing alternative;</li>
        <li>use outside these Terms or Documentation; or</li>
        <li>a free, beta or preview feature.</li>
      </ul>
      <p>If such a claim is likely, we may:</p>
      <ul>
        <li>obtain the right for you to continue using the Service;</li>
        <li>modify or replace the affected part; or</li>
        <li>terminate the affected subscription and provide a pro-rata refund.</li>
      </ul>
      <h3>24.3 Claims process</h3>
      <p>An indemnified party must:</p>
      <ul>
        <li>notify the other party promptly;</li>
        <li>provide reasonable cooperation;</li>
        <li>allow the indemnifying party to control the defence and settlement; and</li>
        <li>not admit liability without consent.</li>
      </ul>
      <p>No settlement may impose liability, an admission or a non-monetary obligation on the indemnified party without its consent.</p>

      <h2 id="changes-to-terms">25. Changes to these Terms</h2>
      <p>We may update these Terms to reflect:</p>
      <ul>
        <li>changes to the Service;</li>
        <li>legal or regulatory requirements;</li>
        <li>security needs;</li>
        <li>improvements in clarity; or</li>
        <li>changes to our commercial offering.</li>
      </ul>
      <p>For a material change, we will normally provide at least 30 days&apos; notice by email, in-app notice or another reasonable method.</p>
      <p>A change required urgently for law, security or abuse prevention may take effect sooner.</p>
      <p>Changes will not retrospectively alter fees already paid or materially reduce a prepaid subscription without an appropriate remedy.</p>
      <p>If you do not accept a material change, you may cancel before it takes effect. Continued use after the effective date constitutes acceptance, to the extent permitted by law.</p>

      <h2 id="governing-law">26. Governing law and disputes</h2>
      <p>These Terms and any non-contractual dispute arising from them are governed by New Zealand law.</p>
      <p>The courts of New Zealand have exclusive jurisdiction, except where:</p>
      <ul>
        <li>mandatory law gives a party the right to bring proceedings elsewhere; or</li>
        <li>the parties agree in writing to another dispute process.</li>
      </ul>
      <p>Before beginning formal proceedings, each party should attempt in good faith to resolve the dispute by giving written notice describing:</p>
      <ul>
        <li>the issue;</li>
        <li>the relevant facts;</li>
        <li>the desired resolution; and</li>
        <li>an appropriate contact person.</li>
      </ul>
      <p>Senior representatives should attempt to resolve the dispute for at least 30 days after notice, unless urgent injunctive or protective relief is required.</p>
      <p>Nothing in this section prevents either party from seeking urgent relief to protect data, security, confidentiality or intellectual-property rights.</p>

      <h2 id="dmca">27. DMCA and intellectual-property takedown</h2>
      <p>If you believe that material on or accessible through the Service infringes your copyright, you may submit a takedown notice to us at <a href="mailto:info@quote-core.com">info@quote-core.com</a> with the following information:</p>
      <ul>
        <li>identification of the copyrighted work claimed to have been infringed;</li>
        <li>identification of the material that is claimed to be infringing, including its location on the Service;</li>
        <li>your contact information, including full name, email address and physical address;</li>
        <li>a statement that you have a good-faith belief that the use is not authorised by the copyright owner, its agent or the law;</li>
        <li>a statement, under penalty of perjury, that the information in the notice is accurate and that you are the copyright owner or authorised to act on the owner&apos;s behalf; and</li>
        <li>your physical or electronic signature.</li>
      </ul>
      <p>We will process takedown notices in accordance with applicable law, including the notice-and-counter-notice procedures of the US Digital Millennium Copyright Act (DMCA) where applicable. We reserve the right to remove or disable access to allegedly infringing material and to terminate Accounts of repeat infringers.</p>

      <h2 id="export-controls">28. Export controls and sanctions</h2>
      <p>You must not use, export, re-export or transfer the Service, or any portion thereof, in violation of applicable export control, trade sanction or anti-boycott laws and regulations, including those of New Zealand, Australia, the European Union, the United Kingdom, the United States and the United Nations.</p>
      <p>You represent and warrant that you are not:</p>
      <ul>
        <li>located in, ordinarily resident in, or organised under the laws of a country or territory subject to comprehensive sanctions;</li>
        <li>on any restricted-party or denied-persons list maintained by a relevant government authority; or</li>
        <li>owned or controlled by any person or entity that is subject to sanctions or on a restricted-party list.</li>
      </ul>
      <p>We may suspend or terminate access if we determine, in our reasonable judgement, that your use of the Service violates applicable export control or sanctions requirements.</p>

      <h2 id="general-provisions">29. General provisions</h2>
      <h3>29.1 Notices</h3>
      <p>We may send operational or contractual notices to the email address associated with your Account or display them in the Service.</p>
      <p>You must keep your contact details current.</p>
      <p>Legal notices to us should be sent to <a href="mailto:info@quote-core.com">info@quote-core.com</a> and to our registered office.</p>
      <h3>29.2 Assignment</h3>
      <p>You may not transfer these Terms without our prior written consent, which we will not unreasonably withhold where the transfer forms part of a genuine sale or reorganisation of your business.</p>
      <p>We may transfer these Terms as part of a merger, restructuring, financing, sale of assets or transfer of the Service, provided the transfer does not materially reduce your rights.</p>
      <h3>29.3 Subcontractors</h3>
      <p>We may use affiliates and subcontractors to provide the Service. We remain responsible for our obligations under these Terms.</p>
      <p>Processing of personal information by subprocessors is addressed in our Privacy Policy and any applicable Data Processing Addendum.</p>
      <h3>29.4 Force majeure</h3>
      <p>Neither party is liable for delay or failure caused by circumstances beyond its reasonable control, excluding payment obligations.</p>
      <p>Affected obligations will be suspended for the duration of the event. The affected party must take reasonable steps to reduce the impact.</p>
      <p>If a force-majeure event materially prevents the paid Service for an extended period, either party may terminate the affected subscription. Where appropriate, we will refund prepaid fees covering the period after termination.</p>
      <h3>29.5 Entire agreement</h3>
      <p>These Terms, the applicable Order, Privacy Policy, Cookie Policy, Data Processing Addendum (where executed) and any expressly incorporated service terms form the entire agreement concerning the Service.</p>
      <p>They replace earlier discussions or agreements about the same subject.</p>
      <h3>29.6 Open-source software acknowledgements</h3>
      <p>QuoteCore<span className="text-orange-500">+</span> incorporates open-source software licensed under the MIT Licence and similar permissive licences. Key components include: Next.js, React, Tailwind CSS, Fabric.js, jsPDF, html2canvas, PapaParse, JSZip, bcryptjs, Supabase JS Client, Stripe JS, Resend JS, OpenAI Node SDK, gray-matter, MDX packages, and remark/rehype plugins. Full licence texts are available from the respective project repositories. All open-source components are used in compliance with their licence terms.</p>
      <h3>29.7 Severability</h3>
      <p>If any provision of these Terms is held to be invalid, illegal or unenforceable, that provision will be modified to the minimum extent necessary to make it enforceable, or if it cannot be modified, it will be severed from these Terms. The remaining provisions will continue in full force and effect.</p>
      <h3>29.8 Waiver</h3>
      <p>No failure or delay by either party in exercising any right under these Terms will constitute a waiver of that right. A waiver is only effective if given in writing.</p>
      <h3>29.9 Relationship of the parties</h3>
      <p>The parties are independent contractors. Nothing in these Terms creates a partnership, joint venture, agency or employment relationship between the parties.</p>
      <h3>29.10 Order of precedence</h3>
      <p>If there is a conflict between these Terms and any other document referenced in these Terms (other than an Order for specific commercial terms), these Terms take precedence unless the other document expressly states that it overrides these Terms.</p>

      <p style={{ marginTop: '2.5rem' }}>Questions about these Terms? Contact us at <a href="mailto:info@quote-core.com">info@quote-core.com</a>.</p>
    </LegalPageShell>
  );
}
