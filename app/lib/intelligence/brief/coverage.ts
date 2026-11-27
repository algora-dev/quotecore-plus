import { type SourceManifest } from '../contracts/evidence';

/** Coverage is derived only from the trusted ingestion manifest, never an AI summary. */
export function coverage(manifest:SourceManifest) {
  let expected=0,analyzed=0,screened=0,failed=0,pending=0,missing=0;
  const active=manifest.documents.filter(d=>d.status==='active');
  for(const d of active) {
    expected+=d.pageCount;missing+=d.pageCount-d.pages.length;
    for(const p of d.pages) {
      if(p.status==='analyzed') analyzed++;
      else if(p.status==='screened') screened++;
      else if(p.status==='failed') failed++;
      else pending++;
    }
  }
  // Screening is not evidence of completed review, even when classified not relevant.
  return {documents:active.length,expected,analyzed,screened,failed,pending,missing,complete:expected>0&&analyzed===expected&&missing===0};
}
