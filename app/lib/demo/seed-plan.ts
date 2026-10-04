/** Native image coordinates, also used by prepared-scan.ts. Changing this
 * fixture requires changing and testing the authored detections with it. */
export const DEMO_PLAN_SIZE = { width: 1200, height: 900 };
export const DEMO_ROOF_OUTLINE = [{ x: 180, y: 180 }, { x: 1020, y: 180 }, { x: 1020, y: 720 }, { x: 180, y: 720 }];
export const DEMO_SKYLIGHT = { x: 670, y: 285, width: 100, height: 100 };
export const DEMO_PLAN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">
<rect width="1200" height="900" fill="#fbfaf6"/><rect x="35" y="35" width="1130" height="830" fill="none" stroke="#a5a6a6"/>
<text x="65" y="85" font-size="27" font-family="sans-serif" fill="#18232c">QCP ROOFING &amp; CONSTRUCTION</text>
<text x="65" y="115" font-size="16" font-family="sans-serif" fill="#596168">PREPARED DEMO PLAN · FICTIONAL PROPERTY · NOT FOR CONSTRUCTION</text>
<rect x="180" y="180" width="840" height="540" fill="#f0ece3" stroke="#26333d" stroke-width="4"/>
<path d="M180 180L450 450L750 450L1020 180M180 720L450 450M750 450L1020 720" fill="none" stroke="#34434e" stroke-width="3"/>
<path d="M180 170H1020M180 730H1020" stroke="#828b90" stroke-width="2"/>
<rect x="670" y="285" width="100" height="100" fill="#d7eaf1" stroke="#34434e" stroke-width="3"/>
<path d="M670 285L770 385M770 285L670 385" stroke="#8baaba" stroke-width="1.5"/>
<text x="786" y="330" font-family="sans-serif" font-size="18" fill="#18232c">SKYLIGHT</text>
<text x="530" y="275" font-family="sans-serif" font-size="17" fill="#596168">Roof pitch 25°</text>
<text x="465" y="625" font-family="sans-serif" font-size="17" fill="#596168">Roof pitch 25°</text>
<path d="M180 765H1020M180 750V780M1020 750V780M180 765l15 -6m-15 6l15 6M1020 765l-15 -6m15 6l-15 6" fill="none" stroke="#26333d" stroke-width="2"/>
<text x="545" y="795" font-family="sans-serif" font-size="22" fill="#18232c">16.80 m</text>
<path d="M135 180V720M122 180H148M122 720H148" stroke="#26333d" stroke-width="2"/>
<text x="95" y="490" transform="rotate(-90 95 490)" font-family="sans-serif" font-size="22" fill="#18232c">10.80 m</text>
<text x="65" y="840" font-family="sans-serif" font-size="15" fill="#596168">Use the 16.80 m dimension to calibrate if needed. Demo scan results are precomputed.</text>
</svg>`;
