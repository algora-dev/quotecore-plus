"use client";

export default function Post() {
  return (
    <div className="prose prose-zinc max-w-none">
      <p>A reusable quoting template should do more than copy wording and prices from an old job. It should capture the logic behind the work: materials, labour, measurements, calculations, waste, pricing, drawings, images, and what the customer needs to see.</p>
      <p>QuoteCore+ calls these building blocks Smart Components™. You build them once, then reuse and adjust them across future quotes, orders, and invoices.</p>
      <p>Try the <a href="/free-smart-component-creator">free Smart Component Creator</a> to map out a component before adding it to your workflow.</p>
      <h2>Why ordinary quote templates break down</h2>
      <p>A document template is useful for branding and standard terms. It becomes less useful when every job has different measurements and quantities.</p>
      <p>Copying an old quote creates several risks:</p>
      <ul>
        <li>Old customer details remain in the document.</li>
        <li>Old prices are carried forward.</li>
        <li>Materials are missed when scope changes.</li>
        <li>Quantities do not respond to measurements.</li>
        <li>Internal notes appear in customer-facing content.</li>
        <li>Product images and drawings become outdated.</li>
        <li>The original job structure is reused even when it does not fit.</li>
      </ul>
      <p>A reusable system needs to separate fixed knowledge from job-specific inputs.</p>
      <h2>What is a Smart Component?</h2>
      <p>A Smart Component is a reusable building block that captures how your business prices and delivers a piece of work.</p>
      <p>It can contain products, materials, labour, measurements, calculations, waste, costs, selling prices, drawings, images, internal notes, customer descriptions, and custom rules.</p>
      <p>A roofer might create components for a roof plane, ridge system, valley, flashing, gutter, or rooflight. A concrete contractor might create slab, footing, or formwork components. A service business might create a repeatable package with labour, travel, and deliverables.</p>
      <p>Watch <a href="https://www.youtube.com/watch?v=aFXJwOiliPI">What are Smart Components</a> for the product overview.</p>
      <h2>Step 1: choose a repeatable unit of work</h2>
      <p>Start with something you quote often and understand well.</p>
      <p>Good first components have a clear scope, repeatable inputs, known materials or services, a calculation you already use, and a customer description you regularly rewrite.</p>
      <p>Examples include a square metre of roof covering, a metre of ridge, one rooflight installation, one concrete footing, one room painting package, or a standard service visit.</p>
      <p>Do not begin with one component for an entire complicated project. Smaller building blocks are easier to test, reuse, and combine.</p>
      <h2>Step 2: define the input</h2>
      <p>Ask what changes from job to job. Typical inputs include area, length, count, pitch, width, height, layers, travel distance, labour hours, or selected product.</p>
      <p>Use the smallest set of inputs that produces a reliable result. Too many inputs slow the quote. Too few hide important differences.</p>
      <p>For roofing, a roof plane may use area and pitch. A ridge component may use length. A rooflight component may use count and size.</p>
      <h2>Step 3: add materials and services</h2>
      <p>List everything the component should bring into the quote.</p>
      <p>For a roof covering component, that might include covering units, underlay, battens, fixings, clips, waste, and installation labour. Edge details such as ridge and verge may remain separate because they use linear measurements.</p>
      <p>Use supplier catalogues or spreadsheets where appropriate, but check product codes, units, descriptions, costs, and dates. A catalogue item is a product record. A Smart Component combines those items with the way your business uses them.</p>
      <h2>Step 4: build the calculation logic</h2>
      <p>Write the calculation in plain language before configuring it.</p>
      <p>Example:</p>
      <ol>
        <li>Start with measured roof area.</li>
        <li>Adjust for pitch if the input is plan area.</li>
        <li>Apply product coverage.</li>
        <li>Add the chosen waste rule.</li>
        <li>Round to the supplier order unit.</li>
        <li>Calculate labour from the business method.</li>
      </ol>
      <p>Test the logic with a simple number that can be checked manually. Then test a small job, a large job, and an awkward edge case.</p>
      <p>A component should make a known method repeatable, not hide a calculation nobody understands.</p>
      <h2>Step 5: separate cost, price, and customer content</h2>
      <p>Keep internal business information separate from the customer-facing quote.</p>
      <p>Internal data may include supplier cost, labour cost, waste assumption, margin logic, internal codes, and installation notes.</p>
      <p>Customer content may include scope, specification, quantities, included details, images, drawings, exclusions, and assumptions.</p>
      <p>This separation allows the business to price consistently without exposing every internal calculation.</p>
      <h2>Step 6: add useful drawings and images</h2>
      <p>Images are valuable when they explain a product, finish, detail, or scope. Use them to clarify profile, tile selection, flashing shape, finish, colour, or an installation boundary.</p>
      <p>Do not add images only for decoration. Keep them current and make sure you have permission to use them.</p>
      <h2>Step 7: test against completed work</h2>
      <p>Before relying on a component, compare it with jobs you already understand.</p>
      <p>Check calculated quantities, supplier order units, labour allowance, waste, customer description, selling price, and items that remain separate.</p>
      <p>If the component gives a different result, identify why. The old quote may be wrong, the new logic may be wrong, or the jobs may not be comparable.</p>
      <h2>Worked example: pitched roof components</h2>
      <p>Instead of one giant ?pitched roof? template, create components such as:</p>
      <ol>
        <li>Roof plane covering by area</li>
        <li>Underlay and battens by area</li>
        <li>Ridge by length</li>
        <li>Hip by length</li>
        <li>Valley by length</li>
        <li>Verge by length</li>
        <li>Eaves by length</li>
        <li>Rooflight by count and size</li>
        <li>Gutter by length</li>
        <li>Downpipe by count and length</li>
      </ol>
      <p>A simple gable quote may use roof planes, ridge, eaves, and verges. A complex roof adds hips, valleys, rooflights, and abutments. The same tested building blocks adapt to both.</p>
      <p>This is more reliable than copying a previous complex roof and deleting sections you think are unnecessary. See <a href="/blog/how-to-do-a-roof-takeoff">how to do a roof takeoff</a> for the measurement process that feeds components, and <a href="/blog/how-to-price-a-roofing-job">how to price a roofing job</a> for turning those quantities into a priced scope.</p>
      <h2>Naming and organising components</h2>
      <p>Use names another team member can understand. Include the trade or system, component type, product family, unit, and version or region where needed.</p>
      <p>Avoid vague names such as ?standard roof,? ?usual extras,? or ?old version.? Add a short description explaining when the component should be used.</p>
      <p>Review components when supplier prices, products, labour methods, or specifications change.</p>
      <h2>Common component mistakes</h2>
      <ul>
        <li>Making the first component too large</li>
        <li>Copying old prices without checking them</li>
        <li>Combining area and linear items incorrectly</li>
        <li>Applying one waste rule to every material</li>
        <li>Hiding assumptions</li>
        <li>Mixing internal and customer descriptions</li>
        <li>Failing to test edge cases</li>
        <li>Duplicating near-identical components</li>
        <li>Leaving old products active</li>
        <li>Building logic only one person understands</li>
      </ul>
      <h2>Smart Components and the full workflow</h2>
      <p>The value is not only a faster quote. A well-built component can support consistent measurement, pricing, customer presentation, material ordering, and invoicing.</p>
      <p>Watch <a href="https://www.youtube.com/watch?v=XZSTIfGUHAU">How to Set Up Roofing Smart Components in QuoteCore+</a>, then see a <a href="https://www.youtube.com/watch?v=1MOvQX-Lf_c">roofing component quote created without the digital measurement tool</a>.</p>
      <p>For the wider process, explore <a href="/roofing-quoting-software">roofing quoting software</a> or <a href="/construction-quoting-software">construction quoting software</a>.</p>
      <h2>Frequently asked questions</h2>
      <h3>Is a Smart Component the same as a quote template?</h3>
      <p>No. A quote template mainly controls document structure and presentation. A Smart Component stores a reusable unit of business logic, including products, labour, measurements, calculations, pricing, and content.</p>
      <h3>How many components should I create first?</h3>
      <p>Start with the small group that covers most routine work. Test them in real quotes, then add specialist details. A focused library is easier to maintain than hundreds of untested components.</p>
      <h3>Can Smart Components work without digital measurement?</h3>
      <p>Yes. Components can be added and adjusted manually. Digital takeoff is one quoting method, not a requirement for using reusable components.</p>
      <h3>How often should components be reviewed?</h3>
      <p>Review them when supplier costs, labour rates, products, specifications, or business methods change. Also review any component that repeatedly differs from actual job results.</p>
      <h3>Can different trades use Smart Components™</h3>
      <p>Yes. Any repeatable product, service, measurement, or calculation can become a component. The structure adapts to roofing, construction, concrete, landscaping, electrical, plumbing, and service work.</p>
      <p>Build a draft component with the <a href="/free-smart-component-creator">free Smart Component Creator</a>, then start a <a href="/free-trial">free QuoteCore+ trial</a> to use reusable components throughout your quoting workflow.</p>
    </div>
  );
}
