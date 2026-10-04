/* Offline test loader: TypeScript transpilation only, no production bundling. */
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const original = Module._resolveFilename;
Module._resolveFilename = function (name, parent, ...rest) {
  return original.call(this, name.startsWith('@/') ? path.join(root, name.slice(2)) : name, parent, ...rest);
};
for (const ext of ['.ts', '.tsx']) {
  require.extensions[ext] = (module, filename) => {
    const content = fs.readFileSync(filename, 'utf8');
    const compiled = ts.transpileModule(content, { fileName: filename, compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX,
    } });
    module._compile(compiled.outputText, filename);
  };
}
