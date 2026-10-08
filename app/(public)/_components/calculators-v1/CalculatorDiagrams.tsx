'use client';
import { useId } from 'react';
import { Icon } from './CalculatorUI';
import { format, type CalculatorState, type Result } from './calculator-model';

/** Functional vector schematics. Not product imagery or fabrication templates. */
export function CalculatorDiagram({ state, result }: { state: CalculatorState; result: Result | null }) {
  const id = useId().replace(/:/g, '');
  if (state.tab === 'members' && state.members.kind === 'birdsmouth') return <BirdsmouthDiagram result={result} />;
  if (state.tab === 'pricing') return <div className="qck-price-visual" aria-hidden="true"><span><Icon name="ruler" size={22} /><b>Measure</b></span><i>→</i><span><Icon name="battens" size={22} /><b>Allow waste</b></span><i>→</i><span><Icon name="calculator" size={22} /><b>Price it</b></span></div>;
  if (state.tab === 'members') {
    const p = result?.pitch ?? 35;
    const height = Math.min(155, Math.max(6, Math.tan(p * Math.PI / 180) * 200));
    return <svg className="qck-diagram" viewBox="0 0 500 285" role="img" aria-label="An angled member above a horizontal run and vertical rise. Schematic, not to scale.">
      <defs><linearGradient id={id} x2="0" y2="1"><stop stopColor="#ff954c" stopOpacity=".20" /><stop offset="1" stopColor="#ff954c" stopOpacity=".01" /></linearGradient></defs>
      <path d={`M75 214H416V${214 - height}Z`} fill={`url(#${id})`} stroke="#8290a2" strokeDasharray="5 6" />
      <path d={`M75 214 416 ${214 - height}`} stroke="#ff995b" strokeWidth="5" strokeLinecap="round" />
      <path d="M397 214v-19h19M75 242H416m-341-5v10m341-10v10" stroke="#8a97a8" fill="none" />
      <text x="245" y="265" textAnchor="middle">Horizontal run</text><text x="432" y={214 - height / 2} textAnchor="start">Rise</text>
      <text x="265" y={200 - height * .55} className="qck-diagram-accent">{state.trade === 'birdsmouth' ? 'Rafter' : 'Angled member'}</text>
      <text x="136" y="201" className="qck-diagram-accent">{format(p, 1)}°</text>
    </svg>;
  }
  if (state.tab === 'angles') {
    const a = result?.value ?? 120, theta = a * Math.PI / 180;
    return <svg className="qck-diagram" viewBox="0 0 500 300" role="img" aria-label="Included junction angle compared with the flat sheet. Schematic, not a fabrication drawing.">
      <path d="M62 148H434" stroke="#7b889b" strokeDasharray="5 7" />
      <path d={`M416 148H244L${244 + 135 * Math.cos(theta)} ${148 - 135 * Math.sin(theta)}`} stroke="#ff995b" strokeWidth="5" fill="none" strokeLinejoin="round" />
      <path d={`M298 148A54 54 0 ${a > 180 ? 1 : 0} 0 ${244 + 54 * Math.cos(theta)} ${148 - 54 * Math.sin(theta)}`} stroke="#b7c2cf" fill="none" />
      <text x="302" y="220" className="qck-diagram-accent">{format(a, 1)}° included</text><text x="62" y="275">Dashed line = flat sheet · schematic only</text>
    </svg>;
  }
  const source = state.tab === 'area' ? state.area : state.battens;
  const batten = state.tab === 'battens', wall = source.surface === 'wall', slope = source.surface === 'slope';
  const points = wall ? '105,50 398,50 398,234 105,234' : slope ? '90,203 300,55 425,118 215,254' : '75,136 290,55 425,140 210,230';
  return <svg className="qck-diagram" viewBox="0 0 500 300" role="img" aria-label={`${wall ? 'Wall' : slope ? 'Sloping surface' : 'Floor surface'} ${batten ? 'with spaced batten rows' : 'with labelled dimensions'}. Schematic, not to scale.`}>
    <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ffb371" stopOpacity=".23" /><stop offset="1" stopColor="#ff7333" stopOpacity=".025" /></linearGradient><clipPath id={id + 'clip'}><polygon points={points} /></clipPath></defs>
    {slope && <path d="M90 250 300 176 425 226 215 280Z M90 203V250M300 55V176M425 118V226" fill="none" stroke="#727f91" strokeDasharray="5 6" />}
    <polygon points={points} fill={`url(#${id})`} stroke="#ff9d64" strokeWidth="1.7" />
    <g clipPath={`url(#${id}clip)`} stroke={batten ? '#ffc693' : '#d8a178'} strokeWidth={batten ? 3 : 1} strokeOpacity={batten ? .65 : .18}>
      {Array.from({ length: 11 }, (_, i) => <path key={i} d={wall ? `M105 ${60 + i * 18}H398` : `M${20 + i * 29} 310l290-240`} />)}
    </g>
    {wall && Number(source.deduction) > 0 && !batten && <><path d="M260 234v-94h57v94" fill="#15191f" stroke="#c0c8d3" strokeDasharray="4 4" /><path d="M284 188h9" stroke="#9fa9b7" /></>}
    {wall ? <><path d="M105 254H398m-293-5v10m293-10v10M79 50V234m-5-184h10m-10 184h10" stroke="#8592a5" /><text x="250" y="278" textAnchor="middle">Width</text><text x="56" y="152" transform="rotate(-90 56 152)" textAnchor="middle">Height</text></> : <text x="250" y="284" textAnchor="middle">{slope ? 'Sloping surface over its flat footprint' : batten ? 'Rows shown schematically · not a cutting layout' : 'Measured along the floor · no slope factor'}</text>}
    <text x="250" y={wall ? 105 : 145} textAnchor="middle" className="qck-diagram-accent">{batten ? 'Centre spacing' : wall ? 'Wall surface' : slope ? 'True surface' : 'Floor area'}</text>
    <circle cx={wall ? 105 : slope ? 90 : 75} cy={wall ? 50 : slope ? 203 : 136} r="3.5" fill="#ffc28d" />
  </svg>;
}

function BirdsmouthDiagram({ result }: { result: Result | null }) {
  const id = useId().replace(/:/g, '');
  // This intentionally remains a legible explanatory schematic at extreme input
  // pitches. Never expose it as a scale drawing or a cutting template.
  const p = Math.min(48, Math.max(22, result?.pitch ?? 35)) * Math.PI / 180;
  const m = Math.tan(p), s = 94, x = 229, y = 226;
  const notch = s * Math.sin(p), d = Math.max(120, notch / Math.min(.65, Math.max(.12, result?.cut ? result.cut.notch / result.cut.depth : .287)));
  const verticalDepth = d / Math.cos(p), h = s * m;
  const bottom = (xx: number) => y + h - (xx - x) * m;
  const top = (xx: number) => bottom(xx) - verticalDepth;
  const foot = { x: x + notch * Math.sin(p), y: y + notch * Math.cos(p) };
  const mid={x:(x+foot.x)/2,y:(y+foot.y)/2};
  const depthBase={x:392,y:bottom(392)};
  const depthTop={x:392-d*Math.sin(p),y:bottom(392)-d*Math.cos(p)};
  return <div className="qck-cut-visual">
    <svg className="qck-diagram qck-cut-diagram" viewBox="0 0 570 330" role="img" aria-label="Birdsmouth detail. A is the horizontal seat, N is the notch measured perpendicular to the rafter. Vertical heel cut and remaining height above seat are different measurements. Schematic, not a cutting template.">
      <defs><linearGradient id={id} x1="0" y1="1" x2="1" y2="0"><stop stopColor="#ff964f" stopOpacity=".08" /><stop offset="1" stopColor="#ffb677" stopOpacity=".20" /></linearGradient><clipPath id={id + 'bounds'}><rect x="30" y="20" width="510" height="270" rx="12" /></clipPath></defs>
      <g clipPath={`url(#${id}bounds)`}>
        <path d={`M40 ${bottom(40)}L${x} ${bottom(x)}V${y}H${x + s}L530 ${bottom(530)}V${top(530)}L40 ${top(40)}Z`} fill={`url(#${id})`} stroke="#ffbc87" strokeWidth="1.8" />
        <path d={`M45 ${top(45) + 22}L528 ${top(528) + 22}M45 ${top(45) + 31}L528 ${top(528) + 31}`} stroke="#fac596" strokeOpacity=".12" />
        <path d={`M${x} ${y}h${s}v46h-${s}Z`} fill="#ffffff05" stroke="#8e9aad" />
        <path d={`M${x} ${bottom(x)}L${x + s} ${y}`} stroke="#bfc8d4" strokeDasharray="4 5" />
        <path d={`M${x} ${bottom(x)}V${y}H${x + s}`} fill="none" stroke="#ff914c" strokeWidth="3.5" />
        <path d={`M${x} ${y}L${foot.x} ${foot.y}`} stroke="#f3ca8d" strokeWidth="2" />
        <circle cx={x} cy={y} r="4" fill="#ff914c" />
        <path d={`M${depthBase.x} ${depthBase.y}L${depthTop.x} ${depthTop.y}`} stroke="#b2bfcf" strokeDasharray="3 4"/>
        <text x={(depthBase.x+depthTop.x)/2+8} y={(depthBase.y+depthTop.y)/2-5}>D</text>
        <path d={`M${x - 24} ${top(x)}V${y}m-5-${y - top(x)}h10m-10 ${y - top(x)}h10`} stroke="#9babbf" />
      </g>
      <path d={`M${x} 287H${x + s}m-${s}-5v10m${s}-10v10`} stroke="#ffbd88" />
      <text x={x + s / 2} y="312" textAnchor="middle" className="qck-diagram-accent">A · Horizontal seat</text>
      <text x={x - 38} y={Math.max(74, (top(x) + y) / 2)} textAnchor="end">HAP</text>
      <path d={`M386 ${mid.y}H${mid.x}`} stroke="#bac5d3" fill="none" /><circle cx={mid.x} cy={mid.y} r="2" fill="#f3ca8d"/><text x="397" y={mid.y+4}>N · Notch</text>
      <text x="66" y="269" className="qck-diagram-accent">Rafter edge</text>
      <text x="416" y="97">Timber</text>
    </svg>
    <div className="qck-diagram-caption"><span className="qck-legend-dot" />N and D are perpendicular to the rafter edge.<span>Schematic only · not a cutting template</span></div>
  </div>;
}
