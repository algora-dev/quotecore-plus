import { fingerprint } from '../core/math';
import { withTimeout } from '../reliability/timeout';
import { type RecoveryDocument, type RecoveryRecord, parseRecoveryDocument } from './recoveryData';
import type { RecoveryBackup, RecoveryRepository } from './recoveryStore';
import type { CalculationJournal } from '../reliability/protocol';
import type { ReviewDocument } from './reviews';
/** Serial compare-and-swap writes; source state is separate from quote prices.
 * Device backup is written before network I/O. An uncertain network write blocks
 * further cloud writes until explicit reload, never blind retry at a stale revision. */
export class RecoverySession {
  private latest:RecoveryDocument;
  private pending:RecoveryDocument|null=null;private active:Promise<void>|null=null;
  private timer:ReturnType<typeof setTimeout>|null=null;private blocked=false;private lastCloudAt=0;private lastSent:RecoveryDocument|null=null;
  constructor(private repository:RecoveryRepository,private backup:RecoveryBackup|null,private record:RecoveryRecord,
    private onStatus:(message:string)=>void=()=>{}){this.latest=structuredClone(record.document);}
  revision():number{return this.record.revision;}
  document():RecoveryDocument{return structuredClone(this.latest);}
  async checkpoint(document:RecoveryDocument):Promise<void>{this.queue(document);await this.flush();}
  queue(document:RecoveryDocument):void {
    this.latest={...document,savedAt:new Date().toISOString()};this.pending=this.latest;
    // Serial write below preserves last-local-edit wins; never an unobserved
    // asynchronous put that can race the next version of the same document.
    if(this.timer)clearTimeout(this.timer);
    this.timer=setTimeout(()=>{this.timer=null;void this.flush().catch(()=>{});},500);
  }
  review(document:ReviewDocument):void {const d=this.document();d.review=document;this.queue(d);}
  journal(journal:CalculationJournal):void {
    const d=this.document();d.calculation=journal;this.latest={...d,savedAt:new Date().toISOString()};this.pending=this.latest;
    if(journal.status!=='running'||Date.now()-this.lastCloudAt>1500)void this.flush().catch(()=>{});
    else if(!this.timer)this.timer=setTimeout(()=>{this.timer=null;void this.flush().catch(()=>{});},1500);
  }
  async beforeCalculation(review:ReviewDocument,journal:CalculationJournal):Promise<void>{
    if(this.blocked)await this.retry();
    const d=this.document();d.review=review;d.calculation=journal;await this.checkpoint(d);
  }
  /** Explicit retry only. Reconcile a lost acknowledgement without overwriting
   * another tab. Aborting HTTP does not establish that the server rolled back. */
  async retry():Promise<void>{
    const current=await withTimeout(this.repository.load(this.record.document.scope),20_000,'Checkpoint reload timed out.');
    if((current?.revision??0)!==this.record.revision){
      if(!current||!this.lastSent||fingerprint(current.document)!==fingerprint(this.lastSent))throw new Error('A newer checkpoint exists. Reload or export rather than overwrite another tab.');
      this.record=current;
    }
    this.blocked=false;await this.flush();
  }
  async flush():Promise<void>{
    if(this.timer)clearTimeout(this.timer);this.timer=null;
    if(this.active){await this.active;if(this.pending)return this.flush();return;}
    if(!this.pending)return;
    const document=parseRecoveryDocument(this.pending);this.pending=null;
    this.active=(async()=>{
      let local=false;try{if(this.backup){await withTimeout(this.backup.put(document),5000,'Device checkpoint timed out.');local=true;}}catch{/* cloud can still save */}
      try{
        if(this.blocked)throw new Error('Reload the saved checkpoint before retrying an uncertain account write.');
        this.lastSent=document;
        const saved=await withTimeout(this.repository.save(document.scope,document,this.record.revision),20_000,'Account checkpoint timed out. Reload before retrying.');this.record=saved;this.lastCloudAt=Date.now();
        this.onStatus('Measurements and reviewed faces saved to your account.');
      }catch(error){if(!this.pending)this.pending=document;this.blocked=true;
        const text=`${error instanceof Error?error.message:'Checkpoint save failed.'} ${local?'A device recovery copy was saved.':'Export the measurements before leaving.'}`;this.onStatus(text);throw new Error(text);
      }finally{this.active=null;}
    })();
    await this.active;if(this.pending)await this.flush();
  }
  dispose():void{if(this.timer)clearTimeout(this.timer);this.timer=null;void this.flush().catch(()=>{});}
}
