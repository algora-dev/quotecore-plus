-- QuoteCore+ company default language support
-- Story alignment: Epic 1 / Story 1.1 + 1.3
-- Purpose: store a default workspace/company language chosen during signup/bootstrap

alter table public.companies
  add column if not exists default_language text not null default 'en';

comment on column public.companies.default_language is
  'Default workspace/customer-facing language for the company. Set during signup/bootstrap and can be changed later.';

create index if not exists companies_default_language_idx
  on public.companies (default_language);
