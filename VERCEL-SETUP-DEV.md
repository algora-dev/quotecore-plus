# Vercel Development Environment Setup Guide

## Overview
Set up a second Vercel project for ongoing development while keeping the test version stable.

---

## Branch Strategy

### **main** branch → Production/Test Environment
- URL: `https://quotecore-plus.vercel.app` (or similar)
- Purpose: User testing, stable releases
- **DO NOT** push active development here
- Only merge from `development` after features are tested

### **development** branch → Development Environment  
- URL: `https://quotecore-plus-dev.vercel.app` (or similar)
- Purpose: Active feature development, experiments
- **Push all new work here first**
- Merge to `main` only when ready for user testing

---

## Step-by-Step Setup

### 1. Log in to Vercel
Go to: https://vercel.com/dashboard

### 2. Create New Project
1. Click "Add New..." → "Project"
2. Select your GitHub repository: `algora-dev/quotecore-plus`
3. **IMPORTANT:** Click "Configure Project"

### 3. Configure Development Project

**Project Name:**
```
quotecore-plus-dev
```

**Framework Preset:**
```
Next.js
```

**Root Directory:**
```
quotecore-app
```
*(Same as test project)*

**Build Command:**
```
npm run build
```

**Output Directory:**
```
.next
```

**Install Command:**
```
npm install
```

**Branch Configuration (CRITICAL):**
- **Production Branch:** `development`
- ⚠️ **NOT** `main` - we want `main` to stay on the test project!

### 4. Environment Variables (Same as Test Project)

Copy ALL environment variables from your test project:

**Required Variables:**
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=https://quotecore-plus-dev.vercel.app
```

**How to Copy Variables:**
1. Go to your test project → Settings → Environment Variables
2. Copy each variable name and value
3. Paste into new dev project → Settings → Environment Variables
4. **Update `NEXT_PUBLIC_APP_URL`** to the dev URL

### 5. Supabase Configuration

**You can use the SAME Supabase database for both environments**, but you may want to:

**Option A: Shared Database (Recommended for testing)**
- Both test and dev use same Supabase project
- Easier to test with real data
- ⚠️ Be careful not to break test data during dev

**Option B: Separate Database (Safer)**
- Create a second Supabase project for dev
- Completely isolated data
- Requires duplicate migrations
- More setup but safer

**If using Option B:**
1. Create new Supabase project (dev)
2. Run all migrations from `backend/supabase/migrations/`
3. Update environment variables with dev Supabase credentials

---

## Deployment Triggers

### Test Environment (main branch)
- Deploys when you push to `main`
- **Manually merge from `development` when ready**
- Users test on this URL

### Dev Environment (development branch)
- Deploys automatically when you push to `development`
- **This is where you push all new work**
- Continuous deployment for rapid iteration

---

## Workflow

### Daily Development Flow

1. **Work on `development` branch:**
   ```bash
   git checkout development
   # Make changes, test locally
   git add .
   git commit -m "Feature: Add new functionality"
   git push origin development
   ```
   → Vercel auto-deploys to dev environment

2. **When feature is ready for user testing:**
   ```bash
   # Switch to main
   git checkout main
   
   # Merge development
   git merge development
   
   # Push to trigger test deployment
   git push origin main
   ```
   → Vercel auto-deploys to test environment
   → Users test the feature

3. **Continue development:**
   ```bash
   git checkout development
   # Continue working...
   ```

---

## Vercel Project Settings

### Test Project Settings
- **Name:** `quotecore-plus` (or current name)
- **Branch:** `main`
- **URL:** Your current test URL
- **Purpose:** User testing, stable

### Dev Project Settings
- **Name:** `quotecore-plus-dev`
- **Branch:** `development`
- **URL:** New dev URL (auto-generated)
- **Purpose:** Active development

---

## Database Migration Strategy

### Shared Database Approach (Recommended)
- Run migrations in Supabase SQL Editor
- Both environments see changes immediately
- Simpler management

### Separate Database Approach
- Run migrations in both databases
- Keep migration files in sync
- More isolated but more overhead

---

## Protection Rules (Optional but Recommended)

### GitHub Branch Protection for `main`
1. Go to: GitHub repo → Settings → Branches
2. Add rule for `main`:
   - ✅ Require pull request reviews
   - ✅ Require status checks (Vercel build)
   - ❌ Do NOT require signed commits (unless you want)
3. This prevents accidental direct pushes to `main`

---

## Quick Reference

### URLs (Replace with your actual URLs)
- **Test:** `https://quotecore-plus.vercel.app`
- **Dev:** `https://quotecore-plus-dev.vercel.app`

### Branches
- **main** → Test environment (stable, user testing)
- **development** → Dev environment (active work)

### Commands
```bash
# Start developing
git checkout development

# Deploy to dev (auto)
git push origin development

# Deploy to test (manual)
git checkout main
git merge development
git push origin main

# Go back to dev
git checkout development
```

---

## Troubleshooting

### "Build failed" on dev environment
- Check Vercel build logs
- Ensure TypeScript errors are fixed: `npm run build` locally
- Verify environment variables are set

### Dev environment showing old code
- Check you're on `development` branch: `git branch`
- Verify Vercel is tracking `development` branch
- Clear `.next` cache and rebuild

### Changes not appearing in dev
- Make sure you pushed to `development` not `main`
- Check Vercel deployment logs
- Verify build completed successfully

---

## Next Steps

1. ✅ Create `development` branch (DONE)
2. ⬜ Create new Vercel project (follow steps above)
3. ⬜ Configure environment variables
4. ⬜ Deploy and verify dev environment works
5. ⬜ Start development on `development` branch
6. ⬜ Keep `main` stable for user testing

---

**Ready to create the Vercel project? Follow the steps above!** 🚀
