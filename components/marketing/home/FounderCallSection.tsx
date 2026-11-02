import { DemoCallButton } from './DemoCall';
import { Icon } from './Icon';
import s from './FounderCallSection.module.css';

export function FounderCallSection({ bookingHref }: { bookingHref: string }) {
  return (
    <section className={s.section} aria-labelledby="founder-call-title">
      <div className={s.container}>
        <div className={s.copy}>
          <p className={s.eyebrow}>A useful 25 minutes either way</p>
          <h2 id="founder-call-title">25 minutes with someone who knows roofing.</h2>
          <p className={s.lead}>Tell me how you measure, estimate or quote today. I’ll show you how QuoteCore+ could make it faster and easier.</p>
          <blockquote>I’ve yet to work with a roofing business where I couldn’t help them speed up or simplify their quoting process.</blockquote>
          <DemoCallButton bookingHref={bookingHref} label="Book my free 25-minute call" location="founder-section" primary />
        </div>

        <div className={s.side}>
          <div className={s.founder}>
            <img src="/shaun-smiling.jpg" alt="Shaun, founder of QuoteCore+" />
            <div><strong>Shaun · Founder</strong><span>20+ years roofing & construction</span></div>
          </div>
          <div className={s.steps}>
            <article><span>01</span><div><strong>Tell me</strong><p>Bring a job, or just talk me through how you quote now.</p></div></article>
            <article><span>02</span><div><strong>I’ll show you</strong><p>See the QuoteCore+ workflow that best fits the way you work.</p></div></article>
            <article><span>03</span><div><strong>Take this too</strong><p>My #1 tip for turning more of your quotes into jobs.</p></div></article>
          </div>
          <div className={s.tip}><Icon name="spark" size={18} /><span>Even if QuoteCore+ is not for you, the call should still be useful.</span></div>
        </div>
      </div>
    </section>
  );
}
