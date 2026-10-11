// Owner 2026-10-10 (desktop takeoff): the native 'crosshair' cursor is a thin
// white/silver OS cross that is near-invisible on the light roof photos users
// actually upload. This custom cursor is the brand orange (#FF6B35) reticle
// with a dark outline pass underneath, so it reads on light AND dark imagery;
// the hollow centre keeps the exact intersection point visible (same philosophy
// as the outline-editor reticle). Hotspot 12,12 = the precise click point.
// Falls back to the native crosshair where SVG cursors are unsupported.
export const TAKEOFF_CROSSHAIR_CURSOR =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cg stroke='%231f2328' stroke-width='4.4' stroke-linecap='round' fill='none'%3E%3Cpath d='M12 2v6M12 16v6M2 12h6M16 12h6'/%3E%3C/g%3E%3Cg stroke='%23FF6B35' stroke-width='1.8' stroke-linecap='round' fill='none'%3E%3Cpath d='M12 2v6M12 16v6M2 12h6M16 12h6'/%3E%3C/g%3E%3C/svg%3E\") 12 12, crosshair";
