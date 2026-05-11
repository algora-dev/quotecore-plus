'use client';

import { type ReactNode } from 'react';
import { useHelpDrawer, HELP_DRAWER_MAX_WIDTH_VW } from './HelpDrawerContext';

/**
 * Layout shell that the workspace renders around its server-rendered children.
 *
 * When the help drawer is open, this component splits the viewport into two
 * columns:
 *   - Left: a placeholder that reserves the drawer's column width. The actual
 *     drawer UI is rendered separately by `<HelpDrawerPanel>` mounted near
 *     the workspace header (so it lives outside the normal scroll container
 *     and pins to the full viewport height). The placeholder here exists\n *     solely so the app column shrinks by the right amount.
 *   - Right: the app itself (`children`), which gets the remaining width.
 *
 * When closed, the children render at the original full width with zero
 * offset \u2014 no layout shift cost.
 *
 * Width is read from the help-drawer context and is already clamped to the
 * max-35% cap before it reaches here.
 */
export function HelpDrawerLayout({ children }: { children: ReactNode }) {
  const { open, widthVw } = useHelpDrawer();

  // We use margin-left rather than a flex split because the workspace's own
  // header lives inside `children` and uses `max-w-6xl mx-auto`. Pushing the
  // whole content tree right by the drawer width lets the existing centred
  // header / content keep working unchanged \u2014 it just centres inside a
  // narrower viewport.
  return (
    <div
      className="transition-[margin] duration-150 ease-out"
      style={{
        marginLeft: open ? `${Math.min(widthVw, HELP_DRAWER_MAX_WIDTH_VW)}vw` : 0,
      }}
    >
      {children}
    </div>
  );
}
