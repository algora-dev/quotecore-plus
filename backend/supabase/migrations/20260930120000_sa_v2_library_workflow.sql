-- Smart Assistant library eligibility + measurement-first draft workflow.
-- Additive draft migration. Does not enable any feature flag by itself.

create table if not exists public.assistant_v2_library_profiles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  collection_id uuid not null references public.component_collections(id) on delete cascade,
  enabled boolean not null default false,
  include_all boolean not null default false,
  revision integer not null default 1 check (revision > 0),
  updated_by uuid null references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, collection_id)
);

create table if not exists public.assistant_v2_library_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  collection_id uuid not null references public.component_collections(id) on delete cascade,
  component_id uuid not null references public.component_library(id) on delete cascade,
  included boolean not null default true,
  assistant_role text null check (assistant_role is null or assistant_role in ('roof_area','ridge','hip','valley','barge','spouting','underlay','fixings')),
  is_default boolean not null default false,
  updated_by uuid null references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, collection_id, component_id)
);

create unique index if not exists assistant_v2_library_one_default_per_role
  on public.assistant_v2_library_members(company_id, collection_id, assistant_role)
  where included and is_default and assistant_role is not null;

create index if not exists assistant_v2_library_profiles_company_idx
  on public.assistant_v2_library_profiles(company_id, enabled);
create index if not exists assistant_v2_library_members_collection_idx
  on public.assistant_v2_library_members(company_id, collection_id, included, assistant_role);

create table if not exists public.assistant_v2_draft_briefs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  conversation_id uuid not null references public.smart_assistant_conversations(id) on delete cascade,
  revision integer not null default 1 check (revision > 0),
  status text not null default 'open' check(status in ('open','proposal','cancelled','closed')),
  permission_revision integer not null,
  brief jsonb not null check(jsonb_typeof(brief)='object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,user_id,conversation_id)
);
create index if not exists assistant_v2_draft_briefs_lookup_idx
  on public.assistant_v2_draft_briefs(company_id,user_id,conversation_id,status);

alter table public.assistant_v2_library_profiles enable row level security;
alter table public.assistant_v2_library_members enable row level security;
alter table public.assistant_v2_draft_briefs enable row level security;

drop policy if exists assistant_v2_library_profiles_company_scope on public.assistant_v2_library_profiles;
create policy assistant_v2_library_profiles_company_scope on public.assistant_v2_library_profiles
  for select using (company_id in (select u.company_id from public.users u where u.id=auth.uid()));

drop policy if exists assistant_v2_library_members_company_scope on public.assistant_v2_library_members;
create policy assistant_v2_library_members_company_scope on public.assistant_v2_library_members
  for select using (company_id in (select u.company_id from public.users u where u.id=auth.uid()));

drop policy if exists assistant_v2_draft_briefs_company_scope on public.assistant_v2_draft_briefs;
create policy assistant_v2_draft_briefs_company_scope on public.assistant_v2_draft_briefs
  for select using (user_id=auth.uid() and company_id in (select u.company_id from public.users u where u.id=auth.uid()));

-- Writes are intentionally service-side after the existing authenticated manager/run gates.
revoke all on public.assistant_v2_library_profiles from anon, authenticated;
revoke all on public.assistant_v2_library_members from anon, authenticated;
revoke all on public.assistant_v2_draft_briefs from anon, authenticated;
grant select on public.assistant_v2_library_profiles to authenticated;
grant select on public.assistant_v2_library_members to authenticated;
grant select on public.assistant_v2_draft_briefs to authenticated;

-- Keep role assignments honest: component and collection must belong to the same company.
create or replace function public.sa_v2_library_member_guard() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from public.component_collections c where c.id=new.collection_id and c.company_id=new.company_id) then
    raise exception 'collection_company_mismatch';
  end if;
  if not exists(select 1 from public.component_library c where c.id=new.component_id and c.collection_id=new.collection_id and c.company_id=new.company_id and c.is_active) then
    raise exception 'component_collection_mismatch';
  end if;
  new.updated_at=now();
  return new;
end;$$;
drop trigger if exists assistant_v2_library_member_guard on public.assistant_v2_library_members;
create trigger assistant_v2_library_member_guard before insert or update on public.assistant_v2_library_members for each row execute function public.sa_v2_library_member_guard();

create or replace function public.sa_v2_library_profile_guard() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from public.component_collections c where c.id=new.collection_id and c.company_id=new.company_id) then
    raise exception 'collection_company_mismatch';
  end if;
  if tg_op='UPDATE' and (new.enabled,new.include_all) is distinct from (old.enabled,old.include_all) then new.revision=old.revision+1; end if;
  new.updated_at=now();
  return new;
end;$$;
drop trigger if exists assistant_v2_library_profile_guard on public.assistant_v2_library_profiles;
create trigger assistant_v2_library_profile_guard before insert or update on public.assistant_v2_library_profiles for each row execute function public.sa_v2_library_profile_guard();

-- Extend the existing trusted P4 finisher for site address and repeated
-- measurement entries. Confirmation/proof/permission rules are unchanged.
create or replace function public.sa_v2_creation_finish(p_action_id uuid,p_user_id uuid,p_children jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare v jsonb:=public.sa_v2_actor_context(p_user_id); a public.assistant_v2_actions%rowtype; q public.quotes%rowtype; x jsonb; e jsonb; lib jsonb; matched integer;
begin
 select * into a from public.assistant_v2_actions where id=p_action_id and user_id=p_user_id and company_id=(v->>'company_id')::uuid for update;
 if not found or a.kind<>'draft_create' then raise exception 'not_found' using errcode='P0002'; end if;
 if a.status='committed' then return public.sa_v2_action_view(a); end if;
 if a.status<>'applying' or a.result_quote_id is null or p_children is distinct from a.payload->'children' then raise exception 'invalid_finish' using errcode='40001'; end if;
 perform 1 from public.users where id=p_user_id for share;
 perform 1 from public.assistant_section_permissions where company_id=a.company_id for share;
 perform 1 from public.assistant_v2_rollout where company_id=a.company_id for share;
 v:=public.sa_v2_actor_context(p_user_id);
 if (v->>'company_id')::uuid is distinct from a.company_id or (v->>'revision')::integer is distinct from a.permission_revision or not (v->>'p4')::boolean
   or exists(select 1 from unnest(a.sections) s where coalesce(v->'permissions'->>s,'hidden')<>'edit') then raise exception 'access_changed' using errcode='42501'; end if;
 select * into q from public.quotes where id=a.result_quote_id and company_id=a.company_id for update;
 if not found or q.created_by_user_id is distinct from p_user_id or q.status::text<>'draft' or q.acceptance_token is not null or q.entry_mode<>'manual'
   or q.customer_name is distinct from a.payload->'params'->>'customerName' or q.job_name is distinct from a.payload->'params'->>'jobName'
   or q.site_address is distinct from nullif(a.payload->'params'->>'siteAddress','')
   or q.measurement_system::text is distinct from a.payload->'params'->>'measurementSystem' or q.currency is distinct from a.payload->>'currency'
   or q.trade::text is distinct from a.payload->'params'->>'trade' or q.component_collection_id is distinct from (a.payload->'params'->>'componentCollectionId')::uuid
   or (q.global_pitch_degrees is not null and q.global_pitch_degrees is distinct from (a.payload->>'pitch')::numeric)
   or exists(select 1 from public.quote_components where quote_id=q.id) or exists(select 1 from public.quote_roof_areas where quote_id=q.id)
   then raise exception 'parent_changed' using errcode='40001'; end if;
 for lib in select z from jsonb_array_elements(a.snapshot->'libraries') z loop
   perform 1 from public.component_library where id=(lib->>'id')::uuid and company_id=a.company_id for share;
   if public.sa_v2_snapshot_private(a.company_id,'library',(lib->>'id')::uuid)->'library' is distinct from lib then raise exception 'library_changed' using errcode='40001'; end if;
 end loop;
 for x in select z from jsonb_array_elements(p_children->'areas') z loop
   insert into public.quote_roof_areas(id,quote_id,label,input_mode,final_value_sqm,calc_plan_sqm,calc_pitch_degrees,computed_sqm,sort_order,is_locked)
   values((x->>'id')::uuid,q.id,x->>'label',(x->>'input_mode')::public.input_mode,(x->>'final_value_sqm')::numeric,(x->>'calc_plan_sqm')::numeric,(x->>'calc_pitch_degrees')::numeric,(x->>'computed_sqm')::numeric,(x->>'sort_order')::integer,false);
 end loop;
 for x in select z from jsonb_array_elements(p_children->'components') z loop
   insert into public.quote_components(id,quote_id,quote_roof_area_id,component_library_id,name,component_type,measurement_type,input_mode,
     material_rate,labour_rate,waste_type,waste_percent,waste_fixed,pitch_type,calc_pitch_degrees,final_quantity,material_cost,labour_cost,priced_quantity,pack_size_snapshot,calc_audit,sort_order)
   values((x->>'id')::uuid,q.id,(x->>'area_id')::uuid,(x->>'library_id')::uuid,x->>'name',(x->>'component_type')::public.component_type,(x->>'measurement_type')::public.measurement_type,(x->>'input_mode')::public.input_mode,
     (x->>'material_rate')::numeric,(x->>'labour_rate')::numeric,(x->>'waste_type')::public.waste_type,(x->>'waste_percent')::numeric,(x->>'waste_fixed')::numeric,
     (x->>'pitch_type')::public.pitch_type,(x->>'calc_pitch_degrees')::numeric,(x->>'final_quantity')::numeric,(x->>'material_cost')::numeric,(x->>'labour_cost')::numeric,(x->>'priced_quantity')::numeric,(x->>'pack_size_snapshot')::numeric,x->'calc_audit',(x->>'sort_order')::integer);
   if jsonb_typeof(x->'entries')='array' then
     for e in select z from jsonb_array_elements(x->'entries') z loop
       insert into public.quote_component_entries(id,quote_component_id,raw_value,value_after_waste,pitch_degrees,sort_order)
       values((e->>'id')::uuid,(x->>'id')::uuid,(e->>'raw_value')::numeric,(e->>'value_after_waste')::numeric,(e->>'pitch_degrees')::numeric,(e->>'sort_order')::integer);
     end loop;
   else
     e:=x->'entry';
     insert into public.quote_component_entries(id,quote_component_id,raw_value,value_after_waste,pitch_degrees,sort_order)
     values((e->>'id')::uuid,(x->>'id')::uuid,(e->>'raw_value')::numeric,(e->>'value_after_waste')::numeric,(e->>'pitch_degrees')::numeric,0);
   end if;
 end loop;
 update public.quotes set global_pitch_degrees=(a.payload->>'pitch')::numeric,updated_at=clock_timestamp() where id=q.id and company_id=a.company_id;
 update public.sa_action_log set status='committed',payload_after=payload_after||jsonb_build_object('created_quote_id',q.id) where id=a.log_id and status='confirmed';
 get diagnostics matched=row_count; if matched<>1 then raise exception 'proof_not_committed' using errcode='40001'; end if;
 update public.assistant_v2_actions set status='committed',updated_at=clock_timestamp() where id=a.id returning * into a;
 return public.sa_v2_action_view(a);
end;$$;
revoke all on function public.sa_v2_creation_finish(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.sa_v2_creation_finish(uuid,uuid,jsonb) to service_role;

create or replace function public.sa_v2_creation_checkpoint(p_action_id uuid,p_user_id uuid,p_quote_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare a public.assistant_v2_actions%rowtype; q public.quotes%rowtype;
begin
 if auth.role()<>'service_role' then raise exception 'trusted_only' using errcode='42501'; end if;
 select * into a from public.assistant_v2_actions where id=p_action_id and user_id=p_user_id and kind='draft_create' for update;
 if not found or a.status<>'applying' then raise exception 'not_claimed' using errcode='40001'; end if;
 if a.result_quote_id is not null and a.result_quote_id<>p_quote_id then raise exception 'wrong_parent' using errcode='42501'; end if;
 select * into q from public.quotes where id=p_quote_id and company_id=a.company_id for update;
 if not found or q.created_by_user_id is distinct from p_user_id or q.status::text<>'draft' or q.entry_mode<>'manual'
   or q.customer_name is distinct from a.payload->'params'->>'customerName' or q.job_name is distinct from a.payload->'params'->>'jobName'
   or q.site_address is distinct from nullif(a.payload->'params'->>'siteAddress','')
   or q.measurement_system::text is distinct from a.payload->'params'->>'measurementSystem' then raise exception 'wrong_parent' using errcode='42501'; end if;
 update public.assistant_v2_actions set result_quote_id=p_quote_id,updated_at=clock_timestamp() where id=a.id returning * into a;
 update public.sa_action_log set entity_type='quote',entity_id=p_quote_id::text where id=a.log_id;
 return public.sa_v2_action_view(a);
end;$$;
revoke all on function public.sa_v2_creation_checkpoint(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.sa_v2_creation_checkpoint(uuid,uuid,uuid) to service_role;
