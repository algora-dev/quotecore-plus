import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Script from "next/script";
import BlogHeader from "@/components/BlogHeader";
import SiteFooter from "@/components/SiteFooter";
import { SITE_URL } from "@/lib/seo/site-url";
import { BLOG_CATEGORIES, getPostsByCategory, type BlogCategory } from "@/app/lib/blog-posts";

export async function generateStaticParams() {
  return BLOG_CATEGORIES.map((c) => ({ topic: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ topic: string }> }): Promise<Metadata> {
  const { topic } = await params;
  const category = BLOG_CATEGORIES.find((c) => c.slug === topic);
  if (!category) return {};

  return {
    title: `${category.title} `,
    description: category.description,
    alternates: { canonical: `https://quote-core.com/resources/${category.slug}` },
    openGraph: {
      title: `${category.title} `,
      description: category.description,
      url: `https://quote-core.com/resources/${category.slug}`,
      siteName: "QuoteCore+",
      type: "website",
    },
  };
}

const CATEGORY_MAP = new Map<string, BlogCategory>(
  BLOG_CATEGORIES.map((c) => [c.slug, c.slug])
);

export default async function ResourceHubPage({ params }: { params: Promise<{ topic: string }> }) {
  const { topic } = await params;
  const category = BLOG_CATEGORIES.find((c) => c.slug === topic);
  if (!category) notFound();

  const posts = getPostsByCategory(category.slug);

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Resources", item: `${SITE_URL}/blog` },
      { "@type": "ListItem", position: 3, name: category.title, item: `${SITE_URL}/resources/${category.slug}` },
    ],
  };

  return (
    <>
      <Script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <main className="min-h-screen bg-white text-zinc-950">
        <BlogHeader backLabel="Back to blog" backHref="/blog" />

        {/* Hero */}
        <section className="relative overflow-hidden pb-12 pt-16">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,107,53,0.08),transparent_40%)]" />
          <div className="relative mx-auto max-w-3xl px-6 lg:px-8">
            <p className="text-sm font-medium text-[#FF6B35]">Resources</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
              {category.title}
            </h1>
            <p className="mt-4 text-lg text-zinc-600">{category.description}</p>
          </div>
        </section>

        {/* Posts */}
        <section className="mx-auto max-w-3xl px-6 pb-16 lg:px-8">
          {posts.length === 0 ? (
            <p className="text-zinc-500">No posts in this category yet.</p>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="block rounded-xl border border-slate-200 bg-white p-6 transition-all hover:border-orange-200 hover:bg-orange-50/40 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)]"
                >
                  <h2 className="text-lg font-semibold text-slate-900">{post.title}</h2>
                  <p className="mt-2 text-sm text-zinc-600">{post.description}</p>
                  <p className="mt-3 text-xs text-zinc-400">
                    {new Date(post.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Other categories */}
        <section className="mx-auto max-w-3xl px-6 pb-24 lg:px-8">
          <h2 className="text-xl font-semibold tracking-tight">Other topics</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {BLOG_CATEGORIES.filter((c) => c.slug !== category.slug).map((c) => (
              <Link
                key={c.slug}
                href={`/resources/${c.slug}`}
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-orange-200 hover:text-[#BD4A1A]"
              >
                {c.title}
              </Link>
            ))}
          </div>
        </section>

        <SiteFooter />
      </main>
    </>
  );
}
