export interface CopilotStep {
  id: string;
  target: string; // CSS selector for the target element
  title: string;
  description: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  page?: string; // URL path this step should appear on (optional)
}

export interface CopilotGuide {
  id: string;
  name: string;
  description: string;
  steps: CopilotStep[];
}

export interface CopilotState {
  enabled: boolean;
  activeGuide: string | null;
  currentStep: number;
  guidesCompleted: string[];
}
