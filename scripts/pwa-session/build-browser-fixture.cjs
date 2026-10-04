/** Build ONLY a local test harness. Not a Next page and never deployed. */
const fs=require('node:fs'),path=require('node:path');
const ts=require(process.env.TYPESCRIPT_PATH || 'typescript');
const root=path.resolve(__dirname,'../..');
const output=process.argv[2];if(!output)throw Error('Supply an output filename outside the source tree.');
const files={'./resume-contract':'app/lib/auth/resume-contract.ts','./login-recovery':'app/lib/auth/login-recovery.ts'};
let bundle='const modules={},loaded={};function require(name){if(loaded[name])return loaded[name].exports;const m={exports:{}};loaded[name]=m;modules[name](m,m.exports,require);return m.exports;}\n';
for(const [name,file]of Object.entries(files)){
 const src=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 bundle+=`modules[${JSON.stringify(name)}]=function(module,exports,require){\n${src}\n};\n`;
}
bundle+='window.QcpRecovery=require("./login-recovery");\n';
fs.writeFileSync(output,bundle);
