import s from './Homepage.module.css';

/** The genuine V1 takeoff workspace with the shipped charcoal sidebar, supplied
 * by the owner as one high-resolution capture. No compositing needed anymore.
 * Keep the crop ratio bound to this specific supplied 2048 × 1114 screenshot.
 */
export function ProductScreenshot({ eager = false, decorative = false }: { eager?: boolean; decorative?: boolean }) {
  return <span className={s.productScreenshot}>
    <img className={s.productBase} src="/marketing/home/takeoff-workspace-v2.webp" width={2048} height={1114}
      alt={decorative ? '' : 'QuoteCore+ digital takeoff with the charcoal sidebar, measured roof areas, ridges, hips and valleys.'}
      fetchPriority={eager ? 'high' : undefined} loading={eager ? 'eager' : 'lazy'} decoding="async" />
  </span>;
}
