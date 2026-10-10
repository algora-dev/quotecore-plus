#!/usr/bin/env python3
"""Disposable PostgreSQL 16 contract + concurrency harness. Never accepts a DB URL.
Needs a local Docker image (default postgres:16). No production credentials.
No network, host port, or persistent database volume is attached.
"""
import argparse, concurrent.futures, json, os, pathlib, re, secrets, subprocess, sys, time, uuid
ROOT = pathlib.Path(__file__).resolve().parents[2]
def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--image', default='postgres:16', help='Locally available PostgreSQL 16 Docker image')
    parser.add_argument('--report', type=pathlib.Path)
    args = parser.parse_args()
    if not re.fullmatch(r'[a-zA-Z0-9._/:@-]+', args.image): parser.error('Invalid image name')
    if not __import__('shutil').which('docker'): parser.exit(2, 'Docker is required. No database tests were run.\n')
    name = 'quotecore-p2-' + secrets.token_hex(6)
    report = {'status':'failed', 'engine':args.image, 'scope':'synthetic relevant schema, not full live schema', 'checks':[]}
    def cmd(argv, text=None, checked=True, timeout=60):
        result = subprocess.run(argv,input=text,text=True,capture_output=True,timeout=timeout)
        if checked and result.returncode:
            raise RuntimeError(f'Command failed ({result.returncode}): {result.stderr[-6000:]}')
        return result
    def sql(text, checked=True):
        return cmd(['docker','exec','-i',name,'psql','-X','-q','-A','-t','-U','postgres','-v','ON_ERROR_STOP=1'],
                   "\\set VERBOSITY verbose\nSET statement_timeout='20s'; SET lock_timeout='10s';\n"+text,checked)
    def value(text):
        lines = sql(text).stdout.strip().splitlines()
        return lines[-1] if lines else ''
    def check(condition, label):
        if not condition: raise AssertionError(label)
        report['checks'].append(label)
    def new_company(overrides=None):
        overrides=overrides or {}
        return value("SELECT qcp_test.add_company(true,qcp_test.default_limits()||'"+json.dumps(overrides)+"'::jsonb);")
    def parallel(jobs):
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            return list(pool.map(lambda text:sql(text,False),jobs))
    started=False
    try:
        # Refuse implicit image pulls. The operator chooses/pulls the image first.
        cmd(['docker','image','inspect',args.image])
        cmd(['docker','run','--detach','--rm','--pull=never','--name',name,'--network','none',
             '--tmpfs','/var/lib/postgresql/data:rw','--env','POSTGRES_PASSWORD='+secrets.token_urlsafe(24),args.image])
        started=True
        for _ in range(60):
            if cmd(['docker','exec',name,'pg_isready','-U','postgres'],checked=False).returncode==0: break
            time.sleep(.5)
        else: raise RuntimeError('Disposable PostgreSQL did not become ready')
        sql((ROOT/'tests/billing-p2/sql/00-fixture-schema.sql').read_text())
        sql((ROOT/'tools/billing-p2/live-defs-overlay.sql').read_text())
        migrations=sorted((ROOT/'backend/supabase/migrations').glob('20261010*_p2.sql'))
        check(len(migrations)==5,'five ordered P2 migrations present')
        for path in migrations:
            sql(path.read_text()); report['checks'].append('migration compiled: '+path.name)
        sql((ROOT/'tests/billing-p2/sql/10-fixtures.sql').read_text())
        result=sql((ROOT/'tests/billing-p2/sql/20-contracts.sql').read_text())
        report['contract_output']=result.stdout.strip()
        report['sql_assertions']=int(value('SELECT count(*) FROM qcp_test.results;'))
        # Each call uses a separate PostgreSQL connection/process.
        co=new_company()
        jobs=[f"SELECT create_quote_atomic('{co}','{co}','{{\"customer_name\":\"Concurrent {i}\"}}');" for i in range(10)]
        results=parallel(jobs)
        check(sum(x.returncode==0 for x in results)==5,'concurrent quote admission: exactly five of ten')
        check(all(x.returncode==0 or 'P0002' in x.stderr for x in results),'quote refusals are quota errors, not deadlocks')
        check(value(f"SELECT count(*) FROM quotes WHERE company_id='{co}';")=='5','failed concurrent creates leave no quote rows')
        co=new_company()
        jobs=[f"SELECT qcp_begin_scan('{co}','acct_P2fixture','test','parallel-scan-{i}',repeat('a',64),'{{\"stage\":\"scan1\",\"quality\":\"high\"}}');" for i in range(8)]
        results=parallel(jobs)
        check(sum(x.returncode==0 for x in results)==4,'concurrent High scan reservations: exactly four within 50 tokens')
        check(all(x.returncode==0 or 'QCP02' in x.stderr for x in results),'scan refusals are quota errors, not deadlocks')
        check(value(f"SELECT qcp_usage_total('{co}',qcp_usage_context('{co}'),'scan');")=='48','scan usage cannot oversubscribe tokens')
        co=new_company()
        cvs=[value(f"SELECT qcp_test.new_conversation('{co}');") for _ in range(6)]
        results=parallel([f"SET test.uid='{co}'; SELECT row_to_json(r) FROM sa_admit_run('{cv}','Task {i}','parallel-task-{i}') r;" for i,cv in enumerate(cvs)])
        check(all(x.returncode==0 for x in results),'parallel task RPCs complete without SQL/deadlock error')
        admissions=[json.loads(x.stdout.strip().splitlines()[-1]) for x in results]
        check(sum(x['status']=='accepted' for x in admissions)==2,'concurrent tasks: exactly two accepted')
        check(sum(x.get('error_code')=='quota_exceeded' for x in admissions)==4,'remaining concurrent tasks refused as quota, not partially started')
        co=new_company()
        for i in range(6): sql(f"INSERT INTO storage.objects(bucket_id,name,metadata) VALUES('docs','{co}/concurrent-{i}.pdf','{{\"size\":60}}');")
        results=parallel([f"SELECT qcp_reserve_storage('{co}','acct_P2fixture','test','docs','{co}/concurrent-{i}.pdf',60);" for i in range(6)])
        check(sum(x.returncode==0 for x in results)==1,'concurrent finalizations: one 60-byte hold within 100-byte allowance')
        check(all(x.returncode==0 or 'QCP06' in x.stderr for x in results),'storage refusals are quota errors, not deadlocks')
        check(value(f"SELECT qcp_storage_pending_bytes('{co}');")=='60','concurrent pending storage bounded')
        report['status']='passed'
    except Exception as error:
        report['error']=str(error)
    finally:
        if started: cmd(['docker','rm','--force',name],checked=False)
    print(json.dumps(report,indent=2))
    if args.report:
        args.report.parent.mkdir(parents=True,exist_ok=True)
        args.report.write_text(json.dumps(report,indent=2)+'\n')
    return 0 if report['status']=='passed' else 1
if __name__=='__main__': sys.exit(main())

