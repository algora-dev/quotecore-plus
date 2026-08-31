import Link from 'next/link';

const link = 'font-medium text-[#BD4A1A] hover:underline';

const T3_URL =
  'https://www.t3labs.tech/custom-software?utm_source=quotecore&utm_medium=referral&utm_campaign=custom-solutions';

export default function Post() {
  return (
    <div className="prose prose-zinc max-w-none">
      <p>
        <strong>
          Short answer: most businesses that think they need custom roofing software
          actually need a configurable one.
        </strong>
      </p>
      <p>
        The difference matters. Custom software is built from scratch around your
        workflow — powerful, but a serious investment. Configurable software is an
        existing platform that uses <strong>your</strong> products, <strong>your</strong>{' '}
        prices, <strong>your</strong> labour and waste rules, and adapts to the way you
        already work. It costs a fraction of a bespoke build and can be running this week.
      </p>
      <p>
        This article explains how to tell which one you actually need — and what to do
        when the honest answer is &ldquo;neither, you need a custom build&rdquo;.
      </p>

      <h2>Quick answer: built or configured?</h2>
      <div className="not-prose my-6 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-300">
              <th className="px-3 py-2 text-left font-semibold">Your situation</th>
              <th className="px-3 py-2 text-left font-semibold">Likely best fit</th>
            </tr>
          </thead>
          <tbody>
            <tr><td className="border-b border-zinc-200 px-3 py-2">Need estimating/quoting software this week</td><td className="border-b border-zinc-200 px-3 py-2 font-medium">Existing SaaS</td></tr>
            <tr><td className="border-b border-zinc-200 px-3 py-2">Need your own products, prices and waste rules</td><td className="border-b border-zinc-200 px-3 py-2 font-medium">Configurable SaaS</td></tr>
            <tr><td className="border-b border-zinc-200 px-3 py-2">Need your exact workflow recreated</td><td className="border-b border-zinc-200 px-3 py-2 font-medium">Configuration / assisted setup</td></tr>
            <tr><td className="border-b border-zinc-200 px-3 py-2">Need a unique integration or portal</td><td className="border-b border-zinc-200 px-3 py-2 font-medium">Custom development</td></tr>
            <tr><td className="border-b border-zinc-200 px-3 py-2">Need software you own or resell</td><td className="border-b border-zinc-200 px-3 py-2 font-medium">Custom development</td></tr>
          </tbody>
        </table>
      </div>
      <p>
        If most of your rows land in the first three, configurable software will almost
        certainly do the job. The last two are where custom development genuinely earns
        its cost.
      </p>

      <h2>Most businesses don&rsquo;t need custom engineering immediately</h2>
      <p>
        When contractors search for &ldquo;custom roofing software&rdquo;, the underlying
        wish is usually not &ldquo;software written just for me&rdquo;. It is:
      </p>
      <blockquote>
        <p>
          <strong>
            &ldquo;I want software that works the way my business works, using my prices
            and my process.&rdquo;
          </strong>
        </p>
      </blockquote>
      <p>
        That is a configuration problem, not an engineering problem. A configurable
        platform gives you the parts that should be standard — plan takeoff, measurements,
        calculation, quote presentation, ordering, invoicing — while everything that makes
        your business <em>your</em> business stays yours: component logic, material
        choices, labour rates, waste allowances, margins and documents.
      </p>
      <p>
        Jumping straight to a bespoke build when configuration would do means paying
        engineering prices for what is essentially setup.
      </p>

      <h2>Configurable vs custom build: the decision framework</h2>
      <p>Work through these questions in order:</p>
      <ol>
        <li>
          <strong>Does an existing product already handle the trade workflow?</strong>{' '}
          Takeoff, measuring, calculating, quoting, ordering. If yes, start there.
        </li>
        <li>
          <strong>Can it use your own rules?</strong> Your products, prices, labour,
          waste, pitch treatment, documents. If yes — you&rsquo;re done. That&rsquo;s
          configuration.
        </li>
        <li>
          <strong>Is the gap an integration?</strong> Connecting to accounting, CRM or a
          job system is often an integration problem, not a reason to rebuild everything.
        </li>
        <li>
          <strong>Is the gap the product itself?</strong> If what you need is a portal, a
          proprietary workflow, an internal tool, or software you&rsquo;ll own and
          resell — that&rsquo;s genuine custom development.
        </li>
      </ol>
      <p>
        The pattern: configuration first, integration second, custom build only when the
        requirement falls outside what any existing platform can do.
      </p>

      <h2>What QuoteCore+ can already configure</h2>
      <p>
        QuoteCore+ was built for exactly this &ldquo;configured, not generic&rdquo; space
        in roofing. Out of the box it can be set up around:
      </p>
      <ul>
        <li>
          <strong>Your own Smart Components</strong> — a measurement packaged with its
          materials, labour, waste rules and pricing, defined once and reused on every job
        </li>
        <li>
          <strong>Your products and supplier catalogues</strong>, including{' '}
          <Link href="/features/supplier-resources" className={link}>
            supplier resources
          </Link>{' '}
          and CSV catalogue imports
        </li>
        <li>
          <strong>Your calculation rules</strong> — pitch factors, percentage or fixed
          waste, pack sizes, coverage, cost vs sell price, margin behaviour
        </li>
        <li>
          <strong>Your entry path</strong> — draw on a plan,{' '}
          <Link href="/features/digital-roof-takeoff" className={link}>
            digital takeoff
          </Link>
          , AI Scan Assist, or measurements typed in from site
        </li>
        <li>
          <strong>Your documents</strong> — quotes, material orders, labour sheets and
          invoices that flow from the same job data
        </li>
      </ul>
      <p>
        In practice this covers the large majority of &ldquo;can the software do it my
        way?&rdquo; requests.
      </p>

      <h2>When QuoteCore+ is not enough</h2>
      <p>
        We&rsquo;ll be straight about it. Configuration can&rsquo;t produce:
      </p>
      <ul>
        <li>a bespoke customer or supplier portal with its own branding and logic</li>
        <li>a unique integration with a system that has no supported connection</li>
        <li>a separate internal application for a non-roofing part of your business</li>
        <li>white-label software you intend to own and resell</li>
      </ul>
      <p>
        If that&rsquo;s your situation, you don&rsquo;t need a different roofing package —
        you need a development team.
      </p>

      <h2>When custom development genuinely makes sense</h2>
      <ul>
        <li>
          <strong>You need a portal</strong> — customer-facing or supplier-facing access
          with your own rules
        </li>
        <li>
          <strong>You need a unique integration</strong> — proprietary systems, unusual
          data flows
        </li>
        <li>
          <strong>You need software you own</strong> — an internal tool or a commercial
          product of your own
        </li>
        <li>
          <strong>Your workflow is genuinely unusual</strong> — and it works, so the
          software should fit it, not the reverse
        </li>
      </ul>
      <p>
        For those requirements, our development partner{' '}
        <a href={T3_URL} target="_blank" rel="noopener noreferrer" className={link}>
          T3 Labs builds custom software
        </a>{' '}
        — including QuoteCore+ itself, which is live proof they understand estimating,
        pricing and workflow systems.
      </p>

      <h2>The practical route</h2>
      <ol>
        <li>
          <strong>Try QuoteCore+ first.</strong> Set up a few of your real components and
          price a real job. If it fits, you&rsquo;ve solved the problem for a fraction of
          a custom build.
        </li>
        <li>
          <strong>Check the gap.</strong> If something&rsquo;s missing, ask whether
          it&rsquo;s configuration (pricing, products, workflow), integration, or
          engineering.
        </li>
        <li>
          <strong>Route engineering to T3 Labs.</strong> For genuine bespoke needs,{' '}
          <a href={T3_URL} target="_blank" rel="noopener noreferrer" className={link}>
            tell T3 Labs the problem
          </a>{' '}
          — they&rsquo;ll tell you honestly whether it needs configuration, integration or
          a custom build.
        </li>
      </ol>
      <p>
        You can also see the full two-path summary on our{' '}
        <Link href="/custom-solutions" className={link}>
          custom solutions page
        </Link>
        .
      </p>

      <h2>FAQ</h2>
      <h3>Is QuoteCore+ custom software?</h3>
      <p>
        It&rsquo;s configurable software. The platform is purpose-built for roofing
        estimating and commercial workflows, but the content — your components, products,
        prices, labour, waste rules and documents — is entirely yours. That gets you the
        fit of custom software without funding a from-scratch build.
      </p>
      <h3>What does custom roofing software cost vs QuoteCore+?</h3>
      <p>
        QuoteCore+ is a subscription from $19/month. A bespoke roofing platform is a
        five-to-six figure development project. If configuration solves your problem,
        that difference stays in your pocket.
      </p>
      <h3>Can QuoteCore+ be customised further if I need something specific?</h3>
      <p>
        Configuration covers products, pricing, labour, waste, documents and workflow.
        Requirements beyond that — portals, unique integrations, standalone applications —
        are handled by our development partner T3 Labs.
      </p>
      <h3>Who is T3 Labs?</h3>
      <p>
        T3 Labs is the product studio behind QuoteCore+. They build custom estimating,
        pricing, portal and workflow software for businesses whose requirements genuinely
        exceed what existing platforms offer.
      </p>
    </div>
  );
}
