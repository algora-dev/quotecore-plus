/** Offline syntax + migration STRUCTURE checks only. NOT tsc, SQL execution or RLS validation. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ts=require(process.env.TYPESCRIPT_PATH||'typescript');
const root=path.resolve(__dirname,'..');
const roots=['app/lib/assistant','app/lib/smart-assistant','app/api/smart-assistant','app/components/smart-assistant'];
const files=[];
function visit(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,item.name);if(item.isDirectory())visit(p);else if(/\.tsx?$/.test(p)&&!p.endsWith('.d.ts'))files.push(p);}}
for(const dir of roots)visit(path.join(root,dir));
let errors=0;
for(const fileName of files){const raw=fs.readFileSync(fileName);const text=raw[0]===0xff&&raw[1]===0xfe?raw.toString('utf16le'):raw.toString('utf8');const result=ts.transpileModule(text,{fileName,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,isolatedModules:true}});for(const d of result.diagnostics??[])if(d.category===ts.DiagnosticCategory.Error){errors++;console.error(path.relative(root,fileName),ts.flattenDiagnosticMessageText(d.messageText,' '));}}
assert.equal(errors,0,'TypeScript syntax diagnostics');
console.log(`PASS TypeScript/TSX syntax across ${files.length} assistant files (NOT semantic typing).`);
const sql=fs.readFileSync(path.join(root,'backend/supabase/migrations/20260925160000_sa_v2_speed_facts.sql'),'utf8');
assert.equal((sql.match(/CREATE FUNCTION /g)||[]).length,3);
assert.equal((sql.match(/SECURITY INVOKER/g)||[]).length,2);
assert.equal((sql.match(/SECURITY DEFINER/g)||[]).length,1);
assert.equal((sql.match(/SET search_path=pg_catalog,pg_temp/g)||[]).length,3);
assert.equal((sql.match(/REVOKE ALL ON FUNCTION/g)||[]).length,3);
assert.equal((sql.match(/\$\$/g)||[]).length,6);
const code=sql.replace(/--[^\n]*/g,'');
assert.doesNotMatch(code,/\b(?:INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|ALTER\s+TABLE|DROP\s+|TRUNCATE\s+|EXECUTE\s+['"])/i);
for(const s of ['sc.permission_revision=p_revision',"r.status IN ('accepted','running')",'q.created_by_user_id=auth.uid()',"p_kind NOT IN ('quote','draft_quote')","p_owner NOT IN ('workspace','me')",'LIMIT 501','LIMIT 101',"'complete',false",'BEGIN;','COMMIT;'])assert.ok(sql.includes(s),`Missing expected structural guard: ${s}`);
console.log('PASS additive SQL structure/allowlist checks. PostgreSQL parsing, deployment, grants/RLS and runtime results remain UNTESTED.');
