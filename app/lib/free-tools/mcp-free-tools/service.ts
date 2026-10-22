import { createHash, randomUUID } from 'node:crypto';
import type { AiScanData } from '@/app/lib/takeoff/applyAiResults';
import { CONFIGS, TRADE_COPY, id as measurementId, newJob, newMeasurement, restoreJob, type Area, type Job, type Spec } from '@/app/(public)/measurement-to-quote-tool/measurement-model';
import type { TakeoffCurrency } from '@/app/(public)/free-roof-takeoff/takeoff-examples';
import { parseOutline } from '../host-roof-scan/geometry';
import { prepareRaster } from '../host-roof-scan/image';
import { downloadHostedFile } from '../host-roof-scan/fetch-file';
import { ScanError } from '../host-roof-scan/types';
import { WorkspaceTickets } from './tokens';
import {
  FREE_TOOLS_MCP_VERSION,
  type ImageStore,
  type NormalizedOutline,
  type SourceFile,
  type TakeoffTrade,
  type UnitSystem,
  type WorkspaceAssetData,
  type WorkspaceAssetMeta,
  type MeasurementSessionData,
  type MeasurementSessionTicket,
  type WorkspaceSessionData,
  type WorkspaceSessionTicket,
} from './types';

const TTL_MS = 30 * 60 * 1000;
const MAX_IMAGE_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_PDF_ATTACHMENT_BYTES = 50 * 1024 * 1024;
const MAX_MEASUREMENT_SESSION_BYTES = 512 * 1024;

export interface MeasurementPrefillInput {
  trade: TakeoffTrade;
  unitSystem: UnitSystem;
  currency?: TakeoffCurrency;
  title?: string;
  basis?: 'actual' | 'plan';
  measurements: Array<{
    componentName: string;
    measurementType?: 'area' | 'lineal' | 'quantity';
    value: number;
    areaName?: string;
    label?: string;
    repeat?: number;
    basis?: 'actual' | 'plan';
    pitchDegrees?: number;
  }>;
}

export interface FreeToolsMcpServiceOptions {
  origin: string;
  secret: string;
  store: ImageStore;
  allowedFileOrigins: string[];
  now?: () => number;
  fetchFile?: (url: string, allowedOrigins: readonly string[]) => Promise<Buffer>;
}

function stringField(value: unknown, label: string, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new ScanError('INVALID_INPUT', `${label} must be nonempty text, at most ${max} characters.`);
  return value.trim();
}

function sourceFile(value: unknown): SourceFile {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ScanError('FILE_TRANSFER_REQUIRED', 'Attach the plan to the ChatGPT message so the host can transfer it to QuoteCore+.');
  const file = value as Record<string, unknown>;
  const allowed = ['download_url', 'file_id', 'mime_type', 'file_name'];
  if (Object.keys(file).some(key => !allowed.includes(key)))
    throw new ScanError('INVALID_INPUT', 'The transferred file contains unsupported fields.');
  return {
    download_url: stringField(file.download_url, 'download_url', 8192),
    file_id: stringField(file.file_id, 'file_id', 512),
    ...(typeof file.mime_type === 'string' ? { mime_type: file.mime_type.slice(0, 100) } : {}),
    ...(typeof file.file_name === 'string' ? { file_name: file.file_name.slice(0, 255) } : {}),
  };
}

function normalizedOutline(value: unknown, frame: { width: number; height: number }): { outline: ReturnType<typeof parseOutline>; notes: string[] } {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ScanError('INVALID_INPUT', 'source_outline must be an object.');
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => !['name', 'points', 'notes'].includes(key)))
    throw new ScanError('INVALID_INPUT', 'source_outline contains unsupported fields.');
  if (!Array.isArray(input.points) || input.points.length < 3 || input.points.length > 160)
    throw new ScanError('INVALID_GEOMETRY', 'Provide 3 to 160 exterior vertices.');
  const points = input.points.map((raw, index) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
      throw new ScanError('INVALID_GEOMETRY', `Vertex ${index + 1} must contain x and y.`);
    const point = raw as Record<string, unknown>;
    if (Object.keys(point).some(key => !['x', 'y'].includes(key)) || typeof point.x !== 'number' || typeof point.y !== 'number' || !Number.isFinite(point.x) || !Number.isFinite(point.y))
      throw new ScanError('INVALID_GEOMETRY', `Vertex ${index + 1} must use finite normalized x/y coordinates.`);
    if (point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1)
      throw new ScanError('OUT_OF_BOUNDS', 'Normalized source coordinates must stay between 0 and 1.');
    return {
      x: point.x * Math.max(1, frame.width - 1),
      y: point.y * Math.max(1, frame.height - 1),
    };
  });
  const outline = parseOutline({
    name: typeof input.name === 'string' && input.name.trim() ? input.name.trim().slice(0, 80) : 'Exterior roof outline',
    points,
    pitch_degrees: null,
  }, frame);
  const notes = Array.isArray(input.notes)
    ? input.notes.filter((note): note is string => typeof note === 'string' && Boolean(note.trim())).slice(0, 6).map(note => note.trim().slice(0, 240))
    : [];
  return { outline, notes };
}

function outlineScan(outline: ReturnType<typeof parseOutline>, notes: string[]): AiScanData {
  return {
    scale: { detected: false, ratio: null, dimension_line: null },
    pitch: { detected: false, global_degrees: null },
    roof_areas: [{ name: outline.name, points: outline.points, pitch_degrees: null }],
    components: { ridges: [], hips: [], valleys: [], broken_hips: [], barges: [], spouting: [], uncertain: [] },
    notes: [
      'ChatGPT suggested the exterior roof footprint from the same attached source image. Review or edit it before relying on any quantity.',
      'Scale, pitch and internal roof components were not inferred.',
      ...notes,
    ].slice(0, 8),
  };
}

function inferMeasurementType(name: string): Spec['measurementType'] | null {
  const text = name.trim().toLowerCase();
  if (/\b(area|cover|covering|wrap|cladding|floor|flooring|underlay|soffit|batten)\b/.test(text)) return 'area';
  if (/\b(count|qty|quantity|opening|openings|item|items|fixing|fixings)\b/.test(text)) return 'quantity';
  if (/\b(ridge|hip|valley|barge|gutter|spouting|trim|skirting|scotia|transition|length|lineal|linear)\b/.test(text)) return 'lineal';
  return null;
}

function componentSpec(name: string, type: Spec['measurementType'], trade: TakeoffTrade): Spec {
  const lower = name.toLowerCase();
  const pitchEnabled = trade === 'roofing' && type !== 'quantity' && (type === 'area' || /\bhip\b|\bvalley\b|\bbarge\b/.test(lower));
  return {
    id: measurementId('component'), name, measurementType: type,
    materialRate: 0, labourRate: 0, pricingStrategy: 'per_unit', packPrice: null, packSize: null,
    wasteType: 'none', wasteValue: 0, pitchEnabled, pitchType: /\bhip\b|\bvalley\b/.test(lower) ? 'valley_hip' : 'rafter',
    pricingOrigin: 'user',
  };
}

function measurementJob(input: MeasurementPrefillInput): Job {
  const trade = input.trade;
  const units = trade === 'roofing' ? input.unitSystem : input.unitSystem === 'imperial' ? 'imperial' : 'metric';
  const defaultBasis = trade === 'roofing' ? (input.basis ?? 'actual') : 'actual';
  const job = newJob(trade, units, defaultBasis);
  if (input.currency) job.currency = input.currency;
  job.title = (input.title ?? '').trim().slice(0, 160);
  job.choice = 'custom';
  job.components = [];
  job.areas = [];
  const componentByKey = new Map<string, Spec>();
  const areaByKey = new Map<string, Area>();

  for (const [index, row] of input.measurements.entries()) {
    if (!Number.isFinite(row.value) || row.value <= 0 || row.value > 1e12) throw new ScanError('INVALID_INPUT', `Measurement ${index + 1} must be greater than zero.`);
    const name = row.componentName.trim().slice(0, 120);
    if (!name) throw new ScanError('INVALID_INPUT', `Measurement ${index + 1} needs a component name.`);
    const type = row.measurementType ?? inferMeasurementType(name);
    if (!type) throw new ScanError('MEASUREMENT_TYPE_REQUIRED', `Tell QuoteCore+ whether “${name}” is an area, lineal length or quantity.`);
    const componentKey = `${name.toLowerCase()}|${type}`;
    let component = componentByKey.get(componentKey);
    if (!component) {
      component = componentSpec(name, type, trade);
      componentByKey.set(componentKey, component);
      job.components.push(component);
      if (job.components.length > Math.max(CONFIGS[trade].placeholderComponents.length, CONFIGS[trade].maxCustomComponents))
        throw new ScanError('TOO_MANY_COMPONENTS', 'This free workflow supports fewer distinct component types. Split the job into smaller groups or combine like components.');
    }
    const areaName = (row.areaName ?? TRADE_COPY[trade].first).trim().slice(0, 160) || TRADE_COPY[trade].first;
    const areaKey = areaName.toLowerCase();
    let area = areaByKey.get(areaKey);
    if (!area) {
      area = { id: measurementId('area'), name: areaName, pitch: '', basis: defaultBasis, reference: null, components: [] };
      areaByKey.set(areaKey, area);
      job.areas.push(area);
      if (job.areas.length > 100) throw new ScanError('TOO_MANY_AREAS', 'This free workflow supports up to 100 areas or rooms per job.');
    }
    let assignment = area.components.find(item => item.componentId === component.id);
    if (!assignment) {
      assignment = { id: measurementId('group'), componentId: component.id, entries: [] };
      area.components.push(assignment);
    }
    const basis = trade === 'roofing' ? (row.basis ?? defaultBasis) : 'actual';
    if (basis === 'plan' && row.pitchDegrees != null) {
      if (!Number.isFinite(row.pitchDegrees) || row.pitchDegrees < 0 || row.pitchDegrees >= 90) throw new ScanError('INVALID_INPUT', `Measurement ${index + 1} pitch must be from 0° to less than 90°.`);
      if (!area.pitch) area.pitch = String(row.pitchDegrees);
    }
    const entry = newMeasurement(component.measurementType, basis);
    entry.a = String(row.value);
    entry.label = (row.label ?? '').trim().slice(0, 160);
    entry.repeat = String(row.repeat ?? 1);
    if (!Number.isInteger(Number(entry.repeat)) || Number(entry.repeat) < 1 || Number(entry.repeat) > 100000) throw new ScanError('INVALID_INPUT', `Measurement ${index + 1} repeat must be a positive whole number.`);
    if (basis === 'plan' && row.pitchDegrees != null) entry.pitchOverride = String(row.pitchDegrees);
    assignment.entries.push(entry);
    if (assignment.entries.length > 500) throw new ScanError('TOO_MANY_MEASUREMENTS', 'A component can contain at most 500 measurements in this free workflow.');
  }
  if (!job.areas.length) throw new ScanError('INVALID_INPUT', 'Provide at least one measurement to prefill the pricing workflow.');
  job.selectedAreaId = job.areas[0].id;
  const restored = restoreJob(JSON.stringify(job));
  if (!restored) throw new ScanError('INVALID_INPUT', 'The supplied measurements could not be represented safely in the existing pricing workflow.');
  return restored;
}

export class FreeToolsMcpService {
  readonly tickets: WorkspaceTickets;
  private readonly now: () => number;
  constructor(readonly options: FreeToolsMcpServiceOptions) {
    this.now = options.now ?? Date.now;
    this.tickets = new WorkspaceTickets(options.secret, this.now);
  }

  private objectKey(): string {
    const date = new Date(this.now()).toISOString().slice(0, 10);
    return `mcp-free-tools-v2/${date}/${this.now()}-${randomUUID()}`;
  }

  async startTakeoff(input: { plan: unknown; trade: TakeoffTrade; unitSystem?: UnitSystem; sourceOutline?: unknown }) {
    const file = sourceFile(input.plan);
    const raw = this.options.fetchFile
      ? await this.options.fetchFile(file.download_url, this.options.allowedFileOrigins)
      : await downloadHostedFile(file.download_url, this.options.allowedFileOrigins, {
          maxBytes: MAX_PDF_ATTACHMENT_BYTES,
          accept: 'image/png,image/jpeg,image/webp,application/pdf',
          userAgent: 'QuoteCore-Free-Tools-MCP/2.0',
          tooLargeMessage: 'Use a PDF plan under 50 MiB, or an image under 10 MiB.',
        });

    const isPdf = raw.subarray(0, 5).toString('ascii') === '%PDF-';
    let bytes: Buffer;
    let asset: WorkspaceAssetMeta;
    let outlineSuggestion: AiScanData | null = null;

    if (isPdf) {
      if (raw.length > MAX_PDF_ATTACHMENT_BYTES) throw new ScanError('FILE_TOO_LARGE', 'Use a PDF plan under 50 MiB.', 413);
      if (input.sourceOutline !== undefined)
        throw new ScanError('PDF_OUTLINE_UNSUPPORTED', 'For PDF plans, choose the page in QuoteCore+ first. Do not submit source_outline against a multi-page attachment.', 400);
      bytes = raw;
      const sha256 = createHash('sha256').update(bytes).digest('hex');
      asset = {
        kind: 'pdf',
        mimeType: 'application/pdf',
        fileName: file.file_name && /\.pdf$/i.test(file.file_name) ? file.file_name : 'plan.pdf',
        sha256,
        byteLength: bytes.length,
        frame: null,
      };
    } else {
      if (raw.length > MAX_IMAGE_ATTACHMENT_BYTES) throw new ScanError('FILE_TOO_LARGE', 'Use a PNG, JPEG or WebP plan image under 10 MiB.', 413);
      const prepared = await prepareRaster(raw, {
        uploadBytes: MAX_IMAGE_ATTACHMENT_BYTES,
        imageBytes: 2 * 1024 * 1024,
        imagePixels: 24_000_000,
        maxSide: 2000,
        minSide: 200,
        tooLargeMessage: 'Use a PNG, JPEG or WebP plan image under 10 MiB.',
      });
      bytes = prepared.bytes;
      if (input.sourceOutline !== undefined) {
        if (input.trade !== 'roofing') throw new ScanError('INVALID_INPUT', 'source_outline is currently supported only for roofing plans.');
        const proposal = normalizedOutline(input.sourceOutline, prepared.frame);
        outlineSuggestion = outlineScan(proposal.outline, proposal.notes);
      }
      asset = {
        kind: 'image',
        mimeType: prepared.frame.mimeType === 'image/jpeg' ? 'image/jpeg' : 'image/png',
        fileName: prepared.frame.mimeType === 'image/jpeg' ? 'plan.jpg' : 'plan.png',
        sha256: prepared.frame.sha256,
        byteLength: bytes.length,
        frame: prepared.frame,
      };
    }

    const objectKey = this.objectKey();
    await this.options.store.put(objectKey, bytes, asset.mimeType);
    const unitSystem = input.trade === 'roofing'
      ? (input.unitSystem ?? 'metric')
      : (input.unitSystem === 'imperial' ? 'imperial' : 'metric');
    const ticket: WorkspaceSessionTicket = {
      v: FREE_TOOLS_MCP_VERSION,
      kind: 'workspace',
      expiresAt: this.now() + TTL_MS,
      objectKey,
      asset,
      trade: input.trade,
      unitSystem,
      outlineSuggestion,
    };
    const token = this.tickets.issue(ticket);
    return {
      token,
      resultUrl: `${this.options.origin}/mcp-free-tools/workspace#session=${encodeURIComponent(token)}`,
      frame: asset.frame,
      assetKind: asset.kind,
      trade: input.trade,
      hasSuggestedOutline: Boolean(outlineSuggestion),
    };
  }

  async loadSession(token: unknown): Promise<WorkspaceSessionData> {
    const ticket = this.tickets.read(token);
    return {
      trade: ticket.trade,
      unitSystem: ticket.unitSystem,
      asset: ticket.asset,
      outlineSuggestion: ticket.outlineSuggestion,
    };
  }

  async loadAsset(token: unknown): Promise<WorkspaceAssetData> {
    const ticket = this.tickets.read(token);
    const bytes = await this.options.store.get(ticket.objectKey);
    if (bytes.length !== ticket.asset.byteLength || createHash('sha256').update(bytes).digest('hex') !== ticket.asset.sha256)
      throw new ScanError('IMAGE_CHANGED', 'The stored plan asset did not match this takeoff session.', 409);
    return { bytes, mimeType: ticket.asset.mimeType, fileName: ticket.asset.fileName, byteLength: bytes.length };
  }

  async startMeasurementsToPricing(input: MeasurementPrefillInput) {
    const job = measurementJob(input);
    const bytes = Buffer.from(JSON.stringify(job), 'utf8');
    if (bytes.length > MAX_MEASUREMENT_SESSION_BYTES) throw new ScanError('SESSION_TOO_LARGE', 'The measurement prefill is too large for one temporary pricing session.', 413);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const objectKey = this.objectKey();
    await this.options.store.put(objectKey, bytes, 'application/json');
    const ticket: MeasurementSessionTicket = {
      v: FREE_TOOLS_MCP_VERSION, kind: 'measurements', expiresAt: this.now() + TTL_MS,
      objectKey, sha256, byteLength: bytes.length, trade: job.trade, unitSystem: job.units,
      measurementCount: input.measurements.length,
    };
    const token = this.tickets.issue(ticket);
    return {
      token,
      resultUrl: `${this.options.origin}/measurement-to-quote-tool#mcpSession=${encodeURIComponent(token)}`,
      trade: job.trade,
      unitSystem: job.units,
      measurementCount: input.measurements.length,
    };
  }

  async loadMeasurementSession(token: unknown): Promise<MeasurementSessionData> {
    const ticket = this.tickets.readMeasurements(token);
    const bytes = await this.options.store.get(ticket.objectKey);
    if (bytes.length !== ticket.byteLength || createHash('sha256').update(bytes).digest('hex') !== ticket.sha256)
      throw new ScanError('SESSION_CHANGED', 'The stored measurement session did not match its signed reference.', 409);
    const job = restoreJob(bytes.toString('utf8'));
    if (!job || job.trade !== ticket.trade || job.units !== ticket.unitSystem)
      throw new ScanError('SESSION_CHANGED', 'The stored measurement session could not be validated.', 409);
    return { job, measurementCount: ticket.measurementCount, source: 'chatgpt-mcp' };
  }

}