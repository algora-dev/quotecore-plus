# Scaffold MDX files for the docs system. Idempotent: skips any file that
# already exists so re-running doesn't clobber written content.

$root = "$PSScriptRoot\..\content\docs"

$pages = @(
    @{ path = "getting-started/welcome.mdx";                       title = "Welcome";                            description = "What QuoteCore+ does and who it's for."; order = 1 }
    @{ path = "getting-started/sign-up-and-first-login.mdx";       title = "Sign up and first login";            description = "Create your account and get into the app."; order = 2 }
    @{ path = "getting-started/set-up-your-company.mdx";           title = "Set up your company";                description = "Logo, currency, units, taxes, and defaults."; order = 3 }
    @{ path = "getting-started/your-first-quote.mdx";              title = "Your first quote";                   description = "A five-minute walkthrough from blank quote to sent."; order = 4 }

    @{ path = "core-concepts/components-vs-extras.mdx";            title = "Components vs Extras";               description = "When to use a Main component, when to use an Extra."; order = 1 }
    @{ path = "core-concepts/templates-explained.mdx";             title = "Templates explained";                description = "Quote, customer quote, email, and labor sheet templates."; order = 2 }
    @{ path = "core-concepts/plan-vs-actual.mdx";                  title = "Plan vs Actual measurements";        description = "When to flip between plan and actual, and why."; order = 3 }
    @{ path = "core-concepts/waste-pitch-and-calculations.mdx";    title = "Waste, pitch, and calculations";     description = "How waste and pitch turn plan numbers into real-world numbers."; order = 4 }
    @{ path = "core-concepts/glossary.mdx";                        title = "Glossary";                           description = "Plain-English definitions for every term used in the app."; order = 5 }

    @{ path = "components/overview.mdx";                           title = "Components overview";                description = "What components are and how they fit into a quote."; order = 1 }
    @{ path = "components/creating-a-component.mdx";               title = "Creating a component";               description = "Step-by-step from blank form to saved component."; order = 2 }
    @{ path = "components/component-fields-reference.mdx";         title = "Component fields reference";         description = "Every field on the component form, what it does, when to use it."; order = 3 }
    @{ path = "components/building-your-library.mdx";              title = "Building your component library";    description = "How to think about your library so it scales with your business."; order = 4 }

    @{ path = "templates/quote-templates.mdx";                     title = "Quote templates";                    description = "Save the components you use on every job, load them in one click."; order = 1 }
    @{ path = "templates/customer-quote-templates.mdx";            title = "Customer quote templates";           description = "Logo, header, footer, disclaimers - the layout your customer sees."; order = 2 }
    @{ path = "templates/email-templates.mdx";                     title = "Email templates";                    description = "Stop typing the same email every time you send a quote."; order = 3 }
    @{ path = "templates/labor-sheet-templates.mdx";               title = "Labor sheet templates";              description = "Header and footer for the sheet your fixers see."; order = 4 }

    @{ path = "building-a-quote/manual-quote.mdx";                 title = "Manual quote (any trade)";           description = "Build a quote line-by-line without takeoff or pitch maths."; order = 1 }
    @{ path = "building-a-quote/manual-takeoff.mdx";               title = "Manual takeoff";                     description = "Use components and your own measurements without the digital takeoff tool."; order = 2 }
    @{ path = "building-a-quote/digital-takeoff.mdx";              title = "Digital takeoff";                    description = "Measure straight off a roof plan or aerial image."; order = 3 }
    @{ path = "building-a-quote/quote-builder.mdx";                title = "Quote builder";                      description = "Areas, components, extras, and review - what each phase does."; order = 4 }
    @{ path = "building-a-quote/quote-summary.mdx";                title = "Quote summary";                      description = "Your master view of the quote and everything you can do from it."; order = 5 }

    @{ path = "customer-facing/customer-quote-editor.mdx";         title = "Customer quote editor";              description = "Decide exactly what your customer sees, line by line."; order = 1 }
    @{ path = "customer-facing/sending-a-quote.mdx";               title = "Sending a quote";                    description = "Generate a URL, send the email yourself, or send through QuoteCore+."; order = 2 }
    @{ path = "customer-facing/acceptance-system.mdx";             title = "Acceptance system";                  description = "How accept, decline, and request-changes buttons work."; order = 3 }
    @{ path = "customer-facing/requote-requests.mdx";              title = "Requote requests";                   description = "What happens when a customer asks for changes."; order = 4 }
    @{ path = "customer-facing/withdrawing-a-quote.mdx";           title = "Withdrawing a quote";                description = "Pull a sent quote without deleting it."; order = 5 }
    @{ path = "customer-facing/follow-up-emails.mdx";              title = "Follow-up emails";                   description = "Auto emails for unanswered or declined quotes."; order = 6 }

    @{ path = "labor-and-installers/labor-sheet-editor.mdx";       title = "Labor sheet editor";                 description = "The version of the quote your fixers see."; order = 1 }
    @{ path = "labor-and-installers/sharing-with-fixers.mdx";      title = "Sharing with fixers";                description = "How to get the labor sheet onto site."; order = 2 }

    @{ path = "flashings/drawing-flashings.mdx";                   title = "Drawing flashings";                  description = "Build re-usable flashing drawings with measurements and angles."; order = 1 }
    @{ path = "flashings/uploading-flashings.mdx";                 title = "Uploading flashings";                description = "Use your own images instead of the drawing tool."; order = 2 }

    @{ path = "material-orders/overview.mdx";                      title = "Material orders overview";           description = "Send clean orders to suppliers without rewriting them by hand."; order = 1 }
    @{ path = "material-orders/custom-orders.mdx";                 title = "Custom orders";                      description = "Build an order from scratch, your own components, your own layout."; order = 2 }
    @{ path = "material-orders/order-from-quote.mdx";              title = "Order from a quote";                 description = "Turn a quote into an order without re-typing anything."; order = 3 }
    @{ path = "material-orders/supplier-templates.mdx";            title = "Supplier templates";                 description = "Different headers and footers for different suppliers."; order = 4 }

    @{ path = "files-and-storage/quote-files.mdx";                 title = "Quote files";                        description = "Roof plans, photos, and supporting docs attached to a quote."; order = 1 }
    @{ path = "files-and-storage/storage-tiers.mdx";               title = "Storage tiers";                      description = "How much you can store and how to free up space."; order = 2 }
    @{ path = "files-and-storage/payment-issues.mdx";              title = "Payment issues and storage";         description = "What happens to your data if a payment is missed."; order = 3 }

    @{ path = "account-and-billing/account-details.mdx";           title = "Account details";                    description = "Owner name, email, and what your customers see."; order = 1 }
    @{ path = "account-and-billing/company-settings.mdx";          title = "Company settings";                   description = "Logo, currency, default units, default margins, taxes."; order = 2 }
    @{ path = "account-and-billing/security-and-2fa.mdx";          title = "Security and 2FA";                   description = "Password, two-factor, recovery codes, recovery questions."; order = 3 }
    @{ path = "account-and-billing/notifications.mdx";             title = "Notifications";                      description = "Email alerts and the in-app Copilot toggle."; order = 4 }
    @{ path = "account-and-billing/billing-and-subscriptions.mdx"; title = "Billing and subscriptions";          description = "Your tier, payment dates, upgrades and downgrades."; order = 5 }
    @{ path = "account-and-billing/team-members.mdx";              title = "Team members";                       description = "Add team members and control what they can do."; order = 6; status = "coming-soon" }

    @{ path = "help-and-support/copilot.mdx";                      title = "Copilot";                            description = "The in-app guide. What it is, how it works, how to switch it on or off."; order = 1 }
    @{ path = "help-and-support/contact-support.mdx";              title = "Contact support";                    description = "How to reach us when something is broken or you're stuck."; order = 2 }
    @{ path = "help-and-support/faq.mdx";                          title = "FAQ";                                description = "Quick answers to the questions most people ask."; order = 3 }
    @{ path = "help-and-support/changelog.mdx";                    title = "Changelog";                          description = "What's new and what changed."; order = 4 }
)

# Section landing pages - these are the "Overview" pages that already exist
# in some sections. For sections without one, MDX renders the first page in
# the section as the section index. We don't auto-create section index files
# because most sections already have a natural overview page.

$created = 0
$skipped = 0

foreach ($p in $pages) {
    $full = Join-Path $root $p.path
    $dir = Split-Path $full -Parent
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    if (Test-Path $full) {
        $skipped++
        continue
    }

    $status = if ($p.ContainsKey('status')) { $p.status } else { "published" }

    $frontmatter = @"
---
title: $($p.title)
description: $($p.description)
order: $($p.order)
status: $status
updated: 2026-05-10
---

# $($p.title)

Placeholder. Content written in step 4.
"@

    Set-Content -Path $full -Value $frontmatter -Encoding UTF8
    $created++
}

Write-Host "Created: $created"
Write-Host "Skipped (already existed): $skipped"
