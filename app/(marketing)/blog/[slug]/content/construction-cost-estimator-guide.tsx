"use client";

import Link from "next/link";

export default function Post() {
  return (
    <div className="prose prose-zinc max-w-none">
      <p>A construction cost estimate converts a defined scope into quantities, labour, materials, plant, subcontractor work, overheads, risk, and margin. The quality of the estimate depends less on a single rate and more on whether the scope and quantities are complete.</p>
      <p>Use the <a href="/free-construction-calculator">free construction calculator</a> for floor area, wall area, timber, quantities, and common geometry. Then follow this process to turn measurements into a budget or quote.</p>
      <h2>Estimate type comes first</h2>
      <p>Not every estimate has the same purpose.</p>
      <h3>Early budget</h3>
      <p>Used before full design. It relies on assumptions, benchmark rates, broad quantities, and a wider risk allowance. It should be presented as a budget range or stated basis, not a fixed quotation.</p>
      <h3>Developed estimate</h3>
      <p>Uses drawings, outline specifications, measured quantities, and supplier or subcontractor input. It is more reliable but still depends on unresolved details.</p>
      <h3>Tender or quote</h3>
      <p>Uses a clear scope, current prices, programme, contract conditions, and detailed risk review. It should identify inclusions, exclusions, and qualifications.</p>
      <h3>Cost plan or live job forecast</h3>
      <p>Tracks committed costs, actual costs, approved changes, remaining work, and expected final cost.</p>
      <p>Label the estimate correctly. A rough budget should not look like a guaranteed fixed price.</p>
      <h2>Step 1: define scope and assumptions</h2>
      <p>Read the drawings, specification, schedule, site information, and customer brief together.</p>
      <p>Create a scope checklist by work package:</p>
      <ul>
        <li>Preliminaries and site setup</li>
        <li>Demolition and enabling works</li>
        <li>Groundworks and drainage</li>
        <li>Foundations</li>
        <li>Structure</li>
        <li>External envelope</li>
        <li>Roofing (see <a href="/blog/how-to-do-a-roof-takeoff">how to do a roof takeoff</a> and <a href="/blog/roofing-material-list">roofing material list</a>)</li>
        <li>Windows and doors</li>
        <li>Internal walls and finishes</li>
        <li>Mechanical and electrical work</li>
        <li>Kitchens, bathrooms, and fittings</li>
        <li>External works and landscaping</li>
        <li>Testing, certification, and handover</li>
      </ul>
      <p>Write assumptions where information is missing. Record drawing revisions and the date of the estimate.</p>
      <h2>Step 2: measure quantities</h2>
      <p>Break the project into measurable units:</p>
      <ul>
        <li>Number</li>
        <li>Linear metre</li>
        <li>Square metre</li>
        <li>Cubic metre</li>
        <li>Tonne</li>
        <li>Hour</li>
        <li>Day</li>
        <li>Item</li>
        <li>Lump sum</li>
      </ul>
      <p>Measure areas, lengths, volumes, counts, and weights from the current information.</p>
      <p>Useful free tools include:</p>
      <ul>
        <li><a href="/free-wall-area-calculator">Wall area calculator</a></li>
        <li><a href="/free-concrete-calculator">Concrete calculator</a></li>
        <li><a href="/free-concrete-slab-calculator">Concrete slab calculator</a></li>
        <li><a href="/free-footing-calculator">Footing calculator</a></li>
        <li><a href="/free-rebar-calculator">Rebar calculator</a></li>
        <li><a href="/free-trench-calculator">Trench calculator</a></li>
        <li><a href="/free-flooring-calculator">Flooring calculator</a></li>
        <li><a href="/free-tile-calculator">Tile calculator</a></li>
        <li><a href="/free-paint-calculator">Paint calculator</a></li>
      </ul>
      <p>Do not mix net measurements, waste, and order quantities without showing the difference.</p>
      <h2>Step 3: price materials</h2>
      <p>For each material, record:</p>
      <ul>
        <li>Description and specification</li>
        <li>Quantity</li>
        <li>Waste allowance</li>
        <li>Supplier unit</li>
        <li>Current unit cost</li>
        <li>Delivery</li>
        <li>Minimum order or pack rounding</li>
        <li>Lead time</li>
        <li>Price validity</li>
      </ul>
      <p>Use current supplier quotes for major or volatile items. Confirm whether prices include tax, delivery, unloading, and special fabrication.</p>
      <p>A low online price is not useful if it is for the wrong grade, size, finish, location, or delivery basis.</p>
      <h2>Step 4: estimate labour</h2>
      <p>Labour should include the full time required to deliver the activity, not only installation time.</p>
      <p>Consider:</p>
      <ul>
        <li>Setting out</li>
        <li>Handling and moving materials</li>
        <li>Installation</li>
        <li>Cutting and fitting</li>
        <li>Access and protection</li>
        <li>Cleaning</li>
        <li>Supervision</li>
        <li>Testing</li>
        <li>Rework allowance based on real performance</li>
        <li>Non-productive time required by the site</li>
      </ul>
      <p>Estimate crew composition and duration. Use completed job data where available. If productivity is uncertain, show the assumption clearly.</p>
      <h2>Step 5: add plant, access, and temporary works</h2>
      <p>Include items such as excavators, access equipment, scaffolding, lifting, temporary support, drying, power, welfare, fencing, traffic management, protection, and waste handling.</p>
      <p>Check mobilisation, minimum hire periods, transport, fuel, operator, attachments, inspection, and collection charges.</p>
      <p>Temporary work can be essential even though it is not part of the finished building.</p>
      <h2>Step 6: obtain subcontractor prices</h2>
      <p>Issue the same scope information to each subcontractor.</p>
      <p>Compare:</p>
      <ul>
        <li>Scope included</li>
        <li>Exclusions</li>
        <li>Quantity basis</li>
        <li>Programme</li>
        <li>Labour and material split where needed</li>
        <li>Access and plant</li>
        <li>Design responsibility</li>
        <li>Testing and certification</li>
        <li>Payment terms</li>
        <li>Quote validity</li>
      </ul>
      <p>Do not compare totals until you have normalised the scope. A cheaper quote may simply exclude more.</p>
      <h2>Step 7: include preliminaries and overheads</h2>
      <p>Project preliminaries may include management, supervision, site setup, welfare, temporary services, security, permits, cleaning, and closeout.</p>
      <p>Business overheads may include office staff, vehicles, insurance, software, premises, accounting, marketing, and non-chargeable management time.</p>
      <p>If overhead is not recovered through jobs, turnover can grow while the business loses money.</p>
      <h2>Step 8: assess risk and uncertainty</h2>
      <p>List the risks instead of adding an unexplained contingency.</p>
      <p>Examples:</p>
      <ul>
        <li>Incomplete design</li>
        <li>Ground conditions</li>
        <li>Existing services</li>
        <li>Restricted access</li>
        <li>Long lead items</li>
        <li>Price expiry</li>
        <li>Weather exposure</li>
        <li>Working around occupants</li>
        <li>Programme dependencies</li>
        <li>Unconfirmed finishes</li>
      </ul>
      <p>Choose how each risk is handled:</p>
      <ul>
        <li>Clarify before pricing</li>
        <li>Include a defined allowance</li>
        <li>Exclude it</li>
        <li>Use a provisional sum</li>
        <li>Price an option</li>
        <li>State a unit rate</li>
        <li>Accept and price the risk</li>
      </ul>
      <h2>Step 9: add margin</h2>
      <p>Margin is the return for delivering the work, tying up capital, managing risk, and running the business.</p>
      <p>Do not add margin only to labour while passing materials and subcontractors through at cost unless that is a deliberate commercial decision. The business still manages ordering, coordination, defects, credit, and risk.</p>
      <p>Check the distinction between markup and margin. They are not the same percentage calculation.</p>
      <h2>Worked example: small concrete slab package</h2>
      <p>Assume the scope is a new external slab.</p>
      <p>Build the estimate in this order:</p>
      <ol>
        <li>Measure slab length, width, and depth.</li>
        <li>Calculate concrete volume with the <a href="/free-concrete-slab-calculator">free concrete slab calculator</a>.</li>
        <li>Measure excavation and disposal.</li>
        <li>Add sub-base, compaction, membrane, reinforcement, formwork, and joints.</li>
        <li>Estimate labour by setup, excavation, base, reinforcement, pour, finish, and strip.</li>
        <li>Add plant, concrete delivery conditions, washout, and access.</li>
        <li>Add preliminaries, overhead recovery, risk, and margin.</li>
        <li>State exclusions such as unsuitable ground, hidden services, or design changes.</li>
      </ol>
      <p>The concrete volume is important, but it is only one part of the cost.</p>
      <h2>Check the estimate before issuing it</h2>
      <p>Use four reviews:</p>
      <h3>Quantity review</h3>
      <p>Do totals reconcile with the building dimensions? Are openings, laps, waste, and pack sizes handled correctly?</p>
      <h3>Scope review</h3>
      <p>Has every work package been included, excluded, or assigned to someone else?</p>
      <h3>Price review</h3>
      <p>Are supplier and subcontractor prices current, comparable, and valid for the programme?</p>
      <h3>Commercial review</h3>
      <p>Are overheads, margin, payment timing, tax, contract terms, and major risks included?</p>
      <h2>Common construction estimating mistakes</h2>
      <ul>
        <li>Pricing before defining scope</li>
        <li>Using outdated rates</li>
        <li>Missing temporary works</li>
        <li>Ignoring delivery and unloading</li>
        <li>Applying one waste factor to everything</li>
        <li>Comparing subcontractor totals with different scopes</li>
        <li>Forgetting non-productive labour</li>
        <li>Hiding risk inside a percentage</li>
        <li>Confusing markup and margin</li>
        <li>Failing to update the estimate after design changes</li>
      </ul>
      <h2>From estimate to quote, order, and invoice</h2>
      <p>An estimate is most useful when it remains connected to delivery.</p>
      <p>Use the <a href="/free-quote-generator">free quote generator</a> to present the customer scope and price, the <a href="/free-purchase-order-generator">free purchase order generator</a> to order materials, and the <a href="/free-invoice-generator">free invoice generator</a> to request payment.</p>
      <p>QuoteCore+ connects these stages with Smart Components™, customer acceptance, material orders, invoices, and activity tracking. Explore <Link href="/construction-quoting-software">construction quoting software</Link> or watch <a href="https://www.youtube.com/watch?v=ntyS1giH5p0">A Better Way to Measure, Quote and Invoice</a>.</p>
      <h2>Frequently asked questions</h2>
      <h3>What is a construction cost estimate?</h3>
      <p>It is a structured forecast of the resources and money required to deliver a defined scope. It may be an early budget, developed estimate, tender, or live cost forecast.</p>
      <h3>How accurate is a construction cost calculator?</h3>
      <p>A calculator is accurate for the inputs and formulas it uses. The full estimate still depends on scope, specification, labour productivity, local prices, access, programme, overheads, and risk.</p>
      <h3>Should I use cost per square metre?</h3>
      <p>Square-metre rates are useful for early benchmarking. They are not a substitute for measured quantities and work-package pricing when design and scope are developed.</p>
      <h3>What is the difference between an estimate and a quote?</h3>
      <p>An estimate forecasts likely cost based on stated information and assumptions. A quote is a commercial offer to complete a defined scope for a stated price and terms.</p>
      <h3>How often should an estimate be updated?</h3>
      <p>Update it when drawings, specification, scope, programme, supplier prices, subcontractor quotes, or risk assumptions change. Live jobs should also track committed and actual cost.</p>
      <p>Start with the <a href="/free-construction-calculator">free construction calculator</a>, then start a <a href="/free-trial">free QuoteCore+ trial</a> when you want estimating, quoting, ordering, and invoicing connected.</p>
    </div>
  );
}
