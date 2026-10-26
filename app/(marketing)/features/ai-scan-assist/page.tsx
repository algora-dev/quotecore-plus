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
import { workflowCallHref } from '@/lib/booking';

const bookingHref = workflowCallHref;

export const metadata: Metadata = {
  title: 'Roof Scan Assist: AI Roof Takeoff From Roof Plans | QuoteCore+',
  description: 'Roof Scan Assist scans a calibrated roof plan in two stages, builds editable roof geometry for you, and on clear, simple-to-medium plans commonly completes both stages in around 1-2 minutes.',
  alternates: { canonical: 'https://quote-core.com/features/ai-scan-assist', languages: hreflangLanguages('/features/ai-scan-assist') },
  openGraph: {
    title: 'Roof Scan Assist: AI Roof Takeoff From Roof Plans | QuoteCore+',
    description: 'Scan a roof plan instead of tracing every line. Review, edit or replace the result in the same Digital Takeoff workspace before pricing.',
    url: 'https://quote-core.com/features/ai-scan-assist',
    siteName: 'QuoteCore+',
    type: 'website',
  },
};

const faqs: FaqItem[] = [
  { question: 'What is an AI roof takeoff?', answer: 'Software interprets a roof plan and builds measured roof geometry automatically. QuoteCore+ leaves that geometry editable for review rather than returning a static report.' },
  { question: 'Can I use Roof Scan Assist on my phone?', answer: 'Yes. Roof Scan Assist is available in the mobile Digital Takeoff experience as well as on desktop. It scans roof plans and drawings from the phone; it is not a camera or satellite scan of the physical roof.' },
  { question: 'Can I scan an actual roof with my phone camera?', answer: 'No. Roof Scan Assist is designed for roof plans and drawings. It is not a satellite report or camera-based physical roof scanner.' },
  { question: 'How accurate is it?', answer: 'There is no single percentage for every drawing. Correct calibration, source-plan clarity and roof complexity are the main variables that determine how much review or correction the result needs.' },
  { question: 'Why use it if I can trace manually?', answer: 'It can reduce hands-on attention even when manual tracing is already fast. On a clear, correctly calibrated plan, a typical simple-to-medium complexity roof commonly completes both scan stages in around 1-2 minutes, and simple roofs can be faster. You can use that short window for another task, then review and fix only what needs correction.' },
  { question: 'Does a complex scan use more tokens?', answer: 'Yes. Each of the two scan stages can use the level that suits that part of the roof. For example, use Simple for an easy outside outline and Medium+ for more complicated internal geometry. Heavier processing can take longer and use more scan tokens, so you do not need to spend maximum tokens on every stage.' },
  { question: 'Why are there two scan stages?', answer: 'The first scan traces the outside roof outline, including the eave or gutter and barge or rake boundaries. You review that outline first. Then you either draw the internal roof components manually or run the second scan to find them. You can choose Simple, Medium or Medium+ independently for each stage.' },
  { question: 'Can I edit the result?', answer: 'Yes. Correct, add, continue manually or discard the automated result in the same workspace. The normal Digital Takeoff tools remain available at every stage.' },
];

const schemas = [
  buildSoftwareApplicationSchema(),
  buildBreadcrumbSchema([
    { name: 'Home', url: 'https://quote-core.com/' },
    { name: 'Features', url: 'https://quote-core.com/features' },
    { name: 'Roof Scan Assist', url: 'https://quote-core.com/features/ai-scan-assist' },
  ]),
  buildFaqSchema(faqs),
];

export default function RoofScanAssistPage() {
  return (
    <PageScaffold breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Features', href: '/features' }, { label: 'Roof Scan Assist' }]} schemas={schemas}>
      <Hero
        eyebrow="Roof Scan Assist"
        title={<>Scan a roof plan instead of tracing every line.</>}
        lead="Roof Scan Assist reads a calibrated roof plan, identifies the roof faces and supported roof lines, and builds the takeoff for you. On a clear, correctly calibrated plan, a typical simple-to-medium complexity roof commonly completes both scan stages in around 1-2 minutes, and simple roofs can be faster."
        primary={{ href: '/takeoff-demo?mode=ai', label: 'Try Roof Scan Assist' }}
        secondary={{ href: bookingHref, label: 'Book a tailored 20-minute demo' }}
        proof={['Desktop and mobile', 'Fully editable result', 'Scan options for different roof complexity']}
        visual={<ProductFrame src="/marketing/current-ux/ai-scan-assist-completed-roof.webp" alt="Completed roof geometry produced by QuoteCore+ Roof Scan Assist" width={2048} height={1114} eager caption="A completed Roof Scan Assist result. The roof geometry stays editable in the same Digital Takeoff workspace before it is used for offcuts, pricing or quoting." />}
      />

      <Section>
        <Container>
          <SectionHeader eyebrow="Direct answer" title="What does Roof Scan Assist actually do?" lead="It automates the repetitive part of a roof takeoff from plans. Instead of clicking around the drawing to trace every face and roof line, you calibrate the plan, choose the appropriate scan option and let the system build the geometry for you." />
          <FeatureGrid items={[
            { title: 'Build roof faces', body: <p>Identify the visible roof planes and turn them into measured areas inside the takeoff.</p> },
            { title: 'Find supported roof lines', body: <p>Detect supported ridges, hips, valleys, barges and spouting where the source drawing is clear enough.</p> },
            { title: 'Leave everything editable', body: <p>Review the result, fix a line in seconds, add what is missing or switch to manual takeoff without changing tools.</p> },
          ]} />
        </Container>
      </Section>

      <Section tone="soft">
        <Container>
          <SectionHeader eyebrow="Save attention, not only minutes" title="A fast scan is useful even when you are already good at manual takeoff." lead="A competent estimator might trace a straightforward roof in a few minutes. The difference is that manual tracing occupies those minutes. Roof Scan Assist can do the repetitive work while you use that attention somewhere else." />
          <WorkflowRail steps={[
            { label: 'Calibrate', body: 'Set the scale from a reliable known dimension.' },
            { label: 'Start the scan', body: 'Choose the scan option that matches the roof complexity.' },
            { label: 'Do something else', body: 'Answer an email, make a call or move another task forward while the scan processes.' },
            { label: 'Review', body: 'Return to the completed geometry and inspect the areas and roof lines.' },
            { label: 'Fix only what needs it', body: 'Correct the small exception if there is one, then continue to the next step.' },
          ]} />
        </Container>
      </Section>

      <Section>
        <Container>
          <SectionHeader eyebrow="Two scan stages" title="Scan the outline first. Review it. Then choose what happens next." lead="Roof Scan Assist works in two phases, so the repetitive geometry work happens in a sensible order instead of one opaque pass." />
          <FeatureGrid columns={2} items={[
            { kicker: 'Stage 1', title: 'The outside roof outline', body: <p>The first scan traces the external roof outline, including the eave or gutter and barge or rake boundaries. You review that outline before continuing.</p> },
            { kicker: 'Stage 2', title: 'Internal roof components, optional', body: <p>Draw the internal roof components manually, or ask Roof Scan Assist to detect them in a second scan. Both paths keep the result in the same editable workspace.</p> },
          ]} />
          <div className="mt-10">
            <SectionHeader align="center" title="Choose the processing level for each stage." lead="Simple, Medium or Medium+ can be selected independently at each stage. Use lighter processing on an easy outside outline and heavier processing on more complicated internal geometry, so scan tokens are spent where they matter." />
            <FeatureGrid items={[
              { kicker: 'Simple', title: 'Lighter analysis', body: <p>Suits straightforward geometry. Generally processes faster and uses fewer scan tokens.</p> },
              { kicker: 'Medium', title: 'Balanced analysis', body: <p>A middle option for average roof complexity where more interpretation is useful.</p> },
              { kicker: 'Medium+', title: 'Heavier analysis', body: <p>For geometry with more to interpret. Can take longer and consumes more scan tokens.</p> },
            ]} />
          </div>
        </Container>
      </Section>

      <Section tone="soft">
        <Container>
          <SplitFeature reverse visual={<ProductFrame src="/marketing/current-ux/digital-takeoff-manual.webp" alt="Manual measurement tools in the QuoteCore+ Digital Takeoff workspace" width={2048} height={1114} caption="Automation and manual takeoff live in the same workspace. If the scan gets 90% of the job right, fix the remaining 10% instead of starting over." />}>
            <h2>The useful result is not an AI answer. It is editable roof geometry.</h2>
            <p>A scan does not lock you into what the model decided. Every area and supported roof line remains part of the normal Digital Takeoff workspace.</p>
            <BulletList items={['Accept a complete result when it is right', 'Fix one or two lines when the scan is close', 'Add missing areas or components manually', 'Discard the result and measure manually if the source plan is a poor fit']} />
            <TextLink href="/features/digital-roof-takeoff">Explore Digital Roof Takeoff</TextLink>
          </SplitFeature>
        </Container>
      </Section>

      <Section tone="dark">
        <Container>
          <SectionHeader eyebrow="One connected workflow" title="The scan can be the first automated step, not the last." lead="Once the roof geometry is reviewed, the same job can continue into offcut planning, your own pricing logic and the customer quote without re-entering the measurements." dark />
          <WorkflowRail steps={[
            { label: 'Roof plan', body: 'Upload or open the drawing and calibrate it.' },
            { label: 'Roof Scan Assist', body: 'Scan the outside outline first, review it, then draw internal components yourself or scan them in a second stage.' },
            { label: 'Offcuts if needed', body: 'On long-run roofs with angled cuts, generate a suggested cut plan and material requirement.' },
            { label: 'Smart Components', body: 'Apply your saved materials, labour, waste and pricing logic.' },
            { label: 'Quote', body: 'Build the customer-facing quote from the same measured job.' },
          ]} />
        </Container>
      </Section>

      <Section>
        <Container>
          <SectionHeader eyebrow="Roof takeoff on mobile" title="Start an AI roof-plan takeoff from your phone, not only from a desktop." lead="Digital Takeoff and Roof Scan Assist are available on mobile. Field and office staff get another way to work with a roof plan away from the main computer, without reducing the result to a read-only report. Roof Scan Assist scans roof plans and drawings from the phone; it is not a camera or satellite scan of the physical roof." />
          <FeatureGrid items={[
            { title: 'Open the plan on mobile', body: <p>Work from the same roof-plan workflow on a phone when that is the device in front of you.</p> },
            { title: 'Run Roof Scan Assist', body: <p>Start the automated geometry scan on mobile, then come back to the measured result instead of tracing every line on a small screen.</p> },
            { title: 'Keep the result usable', body: <p>The detected roof is still editable takeoff geometry that continues into the rest of the QuoteCore+ workflow.</p> },
          ]} />
        </Container>
      </Section>

      <Section tone="soft">
        <Container>
          <SectionHeader eyebrow="Skill barrier" title="Lower the skill barrier for takeoff groundwork." lead="Roof Scan Assist does not replace roofing judgement. It can reduce how much specialist knowledge is needed to produce the first usable takeoff, which makes office delegation and staff training more practical." />
          <FeatureGrid items={[
            { kicker: 'Experienced estimator', title: 'Remove repetitive tracing', body: <p>Use the scan to remove repetitive tracing and spend your attention checking unusual geometry or pricing the job.</p> },
            { kicker: 'Office team member', title: 'Prepare the measured roof', body: <p>Calibrate the plan, run the scan and prepare the measured roof for review without knowing how to draw every hip and valley manually.</p> },
            { kicker: 'New team member', title: 'Learn from the result', body: <p>Use the editable result to learn what the roof geometry should look like while an experienced person reviews the commercial work.</p> },
          ]} />
        </Container>
      </Section>

      <Section>
        <Container>
          <SectionHeader eyebrow="Accuracy" title="Three things determine how much manual correction a roof scan is likely to need." lead="The scan is strongest when the input gives it unambiguous information. These are the three factors worth checking before you decide whether the job suits automation." />
          <FeatureGrid items={[
            { kicker: '01', title: 'Correct calibration', body: <p>Set the plan scale from a reliable known dimension. A good geometry result with the wrong scale still produces the wrong real-world measurements.</p> },
            { kicker: '02', title: 'Clear source drawing', body: <p>Sharp, readable roof lines are easier to interpret than blurred scans, compressed images or overlapping construction markup.</p> },
            { kicker: '03', title: 'Roof complexity', body: <p>Simple and moderately complex roofs are more predictable. Unusual intersections are more likely to need manual judgement.</p> },
          ]} />
        </Container>
      </Section>

      <Section tone="soft">
        <Container>
          <FitPanel
            title="Use AI where it removes work, and manual takeoff where it does not."
            bestFor={['Roof plans with a reliable known dimension for calibration', 'Simple to moderately complex geometry that would otherwise be traced manually', 'Teams that want to delegate more of the takeoff groundwork', 'Roofers who want an editable result rather than a static report', 'Mobile users who want to avoid detailed manual tracing on a small screen']}
            limits={['Poor-quality or ambiguous drawings can need more correction', 'Incorrect calibration produces incorrect real-world measurements', 'Highly unusual roof geometry may still be faster to finish manually', 'The result should be reviewed before it is used for pricing or ordering']}
          />
        </Container>
      </Section>

      <Section>
        <Container>
          <SectionHeader eyebrow="Try it on a roof plan" title="Test the scan yourself, or let us tailor a walkthrough to the way your business quotes." lead="Use the focused roof takeoff demo to test the scan on a sample plan, or book a tailored screen-share for your workflow." />
          <ConversionPaths items={[
            { title: 'Try Roof Scan Assist', body: 'Use the focused roof takeoff demo and see the AI-assisted plan workflow without creating a paid account.', href: '/takeoff-demo?mode=ai', label: 'Try Roof Scan Assist' },
            { title: 'Book a tailored 20-minute demo', body: 'Tell us how your team measures and quotes roofing and we will show the workflow around your use case. No obligation.', href: bookingHref, label: 'Book a tailored demo' },
            { title: 'Build your configuration', body: 'Choose the Digital Takeoff and Roof Scan Assist usage that suits your volume and see the resulting monthly subscription.', href: '/pricing', label: 'See pricing' },
          ]} />
        </Container>
      </Section>

      <Section tone="soft">
        <Container><FaqAccordion faqs={faqs} title="AI roof takeoff and Roof Scan Assist FAQ" /></Container>
      </Section>

      <Section>
        <Container>
          <RelatedLinks items={[
            { href: '/features/offcut-optimiser', title: 'Offcut Optimiser', body: 'Turn reviewed long-run roof geometry into suggested cutting plans and a more realistic material allowance.' },
            { href: '/features/digital-roof-takeoff', title: 'Digital Roof Takeoff', body: 'See the manual measurement and editing workspace that Roof Scan Assist works inside.' },
            { href: '/features/smart-components', title: 'Smart Components', body: 'Use the measured quantities with your own materials, labour, waste and pricing logic.' },
            { href: '/roofing-takeoff-software', title: 'Roofing takeoff software', body: 'Compare the complete AI-assisted and manual roof takeoff workflow.' },
            { href: '/blog/ai-roof-measuring', title: 'AI roof measuring guide', body: 'What AI roof measuring can and cannot do, and why verification still wins.' },
          ]} />
        </Container>
      </Section>

      <FinalCta title="Let the scan do the tracing. You review what matters." body="Use Roof Scan Assist when the plan suits automation, keep every result editable and move the reviewed roof straight into the next estimating step." primary={{ href: '/takeoff-demo?mode=ai', label: 'Try Roof Scan Assist' }} secondary={{ href: bookingHref, label: 'Book a tailored 20-minute demo' }} />
      <div style={{ height: 72 }} />
    </PageScaffold>
  );
}
