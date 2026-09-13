'use client';

// Per-supplier demo route: /supplier-pricing-tool/<slug>. Renders the exact
// same tool shell, fully branded from that supplier's definition in
// ../supplierDefs. Unknown slugs 404 - NEVER silently fall back to the
// default supplier (that once served Burton to the Roofline team's URL).

import { use } from 'react';
import { notFound } from 'next/navigation';
import { FreeToolsAuthProvider } from '../../_components/FreeToolsAuthProvider';
import { SupplierConfigProvider } from '../supplierConfig';
import { getSupplierDef, supplierExists } from '../supplierDefs';
import { ToolShell } from '../ToolShell';

export default function SupplierDemoPage({ params }: { params: Promise<{ supplierSlug: string }> | { supplierSlug: string } }) {
  const { supplierSlug } = use(params as Promise<{ supplierSlug: string }>);
  if (!supplierExists(supplierSlug)) notFound();
  const def = getSupplierDef(supplierSlug);
  return (
    <FreeToolsAuthProvider authTheme={{ accent: def.theme.accent, accentHover: def.theme.accentHover }}>
      <SupplierConfigProvider slug={def.slug}>
        <ToolShell />
      </SupplierConfigProvider>
    </FreeToolsAuthProvider>
  );
}
