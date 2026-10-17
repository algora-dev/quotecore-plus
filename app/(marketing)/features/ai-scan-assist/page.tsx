import type { Metadata } from 'next';
import {
  BulletList,
  Container,
  ConversionPaths,
  FaqAccordion,
  FeatureGrid,
  FinalCta,
  FitPanel,
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
import { hreflangLanguages } from '@/lib/seo/hreflang';

export const metadata: Metadata = {
  title: 'AI Roof Takeoff & Roof Plan Measurement | QuoteCore+',
  description: 'Use AI Scan Assist to complete roof geometry on clear, correctly calibrated plans, then review or edit the result in the same Digital Takeoff workspace before pricing.',
  alternates: { canonical: 'https://quote-core.com/features/ai-scan-assist', languages: hreflangLanguages('/features/ai-scan-assist') },
  openGraph: {
    title: 'AI Roof Takeoff & Roof Plan Measurement | QuoteCore+',
    description: 'AI Scan Assist can complete suitable roof-plan geometry quickly and keep the result fully editable before it flows into your pricing workflow.',
    url: 'https://quote-core.com/features/ai-scan-assist',
    siteName: 'QuoteCore+',
    type: 'website',
  },
};

const faqs: FaqItem[] = [
  { question: 'Can AI Scan Assist complete an entire roof takeoff?', answer: 'Yes. On a clear, correctly calibrated plan, especially a simple to moderately complex roof, AI Scan Assist can complete the roof geometry accurately. The detected result stays editable in the same Digital Takeoff workspace.' },
  { question: 'How accurate is AI roof takeoff?', answer: 'There is no responsible single accuracy percentage for every drawing. The strongest results come from a clear source plan, correct scale calibration and geometry that is not unusually complex. On suitable plans the roof geometry can be completed correctly end to end; lower-quality or more complex drawings are more likely to need edits.' },
  { question: 'What makes AI Scan Assist more or less accurate?', answer: 'The main practical variables are source drawing clarity, correct calibration and roof complexity. Clean linework and a reliable known dimension give the system the best information to work from.' },
  { question: 'Do I need to calibrate the plan first?', answer: 'Yes. The plan scale needs to be calibrated against a known dimension so the geometry becomes useful real-world measurements rather than just lines on an image.' },
  { question: 'Can I edit the AI result?', answer: 'Yes. Areas and roof lines remain editable in the same takeoff workspace. You can correct geometry, add missing measurements or continue measuring manually.' },
  { question: 'Can I measure manually instead?', answer: 'Yes. Manual Digital Takeoff remains available whether you want full manual control from the start or only need to adjust part of an AI-assisted result.' },
  { question: 'How does the takeoff become an estimate or quote?', answer: 'The measured areas and lengths can flow into Smart Components, where your saved materials, labour, waste and pricing logic turn quantities into a priced job. You can then build the customer quote from that same workflow.' },
  { question: 'How is AI Scan Assist priced?', answer: 'AI Scan Assist is one of the configurable tools in the QuoteCore+ pricing builder. Choose the usage allowance that fits your expected workflow and the builder shows the resulting monthly subscription price.' },
];

const schemas = [
  buildSoftwareApplicationSchema(),
  buildBreadcrumbSchema([
    { name: 'Home', url: 'https://quote-core.com/' },
    { name: 'Features', url: 'https://quote-core.com/features' },
    { name: 'AI Scan Assist', url: 'https://quote-core.com/features/ai-scan-assist' },
  ]),
  buildFaqSchema(faqs),
];

export default function AiScanAssistPage() {
  return (
    <PageScaffold breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Features', href: '/features' }, { label: 'AI Scan Assist' }]} schemas={schemas}>
      <Hero
        eyebrow="AI Scan Assist"
        title={<>Let AI Scan Assist complete the roof takeoff, then edit only if you need to.</>}
        lead="On a clear, correctly calibrated plan, especially a simple to moderately complex roof, AI Scan Assist can identify the roof geometry and complete the takeoff quickly and accurately. Plan quality, scale calibration and roof complexity determine when manual adjustments are more likely."
        primary={{ href: '/takeoff-demo?mode=ai', label: 'Try AI Scan Assist' }}
        secondary={{ href: '/demo', label: 'Explore the full app demo' }}
        proof={['Can complete suitable roof plans', 'Same workspace as manual takeoff', 'Every result remains editable']}
        visual={<ProductFrame src="/marketing/current-ux/ai-scan-assist-completed-roof.webp" alt="Completed roof geometry produced with QuoteCore+ AI Scan Assist" width={2048} height={1114} eager caption="A completed AI-assisted roof takeoff on a clear, correctly calibrated medium-complexity plan." />}
      />

      <Section>
        <Container>
          <SectionHeader eyebrow="What it does" title="A full roof geometry result, not just a starter sketch." lead="AI Scan Assist is designed to identify the roof geometry required for takeoff so a suitable plan can move from a calibrated drawing to measured roof areas and roof lines without tracing every element manually." />
          <FeatureGrid items={[
            { title: 'Roof areas', body: <p>Identify the roof faces and measured areas used downstream in the takeoff.</p> },
            { title: 'Ridges, hips and valleys', body: <p>Detect the internal roof lines that drive flashing and material quantities.</p> },
            { title: 'Barges and spouting', body: <p>Identify supported perimeter roof lines where the drawing and geometry are clear enough.</p> },
          ]} />
        </Container>
      </Section>

      <Section tone="soft">
        <Container>
          <SectionHeader eyebrow="Accuracy" title="The strongest results come down to three practical things." lead="AI performance depends on the information in the drawing. These are the factors that matter most in normal use." />
          <FeatureGrid items={[
            { kicker: '01', title: 'Correct calibration', body: <p>Set the plan scale from a reliable known dimension before relying on the resulting measurements.</p> },
            { kicker: '02', title: 'Clear source drawing', body: <p>Sharp, readable roof geometry gives AI Scan Assist cleaner information to interpret than blurred, compressed or ambiguous linework.</p> },
            { kicker: '03', title: 'Roof complexity', body: <p>Simple and moderately complex geometry is generally more predictable. Unusual or highly complex roofs are more likely to benefit from manual review and editing.</p> },
          ]} />
        </Container>
      </Section>

      <Section>
        <Container>
          <SplitFeature visual={<ProductFrame src="/marketing/current-ux/ai-scan-assist-completed-roof.webp" alt="Completed AI Scan Assist roof takeoff with detected roof areas and roof lines" width={2048} height={1114} caption="On a suitable plan, the detected geometry may already be the complete takeoff result. Review it before using the measurements commercially." />}>
            <h2>On a good plan, the AI result may already be the finished geometry.</h2>
            <p>AI Scan Assist is not limited to producing a rough outline that must always be rebuilt. When the drawing is clear, the scale is correct and the roof geometry is suitable, the detected areas and roof lines can be complete without geometry corrections.</p>
            <BulletList items={['Review the completed geometry before pricing', 'Keep detected areas and lines editable', 'Correct only the parts that actually need correction', 'Use the same measured result downstream in the pricing workflow']} />
          </SplitFeature>
        </Container>
      </Section>

      <Section tone="soft">
        <Container>
          <SplitFeature reverse visual={<ProductFrame src="/marketing/current-ux/digital-takeoff-manual.webp" alt="Manual measurement tools in the QuoteCore+ Digital Takeoff workspace" width={2048} height={1114} caption="Manual Digital Takeoff is available in the same workspace for edits, additions or fully manual jobs." />}>
            <h2>Manual control is built into the same takeoff workspace.</h2>
            <p>If a plan is not a good fit for automated detection, you do not need another product. Edit the result, add a missing line or area, or measure the drawing manually from the start.</p>
            <BulletList items={['Edit detected roof geometry', 'Add missing areas or lengths', 'Measure the full plan manually when you prefer', 'Keep the calibrated drawing and takeoff together']} />
            <TextLink href="/features/digital-roof-takeoff">Explore Digital Roof Takeoff</TextLink>
          </SplitFeature>
        </Container>
      </Section>

      <Section tone="dark">
        <Container>
          <SectionHeader eyebrow="From takeoff to price" title="The takeoff becomes useful when it carries into your pricing." lead="The result is not meant to stop at measured geometry. QuoteCore+ connects the quantities to the pricing rules you have configured for the job." dark />
          <WorkflowRail steps={[
            { label: 'Calibrate', body: 'Set the scale from a known dimension.' },
            { label: 'Scan', body: 'Let AI Scan Assist identify suitable roof geometry.' },
            { label: 'Review', body: 'Check the result and edit only where required.' },
            { label: 'Price', body: 'Apply Smart Components with your saved material, labour, waste and pricing logic.' },
            { label: 'Quote', body: 'Build the customer document from the priced job.' },
          ]} />
        </Container>
      </Section>

      <Section>
        <Container>
          <SplitFeature visual={<ProductFrame src="/marketing/current-ux/quote-builder-components-measurements.webp" alt="QuoteCore+ Quote Builder with measured quantities and Smart Components" width={2048} height={1112} caption="Measured roof quantities can flow into Smart Components and the Quote Builder rather than being re-entered into a separate spreadsheet." />}>
            <h2>From AI geometry to your own material and labour pricing.</h2>
            <p>Smart Components use the measurements from the job together with the material products, labour, waste, coverage and pricing rules you have saved. The AI does not decide your selling price. Your pricing setup does.</p>
            <TextLink href="/features/smart-components">See how Smart Components work</TextLink>
          </SplitFeature>
        </Container>
      </Section>

      <Section tone="soft">
        <Container>
          <FitPanel
            title="Fast when the plan suits AI, fully editable when it does not."
            bestFor={['Clear roof plans with a reliable scale or known dimension', 'Simple to moderately complex roof geometry', 'Roofers who want to reduce manual tracing before pricing', 'Teams that still want direct control over the takeoff result']}
            limits={['Poor-quality or ambiguous drawings can reduce consistency', 'Incorrect calibration produces incorrect real-world measurements', 'Highly unusual or complex geometry can require more manual adjustment', 'The contractor should review measurements before relying on them commercially']}
          />
        </Container>
      </Section>

      <Section>
        <Container>
          <SectionHeader eyebrow="Try it" title="Try the AI result first, then explore the wider workflow." lead="Use the focused takeoff demo when you want to test the roof measurement experience. Use the full app demo when you want to understand what happens after the takeoff." />
          <ConversionPaths items={[
            { title: 'Try AI Scan Assist', body: 'Use a sample roof plan in the focused takeoff demo and see the AI-assisted workflow without creating a paid account.', href: '/takeoff-demo?mode=ai', label: 'Try AI Scan Assist' },
            { title: 'Explore the interactive app demo', body: 'Open a prepared QuoteCore+ workspace and explore the broader estimating, quoting and job workflow.', href: '/demo', label: 'Explore the app demo' },
            { title: 'Build your configuration', body: 'Add the AI Scan Assist allowance that fits your expected use and see the resulting monthly subscription price.', href: '/pricing', label: 'See pricing' },
          ]} />
        </Container>
      </Section>

      <Section tone="soft">
        <Container><FaqAccordion faqs={faqs} title="AI Scan Assist FAQ" /></Container>
      </Section>

      <Section>
        <Container>
          <RelatedLinks items={[
            { href: '/roofing-takeoff-software', title: 'Roofing takeoff software', body: 'Compare AI-assisted and manual roof measurement in the broader takeoff workflow.' },
            { href: '/features/digital-roof-takeoff', title: 'Digital Roof Takeoff', body: 'See the shared manual takeoff workspace and editing controls.' },
            { href: '/features/smart-components', title: 'Smart Components', body: 'See how measured quantities become materials, labour, waste and pricing.' },
            { href: '/roofing-estimating-software', title: 'Roofing estimating software', body: 'Follow measured roof quantities into a priced estimate and customer quote.' },
          ]} />
        </Container>
      </Section>

      <FinalCta title="Let AI do the roof geometry first. Keep control when the plan gets harder." body="Try the focused AI takeoff demo on a sample plan, then explore the full QuoteCore+ workflow when you want to see how those measurements become pricing and a customer quote." primary={{ href: '/takeoff-demo?mode=ai', label: 'Try AI Scan Assist' }} secondary={{ href: '/demo', label: 'Explore the full app demo' }} />
      <div style={{ height: 72 }} />
    </PageScaffold>
  );
}
