import type { Metadata } from 'next';
import {
  Container,
  FaqAccordion,
  FeatureGrid,
  FinalCta,
  Hero,
  PageScaffold,
  Section,
  SectionHeader,
  WorkflowRail,
} from '@/components/marketing/page-v2/PageV2';
import { homepageConfig } from '@/components/marketing/home/homepage-config';
import { buildBreadcrumbSchema, buildFaqSchema, buildSoftwareApplicationSchema, siteUrl } from '@/lib/schema';
import { hreflangLanguages } from '@/lib/seo/hreflang';

export const metadata: Metadata = {
  title: 'Free QuoteCore+ Workspace | No Card, No Expiry',
  description: 'Create a real QuoteCore+ Free Workspace, use it on your own jobs for as long as you want, and try the optional 10 to 15 minute guided walkthrough when you want help learning the workflow.',
  alternates: {
    canonical: 'https://quote-core.com/free-trial',
    languages: hreflangLanguages('/free-trial'),
  },
};

const faqs = [
  {
    question: 'Is this a free trial?',
    answer: 'No. It is a real Free Workspace with no expiry. Use it on your own jobs for as long as the included features and allowances are enough for your business.',
  },
  {
    question: 'Do I need a credit card?',
    answer: 'No. Create your Free Workspace with Google or email. There is no card, plan selection or payment step before you can start using QuoteCore+.',
  },
  {
    question: 'What is the guided walkthrough?',
    answer: 'It is an optional 10 to 15 minute guided workflow using a preconfigured fictional roofing business. It takes you through adding pricing, measuring with that pricing, editing and sending a quote, and using Smart Assistant for similar supported tasks.',
  },
  {
    question: 'Can I skip the walkthrough?',
    answer: 'Yes. Your Free Workspace is your real account. You can skip the walkthrough and start with your own jobs immediately, or move between the guided experience and your own workspace when you want.',
  },
  {
    question: 'When do I need to upgrade?',
    answer: 'Only when you need more features, capacity or usage. If the Free Workspace is enough for the way you work, keep using it.',
  },
];

export default function FreeWorkspacePage() {
  const bookingHref = homepageConfig.bookingHref || '/contact';
  const schemas = [
    buildBreadcrumbSchema([
      { name: 'Home', url: `${siteUrl}/` },
      { name: 'Free Workspace', url: `${siteUrl}/free-trial` },
    ]),
    buildFaqSchema(faqs),
    { '@context': 'https://schema.org', ...buildSoftwareApplicationSchema() },
  ];

  return (
    <PageScaffold breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Free Workspace' }]} schemas={schemas}>
      <Hero
        eyebrow="Free Workspace"
        title={<>Start with a real QuoteCore+ workspace. Free for as long as you want.</>}
        lead="Instead of a timed trial, we give you a real workspace you can use on your own jobs. Try every feature, learn what helps your business, and upgrade only if you need more."
        primary={{ href: '/signup', label: 'Create my Free Workspace', freeWorkspace: true }}
        secondary={{ href: bookingHref, label: 'Book 25 minutes with Shaun' }}
        proof={['No card needed', 'No expiry', 'Use it on real jobs']}
      />

      <Section tone="soft">
        <Container>
          <SectionHeader
            eyebrow="Included from day one"
            title="Your account, your workspace."
            lead="Start with the real product, not a restricted trial account."
          />
          <FeatureGrid columns={3} items={[
            {
              title: 'A real Free Workspace',
              body: <p>Use QuoteCore+ on your own jobs and keep the account for as long as you want.</p>,
            },
            {
              title: 'Explore every feature',
              body: <p>Try the tools with the free allowances included in your workspace so you can understand what actually helps before you pay for more.</p>,
            },
            {
              title: 'Optional guided walkthrough',
              body: <p>Learn the core workflow in around 10 to 15 minutes, then switch back to your own workspace whenever you want.</p>,
            },
          ]} />
        </Container>
      </Section>

      <Section tone="dark">
        <Container>
          <SectionHeader
            eyebrow="Recommended, but optional"
            title="Learn the core workflow in 10 to 15 minutes."
            lead="The Guided Walkthrough opens a preconfigured fictional roofing business and takes you through four connected tasks. Follow it when you want help, or skip it and explore your own workspace instead."
            dark
          />
          <WorkflowRail steps={[
            { label: 'Add your pricing', body: 'See how your materials, labour and pricing can live inside QuoteCore+.' },
            { label: 'Measure with that pricing', body: 'Measure the sample job and see the pricing flow through as you work.' },
            { label: 'Edit and send the quote', body: 'Finish the customer quote, make the final edits and see how sending works.' },
            { label: 'Try Smart Assistant', body: 'Use the Assistant to complete similar supported tasks in a faster way.' },
          ]} />
        </Container>
      </Section>

      <Section>
        <Container narrow>
          <SectionHeader
            eyebrow="Keep it simple"
            title="Free might be all you need."
            lead="If the Free Workspace gives your business enough, keep using it. Upgrade only when you need more features, capacity or usage."
          />
        </Container>
      </Section>

      <Section tone="soft">
        <Container><FaqAccordion faqs={faqs} title="Free Workspace FAQ" /></Container>
      </Section>

      <Section tone="dark">
        <Container>
          <FinalCta
            eyebrow="Try it first"
            title="Create your workspace. Decide later."
            body="Use QuoteCore+ long enough to understand how it fits your business before you ever need to think about a paid plan."
            primary={{ href: '/signup', label: 'Create my Free Workspace', freeWorkspace: true }}
            secondary={{ href: bookingHref, label: 'Book 25 minutes with Shaun' }}
          />
        </Container>
      </Section>
    </PageScaffold>
  );
}
