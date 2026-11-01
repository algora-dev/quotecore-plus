import type { Metadata } from 'next';
import Link from 'next/link';
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
  RelatedLinks,
  Section,
  SectionHeader,
  SplitFeature,
  TextLink,
  WorkflowRail,
  type FaqItem,
} from '@/components/marketing/page-v2/PageV2';
import { buildBreadcrumbSchema, buildFaqSchema, buildSoftwareApplicationSchema } from '@/lib/schema';
import { publicPricing } from '@/lib/public-pricing';
import { workflowCallHref } from '@/lib/booking';
import { hreflangLanguages } from '@/lib/seo/hreflang';

const bookingHref = workflowCallHref;
const GLOBAL = 'https://quote-core.com';

export const metadata: Metadata = {
  title: 'Roofing Quoting Software NZ | QuoteCore+',
  description:
    'Measure roofing work, calculate quantities, apply your own pricing, build customer quotes and carry accepted jobs into ordering and invoicing. Built for measurement-driven roofing workflows, including long-run roofing.',
  alternates: {
    canonical: `${GLOBAL}/nz/roofing-quoting-software`,
    languages: hreflangLanguages('/roofing-quoting-software', '/nz/roofing-quoting-software'),
  },
  openGraph: {
    title: 'Roofing Quoting Software NZ | QuoteCore+',
    description:
      'Measure roofing work, calculate quantities, apply your own pricing, build customer quotes and carry accepted jobs into ordering and invoicing. Built for New Zealand roofing workflows, including long-run roofing.',
    url: `${GLOBAL}/nz/roofing-quoting-software`,
    siteName: 'QuoteCore+',
    type: 'website',
  },
};

const faqs: FaqItem[] = [
  {
    question: 'Is QuoteCore+ suitable for New Zealand roofing businesses?',
    answer:
      'Yes. The workflow is measurement-driven and works in metric, which suits how NZ roofers measure and price. Roof areas, ridges, hips, valleys, barges and flashings are measured once and carried through the quote, material order and invoice instead of being re-typed into separate documents.',
  },
  {
    question: 'Can I quote in NZ dollars with GST?',
    answer:
      'Yes. Set NZD as your quote currency and add GST at your rate to customer quotes, orders and invoices. You use your own material and labour pricing. Subscription billing is in USD through the global pricing builder.',
  },
  {
    question: 'Does QuoteCore+ handle long-run roofing?',
    answer:
      'Yes. Long-run and other cut-to-length metal roofing is a core use case. Measured lengths feed the quote, and the Offcut Optimiser can suggest whole-roof cutting plans so purchased lengths and reusable offcuts are checked before the price is fixed.',
  },
  {
    question: 'How much does QuoteCore+ cost?',
    answer: `Subscription configurations are billed in USD and start from US$${publicPricing.monthlyMin} per month through the pricing builder.`,
  },
  {
    question: 'Can I try it before paying?',
    answer:
      'Yes. Create a free workspace and start measuring, pricing and quoting, or book a free 20-minute call with Shaun to see the workflow walked through against your own jobs.',
  },
  {
    question: 'Is this different from the global QuoteCore+ product?',
    answer:
      'No. This is the same QuoteCore+ application, demo and free tools used worldwide. This page simply explains how the workflow fits New Zealand roofing businesses. One product, one login, one workflow.',
  },
];

const schemas = [
  buildSoftwareApplicationSchema(),
  buildBreadcrumbSchema([
    { name: 'Home', url: `${GLOBAL}/` },
    { name: 'New Zealand', url: `${GLOBAL}/nz/roofing-quoting-software` },
    { name: 'Roofing Quoting Software NZ', url: `${GLOBAL}/nz/roofing-quoting-software` },
  ]),
  buildFaqSchema(faqs),
];

export default function NzRoofingQuotingSoftwarePage() {
  return (
    <PageScaffold
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Roofing Quoting Software NZ' }]}
      schemas={schemas}
    >
      <Hero
        eyebrow="For New Zealand roofers"
        title={<>Roofing quoting software for New Zealand roofers.</>}
        lead="Measure the roof, calculate quantities, apply your own pricing, build the customer quote, then carry accepted work into material orders and invoices. One connected workflow built for measurement-driven roofing."
        primary={{ href: bookingHref, label: 'Book a free 20-minute call with Shaun' }}
        secondary={{ href: '/signup', label: 'Create a free workspace' }}
        proof={['Metric measurements', 'Long-run and cut-to-length roofing', 'NZD quoting with GST', 'Your own material and labour pricing']}
      />

      <Section>
        <Container>
          <SectionHeader
            eyebrow="NZ roofing workflow"
            title="Roofing work in New Zealand is measured, then priced. Your software should work the same way."
            lead="Most NZ roofing jobs are quoted from real measurements: roof areas in square metres, ridges, hips, valleys, barges and flashings in linear metres, and cut-to-length sheeting for long-run profiles. QuoteCore+ starts at the measurement and keeps every downstream document connected to it."
          />
          <FeatureGrid
            items={[
              {
                title: 'Metric measurements',
                body: <p>Work in metres and square metres. Roof areas, lengths and pitches are captured once in the takeoff and reused everywhere after that.</p>,
              },
              {
                title: 'Roof-specific detail',
                body: <p>Record roof areas, ridges, hips, valleys, barges and flashings as separate measured items, not one lumped number, so quantities stay checkable.</p>,
              },
              {
                title: 'Your own pricing',
                body: <p>Build reusable pricing from your own material rates and labour. Your quotes price the way your business prices, in NZD.</p>,
              },
              {
                title: 'GST on customer documents',
                body: <p>Add GST at your rate to quotes, material orders and invoices. Customer documents come out clean and complete.</p>,
              },
              {
                title: 'Cut-to-length materials',
                body: <p>Ordered sheet lengths and custom lengths stay attached to the job, which matters for long-run and other metal profiles.</p>,
              },
              {
                title: 'Site or office',
                body: <p>Measure and quote from a phone or tablet on site, or from plans at the office. The same job data follows the work.</p>,
              },
            ]}
          />
        </Container>
      </Section>

      <Section tone="soft">
        <Container>
          <SplitFeature
            visual={
              <ProductFrame
                src="/marketing/current-ux/offcut-optimiser-plan.webp"
                alt="QuoteCore+ Offcut Optimiser showing a generated whole-roof cut plan for a long-run metal roof"
                width={2048}
                height={1109}
                caption="A generated whole-roof cut plan: sheet counts, purchased lengths and reusable angled offcuts, checked before the quote is sent."
              />
            }
          >
            <h2>Long-run roofing changes the material maths.</h2>
            <p>
              A hip or valley roof is not priced by area alone. Diagonal cuts leave tapered offcuts, some reusable and some not, so the sheets you actually buy can differ sharply from a simple area figure with a flat waste percentage.
            </p>
            <BulletList
              items={[
                'Ordered lengths planned against the measured roof, not guessed',
                'Reusable offcuts identified before material is purchased',
                'Fewer surprise material shortfalls after the job is won',
              ]}
            />
            <TextLink href="/nz/long-run-roofing-estimating">Read the long-run estimating guide</TextLink>
            <br />
            <TextLink href="/features/offcut-optimiser">See the Offcut Optimiser feature</TextLink>
          </SplitFeature>
        </Container>
      </Section>

      <Section>
        <Container>
          <SectionHeader
            eyebrow="Connected workflow"
            title="Measure once. Quote, order and invoice from the same job."
            lead="The time sink in roofing quoting is not any single step. It is re-entering the same job information into notes, spreadsheets, a quote, an order and an invoice. QuoteCore+ keeps one job record and carries it through."
          />
          <WorkflowRail
            steps={[
              { label: 'Measure', body: 'Digital takeoff from plans or site measurements, in metric.' },
              { label: 'Quantities', body: 'Areas, lengths and component counts calculated from the takeoff.' },
              { label: 'Pricing', body: 'Your material and labour rates, with waste and pricing rules you control.' },
              { label: 'Quote', body: 'A professional customer quote in NZD with GST applied at your rate.' },
              { label: 'Acceptance', body: 'The customer accepts or declines and you are notified.' },
              { label: 'Material order', body: 'Accepted work becomes an order with quantities and lengths carried over.' },
              { label: 'Invoice', body: 'Invoice from the same job record and track it through to payment.' },
            ]}
          />
        </Container>
      </Section>

      <Section tone="soft">
        <Container>
          <SectionHeader
            eyebrow="New Zealand facts"
            title="What is true today, stated plainly."
            lead="A few things worth knowing before you look at pricing."
          />
          <FeatureGrid
            columns={2}
            items={[
              {
                title: 'Quoting in NZD',
                body: <p>Customer quotes, orders and invoices can be produced in NZD using your own rates. Currency is a display setting for your documents.</p>,
              },
              {
                title: 'GST on documents',
                body: <p>You can add GST, or any other tax, with its own percentage to customer documents.</p>,
              },
              {
                title: 'Subscription billing in USD',
                body: <p>QuoteCore+ subscriptions are billed in USD through the global pricing builder. The same plans and prices apply worldwide. See <Link href="/pricing" className="text-[#BD4A1A] underline underline-offset-2">pricing</Link>.</p>,
              },
              {
                title: 'One global product',
                body: <p>The same app, demo and free tools serve every country. New Zealand roofers use the identical workflow and feature set.</p>,
              },
            ]}
          />
        </Container>
      </Section>

      <Section>
        <Container>
          <SectionHeader
            eyebrow="Start wherever suits you"
            title="Two ways to start."
            lead="Book a free 20-minute call with Shaun to see the workflow against your own jobs, or create a free workspace and take it from there."
          />
          <ConversionPaths
            items={[
              {
                title: 'Book a free 20-minute call with Shaun',
                body: 'Show us how you quote long-run and measured roofing work and we will map the workflow to it. No obligation.',
                href: bookingHref,
                label: 'Book the call',
              },
              {
                title: 'Create a free workspace',
                body: 'Set up your workspace and start measuring, pricing and quoting in metric.',
                href: '/signup',
                label: 'Create a free workspace',
              },
            ]}
          />
        </Container>
      </Section>

      <Section tone="soft">
        <Container>
          <FaqAccordion faqs={faqs} title="Roofing quoting software NZ: common questions" eyebrow="FAQ" />
        </Container>
      </Section>

      <Section>
        <Container>
          <RelatedLinks
            items={[
              { href: '/nz/long-run-roofing-estimating', title: 'Long-run roofing estimating guide', body: 'Why roof area alone does not tell you how much long-run roofing to buy, and how to plan for hips, valleys and offcuts.' },
              { href: '/roofing-quoting-software', title: 'Roofing quoting software', body: 'The global product page for the full roofing quoting workflow.' },
              { href: '/features/offcut-optimiser', title: 'Offcut Optimiser', body: 'Generated whole-roof cutting plans for long-run and metal roofing.' },
            ]}
          />
        </Container>
      </Section>

      <FinalCta
        title="Quote NZ roofing work from the measurement up."
        body="Measure, price with your own rates, quote in NZD with GST, then carry accepted work into orders and invoices without re-typing the job."
        primary={{ href: bookingHref, label: 'Book a free 20-minute call with Shaun' }}
        secondary={{ href: '/signup', label: 'Create a free workspace' }}
      />
      <div style={{ height: 72 }} />
    </PageScaffold>
  );
}
