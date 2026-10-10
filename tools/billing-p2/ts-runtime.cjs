// Test-only TypeScript loader. No production module monkey-patching.
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const cp = require('node:child_process');
let ts;
try { ts = require('typescript'); }
catch { ts = require(path.join(cp.execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript')); }
const root = path.resolve(__dirname, '../..');
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function(request, parent, ...rest) {
  if (request.startsWith('@/')) request = path.join(root,request.slice(2));
  return originalResolve.call(this,request,parent,...rest);
};
require.extensions['.ts'] = require.extensions['.tsx'] = function(module, filename) {
  const source = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(source, {fileName:filename,reportDiagnostics:true,
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}});
  const errors = (compiled.diagnostics ?? []).filter(x=>x.category === ts.DiagnosticCategory.Error);
  if(errors.length) throw new Error(ts.formatDiagnostics(errors,{getCanonicalFileName:x=>x,getCurrentDirectory:()=>root,getNewLine:()=> '\n'}));
  module._compile(compiled.outputText,filename);
};
module.exports={root,ts};
