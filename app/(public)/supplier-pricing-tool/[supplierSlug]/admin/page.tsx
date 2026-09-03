'use client';

// Per-supplier branded admin route: /supplier-pricing-tool/<slug>/admin.
// The tool header "Admin" link points here so each demo brand gets its own
// branded login + panel from the same template.

import { use } from 'react';
import { getSupplierDef } from '../../supplierDefs';
import { AdminPanel } from '../../admin/AdminPanel';

export default function SupplierAdminRoute({ params }: { params: Promise<{ supplierSlug: string }> | { supplierSlug: string } }) {
  const { supplierSlug } = use(params as Promise<{ supplierSlug: string }>);
  const def = getSupplierDef(supplierSlug);
  return <AdminPanel slug={def.slug} />;
}
