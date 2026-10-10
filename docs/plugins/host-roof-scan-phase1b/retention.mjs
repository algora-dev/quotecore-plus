#!/usr/bin/env node
// Extra staging-only guard around the existing narrow-prefix cleanup utility.
// It never creates or changes a scheduler. The operator must arrange staging execution.
import {config,ensurePrivateBucket} from './ops.mjs';
const args=process.argv.slice(2);
if(args.length!==1 || !['--dry-run','--execute'].includes(args[0])) throw new Error('Choose --dry-run or --execute explicitly.');
const c=config();
await ensurePrivateBucket(c);
await import('../host-roof-scan-phase1/purge-expired.mjs');
