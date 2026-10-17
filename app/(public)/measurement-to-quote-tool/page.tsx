import type { Metadata } from 'next';
import FreeQuoteBuilder from './FreeQuoteBuilder';
import type { Trade } from './measurement-model';
import {
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
import { buildBreadcrumbSchema, buildFaqSchema } from '@/lib/schema';

export const metadata: Metadata = {
  title: 'Free Measurement-to-Quote Tool | QuoteCore+',
  description: 'Already have measurements? Enter areas, lengths or quantities, apply reusable materials, labour, waste and pricing rules, then review the priced output. Free core workflow, no signup.',
  alternates: { canonical: 'https://quote-core.com/measurement-to-quote-tool' },
  openGraph: {
    title: 'Free Measurement-to-Quote Tool | QuoteCore+',
    description: 'Turn measurements you already have into materials, labour and priced output with reusable component rules.',
    url: 'https://quote-core.com/measurement-to-quote-tool', siteName: 'QuoteCore+', type: 'website',
  },
};

const faqs: FaqItem[] = [
  { question: 'What is the Measurement-to-Quote tool for?', answer: 'It is for measured work where you already know the areas, lengths or quantities. Add or import reusable pricing components, enter the measurements and review the resulting materials, labour, waste and priced output.' },
  { question: 'Can I price a job from measurements I already have?', answer: 'Yes. Measurements can come from a site measure, another takeoff, a report, a spreadsheet or your own notes. You do not need to redraw a plan just to use those quantities.' },
  { question: 'Can I import a spreadsheet or CSV price list?', answer: 'Yes. The free tool supports CSV import with mapping for a limited component library. For larger catalogues, use the dedicated Catalog-to-Component Converter or the saved app workflow.' },
  { question: 'How are pitch, waste and pack sizes handled?', answer: 'Component rules can apply pitch logic, waste allowances and pack pricing according to the settings in the tool. Review the component setup and measurements before using the result for a real job.' },
  { question: 'Can I turn the result into a customer quote?', answer: 'Yes. The free workflow can move priced lines toward a customer quote, and the paid QuoteCore+ app keeps the saved job, reusable component library and downstream documents connected.' },
  { question: 'Is the Measurement-to-Quote tool free?', answer: 'Yes. The core browser workflow is free and does not require signup to start. The paid app is separate and adds saved jobs, reusable account setup and the connected quoting, ordering and invoicing workflow.' },
  { question: 'Does the free tool permanently save my pricing library?', answer: 'No. The free tool is for the current browser task. Use the paid QuoteCore+ app when you want a persistent reusable component library and saved jobs.' },
  { question: 'What is the difference between this and Digital Takeoff?', answer: 'Measurement-to-Quote starts after measuring. Digital Takeoff is for measuring a plan or image first. Both can lead into the same idea: quantities drive reusable pricing rules.' },
];

const schemas = [
  {
    '@context': 'https://schema.org', '@type': 'WebApplication', name: 'QuoteCore+ Measurement-to-Quote Tool',
    applicationCategory: 'BusinessApplication', operatingSystem: 'Web',
    url: 'https://quote-core.com/measurement-to-quote-tool',
    description: 'Free browser tool for turning measured areas, lengths and quantities into materials, labour and priced output.',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  },
  buildBreadcrumbSchema([{ name: 'Home', url: 'https://quote-core.com/' }, { name: 'Measurement-to-Quote Tool', url: 'https://quote-core.com/measurement-to-quote-tool' }]),
  buildFaqSchema(faqs),
];

export default async function Page({ searchParams }: { searchParams?: Promise<{ mode?: string; trade?: string }> }) {
  const params = (await searchParams) ?? {};
  const initialMode = params.mode === 'actual' || params.mode === 'plan' ? params.mode : undefined;
  const initialTrade = ['roofing', 'cladding', 'flooring'].includes(params.trade ?? '') ? params.trade as Trade : undefined;

  return (
    <PageScaffold breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Free tools', href: '/free-tools' }, { label: 'Measurement-to-Quote' }]} schemas={schemas}>
      <Hero
        eyebrow="Free measurement-to-quote tool"
        title={<>Already have measurements? Turn them into materials, labour and pricing.</>}
        lead="Enter areas, lengths or quantities from a site measure, plan takeoff, aerial report or spreadsheet. Reusable components apply your pricing rules, then you can review the result, build a customer quote or carry the workflow into QuoteCore+."
        primary={{ href: '#measurement-tool', label: 'Use the free tool' }}
        secondary={{ href: '/demo', label: 'Explore the interactive app demo' }}
        proof={['Free core workflow', 'No signup to start', 'Use measurements you already have']}
        visual={<ProductFrame src="/marketing/current-ux/quote-builder-components-measurements.webp" alt="QuoteCore+ Quote Builder with measurements and Smart Components" width={2048} height={1112} eager caption="The paid app keeps measured quantities, reusable Smart Components and the priced job together. The free tool below lets you try the core measurement-to-pricing idea first." />}
      />

      <div id="measurement-tool"><FreeQuoteBuilder initialMode={initialMode} initialTrade={initialTrade} /></div>

      <Section>
        <Container>
          <SectionHeader eyebrow="Components, measurements and priced output" title="You already did the measuring. Do not rebuild the pricing every time." lead="The free tool is for contractors who already know the quantities. Add the pricing logic, enter what changed for this job, then review the result." />
          <FeatureGrid items={[
            { kicker: '01', title: 'Add your pricing components', body: <p>Start with example components, edit them to match your rates or import a CSV. Components can carry material, labour, waste, pack and pitch rules.</p> },
            { kicker: '02', title: 'Enter the measurements', body: <p>Add areas, lineal lengths or quantities from site, another takeoff, a report or your own notes. Use the measurements you already trust.</p> },
            { kicker: '03', title: 'Review the priced output', body: <p>See the materials, labour and calculated job cost, then print the result or move it toward the next quoting step.</p> },
          ]} />
        </Container>
      </Section>

      <Section tone="soft">
        <Container>
          <SplitFeature visual={<ProductFrame src="/marketing/current-ux/quote-builder-components-measurements.webp" alt="Current QuoteCore+ Quote Builder showing Smart Components and job measurements" width={2048} height={1112} caption="The paid app saves the component library and measured job so the next quote does not start from a blank tool." />}>
            <h2>Free tool for the current task. Saved app workflow for repeat work.</h2>
            <p>The free tool is useful when you need to price the job in front of you. The paid QuoteCore+ app is for keeping the setup and job history so those pricing rules are ready again tomorrow.</p>
            <FeatureGrid columns={2} items={[
              { kicker: 'Free browser tool', title: 'Current task', body: <p>Limited component library, measurements and priced output without creating a paid account.</p> },
              { kicker: 'Paid app', title: 'Reusable workflow', body: <p>Saved Smart Components, saved jobs, customer quotes, orders and invoices connected to the account.</p> },
            ]} />
          </SplitFeature>
        </Container>
      </Section>

      <Section>
        <Container>
          <SectionHeader eyebrow="Spreadsheet comparison" title="A spreadsheet can calculate well. The bigger difference is what happens around the calculation." lead="A good spreadsheet is not the enemy. The question is whether you want to keep maintaining formulas and moving the result into the rest of the job workflow yourself." />
          <FeatureGrid columns={2} items={[
            { title: 'Spreadsheet workflow', body: <p>Flexible calculations, but formulas, templates, price maintenance and copying numbers into customer documents remain your responsibility.</p> },
            { title: 'Reusable component workflow', body: <p>Save the material, labour, waste and pricing rules once, apply them to the measured quantity and keep the priced job connected to the next documents.</p> },
          ]} />
        </Container>
      </Section>

      <Section tone="soft">
        <Container>
          <SectionHeader eyebrow="Choose the right starting point" title="Choose the tool based on what you already have." />
          <FeatureGrid columns={3} items={[
            { title: 'I need to measure a roof plan', body: <p><a href="/free-roofing-takeoff-builder">Use the free roof takeoff tool.</a></p> },
            { title: 'I need to measure cladding or walls', body: <p><a href="/free-cladding-takeoff">Use the free cladding takeoff tool.</a></p> },
            { title: 'I need to measure a floor plan', body: <p><a href="/free-flooring-takeoff">Use the free flooring takeoff tool.</a></p> },
            { title: 'I already have measurements', body: <p>Stay here and enter the quantities you already know.</p> },
            { title: 'I only need the finished quote', body: <p><a href="/free-quote-generator">Use the free quote generator.</a></p> },
            { title: 'I have a large CSV price list', body: <p><a href="/free-smart-component-creator">Use the Catalog-to-Component Converter.</a></p> },
          ]} />
        </Container>
      </Section>

      <Section><Container><FaqAccordion faqs={faqs} title="Measurement-to-Quote FAQ" /></Container></Section>

      <Section tone="soft">
        <Container>
          <SectionHeader eyebrow="Next step" title="Choose the next step that suits you" />
          <ConversionPaths items={[
            { title: 'Explore the interactive app demo', body: 'See how saved measurements, pricing, quotes and the job workflow fit together in a prepared account.', href: '/demo', label: 'Explore the demo' },
            { title: 'Build your configuration', body: 'Choose the workload and tools you want in the paid app and see the current monthly price.', href: '/pricing', label: 'See pricing' },
            { title: 'Bring your existing pricing with you', body: 'Done For You Setup can help translate agreed spreadsheets, products, labour and pricing logic into your QuoteCore+ account.', href: '/done-for-you-setup', label: 'Explore Done For You' },
          ]} />
        </Container>
      </Section>

      <FinalCta title="Already measured the job? Start from what you know." body="Use the free tool for the current task, then explore the saved QuoteCore+ workflow when you want those pricing rules and jobs ready to reuse." primary={{ href: '#measurement-tool', label: 'Use the free tool' }} secondary={{ href: '/demo', label: 'Explore the app demo' }} />
      <div style={{ height: 72 }} />
    </PageScaffold>
  );
}
