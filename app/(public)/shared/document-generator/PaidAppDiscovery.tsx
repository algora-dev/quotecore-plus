import { QcLinkButton } from '@/app/components/ui/v2/QcButton';
import { Icon } from './Icon';
import { workflowCallHref } from '@/lib/booking';
import s from './DocumentGenerator.module.css';

/** Commercial next step after a free document task. The tools stay free; the
 * acquisition choice is a Free Workspace or a conversation with Shaun. */
export function PaidAppDiscovery(){return <section className={s.paidDiscovery} aria-labelledby="paid-app-title"><p className={s.eyebrow}>THE NEXT STEP, WHEN YOU’RE READY</p><h3 id="paid-app-title">Less retyping. More quoting.</h3><p>Connect measurements, your pricing and customer documents in a real QuoteCore+ Free Workspace.</p><div className={s.discoveryLinks}><QcLinkButton variant="primary" className={s.button} href={workflowCallHref}>Book 25 minutes with Shaun<Icon name="arrow"/></QcLinkButton><QcLinkButton variant="glass" className={s.button} href="/signup">Create my Free Workspace<Icon name="arrow"/></QcLinkButton></div><p className={s.paidNote}>No card, no plan selection and no expiry. Upgrade only when you need more features, capacity or usage.</p></section>;}
