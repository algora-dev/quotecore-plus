/** Only the new self-contained offline suites. Does not replace full-project,
 * existing legacy, PostgreSQL, model, browser or installed-PWA acceptance. */
import { spawnSync } from 'node:child_process';
for (const name of ['test-smart-assistant-workflow-v1.cjs', 'test-smart-assistant-workflow-v1-services.cjs', 'test-pwa-push-v1.cjs', 'check-smart-assistant-workflow-v1-source.cjs']) {
 console.log(`\n=== ${name} ===`);
 const result = spawnSync(process.execPath, [`scripts/${name}`], { stdio: 'inherit', env: process.env });
 if (result.error || result.status !== 0) process.exit(result.status || 1);
}
console.log('\nNew OFFLINE suites passed. Mocks/static checks do not establish live correctness.');
