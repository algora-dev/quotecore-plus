from pathlib import Path
import zipfile,hashlib,json,re,os
root=Path((os.environ.get('QC_ROOT') or str(Path(__file__).resolve().parents[5])));out=Path(os.environ.get('QC_VALIDATION',str(Path(__file__).resolve().parents[1])));zpath=Path(os.environ['QC_BASELINE'])
z=zipfile.ZipFile(zpath);orig={n[len('quotecore-plus/'):]:z.read(n) for n in z.namelist() if n.startswith('quotecore-plus/') and not n.endswith('/')};current={p.relative_to(root).as_posix():p.read_bytes() for p in root.rglob('*') if p.is_file()};H=lambda b:hashlib.sha256(b).hexdigest()
changed=[p for p in orig if current.get(p)!=orig[p]];missing=[p for p in orig if p not in current]
scope=json.loads((out/'source-check.json').read_text());allowed=set(scope['modified']);checks=[]
def ck(name,passed,detail):checks.append({'name':name,'passed':bool(passed),'detail':detail})
protected={p:b for p,b in orig.items() if (p.startswith(('app/lib/','app/api/','app/(marketing)/','supabase/','prisma/','app/components/workspace/')) or re.search(r'(^|/)(actions[^/]*\.tsx?|.*-actions\.ts|middleware\.ts|package[^/]*\.json|next\.config\.[^/]+|tsconfig\.json)$',p) or any(t in p.lower() for t in ['/takeoff','smartassistant','smart-assistant','/precision','/touch','/pricing/','/build/','/blank-build/','/billing/','/entitlement','/onboarding/','/auth/','/publicinvoiceview','/orderbody','/documentselection','/documentheader','quotepreview','invoicepreview','customerquoteeditor','invoiceeditor','orderlinebylineeditor','/customer-edit/','/summary/','/accept/','/message-templates/','/emailtemplateeditor','/conversions.ts','/mainqcp','/q-mark.png']) or p.endswith(('package.json','package-lock.json')))}
ck('All baseline repository paths retained',not missing,{'originalFiles':len(orig),'missing':missing})
ck('Only the approved 24 existing production files changed',all(p in allowed for p in changed if p.startswith('app/')),{'modifiedProduction':len([p for p in changed if p.startswith('app/')]),'unexpected':[p for p in changed if p.startswith('app/') and p not in allowed]})
ck('Protected files are raw-byte identical',all(current.get(p)==b for p,b in protected.items()),{'count':len(protected),'mismatches':[p for p,b in protected.items() if current.get(p)!=b]})
w='app/(auth)/[workspaceSlug]/';catalog=w+'catalogs/catalog-list.tsx';s=current[catalog].decode('utf-8');b=orig[catalog].decode('utf-8')
ck('Catalogue locked Actions column retained',('190px' in s and s.count('190px')==b.count('190px')),{'width':'190px'})
q=current[w+'quotes/QuotesList.tsx'].decode('utf-8');ck('Removed Resource Library button stays absent','Resource Library' not in q,{'route':'quotes'})
legacy=current[w+'resources/new/page.tsx'].decode('utf-8');ck('Legacy resources/new redirects to unified library','redirect(`/${workspaceSlug}/resources/document-templates`)' in legacy and 'createTemplate' not in legacy,{'authorizedException':'obsolete route only; no shared server action changed'})
form=current[w+'quotes/new/QuoteDetailsForm.tsx'].decode('utf-8');bf=orig[w+'quotes/new/QuoteDetailsForm.tsx'].decode('utf-8').replace('\r\n','\n');
ck('Generic Trades submit payload preserved',form[form.index('const result = await createQuoteWithDetails'):form.index('// Structured failure path:')]==bf[bf.index('const result = await createQuoteWithDetails'):bf.index('// Structured failure path:')],{'responsiveChange':'Industry/collection controls stack at narrow widths; options/flags/state/payload unchanged'})
old=bf[bf.index('{/* Phase 8 (Generic Trades)'):bf.index('<label',bf.index('{/* Phase 8 (Generic Trades)'))];
# Source string preserving option values and disabled predicates, independent of formatting.
options=lambda t: re.findall(r'<option\b[^>]*value=([^>]+)>',t)
ck('New Quote option values preserved',options(form)==options(bf),{'optionCount':len(options(form))})
raw=current['app/lib/supabase/database.types.ts'];ck('Database types encoding untouched',raw==orig['app/lib/supabase/database.types.ts'] and raw[:2]==b'\xff\xfe',{'encoding':'UTF-16LE BOM'})
# Original member body is deliberately retained despite changing its dialog wrapper.
security=current[w+'settings/SecurityQuestionsSection.tsx'].decode('utf-8');ck('Security delete retains existing action (no fabricated success)', 'deleteSecurityQuestion(slot)' in security and 'showNotice' not in security,{'backendLimitation':'deleteSecurityQuestion returns void and does not inspect provider error; runtime owner must resolve'})
files=[{'path':p,'sha256':H(b)} for p,b in sorted(protected.items())]
(out/'protected-files.json').write_text(json.dumps({'hashConvention':'SHA-256 raw bytes, including BOM/line endings','files':files},indent=2))
(out/'invariant-report.json').write_text(json.dumps({'baselineZip':zpath.name,'baselineZipSha256':H(zpath.read_bytes()),'checks':checks},indent=2))
(out/'baseline-changed-source.json').write_text(json.dumps({p:orig[p].decode('utf-8-sig') for p in allowed},ensure_ascii=False))
print('Passed',sum(c['passed'] for c in checks),'/',len(checks),'protected',len(protected))
for c in checks:
 if not c['passed']:print(c)
if not all(c['passed'] for c in checks):raise SystemExit(1)
