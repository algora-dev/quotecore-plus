import s from './Homepage.module.css';

/** The real app Home dashboard with the shipped charcoal sidebar, supplied by
 * the owner as one high-resolution capture. No compositing needed anymore.
 * Keep the crop ratio bound to this specific supplied 2048 × 1114 screenshot.
 */
export function ProductScreenshot({ eager = false, decorative = false }: { eager?: boolean; decorative?: boolean }) {
  return <span className={s.productScreenshot}>
    <img className={s.productBase} src="/marketing/home/home-dashboard.webp" width={2048} height={1114}
      alt={decorative ? '' : 'QuoteCore+ home dashboard with the charcoal sidebar, recent quotes, customer notifications and the pricing library.'}
      fetchPriority={eager ? 'high' : undefined} loading={eager ? 'eager' : 'lazy'} decoding="async" />
  </span>;
}
