import { RoofTakeoffBuilder } from '../RoofTakeoffBuilder';
import { parseQueryInput } from '../public-contract';

export default async function SupplierPage({ 
  params, 
  searchParams 
}: { 
  params: Promise<{ supplierSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supplierSlug } = await params;
  const supplied = await searchParams;
  const params_ = new URLSearchParams();
  for (const [key, value] of Object.entries(supplied)) {
    if (typeof value === 'string') params_.set(key, value);
    else if (Array.isArray(value)) params_.set(key, value.join(','));
  }
  const initialInput = params_.size > 0 ? parseQueryInput(params_) : undefined;

  return (
    <>
      <section className="sr-only" aria-labelledby="roof-takeoff-capabilities">
        <h2 id="roof-takeoff-capabilities">Free Roof Takeoff Builder - {supplierSlug}</h2>
        <p>Calculate a complete roof takeoff using actual final measurements or measurements taken from a roof plan. This page is pre-configured for a specific roofing supplier.</p>
      </section>
      <RoofTakeoffBuilder initialInput={initialInput} initialSupplierSlug={supplierSlug} />
    </>
  );
}
