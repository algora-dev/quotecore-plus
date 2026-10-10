#!/usr/bin/env node
/** Compare a host proposal with a verified outline in the SAME prepared raster.
 * QC_TEST_OUT=... node .../benchmark-outlines.cjs verified.json proposed.json
 * Input: {frame:{width,height,sha256},outline:{name,points,pitch_degrees:null}}
 * No calls to AI. Outputs sample metrics, not a universal accuracy guarantee.
 */
const fs=require('node:fs'),path=require('node:path');
const repo=path.resolve(__dirname,'../../..');
const out=process.env.QC_TEST_OUT||path.join(repo,'.host-outline-test');
const {validatePoints,measurements}=require(path.join(out,'app/lib/free-tools/host-roof-scan/geometry'));
const sharp=require(path.join(out,'node_modules/sharp'));
async function main(){
 const [a,b]=process.argv.slice(2);if(!a||!b)throw new Error('Supply verified.json and proposed.json.');
 const truth=JSON.parse(fs.readFileSync(a,'utf8')),proposal=JSON.parse(fs.readFileSync(b,'utf8'));
 if(truth.frame.width!==proposal.frame.width||truth.frame.height!==proposal.frame.height||!truth.frame.sha256||truth.frame.sha256!==proposal.frame.sha256)throw new Error('Images and coordinate frames must match exactly.');
 const frame=truth.frame;if(frame.width>2000||frame.height>2000)throw new Error('Use prepared rasters, at most 2000px per side.');
 const t=validatePoints(truth.outline.points,frame),p=validatePoints(proposal.outline.points,frame);
 async function mask(points){const svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+frame.width+'" height="'+frame.height+'"><rect width="100%" height="100%" fill="black"/><polygon fill="white" points="'+points.map(q=>q.x+','+q.y).join(' ')+'"/></svg>';return sharp(Buffer.from(svg)).removeAlpha().greyscale().raw().toBuffer();}
 const [tm,pm]=await Promise.all([mask(t),mask(p)]);let intersection=0,union=0;
 for(let i=0;i<tm.length;i++){const x=tm[i]>=128,y=pm[i]>=128;if(x&&y)intersection++;if(x||y)union++;}
 const unit={start:{x:0,y:0},end:{x:10,y:0},realLength:10,unit:'m'};
 const ta=measurements(t,unit).area,pa=measurements(p,unit).area;
 console.log(JSON.stringify({metricVersion:'qc-outline-benchmark-v1',imageSha256:frame.sha256,rasterIoU:intersection/union,absoluteAreaErrorPercent:Math.abs(pa-ta)/ta*100,verifiedVertexCount:t.length,proposedVertexCount:p.length,note:'IoU is rasterized at the prepared resolution. Area error uses existing polygon math; hypothetical unit scale cancels. This does not evaluate pitch, components or real-world measurement accuracy.'},null,2));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
