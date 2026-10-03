import type { AssistantConcept } from './vocabulary';
export type LibrarySettingsRow={id:string;name:string;enabled:boolean;includeAll:boolean;components:Array<{id:string;name:string;measurementType:string;takeoffSlot:string|null;included:boolean;conceptKey:string|null;isDefault:boolean}>};
export type WorkflowSettings={epoch:number;concepts:AssistantConcept[];libraries:LibrarySettingsRow[]};
