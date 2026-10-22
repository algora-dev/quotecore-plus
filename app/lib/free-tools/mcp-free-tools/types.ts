import type { AiScanData } from '@/app/lib/takeoff/applyAiResults';
import type { Job } from '@/app/(public)/measurement-to-quote-tool/measurement-model';
import type { ImageFrame, ImageStore, SourceFile } from '../host-roof-scan/types';

export const FREE_TOOLS_MCP_VERSION = 'qc-free-tools-mcp-v2' as const;
export type TakeoffTrade = 'roofing' | 'cladding' | 'flooring';
export type UnitSystem = 'metric' | 'imperial' | 'squares';


export interface NormalizedPoint { x: number; y: number }
export interface NormalizedOutline {
  name?: string;
  points: NormalizedPoint[];
  notes?: string[];
}

export interface WorkspaceAssetMeta {
  kind: 'image' | 'pdf';
  mimeType: 'image/png' | 'image/jpeg' | 'application/pdf';
  fileName: string;
  sha256: string;
  byteLength: number;
  frame: ImageFrame | null;
}

export interface WorkspaceSessionTicket {
  v: typeof FREE_TOOLS_MCP_VERSION;
  kind: 'workspace';
  expiresAt: number;
  objectKey: string;
  asset: WorkspaceAssetMeta;
  trade: TakeoffTrade;
  unitSystem: UnitSystem;
  outlineSuggestion: AiScanData | null;
}

export interface WorkspaceSessionData {
  trade: TakeoffTrade;
  unitSystem: UnitSystem;
  asset: WorkspaceAssetMeta;
  outlineSuggestion: AiScanData | null;
}

export interface MeasurementSessionTicket {
  v: typeof FREE_TOOLS_MCP_VERSION;
  kind: 'measurements';
  expiresAt: number;
  objectKey: string;
  sha256: string;
  byteLength: number;
  trade: TakeoffTrade;
  unitSystem: UnitSystem;
  measurementCount: number;
}

export interface MeasurementSessionData {
  job: Job;
  measurementCount: number;
  source: 'chatgpt-mcp';
}

export type FreeToolsSessionTicket = WorkspaceSessionTicket | MeasurementSessionTicket;

export interface WorkspaceAssetData {
  bytes: Buffer;
  mimeType: WorkspaceAssetMeta['mimeType'];
  fileName: string;
  byteLength: number;
}

export type { ImageStore, SourceFile };
