'use client';
import { useEffect, type RefObject } from 'react';

/** Fit this assistant only to the usable viewport; never change app-wide CSS. */
export function useAssistantViewport(root: RefObject<HTMLDivElement>, visible: boolean) {
  useEffect(() => {
    if (!visible || !root.current) return;
    const node = root.current;
    // Both existing hosts are assistant-owned: the floating panel and standalone wrapper.
    const host = node.closest<HTMLElement>('[data-sa-host]') ?? node.parentElement;
    if (!host) return;
    const targets = [node, host];
    const names = ['--sa-viewport-height', '--sa-viewport-top', '--sa-viewport-width'];
    const before = targets.map(t => names.map(n => t.style.getPropertyValue(n)));
    const viewport = window.visualViewport;
    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        // Don't turn accessibility pinch-zoom into a miniature unzoomed interface.
        if (viewport && Math.abs(viewport.scale - 1) > 0.05) return;
        // Clamp so a transient visualViewport glitch (keyboard opening,
        // URL-bar mid-animation, focus shift) can never collapse the panel.
        const height = Math.max(320, Math.round(viewport?.height ?? window.innerHeight));
        const width = Math.max(280, Math.round(viewport?.width ?? window.innerWidth));
        for (const t of targets) {
          t.style.setProperty(names[0], `${height}px`);
          t.style.setProperty(names[1], `${Math.round(viewport?.offsetTop ?? 0)}px`);
          t.style.setProperty(names[2], `${width}px`);
        }
        node.dataset.saCompactHeight = height < 560 ? 'true' : 'false';
      });
    };
    measure();
    viewport?.addEventListener('resize', measure);
    viewport?.addEventListener('scroll', measure);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(raf);
      viewport?.removeEventListener('resize', measure);
      viewport?.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
      targets.forEach((t, i) => names.forEach((n, j) => { if (before[i][j]) t.style.setProperty(n, before[i][j]); else t.style.removeProperty(n); }));
      delete node.dataset.saCompactHeight;
    };
  }, [root, visible]);
}
