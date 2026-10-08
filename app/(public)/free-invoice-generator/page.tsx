import { Suspense } from 'react';
import { FreeToolsAuthProvider } from '../_components/FreeToolsAuthProvider';
import { DocumentGeneratorClient } from '../shared/document-generator/DocumentGeneratorClient';

export default function FreeInvoiceGeneratorPage() {
  return <Suspense fallback={<p role="status" style={{padding:'3rem',textAlign:'center'}}>Opening your invoice editor…</p>}>
    <FreeToolsAuthProvider><DocumentGeneratorClient kind="invoice"/></FreeToolsAuthProvider>
  </Suspense>;
}
