import type { Metadata } from 'next';
import { MarketingCalculator } from '@/app/components/pricing/MarketingCalculator';
import {
  BulletList,
  Container,
  ConversionPaths,
  FaqAccordion,
  FeatureGrid,
  FinalCta,
  Hero,
  PageScaffold,
  ProductFrame,
  Section,
  SectionHeader,
  SplitFeature,
  type FaqItem,
} from '@/components/marketing/page-v2/PageV2';
import { buildBreadcrumbSchema, buildFaqSchema, buildPricingOffers } from '@/lib/schema';
import { publicPricing } from '@/lib/public-pricing';
import { hreflangLanguages } from '@/lib/seo/hreflang';

export const metadata: Metadata = {
  title: 'QuoteCore+ Pricing | Build Your Estimating & Quoting Plan',
  description: 'Build a QuoteCore+ plan around your workload and the tools you need. Current global configurations range from US$29 to US$259/month. Explore demos, free tools and Done For You Setup.',
  alternates: { canonical: 'https://quote-core.com/pricing', languages: hreflangLanguages('/pricing') },
  openGraph: {
    title: 'QuoteCore+ Pricing | Build Your Estimating & Quoting Plan',
    description: 'Configure the workload and tools you need. Current global QuoteCore+ configurations range from US$29 to US$259/month.',
    url: 'https://quote-core.com/pricing', siteName: 'QuoteCore+', type: 'website',
  },
};

const faqs: FaqItem[] = [
  { question: 'How much does QuoteCore+ cost?', answer: `QuoteCore+ uses configurable monthly pricing built around your workload and selected tools. Current global configurations range from US$${publicPricing.monthlyMin} to US$${publicPricing.monthlyMax} per month. Use the pricing builder on this page to choose your workload and tools and see the resulting monthly price.` },
  { question: 'What is the cheapest QuoteCore+ setup?', answer: `The current global pricing builder starts at US$${publicPricing.monthlyMin} per month for the minimum public configuration. Your exact monthly price changes with the workload and optional tools you choose.` },
  { question: 'What can make my monthly price higher?', answer: 'The pricing builder changes the monthly total based on your core job or quote allowance and optional usage such as Digital Takeoff, AI Scan Assist, offcut optimisation and Smart Assistant. The builder shows the total before you continue.' },
  { question: 'Is there a free trial?', answer: 'No. There is no full-app trial. You can explore the interactive app demo, use the free browser tools with no signup, try the focused takeoff demo, or book a tailored product demo before subscribing.' },
  { question: 'Can I try QuoteCore+ before subscribing?', answer: 'Yes. The interactive app demo gives you a prepared fictional roofing workspace to explore, and the free tools let you complete practical takeoff, measurement, pricing and document tasks without a paid account.' },
  { question: 'Can I change my configuration later?', answer: 'The public pricing model is built around configurable usage and tools. Use the current app and billing controls for any available subscription changes after signup.' },
  { question: 'Is Done For You included in the monthly subscription?', answer: `No. Done For You Setup is a separate one-time service starting from US$${publicPricing.doneForYouStarting}. It is for businesses that want QuoteCore+ to help configure agreed materials, labour, waste and pricing logic and then train them using their own workflow.` },
  { question: 'Are taxes included?', answer: 'The pricing builder displays the subscription price before any tax treatment that may apply to your location. The checkout flow is the final source for applicable taxes and the amount charged.' },
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
        title={<>Build a plan around the way you work.</>}
        lead={`Choose your workload and the tools you need. The pricing builder creates the monthly setup and shows the price before you continue. Current global configurations range from US$${publicPricing.monthlyMin} to US$${publicPricing.monthlyMax} per month.`}
        body="There is no full-app trial. If you want to try the workflow first, explore the interactive demo, use the free tools or book a tailored product demo."
        primary={{ href: '#build-your-plan', label: 'Build your plan' }}
        secondary={{ href: '/demo', label: 'Explore the interactive demo' }}
        proof={['One configurable monthly price', 'See the total before signup', 'Free tools and demos available first']}
        visual={<ProductFrame src="/marketing/current-ux/job-space-overview.webp" alt="Current QuoteCore+ Job Space overview" width={2048} height={1112} eager caption="The pricing configuration changes with the tools and usage you choose. The goal remains one connected job workflow." />}
      />

      <Section tone="soft" id="build-your-plan">
        <Container>
          <SectionHeader eyebrow="Pricing builder" title="Choose the tools and usage that earn their place." lead="Answer the questions in the builder to see the current monthly configuration before you continue to signup." />
        </Container>
        <MarketingCalculator />
      </Section>

      <Section>
        <Container>
          <SectionHeader eyebrow="What changes the price" title="Pay for the workload and tools you choose." lead="The builder combines the core workload with the optional tools and allowances that match how you expect to use QuoteCore+." />
          <FeatureGrid columns={3} items={[
            { title: 'Core workload', body: <p>Your expected job or quote volume sets the core allowance used by the builder.</p> },
            { title: 'Digital Takeoff', body: <p>Add the in-app plan measurement workspace when you want to measure drawings directly in QuoteCore+.</p> },
            { title: 'AI Scan Assist', body: <p>Choose the AI Scan Assist allowance that fits how often you expect to automate roof-plan takeoff.</p> },
            { title: 'Offcut optimisation', body: <p>Add offcut and cut-plan capability when it belongs in your roofing workflow.</p> },
            { title: 'Smart Assistant', body: <p>Choose an Assistant allowance based on how much help you expect to use across supported account tasks.</p> },
            { title: 'One monthly total', body: <p>The builder combines the choices into one monthly price before you continue to signup.</p> },
          ]} />
        </Container>
      </Section>

      <Section tone="soft">
        <Container>
          <SplitFeature visual={<ProductFrame src="/marketing/current-ux/job-space-overview.webp" alt="Current QuoteCore+ Job Space showing the connected job workflow" width={2048} height={1112} caption="The plan configuration changes. The connected workflow is what the subscription gives you access to." />}>
            <h2>The plan changes. The connected workflow stays the point.</h2>
            <p>QuoteCore+ is designed so the important job information can stay together instead of being retyped between a takeoff tool, spreadsheet, quote document and invoicing system.</p>
            <BulletList items={['Saved jobs and measurements', 'Reusable Smart Components', 'Customer quotes and activity', 'Material ordering and invoicing workflow', 'Phone, tablet and desktop access']} />
          </SplitFeature>
        </Container>
      </Section>

      <Section>
        <Container>
          <SectionHeader eyebrow="Try it before you subscribe" title="No full-app trial. Three useful ways to evaluate QuoteCore+." lead="Choose the evaluation path that answers what you actually need to know." />
          <ConversionPaths items={[
            { title: 'Explore the interactive app demo', body: 'Open a prepared fictional roofing account, follow the guided examples and look around the wider workspace at your own pace.', href: '/demo', label: 'Explore the demo' },
            { title: 'Use the free tools', body: 'Try takeoff, measurement-to-pricing, calculators and document tools in your browser without creating a paid app account.', href: '/free-tools', label: 'Browse free tools' },
            { title: 'Book a tailored 20-minute demo', body: 'Tell us how you currently measure and price work. We will share our screen and show a workflow that is relevant to your trade and questions.', href: 'https://calendly.com/quote-core-info/15-minute-meeting', label: 'Book a tailored demo' },
          ]} />
        </Container>
      </Section>

      <Section tone="soft">
        <Container>
          <SplitFeature reverse visual={<ProductFrame src="/marketing/current-ux/smart-components-pricing-library.webp" alt="QuoteCore+ Smart Components pricing library" width={2048} height={1111} caption="Done For You Setup can help translate agreed materials, labour, waste and pricing logic into the account you will actually use." />}>
            <h2>Want us to help build the setup around your business?</h2>
            <p>Done For You Setup is a separate one-time service starting from <strong>US${publicPricing.doneForYouStarting}</strong>. It is for businesses that want help translating existing materials, labour rates, waste rules and pricing logic into QuoteCore+ and learning the agreed setup using real jobs.</p>
            <p>Your monthly subscription is still configured separately through the pricing builder above.</p>
            <BulletList items={['Existing spreadsheets and price lists can be a starting point', 'The agreed setup is configured around your own pricing logic', 'Training focuses on the way your business will use QuoteCore+']} />
          </SplitFeature>
        </Container>
      </Section>

      <Section>
        <Container><FaqAccordion faqs={faqs} title="Pricing FAQ" /></Container>
      </Section>

      <FinalCta title="See your price, then choose how you want to start." body="Build the configuration that fits your workload, or explore the product before you subscribe." primary={{ href: '#build-your-plan', label: 'Build your plan' }} secondary={{ href: '/demo', label: 'Explore the demo' }} />
      <div style={{ height: 72 }} />
    </PageScaffold>
  );
}
