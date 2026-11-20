/**
 * The four ways roofers get roof quantities and measurements.
 * Shared source of truth between the homepage "measure ways" section
 * and the /free-trial "Recognize your workflow" step (owner 2026-11-20).
 */
export const measureWayImages = {
  written: { src: '/marketing/free-trial/demo-measurements-written.webp', width: 1055, height: 1491 },
  sketch: { src: '/marketing/free-trial/demo-roof-sketch.webp', width: 1491, height: 1055 },
  plan: { src: '/marketing/free-trial/demo-roof-plan.webp', width: 998, height: 786 },
  satellite: { src: '/marketing/free-trial/demo-roof-satellite.webp', width: 1413, height: 1113 },
} as const;

export const measureWays = [
  {
    number: 1,
    title: 'Measured on site',
    description: 'You already have the quantities and measurements written down.',
    image: measureWayImages.written,
    alt: 'Handwritten roofing measurements and quantities on lined paper.',
    dialogTitle: 'Written measurements and quantities from the demo job',
  },
  {
    number: 2,
    title: 'Sketched by hand',
    description: 'You draw the roof shape and label the hips, ridges, valleys, and dimensions yourself.',
    image: measureWayImages.sketch,
    alt: 'Hand-drawn roof plan with measurements written onto the sketch.',
    dialogTitle: 'Roof sketch with measurements from the demo job',
  },
  {
    number: 3,
    title: 'Supplied roof plan',
    description: 'You work from a plan and need to measure the roof from that document.',
    image: measureWayImages.plan,
    alt: 'Architectural roof plan with labeled roof elements and dimensions.',
    dialogTitle: 'Architectural roof plan from the demo job',
  },
  {
    number: 4,
    title: 'Satellite measurement',
    description: 'You measure from the overhead roof image and build the quote from there.',
    image: measureWayImages.satellite,
    alt: 'Satellite image of the same roof shown in the demo job.',
    dialogTitle: 'Satellite roof image from the demo job',
  },
] as const;
