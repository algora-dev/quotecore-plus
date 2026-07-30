# QuoteCore+ - Agent Onboarding & Git Workflow

> **For: Barry (SEO/Content Agent)**
> **From: Gavin (Dev Lead, QuoteCore+)**
> **Date: 2026-07-30**
> **Read this entire document before touching the repo.**

---

## What You Need to Know

You're joining a multi-agent team working on the QuoteCore+ codebase (a construction/roofing quoting SaaS). There are three agents:

- **Gavin** (dev lead) - builds app features, manages deploys, owns this workflow
- **Ron** (SEO agent) - blog posts, schema, accessibility, performance
- **Barry** (you) - SEO content and copy

All three of you push to the **same Git repo** and deploy to the **same Vercel projects**. If everyone doesn't follow the rules below, things break. On 2026-07-29, Ron pushed to the wrong branch and overwrote the live production site with broken code. That's why this doc exists.

---

## Repo Access

- **GitHub repo:** `https://github.com/algora-dev/quotecore-plus`
- **Your working copy:** wherever your agent workspace has it cloned (typically `projects/quotecore-plus` inside your workspace folder)

If you don't have the repo cloned yet:
```bash
git clone https://github.com/algora-dev/quotecore-plus.git
cd quotecore-plus
git checkout development
git pull origin development
```

---

## Branch Strategy (CRITICAL)

| Branch | Purpose | Who can push |
|--------|---------|-------------|
| `main` | Production - runs on quote-core.com | **NOBODY pushes directly.** Only merged from `development` with Shaun's explicit approval. |
| `development` | Active development - all agents push here | All agents. Pull before pushing. |

### The One Rule That Matters Most

**`main` is sacred.** You NEVER push to `main`. You NEVER commit to `main`. You NEVER merge anything into `main` unless Shaun explicitly says "merge to main" or "ship to production."

All your work goes on `development`. Period.

---

## Setup: First Time Getting Started

### Step 1 - Make sure you're on `development`

```bash
cd <your-workspace>/projects/quotecore-plus
git branch
```

If it says `* main`, switch:
```bash
git fetch origin
git checkout development
git pull origin development
```

### Step 2 - Verify you have the latest code

```bash
git log --oneline -5
```

You should see recent commits from Gavin and Ron. If you don't, something's wrong with your remote - ask for help.

### Step 3 - Install dependencies (if you haven't already)

```bash
npm install
```

### Step 4 - You're ready to work

Create your SEO content, make your changes, then follow the "Pushing Your Work" section below.

---

## Pushing Your Work (Every Time)

**Follow these steps EVERY TIME you push, no exceptions:**

```bash
# 1. Commit your changes
git add .
git commit -m "your descriptive commit message"

# 2. PULL before you push (someone else may have pushed while you were working)
git pull origin development

# 3. If there are merge conflicts, resolve them in your editor, then:
git add .
git commit -m "resolve merge conflicts"

# 4. NOW push
git push origin development
```

**Never skip step 2.** If Gavin or Ron pushed since your last pull and you push without pulling first, your push will be rejected. If you force-push to get around this, you can destroy someone else's work.

---

## Vercel Deploy Projects

| Project | URL | What It Is |
|---------|-----|------------|
| `quotecore-plus-main` | **quote-core.com** | Production site. Auto-deploys when `main` is pushed. You do NOT touch this. |
| `quotecore-plus-testing` | **quotecore-plus-testing.vercel.app** | Testing/staging site. This is where we verify changes before they go live. |
| `quotecore-plus-dev` (DEAD) | quotecore-plus.vercel.app | Old redirect. Do NOT deploy here. |

### Where to find the latest build

- **Testing site (latest development code):** https://quotecore-plus-testing.vercel.app
- **Production site (what customers see):** https://quote-core.com

The testing site always has the latest `development` code. Production only updates when Shaun approves a merge to `main`.

### Deploying to testing (optional - Gavin usually does this)

If you need to see your changes on the testing site:
```bash
npx vercel deploy --prod --yes --token=$VERCEL_TOKEN --scope=team_ytKOw7arzb6HIeVI7yYjpD7h
```

**Never use `vercel promote`.** It rebuilds from `main`, which may not have the latest `development` code.

---

## What Happens When You Push to `development`

1. Your code goes to the `development` branch on GitHub
2. A GitHub Action fires a Vercel deploy hook that triggers a build on `quotecore-plus-testing`
3. Gavin (or you) can verify the changes on the testing site
4. When Shaun is happy with the testing site, he tells Gavin to merge `development` -> `main`
5. That merge auto-deploys to quote-core.com (production)

```
development (you push here)
    |
    |  (Shaun approves)
    v
   main (auto-deploys to quote-core.com)
```

---

## If You Have Commits on `main` Already

If you've already been working on `main` and have unpushed commits there, **do not push them to main**. Move them to development:

```bash
# Don't push to main! Move them to development:
git checkout development
git pull origin development
git cherry-pick <commit-hash>  # repeat for each commit
git push origin development
```

If you have uncommitted changes on `main`:
```bash
git stash
git checkout development
git pull origin development
git stash pop
# Resolve any conflicts, then commit to development
```

---

## Quick Reference

| What you want to do | Command |
|---------------------|---------|
| Check which branch I'm on | `git branch` |
| Switch to development | `git checkout development` |
| Get latest code | `git pull origin development` |
| Push my work | `git pull origin development && git push origin development` |
| Check what changed | `git status` |
| See recent commits | `git log --oneline -10` |

---

## Rules Summary

1. **`main` is read-only.** No direct commits, no direct pushes. Ever.
2. **Always work on `development`.** Check your branch before you start working.
3. **Always `git pull origin development` before pushing.** Every single time.
4. **Never `vercel promote`.** Use `vercel deploy --prod` if you need to deploy.
5. **Never deploy to `quotecore-plus-dev`** (quotecore-plus.vercel.app). It's a dead redirect.
6. **If you're unsure about anything, ask Gavin.** Don't guess - a wrong push to `main` breaks the live site.

---

## Questions?

If anything in this doc is unclear or you hit an edge case, ask Gavin (dev lead for QuoteCore+). Don't guess - a wrong push breaks the live site for real customers.

---

*This document supersedes any previous workflow instructions. If you were given different instructions before, follow THIS document instead.*
