// Offline source checks for SA Phase 2b roof-area create/edit.
// Verifies the migration FILE and server wiring keep the propose->confirm
// safety properties that cannot be exercised without a live database:
//   * unconfirmed refusal: no business-row write exists in the propose path;
//     the ONLY apply is sa_v2_action_confirm_atomic behind digest+version+
//     status+run-completed+permission checks.
//   * idempotent re-apply: status<>'proposed' returns the existing view.
//   * rollout gating: area_change requires assistant_v2_rollout.p4.
//   * wrong-area/lost-target guards: row-count checks on area + entries.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { root } = require('./sa-speed-test-loader.cjs');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

const migration = 'backend/supabase/migrations/20260929193000_sa_v2_roof_area_edit.sql';
assert.ok(fs.existsSync(path.join(root, migration)), 'Phase 2b migration must exist');
const sql = read(migration);
assert.match(sql, /\bBEGIN\s*;/i);
assert.match(sql, /\bCOMMIT\s*;/i);
// Additive only: no drops of tables/functions, no deletions, no new quote/
// component writes beyond the byte-preserved P3/P4 branches inside the
// OR REPLACE confirm function (the quote_details/component_change UPDATE
// statements below are the original P3 body, unchanged).
assert.doesNotMatch(sql, /DROP\s+(TABLE|FUNCTION)/i);
assert.doesNotMatch(sql, /\bDELETE\s+FROM\b/i);
assert.doesNotMatch(sql, /INSERT\s+INTO\s+public\.(quotes|quote_components|quote_component_entries)\b/i);
assert.equal((sql.match(/UPDATE public\.quotes SET customer_name/g) || []).length, 1);
assert.equal((sql.match(/UPDATE public\.quote_components SET material_rate/g) || []).length, 1);
assert.equal((sql.match(/UPDATE public\.quote_component_entries SET raw_value/g) || []).length, 1);
assert.equal((sql.match(/UPDATE public\.quote_roof_areas SET label/g) || []).length, 1);
assert.equal((sql.match(/INSERT INTO public\.quote_roof_areas\(/g) || []).length, 1);
// Idempotent re-apply + confirmation authority.
assert.match(sql, /IF a\.status<>'proposed' THEN RETURN public\.sa_v2_action_view\(a\); END IF;/);
assert.match(sql, /IF a\.digest IS DISTINCT FROM p_digest OR a\.version IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'proof_changed'/);
assert.match(sql, /status='completed'[^;]*THEN RAISE EXCEPTION 'run_not_completed'/);
assert.match(sql, /confirmation_method='button',confirmed_by=p_user_id/);
// P4 rollout gate on both propose and confirm paths.
assert.match(sql, /p_action->>'kind' IN \('draft_create','area_change'\) AND NOT \(v->>'p4'\)::boolean/);
assert.match(sql, /IF a\.kind='area_change' AND NOT \(v->>'p4'\)::boolean/);
// Area apply: exact row guards + locked rows + snapshot conflict detection.
assert.match(sql, /quote_roof_areas WHERE id=a\.target_id AND quote_id=qid FOR UPDATE/);
assert.match(sql, /quote_roof_area_entries WHERE quote_roof_area_id=a\.target_id ORDER BY id FOR UPDATE/);
assert.match(sql, /UPDATE public\.quote_roof_areas SET label=\(f->>'label'\)::text/i);
assert.match(sql, /RAISE EXCEPTION 'lost_target' USING ERRCODE='40001'/);
assert.match(sql, /RAISE EXCEPTION 'lost_entry' USING ERRCODE='40001'/);
assert.match(sql, /current_snapshot IS DISTINCT FROM a\.snapshot/);
assert.match(sql, /status='conflict',error='The record changed or is no longer editable/i);
// Target kind extension + snapshot privacy (service-role only).
assert.match(sql, /CHECK\(kind IN \(''quote_details'',''component_change'',''draft_create'',''area_change''\)\)/);
assert.match(sql, /CHECK\(target_kind IN \(''quote'',''quote_component'',''creation'',''quote_area'',''quote_areas''\)\)/);
assert.match(sql, /takeoff_linked',EXISTS\(SELECT 1 FROM public\.quote_takeoff_measurements m WHERE m\.quote_roof_area_id=p_id\)/);
assert.match(sql, /REVOKE ALL ON FUNCTION public\.sa_v2_snapshot_private\(uuid,text,uuid\) FROM PUBLIC,anon,authenticated;/);
assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.sa_v2_snapshot_private\(uuid,text,uuid\) TO service_role;/);
// Precision preflight keeps the storage contract explicit.
assert.match(sql, /\('quote_roof_area_entries','sqm',2\)/);

const area = read('app/lib/smart-assistant/v2/area-plan.ts');
// Engine parity: computed values come from the existing engine, never re-implemented.
assert.match(area, /import \{ computeRoofArea, rafterPitchFactor \} from '@\/app\/lib\/pricing\/engine';/);
assert.doesNotMatch(area, /1\s*\/\s*Math\.cos/); // no second pitch implementation
assert.doesNotMatch(area, /Math\.(sin|tan)\(/);
// Takeoff refusal is enforced in the engine adapter, before any proposal is stored.
assert.match(area, /takeoff_linked === true/);
assert.match(area, /takeoff editor/);

const actions = read('app/lib/smart-assistant/v2/actions.server.ts');
// Proposals are stored via the existing journal; nothing is applied at propose time.
assert.match(actions, /proposeAreaChange/);
assert.match(actions, /proposeAreaCreate/);
assert.match(actions, /kind: 'area_change', target: \{ kind: q\.status === 'draft' \? 'draft_quote' : 'quote', id: String\(q\.id\) \}/);
assert.doesNotMatch(actions, /\.from\('quote_roof_areas'\)/); // no direct table writes outside the RPC journal

const tools = read('app/lib/smart-assistant/v2/tools.server.ts');
assert.match(tools, /access\.phases\.p4 && access\.permissions\.components === 'edit' && \['quotes', 'draft_quotes'\]\.some/);
assert.match(tools, /name: 'roof_area_list'/);
assert.match(tools, /registerProposal\('propose_roof_area_change'/);
assert.match(tools, /registerProposal\('propose_roof_area_add'/);
assert.match(tools, /never convert numbers yourself/);

const contracts = read('app/lib/smart-assistant/v2/contracts.ts');
assert.match(contracts, /'quote_details', 'component_change', 'draft_create', 'area_change'\]/);

console.log('PASS SA Phase 2b roof-area source/migration checks.');
