import type { MeasurementPicture as PictureType } from './measurement-state';

/** Small instructional geometry, not a drawing tool or a priced measurement. */
export function MeasurementPicture({ kind }: { kind: PictureType }) {
  return <svg className="qc-measure-picture" viewBox="0 0 156 70" fill="none" aria-hidden="true" focusable="false">
    {kind === 'length' && <><path className="qc-measure-shape" d="M23 22h110v14H23z" /><path className="qc-measure-line" d="M23 51h110M23 46v10m110-10v10" /></>}
    {kind === 'area' && <><path className="qc-measure-shape" d="M41 10h74v43H41z" /><path className="qc-measure-grid" d="M60 10v43m18-43v43m18-43v43M41 24h74M41 39h74" /><path className="qc-measure-line" d="M30 10v43m-4-43h8m-8 43h8M41 63h74m-74-4v8m74-8v8" /></>}
    {kind === 'quantity' && <>{[33,69,105].flatMap(x => [10,38].map(y => <rect key={`${x}-${y}`} className="qc-measure-shape" x={x} y={y} width="20" height="21" rx="4" />))}</>}
    {kind === 'fixed' && <><path className="qc-measure-shape" d="M49 8h47l13 13v40H49z" /><path className="qc-measure-grid" d="M96 8v15h13M61 35h33M61 45h21" /></>}
    {kind === 'height' && <><path className="qc-measure-shape" d="M39 12h87v43H39z" /><path className="qc-measure-line" d="M25 12v43m-4-43h8m-8 43h8M39 64h87m-87-4v8m87-8v8" /><path className="qc-measure-grid" d="M50 39h63M50 26h63" /></>}
    {kind === 'volume' && <><path className="qc-measure-shape" d="m43 26 34-17 37 17v26L78 65 43 50Z" /><path className="qc-measure-line" d="m43 26 35 15 36-15M78 41v24" /></>}
    {kind === 'time' && <><circle className="qc-measure-shape" cx="78" cy="34" r="25" /><path className="qc-measure-line" d="M78 17v18l14 8" /></>}
    {kind === 'multi' && <><path className="qc-measure-line" d="M20 49h44V20h68" />{[[20,49],[64,49],[64,20],[132,20]].map(([x,y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="3.5" className="qc-measure-dot" />)}</>}
  </svg>;
}
