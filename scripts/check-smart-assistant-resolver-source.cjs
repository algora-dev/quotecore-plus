/* STATIC checks only. No PostgreSQL parser, RLS, planner, browser or typecheck. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const gen=spawnSync(process.execPath,[path.join(__dirname,'generate-sa-resolver-sql.cjs'),'--check'],{encoding:'utf8'});
assert.equal(gen.status,0,gen.stdout+gen.stderr);console.log(gen.stdout.trim());
const sql=read('backend/supabase/migrations/20260927150000_sa_v2_resolver_v171.sql');
assert.doesNotMatch(sql,/__HASH__|__SCHEMA_JSON__/);
const query=sql.slice(sql.indexOf('CREATE FUNCTION public.sa_v2_retrieval_query_v171'),sql.indexOf('CREATE OR REPLACE FUNCTION public.sa_v2_retrieval_capabilities'));
assert.ok(query.length>5000);
for(const value of ['STABLE SECURITY INVOKER','SET row_security=on','SET search_path=pg_catalog,pg_temp','public.sa_v2_retrieval_scope(p_run_id,p_revision)','public.sa_v2_retrieval_check_source(source,v)','public.sa_v2_retrieval_field(source','USING v,p_plan,vals','LIMIT 201','filtered AS MATERIALIZED','aggregate_data AS MATERIALIZED','octet_length(result::text)>262144','r.search_text ILIKE ($3->>%s)','LIMIT 1501','catalogue_candidates>1500',"ERRCODE='P1711'","ERRCODE='P1712'"])assert.ok(query.includes(value),'missing query boundary: '+value);
const code=query.replace(/--[^\n]*/g,'');assert.doesNotMatch(code,/\b(?:INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER TABLE|SECURITY DEFINER)\b/i);
assert.ok(query.indexOf('INTO catalogue_candidates')<query.indexOf("predicate:=predicate||' AND ('||rank_sql"),'bound candidates before expensive rank predicate');
// The indexed necessary condition is valid only for imported cells. Default
// search must still mean search_text, not parent catalogue_name (not a cell).
const registry=JSON.parse(read('app/lib/smart-assistant/retrieval/schema.json'));
assert.deepEqual(registry.sources.catalogue_rows.searchFields,['search_text']);
assert.deepEqual(registry.sources.catalogue_rows.nameFields,['description']);
assert.match(query,/IN \('description','mapped_price_text','mapped_quantity_text'\)/);
assert.match(query,/IF rel->>'source'='catalogue_rows' THEN RAISE EXCEPTION/);
const meta=sql.slice(0,sql.indexOf('CREATE FUNCTION public.sa_v2_retrieval_query_v171'));
for(const text of ["auth.role() IS DISTINCT FROM 'service_role'",'r.status NOT IN (\'accepted\',\'running\')','permission_revision','assistant_v2_run_scopes',"interval '15 minutes'",'ON CONFLICT(run_id) DO NOTHING','saved.state IS DISTINCT FROM p_state','LIMIT 100','r.user_id=auth.uid()',"r.status='completed'",'s.expires_at>CURRENT_TIMESTAMP', "v->>'history_after'", "v->>'knowledge_history_after'"])assert.ok(meta.includes(text),'missing metadata boundary: '+text);
assert.match(meta,/REVOKE ALL ON public\.assistant_v2_resolution_states FROM PUBLIC,anon,authenticated,service_role/);
assert.match(meta,/GRANT EXECUTE ON FUNCTION public\.sa_v2_resolution_store\(uuid,uuid,integer,text\[\],jsonb\) TO service_role/);
assert.match(meta,/GRANT EXECUTE ON FUNCTION public\.sa_v2_resolution_read\(uuid,integer,uuid\) TO authenticated/);
assert.doesNotMatch(meta,/CREATE POLICY/);
assert.doesNotMatch(sql.replace(/--[^\n]*/g,''),/\b(?:sa_finish_run|sa_admit_run|assistant_turn_reservations|stripe_)\b/);
const manifest=JSON.parse(read('docs/sa-p171-2026-09-27/validation/LOCKED_FILES.json'));
// Gavin integration patch 2026-09-27: dual raw-or-canonical hash compare. Repo checks out LF-stored files as CRLF (autocrlf), so raw-only compare false-positives on identical content. Canonical match accepted; real content drift still fails both.
for(const f of manifest.files){const buf=fs.readFileSync(path.join(root,f.path));const raw=crypto.createHash('sha256').update(buf).digest('hex');const canon=crypto.createHash('sha256').update(buf.toString('utf8').replace(/\r\n/g,'\n'),'utf8').digest('hex');assert.ok(raw===f.sha256||canon===f.sha256,'protected raw baseline drift: '+f.path);}
console.log(`PASS ${manifest.files.length} protected baseline files raw byte-identical, including original migrations, admission route, model config, pricing and unrelated UX.`);
const {root:loaderRoot}=require('./sa-speed-test-loader.cjs');
const {SOURCE_ADAPTERS,identityFields,factFields}=require(path.join(loaderRoot,'app/lib/smart-assistant/resolver/sources.ts'));
const {DEFAULT_SECTION_PERMISSIONS}=require(path.join(loaderRoot,'app/lib/smart-assistant/section-permissions.ts'));
const permissions=Object.fromEntries(Object.keys(DEFAULT_SECTION_PERMISSIONS).map(k=>[k,'edit']));
assert.equal(Object.keys(SOURCE_ADAPTERS).length,13);
for(const source of Object.keys(SOURCE_ADAPTERS)){assert.ok(registry.sources[source]);for(const fields of [identityFields(source,permissions),factFields(source,'cost',permissions)]){assert.ok(fields.length<=16);for(const field of fields)assert.ok(registry.sources[source].fields[field],'unregistered '+source+'.'+field);}}
console.log('PASS 13 resolver adapters and bounded projections map to the existing 16-source registry.');
console.log('PASS P1.7.1 SQL/generation/static boundaries. Live SQL/RLS, EXPLAIN, timeout, semantic typecheck and browser behavior remain unverified.');
