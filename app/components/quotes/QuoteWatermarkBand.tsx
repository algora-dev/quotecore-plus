/**
 * Free Workspace quote watermark (owner 2026-11-03, layout approved same day).
 *
 * Slim footer band on every customer-facing quote artifact rendered by a
 * Free Workspace: the on-screen preview, the downloaded PDF (html2canvas
 * capture of the same preview) and the public accept page (which prints the
 * same DOM). Paid builds never render this - the caller gates it on the
 * admin-free grant. It never blocks use; it sits on the artifact the free
 * user hands their customer and nudges the upgrade.
 *
 * Uses the real brand mark (public/logo-mark.png) + v2 design tokens.
 * Pure presentational - safe in server and client trees, and html2canvas
 * renders it because it is plain DOM with a same-origin image.
 */
export function QuoteWatermarkBand() {
  return (
    <div
      data-pdf-block
      data-qc-ui="v2"
      data-qc-watermark="free-workspace"
      style={{
        marginTop: '22px',
        borderTop: '1px solid #f0f0f0',
        background: '#fafbfc',
        padding: '10px 24px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
        {/* Real brand mark, same-origin so html2canvas captures it. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-mark.png" alt="" width={26} height={26}
          style={{ borderRadius: '7px', display: 'block', flexShrink: 0 }} />
        <span style={{ minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#1f232b', lineHeight: 1.25 }}>
            Created with QuoteCore+
          </span>
          <span style={{ display: 'block', fontSize: '10px', color: '#8a94a3', lineHeight: 1.35 }}>
            Measure, price and send roofing quotes in minutes
          </span>
        </span>
      </div>
      <a
        href="https://quote-core.com"
        style={{
          fontSize: '11px',
          fontWeight: 700,
          color: '#FF641F',
          textDecoration: 'none',
          border: '1px solid #ffd6bd',
          background: '#fff7f2',
          padding: '5px 12px',
          borderRadius: '8px',
          flexShrink: 0,
        }}
      >
        quote-core.com
      </a>
    </div>
  );
}
