import type { Metadata } from 'next';
import Script from 'next/script';
import BlogHeader from '@/components/BlogHeader';
import { buildPageMetadata, breadcrumbSchema, siteGraphSchema, blogPostingSchema, blogIndexSchema } from '@/app/lib/seo';
import { getPublishedPosts, BLOG_CATEGORIES } from '@/app/lib/blog-posts';

export const metadata: Metadata = buildPageMetadata({
  title: 'Roofing, Construction and Quoting Guides | QuoteCore+',
  description:
    'Practical guides for roofing and construction contractors on quoting, pricing, material ordering, job management, and getting more work. From the QuoteCore+ team.',
  path: '/blog',
});

const posts = getPublishedPosts();

const landingPages = [
  {
    href: '/roofing-quoting-software',
    title: 'Roofing Quoting Software',
    description:
      'How QuoteCore+ helps roofing contractors measure jobs, build professional quotes, create material orders, manage jobs and invoice - in one place.',
  },
  {
    href: '/construction-quoting-software',
    title: 'Construction Quoting Software',
    description:
      'QuoteCore+ is built for construction businesses that measure, price, quote, create material orders, manage jobs and invoice. Roofing, cladding, flooring, fencing, landscaping, and more.',
  },
];

const blogBreadcrumb = breadcrumbSchema([
  { name: 'Home', path: '/' },
  { name: 'Blog', path: '/blog' },
]);

const blogSchema = blogIndexSchema();
// Populate blogPost references in the Blog schema
blogSchema.blogPost = posts.map((p) => ({
  '@type': 'BlogPosting',
  url: `https://quote-core.com/blog/${p.slug}`,
  headline: p.title,
  datePublished: p.date,
  dateModified: p.lastModified || p.date,
  author: { '@id': 'https://quote-core.com/#organization' },
}));

export default function BlogIndexPage() {
  return (
    <>
      <Script
        id="blog-index-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@graph': [
              ...siteGraphSchema()['@graph'],
              blogBreadcrumb,
              blogSchema,
            ],
          }),
        }}
      />
      <div className="min-h-screen bg-white text-zinc-950">
        <BlogHeader backLabel="Back to homepage" backHref="/" />

        <main className="mx-auto max-w-3xl px-6 py-20 lg:px-8">
          <h1 className="text-4xl font-semibold tracking-tight text-zinc-950">Blog</h1>
          <p className="mt-4 text-lg text-zinc-500">
            Roofing business tips, quoting advice, and industry insights for contractors.
          </p>

          {/* Topic hubs */}
          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            {BLOG_CATEGORIES.map((cat) => (
              <a
                key={cat.slug}
                href={`/resources/${cat.slug}`}
                className="block rounded-xl border border-slate-200 bg-white p-4 transition-all hover:border-orange-200 hover:bg-orange-50/40"
              >
                <h3 className="text-sm font-semibold text-slate-900">{cat.title}</h3>
                <p className="mt-1 text-xs text-zinc-500">{cat.description}</p>
              </a>
            ))}
          </div>

          <div className="mt-14 space-y-6">
            {posts.map((post) => (
              <a
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="block rounded-[1.75rem] border border-zinc-200 bg-white p-7 shadow-sm transition-shadow hover:shadow-md"
              >
                <p className="text-xs text-zinc-500">
                  {new Date(post.date).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
                <h2 className="mt-2 text-xl font-semibold text-zinc-950">{post.title}</h2>
                <p className="mt-2 text-sm text-zinc-500">{post.description}</p>
              </a>
            ))}
          </div>

          <div className="mt-10 space-y-6">
            {landingPages.map((page) => (
              <a
                key={page.href}
                href={page.href}
                className="block rounded-[1.75rem] border border-zinc-200 bg-white p-7 shadow-sm transition-shadow hover:shadow-md"
              >
                <p className="text-xs font-medium text-[#BD4A1A]">Guide</p>
                <h2 className="mt-2 text-xl font-semibold text-zinc-950">{page.title}</h2>
                <p className="mt-2 text-sm text-zinc-500">{page.description}</p>
              </a>
            ))}
          </div>
        </main>
      </div>
    </>
  );
}
