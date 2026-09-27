import json,zipfile,pathlib,difflib,os
r=pathlib.Path((os.environ.get('QC_ROOT') or str(pathlib.Path(__file__).resolve().parents[5])));z=zipfile.ZipFile(os.environ['QC_BASELINE']);out=pathlib.Path(os.environ.get('QC_VALIDATION',str(pathlib.Path(__file__).resolve().parents[1])));changes=[];diff=[]
orig={n[len('quotecore-plus/'):]:z.read(n) for n in z.namelist() if n.startswith('quotecore-plus/') and not n.endswith('/')}
for p in r.rglob('*'):
 if p.is_file() and p.relative_to(r).as_posix().startswith('app/') and (p.relative_to(r).as_posix() not in orig or p.read_bytes()!=orig[p.relative_to(r).as_posix()]):
  f=p.relative_to(r).as_posix();changes.append(f)
  a=orig.get(f,b'').decode('utf-8-sig').splitlines();b=p.read_text('utf-8-sig').splitlines();diff.extend(difflib.unified_diff(a,b,fromfile='baseline/'+f,tofile='return/'+f,lineterm=''))
(out/'production.diff').write_text('\n'.join(diff)+'\n')
(out/'source-check.json').write_text(json.dumps({'modified':[f for f in changes if f in orig],'added':[f for f in changes if f not in orig]},indent=2))
(out/'changed-paths.json').write_text(json.dumps([str(r/f) for f in changes],indent=2))
print(len(changes),'production paths')
for line in diff:
 if line.startswith('+') and ('—' in line or '&mdash;' in line): print('Added em dash',line)
