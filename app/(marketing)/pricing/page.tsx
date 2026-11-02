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
  type FaqItem,
} from '@/components/marketing/page-v2/PageV2';
import { workflowCallHref } from '@/lib/booking';
import { buildBreadcrumbSchema, buildFaqSchema, buildPricingOffers } from '@/lib/schema';
import { publicPricing } from '@/lib/public-pricing';
import { hreflangLanguages } from '@/lib/seo/hreflang';

export const metadata: Metadata = {
  title: 'QuoteCore+ Pricing | Try Everything First, Then Build Your Plan',
  description: `Try QuoteCore+ in a Free Workspace before choosing a paid plan. Current configurations range from US$${publicPricing.monthlyMin} to US$${publicPricing.monthlyMax}/month. Build your exact plan inside your account or talk it through with Shaun.`,
  alternates: { canonical: 'https://quote-core.com/pricing', languages: hreflangLanguages('/pricing') },
  openGraph: {
    title: 'QuoteCore+ Pricing | Try Everything First, Then Build Your Plan',
    description: `Try the app first. Upgrade only when you know what your business needs. Current configurations range from US$${publicPricing.monthlyMin} to US$${publicPricing.monthlyMax}/month.`,
    url: 'https://quote-core.com/pricing', siteName: 'QuoteCore+', type: 'website',
    images: [{ url: '/images/social/og-pricing.jpg', width: 1200, height: 630, alt: 'QuoteCore+ pricing' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'QuoteCore+ Pricing | Try Everything First, Then Build Your Plan',
    description: `Try the app first. Upgrade only when you know what your business needs. US$${publicPricing.monthlyMin} to US$${publicPricing.monthlyMax}/month.`,
    images: ['/images/social/og-pricing.jpg'],
  },
};

const faqs: FaqItem[] = [
  {
    question: 'How much does QuoteCore+ cost?',
    answer: `Paid QuoteCore+ configurations currently range from US$${publicPricing.monthlyMin} to US$${publicPricing.monthlyMax} per month. Your exact price depends on the features, capacity and usage you choose after you have had a chance to try the app.`,
  },
  {
    question: 'Do I need to choose a plan before I can use QuoteCore+?',
    answer: 'No. Create a Free Workspace first. Use it on your own jobs, try the optional guided walkthrough and learn which features are useful before you decide whether you need a paid plan.',
  },
  {
    question: 'Where do I build my exact plan?',
    answer: 'Inside your QuoteCore+ account. Open Billing and use Create Your Plan when you are ready. The public website intentionally does not ask you to choose features before you know what they do.',
  },
  {
    question: 'Can Shaun help me work out what I need?',
    answer: 'Yes. Book a free 25-minute call, tell Shaun how you currently measure, price and quote, and he can help identify which QuoteCore+ features are likely to be useful. Either way, he will also share his number one tip for winning more of the jobs you already quote.',
  },
  {
    question: 'What if the Free Workspace is enough for me?',
    answer: 'Keep using it. Upgrade only when you need more features, capacity or usage.',
  },
];

const schemas = [
  { '@context': 'https://schema.org', '@type': 'SoftwareApplication', '@id': 'https://quote-core.com/#software', name: 'QuoteCore+', applicationCategory: 'BusinessApplication', operatingSystem: 'Web', url: 'https://quote-core.com/pricing', offers: buildPricingOffers('USD') },
  buildBreadcrumbSchema([{ name: 'Home', url: 'https://quote-core.com/' }, { name: 'Pricing', url: 'https://quote-core.com/pricing' }]),
  buildFaqSchema(faqs),
];

export default function PricingPage() {
  return (
    <PageScaffold breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Pricing' }]} schemas={schemas}>
      <Hero
        eyebrow="QuoteCore+ pricing"
        title={<>Don&apos;t pay for something you don&apos;t need.<br />Try everything first for free.</>}
        lead="See how our app can help your business, what features you need, then create your plan."
        body={`Paid configurations currently range from US$${publicPricing.monthlyMin} to US$${publicPricing.monthlyMax} per month. You do not need to choose one before creating your Free Workspace.`}
        primary={{ href: '/signup', label: 'Create my Free Workspace', freeWorkspace: true }}
        secondary={{ href: workflowCallHref, label: 'Book 25 minutes with Shaun' }}
        proof={['No card needed', 'No expiry', 'Upgrade only if you need more']}
      />

      <Section tone="dark">
        <Container narrow>
          <SectionHeader
            eyebrow="15 minutes to clarity"
            title="Learn the workflow before you price the plan."
            lead="Use the optional guided walkthrough to understand the core QuoteCore+ workflow in around 10 to 15 minutes, or skip it and try the same tools on your own jobs. Once you know what helps, the pricing choices make much more sense."
            dark
          />
        </Container>
      </Section>

      <Section>
        <Container>
          <SectionHeader
            eyebrow="Two ways to get your price"
            title="Build it yourself, or talk it through with Shaun."
            lead="Either way, start by understanding what your business actually needs rather than buying a generic package first."
          />
          <FeatureGrid columns={2} items={[
            {
              kicker: 'Try it yourself',
              title: 'Create your Free Workspace',
              body: <p>Use QuoteCore+ for real, try the guided walkthrough if you want it, then open Billing → Create Your Plan inside your account when you are ready to see your exact configuration and price.</p>,
            },
            {
              kicker: 'Let us help',
              title: 'Book 25 minutes with Shaun',
              body: <p>Tell Shaun how you currently work. He can help you identify which features are likely to save you time, what level of usage you may need and what that setup is likely to cost. You will also get his number one tip for winning more quoted jobs.</p>,
            },
          ]} />
        </Container>
      </Section>

      <Section tone="soft">
        <Container narrow>
          <SectionHeader
            eyebrow="Why we price it this way"
            title="Know what a feature does before you pay for it."
            lead="QuoteCore+ is not built around forcing every business into the same Starter, Pro or Business package. Try the tools first, understand what earns its place in your workflow, then create the plan that fits."
          />
        </Container>
      </Section>

      <Section>
        <Container><FaqAccordion faqs={faqs} title="Pricing FAQ" /></Container>
      </Section>

      <Section tone="dark">
        <Container>
          <FinalCta
            eyebrow="Start free"
            title="Upgrade only when you need more features, capacity or usage."
            body="If the Free Workspace is enough, keep using it. If you need more later, build your plan inside your account or talk it through with Shaun."
            primary={{ href: '/signup', label: 'Create my Free Workspace', freeWorkspace: true }}
            secondary={{ href: workflowCallHref, label: 'Book 25 minutes with Shaun' }}
          />
        </Container>
      </Section>
    </PageScaffold>
  );
}
