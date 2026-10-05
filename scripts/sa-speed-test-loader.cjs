/* Offline test transpiler, never loaded by application/runtime. Uses the project's
 * existing TypeScript dependency (or TYPESCRIPT_PATH in a restricted runner).
 * This executes tests; transpileModule is NOT a replacement for tsc/build. */
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require(process.env.TYPESCRIPT_PATH || 'typescript');
const root = path.resolve(__dirname, '..');
const mocks = new Map();
const originalResolve = Module._resolveFilename;
const originalLoad = Module._load;
Module._resolveFilename = function (name, parent, ...args) {
  if (name.startsWith('@/')) name = path.join(root, name.slice(2));
  return originalResolve.call(this, name, parent, ...args);
};
Module._load = function (name, parent, ...args) {
  if (name === 'server-only') return {};
  if (mocks.has(name)) return mocks.get(name);
  return originalLoad.call(this, name, parent, ...args);
};
for (const extension of ['.ts', '.tsx']) {
  Module._extensions[extension] = (module, filename) => {
    let text = fs.readFileSync(filename);
    text = text[0] === 0xff && text[1] === 0xfe ? text.toString('utf16le').replace(/^\ufeff/, '') : text.toString('utf8');
    const output = ts.transpileModule(text, { fileName: filename, compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } });
    module._compile(output.outputText, filename);
  };
}
module.exports = { mocks, root, ts };
