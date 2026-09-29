# Offline fixture evidence, not production modules

`browser/bundle.js` is a captured bundle of the actual source modules plus mocks listed in `browser/module-inventory.json`. It uses React and ReactDOM18.2.0 available from the installed JupyterLab distribution, not the application's locked React18.3.1/Next runtime. Utility CSS is compiled by locally available Tailwind4. Scope CSS is actual returned source. `browser/entry.js` contains synthetic records and action/transport spies only. Do not put these files in application routes, run their mocks against production or treat synthetic save replies as a DB acceptance test.

The filesystem paths inside the captured module keys record their source origin; they are identifiers inside the captured bundle, not runtime reads. Browser code has no real credentials. Original fixture builder is not required to view/run the captured specimens. `browser_harness.py` installs the scripts with set_content for offline tests, with mocked localStorage.

Real-user source can be inspected/merged from the production files; supplied screenshots use illustration-only company/sample pricing, not recommended rates. App runtime remains Gavin's gate.
