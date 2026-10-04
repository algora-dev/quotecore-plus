/** Serializable demo contracts. No server imports: safe for the guide/browser. */
export const DEMO_SEED_VERSION = 'qcp-v2.2-20261003';
export const DEMO_SESSION_MS = 24 * 60 * 60 * 1000;
export type DemoGuideChapter = 'pricing' | 'takeoff' | 'customer-quote' | 'smart-assistant' | 'complete';
export type DemoEvent = 'component.viewed' | 'component.created' | 'component.tested' | 'component.edited'
  | 'scan.loaded' | 'takeoff.saved' | 'quote.template' | 'quote.presentation'
  | 'quote.edited' | 'quote.previewed' | 'email.sent' | 'assistant.created'
  | 'assistant.edited' | 'assistant.found';
export type DemoSeedKey = 'guided_roof_job' | 'guided_takeoff_plan' | 'accepted_without_order'
  | 'guided_quote_customer' | 'qcp_quote_template' | 'qcp_demo_message_template'
  | 'seed_roofing_library' | 'seed_construction_library' | 'seed_flooring_library'
  | 'maintenance_component' | 'roof_covering' | 'roof_ridge' | 'roof_gutter';
export type DemoSeedManifest = Partial<Record<DemoSeedKey, string>>;
export type DemoAcknowledgement = { at: string; recordId?: string };
export type DemoGuideState = {
  version: 2;
  revision: number;
  welcomed: boolean;
  mode: 'guided' | 'explore';
  chapter: DemoGuideChapter;
  seed: DemoSeedManifest;
  acknowledgements: Partial<Record<DemoEvent, DemoAcknowledgement>>;
  guided_created_component_id?: string;
  guided_created_component_name?: string;
  guided_takeoff_job_id?: string;
  guided_takeoff_plan_id?: string;
  guided_quote_id?: string;
  assistant_quote_id?: string;
  assistant_quote_updated_at?: string;
  completed_at?: string;
};
export type ActiveDemoContext = {
  sessionId: string; anonUserId: string; companyId: string; expiresAt: string;
  activatedAt: string; ipHmac: string; tutorialState: DemoGuideState; resetCount: number;
};
export function initialDemoGuide(seed: DemoSeedManifest = {}): DemoGuideState {
  return { version: 2, revision: 0, welcomed: false, mode: 'explore', chapter: 'pricing', seed,
    acknowledgements: {}, guided_takeoff_job_id: seed.guided_roof_job,
    guided_takeoff_plan_id: seed.guided_takeoff_plan, guided_quote_id: seed.guided_roof_job };
}
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** Legacy increment state is deliberately not trusted as completion evidence. */
export function readGuide(value: unknown): DemoGuideState {
  if (!isRecord(value) || value.version !== 2 || !isRecord(value.seed) || !isRecord(value.acknowledgements)) {
    return initialDemoGuide();
  }
  const result = initialDemoGuide();
  const seedKeys: DemoSeedKey[] = ['guided_roof_job','guided_takeoff_plan','accepted_without_order','guided_quote_customer','qcp_quote_template','qcp_demo_message_template','seed_roofing_library','seed_construction_library','seed_flooring_library','maintenance_component','roof_covering','roof_ridge','roof_gutter'];
  for (const name of seedKeys) { const id = value.seed[name]; if (typeof id === 'string' && UUID.test(id)) result.seed[name] = id; }
  result.revision = typeof value.revision === 'number' && Number.isSafeInteger(value.revision) && value.revision >= 0 ? value.revision : 0;
  result.welcomed = value.welcomed === true;
  result.mode = value.mode === 'guided' ? 'guided' : 'explore';
  const chapters: DemoGuideChapter[] = ['pricing','takeoff','customer-quote','smart-assistant','complete'];
  if (chapters.includes(value.chapter as DemoGuideChapter)) result.chapter = value.chapter as DemoGuideChapter;
  const events: DemoEvent[] = ['component.viewed','component.created','component.tested','component.edited','scan.loaded','takeoff.saved','quote.template','quote.presentation','quote.edited','quote.previewed','email.sent','assistant.created','assistant.edited','assistant.found'];
  for (const event of events) {
    const entry = value.acknowledgements[event];
    if (!isRecord(entry) || typeof entry.at !== 'string' || !Number.isFinite(Date.parse(entry.at))) continue;
    result.acknowledgements[event] = { at: entry.at, ...(typeof entry.recordId === 'string' && UUID.test(entry.recordId) ? { recordId: entry.recordId } : {}) };
  }
  for (const name of ['guided_created_component_id','guided_takeoff_job_id','guided_takeoff_plan_id','guided_quote_id','assistant_quote_id'] as const) {
    const id = value[name]; if (typeof id === 'string' && UUID.test(id)) result[name] = id;
  }
  if (typeof value.guided_created_component_name === 'string') result.guided_created_component_name = value.guided_created_component_name.slice(0, 200);
  return result;
}
export function isSessionActive(status: string, expiresAt: string | null, now = Date.now()): boolean {
  return status === 'active' && expiresAt !== null && Number.isFinite(Date.parse(expiresAt)) && Date.parse(expiresAt) > now;
}
export function acknowledge(state: DemoGuideState, event: DemoEvent, recordId?: string, now = new Date().toISOString()): DemoGuideState {
  return { ...state, acknowledgements: { ...state.acknowledgements, [event]: { at: now, ...(recordId ? { recordId } : {}) } } };
}
