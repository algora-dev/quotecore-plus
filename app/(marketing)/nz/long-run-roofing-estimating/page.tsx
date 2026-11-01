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
import { buildBreadcrumbSchema, buildFaqSchema } from '@/lib/schema';
import { workflowCallHref } from '@/lib/booking';

const bookingHref = workflowCallHref;
const GLOBAL = 'https://quote-core.com';

export const metadata: Metadata = {
  title: 'Long-Run Roofing Estimating & Offcut Planning NZ | QuoteCore+',
  description:
    'Learn why roof area alone does not tell you how much long-run roofing to order, how hips and valleys create offcuts, and how better cut planning can improve material estimates.',
  alternates: {
    canonical: `${GLOBAL}/nz/long-run-roofing-estimating`,
  },
  openGraph: {
    title: 'Long-Run Roofing Estimating & Offcut Planning NZ | QuoteCore+',
    description:
      'Why roof area alone does not tell you how much long-run roofing to order, how hips and valleys create offcuts, and how better cut planning can improve material estimates.',
    url: `${GLOBAL}/nz/long-run-roofing-estimating`,
    siteName: 'QuoteCore+',
    type: 'website',
  },
};

const faqs: FaqItem[] = [
  {
    question: 'Why does roof area not equal purchased material?',
    answer:
      'Long-run roofing is ordered as real sheet lengths, not by the square metre. Two roofs with the same measured area can need very different purchased material depending on run lengths, sheet direction and where the angled cuts fall.',
  },
  {
    question: 'How do hips and valleys create offcuts?',
    answer:
      'Hips and valleys force diagonal cuts across the sheet. Each diagonal cut leaves a triangular or tapered leftover. Some of those pieces can be reused on another face, and others cannot, because of length, profile or fixing position.',
  },
  {
    question: 'What waste percentage should I add for long-run roofing?',
    answer:
      'There is no reliable single number. A blanket 10% or 15% can be too high on a simple gable and too low on a complex hip and valley roof. The geometry of the specific roof is what determines the extra material.',
  },
  {
    question: 'Can offcuts be reused on other faces?',
    answer:
      'Sometimes. An offcut is reusable when its profile, length and cut geometry match what another part of the roof needs. Offcut planning exists precisely because that matching is hard to do reliably in your head.',
  },
  {
    question: 'How does QuoteCore+ help with long-run estimating?',
    answer:
      'The Offcut Optimiser turns a reviewed roof takeoff into suggested whole-roof cutting plans, showing likely sheet counts, purchased lengths and reusable offcuts before the quote is priced. See the feature page for how it works.',
  },
  {
    question: 'Does this only apply in New Zealand?',
    answer:
      'No. The estimating problem applies anywhere cut-to-length metal roofing is used, including Australia and other markets. This page frames it for NZ long-run roofing because that is where the question comes up most.',
  },
];

const schemas = [
  buildBreadcrumbSchema([
    { name: 'Home', url: `${GLOBAL}/` },
    { name: 'New Zealand', url: `${GLOBAL}/nz/roofing-quoting-software` },
    { name: 'Long-Run Roofing Estimating', url: `${GLOBAL}/nz/long-run-roofing-estimating` },
  ]),
  buildFaqSchema(faqs),
];

export default function NzLongRunRoofingEstimatingPage() {
  return (
    <PageScaffold
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Long-Run Roofing Estimating NZ' }]}
      schemas={schemas}
    >
      <Hero
        eyebrow="NZ long-run roofing estimating"
        title={<>Long-run roofing estimating for hips, valleys and offcuts.</>}
        lead="Roof area alone does not tell you how much long-run roofing to buy. Here is why, and how to plan cut-to-length material properly before the price is fixed."
        primary={{ href: bookingHref, label: 'Book a free 20-minute workflow call' }}
        secondary={{ href: '/free-roof-takeoff', label: 'Try the free roof takeoff' }}
        proof={['Cut-to-length sheeting', 'Hips, valleys and angled cuts', 'Reusable offcut planning']}
      />

      <Section>
        <Container>
          <SectionHeader
            eyebrow="Area is not purchased material"
            title="Long-run roofing is bought as lengths, not as square metres."
            lead="A supplier sells you sheets at real ordered lengths. When you price a long-run roof, the number that matters is how many sheets, at what lengths, you actually have to buy. Area is only the starting point."
          />
          <FeatureGrid
            items={[
              {
                title: 'Same area, different roof',
                body: <p>Two roofs can both measure 180 square metres and need noticeably different purchased material, because run lengths and cut positions differ.</p>,
              },
              {
                title: 'Sheet direction matters',
                body: <p>Sheets run from gutter to ridge on each face. Face width and slope length decide how many sheet widths and what ordered lengths the roof consumes.</p>,
              },
              {
                title: 'Every cut leaves something',
                body: <p>Ends, junctions and penetrations all leave material behind. Whether that material is usable elsewhere is the question a plain area figure never answers.</p>,
              },
            ]}
          />
        </Container>
      </Section>

      <Section tone="soft">
        <Container>
          <SectionHeader
            eyebrow="Simple roofs vs hips and valleys"
            title="A simple gable is easy. Hips and valleys change the maths."
            lead="The gap between a comfortable estimate and a costly one usually appears where angled cuts start."
          />
          <FeatureGrid
            columns={2}
            items={[
              {
                title: 'Straight runs are predictable',
                body: <p>On a plain skillion or simple gable roof, most sheets are full-length runs. Quantities are close to area divided by cover width, with modest allowances. Offcut planning adds little here.</p>,
              },
              {
                title: 'Hips and valleys force diagonal cuts',
                body: <p>Where planes meet at an angle, sheets must be cut diagonally. Each diagonal cut produces a tapered leftover rather than a clean offcut.</p>,
              },
              {
                title: 'Some leftovers can be reused',
                body: <p>A tapered piece can sometimes supply the matching cut on another face. Whether it does depends on its length, profile and the direction of the next cut.</p>,
              },
              {
                title: 'Some leftovers cannot',
                body: <p>Short, awkward or wrong-direction pieces have nowhere useful to go. On heavily cut-up roofs, this unusable fraction is where blanket estimates come unstuck.</p>,
              },
            ]}
          />
        </Container>
      </Section>

      <Section>
        <Container>
          <SplitFeature
            reverse
            visual={
              <ProductFrame
                src="/marketing/current-ux/offcut-optimiser-plan.webp"
                alt="A generated whole-roof cut plan showing sheet counts, purchased lengths and reusable offcuts on a hip and valley roof"
                width={2048}
                height={1109}
                caption="A generated cutting plan for a hip and valley roof: which lengths are purchased, and which angled offcuts are reused where."
              />
            }
          >
            <h2>Why a flat waste percentage is a blunt tool.</h2>
            <p>
              A blanket 10% or 15% waste allowance is simple, and on uncomplicated roofs it is often close enough. The trouble starts on complex geometry.
            </p>
            <BulletList
              items={[
                'On simple straight runs it can overstate the material you need',
                'On hip and valley heavy roofs it can understate it badly',
                'The right allowance depends on the specific roof, not a habit',
                'Discovering the shortfall after the price is agreed eats the margin',
              ]}
            />
            <p>
              We are not claiming a fixed saving figure. The point is simpler: the purchased material for a long-run roof is knowable before quoting, so it is worth checking rather than guessing.
            </p>
          </SplitFeature>
        </Container>
      </Section>

      <Section tone="soft">
        <Container>
          <SectionHeader
            eyebrow="Practical workflow"
            title="How to estimate long-run material properly."
            lead="The sequence an experienced roofer follows, made explicit. This is also the sequence the QuoteCore+ workflow supports end to end."
          />
          <WorkflowRail
            steps={[
              { label: 'Geometry', body: 'Establish the reviewed roof geometry: areas, faces, slopes and junctions from takeoff or plan measurement.' },
              { label: 'Sheeting', body: 'Fix the sheet direction and the ordered lengths the supplier sells for each face.' },
              { label: 'Angled cuts', body: 'Identify where hips, valleys and other junctions force diagonal cuts.' },
              { label: 'Offcuts', body: 'Work out which tapered leftovers can realistically be reused on another face.' },
              { label: 'Purchased material', body: 'Calculate the sheets and lengths you would actually buy, not the area.' },
              { label: 'Price', body: 'Price the job from that material requirement, so the quote carries a defensible allowance.' },
            ]}
          />
        </Container>
      </Section>

      <Section>
        <Container>
          <SectionHeader
            eyebrow="How QuoteCore+ helps"
            title="The cut-plan check, moved before the quote."
            lead="QuoteCore+ does this from the measured roof instead of a paper sketch, and keeps the result connected to pricing."
          />
          <FeatureGrid
            items={[
              {
                title: 'Digital roof takeoff',
                body: <p>Measure the roof in metric from plans or on site. The geometry feeds everything downstream. <Link href="/free-roof-takeoff" className="text-[#BD4A1A] underline underline-offset-2">Try it free</Link>.</p>,
              },
              {
                title: 'Offcut Optimiser',
                body: <p>Generates suggested whole-roof cutting plans from the reviewed takeoff, so sheet counts, purchased lengths and reusable offcuts are visible before pricing. <Link href="/features/offcut-optimiser" className="text-[#BD4A1A] underline underline-offset-2">See the feature</Link>.</p>,
              },
              {
                title: 'Quote to order',
                body: <p>The material requirement flows into the quote, and accepted work becomes a supplier order with lengths and quantities carried over. <Link href="/nz/roofing-quoting-software" className="text-[#BD4A1A] underline underline-offset-2">See the NZ quoting workflow</Link>.</p>,
              },
            ]}
          />
          <div className="mt-8">
            <TextLink href="/pricing">See pricing</TextLink>
          </div>
        </Container>
      </Section>

      <Section tone="soft">
        <Container>
          <SectionHeader
            eyebrow="Next steps"
            title="See it on a roof like yours."
            lead="The fastest route is to measure a real roof free, or let us walk your current long-run process with you."
          />
          <ConversionPaths
            items={[
              {
                title: 'Try the free roof takeoff',
                body: 'Measure a roof plan in the browser and see the geometry that sits underneath cut planning.',
                href: '/free-roof-takeoff',
                label: 'Open the free roof takeoff',
              },
              {
                title: 'Book a free 20-minute call',
                body: 'Show us how you currently estimate long-run work and we will walk the workflow against your process.',
                href: bookingHref,
                label: 'Book the call',
              },
              {
                title: 'See pricing',
                body: 'Add Offcut Optimiser in the pricing builder and see the resulting monthly subscription.',
                href: '/pricing',
                label: 'See pricing',
              },
            ]}
          />
        </Container>
      </Section>

      <Section>
        <Container>
          <FaqAccordion faqs={faqs} title="Long-run roofing estimating FAQ" eyebrow="FAQ" />
        </Container>
      </Section>

      <Section tone="soft">
        <Container>
          <RelatedLinks
            items={[
              { href: '/nz/roofing-quoting-software', title: 'Roofing quoting software NZ', body: 'The full NZ quoting workflow from measurement to invoice, including long-run roofing.' },
              { href: '/features/offcut-optimiser', title: 'Offcut Optimiser', body: 'The feature that generates whole-roof cutting plans from a reviewed takeoff.' },
              { href: '/free-roof-takeoff', title: 'Free roof takeoff', body: 'Measure a roof plan free in the browser, no signup.' },
              { href: '/roofing-estimating-software', title: 'Roofing estimating software', body: 'The global view of the measure to price workflow.' },
            ]}
          />
        </Container>
      </Section>

      <FinalCta
        title="Know the sheets before you fix the price."
        body="Plan the cuts and purchased lengths before the quote is sent, and the margin survives contact with the material order."
        primary={{ href: bookingHref, label: 'Book a free 20-minute workflow call' }}
        secondary={{ href: '/free-roof-takeoff', label: 'Try the free roof takeoff' }}
      />
      <div style={{ height: 72 }} />
    </PageScaffold>
  );
}
