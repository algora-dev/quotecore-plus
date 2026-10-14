import type { ShowcaseFeature } from './showcase-types';

export function boundedIndex(index: number, count: number): number {
  if (!Number.isFinite(index) || count < 1) return 0;
  return Math.min(count - 1, Math.max(0, Math.trunc(index)));
}

/** Navigation is a real anchor. Only a host-relative path or HTTPS URL is allowed. */
export function safeDemoHref(value: string | undefined): string {
  const raw = value?.trim() ?? '';
  if (!raw || /[\u0000-\u0020\\]/.test(raw)) return '/takeoff-demo';
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === 'https:' && !parsed.username && !parsed.password) return parsed.href;
  } catch { /* Use the existing demo route. */ }
  return '/takeoff-demo';
}

export function tabDestination(key: string, index: number, count: number): number | null {
  if (count < 1) return null;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  if (key === 'ArrowLeft') return (index - 1 + count) % count;
  if (key === 'ArrowRight') return (index + 1) % count;
  return null;
}

/** A horizontal swipe, not a vertical page scroll or small tap. */
export function swipeDirection(dx: number, dy: number): -1 | 0 | 1 {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.7) return 0;
  return dx < 0 ? 1 : -1;
}

export function validFeatures(items: readonly ShowcaseFeature[]): readonly ShowcaseFeature[] {
  const seen = new Set<string>();
  return items.filter(item => {
    if (!item.id || seen.has(item.id) || item.scenes.length === 0) return false;
    seen.add(item.id);
    return true;
  });
}
