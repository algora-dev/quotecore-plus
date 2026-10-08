import { Suspense } from 'react';
import { FreeToolsAuthProvider } from '../_components/FreeToolsAuthProvider';
import { DocumentGeneratorClient } from '../shared/document-generator/DocumentGeneratorClient';

export default function FreePurchaseOrderGeneratorPage() {
  return <Suspense fallback={<p role="status" style={{padding:'3rem',textAlign:'center'}}>Opening your purchase order editor…</p>}>
    <FreeToolsAuthProvider><DocumentGeneratorClient kind="order"/></FreeToolsAuthProvider>
  </Suspense>;
}
