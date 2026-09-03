'use client';

// Supplier admin route (default supplier / dev build, ?supplier=<slug>
// selects any registered def). The per-supplier branded route lives at
// /supplier-pricing-tool/<slug>/admin - both render the same AdminPanel.

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { getSupplierDef } from '../supplierDefs';
import { AdminPanel } from './AdminPanel';

function AdminRoute() {
  const search = useSearchParams();
  const slug = getSupplierDef(search.get('supplier')).slug;
  return <AdminPanel slug={slug} />;
}

export default function SupplierAdminPage() {
  return (
    <Suspense fallback={<main className="min-h-screen flex items-center justify-center text-sm text-slate-400">Loading admin...</main>}>
      <AdminRoute />
    </Suspense>
  );
}
