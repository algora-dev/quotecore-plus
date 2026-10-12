# Phase 3 — reliable outline sessions

Read [AGENT-INTEGRATION.md](AGENT-INTEGRATION.md) for application, staging setup, rollback and mandatory acceptance gates. Read [TEST-RESULTS.md](TEST-RESULTS.md) before interpreting local test counts.

The patch adds opt-in shared-store opaque references, direct review links, safe recovery, confirmed-snapshot reopening, reviewer-output schema parity and consistent bounded inline-image envelopes. It preserves the actual MCP tool workflow, canonical image checks, existing remote-file restrictions and human review.

Full repository gate: `node docs/plugins/host-roof-scan-phase3/verify.mjs --out /tmp/qcp-phase3-evidence`.

Storage helper is read-only by default: `node docs/plugins/host-roof-scan-phase3/reference-ops.mjs check`.

Never deploy output from the optional source-slice adapter helper. Never equate a serialized MCP image block with verified host-model vision.
