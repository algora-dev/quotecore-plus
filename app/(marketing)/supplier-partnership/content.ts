export const trustPoints = [
  "No setup fee",
  "No sales commission",
  "You control pricing",
  "Enquiries go directly to you",
];

export const freeOfferings = [
  {
    number: "01",
    eyebrow: "Inside QuoteCore+",
    title: "Your products available while contractors quote",
    description:
      "We add your supplier profile, catalogue data and component library to QuoteCore+ so contractors can find and specify your materials while they build a job price.",
    bullets: [
      "Partner supplier profile inside QuoteCore+",
      "Help structuring your first product and pricing library",
      "Control over the products and pricing you make available",
      "A direct route from product selection to your business",
    ],
    screenshot: "/images/supplier-partnership/takeoff-builder.jpg",
    screenshotAlt:
      "QuoteCore+ takeoff builder showing roof area input with supplier pricing applied",
  },
  {
    number: "02",
    eyebrow: "Public customer tool",
    title: "A useful preliminary price before they contact you",
    description:
      "We connect the same supplier data to a public roofing takeoff and pricing experience that customers can find or open from a link on your website.",
    bullets: [
      "A supplier-specific pricing experience on quote-core.com",
      "Your products applied to real roof measurements",
      "Clear preliminary pricing without presenting a formal quote",
      "Qualified enquiries delivered directly to your team",
    ],
    screenshot: "/images/supplier-partnership/send-enquiry-modal.jpg",
    screenshotAlt:
      "Send enquiry modal where a contractor sends a detailed request directly to the supplier",
  },
];

export const enquiryFlowSteps = [
  {
    title: "Contractor selects your roofing system",
    description:
      "The buyer picks your supplier profile from the directory. Your products, pricing and component library are applied automatically.",
    screenshot: "/images/supplier-partnership/supplier-selection.jpg",
    screenshotAlt:
      "Supplier selection screen showing Apex Roofing and other suppliers in the QuoteCore+ directory",
  },
  {
    title: "They enter measurements and get a real preliminary total",
    description:
      "Roof area, pitch, ridges, hips, valleys - all calculated with your products and pricing. The buyer sees a useful estimate, not a guess.",
    screenshot: "/images/supplier-partnership/takeoff-builder.jpg",
    screenshotAlt:
      "Takeoff builder showing roof area entry with pitch, waste and supplier pricing applied",
  },
  {
    title: "A full takeoff report is generated",
    description:
      "Every component is itemised with quantities, waste factors, material and labour costs. The buyer has everything they need to make a decision.",
    screenshot: "/images/supplier-partnership/takeoff-report.jpg",
    screenshotAlt:
      "Generated roof takeoff report showing itemised components with quantities and pricing",
  },
  {
    title: "You receive a qualified enquiry with everything attached",
    description:
      "Contact details, project context, takeoff breakdown and a link to the full result - all sent directly to your inbox. No middleman.",
    screenshot: "/images/supplier-partnership/supplier-enquiry-email.jpg",
    screenshotAlt:
      "Email received by supplier showing the full enquiry with takeoff breakdown and pricing",
  },
];

export const customerExperienceSteps = [
  ["Choose a roofing system", "The buyer starts with the products and systems you want to make available."],
  ["Enter simple measurements", "They add the roof area, pitch and the few details needed for a useful starting point."],
  ["See a preliminary total", "QuoteCore+ applies your configured product data and pricing rules."],
  ["Send a qualified enquiry", "You receive their contact details with the selected system and project context."],
] as const;

export const supplierBenefits = [
  ["Get specified earlier", "Put your products into the pricing decision before a contractor has settled on an alternative."],
  ["Improve enquiry quality", "Start conversations with the roof system, measurements and preliminary value already understood."],
  ["Reduce repetitive work", "Answer fewer early-stage rough-price questions that never become a genuine opportunity."],
  ["Keep the relationship", "Customers contact your business directly. QuoteCore+ does not stand between you and the sale."],
  ["Control what is visible", "Choose products, service areas and whether pricing is shown as figures, ranges or not at all."],
  ["Learn what buyers want", "See which products, roof systems and regions are generating attention when reporting is enabled."],
] as const;

export const customServices = [
  {
    number: "01",
    title: "Brand and website",
    description: "Turn the core pricing experience into a customer-facing asset that looks and feels like your business.",
    items: ["Branded calculators", "Website embeds", "Dedicated landing pages", "Product-led campaigns"],
  },
  {
    number: "02",
    title: "Sales operations",
    description: "Build a more complete path from an initial measurement through to a managed supplier quotation.",
    items: ["Supplier quoting systems", "Catalogue workflows", "Enquiry management", "System integrations"],
  },
  {
    number: "03",
    title: "Growth and insight",
    description: "Use the tools, content and demand signals to create a repeatable channel for supplier growth.",
    items: ["Usage reporting", "Demand analysis", "Worked examples", "Ongoing optimisation"],
  },
] as const;
