'use client';
import { trackEvent } from '@/lib/analytics';
import { FeatureShowcase } from './feature-showcase/FeatureShowcase';
import { homepageConfig, type HomepageConfig } from './homepage-config';
import type { ShowcaseEvent } from './feature-showcase/showcase-types';

/** Drop-in replacement for the previous workflow section. Keep #workflow links.
 * No homepage, navigation, hero, billing or app-engine changes are required.
 */
function trackShowcase(event: ShowcaseEvent) {
  trackEvent(`homepage_showcase_${event.action}`, {
    feature: event.feature, scene: event.scene,
    ...(event.source ? { source: event.source } : {}),
    ...(event.capture ? { capture: event.capture } : {}),
  });
}

export function WorkflowExplorer({ demoHref = homepageConfig.demoHref, config = homepageConfig }: { demoHref?: string; config?: HomepageConfig } = {}) {
  return <FeatureShowcase id="workflow" demoHref={demoHref} config={config} onEvent={trackShowcase} />;
}
