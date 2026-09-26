/* STATIC checks only: registry/type parity, generation drift, and SQL safety
 * structure. This is NOT PostgreSQL execution, RLS proof or an EXPLAIN result. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const ts=require(process.env.TYPESCRIPT_PATH||'typescript');
const root=path.resolve(__dirname,'..');
const gen=spawnSync(process.execPath,[path.join(__dirname,'generate-sa-retrieval-sql.cjs'),'--check'],{encoding:'utf8'});
assert.equal(gen.status,0,gen.stderr);console.log(gen.stdout.trim());
const schema=JSON.parse(fs.readFileSync(path.join(root,'app/lib/smart-assistant/retrieval/schema.json'),'utf8'));
const buf=fs.readFileSync(path.join(root,'app/lib/supabase/database.types.ts'));
const text=buf[0]===255&&buf[1]===254?buf.toString('utf16le').replace(/^\ufeff/,''):buf.toString('utf8');
const ast=ts.createSourceFile('database.types.ts',text,ts.ScriptTarget.Latest,true);
const database=ast.statements.find(n=>ts.isTypeAliasDeclaration(n)&&n.name.text==='Database').type;
const member=(t,key)=>t.members?.find(m=>m.name?.getText(ast).replace(/^['"]|['"]$/g,'')===key)?.type;
const tables=member(member(database,'public'),'Tables');
const columns={};
for(const t of tables.members??[]){const row=member(t.type,'Row');if(row)columns[t.name.getText(ast)]=new Set(row.members.map(m=>m.name.getText(ast)));}
columns.assistant_v2_knowledge_scopes=new Set(['doc_id','company_id','required_sections','classified_at','classification_note']);
let expressions=0;
for(const [name,spec] of Object.entries(schema.sources)){
 const aliases={x:new Set(['line','ordinality'])};
 const fragments=[spec.from,spec.scope,...Object.values(spec.fields).flatMap(f=>f.sql?[f.sql]:[]),spec.targetKindSql??'',spec.sectionSql??''];
 for(const expr of fragments)for(const m of expr.matchAll(/(?:^|\b(?:FROM|JOIN)\s+)public\.([a-z_]+)\s+([a-z_]+)\b/gi)){
  assert.ok(columns[m[1]],`${name}: missing table ${m[1]} in generated types or additive metadata`);aliases[m[2]]=columns[m[1]];
 }
 for(const expr of fragments)for(const m of expr.matchAll(/\b([a-z_]+)\.([a-z_]+)\b/gi))if(aliases[m[1]]){expressions++;assert.ok(aliases[m[1]].has(m[2]),`${name}: ${m[1]}.${m[2]} is not an actual column`);}
 for(const [field,f] of Object.entries(spec.fields)){
  assert.ok(/^[a-z][a-z0-9_]*$/.test(field),`${name}: unsafe field identifier`);
  assert.ok(f.sql||f.engine,`${name}.${field}: missing implementation`);
  if(f.engine)assert.equal(name,'quotes','only existing quote engines are integrated');
  for(const dimension of f.dimensions??(f.dimension?[f.dimension]:[]))assert.ok(spec.fields[dimension],`${name}.${field}: missing dimension ${dimension}`);
 }
 for(const [relation,r] of Object.entries(spec.relations)){
  assert.ok(schema.sources[r.source],`${name}.${relation}: source`);
  assert.ok(spec.fields[r.local],`${name}.${relation}: local key`);
  assert.ok(schema.sources[r.source].fields[r.foreign],`${name}.${relation}: foreign key`);
 }
 assert.match(spec.scope,/company_id=\(\$1->>'company_id'\)::uuid/,`${name}: explicit trusted tenant predicate required`);
}
console.log(`PASS ${Object.keys(schema.sources).length} registered sources, ${expressions} physical-column references, field/relationship/dimension parity with supplied types.`);
const sql=fs.readFileSync(path.join(root,'backend/supabase/migrations/20260926150000_sa_v2_retrieval.sql'),'utf8');
const template=fs.readFileSync(path.join(__dirname,'sa-retrieval/retrieval.sql.in'),'utf8');
assert.doesNotMatch(sql,/__HASH__|__SCHEMA_JSON__/);
assert.equal((sql.match(/\$fn\$/g)||[]).length%2,0);
const definitions=[...template.matchAll(/CREATE FUNCTION public\.(\w+)\([^]*?(?=CREATE FUNCTION|COMMIT;|$)/g)];
assert.equal(definitions.length,16);
for(const [chunk,name] of definitions){
 assert.match(chunk,/SET search_path=pg_catalog,pg_temp/,name);
 assert.ok(template.includes(`REVOKE ALL ON FUNCTION public.${name}(`),`${name}: explicit PUBLIC revocation`);
}
for(const name of ['sa_v2_retrieval_query','sa_v2_retrieval_quote_inputs']){
 const chunk=definitions.find(([,n])=>n===name)?.[0];assert.ok(chunk);assert.match(chunk,/STABLE SECURITY INVOKER/);assert.match(chunk,/SET row_security=on/);assert.doesNotMatch(chunk,/SECURITY DEFINER/);
}
for(const needle of ["auth.role() IS DISTINCT FROM 'authenticated'",'public.sa_v2_speed_scope(p_run_id,p_revision)','retrieval_disabled','section_hidden','field_hidden','knowledge_disabled','catalogue_entitlement_disabled',"p_plan->'version' IS DISTINCT FROM '1'::jsonb",'EXECUTE query INTO rows USING v,p_plan,vals','EXISTS(SELECT 1 FROM (SELECT * FROM','LIMIT 201','jsonb_array_length(rows)>200','DEFAULT false','BEFORE UPDATE','AFTER INSERT OR UPDATE OR DELETE',"required_sections <@ ARRAY",'ORDER BY c.sort_order,c.id','ORDER BY l.sort_order,l.id','ORDER BY t.sort_order,t.created_at,t.id'])assert.ok(template.includes(needle),`required structure: ${needle}`);
assert.doesNotMatch(template,/CREATE OR REPLACE|DROP\s+(TABLE|FUNCTION)|TRUNCATE\b|ALTER\s+TABLE\s+public\.(quotes|users|assistant_turn_reservations)|INSERT INTO\s+public\.(quotes|invoices|material_orders)/i);
const forbidden=['sa_finish_run','sa_admit_run','assistant_turn_reservations','stripe_'];
const executable=template.replace(/--[^\n]*/g,'');for(const name of forbidden)assert.ok(!executable.includes(name),`locked infrastructure ${name}`);
console.log('PASS SQL structure and fixed-registry/parameter-binding checks. PostgreSQL parsing, schema deployment, grants, RLS, planner cost and results remain separate integration gates.');
