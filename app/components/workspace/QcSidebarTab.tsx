'use client';
import { forwardRef } from 'react';
import { QcIcon } from '../ui/v2/QcIcon';

/** C50. A single, persistent edge control. Narrow orange face; hit area spans the full topbar height.
 * The shell owns state. No route, query, preference or canvas logic lives here.
 */
export const QcSidebarTab = forwardRef<HTMLButtonElement, {
  expanded: boolean; onToggle: () => void;
}>(function QcSidebarTab({ expanded, onToggle }, ref) {
  const label = expanded ? 'Hide navigation' : 'Show navigation';
  return <button ref={ref} type="button" data-qc-component="C50" data-takeoff-chrome="sidebar"
    className="qc-sidebar-edge-tab" aria-label={label} title={label}
    aria-controls="qc-sidebar" aria-expanded={expanded} onClick={onToggle}>
    <span className="qc-sidebar-edge-face"><QcIcon name="chevron" /></span>
  </button>;
});
