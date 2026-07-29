# QuoteCore+ Git & Deploy Workflow — ALL AGENTS

> **Read this before your first commit. Re-read if anything changes.**
> **Last updated: 2026-07-29 by Gavin (team lead for QuoteCore+)**

---

## The Problem This Solves

On 2026-07-29, Ron (SEO agent) was pushing directly to `main`, which triggered auto-deploys on the `quotecore-plus-main` Vercel project. Meanwhile Gavin (dev agent) was working on `development` and deploying to the testing project. Ron's pushes to `main` overwrote the production site with code that didn't have Gavin's app fixes. This caused broken features on the live site and wasted hours of debugging.

**This must never happen again.** This document defines the workflow for ALL agents working on the QuoteCore+ repo.

---

## Repo & Branch Strategy

### Branches

| Branch | Purpose | Who can push |
|--------|---------|-------------|
| `main` | Production — what runs on quote-core.com | **NOBODY pushes directly.** Only merge from `development` with Shaun's explicit approval. |
| `development` | Active development — all agents push here | All agents. Pull before pushing. |
| Feature branches (optional) | For large isolated work | Create from `development`, merge back via PR or direct merge. |

### The Rule

**`main` is sacred.** It only receives merges from `development`, and only when Shaun says "merge to main" or "ship to production."

Nobody — not Gavin, not Ron, not Barry — pushes commits directly to `main`. Ever.

---

## Vercel Projects

| Project | URL | Git Integration | Branch | Purpose |
|---------|-----|-----------------|--------|---------|
| `quotecore-plus-main` | quote-core.com | Yes — auto-deploys on `main` push | `main` | Production site |
| `quotecore-plus-testing` | quotecore-plus-testing.vercel.app | **No Git integration** | N/A — manual deploy only | Testing / staging |
| `quotecore-plus-dev` (DEAD) | quotecore-plus.vercel.app | No | N/A | Redirects to quote-core.com. Will be deleted once Google delists it. Do not deploy here. |

### How to deploy

- **Testing:** `npx vercel deploy --prod --yes --token=$VERCEL_TOKEN --scope=team_ytKOw7arzb6HIeVI7yYjpD7h` (from `development` branch)
- **Production (main):** Only after Shaun approves. Merge `development` into `main`, push to `main`, Vercel auto-deploys.

---

## Workflow Per Agent

### Gavin (Dev — App Features)
1. Work on `development` branch
2. Commit changes to `development`
3. `git pull origin development` before pushing (in case Ron or Barry pushed too)
4. `git push origin development`
5. Deploy to testing: `npx vercel deploy --prod --yes --token=$VERCEL_TOKEN --scope=team_ytKOw7arzb6HIeVI7yYjpD7h`
6. Ask Shaun to verify on quotecore-plus-testing.vercel.app
7. When Shaun approves: merge `development` → `main`, push to `main` (Vercel auto-deploys to quote-core.com)

### Ron (SEO — Blog, Marketing Pages, SEO)
1. **Clone/fetch from the same repo.** Your working copy is at `workspace-ron/projects/quotecore-plus`.
2. **Switch to `development` branch:** `git checkout development`
3. **Pull latest:** `git pull origin development` — this gets Gavin's latest app code
4. Do your SEO work (blog posts, schema, accessibility, performance)
5. Commit to `development`
6. **Pull again before pushing:** `git pull origin development` (in case Gavin pushed while you were working)
7. `git push origin development`
8. Your changes are now on the testing site (Gavin deploys, or you can deploy too)
9. **NEVER push to `main` directly.** Your changes go to production only when Gavin merges `development` → `main` after Shaun approves.

### Barry (SEO — Content, Copy)
Same as Ron:
1. Work on `development` branch
2. Always `git pull origin development` before starting work AND before pushing
3. Push to `development` only
4. Never push to `main`

---

## Critical Rules

1. **`main` is read-only for all agents.** No direct commits, no direct pushes. Only merges from `development`.
2. **Always pull before push.** `git pull origin development` before `git push origin development`. If someone else pushed since your last pull, you'll get a merge conflict to resolve — this is normal, resolve it and push.
3. **If you have your own working copy** (Ron, Barry), you MUST be on `development` branch, not `main`. Check with `git branch`. If you're on `main`, switch: `git checkout development && git pull origin development`.
4. **Never use `vercel promote`.** It rebuilds from the Git-connected branch (`main`), which may not have the latest `development` code. Use `vercel deploy --prod` instead.
5. **The dead `quotecore-plus-dev` project** (quotecore-plus.vercel.app) is a redirect only. Do not deploy to it. Do not delete it yet (it's catching Google traffic).
6. **If you're unsure which branch you're on**, check: `git branch` or `git status`. The `*` shows your current branch.

---

## Setup Instructions (One-Time)

If you're an agent with your own working copy that's currently on `main`:

```bash
cd <your-workspace>/projects/quotecore-plus
git fetch origin
git checkout development
git pull origin development
# You now have all the latest code. Start working.
```

If you have uncommitted changes on `main` that you need to keep:
```bash
git stash
git checkout development
git pull origin development
git stash pop
# Resolve any conflicts, then commit to development
```

If you have commits on `main` that haven't been pushed yet:
```bash
# Don't push them to main! Move them to development:
git checkout development
git pull origin development
git cherry-pick <commit-hash>  # repeat for each commit
git push origin development
```

---

## Quick Reference

```
development (all agents push here)
    │
    │  (Shaun approves)
    ▼
   main (Vercel auto-deploys to quote-core.com)
```

**Remember:** `development` is where we build. `main` is where we ship. Shaun decides when to ship.

---

## Questions?

If anything in this doc is unclear or you hit an edge case, ask Gavin (team lead for QuoteCore+). Don't guess — a wrong push to `main` breaks the live site.
