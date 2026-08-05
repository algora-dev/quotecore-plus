# Google Search Console Setup Guide — QuoteCore+

**Date:** 2026-07-15  
**Prepared by:** Gavin  
**Audience:** Shaun  
**Estimated time:** 30–45 minutes

---

## Overview

Google Search Console (GSC) needs to be set up for both QuoteCore+ public websites. This guide walks you through creating the properties, verifying ownership, submitting sitemaps, and running initial URL inspections.

---

## 1. Properties to Create

Create **two separate properties** in Google Search Console:

| Property | Type | URL |
|----------|------|-----|
| Global site | URL prefix or Domain | `quote-core.com` (domain) or `https://quote-core.com/` (URL prefix) |
| NZ site | URL prefix or Domain | `quote-core.co.nz` (domain) or `https://www.quote-core.co.nz/` (URL prefix) |

**Recommended:** Use **Domain** property type for both. This covers all subdomains and both http/https automatically.

> **Note:** If you use the Domain property type, you'll need DNS verification (below). If you use URL prefix, you can verify via HTML meta tag or HTML file upload, but you'll need separate properties for `www` and non-`www`.

---

## 2. Verification Method (DNS TXT Record — Recommended)

### Step-by-step:

1. Go to [Google Search Console](https://search.google.com/search-console).
2. Click **Add property** → select **Domain**.
3. Enter `quote-core.com` → Continue.
4. Google will display a **DNS TXT record** to add. It looks like:
   ```
   google-site-verification=ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789
   ```
5. **Copy this value.**
6. Log in to your **DNS provider** (wherever you manage quote-core.com DNS — likely Vercel, Cloudflare, or your registrar).
7. Add a new **TXT record**:
   - **Type:** TXT
   - **Name/Host:** `@` (root domain)
   - **Value:** the verification string from step 4
   - **TTL:** Default / Automatic
8. Save the DNS record.
9. Back in Google Search Console, click **Verify**.
10. DNS propagation may take a few minutes to an hour. If verification fails, wait 10 minutes and retry.

### Repeat for the NZ site:

1. Add property → Domain → enter `quote-core.co.nz`.
2. Get the DNS TXT verification string.
3. Add TXT record to the `quote-core.co.nz` DNS zone.
4. Verify in GSC.

> **Alternative verification (if DNS is not feasible):** Use URL prefix property type + HTML meta tag. The QuoteCore+ root layout already includes a `<meta>` tag mechanism. Contact Gavin if you prefer this route.

---

## 3. Sitemap Submission

Once both properties are verified, submit the sitemaps.

### Global site (`quote-core.com`):

1. Select the `quote-core.com` property in GSC.
2. Go to **Sitemaps** (left sidebar).
3. Enter `sitemap.xml` in the input field.
4. Click **Submit**.
5. The full URL Google will fetch is: `https://quote-core.com/sitemap.xml`
6. Expected: ~166 URLs discovered.

### NZ site (`quote-core.co.nz`):

1. Select the `quote-core.co.nz` property in GSC.
2. Go to **Sitemaps**.
3. Enter `sitemap.xml`.
4. Click **Submit**.
5. The full URL Google will fetch is: `https://www.quote-core.co.nz/sitemap.xml`
6. Expected: 12 URLs discovered.

**What to check after submission:**
- Status should show **"Success"** within 24–48 hours.
- "Discovered URLs" should match the expected counts.
- If status shows "Has errors," click the sitemap to see details and share with Gavin.

---

## 4. Representative URLs to Inspect

After sitemap submission, use **URL Inspection** tool in GSC for the following key URLs. This tells Google to crawl them sooner and reveals any issues.

### Global site — inspect these 10 URLs:

| # | URL | Why |
|---|-----|-----|
| 1 | `https://quote-core.com/` | Homepage — primary landing |
| 2 | `https://quote-core.com/blog` | Blog index — content hub |
| 3 | `https://quote-core.com/blog/best-roofing-quoting-software-uk-2026` | Key blog post with FAQPage schema |
| 4 | `https://quote-core.com/roofing-quoting-software` | Primary product page |
| 5 | `https://quote-core.com/construction-quoting-software` | Secondary product page |
| 6 | `https://quote-core.com/free-roofing-calculator` | Main free tool — has WebApplication + FAQPage schema |
| 7 | `https://quote-core.com/free-calculators` | Free tools hub |
| 8 | `https://quote-core.com/docs` | Documentation index |
| 9 | `https://quote-core.com/about` | About page |
| 10 | `https://quote-core.com/free-trial` | Conversion page |

### NZ site — inspect these 8 URLs:

| # | URL | Why |
|---|-----|-----|
| 1 | `https://www.quote-core.co.nz/` | NZ homepage |
| 2 | `https://www.quote-core.co.nz/roofing-quoting-software` | NZ product page |
| 3 | `https://www.quote-core.co.nz/construction-quoting-software` | NZ product page |
| 4 | `https://www.quote-core.co.nz/pricing` | NZ pricing (NZD) |
| 5 | `https://www.quote-core.co.nz/free-trial` | NZ conversion page |
| 6 | `https://www.quote-core.co.nz/about` | NZ about |
| 7 | `https://www.quote-core.co.nz/contact` | NZ contact |
| 8 | `https://www.quote-core.co.nz/services` | NZ services |

**How to inspect:**
1. Copy the URL from the table above.
2. Paste it into the **URL Inspection** bar at the top of GSC.
3. Press Enter.
4. Wait for the inspection to complete (can take 10–30 seconds).
5. Click **Request indexing** if the URL is not yet indexed.
6. Note any warnings or errors shown.

---

## 5. What to Check in Search Console

### A. Indexing Reports

Go to **Pages** (under "Indexing" in the left sidebar):

- **Indexed pages:** Should grow over time as Google crawls the sitemaps.
- **Not indexed:** Review reasons. Common ones for new sites:
  - "Crawled — currently not indexed" (normal for new sites, will resolve)
  - "Discovered — currently not indexed" (normal, will resolve)
  - "Duplicate without user-selected canonical" (check canonical tags if this appears)
- **Excluded by robots.txt:** Should only show `/api/`, `/login`, `/signup`, `/admin` etc.

### B. URL Inspection

For each URL you inspect, check:
- **Coverage:** "URL is on Google" (green) or not.
- **Canonical URL:** Should match the URL exactly (no www/non-www mismatches).
- **Mobile usability:** "Page is mobile friendly."
- **Structured data:** Click "Inspect" → see if any schema errors are reported.

### C. Core Web Vitals

Go to **Core Web Vitals** (under "Experience"):
- This data populates over time (requires real user visits).
- Check back after 2–4 weeks of organic traffic.
- Look for "Poor" URLs and share with Gavin if any appear.

### D. Manual Actions

Go to **Security & Manual Actions** → **Manual actions**:
- Should show "No issues detected."
- If any manual actions appear, share the details with Gavin immediately.

### E. Sitemaps

Go to **Sitemaps**:
- Both sitemaps should show "Success" status.
- "Last read" date should update within 24–48 hours of submission.
- "Discovered URLs" should match expected counts (166 global, 12 NZ).

### F. Links

Go to **Links** (after a few weeks):
- **External links:** Monitor which sites link to you.
- **Internal links:** Verify Google sees the internal link structure.
- **Top linked pages:** Should include homepage, free tools, and blog posts.

---

## 6. What to Send Back to Gavin

After completing the setup, please share the following with Gavin:

### Required:

1. **Screenshot of both properties verified** in GSC dashboard (showing both `quote-core.com` and `quote-core.co.nz`).
2. **Screenshot of sitemap submission status** for both properties (Sitemaps page showing "Success" and discovered URL counts).
3. **Screenshot of URL Inspection results** for at least the homepage of each site (showing "URL is on Google" or indexing status).

### Helpful (if you have time):

4. Screenshot of the **Pages** indexing report for both properties (after 24–48 hours).
5. Any **errors or warnings** shown in URL Inspection for the representative URLs.
6. Screenshot of **Manual actions** page (should show "No issues detected").

### Format:

You can share screenshots directly in Telegram. Gavin will review and advise on any issues.

---

## 7. Troubleshooting

| Issue | Solution |
|-------|----------|
| DNS verification fails | DNS propagation can take up to 1 hour. Wait and retry. Check the TXT record is correct in your DNS provider. |
| Sitemap shows "Has errors" | Share the error details with Gavin. Likely cause: a URL in the sitemap returns non-200 status. |
| URL Inspection shows "Duplicate without user-selected canonical" | Share the URL with Gavin. This means Google found a duplicate and the canonical isn't being respected. |
| Structured data errors in URL Inspection | Share the specific error with Gavin. Common: missing required field in schema. |
| "Crawled — currently not indexed" | Normal for new sites. Google has found the page but hasn't decided to index it yet. This resolves over time as the site gains authority. |

---

## 8. Quick Checklist

- [ ] Create GSC property for `quote-core.com` (Domain type)
- [ ] Create GSC property for `quote-core.co.nz` (Domain type)
- [ ] Add DNS TXT records for verification
- [ ] Verify both properties in GSC
- [ ] Submit `sitemap.xml` for `quote-core.com`
- [ ] Submit `sitemap.xml` for `quote-core.co.nz`
- [ ] Inspect 10 representative global URLs
- [ ] Inspect 8 representative NZ URLs
- [ ] Check Pages indexing report (after 24–48 hours)
- [ ] Check Manual actions (should be clean)
- [ ] Send screenshots to Gavin
