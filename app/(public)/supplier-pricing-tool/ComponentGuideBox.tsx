'use client';

// Copied from app/(public)/free-roofing-takeoff-builder/ComponentGuideBox.tsx
// and recoloured to the supplier tool's blue palette (per the tool's
// copy-and-recolour convention). Adds a 'downpipe' case (counted drops at
// the spouting outlets) which the original does not need.

interface ComponentGuideBoxProps {
  componentKey: string;
  entries?: number;
}

const GUIDE_LABELS: Record<string, string> = {
  roof_area: 'Roof Area',
  ridge: 'Ridges',
  hip: 'Hips',
  valley: 'Valleys',
  barge: 'Barges',
  spouting: 'Spouting',
  downpipe: 'Downpipes',
  underlay: 'Underlay',
  fixings: 'Fixings',
};

const GUIDE_DESC: Record<string, string> = {
  roof_area: 'The total surface of each roof slope - measured flat off the plan, pitched automatically.',
  ridge: 'The horizontal line along the top where two roof slopes meet.',
  hip: 'The sloped lines running from the roof corners up to the ridge.',
  valley: 'The internal lines where two roof slopes meet - water runs down them.',
  barge: 'The sloped edge boards at the gable end, running up along the roof slope.',
  spouting: 'The guttering fixed along the bottom edge of the roof (the eaves).',
  downpipe: 'The vertical pipes taking water from the spouting down to the ground - counted, not measured.',
};

// Inline SVGs - same as the docs/component-guides/*.svg files
// but embedded as React components for direct rendering
function GuideSVG({ componentKey }: { componentKey: string }) {
  const black = '#1e293b';
  const blue = '#2563EB';
  const sw = 1.5;
  const ow = 3.5;

  // Building outline path
  const outline = 'M 40 40 L 420 40 L 420 280 L 320 280 L 320 340 L 140 340 L 140 280 L 40 280 Z';

  // Internal lines
  const mainRidge = <line x1="160" y1="160" x2="300" y2="160" />;
  const dormerRidge = <line x1="230" y1="340" x2="230" y2="190" />;
  const hips = [
    <line key="h1" x1="160" y1="160" x2="40" y2="40" />,
    <line key="h2" x1="160" y1="160" x2="40" y2="280" />,
    <line key="h3" x1="300" y1="160" x2="420" y2="40" />,
    <line key="h4" x1="300" y1="160" x2="420" y2="280" />,
  ];
  const valleys = [
    <line key="v1" x1="140" y1="280" x2="230" y2="190" />,
    <line key="v2" x1="320" y1="280" x2="230" y2="190" />,
  ];
  const barges = [
    <line key="b1" x1="140" y1="340" x2="230" y2="340" />,
    <line key="b2" x1="230" y1="340" x2="320" y2="340" />,
  ];

  const allInternal = (
    <>
      {mainRidge}
      {dormerRidge}
      {hips}
      {valleys}
      {barges}
    </>
  );

  let blueElements: React.ReactNode = null;
  let blackElements: React.ReactNode = allInternal;
  let outlineColor = black;
  let outlineWidth = sw;

  switch (componentKey) {
    case 'roof_area':
    case 'underlay':
    case 'fixings':
      outlineColor = blue;
      outlineWidth = ow;
      blackElements = allInternal;
      blueElements = null;
      break;
    case 'ridge':
      blueElements = <>{mainRidge}{dormerRidge}</>;
      blackElements = <>{hips}{valleys}{barges}</>;
      break;
    case 'hip':
      blueElements = <>{hips}</>;
      blackElements = <>{mainRidge}{dormerRidge}{valleys}{barges}</>;
      break;
    case 'valley':
      blueElements = <>{valleys}</>;
      blackElements = <>{mainRidge}{dormerRidge}{hips}{barges}</>;
      break;
    case 'barge':
      blueElements = <>{barges}</>;
      blackElements = <>{mainRidge}{dormerRidge}{hips}{valleys}</>;
      break;
    case 'spouting':
      blackElements = allInternal;
      blueElements = (
        <>
          <line x1="40" y1="40" x2="420" y2="40" stroke={blue} strokeWidth={ow} strokeLinecap="round" />
          <line x1="40" y1="40" x2="40" y2="280" stroke={blue} strokeWidth={ow} strokeLinecap="round" />
          <line x1="420" y1="40" x2="420" y2="280" stroke={blue} strokeWidth={ow} strokeLinecap="round" />
          <line x1="40" y1="280" x2="140" y2="280" stroke={blue} strokeWidth={ow} strokeLinecap="round" />
          <line x1="320" y1="280" x2="420" y2="280" stroke={blue} strokeWidth={ow} strokeLinecap="round" />
          <line x1="140" y1="280" x2="140" y2="340" stroke={blue} strokeWidth={ow} strokeLinecap="round" />
          <line x1="320" y1="280" x2="320" y2="340" stroke={blue} strokeWidth={ow} strokeLinecap="round" />
        </>
      );
      break;
    case 'downpipe':
      // counted drops at two spouting outlets (corners of the eaves)
      blackElements = allInternal;
      blueElements = (
        <>
          <line x1="40" y1="280" x2="40" y2="355" stroke={blue} strokeWidth={ow * 1.6} strokeLinecap="round" />
          <line x1="420" y1="280" x2="420" y2="355" stroke={blue} strokeWidth={ow * 1.6} strokeLinecap="round" />
          <circle cx="40" cy="280" r="5" fill={blue} />
          <circle cx="420" cy="280" r="5" fill={blue} />
        </>
      );
      break;
  }

  return (
    <svg viewBox="0 0 460 380" className="w-full h-auto">
      <path
        d={outline}
        fill="none"
        stroke={outlineColor}
        strokeWidth={outlineWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <g fill="none" stroke={black} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
        {blackElements}
      </g>
      {blueElements && componentKey !== 'spouting' && componentKey !== 'downpipe' && (
        <g fill="none" stroke={blue} strokeWidth={ow} strokeLinecap="round">
          {blueElements}
        </g>
      )}
      {(componentKey === 'spouting' || componentKey === 'downpipe') && blueElements}
    </svg>
  );
}

export function ComponentGuideBox({ componentKey, entries }: ComponentGuideBoxProps) {
  const label = GUIDE_LABELS[componentKey];
  if (!label) return null;
  const isAreaComponent = componentKey === 'roof_area' || componentKey === 'underlay' || componentKey === 'fixings';
  const isCountComponent = componentKey === 'downpipe';

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 w-44 sm:w-56">
          <GuideSVG componentKey={componentKey} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-600">
            {label} <span className="text-blue-600 font-semibold">{isAreaComponent ? 'covers the entire roof area' : isCountComponent ? 'counted where water exits the spouting' : 'indicated in blue'}</span>
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {GUIDE_DESC[componentKey] ?? `Example diagram showing where ${label.toLowerCase()} appear on a roof plan.`}
          </p>
          {typeof entries === 'number' && entries > 0 && (
            <p className="mt-0.5 text-[11px] font-medium text-blue-600">
              {entries} {entries === 1 ? 'entry' : 'entries'} added
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
