/* STATIC structure/unchanged-file checks ONLY. Not SQL parsing, execution, RLS,
 * business fixture correctness, planner cost, browser E2E, or a typecheck. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
for(const script of ['generate-sa-retrieval-sql.cjs','generate-sa-retrieval-p17-sql.cjs']){const r=spawnSync(process.execPath,[path.join(__dirname,script),'--check'],{encoding:'utf8'});assert.equal(r.status,0,r.stdout+r.stderr);console.log(r.stdout.trim());}
const sql=read('backend/supabase/migrations/20260926190000_sa_v2_retrieval_v17.sql');
assert.doesNotMatch(sql,/__HASH__|__SCHEMA_JSON__/);assert.equal((sql.match(/\$fn\$/g)||[]).length,4);
const defs=[...sql.matchAll(/CREATE(?: OR REPLACE)? FUNCTION public\.(\w+)\([^]*?(?=CREATE(?: OR REPLACE)? FUNCTION|COMMIT;|$)/g)];
assert.deepEqual(defs.map(d=>d[1]),['sa_v2_retrieval_query_v17','sa_v2_retrieval_capabilities']);
for(const [body,name] of defs){assert.match(body,/STABLE SECURITY INVOKER/);assert.match(body,/SET search_path=pg_catalog,pg_temp/);assert.doesNotMatch(body,/SECURITY DEFINER/);assert.ok(sql.includes(`REVOKE ALL ON FUNCTION public.${name}(`));assert.ok(sql.includes(`GRANT EXECUTE ON FUNCTION public.${name}(`));}
const query=defs[0][0];
for(const needle of ['SET row_security=on','public.sa_v2_retrieval_scope(p_run_id,p_revision)','public.sa_v2_retrieval_check_source(source,v)','public.sa_v2_retrieval_field(source','EXECUTE query INTO result USING v,p_plan,vals','EXISTS(SELECT 1 FROM (SELECT * FROM','LIMIT 201','jsonb_array_length(rows)>200',"numeric_ranking_requires_definite_membership",'filtered AS MATERIALIZED','aggregate_data AS MATERIALIZED','FROM aggregate_data a',"''matchedRows''","''missingValues''","''dimensionCount''","''_tie_count''","jsonb_array_elements_text(input_fields||rank_dimensions)","search_json->>'field'",'octet_length(result::text)>262144'])assert.ok(query.includes(needle),`missing structural guard: ${needle}`);
const executable=sql.replace(/--[^\n]*/g,'');assert.doesNotMatch(executable,/\b(?:INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER TABLE|SECURITY DEFINER)\b/i);
for(const name of ['sa_finish_run','sa_admit_run','assistant_turn_reservations','stripe_'])assert.ok(!executable.includes(name),`locked protocol ${name}`);
assert.equal((sql.match(/CREATE OR REPLACE FUNCTION/g)||[]).length,1,'only compatible capabilities reader replaced');
const manifest=path.join(root,'docs/sa-p17-2026-09-26/validation/LOCKED_FILES.json');
if(fs.existsSync(manifest)){
 const records=JSON.parse(fs.readFileSync(manifest,'utf8')).files;
 for(const record of records){const bytes=fs.readFileSync(path.join(root,record.path));const raw=crypto.createHash('sha256').update(bytes).digest('hex');/* integrator fix: manifest hashes were generated on a CRLF checkout while the repo ships LF; accept raw or CRLF-canon of LF-normalized content (any real content change still fails) */const canon=crypto.createHash('sha256').update(Buffer.from(bytes.toString('utf8').replace(/\r\n/g,'\n').replace(/\n/g,'\r\n'),'utf8')).digest('hex');assert.ok(raw===record.sha256||canon===record.sha256,`locked baseline drift: ${record.path}`);}
 console.log(`PASS ${records.length} locked baseline files byte-for-byte unchanged.`);
}else console.log('Locked-file manifest not yet emitted: run again after packaging preparation.');
console.log('PASS P1.7 SQL/template/static guards. PostgreSQL parsing, real RLS, semantic results, scale and effective cancellation NOT established by this check.');
const ts=require(process.env.TYPESCRIPT_PATH||'typescript');
for(const file of ['app/(auth)/[workspaceSlug]/quotes/[id]/quote-builder.tsx','app/(auth)/[workspaceSlug]/quotes/[id]/quote-builder/ExpandableComponent.tsx']){
 const diagnostics=ts.transpileModule(read(file),{fileName:file,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2017,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.Preserve}}).diagnostics??[];
 assert.equal(diagnostics.filter(d=>d.category===ts.DiagnosticCategory.Error).length,0,`${file}: syntax diagnostics`);
}
console.log('PASS syntax of two existing quote components with the minimal focus bridge (NOT full semantic typechecking).');
