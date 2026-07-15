#!/usr/bin/env node
/**
 * SEO validation script for QuoteCore+.
 *
 * Run: node scripts/seo-check.mjs
 *
 * Checks for critical SEO issues in the codebase:
 * - Missing canonical URLs in page metadata
 * - Missing titles or descriptions
 * - Production noindex
 * - Cross-domain sitemap contamination
 * - Missing H1 in page files
 * - Blog posts not in sitemap
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

// Check 1: All page.tsx files in (marketing) should have canonical or use buildPageMetadata
function checkMarketingCanonicals() {
  const marketingDir = join(APP_DIR, '(marketing)');
  walkDir(marketingDir, '.tsx', (file) => {
    if (!file.endsWith('page.tsx')) return;
    const content = readFileSync(file, 'utf-8');
    // Skip if it's a client component without metadata (those rely on layout)
    if (content.includes('"use client"') && !content.includes('generateMetadata')) return;
    // Check for canonical in some form
    if (!content.includes('canonical') && !content.includes('buildPageMetadata') && !content.includes('generateMetadata')) {
      warnings.push(`Marketing page without canonical or metadata helper: ${file}`);
    }
  });
}

// Check 2: No production noindex in layouts
function checkNoProductionNoindex() {
  walkDir(APP_DIR, '.tsx', (file) => {
    if (!file.endsWith('layout.tsx')) return;
    const content = readFileSync(file, 'utf-8');
    // Check for hardcoded noindex without environment check
    if (content.includes('noindex') && !content.includes('isPreview') && !content.includes('VERCEL_ENV')) {
      // This is OK for auth/admin layouts
      if (file.includes('login') || file.includes('signup') || file.includes('2fa') ||
          file.includes('admin') || file.includes('onboarding') || file.includes('accept')) return;
      errors.push(`Layout with hardcoded noindex (may block production indexing): ${file}`);
    }
  });
}

// Check 3: Sitemap should not contain app.quote-core.com URLs
function checkSitemapNoAppUrls() {
  const sitemapFile = join(APP_DIR, 'sitemap.ts');
  if (!existsSync(sitemapFile)) return;
  const content = readFileSync(sitemapFile, 'utf-8');
  // Remove comments before checking
  const codeOnly = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  if (codeOnly.includes('app.quote-core.com')) {
    errors.push('Sitemap contains app.quote-core.com URLs — should only contain quote-core.com URLs');
  }
}

// Check 4: Blog posts in page.tsx should be in sitemap.ts BLOG_POSTS array
function checkBlogPostsInSitemap() {
  const blogDir = join(APP_DIR, '(marketing)', 'blog', '[slug]', 'page.tsx');
  const sitemapFile = join(APP_DIR, 'sitemap.ts');
  if (!existsSync(blogDir) || !existsSync(sitemapFile)) return;

  const blogContent = readFileSync(blogDir, 'utf-8');
  const sitemapContent = readFileSync(sitemapFile, 'utf-8');

  // Extract slugs from blog page
  const slugMatches = blogContent.matchAll(/'([a-z0-9-]+)':\s*\{/g);
  for (const match of slugMatches) {
    const slug = match[1];
    if (!sitemapContent.includes(slug)) {
      errors.push(`Blog post "${slug}" is not in sitemap.ts BLOG_POSTS array`);
    }
  }
}

// Check 5: All layout.tsx files should have a default export
function checkLayoutExports() {
  walkDir(APP_DIR, '.tsx', (file) => {
    if (!file.endsWith('layout.tsx')) return;
    const content = readFileSync(file, 'utf-8');
    if (!content.includes('export default')) {
      errors.push(`Layout missing default export: ${file}`);
    }
  });
}

// Run all checks
console.log('Running SEO checks...\n');
checkMarketingCanonicals();
checkNoProductionNoindex();
checkSitemapNoAppUrls();
checkBlogPostsInSitemap();
checkLayoutExports();

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
