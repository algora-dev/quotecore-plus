import ZoomableImage from '@/app/(marketing)/free-trial/ZoomableImage';
import { measureWays } from './measure-ways';
import s from './HomepageMeasureWays.module.css';

/**
 * Dark "measure ways" section between the hero and the journey accordion
 * (owner 2026-11-20). Same four demo cards as the /free-trial
 * "Recognize your workflow" step, minus the demo-job pill, with the
 * card grid matching the journey step grid width-for-width.
 */
export function HomepageMeasureWays() {
  return <section aria-labelledby="measure-ways-title" className={s.section}>
    <div className={s.wrap}>
      <header className={s.header}>
        <h2 id="measure-ways-title">Most roofers measure roofs <span className={s.gradient}>one of these four ways.</span></h2>
        <p className={s.subhead}>If you measure like this, QuoteCore+ can help you.</p>
      </header>
      <div className={s.grid}>
        {measureWays.map((method) => (
          <article className={s.card} key={method.number}>
            <ZoomableImage
              {...method.image}
              className={s.shot}
              title={method.dialogTitle}
              alt={method.alt}
              hint="View larger"
              sizes="(max-width: 720px) 92vw, (max-width: 1100px) 45vw, 24vw"
            />
            <div className={s.text}>
              <h3>{method.title}</h3>
              <p>{method.description}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  </section>;
}
