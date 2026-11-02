import { Icon } from './Icon';
import s from './HeroSpeedProof.module.css';

const flows = [
  {
    time: '2 minutes 27 seconds',
    context: 'When you need to measure the job',
    flow: 'Blank roof plan or satellite image → customer quote',
    href: '/fastest-roofing-estimating-software',
  },
  {
    time: 'Less than 60 seconds',
    context: 'When you already have the measurements',
    flow: 'Your measurements → customer quote',
    href: '/fastest-roofing-estimating-software',
  },
];

export function HeroSpeedProof() {
  return (
    <div className={s.wrap} aria-label="QuoteCore+ speed examples">
      {flows.map((item) => (
        <article className={s.card} key={item.time}>
          <span className={s.kicker}>How fast is it?</span>
          <strong className={s.time}>{item.time}</strong>
          <p className={s.context}>{item.context}</p>
          <div className={s.flow}>{item.flow}</div>
          <a href={item.href}>Watch full flow <Icon name="arrow" size={15} /></a>
        </article>
      ))}
    </div>
  );
}
