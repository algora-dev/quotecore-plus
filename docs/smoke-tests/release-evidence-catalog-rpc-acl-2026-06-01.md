# Release Evidence — Catalog RPC ACL Lockdown (C-01-R3)

**Date:** 2026-06-01
**Migration:** `20260601190000_catalog_rpc_revokes_and_byte_reversal.sql` (APPLIED to live DB, project `aaavvfttkesdzblttmby`)
**Context:** Gerald asked that the live ACL proof be retained with the release record before `development → main`.

## Query (via Supabase Management API SQL endpoint)
```sql
select p.proname, (ae.grantee::regrole)::text as grantee, ae.privilege_type
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
left join lateral aclexplode(p.proacl) ae on true
where n.nspname='public'
  and p.proname in ('adjust_company_storage','import_catalog_rows_atomic')
order by p.proname, grantee;
```

## Result (live, 2026-06-01)
| function | grantee | privilege |
|---|---|---|
| adjust_company_storage | postgres | EXECUTE |
| adjust_company_storage | service_role | EXECUTE |
| import_catalog_rows_atomic | postgres | EXECUTE |
| import_catalog_rows_atomic | service_role | EXECUTE |

## Interpretation
EXECUTE is held ONLY by `postgres` (owner) and `service_role`. No `anon`, no `authenticated`, no `PUBLIC`. The two SECURITY DEFINER catalog RPCs are not callable by any client role — C-01-R3 closed and verified live.
