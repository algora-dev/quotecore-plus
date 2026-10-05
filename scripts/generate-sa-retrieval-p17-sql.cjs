/** Offline generation only. This script never connects to a database. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const schema=JSON.parse(fs.readFileSync(path.join(root,'app/lib/smart-assistant/retrieval/schema.json'),'utf8'));
const hash=crypto.createHash('sha256').update(JSON.stringify(schema)).digest('hex');
const file='backend/supabase/migrations/20260926190000_sa_v2_retrieval_v17.sql';
const text=fs.readFileSync(path.join(__dirname,'sa-retrieval-p17/retrieval-v17.sql.in'),'utf8').replaceAll('__HASH__',hash);
const dest=path.join(root,file);
if(process.argv.includes('--check')){if(!fs.existsSync(dest)||fs.readFileSync(dest,'utf8').replace(/\r\n/g,'\n')!==text.replace(/\r\n/g,'\n'))throw Error('Generated P1.7 migration drift');}
else fs.writeFileSync(dest,text);
console.log(`${process.argv.includes('--check')?'Verified':'Generated'} P1.7 SQL draft; registry ${hash}. NOT APPLIED.`);
