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
  nudgeMessage: string | null;
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
  const [nudgeMessage, setNudgeMessage] = useState<string | null>(null);

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
    // Don't interfere if a guide is already running
    if (state.activeGuide) return;

    let guideId: string | null = null;

    if (pathname?.includes('/components')) {
      guideId = 'components';
    } else if (pathname?.includes('/quotes/') && pathname?.includes('/summary')) {
      guideId = 'customer-labor';
    } else if (pathname?.match(/\/quotes\/[^/]+$/) && !pathname?.includes('/new')) {
      // Quote builder page: /quotes/[id] (not /quotes/new or /quotes/[id]/summary)
      guideId = 'quote-builder';
    } else if (pathname?.includes('/quotes')) {
      guideId = 'create-quote';
    } else if (pathname?.includes('/flashings') || pathname?.includes('/material-orders')) {
      guideId = 'flashings-orders';
    }

    if (guideId && !state.guidesCompleted.includes(guideId)) {
      setState(prev => ({ ...prev, activeGuide: guideId, currentStep: 0 }));
    }
  }, [pathname, state.enabled, state.activeGuide]);

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

    // Validate current step before advancing
    const current = currentGuide.steps[state.currentStep];
    if (current?.validation && current.validation !== 'none') {
      const targetSelector = current.validationTarget || current.target;
      const el = document.querySelector(targetSelector);

      if (current.validation === 'input') {
        // Check if any input inside the target has been filled (blank = not done, zero = OK)
        const inputs = el?.querySelectorAll('input, select, textarea');
        const hasValue = inputs && Array.from(inputs).some((inp: any) => {
          const val = inp.value;
          return val !== undefined && val !== null && val.trim() !== '';
        });
        if (!hasValue) {
          setNudgeMessage(current.nudgeText || 'Please fill in this field before continuing.');
          setTimeout(() => setNudgeMessage(null), 2500);
          return;
        }
      } else if (current.validation === 'click') {
        const checkEl = document.querySelector(current.validationTarget || '');
        if (!checkEl) {
          setNudgeMessage(current.nudgeText || 'Please complete this step first.');
          setTimeout(() => setNudgeMessage(null), 2500);
          return;
        }
      }
    }

    setNudgeMessage(null);
    
    // Move to next step — don't skip missing targets, wait for them
    const nextIdx = state.currentStep + 1;
    
    if (nextIdx >= currentGuide.steps.length) {
      // Guide complete
      const newCompleted = [...new Set([...state.guidesCompleted, currentGuide.id])];
      const newState = { ...state, guidesCompleted: newCompleted, activeGuide: null, currentStep: 0 };
      setState(newState);
      persist(newState);
    } else {
      const newState = { ...state, currentStep: nextIdx };
      setState(newState);
      persist(newState);
    }
  }, [state, currentGuide, persist]);

  const prevStep = useCallback(() => {
    if (!currentGuide || state.currentStep <= 0) return;
    
    let prevIdx = state.currentStep - 1;
    while (prevIdx >= 0) {
      const step = currentGuide.steps[prevIdx];
      const el = document.querySelector(step.target);
      if (el) break;
      prevIdx--;
    }
    
    if (prevIdx >= 0) {
      const newState = { ...state, currentStep: prevIdx };
      setState(newState);
      persist(newState);
    }
  }, [state, currentGuide, persist]);

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
      state, isActive, currentGuide, currentStepData, totalSteps, nudgeMessage,
      toggle, nextStep, prevStep, skipGuide,
    }}>
      {children}
    </CopilotContext.Provider>
  );
}
