export type FeatureId = 'assistant' | 'components' | 'measurements' | 'takeoff' | 'workflow';
export type CaptureRole = 'request' | 'result';
export type ShowcaseIconName = 'assistant' | 'components' | 'measurements' | 'takeoff' | 'workflow' | 'mic' | 'arrow' | 'left' | 'right' | 'check' | 'image' | 'expand' | 'close' | 'phone' | 'document' | 'search' | 'list';

export interface Capture {
  /** Supply real product captures here. Empty src deliberately renders a labelled storyboard. */
  src?: string;
  alt: string;
  width: number;
  height: number;
  label: string;
  caption: string;
}

export interface ShowcaseScene {
  id: string;
  label: string;
  heading: string;
  body: string;
  benefit: string;
  context: string;
  inputLabel: string;
  input: string;
  outputTitle: string;
  outputSubtitle: string;
  outputRows: readonly { label: string; value: string }[];
  icon: ShowcaseIconName;
  request: Capture;
  result: Capture;
}

export interface ShowcaseFeature {
  id: FeatureId;
  label: string;
  eyebrow: string;
  descriptor: string;
  scenes: readonly ShowcaseScene[];
  beta?: boolean;
  outcome?: boolean;
}

export type ShowcaseEvent = {
  action: 'view' | 'feature_select' | 'scene_select' | 'capture_select' | 'capture_expand' | 'demo_click';
  feature: FeatureId;
  scene: string;
  source?: 'tab' | 'picker' | 'previous' | 'next' | 'swipe' | 'capture';
  capture?: CaptureRole;
};
