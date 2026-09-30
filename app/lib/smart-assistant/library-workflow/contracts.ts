import type { AssistantSection } from '../section-permissions';

export const ASSISTANT_LIBRARY_ROLES = ['roof_area','ridge','hip','valley','barge','spouting','underlay','fixings'] as const;
export type AssistantLibraryRole = typeof ASSISTANT_LIBRARY_ROLES[number];

export type DraftMeasurement = {
  role: AssistantLibraryRole;
  entries: Array<{ quantity: number; unit: string }>;
  basis: 'plan' | 'actual';
  areaIndex: number | null;
};
export type DraftAreaBrief = {
  label: string;
  quantity: number;
  unit: 'm2'|'ft2'|'rs';
  basis: 'plan'|'surface';
  pitchDegrees: number | null;
};
export type DraftBrief = {
  customerName: string;
  jobName: string;
  siteAddress: string | null;
  measurementSystem: 'metric'|'imperial_ft'|'imperial_rs';
  defaultPitchDegrees: number;
  trade: string;
  collectionId: string | null;
  collectionName: string | null;
  areas: DraftAreaBrief[];
  measurements: DraftMeasurement[];
  selections: Record<string,string>;
};
export type WorkflowOption = { id:string; label:string; detail:string };
export type WorkflowQuestion = { key:string; label:string; role:AssistantLibraryRole; options:WorkflowOption[] };
export type WorkflowCard = {
  kind:'draft_workflow';
  title:string;
  stateId:string;
  revision:number;
  taskId:string;
  summary:string[];
  issues:string[];
  questions:WorkflowQuestion[];
};
export type DraftChoiceWire = { version:1; stateId:string; revision:number; selections:Record<string,string>; choice?:'apply'|'cancel' };
export type LibraryCatalogItem = {
  id:string; collectionId:string; collectionName:string; name:string; role:AssistantLibraryRole|null; isDefault:boolean;
  measurementType:string; takeoffSlot:string|null; unit:string; active:boolean;
};
export type WorkflowResult =
  | { state:'awaiting_input'; answer:string; card:WorkflowCard }
  | { state:'proposal'; answer:string; actionId:string }
  | { state:'cancelled'; answer:string }
  | { state:'blocked'; answer:string };
export const WORKFLOW_SECTIONS: AssistantSection[] = ['draft_quotes','customers','components'];
