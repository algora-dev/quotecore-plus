# Smart Assistant Demo Brief - Apex Roofing (T3 Labs)

**Purpose of this document:** A complete, self-contained brief for building a customer-facing "Smart Assistant" chatbot demo. The builder may have zero prior context on our business; everything needed is in this document. Read it fully before planning.

## 1. What this is (business context)

We (T3 Labs) are launching a service: **we build bespoke AI chat assistants for other businesses.** Each assistant is that business's own version of ChatGPT - trained on their business info, services, products and pricing - embedded on their website so their customers can get instant answers 24/7 instead of calling or emailing.

To sell this service we need a **convincing interactive demo** built around a fictitious roofing company, **Apex Roofing**. The demo is a landing page + embedded chatbot that we can send to potential customers (and record screen-capture videos of) to show exactly what they'd get.

**Key framing:** this is a DEMO of a productized service. It must feel real and polished - like Apex Roofing actually deployed this on their site - but it is fictional. No real backend business operations, payments or emails are required; inquiry capture can be simulated (stored/logged) for the demo.

## 2. What the assistant must do

The assistant has two capability tiers. It must handle BOTH brilliantly.

### Tier 1 - Business knowledge Q&A ("their own ChatGPT")

- Answers the kinds of questions a customer would normally phone or email about: services offered, service areas, opening hours, how the process works from enquiry to completion, warranties/guarantees, roofing types worked on, emergency callouts, insurance work, how long jobs take, etc.
- Conversational, warm, concise. Definitive answers, no hedging, no walls of text.
- Where the business info we feed it doesn't cover a question, it must NOT hallucinate. It says it doesn't know and **correctly hands off to the human team** - e.g. offers to create a proper inquiry that "the Apex team will respond to", capturing name + contact + question. This handoff is a first-class feature to demo, not a failure state.

### Tier 2 - Pricing intelligence (the wow factor)

- We can upload/import the business's **pricing catalog** (products/services with rates). The assistant answers pricing questions from that data:
  - Simple: "How much is X per square metre?" / "What does a gutter replacement cost?"
  - **Complex / job-estimation:** "We've got a 200 square metre roof and want it replaced with [product]" - the assistant must work this out intelligently.
- **Follow-up question discipline (critical):** before answering a complex pricing question, the assistant judges whether it has enough information. If not, it asks follow-up questions - **maximum of two** - chosen smartly (e.g. desired material/product, roof pitch or complexity, whether other components like gutters/flashings should be included, or whether they just want a ballpark). It must never interrogate; two questions max, then it commits to an answer with clearly stated assumptions.
- Answers must show their working (area x rate, breakdown by component) and be labelled as indicative estimates, not formal quotes (compliance-safe framing).
- **The conversation does not end at the price.** The assistant funnels: offers to turn the estimate into an official pricing output / formal inquiry the business team can act on (capturing contact details), and/or suggests relevant additional products/services (e.g. "Most customers replacing at this size also upgrade gutters - want a price for that too?").

## 3. Demo experience requirements

1. **Landing page:** a clean, professional single-page site for "Apex Roofing" - hero, services, trust signals, contact section. (We already have Apex Roofing branding assets - blue #1769E0 / slate #1E293B palette and logo files - the builder should reuse or match them. If unavailable, create consistent branding; it is a fictitious brand.)
2. **Chat entry:** an obvious but elegant chat launcher (bubble bottom-right is fine) labelled as the Smart Assistant.
3. **Suggested starter prompts** (chips) so a cold visitor immediately sees what to ask - cover both tiers, e.g. "What services do you offer?", "Do you handle insurance work?", "How much to replace a 200m2 concrete tile roof?", "Are you open Saturdays?"
4. **Recordable:** every flow must work smoothly for screen-recording demos - typing, response latency (streaming, ChatGPT-style), follow-up questions, price breakdowns, inquiry handoff. No dead ends, no broken states.
5. **Demo labelling:** subtle "Interactive demo" marker so viewers know it's a showcase (must not be mistaken for a real roofing company).
6. **Seed content:** the builder must invent complete, realistic business info for Apex Roofing (services, areas, hours, FAQs) AND a realistic roofing pricing catalog (products: e.g. re-roofing by material, repairs, guttering, spouting, flashings, insulation; with per-m2 / per-linear-metre rates and component line items). Pricing data must be coherent so multi-component estimates add up correctly.
7. **Admin/story hook for sales:** include a simple way to show "this is trained on YOUR business" - e.g. a small panel or README describing where the business info and pricing catalog live, so a salesperson can say "we just load your data in".

## 4. Reference architecture (we have done this before - reuse the thinking)

We already run a production in-app assistant ("Q") built on this pattern. The demo does NOT need to replicate it exactly, but the external plan should respect these hard-won principles:

- **Server-side orchestration:** system prompt + business knowledge + pricing data assembled server-side; the model never receives untrusted "who am I" claims from the client. Chat runs through a streaming API route (SSE), not direct client-to-LLM calls (hides API keys, enables rate limiting + logging).
- **Grounded answers / anti-hallucination:** business knowledge and pricing live in structured files (JSON/Markdown knowledge base + structured catalog), passed as retrieval/context. Strict prompt rules: answer only from provided data; if unknown, say so and offer the human handoff. Never invent prices.
- **Estimation as data, not vibes:** job estimates computed from catalog data with explicit formula/breakdown in the reply. (Pure LLM arithmetic drifts - structure it.)
- **Follow-up discipline via prompt state machine:** instruct the model it may ask at most 2 clarifying questions for pricing requests before committing to an answer; track in conversation.
- **Cost/abuse guards:** per-session rate limiting, max message length, turn timeout, token budget cap. Public internet demo = assume abuse.
- **Clean separation:** knowledge base, pricing catalog, and prompt config are data files - this is what makes the product "bespoke per business" and is the core of the sales story. Swapping Apex's data for another business's data should be a file swap.

## 5. Technical constraints

- Modern stack of the builder's choosing, but: hosted easily (e.g. Next.js on Vercel), streaming responses, mobile-responsive (demos happen on phones too), fast cold start.
- LLM: use a strong conversational model via a provider with streaming (we use OpenAI-style APIs and GPT-class models; equivalent is fine).
- No auth required for demo visitors. Inquiry "submissions" can be captured to a log/store or simply simulated with a success state - but the flow must be complete and believable.
- Environment: API keys via server env vars only.

## 6. Deliverables

1. Deployed demo URL (staging is fine) with the Apex Roofing landing page + Smart Assistant.
2. Source repo (README covering setup, where the knowledge base and pricing catalog live, how to swap in another business's data).
3. A short "demo script" doc: 6-8 scripted example conversations (simple FAQ -> pricing -> complex estimate with follow-ups -> handoff/inquiry capture) ready for screen-recording.

## 7. Acceptance criteria (the demo is done when...)

- [ ] Visitor can ask 10 varied general business questions and get correct, grounded answers from the seed knowledge base.
- [ ] Off-knowledge question produces an honest "not sure" + clean human-handoff inquiry flow (name + contact captured, friendly confirmation).
- [ ] "200m2 roof replacement" style request triggers at most 2 smart follow-up questions, then a structured estimate with breakdown and assumptions, sourced from the pricing catalog.
- [ ] Estimate flow funnels onward: official inquiry offer and/or relevant product upsell, and the chat continues naturally.
- [ ] Simple pricing questions answered instantly from catalog data.
- [ ] Streaming responses, mobile-friendly, no API keys client-side, rate limited.
- [ ] Subtle "Interactive demo" labelling; Apex branding consistent.
- [ ] Swapping the business data files demonstrably rebrands/re-skills the assistant (even just documented).

## 8. Out of scope (for this demo phase)

- Real payments, real email/SMS sending, CRM integrations, multi-language, analytics dashboards, admin UI for data upload (a documented file-based data layer is enough for the demo; the sales story can promise the UI).
