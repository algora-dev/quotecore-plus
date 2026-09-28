/* STATIC structure + byte protection. Not a SQL parser, policy test or build. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const sql=read('backend/supabase/migrations/20260928153000_sa_v2_task_context.sql'),code=sql.replace(/--[^\n]*/g,'');
assert.match(code,/^\s*BEGIN;/);assert.match(code,/COMMIT;\s*$/);
assert.doesNotMatch(code,/CREATE OR REPLACE|\bDROP\b|\bTRUNCATE\b|sa_finish_run|sa_admit_run|assistant_turn_reservations|stripe_/i);
const tables=[...code.matchAll(/CREATE TABLE public\.([a-z0-9_]+)/g)].map(m=>m[1]);assert.deepEqual(tables,['assistant_v2_task_context','assistant_v2_task_runs']);
for(const table of tables)assert.ok(code.includes(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`));
assert.ok(code.includes('REVOKE ALL ON public.assistant_v2_task_context,public.assistant_v2_task_runs FROM PUBLIC,anon,authenticated,service_role'));
assert.doesNotMatch(code,/CREATE POLICY|GRANT (?:SELECT|INSERT|UPDATE|DELETE|ALL)/i);
const funcs=[...code.matchAll(/CREATE FUNCTION public\.([a-z0-9_]+)\([^]*?\n\$\$;/g)].map(m=>({name:m[1],text:m[0]}));
assert.equal(funcs.length,8);
const authenticated=['sa_v2_task_snapshot','sa_v2_task_read','sa_v2_task_close','sa_v2_resolution_read_v172'],service=['sa_v2_task_begin','sa_v2_task_finish'];
for(const f of funcs){assert.ok(f.text.includes('SET search_path=pg_catalog,pg_temp'),f.name);assert.match(code,new RegExp('REVOKE ALL ON FUNCTION public\\.'+f.name+'\\([^;]+FROM PUBLIC,anon,authenticated,service_role'));
 const match=code.match(new RegExp('GRANT EXECUTE ON FUNCTION public\\.'+f.name+'\\([^;]+TO ([a-z_]+);'));
 assert.equal(match?.[1],authenticated.includes(f.name)?'authenticated':service.includes(f.name)?'service_role':undefined,f.name);
 if(f.name!=='sa_v2_task_view')assert.ok(f.text.includes('SECURITY DEFINER'),f.name+' is a scoped metadata function');
}
for(const text of ["auth.role() IS DISTINCT FROM 'service_role'","r.status NOT IN ('accepted','running')",'assistant_v2_run_scopes','p_knowledge_revision','p_revision','br.status=\'completed\'','br.id<>r.id',"v->>'history_after'","v->>'knowledge_history_after'",'FOR UPDATE','p_expected_task','p_expected_version',"ERRCODE='P1721'","ERRCODE='P1722'",'b.version=t.version','saved.id<>p_state_id',"interval '15 minutes'",'LIMIT 100'])assert.ok(code.includes(text),'missing boundary '+text);
for(const match of code.matchAll(/(?:INSERT INTO|UPDATE|DELETE FROM) public\.([a-z0-9_]+)/gi))assert.ok(tables.includes(match[1]),'unexpected write '+match[1]);
const manifest=JSON.parse(read('docs/sa-p172-2026-09-28/validation/BASELINE_PROTECTED.json'));
let migrationCount=0;
for(const f of manifest.files){const buf=fs.readFileSync(path.join(root,f.path)),raw=crypto.createHash('sha256').update(buf).digest('hex'),canonical=crypto.createHash('sha256').update(buf.toString('utf8').replace(/\r\n/g,'\n'),'utf8').digest('hex');assert.ok(raw===f.sha256||canonical===f.canonicalSha256,'unplanned drift '+f.path);if(f.path.startsWith('backend/supabase/migrations/'))migrationCount++;}
assert.equal(migrationCount,180);assert.ok(manifest.files.some(f=>f.path==='app/api/smart-assistant/turn/route.ts'));
const {root:loaderRoot}=require('./sa-speed-test-loader.cjs'),{SOURCE_ADAPTERS,identityFields,factFields}=require(path.join(loaderRoot,'app/lib/smart-assistant/resolver/sources.ts')),
 {DEFAULT_SECTION_PERMISSIONS}=require(path.join(loaderRoot,'app/lib/smart-assistant/section-permissions.ts')),registry=JSON.parse(read('app/lib/smart-assistant/retrieval/schema.json')),
 permissions=Object.fromEntries(Object.keys(DEFAULT_SECTION_PERMISSIONS).map(k=>[k,'edit']));
assert.equal(Object.keys(SOURCE_ADAPTERS).length,13);
for(const source of Object.keys(SOURCE_ADAPTERS))for(const fields of [identityFields(source,permissions),factFields(source,'cost',permissions)]){assert.ok(fields.length<=16);for(const field of fields)assert.ok(registry.sources[source].fields[field],source+'.'+field);}
console.log(`PASS ${manifest.files.length} baseline protected files, all ${migrationCount} original migrations, 13 bounded adapters and additive metadata structure. NOT live SQL/RLS or performance evidence.`);
