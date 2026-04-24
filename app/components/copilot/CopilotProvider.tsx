'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
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
  nextStep: () => void;
  prevStep: () => void;
  skipGuide: () => void;
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
  const pathname = usePathname();
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
        company_id: userId,
        copilot_enabled: newState.enabled,
        guides_completed: newState.guidesCompleted,
        current_guide: newState.activeGuide,
        current_step: newState.currentStep,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    } catch {
      // Silently fail
    }
  }, [supabase, userId]);

  // Auto-detect which guide to show based on current page
  useEffect(() => {
    if (!state.enabled) return;

    let guideId: string | null = null;

    if (pathname?.includes('/components')) {
      guideId = 'components';
    } else if (pathname?.includes('/quotes/') && pathname?.includes('/summary')) {
      guideId = 'customer-labor';
    } else if (pathname?.includes('/quotes')) {
      guideId = 'quotes';
    } else if (pathname?.includes('/flashings') || pathname?.includes('/material-orders')) {
      guideId = 'flashings-orders';
    }

    if (guideId && guideId !== state.activeGuide) {
      // Don't auto-start completed guides
      if (!state.guidesCompleted.includes(guideId)) {
        setState(prev => ({ ...prev, activeGuide: guideId, currentStep: 0 }));
      } else {
        // Guide already completed, clear active
        if (state.activeGuide) {
          setState(prev => ({ ...prev, activeGuide: null, currentStep: 0 }));
        }
      }
    }
  }, [pathname, state.enabled]);

  const currentGuide = state.activeGuide
    ? COPILOT_GUIDES.find(g => g.id === state.activeGuide) || null
    : null;

  const currentStepData = currentGuide
    ? currentGuide.steps[state.currentStep] || null
    : null;

  const totalSteps = currentGuide?.steps.length || 0;
  const isActive = state.enabled && !!currentGuide && !!currentStepData;

  const toggle = useCallback(() => {
    const newEnabled = !state.enabled;
    const newState = {
      ...state,
      enabled: newEnabled,
      ...(newEnabled ? {} : { activeGuide: null, currentStep: 0 }),
    };
    setState(newState);
    persist(newState);
  }, [state, persist]);

  const nextStep = useCallback(() => {
    if (!currentGuide) return;
    if (state.currentStep >= currentGuide.steps.length - 1) {
      // Guide complete
      const newCompleted = [...new Set([...state.guidesCompleted, currentGuide.id])];
      const newState = { ...state, guidesCompleted: newCompleted, activeGuide: null, currentStep: 0 };
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
    if (currentGuide) {
      const newCompleted = [...new Set([...state.guidesCompleted, currentGuide.id])];
      const newState = { ...state, guidesCompleted: newCompleted, activeGuide: null, currentStep: 0 };
      setState(newState);
      persist(newState);
    }
  }, [state, currentGuide, persist]);

  return (
    <CopilotContext.Provider value={{
      state, isActive, currentGuide, currentStepData, totalSteps,
      toggle, nextStep, prevStep, skipGuide,
    }}>
      {children}
    </CopilotContext.Provider>
  );
}
