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
  title: 'Offcut Optimiser: Long-Run Roofing Cut List & Offcut Planning | QuoteCore+',
  description: 'Offcut Optimiser turns a reviewed roof takeoff into suggested whole-roof cutting plans. See likely sheet counts, purchased lengths and reusable angled offcuts before the job is won.',
  alternates: { canonical: 'https://quote-core.com/features/offcut-optimiser', languages: hreflangLanguages('/features/offcut-optimiser') },
  openGraph: {
    title: 'Offcut Optimiser: Long-Run Roofing Cut List & Offcut Planning | QuoteCore+',
    description: 'Stop guessing roofing waste with a flat percentage. Compare generated cutting plans, purchased lengths and reusable offcuts before you rely on the material quantity.',
    url: 'https://quote-core.com/features/offcut-optimiser',
    siteName: 'QuoteCore+',
    type: 'website',
  },
};

const faqs: FaqItem[] = [
  { question: 'What is a long-run roofing cut list?', answer: 'A cut list maps the sheet or panel lengths needed for the roof and, on roofs with hips, valleys or other angled cuts, how useful offcuts may be reused on other faces.' },
  { question: 'Why can a flat 10% or 15% roofing waste allowance be wrong?', answer: 'Long-run roofing is ordered as real lengths. Some angled offcuts can be reused and others have nowhere useful to go, so the real extra material can be lower or materially higher than a blanket percentage.' },
  { question: 'When is Offcut Optimiser not very useful?', answer: 'A simple single-plane or straight-sheet roof usually does not need sophisticated offcut planning. The feature is most useful where angled cuts can potentially be reused elsewhere on the roof.' },
  { question: 'Does it always produce the best possible cut list?', answer: 'No. It produces a strong suggested plan, not a guaranteed mathematical optimum. Review, refine or discard it. A skilled roofer may improve the arrangement.' },
  { question: 'Can office staff use it?', answer: 'Yes. It can provide the initial plan automatically, with a roofing expert reviewing unusual geometry before material is ordered.' },
  { question: 'Can I create an offcut plan on my phone?', answer: 'The wider takeoff workflow is mobile-capable, but the current Offcut Optimiser is not optimised for a phone-sized screen.' },
];

const schemas = [
  buildSoftwareApplicationSchema(),
  buildBreadcrumbSchema([
    { name: 'Home', url: 'https://quote-core.com/' },
    { name: 'Features', url: 'https://quote-core.com/features' },
    { name: 'Offcut Optimiser', url: 'https://quote-core.com/features/offcut-optimiser' },
  ]),
  buildFaqSchema(faqs),
];

export default function OffcutOptimiserPage() {
  return (
    <PageScaffold breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Features', href: '/features' }, { label: 'Offcut Optimiser' }]} schemas={schemas}>
      <Hero
        eyebrow="Long-run roofing cut list and offcut planning"
        title={<>Stop guessing roofing waste with a flat percentage.</>}
        lead="Offcut Optimiser turns a reviewed roof takeoff into suggested whole-roof cutting plans. See how many sheets or purchased lengths the geometry is likely to need, where compatible angled offcuts may be reused and whether your quote has enough material allowed before the job is won."
        primary={{ href: bookingHref, label: 'Book a tailored 20-minute demo' }}
        secondary={{ href: '/free-roof-takeoff', label: 'Try the free roof takeoff' }}
        proof={['Built for hips, valleys and angled cuts', 'Compare generated cutting plans', 'Review, refine or discard the result']}
        visual={<ProductFrame src="/marketing/current-ux/offcut-optimiser-plan.webp" alt="QuoteCore+ Offcut Optimiser with a generated whole-roof cut plan" width={2048} height={1109} eager caption="A generated whole-roof sheet and offcut plan. Compare cutting options, purchased lengths and reusable offcuts before relying on the material quantity." />}
      />

      <Section>
        <Container>
          <SectionHeader eyebrow="The real estimating problem" title="Roof area is not the same as the amount of long-run roofing you need to buy." lead="A roof can measure 200 square metres and still require very different purchased material depending on the faces, sheet direction, hips, valleys and whether the angled pieces left by one cut can be used somewhere else." />
          <FeatureGrid items={[
            { title: 'Straight sheets are simple', body: <p>On a plain single-plane or simple gable roof, the sheets are mostly full-length runs. Offcut optimisation adds little because there are few meaningful angled cuts to reuse.</p> },
            { title: 'Hips and valleys change the maths', body: <p>Diagonal cuts create triangular or tapered leftovers. Some can supply another face. Others cannot. That is where a simple area plus waste percentage starts to lose accuracy.</p> },
            { title: 'Complex roofs can move a long way from 10%', body: <p>A blanket 10% or 15% allowance may be too high on one roof and too low on another. On difficult geometry, the extra purchased material can reach 20%, 30% or more because useful reuse is limited.</p> },
          ]} />
        </Container>
      </Section>

      <Section tone="soft">
        <Container>
          <SectionHeader eyebrow="Quote it before you win it" title="Do not discover the real material requirement after the customer has accepted your price." lead="Many roofers only spend time building the detailed cut list after they win the job. That is efficient until the final cut list reveals the quote did not allow enough material. Offcut Optimiser moves that check forward into estimating." />
          <WorkflowRail steps={[
            { label: 'Measure', body: 'Complete or scan the roof geometry in Digital Takeoff.' },
            { label: 'Generate', body: 'Create suggested whole-roof cutting plans from the measured faces and lengths.' },
            { label: 'Compare', body: 'See the likely sheet count, purchased length and offcut reuse before pricing.' },
            { label: 'Quote', body: 'Carry a more realistic material allowance into the job price.' },
            { label: 'Refine', body: 'If you win the job, adjust the plan if an experienced installer sees a better arrangement.' },
          ]} />
        </Container>
      </Section>

      <Section>
        <Container>
          <SplitFeature visual={<ProductFrame src="/marketing/current-ux/quote-builder-components-measurements.webp" alt="QuoteCore+ Quote Builder with measured quantities and Smart Components" width={2048} height={1112} caption="The commercial value is upstream: use a more realistic material requirement while there is still time to price the job correctly." />}>
            <h2>A cut list can protect margin before it becomes an installation problem.</h2>
            <p>On a quoted job, an extra few sheets or long lengths can remove hundreds of dollars from profit. Generate a credible plan early, price from that material picture, then refine only the jobs that need it.</p>
            <BulletList items={['Reduce the chance of under-allowing material', 'Avoid unnecessary blanket waste on simple geometry', 'See difficult roofs before the quote becomes a fixed commitment', 'Keep detailed installer review for the jobs that actually proceed']} />
          </SplitFeature>
        </Container>
      </Section>

      <Section tone="soft">
        <Container>
          <SectionHeader eyebrow="What the generator gives you" title="A whole-roof starting plan, not a single waste-factor number." lead="Instead of answering only &quot;add 12% waste&quot;, the optimiser looks at the measured faces and required runs, then gives you cutting-plan options you can compare." />
          <FeatureGrid items={[
            { title: 'Suggested sheet and panel layout', body: <p>See how required lengths could be supplied across the roof rather than treating each face as fresh full-length material by default.</p> },
            { title: 'Reusable offcut matching', body: <p>Where an angled cut leaves a compatible piece, the plan can reuse it on another receiving face instead of automatically counting it as waste.</p> },
            { title: 'Material outcome you can price', body: <p>Compare generated options by sheet count and purchased length so the estimator can choose a practical allowance before the quote is sent.</p> },
          ]} />
        </Container>
      </Section>

      <Section>
        <Container>
          <SectionHeader eyebrow="Human judgement stays useful" title="The generated cut list can be wrong and still save you time and money." lead="Some roofs are genuinely awkward. A roofer may see a better way to pair the cuts. That does not make the first plan useless if it already revealed that the job needs far more material than a flat waste allowance suggested." />
          <FeatureGrid items={[
            { kicker: 'Use it as-is', title: 'Work from it directly', body: <p>On a straightforward hip or valley roof, the suggested plan may already be practical enough to work from after normal checking.</p> },
            { kicker: 'Refine it', title: 'Move the cuts that matter', body: <p>Move a source or receiving cut when an installer sees a better combination. The plan is a head start, not a locked instruction.</p> },
            { kicker: 'Discard it', title: 'Keep the warning', body: <p>If a difficult roof produces an impractical arrangement, keep the material warning it exposed and build the final cut list manually.</p> },
          ]} />
        </Container>
      </Section>

      <Section tone="soft">
        <Container>
          <SplitFeature reverse visual={<ProductFrame src="/marketing/current-ux/ai-scan-assist-completed-roof.webp" alt="Reviewed roof geometry from Roof Scan Assist feeding the offcut planning workflow" width={2048} height={1114} caption="A team member can scan or measure the roof first, then use the reviewed geometry as the input for offcut planning and pricing." />}>
            <h2>Give the office a much bigger head start on work that used to depend on an experienced roofer.</h2>
            <p>An estimator does not need to manually solve every hip and valley pairing from scratch. A reviewed Roof Scan Assist or Digital Takeoff result can feed the optimiser, which creates the first cut-plan options automatically.</p>
            <BulletList items={['Reduce the specialist knowledge needed for the first pass', 'Let experienced roofers review exceptions instead of doing every calculation', 'Move from roof plan to likely material quantity in the same workflow', 'Carry the reviewed result into Smart Components and the quote']} />
            <TextLink href="/features/ai-scan-assist">Explore Roof Scan Assist</TextLink>
          </SplitFeature>
        </Container>
      </Section>

      <Section>
        <Container>
          <SectionHeader eyebrow="Who it is for" title="Designed for long-run and metal roofs where angled cuts actually matter." lead="The strongest use case is not every roof. It is roofs where ordered lengths, hips, valleys and reusable offcuts can materially change the quantity you need to buy." />
          <FeatureGrid columns={2} items={[
            { title: 'Long-run roofing', body: <p>Especially relevant in New Zealand and Australia, where cut-to-length corrugated and ribbed metal roofing is common. Also useful for metal-roofing work across other markets.</p> },
            { title: 'Standing seam', body: <p>Useful where panels are ordered to specific lengths and hip, valley or dormer cuts create meaningful offcut decisions.</p> },
            { title: 'Profiled metal roofing', body: <p>Applicable to compatible sheet and panel systems where the roof geometry drives real ordered lengths.</p> },
            { title: 'Not plain straight-sheet roofs', body: <p>If every sheet is a simple full-length run with no useful angled offcuts, detailed optimisation is usually unnecessary.</p> },
          ]} />
        </Container>
      </Section>

      <Section tone="soft">
        <Container>
          <FitPanel
            title="A useful planning engine, not a promise of the perfect cut list."
            bestFor={['Long-run or metal roofs with hips, valleys, dormers or multiple faces', 'Estimators who want a material allowance before the job is won', 'Teams that want office staff to prepare more of the takeoff and cut-plan groundwork', 'Roofers who want a generated starting plan they can still edit or replace']}
            limits={['A simple single-plane or straight-sheet roof usually does not need offcut optimisation', 'The generated plan is not guaranteed to be the best possible arrangement on every complex roof', 'The final material order still needs contractor and supplier review', 'The current Offcut Optimiser is not optimised for phone-sized screens']}
          />
        </Container>
      </Section>

      <Section>
        <Container>
          <SectionHeader eyebrow="See it on a real roof" title="Start free, or let us show the workflow against the way your business actually roofs." lead="The free roof takeoff is the fastest way to understand the measurement side. For Offcut Optimiser itself, a tailored screen-share is the best way to see how it fits your profiles, quoting process and real roof geometry." />
          <ConversionPaths items={[
            { title: 'Try the free roof takeoff', body: 'Measure a roof plan in the browser and see the geometry that sits upstream of cut planning.', href: '/free-roof-takeoff', label: 'Open the free roof takeoff' },
            { title: 'Book a tailored 20-minute demo', body: 'Show us how you quote long-run or metal roofing and we will demonstrate the workflow around your use case. No obligation.', href: bookingHref, label: 'Book a tailored demo' },
            { title: 'Build your configuration', body: 'Add Digital Takeoff and Offcut Optimiser in the pricing builder and see the resulting monthly subscription.', href: '/pricing', label: 'See pricing' },
          ]} />
        </Container>
      </Section>

      <Section tone="soft">
        <Container><FaqAccordion faqs={faqs} title="Long-run roofing cut list and Offcut Optimiser FAQ" /></Container>
      </Section>

      <Section>
        <Container>
          <RelatedLinks items={[
            { href: '/features/ai-scan-assist', title: 'Roof Scan Assist', body: 'Scan suitable roof plans before moving the reviewed geometry into offcut planning.' },
            { href: '/features/digital-roof-takeoff', title: 'Digital Roof Takeoff', body: 'Measure and edit roof geometry manually when you need full control.' },
            { href: '/features/smart-components', title: 'Smart Components', body: 'Turn reviewed measurements and material quantities into your own labour and pricing logic.' },
            { href: '/roofing-estimating-software', title: 'Roofing estimating software', body: 'See the full path from roof plan to material, labour, price and customer quote.' },
          ]} />
        </Container>
      </Section>

      <FinalCta title="Know the material risk before the customer knows the price." body="Generate the cut-plan starting point early, quote from a more realistic material allowance, then let your roofing judgement improve the plan where it matters." primary={{ href: bookingHref, label: 'Book a tailored 20-minute demo' }} secondary={{ href: '/free-roof-takeoff', label: 'Try the free roof takeoff' }} />
      <div style={{ height: 72 }} />
    </PageScaffold>
  );
}
