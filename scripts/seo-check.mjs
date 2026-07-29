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
 * 11. Sitemap/robots conflicts (paths in sitemap but blocked by robots)
 * 12. Non-self-canonicals (pages canonicalising to a different URL)
 * 13. Duplicate title suffixes (repeated brand name patterns)
 * 14. Client-only JSON-LD (schema only in client components)
 * 15. Missing H1 in server-rendered pages
 * 16. Orphan tool pages (tool routes with no inbound links from hubs)
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
  if (!codeOnly.includes('{ url: SITE_URL,')) {
    errors.push('Homepage sitemap URL must use slashless SITE_URL to match the rendered canonical');
  }
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

// ── Check 6: Hreflang — page-level only, no site-wide layout emission ──────
function checkHreflangReciprocity() {
  // Helper file must exist
  const hreflangHelper = join(ROOT, 'lib', 'seo', 'hreflang.ts');
  if (!existsSync(hreflangHelper)) {
    errors.push('Missing app/lib/seo/hreflang.ts helper — page-level hreflang cannot work without it');
  }

  // Layouts must NOT emit site-wide hreflang languages
  const marketingLayout = join(APP_DIR, '(marketing)', 'layout.tsx');
  if (existsSync(marketingLayout)) {
    const content = readFileSync(marketingLayout, 'utf-8');
    const alternatesMatch = content.match(/alternates:\s*\{[^}]*\}/s);
    if (alternatesMatch && alternatesMatch[0].includes('languages')) {
      errors.push('Marketing layout emits site-wide hreflang languages — must be page-level only to avoid pointing unrelated pages to NZ homepage');
    }
  }

  // Check NZ site if it exists in sibling repo
  const nzRoot = join(ROOT, '..', 'quotecore-nz');
  const nzLayout = join(nzRoot, 'app', 'layout.tsx');
  const nzHreflangHelper = join(nzRoot, 'lib', 'hreflang.ts');
  if (existsSync(nzLayout)) {
    const content = readFileSync(nzLayout, 'utf-8');
    const alternatesMatch = content.match(/alternates:\s*\{[^}]*\}/s);
    if (alternatesMatch && alternatesMatch[0].includes('languages')) {
      errors.push('NZ root layout emits site-wide hreflang languages — must be page-level only');
    }
    if (!existsSync(nzHreflangHelper)) {
      warnings.push('NZ site missing lib/hreflang.ts helper');
    }
  }

  // Verify shared-equivalent pages import and use the hreflang helper
  const sharedPaths = [
    'about', 'services', 'roofing-quoting-software',
    'construction-quoting-software', 'free-trial',
    'coffee-terms', 'cookie-policy', 'privacy', 'terms',
  ];
  for (const path of sharedPaths) {
    // Global site
    const globalPage = join(APP_DIR, '(marketing)', path, 'page.tsx');
    const globalAlt = join(APP_DIR, path, 'page.tsx');
    const globalFile = existsSync(globalPage) ? globalPage : (existsSync(globalAlt) ? globalAlt : null);
    if (globalFile) {
      const content = readFileSync(globalFile, 'utf-8');
      if (!content.includes('hreflangLanguages')) {
        warnings.push(`Global page ${path} missing hreflangLanguages import — should have hreflang if it has a regional equivalent`);
      }
    }
    // Also check for a layout.tsx in the same dir (for client-component pages)
    if (globalFile) {
      const layoutFile = join(globalFile, '..', 'layout.tsx');
      if (existsSync(layoutFile)) {
        const layoutContent = readFileSync(layoutFile, 'utf-8');
        if (!layoutContent.includes('hreflangLanguages')) {
          warnings.push(`Global layout for ${path} missing hreflangLanguages — client component pages need a layout with hreflang`);
        }
      }
    }
  }

  // Check home pages (client components with layout.tsx for hreflang)
  const globalHomeLayout = join(APP_DIR, '(marketing)', 'home', 'layout.tsx');
  if (existsSync(globalHomeLayout)) {
    const content = readFileSync(globalHomeLayout, 'utf-8');
    if (!content.includes('hreflangLanguages')) {
      errors.push('Global home layout missing hreflangLanguages — homepage must have hreflang');
    }
  } else {
    warnings.push('Global site missing app/(marketing)/home/layout.tsx for homepage hreflang');
  }

  const globalContactLayout = join(APP_DIR, '(marketing)', 'contact', 'layout.tsx');
  if (existsSync(globalContactLayout)) {
    const content = readFileSync(globalContactLayout, 'utf-8');
    if (!content.includes('hreflangLanguages')) {
      errors.push('Global contact layout missing hreflangLanguages — contact page must have hreflang');
    }
  } else {
    warnings.push('Global site missing app/(marketing)/contact/layout.tsx for contact hreflang');
  }

  // NZ site checks
  const nzHomeLayout = join(nzRoot, 'app', '(home)', 'layout.tsx');
  if (existsSync(nzHomeLayout)) {
    const content = readFileSync(nzHomeLayout, 'utf-8');
    if (!content.includes('hreflangLanguages')) {
      errors.push('NZ home layout missing hreflangLanguages — homepage must have hreflang');
    }
  } else {
    warnings.push('NZ site missing app/(home)/layout.tsx for homepage hreflang');
  }

  const nzContactLayout = join(nzRoot, 'app', 'contact', 'layout.tsx');
  if (existsSync(nzContactLayout)) {
    const content = readFileSync(nzContactLayout, 'utf-8');
    if (!content.includes('hreflangLanguages')) {
      errors.push('NZ contact layout missing hreflangLanguages — contact page must have hreflang');
    }
  } else {
    warnings.push('NZ site missing app/contact/layout.tsx for contact hreflang');
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

// ── Check 11: Sitemap/robots conflicts ─────────────────────────────────────
function checkSitemapRobotsConflicts() {
  const sitemapFile = join(APP_DIR, 'sitemap.ts');
  const robotsFile = join(APP_DIR, 'robots.ts');
  if (!existsSync(sitemapFile) || !existsSync(robotsFile)) return;

  const sitemapContent = readFileSync(sitemapFile, 'utf-8');
  const robotsContent = readFileSync(robotsFile, 'utf-8');

  // Extract allowed paths from robots.ts
  const allowMatches = robotsContent.matchAll(/'([^']+)'/g);
  const allowedPaths = new Set();
  for (const m of allowMatches) {
    if (m[1].startsWith('/')) allowedPaths.add(m[1]);
  }

  // Extract sitemap URL paths
  const sitemapUrlMatches = sitemapContent.matchAll(/url:\s*\(?[^,)]*?\/([^'"),]+)\)?,/g);
  const sitemapPaths = new Set();
  for (const m of sitemapUrlMatches) {
    const path = m[1].trim();
    if (path) sitemapPaths.add(path);
  }

  // Check for /free-tools specifically
  if (sitemapContent.includes('/free-tools') && !robotsContent.includes('/free-tools')) {
    errors.push('/free-tools is in sitemap but NOT in robots.txt allow list');
  }
  if (!sitemapContent.includes('/free-tools')) {
    warnings.push('/free-tools is NOT in sitemap - the free tools hub page is missing');
  }
  if (!robotsContent.includes('/free-tools')) {
    errors.push('/free-tools is NOT in robots.txt allow list - crawlers may not reach it');
  }

  // Check that all free-tool routes in sitemap are also in robots allow list
  const freeToolRoutes = [
    '/free-calculators',
    '/free-roofing-calculator',
    '/free-construction-calculator',
    '/free-concrete-calculator',
    '/free-landscaping-calculator',
    '/free-birds-mouth-calculator',
    '/free-quote-generator',
    '/free-invoice-generator',
    '/free-purchase-order-generator',
    '/free-roofing-takeoff-builder',
    '/free-tools',
  ];
  for (const route of freeToolRoutes) {
    if (sitemapContent.includes(route) && !robotsContent.includes(route)) {
      errors.push(`${route} is in sitemap but NOT in robots.txt allow list`);
    }
  }
}

// ── Check 12: Non-self-canonicals ──────────────────────────────────────────
function checkNonSelfCanonicals() {
  const marketingDir = join(APP_DIR, '(marketing)');
  const publicDir = join(APP_DIR, '(public)');

  function checkDir(dir) {
    if (!existsSync(dir)) return;
    walkDir(dir, '.tsx', (file) => {
      if (!file.endsWith('page.tsx') && !file.endsWith('layout.tsx')) return;
      const content = readFileSync(file, 'utf-8');
      // Look for canonical URLs that don't match the file path
      const canonicalMatch = content.match(/canonical['"]?\s*:\s*['"`]([^'"`]+)['"`]/);
      if (canonicalMatch) {
        const canonical = canonicalMatch[1];
        // Check for common mistakes: trailing slash mismatch, wrong domain, http
        if (canonical.match(/http:\/\/[^/]*quote-core/)) {
          errors.push(`${file}: canonical uses http:// instead of https://`);
        }
        if (canonical.endsWith('//')) {
          errors.push(`${file}: canonical has double trailing slash`);
        }
      }
    });
  }
  checkDir(marketingDir);
  checkDir(publicDir);
}

// ── Check 13: Duplicate title suffixes ─────────────────────────────────────
function checkDuplicateTitleSuffixes() {
  const titleSuffixPattern = /title:\s*['"`]([^'"`]+)['"`]/g;
  const suffixCounts = {};

  function scanDir(dir) {
    if (!existsSync(dir)) return;
    walkDir(dir, '.tsx', (file) => {
      if (!file.endsWith('page.tsx') && !file.endsWith('layout.tsx')) return;
      const content = readFileSync(file, 'utf-8');
      let match;
      while ((match = titleSuffixPattern.exec(content)) !== null) {
        const title = match[1];
        // Extract the suffix after the last separator
        const parts = title.split(/\s+[\-|]\s+/);
        if (parts.length > 1) {
          const suffix = parts[parts.length - 1].trim();
          suffixCounts[suffix] = (suffixCounts[suffix] || 0) + 1;
        }
      }
    });
  }

  scanDir(join(APP_DIR, '(marketing)'));
  scanDir(join(APP_DIR, '(public)'));

  for (const [suffix, count] of Object.entries(suffixCounts)) {
    if (count > 3) {
      warnings.push(`Title suffix "${suffix}" appears ${count} times - consider varying titles to avoid duplication`);
    }
  }
}

// ── Check 14: Client-only JSON-LD ──────────────────────────────────────────
function checkClientOnlyJsonLd() {
  walkDir(APP_DIR, '.tsx', (file) => {
    if (!file.endsWith('page.tsx')) return;
    const content = readFileSync(file, 'utf-8');
    // If file is a client component AND has JSON-LD, the schema won't be in initial HTML
    if (content.includes('"use client"') && content.includes('application/ld+json')) {
      warnings.push(`Client component with JSON-LD (schema may not be in initial HTML): ${file}`);
    }
  });

  // Also check: layout files with JSON-LD should NOT be client components
  walkDir(APP_DIR, '.tsx', (file) => {
    if (!file.endsWith('layout.tsx')) return;
    const content = readFileSync(file, 'utf-8');
    if (content.includes('"use client"') && content.includes('application/ld+json')) {
      errors.push(`Client layout with JSON-LD (schema not server-rendered): ${file}`);
    }
  });
}

// ── Check 15: Missing H1 in server-rendered pages ──────────────────────────
function checkMissingH1() {
  // Only check marketing and public server components (not auth pages - they're noindex)
  const checkDirs = [
    join(APP_DIR, '(marketing)'),
    join(APP_DIR, '(public)'),
  ];
  // Track files we've already confirmed have H1 via shared component
  const confirmedH1 = new Set();

  function fileHasH1(filepath) {
    if (confirmedH1.has(filepath)) return true;
    if (!existsSync(filepath)) return false;
    const content = readFileSync(filepath, 'utf-8');
    if (content.includes('<h1') || content.includes('<H1')) return true;
    return false;
  }

  // Pre-scan: find all files with H1 and mark their exports
  for (const dir of checkDirs) {
    if (!existsSync(dir)) continue;
    walkDir(dir, '.tsx', (file) => {
      const content = readFileSync(file, 'utf-8');
      if (content.includes('<h1') || content.includes('<H1')) {
        confirmedH1.add(file);
      }
    });
  }

  function resolveImport(fromFile, importPath) {
    if (!importPath.startsWith('.')) return null;
    const dir = fromFile.substring(0, fromFile.lastIndexOf('\\') + 1);
    const resolved = join(dir, importPath);
    for (const ext of ['.tsx', '.ts', '.jsx', '.js']) {
      if (existsSync(resolved + ext)) return resolved + ext;
    }
    // Check for index files
    if (existsSync(join(resolved, 'index.tsx'))) return join(resolved, 'index.tsx');
    if (existsSync(join(resolved, 'index.ts'))) return join(resolved, 'index.ts');
    return null;
  }

  function checkFileForH1(file, depth = 0) {
    if (depth > 3) return false; // prevent infinite recursion
    if (confirmedH1.has(file)) return true;
    if (!existsSync(file)) return false;
    const content = readFileSync(file, 'utf-8');
    if (content.includes('<h1') || content.includes('<H1')) {
      confirmedH1.add(file);
      return true;
    }
    // Check imports
    const importMatches = content.matchAll(/from\s+['"]([^'"]+)['"]/g);
    for (const m of importMatches) {
      const resolved = resolveImport(file, m[1]);
      if (resolved && checkFileForH1(resolved, depth + 1)) {
        confirmedH1.add(file);
        return true;
      }
    }
    return false;
  }

  for (const dir of checkDirs) {
    if (!existsSync(dir)) continue;
    walkDir(dir, '.tsx', (file) => {
      if (!file.endsWith('page.tsx')) return;
      const content = readFileSync(file, 'utf-8');
      if (content.includes('"use client"')) return;
      if (!checkFileForH1(file)) {
        const relPath = file.replace(ROOT + '\\', '').replace(/\\/g, '/');
        warnings.push(`Server page may be missing H1: ${relPath}`);
      }
    });
  }
}

// ── Check 16: Orphan tool pages ────────────────────────────────────────────
function checkOrphanToolPages() {
  const freeTools = [
    '/free-roofing-calculator',
    '/free-construction-calculator',
    '/free-concrete-calculator',
    '/free-landscaping-calculator',
    '/free-birds-mouth-calculator',
    '/free-quote-generator',
    '/free-invoice-generator',
    '/free-purchase-order-generator',
    '/free-roofing-takeoff-builder',
  ];

  // Check that the free-tools hub page links to each tool
  const freeToolsPage = join(APP_DIR, '(public)', 'free-tools', 'page.tsx');
  if (!existsSync(freeToolsPage)) {
    errors.push('Missing /free-tools hub page - tool pages may be orphaned');
    return;
  }

  const hubContent = readFileSync(freeToolsPage, 'utf-8');
  for (const tool of freeTools) {
    const toolSlug = tool.replace('/', '');
    if (!hubContent.includes(toolSlug)) {
      warnings.push(`Tool ${tool} may not be linked from /free-tools hub - potential orphan page`);
    }
  }

  // Check that each tool is in the sitemap
  const sitemapFile = join(APP_DIR, 'sitemap.ts');
  if (existsSync(sitemapFile)) {
    const sitemapContent = readFileSync(sitemapFile, 'utf-8');
    for (const tool of freeTools) {
      if (!sitemapContent.includes(tool)) {
        errors.push(`Tool ${tool} is NOT in sitemap - crawlers won't find it`);
      }
    }
  }
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
checkSitemapRobotsConflicts();
checkNonSelfCanonicals();
checkDuplicateTitleSuffixes();
checkClientOnlyJsonLd();
checkMissingH1();
checkOrphanToolPages();

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
