'use client';
import { createContext, useContext } from 'react';
export type JobSection = 'overview' | 'summary' | 'customer' | 'labor' | 'files' | 'activity';
export interface JobSpaceNavigation { active: JobSection; openSection: (section: JobSection, anchor?: string) => void }
export const JobSpaceContext = createContext<JobSpaceNavigation | null>(null);
export function useJobSpace() { return useContext(JobSpaceContext); }
export function isJobSection(value: string | null | undefined): value is JobSection {
  return !!value && ['overview','summary','customer','labor','files','activity'].includes(value);
}
