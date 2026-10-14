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
    <div className={d.blueprint} aria-hidden="true">
      <svg viewBox="0 0 1280 520" preserveAspectRatio="xMidYMid slice" focusable="false">
        <g className={d.blueprintGrid}>
          <path d="M40 78H1240M40 156H1240M40 234H1240M40 312H1240M40 390H1240M40 468H1240" />
          <path d="M112 28V492M232 28V492M352 28V492M472 28V492M592 28V492M712 28V492M832 28V492M952 28V492M1072 28V492M1192 28V492" />
        </g>
        <g className={d.blueprintRoof}>
          <path d="M680 112H1058V394H680Z" />
          <path d="M680 112L868 248L1058 112M680 394L868 248L1058 394" />
          <path d="M680 194H582V318H680" />
          <path d="M582 194L680 256L582 318" />
          <path d="M868 150V346" />
          <path d="M722 144H820M916 144H1014M722 362H820M916 362H1014" />
          <path d="M712 182L812 254L712 326M1026 182L926 254L1026 326" />
        </g>
        <g className={d.blueprintDimensions}>
          <path d="M654 86H1084M654 77V95M1084 77V95" />
          <path d="M1100 112V394M1091 112H1109M1091 394H1109" />
          <path d="M558 174V338M549 174H567M549 338H567" />
          <path d="M694 420H1044M694 411V429M1044 411V429" />
        </g>
        <g className={d.blueprintAccent}>
          <path d="M868 150V346" />
          <path d="M582 256H680" />
          <circle cx="868" cy="248" r="6" />
          <path d="M836 248H900M868 216V280" />
        </g>
      </svg>
    </div>
    <div className={s.container}>
      <div className={`${s.dark} ${d.panel}`}>
        <div className={d.copy}>
          <p className={`${s.eyebrow} ${d.eyebrow}`}>Done For You Setup</p>
          <h2 id="setup-title" className={d.title}>
            <span className={`${d.titleLine} ${d.titleWhite}`}>Your workflow.</span>
            <span className={`${d.titleLine} ${d.titleOrange}`}>Your pricing.</span>
            <span className={`${d.titleLine} ${d.titleGrey}`}>We can take care of the setup for <span className={d.titleOrange}>you.</span></span>
          </h2>
          <p className={d.intro}>Show us how you currently price and quote. We’ll configure your QuoteCore+ account around that workflow, guide you through using it on your own jobs, and be available to help for the next three months.</p>
          <ul className={d.benefits}>
            <li><Icon name="check" size={16} />Configured for you</li>
            <li><Icon name="check" size={16} />Guided on your jobs</li>
            <li><Icon name="check" size={16} />3 months of support</li>
          </ul>
          <div className={d.actions}>
            <MarketingButton href={detailsHref} variant="primary" size="large" className={`${s.button} ${d.cta}`} icon={<Icon name="arrow" size={18} />}>
              See How Done For You Works
            </MarketingButton>
            <MarketingButton href={bookingHref || detailsHref} variant="glass" size="large" className={`${s.button} ${d.secondaryCta}`}>
              {bookingHref ? 'Book a Free 20-Minute Call' : 'Explore Done For You Setup'}
            </MarketingButton>
          </div>
          <p className={d.reassurance}>Free 20-minute discovery call. No obligation.</p>
        </div>
        <FounderVideo videoSrc={config.videoSrc} youtubeId={config.youtubeId} captionsSrc={config.captionsSrc} preview={preview} />
      </div>
    </div>
  </section>;
}
