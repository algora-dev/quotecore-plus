# QuoteCore - Data Models

**Date:** 2026-03-30

## Overview

QuoteCore’s data model is one of the strongest and most complete parts of the project. It is centered on multi-tenant roofing quote configuration and quote lifecycle management.

## Core Tenancy Model

### `companies`
Represents each customer company using the SaaS.

### `users`
Represents authenticated users mapped to a company.

**Key relationship:**
- one company -> many users
- every user belongs to exactly one company in the current model

## Template Configuration Model

### `templates`
Reusable quote templates scoped to a company.

### `template_measurement_keys`
Defines the measurement inputs a template expects, such as area/linear/count/custom values.

### `template_item_groups`
Logical grouping of quote items inside a template.

### `template_items`
Individual pricing lines / logical quote ingredients.

### Configuration subtypes
- `template_area_configs`
- `template_direct_configs`
- `template_fixed_configs`

These allow template items to behave differently depending on calculation strategy.

### Additional template mechanics
- `template_modifiers`
- `template_item_modifier_links`
- `template_pitch_bands`
- `template_reroof_configs`

These support richer pricing behavior such as modifiers, pitch-based adjustments, and reroof scenarios.

## Quote Execution Model

### `quotes`
Top-level quote record.

### `quote_measurements`
Measurement inputs captured for a quote/version.

### `quote_items`
Calculated or configured lines that make up the quote.

### `quote_item_modifiers`
Modifier applications on quote lines.

### `quote_versions`
Version history / snapshot model.

### `customer_quote_views`
Customer-facing rendered quote representation metadata.

### `quote_attachments`
Attachments linked to quotes or quote versions.

### `quote_acceptances`
Acceptance tracking with public token support.

### `notifications`
Notification records for quote-related events.

## Global Extras Extension

Additional tables from `quotecore_global_extras_v1.sql`:
- `global_extras`
- `global_extra_area_configs`
- `global_extra_direct_configs`
- `global_extra_fixed_configs`

These extend the domain to reusable extras outside template-local definitions.

## Security / Access Model

The RLS SQL defines helper functions and policies for:
- current user resolution
- current company resolution
- company-based row access
- quote access checks
- template access checks

This indicates the app is intended to be strongly company-scoped at the database level, not just in UI logic.

## Observations

1. The schema is more advanced than the present UI.
2. Versioning and acceptance concepts are already designed, even if not yet fully surfaced in product UX.
3. The model is flexible enough to support manual-first quoting now and AI-assisted measurement ingestion later.
4. The domain already implies a serious quoting engine, not merely a simple price list app.

## Likely Near-Term Story Areas Derived From the Model

- complete quote creation flow
- measurement entry UX tied to `quote_measurements`
- item generation and totals presentation tied to pricing engine outputs
- customer quote publishing / acceptance path
- stronger admin settings and company profile flows

---

_Generated using BMAD Method `document-project` workflow_
