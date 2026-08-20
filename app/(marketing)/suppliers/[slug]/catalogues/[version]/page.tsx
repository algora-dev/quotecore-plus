import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

interface PageProps {
  params: Promise<{ slug: string; version: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, version } = await params;
  const versionNum = parseInt(version, 10);
  if (isNaN(versionNum)) return { title: "Invalid Version", robots: { index: false, follow: false } };
  return {
    title: `Catalogue v${versionNum} | QuoteCore+`,
    robots: { index: false, follow: false },
  };
}

export default async function VersionedCataloguePage({ params }: PageProps) {
  const { slug, version } = await params;
  const versionNum = parseInt(version, 10);
  if (isNaN(versionNum) || versionNum < 1) notFound();

  // BRIEF-003 residual (Tom, 20 Aug): versioned catalogue HTML pages 301 to
  // the parent catalogue page - same as the unversioned CSV/JSON routes.
  // permanentRedirect => 301 (permanent) so signals consolidate.
  permanentRedirect(`/suppliers/${slug}/catalogue`);
}
