import { Suspense } from 'react';
import { FreeToolsAuthProvider } from '../_components/FreeToolsAuthProvider';
import QuoteGeneratorClient from './QuoteGeneratorClient';

export default function FreeQuoteGeneratorPage() {
  return <Suspense fallback={<p role="status" style={{padding:'3rem',textAlign:'center'}}>Opening your quote editor…</p>}>
    <FreeToolsAuthProvider><QuoteGeneratorClient/></FreeToolsAuthProvider>
  </Suspense>;
}
