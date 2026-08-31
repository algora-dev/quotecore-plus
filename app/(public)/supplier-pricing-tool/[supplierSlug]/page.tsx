'use client';

// Per-supplier demo route: /supplier-pricing-tool/<slug>. Renders the exact
// same tool shell, fully branded from that supplier's definition in
// ../supplierDefs. Unknown slugs fall back to the default supplier (Burton).

import { use } from 'react';
import { FreeToolsAuthProvider } from '../../_components/FreeToolsAuthProvider';
import { SupplierConfigProvider } from '../supplierConfig';
import { getSupplierDef } from '../supplierDefs';
import { ToolShell } from '../page';

export default function SupplierDemoPage({ params }: { params: Promise<{ supplierSlug: string }> | { supplierSlug: string } }) {
  const { supplierSlug } = use(params as Promise<{ supplierSlug: string }>);
  const def = getSupplierDef(supplierSlug);
  return (
    <FreeToolsAuthProvider>
      <SupplierConfigProvider slug={def.slug}>
        <ToolShell />
      </SupplierConfigProvider>
    </FreeToolsAuthProvider>
  );
}
