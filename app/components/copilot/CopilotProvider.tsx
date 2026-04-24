'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import type { CopilotState } from './types';
import { COPILOT_GUIDES } from './guides';

interface CopilotContextType {
  state: CopilotState;
  isActive: boolean;
  currentGuide: typeof COPILOT_GUIDES[number] | null;
  currentStepData: typeof COPILOT_GUIDES[number]['steps'][number] | null;
  totalSteps: number;
  toggle: () => void;
  startGuide: (guideId: string) => void;
  nextStep: () => void;
  prevStep: () => void;
  skipGuide: () => void;
  endCopilot: () => void;
}

const CopilotContext = createContext<CopilotContextType | null>(null);

export function useCopilot() {
  const ctx = useContext(CopilotContext);
  if (!ctx) throw new Error('useCopilot must be used within CopilotProvider');
  return ctx;
}

interface Props {
  children: ReactNode;
  userId: string;
  initialState: CopilotState | null;
}

export function CopilotProvider({ children, userId, initialState }: Props) {
  const [state, setState] = useState<CopilotState>(
    initialState || {
      enabled: true,
      activeGuide: null,
      currentStep: 0,
      guidesCompleted: [],
    }
  );

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Persist state to database
  const persist = useCallback(async (newState: CopilotState) => {
    try {
      await supabase.from('copilot_progress').upsert({
        user_id: userId,
        company_id: userId, // Will be overwritten by RLS but needed for insert
        copilot_enabled: newState.enabled,
        guides_completed: newState.guidesCompleted,
        current_guide: newState.activeGuide,
        current_step: newState.currentStep,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    } catch {
      // Silently fail — copilot state is non-critical
    }
  }, [supabase, userId]);

  const currentGuide = state.activeGuide
    ? COPILOT_GUIDES.find(g => g.id === state.activeGuide) || null
    : null;

  const currentStepData = currentGuide
    ? currentGuide.steps[state.currentStep] || null
    : null;

  const totalSteps = currentGuide?.steps.length || 0;

  const isActive = state.enabled && !!currentGuide && !!currentStepData;

  const toggle = useCallback(() => {
    const newState = {
      ...state,
      enabled: !state.enabled,
      // If disabling, also clear active guide
      ...(!state.enabled ? {} : { activeGuide: null, currentStep: 0 }),
    };
    setState(newState);
    persist(newState);
  }, [state, persist]);

  const startGuide = useCallback((guideId: string) => {
    const newState = { ...state, activeGuide: guideId, currentStep: 0, enabled: true };
    setState(newState);
    persist(newState);
  }, [state, persist]);

  const nextStep = useCallback(() => {
    if (!currentGuide) return;
    if (state.currentStep >= currentGuide.steps.length - 1) {
      // Guide complete
      const newCompleted = [...state.guidesCompleted, currentGuide.id].filter((v, i, a) => a.indexOf(v) === i);
      const newState = {
        ...state,
        guidesCompleted: newCompleted,
        activeGuide: null,
        currentStep: 0,
      };
      setState(newState);
      persist(newState);
    } else {
      const newState = { ...state, currentStep: state.currentStep + 1 };
      setState(newState);
      persist(newState);
    }
  }, [state, currentGuide, persist]);

  const prevStep = useCallback(() => {
    if (state.currentStep > 0) {
      const newState = { ...state, currentStep: state.currentStep - 1 };
      setState(newState);
      persist(newState);
    }
  }, [state, persist]);

  const skipGuide = useCallback(() => {
    const newState = { ...state, activeGuide: null, currentStep: 0 };
    setState(newState);
    persist(newState);
  }, [state, persist]);

  const endCopilot = useCallback(() => {
    const newState = { ...state, enabled: false, activeGuide: null, currentStep: 0 };
    setState(newState);
    persist(newState);
  }, [state, persist]);

  return (
    <CopilotContext.Provider value={{
      state, isActive, currentGuide, currentStepData, totalSteps,
      toggle, startGuide, nextStep, prevStep, skipGuide, endCopilot,
    }}>
      {children}
    </CopilotContext.Provider>
  );
}
