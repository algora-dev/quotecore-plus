import type { ReactNode } from 'react';
import { QcIcon, type QcIconName } from '@/app/components/ui/v2/QcIcon';

/** C47. A job capability, not a decorative dashboard statistic.
 * Explicit actions are separate from the card; no nested interactive elements.
 * Future Schedule/Tasks/Team capabilities can reuse this contract when available.
 */
export function JobCapabilityCard({ title, icon, description, status, children }: {
  title: string; icon: QcIconName; description: string; status?: ReactNode; children: ReactNode;
}) {
  return <section className="qc-job-capability">
    <div className="qc-job-capability-heading"><span className="qc-hub-icon"><QcIcon name={icon} /></span><div><h3>{title}</h3>{status}</div></div>
    <p>{description}</p><div className="qc-job-capability-actions">{children}</div>
  </section>;
}
