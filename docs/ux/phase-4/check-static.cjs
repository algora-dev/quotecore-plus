#!/usr/bin/env node
/* Read-only Phase-4 source/package checks. Does not start Next, execute feature
 * callbacks, install anything, or touch services/data. Run with the repository's
 * existing TypeScript dev dependency. Optional --baseline /path/to/incoming/repo. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const read = rel => fs.readFileSync(path.join(root, rel));
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const source = JSON.parse(fs.readFileSync(path.join(__dirname, 'SOURCE_CHANGE_MANIFEST.json')));
const preserved = JSON.parse(fs.readFileSync(path.join(__dirname, 'UNCHANGED_BASELINE_FILES.json')));
const report = { kind: 'STATIC_NOT_RUNTIME', hashMismatches: [], missingFiles: [], syntax: [], baselineComparisons: [] };
for (const entry of [...source.sourceFiles, ...preserved.files]) {
  try { if (sha(read(entry.path)) !== entry.sha256) report.hashMismatches.push(entry.path); }
  catch (error) { if (error.code !== 'ENOENT') throw error; report.missingFiles.push(entry.path); }
}
let ts;
try { ts = require('typescript'); } catch { report.syntaxUnavailable = 'TypeScript is not available. No packages were installed. Run again in Gavin\'s existing development environment.'; }
const arg = process.argv.indexOf('--baseline');
const baseline = arg < 0 ? null : process.argv[arg + 1];
if (arg >= 0 && !baseline) throw new Error('--baseline needs the extracted incoming quotecore-plus directory.');
if (ts) {
  const printer = ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed });
  function inspect(file, text) {
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const norm = n => printer.printNode(ts.EmitHint.Unspecified, n, sf).replace(/\s+/g, ' ').trim();
    const events = [], disabled = [], canvas = [];
    function visit(n) {
      if (ts.isJsxAttribute(n) && n.name.getText(sf).startsWith('on') && n.initializer) events.push([n.name.getText(sf), norm(n.initializer)]);
      if (ts.isJsxAttribute(n) && n.name.getText(sf) === 'disabled') disabled.push(norm(n.initializer));
      if (ts.isJsxSelfClosingElement(n) && n.tagName.getText(sf) === 'canvas') {
        let p = n.parent; const ancestors = [];
        while (p && ancestors.length < 2) { if (ts.isJsxElement(p)) ancestors.push(norm(p.openingElement)); p = p.parent; }
        canvas.push({ element: norm(n), ancestors: file.endsWith('TakeoffWorkstation.tsx') ? ancestors.map(a => a.replace('qc-takeoff-plan-border ', '').replace('qc-takeoff-canvas-scroll ', '')) : [] });
      }
      ts.forEachChild(n, visit);
    }
    visit(sf);
    const workstation = sf.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'TakeoffWorkstation');
    return { errors: sf.parseDiagnostics.map(d => ({ line: sf.getLineAndCharacterOfPosition(d.start).line + 1, message: ts.flattenDiagnosticMessageText(d.messageText, ' ') })), events, disabled, canvas,
      body: workstation ? workstation.body.statements.filter(n => !ts.isReturnStatement(n)).map(norm) : [] };
  }
  function missing(a, b) {
    const used = new Set();
    return a.filter(x => { const index = b.findIndex((y, i) => !used.has(i) && JSON.stringify(y) === JSON.stringify(x)); if (index < 0) return true; used.add(index); return false; });
  }
  for (const entry of source.sourceFiles.filter(e => e.path.endsWith('.tsx'))) {
    const current = inspect(entry.path, read(entry.path).toString());
    report.syntax.push({ path: entry.path, errors: current.errors });
    if (!baseline || entry.change !== 'modified') continue;
    const incomingBytes = fs.readFileSync(path.join(baseline, entry.path));
    if (sha(incomingBytes) !== entry.baselineSha256) throw new Error('Wrong incoming baseline: ' + entry.path);
    const old = inspect(entry.path, incomingBytes.toString());
    report.baselineComparisons.push({ path: entry.path, originalEvents: old.events.length, currentEvents: current.events.length,
      missingEvents: missing(old.events, current.events), addedEvents: missing(current.events, old.events),
      missingDisabled: missing(old.disabled, current.disabled), addedDisabled: missing(current.disabled, old.disabled),
      missingWorkstationStatements: missing(old.body, current.body), addedWorkstationStatements: missing(current.body, old.body),
      missingCanvasOrImmediateAncestors: missing(old.canvas, current.canvas) });
  }
  report.typescriptVersion = ts.version;
  report.canvasComparisonScope = 'All canvas expressions; for TakeoffWorkstation also its first two JSX element ancestors. PDF thumbnail button ancestors intentionally use the scoped C53 adapter and are not compared as workstation geometry. Only the two new presentation class hooks qc-takeoff-plan-border and qc-takeoff-canvas-scroll are ignored. Existing classes, elements and other attributes must match.';
}
report.passed = !report.hashMismatches.length && !report.missingFiles.length && !report.syntax.some(s => s.errors.length)
  && !report.baselineComparisons.some(c => c.missingEvents.length || c.missingDisabled.length || c.missingWorkstationStatements.length || c.missingCanvasOrImmediateAncestors.length);
report.limitations = 'Hash and syntax/source-expression checks only. No typecheck, React mount/focus/event test, Fabric accuracy, business-data persistence or app build is implied.';
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.passed && !report.syntaxUnavailable ? 0 : 1;
