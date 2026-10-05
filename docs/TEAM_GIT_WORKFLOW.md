# QuoteCore+ Git & Deploy Workflow — ALL AGENTS

> **Read this before your first commit. Re-read if anything changes.**
> **Last updated: 2026-08-26 by Gavin — single-push protocol (supersedes all dev-first rules)**

---

## The Single-Push Protocol (effective 2026-08-26)

**Push ONCE to the branch Shaun names. That's the whole rule.**

- **Default = `main` (direct push).** No dev-first step. No "push to dev then ask about merging". Push to `main` once, Vercel auto-deploys, Shaun tests on live.
- **`development` ONLY when Shaun explicitly says "push to dev".** It exists as the off-live backup branch for features that shouldn't hit production yet.
- **If Shaun doesn't name a branch AND the change could break auth/billing/payflows:** default to `development` and say why in one line.
- **Pull before pushing** to avoid merge commits: `git pull --rebase origin <branch>` then push.
- **Never push to development and then ask whether to merge to main.** That double-builds and wastes a Shaun round-trip. One push, to the named branch, done.
- **Batch commits.** Minimum 3 file changes per push (or a complete logical unit). Squash multiple local commits into one before pushing. Max 5 pushes per session unless Shaun approves more.
- **Never push broken code.** `next build` must pass locally first. Failed builds still burn Vercel CPU minutes.
- **Commit author email MUST be `dev.algora@gmail.com`.** Commits authored as anything else are silently blocked by Vercel (no build, no error). Set per-commit: `git -c user.name="dev.algora" -c user.email="dev.algora@gmail.com" commit`.

---

## Vercel Projects

| Project | URL | Git Integration | Branch | Purpose |
|---------|-----|-----------------|--------|---------|
| `quotecore-plus-main` | quote-core.com / app.quote-core.com | Yes — auto-deploys on `main` push | `main` | Production |
| `quotecore-plus-testing` | quotecore-plus-testing.vercel.app | Yes — production branch = `main` | `main` | Testing / verification deploys (`npx vercel --prod` from linked repo) |
| `quotecore-plus-dev` (DEAD) | quotecore-plus.vercel.app | Disconnected | N/A | Dead. Will NOT auto-deploy. Do not deploy here. |

Note: `dev` and `main` both serve production URLs — `dev` is just further behind. See MEMORY.md "DEV = PRODUCTION".

---

## Workflow Per Agent

### Gavin (Dev — App Features)
1. Build the feature, `next build` passes
2. Push once to the branch Shaun names (default `main`): `git pull --rebase origin main` → single squashed commit → `git push origin main`

### Ron / Barry (SEO — Blog, Marketing, Content)
1. `git pull` on your target branch before starting and before pushing
2. Push to `main` (default) or `development` when Shaun says dev
3. If unsure which branch you're on: `git branch` — the `*` marks it

---

## Critical Rules

1. **One push, one branch, one squashed commit.** No double-builds.
2. **Always pull (rebase) before push.**
3. **Never use `vercel promote`.** Use `vercel deploy --prod` from the linked repo if a manual testing deploy is needed.
4. **The dead `quotecore-plus-dev` project** is a redirect only. Do not deploy to it. Do not delete it yet.
5. **Authored as `dev.algora@gmail.com`** or the deploy silently never happens.
6. **GitHub Actions workflows `deploy-testing.yml` and `e2e.yml` were deleted — do NOT recreate them** (they doubled builds / wasted minutes).

---

## Quick Reference

```
Shaun names a branch (default: main)
    │
    ▼
  pull --rebase → single squashed commit → push once → Vercel auto-deploys
```

**Remember:** the branch Shaun names is where it ships. No intermediate steps, no merge questions.

---

## Questions?

If anything here is unclear or you hit an edge case, ask Gavin (team lead for QuoteCore+). Don't guess — a wrong push breaks the live site.
