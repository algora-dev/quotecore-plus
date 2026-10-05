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
  "slug": "bluebeam-alternative-for-roofing",
  "competitorName": "Bluebeam Revu",
  "checkedDate": "27 September 2026",
  "positioning": "Roofing measurement, pricing and quoting",
  "hero": {
    "title": "A Bluebeam alternative when the goal is a roofing quote",
    "sub": "Measure the roof, apply your saved pricing rules and produce the customer quote from the same job. Work on phone, tablet or desktop, with Smart Assistant for supported account questions and changes.",
    "qualifier": "Keep Bluebeam when you need its PDF editing, Studio collaboration, CAD workflows or established Excel links. QuoteCore+ is not a general PDF-document replacement.",
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
    "heading": "Keep document work separate from the quoting decision",
    "body": "Bluebeam is a document and collaboration tool with measurement, custom formulas and Excel links. Its web and mobile tools also include measurement, and Max adds AI-driven document actions. QuoteCore+ takes a different route: roofing measurements feed saved pricing and customer documents inside one job. The useful comparison is the work after measuring, not whether Bluebeam can measure or use AI. You can retain Bluebeam for project documents while using QuoteCore+ for your own estimates and quotes."
  },
  "bestFor": {
    "competitorBestFor": [
      {
        "title": "The project team works in Studio or specialist PDFs",
        "body": "Keep the collaboration and document tools required by the project."
      },
      {
        "title": "Your Excel-linked estimating system works well",
        "body": "A validated spreadsheet workflow is an asset, not something you must discard."
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
      "answer": "Replace the work you no longer need to split across tools, not every Bluebeam capability."
    },
    "body": "QuoteCore+ does not replace Studio collaboration, advanced PDF editing, CAD plug-ins, batch document processing or an established Quantity Link workflow.",
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
        "detail": "QuoteCore+ does not replace Studio collaboration, advanced PDF editing, CAD plug-ins, batch document processing or an established Quantity Link workflow.",
        "positive": false
      }
    ]
  },
  "switching": {
    "intro": "Work through one representative job before switching. Keep any specialist service or integration you still require.",
    "rows": [
      {
        "current": "Your measurement results feed a separate quote document",
        "qc": "Apply saved pricing and prepare the quote inside the same QuoteCore+ job.",
        "benefit": "Reduce a handoff when a separate document workflow is unnecessary."
      },
      {
        "current": "You use Bluebeam for drawing review and collaboration",
        "qc": "Keep Bluebeam for those tasks and enter relevant dimensions into QuoteCore+.",
        "benefit": "Avoid pretending one tool replaces every document function."
      },
      {
        "current": "You need a price update from site",
        "qc": "Retrieve the quote on mobile and review an Assistant-proposed rate adjustment.",
        "benefit": "Use account data and your own rules, not an invented AI price."
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
        "body": "Measure the roofing plan on phone, tablet or desktop. Review scale, outline and components before relying on quantities. Alternatively, enter dimensions you have already checked."
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
    "heading": "Bluebeam vs QuoteCore+: workflow and capabilities",
    "intro": "Capabilities below distinguish documented features from unverified equivalents. A missing confirmation is not evidence that a competitor lacks a feature.",
    "rows": [
      {
        "feature": "PDF viewing / markup",
        "competitor": {
          "status": "yes",
          "note": "PDF viewing, annotation and document editing."
        },
        "qc": {
          "status": "different",
          "note": "Plans and job documents, not a general PDF editor."
        }
      },
      {
        "feature": "Digital roof takeoff",
        "competitor": {
          "status": "yes",
          "note": "PDF measurement tools; scope differs by tier."
        },
        "qc": {
          "status": "yes",
          "note": "Measure supplied plans or suitable images; verify scale and geometry."
        }
      },
      {
        "feature": "Roofing-specific geometry types",
        "competitor": {
          "status": "different",
          "note": "General-purpose measurements and configurable tools."
        },
        "qc": {
          "status": "yes",
          "note": "Roofing areas, pitch and named edge components."
        }
      },
      {
        "feature": "Slope-aware measurement",
        "competitor": {
          "status": "unconfirmed",
          "note": "Equivalent automatic roof-pitch adjustment was not verified."
        },
        "qc": {
          "status": "yes",
          "note": "Apply the roof pitch and check the resulting quantities."
        }
      },
      {
        "feature": "Reusable tools / logic",
        "competitor": {
          "status": "yes",
          "note": "Tool sets and reusable custom columns."
        },
        "qc": {
          "status": "yes",
          "note": "Smart Components reuse your materials, labour, waste and pricing rules."
        }
      },
      {
        "feature": "Custom formulas / cost fields",
        "competitor": {
          "status": "yes",
          "note": "Formula and cost columns."
        },
        "qc": {
          "status": "yes",
          "note": "Saved pricing rules attached to your components."
        }
      },
      {
        "feature": "Excel integration",
        "competitor": {
          "status": "yes",
          "note": "Quantity Link on Complete and Max."
        },
        "qc": {
          "status": "different",
          "note": "Pricing inside the app; not a Quantity Link replacement."
        }
      },
      {
        "feature": "AI assistance",
        "competitor": {
          "status": "yes",
          "note": "Max: AI-connected document actions; some drawing tools are preview."
        },
        "qc": {
          "status": "yes",
          "note": "Reviewed AI Scan Assist plus supported account tasks through Smart Assistant."
        }
      },
      {
        "feature": "Drawing overlays / batch comparison",
        "competitor": {
          "status": "yes",
          "note": "PDF revision and batch-document tools."
        },
        "qc": {
          "status": "different",
          "note": "Not an equivalent batch PDF-comparison workflow."
        }
      },
      {
        "feature": "Studio collaboration",
        "competitor": {
          "status": "yes",
          "note": "Studio; hosting capabilities depend on plan."
        },
        "qc": {
          "status": "no",
          "note": "Not a Studio replacement."
        }
      },
      {
        "feature": "CAD plug-ins / workflows",
        "competitor": {
          "status": "yes",
          "note": "CAD-oriented workflows on applicable plans."
        },
        "qc": {
          "status": "no",
          "note": "No equivalent CAD plug-in suite."
        }
      },
      {
        "feature": "Customer quote generation",
        "competitor": {
          "status": "unconfirmed",
          "note": "Equivalent native customer quote builder not verified."
        },
        "qc": {
          "status": "yes",
          "note": "Create customer quotes from the saved job; send and track where supported."
        }
      },
      {
        "feature": "Quote acceptance / tracking",
        "competitor": {
          "status": "unconfirmed",
          "note": "Equivalent quote-acceptance lifecycle not verified."
        },
        "qc": {
          "status": "yes",
          "note": "Customer quote acceptance and status tracking."
        }
      },
      {
        "feature": "Material order output",
        "competitor": {
          "status": "unconfirmed",
          "note": "Equivalent native order builder not verified."
        },
        "qc": {
          "status": "yes",
          "note": "Create material orders from saved quote data using the order builder."
        }
      },
      {
        "feature": "Invoice from accepted quote",
        "competitor": {
          "status": "unconfirmed",
          "note": "Equivalent invoice conversion not verified."
        },
        "qc": {
          "status": "yes",
          "note": "Create and track invoices from saved job data using the invoice builder."
        }
      },
      {
        "feature": "Multi-trade use",
        "competitor": {
          "status": "yes",
          "note": "Broad construction-document scope."
        },
        "qc": {
          "status": "yes",
          "note": "Roofing-first, plus measured construction trades."
        }
      },
      {
        "feature": "Platform",
        "competitor": {
          "status": "yes",
          "note": "Windows Revu plus web/mobile measurement tools."
        },
        "qc": {
          "status": "yes",
          "note": "Paid app: measure, price and quote on phone, tablet or desktop."
        }
      },
      {
        "feature": "Pricing model",
        "competitor": {
          "status": "yes",
          "note": "Annual per-user plans; Max price is introductory."
        },
        "qc": {
          "status": "yes",
          "note": "Paid plans from $19/month; free standalone tools are separate."
        }
      },
      {
        "feature": "Conversational actions",
        "competitor": {
          "status": "yes",
          "note": "Max MCP can work with markups and custom columns."
        },
        "qc": {
          "status": "yes",
          "note": "Find account records and propose supported changes for your confirmation."
        }
      }
    ]
  },
  "pricing": {
    "heading": "Bluebeam vs QuoteCore+ pricing",
    "intro": "Compare the required feature set, billing commitment and any external measurement costs. These are different products, not a like-for-like savings guarantee.",
    "sourceNote": "Official vendor pricing reviewed 27 September 2026. Competitor figures are US prices; account, region, tax, discounts and billing conditions may change the total. Check the linked source before buying.",
    "competitorTiers": [
      {
        "name": "Basics",
        "price": "US$260/user/year",
        "detail": "Annual billing."
      },
      {
        "name": "Core",
        "price": "US$330/user/year",
        "detail": "Annual billing."
      },
      {
        "name": "Complete",
        "price": "US$440/user/year",
        "detail": "Annual billing; includes Quantity Link."
      },
      {
        "name": "Max",
        "price": "US$590/user/year",
        "detail": "Introductory price; verify renewal and preview availability."
      }
    ],
    "scenarios": [
      {
        "label": "PDF collaboration remains a requirement",
        "competitor": "Keep the Bluebeam plan that covers your document work.",
        "qc": "QuoteCore+ would be an additional estimating subscription, not a replacement saving."
      },
      {
        "label": "Your main requirement is customer quoting",
        "competitor": "Check the PDF, spreadsheet and customer-document steps in your existing setup.",
        "qc": "Paid plans start at $19/month. Compare the full workflow rather than assuming every tier is cheaper."
      }
    ],
    "scenarioNote": "Illustrative workflow comparisons, not equivalent bundles. External imagery, measurement reports, setup time and separately required services are not included in the QuoteCore+ subscription."
  },
  "video": {
    "heading": "See how measurements become a quote",
    "intro": "This existing walkthrough shows the measurement and pricing workflow. It is not a new mobile or Smart Assistant demonstration.",
    "videoKey": "smartComponents",
    "ctaHref": "/features/smart-components",
    "ctaLabel": "Explore Smart Components"
  },
  "honestWhen": {
    "heading": "When to keep Bluebeam",
    "intro": "QuoteCore+ does not replace Studio collaboration, advanced PDF editing, CAD plug-ins, batch document processing or an established Quantity Link workflow.",
    "cards": [
      {
        "title": "The project team works in Studio or specialist PDFs",
        "body": "Keep the collaboration and document tools required by the project."
      },
      {
        "title": "Your Excel-linked estimating system works well",
        "body": "A validated spreadsheet workflow is an asset, not something you must discard."
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
      "question": "Is Bluebeam desktop-only?",
      "answer": "No. Revu is the Windows desktop application, but Bluebeam also includes web and mobile tools with measurement features. QuoteCore+'s distinction is its connected job-pricing and quoting workflow, not exclusive mobile access."
    },
    {
      "question": "Can Bluebeam use AI to change documents?",
      "answer": "Bluebeam Max advertises AI integrations that can create or edit markups and custom columns. Some drawing-review capabilities are marked preview. QuoteCore+ Smart Assistant is aimed at supported account tasks instead."
    },
    {
      "question": "Does QuoteCore+ replace Studio or Quantity Link?",
      "answer": "No. Keep Bluebeam for those functions where they are part of your process. QuoteCore+ is an alternative for a roofing measure-to-quote workflow, not every PDF or Excel integration."
    },
    {
      "question": "Can I keep using Excel for pricing?",
      "answer": "Yes. There is no need to replace a method that serves you well. QuoteCore+ becomes useful when saving pricing rules with the measured job reduces work you otherwise repeat."
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
      "question": "Is switching from Bluebeam automatic?",
      "answer": "No automatic migration or native integration is promised. Check which dimensions, rates, templates and records you need. Configure your pricing rules and validate a representative job before relying on the new setup."
    }
  ],
  "related": [
    {
      "label": "PlanSwift alternative",
      "description": "General takeoff vs roofing-native.",
      "href": "/planswift-alternative"
    },
    {
      "label": "STACK alternative for roofing",
      "description": "Multi-trade platform vs roofing-native.",
      "href": "/stack-alternative-for-roofing"
    },
    {
      "label": "Roofing takeoff software",
      "description": "Measure roof plans digitally with AI assistance.",
      "href": "/roofing-takeoff-software"
    },
    {
      "label": "Smart Components",
      "description": "How reusable roofing pricing rules work.",
      "href": "/features/smart-components"
    },
    {
      "label": "Roofing quoting software",
      "description": "The full quote-to-invoice workflow for roofers.",
      "href": "/roofing-quoting-software"
    },
    {
      "label": "HOVER alternative",
      "description": "Generated 3D measurement vs owned takeoff.",
      "href": "/hover-alternative"
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
    "comparison",
    "pricing",
    "workflow",
    "switching",
    "bestFor",
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
      "body": "Measure the roofing plan on phone, tablet or desktop. Review scale, outline and components before relying on quantities.",
      "href": "/features/digital-roof-takeoff",
      "linkLabel": "Explore digital takeoff"
    },
    {
      "title": "Enter your measurements",
      "body": "Keep your existing measurement method. Enter known dimensions into Smart Components rather than rebuilding the customer quote elsewhere.",
      "href": "/features/smart-components",
      "linkLabel": "See saved pricing rules"
    },
    {
      "title": "Ask Smart Assistant",
      "body": "Ask for a saved quote or supported rate change by text or voice. The Assistant works on account records, not Bluebeam PDF markups.",
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
      "label": "Bluebeam tools and plan comparison",
      "href": "https://www.bluebeam.com/pricing/",
      "scope": "Measurement, custom columns, Excel, PDF collaboration and web/mobile feature scope. Per-user annual prices; Max is explicitly introductory."
    },
    {
      "id": "assistant",
      "label": "Bluebeam Max",
      "href": "https://www.bluebeam.com/bluebeam-max/",
      "scope": "AI-driven markup and custom-column actions through MCP; some drawing tools carry preview qualifications."
    }
  ],
  "rowSources": {
    "PDF viewing / markup": [
      "product"
    ],
    "Digital roof takeoff": [
      "product"
    ],
    "Roofing-specific geometry types": [
      "product"
    ],
    "Slope-aware measurement": [
      "product"
    ],
    "Reusable tools / logic": [
      "product"
    ],
    "Custom formulas / cost fields": [
      "product"
    ],
    "Excel integration": [
      "product"
    ],
    "AI assistance": [
      "assistant"
    ],
    "Drawing overlays / batch comparison": [
      "product"
    ],
    "Studio collaboration": [
      "product"
    ],
    "CAD plug-ins / workflows": [
      "product"
    ],
    "Customer quote generation": [
      "product"
    ],
    "Quote acceptance / tracking": [
      "product"
    ],
    "Material order output": [
      "product"
    ],
    "Invoice from accepted quote": [
      "product"
    ],
    "Multi-trade use": [
      "product"
    ],
    "Platform": [
      "product"
    ],
    "Pricing model": [
      "product"
    ],
    "Conversational actions": [
      "assistant"
    ]
  },
  "pricingSourceIds": [
    "product"
  ],
  "note": "This comparison is published by QuoteCore+ and is based on the linked vendor documentation, not a hands-on performance test. Feature availability, plans and previews can change. Unverified equivalents are marked explicitly, not scored as missing features."
};

export const metadata: Metadata = {
  "title": "Bluebeam Alternative for Roofing Takeoff & Quotes | QuoteCore+",
  "description": "Compare Bluebeam with QuoteCore+ for roofing takeoff, mobile pricing and quotes. Review PDF collaboration, Excel, AI features and current plan costs.",
  "openGraph": {
    "title": "Bluebeam Alternative for Roofing Takeoff & Quotes | QuoteCore+",
    "description": "Compare Bluebeam with QuoteCore+ for roofing takeoff, mobile pricing and quotes. Review PDF collaboration, Excel, AI features and current plan costs.",
    "url": "/bluebeam-alternative-for-roofing",
    "siteName": "QuoteCore+",
    "type": "website"
  },
  "alternates": {
    "canonical": "https://quote-core.com/bluebeam-alternative-for-roofing"
  }
};

const faqSchema = buildFaqSchema(pageData.faqs);
const breadcrumbSchema = buildBreadcrumbSchema([
  { name: "Home", url: `${siteUrl}/` },
  { name: "Bluebeam Alternative for Roofing", url: `${siteUrl}/bluebeam-alternative-for-roofing` },
]);

export default function BluebeamAlternativeForRoofingPage() {
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
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Bluebeam Alternative for Roofing" }]} />
        <CompetitorPage data={pageData} threeWays={threeWays} research={research} />
        <SiteFooter />
      </main>
    </>
  );
}
