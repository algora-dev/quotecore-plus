/** Parse the changed/new auth surface; NOT full semantic checking/build. */
const fs=require('node:fs'),path=require('node:path');
const ts=require(process.env.TYPESCRIPT_PATH || 'typescript');
const root=path.resolve(__dirname,'../..');
const existing=['middleware.ts','app/(auth)/assistant/page.tsx','app/login/page.tsx','app/login/actions.ts','app/actions.ts','app/2fa/page.tsx','app/2fa/TwoFactorChallengeForm.tsx','app/auth/callback/route.ts','app/components/auth/GoogleSignInButton.tsx','app/lib/supabase/cookie-config.ts','app/lib/supabase/cookie-batch.ts','app/api/auth-session-debug/route.ts'];
const added=['app/login/LoginClient.tsx','app/components/auth/LoginSessionRecovery.tsx','app/lib/auth/resume-contract.ts','app/lib/auth/login-recovery.ts','app/lib/auth/auth-errors.ts','app/lib/auth/session-probe.server.ts','app/lib/auth/session-trace.ts','app/api/auth/resume/route.ts'];
const files=[...existing,...added];const issues=[];
for(const file of files){const source=ts.createSourceFile(file,fs.readFileSync(path.join(root,file),'utf8'),ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);for(const d of source.parseDiagnostics)issues.push({file,code:d.code,message:ts.flattenDiagnosticMessageText(d.messageText,'\n')});}
const output={check:'TypeScript syntax only',files:files.length,paths:files,issues};
console.log(JSON.stringify(output,null,2));if(issues.length)process.exit(1);
