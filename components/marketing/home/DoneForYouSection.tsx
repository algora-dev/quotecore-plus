import { MarketingButton } from '@/components/marketing/MarketingButton';
import { FounderVideo } from './FounderVideo';
import { Icon } from './Icon';
import { safeBookingHref } from './homepage-config';
import s from './Homepage.module.css';
import d from './DoneForYou.module.css';

export interface DoneForYouConfig {
  bookingHref?: string;
  videoSrc?: string;
  youtubeId?: string;
  captionsSrc?: string;
}

export function DoneForYouSection({ config = {}, detailsHref = '/done-for-you-setup', preview = false }: {
  config?: DoneForYouConfig;
  detailsHref?: string;
  preview?: boolean;
}) {
  const bookingHref = safeBookingHref(config.bookingHref ?? '');
  return <section id="setup" className={`${s.dark} ${d.section}`} aria-labelledby="setup-title">
    <div className={s.container}>
      <div className={`${s.dark} ${d.panel}`}>
        <div className={d.copy}>
          <p className={`${s.eyebrow} ${d.eyebrow}`}>Done For You Setup</p>
          <h2 id="setup-title" className={d.title}>Prefer a hand getting started?</h2>
          <p className={d.intro}>You can set up QuoteCore+ yourself, or let us take care of it. We’ll build it around your pricing and the way you work, then teach you using your own jobs.</p>
          <ul className={d.benefits}>
            <li><Icon name="check" size={16} />Materials &amp; labour</li>
            <li><Icon name="check" size={16} />Your pricing &amp; workflow</li>
            <li><Icon name="check" size={16} />Personal training</li>
          </ul>
          <div className={d.actions}>
            <MarketingButton href={bookingHref || detailsHref} variant="primary" size="large" className={`${s.button} ${d.cta}`} icon={<Icon name="arrow" size={18} />}>
              {bookingHref ? 'Book a Free Setup Call' : 'Explore Done For You Setup'}
            </MarketingButton>
            <details className={d.details}>
              <summary>How it works<Icon name="chevron" size={16} /></summary>
              <ol>
                <li><strong>Tell us how you work.</strong> A free 20-minute chat about your jobs, pricing and the help you need.</li>
                <li><strong>Agree your setup.</strong> We propose a tailored package. You approve the scope and price before paid work begins.</li>
                <li><strong>Get set up and learn.</strong> You provide your materials, labour and pricing information. We configure your account and train you using your own jobs.</li>
              </ol>
            </details>
          </div>
          <p className={d.reassurance}>Start with a free 20-minute chat. No obligation.<br />Paid setup is scoped and quoted to suit your business.</p>
        </div>
        <FounderVideo videoSrc={config.videoSrc} youtubeId={config.youtubeId} captionsSrc={config.captionsSrc} preview={preview} />
      </div>
    </div>
  </section>;
}
