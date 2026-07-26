'use client';

interface ComponentGuideBoxProps {
  componentKey: string;
}

const GUIDE_LABELS: Record<string, string> = {
  roof_area: 'Roof Area',
  ridge: 'Ridges',
  hip: 'Hips',
  valley: 'Valleys',
  barge: 'Barges',
  spouting: 'Spouting',
  underlay: 'Underlay',
  fixings: 'Fixings',
};

// Inline SVGs - same as the docs/component-guides/*.svg files
// but embedded as React components for direct rendering
function GuideSVG({ componentKey }: { componentKey: string }) {
  const black = '#1e293b';
  const orange = '#FF6B35';
  const sw = 1.5;
  const ow = 2.25;

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

  // All internal lines (black)
  const allInternal = (
    <>
      {mainRidge}
      {dormerRidge}
      {hips}
      {valleys}
      {barges}
    </>
  );

  // Determine which lines are orange based on componentKey
  let orangeElements: React.ReactNode = null;
  let blackElements: React.ReactNode = allInternal;
  let outlineColor = black;
  let outlineWidth = sw;

  switch (componentKey) {
    case 'roof_area':
    case 'underlay':
    case 'fixings':
      // Outline orange, all internal black
      outlineColor = orange;
      outlineWidth = ow;
      blackElements = allInternal;
      orangeElements = null;
      break;
    case 'ridge':
      outlineColor = black;
      orangeElements = <>{mainRidge}{dormerRidge}</>;
      blackElements = <>{hips}{valleys}{barges}</>;
      break;
    case 'hip':
      outlineColor = black;
      orangeElements = <>{hips}</>;
      blackElements = <>{mainRidge}{dormerRidge}{valleys}{barges}</>;
      break;
    case 'valley':
      outlineColor = black;
      orangeElements = <>{valleys}</>;
      blackElements = <>{mainRidge}{dormerRidge}{hips}{barges}</>;
      break;
    case 'barge':
      outlineColor = black;
      orangeElements = <>{barges}</>;
      blackElements = <>{mainRidge}{dormerRidge}{hips}{valleys}</>;
      break;
    case 'spouting':
      // All eaves edges except barges
      outlineColor = orange;
      outlineWidth = ow;
      orangeElements = null; // outline handles it
      // But we need to NOT show the barge section in orange - the outline path
      // includes the barge section. We need to draw spouting as separate lines.
      // Actually the outline IS the full perimeter including barges.
      // For spouting, we draw the eaves edges (not barge edges) in orange.
      // The barge edges are (140,340)-(230,340) and (230,340)-(320,340).
      // Spouting = all outline edges EXCEPT barges.
      outlineColor = black; // keep outline black
      outlineWidth = sw;
      orangeElements = (
        <>
          {/* Top edge */}
          <line x1="40" y1="40" x2="420" y2="40" stroke={orange} strokeWidth={ow} strokeLinecap="round" />
          {/* Left edge */}
          <line x1="40" y1="40" x2="40" y2="280" stroke={orange} strokeWidth={ow} strokeLinecap="round" />
          {/* Right edge */}
          <line x1="420" y1="40" x2="420" y2="280" stroke={orange} strokeWidth={ow} strokeLinecap="round" />
          {/* Left eaves */}
          <line x1="40" y1="280" x2="140" y2="280" stroke={orange} strokeWidth={ow} strokeLinecap="round" />
          {/* Right eaves */}
          <line x1="320" y1="280" x2="420" y2="280" stroke={orange} strokeWidth={ow} strokeLinecap="round" />
          {/* Projection side edges */}
          <line x1="140" y1="280" x2="140" y2="340" stroke={orange} strokeWidth={ow} strokeLinecap="round" />
          <line x1="320" y1="280" x2="320" y2="340" stroke={orange} strokeWidth={ow} strokeLinecap="round" />
        </>
      );
      blackElements = allInternal;
      break;
  }

  return (
    <svg viewBox="0 0 460 380" className="w-full h-auto" style={{ maxHeight: '140px' }}>
      {/* Outline */}
      <path
        d={outline}
        fill="none"
        stroke={outlineColor}
        strokeWidth={outlineWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Black internal lines */}
      <g fill="none" stroke={black} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
        {blackElements}
      </g>
      {/* Orange highlighted lines (for ridge/hip/valley/barge) */}
      {orangeElements && componentKey !== 'spouting' && (
        <g fill="none" stroke={orange} strokeWidth={ow} strokeLinecap="round">
          {orangeElements}
        </g>
      )}
      {/* Spouting orange lines are rendered above with their own stroke */}
      {componentKey === 'spouting' && orangeElements}
    </svg>
  );
}

export function ComponentGuideBox({ componentKey }: ComponentGuideBoxProps) {
  const label = GUIDE_LABELS[componentKey];
  if (!label) return null;
  const isAreaComponent = componentKey === 'roof_area' || componentKey === 'underlay' || componentKey === 'fixings';

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 mb-3">
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 w-28 sm:w-32">
          <GuideSVG componentKey={componentKey} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-600">
            {label} <span className="text-[#FF6B35] font-semibold">{isAreaComponent ? 'covers the entire roof area' : 'indicated in orange'}</span>
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {isAreaComponent ? 'Calculated using the total roof area with pitch adjustment.' : `Example diagram showing where ${label.toLowerCase()} appear on a roof plan.`}
          </p>
        </div>
      </div>
    </div>
  );
}
