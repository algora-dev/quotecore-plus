import type { Metadata } from "next";
import BlogHeader from "@/components/BlogHeader";
import SiteFooter from "@/components/SiteFooter";
import Breadcrumbs from "@/components/Breadcrumbs";
import CompetitorPage, { type ComparisonResearch } from "@/components/competitor-pages/competitor-page";
import type { ThreeWaysToWorkProps } from "@/components/ThreeWaysToWork";
import type { CompetitorPageData } from "@/lib/competitor-pages/types";
import { buildBreadcrumbSchema, buildFaqSchema, siteUrl } from "@/lib/schema";

// Active content stays route-local within the authorized marketing surface.
// Visible FAQs and their structured data use this same object.
const pageData: CompetitorPageData = {
  "slug": "hover-alternative",
  "competitorName": "HOVER",
  "checkedDate": "27 September 2026",
  "positioning": "Roofing measurement, pricing and quoting",
  "hero": {
    "title": "A HOVER alternative for hands-on roof takeoff and quoting",
    "sub": "Work directly with your roofing plan or existing measurements. Apply your own saved rules and review the customer quote on phone, tablet or desktop, with Smart Assistant available for supported account tasks.",
    "qualifier": "QuoteCore+ does not turn phone photos into an automatic 3D property model or offer HOVER's exterior-design visualization.",
    "primaryCta": {
      "href": "/pricing",
      "label": "See paid plans"
    },
    "ghostCta": {
      "href": "/free-roofing-takeoff-builder",
      "label": "Use free roof takeoff"
    }
  },
  "quickAnswer": {
    "heading": "Choose between photo-to-3D and hands-on plan takeoff",
    "body": "HOVER connects photo or blueprint measurements with 3D models, estimates and agreements. It also supports mobile estimating, so mobile access alone is not a difference. QuoteCore+ is a different approach: directly measure and revise your own plans, or enter dimensions you already trust, then apply your saved pricing logic. Choose based on whether you need photo-to-3D measurement and visualization, or a hands-on measurement-to-quote workflow with your own account data."
  },
  "bestFor": {
    "competitorBestFor": [
      {
        "title": "The 3D model helps you measure or sell the job",
        "body": "Retain photo-based capture and visual design where those outputs are central to your process."
      },
      {
        "title": "Your supplier or claims workflow depends on HOVER",
        "body": "Check required integrations and document formats before changing systems."
      }
    ],
    "qcBestFor": [
      {
        "title": "The recurring task is a measured job and customer quote",
        "body": "You want measurements and your own rates in the same saved workflow."
      },
      {
        "title": "You work between site and office",
        "body": "You need the paid app on phone, tablet and desktop, not just a place to view documents."
      },
      {
        "title": "You want help without giving up control",
        "body": "Use Smart Assistant for supported retrieval and changes, while keeping manual controls available."
      }
    ]
  },
  "replace": {
    "verdict": {
      "pill": "Depends on the workflow",
      "tone": "mixed",
      "answer": "Replace the work you no longer need to split across tools, not every HOVER capability."
    },
    "body": "QuoteCore+ does not replace automatic photo-to-3D reconstruction, material visualization or insurance-specific outputs you rely on in HOVER.",
    "bullets": [
      {
        "label": "Measure, price and quote",
        "detail": "Use your own source material and saved pricing to create customer documents.",
        "positive": true
      },
      {
        "label": "Work from your phone",
        "detail": "The paid app supports takeoff, saved jobs and quoting on phone, tablet and desktop.",
        "positive": true
      },
      {
        "label": "Ask, then review",
        "detail": "Smart Assistant retrieves records and proposes supported changes. You confirm important edits.",
        "positive": true
      },
      {
        "label": "Keep specialist tools when needed",
        "detail": "QuoteCore+ does not replace automatic photo-to-3D reconstruction, material visualization or insurance-specific outputs you rely on in HOVER.",
        "positive": false
      }
    ]
  },
  "switching": {
    "intro": "Work through one representative job before switching. Keep any specialist service or integration you still require.",
    "rows": [
      {
        "current": "You need a photo-based 3D property model",
        "qc": "Keep that measurement service and enter relevant dimensions into QuoteCore+ if useful.",
        "benefit": "Do not give up an output that the quoting app does not replace."
      },
      {
        "current": "You already have a PDF plan",
        "qc": "Measure and adjust the takeoff yourself in QuoteCore+.",
        "benefit": "Control revisions on the source plan."
      },
      {
        "current": "Your price depends on your own rules",
        "qc": "Save material, labour, coverage and waste logic as Smart Components.",
        "benefit": "Reuse the setup across jobs."
      }
    ]
  },
  "workflow": {
    "heading": "From the measurement to the customer quote",
    "intro": "Choose the entry point that fits the job. The paid app keeps the measurement, your pricing rules and customer documents connected.",
    "steps": [
      {
        "number": "01",
        "title": "Measure or enter known dimensions",
        "body": "Trace and revise the roofing plan directly on phone, tablet or desktop. AI Scan Assist offers a reviewed plan-scanning path, not photo-to-3D reconstruction. Alternatively, enter dimensions you have already checked."
      },
      {
        "number": "02",
        "title": "Review before using the quantities",
        "body": "Check scale, pitch and visible geometry. With AI Scan Assist, review and correct the outline before component detection, then verify the result. The scan is assistance, not a guarantee."
      },
      {
        "number": "03",
        "title": "Apply the rules you actually use",
        "body": "Smart Components calculate material, labour, waste and pricing using your saved setup. Check quantities and allowances against the job. New rules still need configuring and validating."
      },
      {
        "number": "04",
        "title": "Review the quote and keep the job connected",
        "body": "Prepare the customer quote from the same job. Use the normal app builders for later orders and invoices. Smart Assistant can retrieve records or propose supported changes; it does not replace takeoff checks or create orders and invoices for you."
      }
    ],
    "proof": {
      "heading": "See the measurement and pricing workflow",
      "images": [
        {
          "src": "/images/features/digital-roof-takeoff.png",
          "alt": "QuoteCore+ roof takeoff showing colour-coded measurement lines over a roof plan",
          "caption": "Example takeoff view. Check the plan scale, roof outline and component measurements."
        },
        {
          "src": "/images/features/smart-components-quote.png",
          "alt": "Smart Components applying material quantities and pricing inside a QuoteCore+ quote",
          "caption": "Example pricing view. Your saved material, labour and waste rules feed the quote."
        }
      ]
    }
  },
  "comparison": {
    "heading": "HOVER vs QuoteCore+: workflow and capabilities",
    "intro": "Capabilities below distinguish documented features from unverified equivalents. A missing confirmation is not evidence that a competitor lacks a feature.",
    "rows": [
      {
        "feature": "Automated measurement from smartphone photos",
        "competitor": {
          "status": "yes",
          "note": "Photo-based measurement workflow."
        },
        "qc": {
          "status": "no",
          "note": "No automatic property reconstruction from phone photos."
        }
      },
      {
        "feature": "Automatic 3D property model",
        "competitor": {
          "status": "yes",
          "note": "3D property modeling."
        },
        "qc": {
          "status": "no",
          "note": "No equivalent automatic 3D property model."
        }
      },
      {
        "feature": "Blueprint roof measurement",
        "competitor": {
          "status": "yes",
          "note": "Blueprint submission route; charges depend on the project."
        },
        "qc": {
          "status": "yes",
          "note": "Measure supplied PDFs yourself in the app."
        }
      },
      {
        "feature": "Directly edit / trace plan geometry",
        "competitor": {
          "status": "unconfirmed",
          "note": "Equivalent direct blueprint tracing/editing was not verified."
        },
        "qc": {
          "status": "yes",
          "note": "Review and edit the takeoff geometry yourself."
        }
      },
      {
        "feature": "Roof-specific AI plan detection",
        "competitor": {
          "status": "unconfirmed",
          "note": "Equivalent user-reviewed staged plan scan was not verified."
        },
        "qc": {
          "status": "yes",
          "note": "AI Scan Assist: scan, review the outline, then detect and check components."
        }
      },
      {
        "feature": "Material estimates",
        "competitor": {
          "status": "yes",
          "note": "Estimates use measurements, materials and labour."
        },
        "qc": {
          "status": "yes",
          "note": "Smart Components reuse your materials, labour, waste and pricing rules."
        }
      },
      {
        "feature": "Reusable estimating logic",
        "competitor": {
          "status": "yes",
          "note": "Reusable estimating templates."
        },
        "qc": {
          "status": "yes",
          "note": "Save and reuse your own components and rate rules."
        }
      },
      {
        "feature": "3D material visualization",
        "competitor": {
          "status": "yes",
          "note": "Exterior-design visualization with materials."
        },
        "qc": {
          "status": "no",
          "note": "Not a 3D design-visualization product."
        }
      },
      {
        "feature": "Customer proposal / agreement",
        "competitor": {
          "status": "yes",
          "note": "Branded agreements and signing."
        },
        "qc": {
          "status": "yes",
          "note": "Create customer quotes from the saved job; send and track where supported."
        }
      },
      {
        "feature": "Material ordering",
        "competitor": {
          "status": "yes",
          "note": "Supplier-connected ordering, including ABC Supply."
        },
        "qc": {
          "status": "different",
          "note": "Build material orders; supplier connections are not assumed equivalent."
        }
      },
      {
        "feature": "Invoicing",
        "competitor": {
          "status": "unconfirmed",
          "note": "Equivalent native invoice lifecycle not verified."
        },
        "qc": {
          "status": "yes",
          "note": "Create and track invoices from saved job data using the invoice builder."
        }
      },
      {
        "feature": "CRM / project-management integrations",
        "competitor": {
          "status": "yes",
          "note": "Integrations advertised; confirm required connector and tier."
        },
        "qc": {
          "status": "different",
          "note": "Not a replacement for every CRM/accounting connector."
        }
      },
      {
        "feature": "Insurance / estimatics workflow",
        "competitor": {
          "status": "yes",
          "note": "Specialist outputs and connections advertised; confirm requirements."
        },
        "qc": {
          "status": "no",
          "note": "Not an insurance-estimatics replacement."
        }
      },
      {
        "feature": "Per-project measurement fees",
        "competitor": {
          "status": "yes",
          "note": "Separate project charges depend on the measurement type."
        },
        "qc": {
          "status": "different",
          "note": "No supplied measurement service; external source costs remain yours."
        }
      },
      {
        "feature": "Pricing model",
        "competitor": {
          "status": "yes",
          "note": "Project fees, with optional annual subscription plans."
        },
        "qc": {
          "status": "yes",
          "note": "Paid plans from $19/month; free standalone tools are separate."
        }
      },
      {
        "feature": "Phone and tablet estimating",
        "competitor": {
          "status": "yes",
          "note": "Mobile/tablet estimating is advertised."
        },
        "qc": {
          "status": "yes",
          "note": "Paid app: measure, price and quote on phone, tablet or desktop."
        }
      },
      {
        "feature": "Conversational account assistance",
        "competitor": {
          "status": "unconfirmed",
          "note": "Equivalent quote-record retrieval and update actions not verified."
        },
        "qc": {
          "status": "yes",
          "note": "Find account records and propose supported changes for your confirmation."
        }
      }
    ]
  },
  "pricing": {
    "heading": "HOVER vs QuoteCore+ pricing",
    "intro": "Compare the required feature set, billing commitment and any external measurement costs. These are different products, not a like-for-like savings guarantee.",
    "sourceNote": "Official vendor pricing reviewed 27 September 2026. Competitor figures are US prices; account, region, tax, discounts and billing conditions may change the total. Check the linked source before buying.",
    "competitorTiers": [
      {
        "name": "Starter",
        "price": "Pay per project",
        "detail": "No annual subscription fee; measurement fees depend on project type."
      },
      {
        "name": "Pro",
        "price": "US$999/year",
        "detail": "Measurement project fees remain additional."
      },
      {
        "name": "Business",
        "price": "US$2,999/year",
        "detail": "Different project-price arrangements; fees remain additional."
      },
      {
        "name": "Enterprise",
        "price": "Custom pricing",
        "detail": "Confirm terms with HOVER."
      }
    ],
    "scenarios": [
      {
        "label": "A workflow that needs a 3D model",
        "competitor": "Include the applicable plan and measurement-project charges.",
        "qc": "QuoteCore+ does not supply that model. Any separate measurement service remains extra."
      },
      {
        "label": "You already have a usable plan or dimensions",
        "competitor": "Check the measurement submission route and pricing for your account.",
        "qc": "Work directly with the source in the paid app; pricing starts at $19/month."
      }
    ],
    "scenarioNote": "Illustrative workflow comparisons, not equivalent bundles. External imagery, measurement reports, setup time and separately required services are not included in the QuoteCore+ subscription."
  },
  "video": {
    "heading": "See how measurements become a quote",
    "intro": "This existing walkthrough shows the measurement and pricing workflow. It is not a new mobile or Smart Assistant demonstration.",
    "videoKey": "quoteWalkthrough",
    "ctaHref": "/features/smart-components",
    "ctaLabel": "Explore Smart Components"
  },
  "honestWhen": {
    "heading": "When to keep HOVER",
    "intro": "QuoteCore+ does not replace automatic photo-to-3D reconstruction, material visualization or insurance-specific outputs you rely on in HOVER.",
    "cards": [
      {
        "title": "The 3D model helps you measure or sell the job",
        "body": "Retain photo-based capture and visual design where those outputs are central to your process."
      },
      {
        "title": "Your supplier or claims workflow depends on HOVER",
        "body": "Check required integrations and document formats before changing systems."
      }
    ]
  },
  "freeTool": {
    "heading": "Try a useful tool before choosing the paid app",
    "body": "Use the free roof takeoff tool with your own suitable plan or image. It is a standalone tool with its own device support and limits, not access to the complete paid app. The paid app adds saved setup, reusable pricing and connected jobs.",
    "primaryHref": "/free-roofing-takeoff-builder",
    "primaryLabel": "Use free roof takeoff",
    "secondaryLinks": [
      {
        "label": "Free measurement-to-quote tool",
        "href": "/measurement-to-quote-tool",
        "description": "Use dimensions you already have."
      },
      {
        "label": "Browse free tools",
        "href": "/free-tools",
        "description": "Choose a standalone tool for the task."
      }
    ]
  },
  "faqs": [
    {
      "question": "Can QuoteCore+ make a HOVER-style 3D model from photos?",
      "answer": "No. It measures supplied plans or suitable images, or uses dimensions you enter. It does not reconstruct a complete property from phone photos."
    },
    {
      "question": "Does HOVER also estimate and create agreements?",
      "answer": "Yes. Its current product pages describe estimating, reusable templates, agreements and mobile use. The comparison is about workflow and scope, not a claim that HOVER only measures."
    },
    {
      "question": "Are HOVER measurement fees included in its subscription price?",
      "answer": "Its pricing page lists measurement project charges separately. The amount depends on the plan and measurement type, so an annual plan price alone is not the full project cost."
    },
    {
      "question": "Can I reuse HOVER dimensions in QuoteCore+?",
      "answer": "You can manually enter relevant dimensions from a report you are entitled to use. No native HOVER connector or automatic 3D-model import is promised."
    },
    {
      "question": "Can I measure, price and quote from my phone in QuoteCore+?",
      "answer": "Yes, in the paid app. Upload a plan, measure or use the reviewed AI scan workflow, apply saved pricing and prepare the quote on phone, tablet or desktop. Standalone free tools and the Roofing Takeoff Demo have separate device support and limits."
    },
    {
      "question": "What can QuoteCore+ Smart Assistant do?",
      "answer": "Use text or voice to find jobs, quotes, orders, invoices and status information in your account. It can propose supported changes such as adjusting a quote rate, which you review and confirm. It works within the access you give it. It does not perform takeoff geometry or create orders and invoices. Check current feature access on the pricing page."
    },
    {
      "question": "Is there a free QuoteCore+ app plan?",
      "answer": "No. The app is paid, with plans from $19/month and a 30-day money-back guarantee. Separate free tools can be used without signing up, but they are not a free account with the full app's saved workspace and capabilities."
    },
    {
      "question": "Is switching from HOVER automatic?",
      "answer": "No automatic migration or native integration is promised. Check which dimensions, rates, templates and records you need. Configure your pricing rules and validate a representative job before relying on the new setup."
    }
  ],
  "related": [
    {
      "label": "Roofing takeoff software",
      "description": "Measure roof plans digitally with AI assistance.",
      "href": "/roofing-takeoff-software"
    },
    {
      "label": "EagleView alternative",
      "description": "Aerial reports vs owning your workflow.",
      "href": "/eagleview-alternative"
    },
    {
      "label": "RoofSnap alternative",
      "description": "Closest product-to-product comparison.",
      "href": "/roofsnap-alternative"
    },
    {
      "label": "Roofr alternative",
      "description": "Broad roofing CRM vs focused estimating.",
      "href": "/roofr-alternative"
    },
    {
      "label": "Roofing quoting software",
      "description": "The full quote-to-invoice workflow for roofers.",
      "href": "/roofing-quoting-software"
    },
    {
      "label": "Free takeoff builder",
      "description": "Try roof takeoff free, no signup.",
      "href": "/free-roofing-takeoff-builder"
    },
    {
      "href": "/features",
      "label": "How QuoteCore+ works",
      "description": "Mobile workflows, Smart Assistant and the connected app."
    }
  ],
  "sectionOrder": [
    "quickAnswer",
    "replace",
    "workflow",
    "bestFor",
    "switching",
    "comparison",
    "pricing",
    "video",
    "honestWhen",
    "freeTool",
    "faq",
    "related"
  ],
  "finalCta": {
    "heading": "Make the next measured job easier to quote",
    "body": "Work with your measurements and your pricing, from site or office. Review paid plans for saved jobs and connected workflows, or use a separate free tool first.",
    "ctaLabel": "See paid plans"
  }
};

const threeWays: ThreeWaysToWorkProps = {
  "eyebrow": "One job. Three ways to work.",
  "title": "Measure it, enter it or ask Smart Assistant",
  "intro": "Choose the path for the task. You can switch between direct controls and the Assistant; these are not three steps you must complete in order.",
  "cards": [
    {
      "title": "Measure in the app",
      "body": "Trace and revise the roofing plan directly on phone, tablet or desktop. AI Scan Assist offers a reviewed plan-scanning path, not photo-to-3D reconstruction.",
      "href": "/features/digital-roof-takeoff",
      "linkLabel": "Explore digital takeoff"
    },
    {
      "title": "Enter your measurements",
      "body": "Enter measurements from site notes or a report you are entitled to use. Keep your own material, labour and waste logic.",
      "href": "/features/smart-components",
      "linkLabel": "See saved pricing rules"
    },
    {
      "title": "Ask Smart Assistant",
      "body": "Retrieve the quote or invoice status by text or voice. Confirm supported changes rather than letting an assistant invent the job price.",
      "href": "/features",
      "linkLabel": "Explore the app features"
    }
  ],
  "footnote": "Your inputs and saved pricing rules remain the basis of the quote. Smart Assistant access and supported actions depend on the available feature and permissions. Important changes are proposed for confirmation.",
  "footnoteLink": {
    "href": "/pricing",
    "label": "Check plans and feature access"
  }
};

const research: ComparisonResearch = {
  "reviewedDate": "27 September 2026",
  "sources": [
    {
      "id": "product",
      "label": "HOVER estimating workflow",
      "href": "https://hover.to/estimates/contractors",
      "scope": "Measurements, reusable estimates, mobile/tablet optimization and customer proposals."
    },
    {
      "id": "pricing",
      "label": "HOVER plan and project pricing",
      "href": "https://hover.to/pricing/",
      "scope": "Starter pay-per-project, Pro and Business annual plans, and separate measurement charges."
    },
    {
      "id": "design",
      "label": "HOVER design visualization",
      "href": "https://hover.to/design",
      "scope": "Photo-based exterior visualization and material choices."
    },
    {
      "id": "agreement",
      "label": "HOVER agreements",
      "href": "https://hover.to/agreements",
      "scope": "Branded customer agreements and signing."
    },
    {
      "id": "ordering",
      "label": "HOVER with ABC Supply",
      "href": "https://abcsupply.hover.to/",
      "scope": "Example supplier-connected ordering workflow. Availability depends on the supplier and account."
    }
  ],
  "rowSources": {
    "Automated measurement from smartphone photos": [
      "product"
    ],
    "Automatic 3D property model": [
      "design"
    ],
    "Blueprint roof measurement": [
      "pricing"
    ],
    "Directly edit / trace plan geometry": [
      "product"
    ],
    "Roof-specific AI plan detection": [
      "product"
    ],
    "Material estimates": [
      "product"
    ],
    "Reusable estimating logic": [
      "product"
    ],
    "3D material visualization": [
      "design"
    ],
    "Customer proposal / agreement": [
      "agreement"
    ],
    "Material ordering": [
      "ordering"
    ],
    "Invoicing": [
      "product"
    ],
    "CRM / project-management integrations": [
      "pricing"
    ],
    "Insurance / estimatics workflow": [
      "pricing"
    ],
    "Per-project measurement fees": [
      "pricing"
    ],
    "Pricing model": [
      "pricing"
    ],
    "Phone and tablet estimating": [
      "product"
    ],
    "Conversational account assistance": [
      "product"
    ]
  },
  "pricingSourceIds": [
    "pricing"
  ],
  "note": "This comparison is published by QuoteCore+ and is based on the linked vendor documentation, not a hands-on performance test. Feature availability, plans and previews can change. Unverified equivalents are marked explicitly, not scored as missing features."
};

export const metadata: Metadata = {
  "title": "HOVER Alternative for Roof Takeoff & Quotes | QuoteCore+",
  "description": "Compare HOVER with QuoteCore+ for roof measurements, editable plan takeoff, mobile estimating and quotes. Understand 3D capabilities and project fees.",
  "openGraph": {
    "title": "HOVER Alternative for Roof Takeoff & Quotes | QuoteCore+",
    "description": "Compare HOVER with QuoteCore+ for roof measurements, editable plan takeoff, mobile estimating and quotes. Understand 3D capabilities and project fees.",
    "url": "/hover-alternative",
    "siteName": "QuoteCore+",
    "type": "website"
  },
  "alternates": {
    "canonical": "https://quote-core.com/hover-alternative"
  }
};

const faqSchema = buildFaqSchema(pageData.faqs);
const breadcrumbSchema = buildBreadcrumbSchema([
  { name: "Home", url: `${siteUrl}/` },
  { name: "HOVER Alternative", url: `${siteUrl}/hover-alternative` },
]);

export default function HoverAlternativePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <main className="min-h-screen bg-white text-zinc-950">
        <BlogHeader />
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "HOVER Alternative" }]} />
        <CompetitorPage data={pageData} threeWays={threeWays} research={research} />
        <SiteFooter />
      </main>
    </>
  );
}
