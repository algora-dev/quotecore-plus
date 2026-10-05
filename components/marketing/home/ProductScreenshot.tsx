import s from './Homepage.module.css';

/** The genuine V1 workspace remains unchanged. The small overlaid strip is a
 * deterministic palette remap of its original sidebar, not generated software.
 * This is marketing art direction; it does not implement application dark mode.
 * Keep the crop ratio bound to this specific supplied 2048 × 1114 screenshot.
 */
export function ProductScreenshot({ eager = false, decorative = false }: { eager?: boolean; decorative?: boolean }) {
  return <span className={s.productScreenshot} data-sidebar-theme="charcoal-marketing">
    <img className={s.productBase} src="/marketing/home/takeoff-workspace.webp" width={2048} height={1114}
      alt={decorative ? '' : 'QuoteCore+ digital takeoff with measured roof areas, ridges, hips and valleys. The navigation has a charcoal marketing treatment; the takeoff workspace is unchanged.'}
      fetchPriority={eager ? 'high' : undefined} loading={eager ? 'eager' : 'lazy'} decoding="async" />
    <img className={s.productSidebar} src="/marketing/home/takeoff-sidebar-charcoal.webp" width={278} height={1114}
      alt="" aria-hidden="true" fetchPriority={eager ? 'high' : undefined} loading={eager ? 'eager' : 'lazy'} decoding="async" />
  </span>;
}
