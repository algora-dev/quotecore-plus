import type { ShellMode } from './shell-config';

export type SidebarPreference = 'expanded' | 'hidden';
export interface SidebarOverride {
  path: string;
  mode: SidebarPreference;
  /** Retain the visible panel width while it slides out. Never a public third state. */
  presentation: 'expanded' | 'rail';
}
/** Older users may have saved rail. Migrate in memory, never restore a rail button. */
export function readSidebarPreference(saved: string | null): SidebarPreference {
  return saved === 'hidden' ? 'hidden' : 'expanded';
}
export function resolveSidebarMode(path: string, defaultMode: ShellMode, preference: SidebarPreference, override: SidebarOverride | null): ShellMode {
  if (override?.path === path) return override.mode;
  return defaultMode === 'expanded' ? preference : defaultMode;
}
export function nextSidebarMode(current: ShellMode): SidebarPreference {
  return current === 'hidden' ? 'expanded' : 'hidden';
}
