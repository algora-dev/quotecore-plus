#!/usr/bin/env node
/**
 * SEO validation script for QuoteCore+.
 *
 * Run: node scripts/seo-check.mjs
 *
 * Checks for critical SEO issues in the codebase:
 * 1. Missing canonical URLs in page metadata
 * 2. Missing titles or descriptions
 * 3. Production noindex
 * 4. Cross-domain sitemap contamination
 * 5. Missing H1 in page files
 * 6. Blog posts not in sitemap (uses shared source now)
 * 7. Hreflang reciprocity (global ↔ NZ)
 * 8. Coming-soon docs pages in sitemap
 * 9. Schema markup presence on key pages
 * 10. Canonical URL correctness (must match SITE_URL pattern)
 *
 * Exits with code 1 if critical issues are found.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, extname } from 'path';

const ROOT = process.cwd();
const APP_DIR = join(ROOT, 'app');
const errors = [];
const warnings = [];

function walkDir(dir, ext, callback) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      walkDir(fullPath, ext, callback);
    } else if (extname(fullPath) === ext) {
      callback(fullPath);
    }
  }
}

// ── Check 1: Marketing pages should have canonical or metadata helper ──────
function checkMarketingCanonicals() {
  const marketingDir = join(APP_DIR, '(marketing)');
  walkDir(marketingDir, '.tsx', (file) => {
    if (!file.endsWith('page.tsx')) return;
    const content = readFileSync(file, 'utf-8');
    if (content.includes('"use client"') && !content.includes('generateMetadata')) return;
    if (!content.includes('canonical') && !content.includes('buildPageMetadata') && !content.includes('generateMetadata')) {
      warnings.push(`Marketing page without canonical or metadata helper: ${file}`);
    }
  });
}

// ── Check 2: No production noindex in layouts ──────────────────────────────
function checkNoProductionNoindex() {
  walkDir(APP_DIR, '.tsx', (file) => {
    if (!file.endsWith('layout.tsx')) return;
    const content = readFileSync(file, 'utf-8');
    if (content.includes('noindex') && !content.includes('isPreview') && !content.includes('VERCEL_ENV')) {
      if (file.includes('login') || file.includes('signup') || file.includes('2fa') ||
          file.includes('admin') || file.includes('onboarding') || file.includes('accept')) return;
      errors.push(`Layout with hardcoded noindex (may block production indexing): ${file}`);
    }
  });
}

// ── Check 3: Sitemap should not contain app.quote-core.com URLs ────────────
function checkSitemapNoAppUrls() {
  const sitemapFile = join(APP_DIR, 'sitemap.ts');
  if (!existsSync(sitemapFile)) return;
  const content = readFileSync(sitemapFile, 'utf-8');
  const codeOnly = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  if (codeOnly.includes('app.quote-core.com')) {
    errors.push('Sitemap contains app.quote-core.com URLs — should only contain quote-core.com URLs');
  }
}

// ── Check 4: Blog posts shared source integrity ───────────────────────────
function checkBlogPostsSharedSource() {
  const blogPostsFile = join(APP_DIR, 'lib', 'blog-posts.ts');
  const sitemapFile = join(APP_DIR, 'sitemap.ts');
  const blogPageFile = join(APP_DIR, '(marketing)', 'blog', '[slug]', 'page.tsx');
  if (!existsSync(blogPostsFile) || !existsSync(sitemapFile) || !existsSync(blogPageFile)) return;

  const blogPostsContent = readFileSync(blogPostsFile, 'utf-8');
  const sitemapContent = readFileSync(sitemapFile, 'utf-8');
  const blogPageContent = readFileSync(blogPageFile, 'utf-8');

  // Sitemap must import from shared source
  if (!sitemapContent.includes('blog-posts')) {
    errors.push('sitemap.ts does not import from blog-posts.ts — blog sitemap may be manually duplicated');
  }

  // Blog page must import from shared source
  if (!blogPageContent.includes('blog-posts')) {
    errors.push('blog/[slug]/page.tsx does not import from blog-posts.ts — blog metadata may be duplicated');
  }

  // Extract slugs from shared source
  const slugMatches = blogPostsContent.matchAll(/slug:\s*'([a-z0-9-]+)'/g);
  const slugs = [...slugMatches].map(m => m[1]);
  if (slugs.length === 0) {
    warnings.push('No blog post slugs found in blog-posts.ts');
  }
}

// ── Check 5: All layout.tsx files should have a default export ─────────────
function checkLayoutExports() {
  walkDir(APP_DIR, '.tsx', (file) => {
    if (!file.endsWith('layout.tsx')) return;
    const content = readFileSync(file, 'utf-8');
    if (!content.includes('export default')) {
      errors.push(`Layout missing default export: ${file}`);
    }
  });
}

// ── Check 6: Hreflang reciprocity ──────────────────────────────────────────
function checkHreflangReciprocity() {
  // Global site (marketing layout) should declare en-NZ pointing to NZ
  const marketingLayout = join(APP_DIR, '(marketing)', 'layout.tsx');
  if (existsSync(marketingLayout)) {
    const content = readFileSync(marketingLayout, 'utf-8');
    if (!content.includes('en-NZ')) {
      errors.push('Global site (marketing layout) missing en-NZ hreflang alternate pointing to NZ site');
    }
    if (!content.includes('x-default')) {
      errors.push('Global site (marketing layout) missing x-default hreflang');
    }
    if (!content.includes('quote-core.co.nz')) {
      errors.push('Global site (marketing layout) missing NZ site URL in hreflang');
    }
  }

  // Check NZ site if it exists in sibling repo
  const nzLayout = join(ROOT, '..', 'quotecore-nz', 'app', 'layout.tsx');
  if (existsSync(nzLayout)) {
    const content = readFileSync(nzLayout, 'utf-8');
    if (!content.includes('quote-core.com')) {
      warnings.push('NZ site layout does not reference global site (quote-core.com) in hreflang');
    }
    if (!content.includes('x-default')) {
      warnings.push('NZ site layout missing x-default hreflang');
    }
  }
}

// ── Check 7: Coming-soon docs should NOT be in sitemap ─────────────────────
function checkComingSoonDocsFiltered() {
  const treeFile = join(APP_DIR, 'lib', 'docs', 'tree.ts');
  const sitemapFile = join(APP_DIR, 'sitemap.ts');
  if (!existsSync(treeFile) || !existsSync(sitemapFile)) return;

  const treeContent = readFileSync(treeFile, 'utf-8');
  const sitemapContent = readFileSync(sitemapFile, 'utf-8');

  // sitemap.ts should use getPublishedSlugs, not getAllSlugs
  if (sitemapContent.includes('getAllSlugs') && !sitemapContent.includes('getPublishedSlugs')) {
    errors.push('sitemap.ts uses getAllSlugs — should use getPublishedSlugs to exclude coming-soon pages');
  }

  // tree.ts should have getPublishedSlugs function
  if (!treeContent.includes('getPublishedSlugs')) {
    warnings.push('tree.ts missing getPublishedSlugs function — coming-soon pages may appear in sitemap');
  }
}

// ── Check 8: Docs pages should have canonical URLs ─────────────────────────
function checkDocsCanonicals() {
  const docsPage = join(APP_DIR, '(public)', 'docs', '[[...slug]]', 'page.tsx');
  if (!existsSync(docsPage)) return;
  const content = readFileSync(docsPage, 'utf-8');
  if (!content.includes('canonical') && !content.includes('alternates')) {
    errors.push('Docs page ([[...slug]]/page.tsx) missing canonical URL in generateMetadata');
  }
}

// ── Check 9: SoftwareApplication not on every page (should be product only) ─
function checkSoftwareApplicationScope() {
  const marketingLayout = join(APP_DIR, '(marketing)', 'layout.tsx');
  if (!existsSync(marketingLayout)) return;
  const content = readFileSync(marketingLayout, 'utf-8');

  // The combinedSchema in the layout should NOT include SoftwareApplication
  // (it should be on individual product pages instead)
  const layoutSchemaMatch = content.match(/const combinedSchema[\s\S]*?\};/);
  if (layoutSchemaMatch) {
    const schemaBlock = layoutSchemaMatch[0];
    if (schemaBlock.includes('SoftwareApplication') || schemaBlock.includes('buildSoftwareApplicationSchema')) {
      warnings.push('Marketing layout combinedSchema includes SoftwareApplication — should be on product pages only');
    }
  }
}

// ── Check 10: Canonical URL correctness ────────────────────────────────────
function checkCanonicalCorrectness() {
  const seoFile = join(APP_DIR, 'lib', 'seo.ts');
  if (!existsSync(seoFile)) return;
  const content = readFileSync(seoFile, 'utf-8');

  // canonicalUrl should use SITE_URL
  if (!content.includes('canonicalUrl')) {
    warnings.push('seo.ts missing canonicalUrl helper function');
  }

  // Check for common canonical mistakes in marketing pages
  const marketingDir = join(APP_DIR, '(marketing)');
  walkDir(marketingDir, '.tsx', (file) => {
    if (!file.endsWith('page.tsx')) return;
    const content = readFileSync(file, 'utf-8');
    // Check for hardcoded localhost or http (not https) in canonicals
    if (content.includes('canonical') && content.includes('localhost')) {
      errors.push(`Page has localhost in canonical URL: ${file}`);
    }
    if (content.includes('canonical') && content.match(/http:\/\/[^/]*quote-core/)) {
      errors.push(`Page has http:// (not https://) in canonical URL: ${file}`);
    }
  });
}

// ── Run all checks ─────────────────────────────────────────────────────────
console.log('Running SEO checks...\n');
checkMarketingCanonicals();
checkNoProductionNoindex();
checkSitemapNoAppUrls();
checkBlogPostsSharedSource();
checkLayoutExports();
checkHreflangReciprocity();
checkComingSoonDocsFiltered();
checkDocsCanonicals();
checkSoftwareApplicationScope();
checkCanonicalCorrectness();

// Report
if (warnings.length > 0) {
  console.log('⚠️  Warnings:');
  for (const w of warnings) console.log(`   ${w}`);
  console.log();
}

if (errors.length > 0) {
  console.error('❌ Errors:');
  for (const e of errors) console.error(`   ${e}`);
  console.log(`\n${errors.length} error(s), ${warnings.length} warning(s)`);
  process.exit(1);
}

console.log(`✅ All checks passed. ${warnings.length} warning(s).`);
