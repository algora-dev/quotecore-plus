import type { Metadata } from "next";
import OpenCookiePrefButton from "@/components/OpenCookiePrefButton";
import ManageCookiesButton from "@/components/ManageCookiesButton";
import BlogHeader from "@/components/BlogHeader";
import SiteFooter from "@/components/SiteFooter";
import { hreflangLanguages } from "@/lib/seo/hreflang";

export const metadata: Metadata = {
  title: "Cookie Policy | QuoteCore+",
  description: "How QuoteCore+ uses cookies and similar technologies on our website.",
  alternates: {
    canonical: "https://quote-core.com/cookie-policy",
    languages: hreflangLanguages("/cookie-policy"),
  },
};

export default function CookiePolicyPage() {
  return (
    <main className="min-h-screen bg-white text-zinc-950">
      <BlogHeader />

      <div className="mx-auto max-w-3xl px-6 py-16 lg:px-8 lg:py-24">
        <h1 className="text-4xl font-semibold tracking-tight">Cookie Policy</h1>
        <p className="mt-3 text-sm text-zinc-500">Last updated: 17 July 2026</p>

        <div className="mt-6">
          <ManageCookiesButton />
        </div>

        <div className="mt-10 space-y-10 text-zinc-700 leading-7">

          <section>
            <p>
              This Cookie Policy explains how QuoteCore+ uses cookies and similar technologies on our website.
            </p>
            <p className="mt-4">
              QuoteCore<span className="text-orange-500">+</span> is operated by <strong>T3 Play Limited</strong> (NZ company 9148617, NZBN 9429051941314), 85 Tongariro Street, Halswell, Christchurch 8025, New Zealand. In this policy, &ldquo;QuoteCore+&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo; and &ldquo;our&rdquo; refer to T3 Play Limited.
            </p>
            <p className="mt-4">
              By using our website, you can choose whether to allow optional cookies. Some cookies are necessary for the website to work properly, while others help us understand how people use the site and improve our marketing.
            </p>
            <p className="mt-4">
              You can accept, reject, or manage optional cookies at any time using the cookie banner or cookie settings on our website.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-950">What are cookies?</h2>
            <p className="mt-4">
              Cookies are small text files placed on your device when you visit a website. They help websites remember information about your visit, such as your preferences, whether you are logged in, and how you interact with pages.
            </p>
            <p className="mt-4">
              Similar technologies, such as tracking pixels, tags and scripts, can also be used to collect information about website usage and advertising performance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-950">Types of cookies we use</h2>

            <div className="mt-6 space-y-6">
              <div className="rounded-[1.5rem] border border-zinc-200 bg-zinc-50 px-6 py-5">
                <h3 className="font-semibold text-zinc-950">1. Strictly necessary cookies</h3>
                <p className="mt-3">
                  These cookies are needed for the website and core services to work. They may be used for things like security, page loading, account access, form submissions, authentication, and remembering your cookie preferences.
                </p>
                <p className="mt-3">
                  These cookies cannot usually be switched off because the website may not work properly without them.
                </p>
                <p className="mt-3 text-zinc-500 text-sm">Examples may include: session cookies, security cookies, authentication cookies, cookie consent preference cookies.</p>
              </div>

              <div className="rounded-[1.5rem] border border-zinc-200 bg-zinc-50 px-6 py-5">
                <h3 className="font-semibold text-zinc-950">2. Analytics cookies</h3>
                <p className="mt-3">
                  These cookies help us understand how visitors use our website, which pages are viewed, where users may get stuck, and how we can improve the site.
                </p>
                <p className="mt-3">We may use analytics tools such as:</p>
                <ul className="mt-2 ml-4 list-disc space-y-1 text-zinc-600">
                  <li>Google Analytics 4</li>
                  <li>Microsoft Clarity</li>
                </ul>
                <p className="mt-3">
                  These tools may collect information such as pages visited, time spent on the site, approximate location, device type, browser type, clicks, scrolling, and general website usage behaviour.
                </p>
                <p className="mt-3">Analytics cookies are only used where you have given consent.</p>
              </div>

              <div className="rounded-[1.5rem] border border-zinc-200 bg-zinc-50 px-6 py-5">
                <h3 className="font-semibold text-zinc-950">3. Marketing and advertising cookies</h3>
                <p className="mt-3">
                  These cookies and similar technologies help us understand the effectiveness of our marketing and may allow us to show relevant ads or measure how people interact with our website after seeing our content.
                </p>
                <p className="mt-3">We may use tools such as:</p>
                <ul className="mt-2 ml-4 list-disc space-y-1 text-zinc-600">
                  <li>Meta Pixel</li>
                  <li>LinkedIn Insight Tag</li>
                  <li>Google advertising tags, if enabled</li>
                </ul>
                <p className="mt-3">Marketing cookies are only used where you have given consent.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-950">What happens if you reject cookies?</h2>
            <p className="mt-4">If you reject optional cookies, we will not use analytics or marketing cookies on your device.</p>
            <p className="mt-4">This means:</p>
            <ul className="mt-3 ml-4 list-disc space-y-1.5">
              <li>The website will still work</li>
              <li>You can still view pages</li>
              <li>You can still start a trial or contact us</li>
              <li>We will not use optional analytics cookies to track your visit</li>
              <li>We will not use marketing pixels such as Meta Pixel or LinkedIn Insight Tag for your visit</li>
              <li>Our reporting may be less accurate</li>
            </ul>
            <p className="mt-4">
              Strictly necessary cookies may still be used because they are required for the website to function and to remember your cookie choice.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-950">Managing your cookie choices</h2>
            <p className="mt-4">
              You can change your cookie preferences at any time by using the{" "}
              <OpenCookiePrefButton />{" "}
              link on our website.
            </p>
            <p className="mt-4">
              You can also manage or block cookies through your browser settings. However, blocking some cookies may affect how the website works.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-950">Third-party tools</h2>
            <p className="mt-4">
              Some cookies and tracking technologies are provided by third-party services. These providers may process data according to their own privacy policies.
            </p>
            <p className="mt-4">We may use services including:</p>
            <ul className="mt-3 ml-4 list-disc space-y-1.5">
              <li>Google Analytics 4</li>
              <li>Microsoft Clarity</li>
              <li>Meta Pixel</li>
              <li>LinkedIn Insight Tag</li>
              <li>Google advertising tags, if enabled</li>
            </ul>
            <p className="mt-4">
              We recommend reviewing the privacy policies of these providers if you want more information about how they handle data.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-950">Changes to this Cookie Policy</h2>
            <p className="mt-4">
              We may update this Cookie Policy from time to time. Any changes will be posted on this page with an updated &ldquo;Last updated&rdquo; date.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-950">Contact us</h2>
            <p className="mt-4">
              If you have any questions about this Cookie Policy or how QuoteCore+ uses cookies, contact us at:{" "}
              <a href="mailto:info@quote-core.com" className="underline underline-offset-2 hover:text-zinc-950">
                info@quote-core.com
              </a>
            </p>
          </section>

        </div>
      </div>
      <SiteFooter />
    </main>
  );
}
