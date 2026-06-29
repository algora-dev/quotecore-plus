# Gerald Audit Brief: Auth Flow Security & UX

**Date:** 2026-06-29
**Scope:** Full authentication flow — signup, login, Google OAuth, email confirmation, onboarding, session management
**Bundle range:** `2aa6883..HEAD` (development branch)
**Requester:** Shaun
**Priority:** HIGH — multiple user-facing auth issues remain after two rounds of fixes

---

## Background

We've had three rounds of fixes on the auth flow today, and there are still issues Shaun found in testing. The core problems:

1. **"Server Components render error"** still appears when unconfirmed users try to log in — the fix I shipped (throwing `EMAIL_NOT_CONFIRMED` sentinel) doesn't work in production Next.js because thrown server action errors get sanitized
2. **Google sign-in bypasses email confirmation** — by design (Google verifies the email), but Shaun wants Google users to also go through a confirmation step
3. **Supabase-branded URLs** in the Google OAuth flow — the redirect URL shows a raw Supabase URL instead of a QuoteCore+ branded URL
4. **Drawings & Images upload UX** is inconsistent with the rest of the app (uses a plain `<input type="file">` instead of the drag-and-drop `FileUploader` component used elsewhere)

---

## Issue 1: Login error handling — "Server Components render error"

### Root cause

`loginAction` in `app/login/actions.ts` throws `new Error('EMAIL_NOT_CONFIRMED')` when Supabase returns "Email not confirmed". The client in `app/login/page.tsx` catches this in a try/catch around `loginAction(formData)`.

**Why it fails in production:** Next.js production builds sanitize thrown server action errors. The error message is replaced with a generic digest, and the client never sees `EMAIL_NOT_CONFIRMED`. The catch block falls through to the generic error handler, and the user sees "Server Components render error".

### Fix needed

`loginAction` must **return** a result object instead of **throwing** for the EMAIL_NOT_CONFIRMED case. Throwing is fine for unexpected errors, but for known/expected error states, server actions should return structured results.

```typescript
// Instead of:
if (error.message.toLowerCase().includes('email not confirmed')) {
  throw new Error('EMAIL_NOT_CONFIRMED');
}

// Do:
if (error.message.toLowerCase().includes('email not confirmed')) {
  return { ok: false, code: 'EMAIL_NOT_CONFIRMED', email };
}
```

The client then checks the return value instead of catching a thrown error.

### Also check

- `loginAction` also throws for other Supabase errors (wrong password, etc.) — these should also be returned, not thrown, to avoid the same sanitization issue
- The `NEXT_REDIRECT` throw is correct — that's how Next.js signals redirects from server actions and must be re-thrown

---

## Issue 2: Google sign-in bypasses email confirmation

### Current behaviour

`mailer_autoconfirm: false` on Supabase auth means manual signups must click a confirmation link. But Google OAuth users are auto-confirmed by Supabase because Google has already verified the email. This is standard OAuth behaviour.

### What Shaun wants

Google users should also receive a "welcome" email with a confirmation link/button that they must click before they can log in and complete the onboarding flow.

### Options for Gerald to evaluate

**Option A: Keep Google auto-confirm (industry standard)**
- Google has already verified the email — requiring a second confirmation adds friction without security benefit
- The welcome email is already sent after onboarding completes
- Risk: a malicious actor could create a Google account with someone else's name, but they can't control the email address itself

**Option B: Block Google users at /auth/callback until they click an email link**
- After Google OAuth completes, instead of creating a session, send a confirmation email and redirect to a "check your email" page
- Requires a custom flow since Supabase doesn't natively support "confirm after OAuth"
- Would need to: create the auth user with `email_confirm: false` after Google returns the identity, send a custom email, handle the confirmation callback
- Significant complexity, potentially fragile

**Option C: Send the welcome email with a "confirm" button that's really just a magic link**
- After Google onboarding completes, send an email with a link to a "welcome" page
- The link doesn't block login — it's informational
- This is what we already do (welcome email sends after onboarding)

### Recommendation

Gerald should evaluate whether Option B is feasible without creating a poor UX or security holes. If not, Option A with better messaging (tell the user "your email was verified by Google") is the pragmatic choice.

---

## Issue 3: Supabase-branded URLs in Google OAuth flow

### Current behaviour

When a user clicks "Continue with Google" on the login/signup page, `GoogleSignInButton.tsx` calls:

```typescript
supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${window.location.origin}/auth/callback`,
  },
});
```

The `redirectTo` is correctly set to the app's own `/auth/callback`. However, the Supabase client library constructs the OAuth URL as:

```
https://<project-ref>.supabase.co/auth/v1/authorize?provider=google&redirect_to=<url>
```

The user sees `<project-ref>.supabase.co` in the browser address bar during the redirect to Google. This is the "weird Supabase URL" Shaun is seeing.

### Fix options

1. **Custom domain for Supabase auth** — configure a CNAME like `auth.quote-core.com` pointing to the Supabase auth endpoint, then set `SUPABASE_AUTH_DOMAIN` env var. This is a Supabase config change, not a code change.

2. **Server-side OAuth flow** — instead of the client-side `signInWithOAuth`, do the redirect server-side and use Supabase's `getRedirectUrl` to construct a cleaner URL. Still shows the Supabase domain unless a custom domain is configured.

3. **Accept the current behaviour** — the Supabase URL only appears briefly during the redirect to Google. Once Google's consent screen loads, the URL is `accounts.google.com`. This is standard behaviour for any Supabase + Google OAuth setup without a custom domain.

### Recommendation

This requires a Supabase custom domain configuration (dashboard or API). Gerald should evaluate whether this is worth the effort vs. just accepting the brief Supabase URL flash.

---

## Issue 4: Drawings & Images upload UX inconsistency

### Current behaviour

`flashing-list.tsx` uses a plain `<input type="file" name="image" accept="image/*">` inside a basic form for uploading images.

### Rest of the app

`FileUploader.tsx` (`app/components/FileUploader.tsx`) provides a drag-and-drop upload zone with:
- Visual drop zone with drag-over states
- File validation (size, type)
- Upload progress indicator
- Current file preview
- Storage-blocked modal integration
- Consistent styling with the rest of the app

### Fix needed

Replace the plain file input in `flashing-list.tsx` with the `FileUploader` component (or at minimum, match its drag-and-drop UX and styling). The upload form should use the same visual pattern as other upload surfaces in the app.

---

## Issue 5: Orphaned account state from testing

### Current behaviour

Shaun has been testing by:
1. Signing up with an email
2. Manually deleting the auth user + profile from the Supabase dashboard
3. Signing up again with the same email

This creates edge cases:
- The `signupWithCompany` action creates a company + profile, then if the auth user already exists, it returns "User already registered" — but the company/profile may have been partially created
- The orphan recovery in `/auth/callback` and `/onboarding` checks for orphaned quotes, but if the user was deleted before creating any quotes, there's nothing to recover

### Fix needed

`signupWithCompany` should check if the email already exists BEFORE calling `createUser`, and return a friendly error. Currently it relies on `createUser` failing, which may leave partial state.

---

## Files to audit

- `app/login/actions.ts` — `loginAction`, `resendConfirmationAction`
- `app/login/page.tsx` — client-side error handling
- `app/signup/actions.ts` — `signupWithCompany`
- `app/signup/page.tsx` — signup form
- `app/auth/callback/route.ts` — OAuth + email confirmation callback
- `app/(auth)/onboarding/actions.ts` — `completeGoogleOnboarding`, `completeOnboarding`
- `app/(auth)/onboarding/page.tsx` — onboarding page guards
- `app/(auth)/onboarding/GoogleOnboardingForm.tsx` — Google onboarding form
- `app/(auth)/onboarding/OnboardingForm.tsx` — regular onboarding form
- `app/components/auth/GoogleSignInButton.tsx` — Google OAuth trigger
- `middleware.ts` — auth middleware
- `app/lib/supabase/server.ts` — Supabase server client
- `app/lib/supabase/admin.ts` — Supabase admin client
- `app/(auth)/[workspaceSlug]/flashings/flashing-list.tsx` — upload UX
- `app/components/FileUploader.tsx` — canonical upload component

## Supabase auth config (current)

- `mailer_autoconfirm: false`
- `mailer_allow_unverified_email_sign_ins: false`
- `rate_limit_email_sent: 500`
- `site_url: https://app.quote-core.com`
- `uri_allow_list` includes all Vercel URLs + `app.quote-core.com`
- Google OAuth enabled with client ID configured
- SMTP via Resend

---

## What Gerald should evaluate

1. **Is the login error handling fix correct?** (return vs throw for known error states)
2. **Is the Google email confirmation requirement feasible without poor UX?** (Option B above)
3. **Are there any security holes in the orphan recovery logic?** (e.g., could an attacker claim another user's orphaned company by creating an auth user with the same email?)
4. **Is the signup flow race-safe?** (two simultaneous signups with the same email)
5. **Does the middleware correctly handle all auth states?** (unconfirmed, no profile, no company, etc.)
6. **Are there any paths where a user could end up in onboarding with an existing company?**
