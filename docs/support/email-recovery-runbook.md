# Email Recovery Runbook (Support / Admin)

When a user contacts `info@quote-core.com` saying:
> "I've lost access to my email and can't change it inside the app — please help"

This is the only path to fixing it. The in-app email change requires the user to confirm via BOTH the old and new inboxes; if they can't access the old inbox they're stuck.

---

## 0. Decide whether you trust the request

Treat this as a high-stakes change. An attacker who flips the email address can take over the account fully (because password reset goes to the new email). Do NOT do this for anyone you can't verify.

Verification options, in order of preference:

1. **Security questions** — the user set 1–2 of these at signup or in Settings → Account Recovery. The hashed answers are in `public.user_security_questions`. Verify by:
   - Asking the user for their answer to **both** questions (or 1-of-1 if they only set one)
   - Run `verify_security_answer.sql` (below) to bcrypt-compare the answer
   - **Both** answers must match. If only one is set and it matches, treat as a soft pass and require step 2 as well.

2. **Real-world identity** — confirm the user's company name, last quote number, customer email patterns, anything that would be hard for an attacker to know without account access.

3. **Voice / video call** — last resort. Phone the number on file, or a video call where they can show ID.

If in doubt, refuse politely and ask them to provide more proof. We err on the side of refusing, never on the side of allowing.

---

## 1. Verify a security answer

Use this SQL via Supabase Studio → SQL Editor (or via Management API). Replace `<USER_EMAIL>` and `<ANSWER_AS_TYPED>`.

```sql
-- Step 1: find the user
SELECT u.id, u.email, q.slot, q.question, q.answer_hash
FROM public.users u
JOIN public.user_security_questions q ON q.user_id = u.id
WHERE u.email = '<USER_EMAIL>'
ORDER BY q.slot;
```

Copy the relevant `answer_hash`. Then bcrypt-compare via Node:

```bash
node -e "
const bcrypt = require('bcryptjs');
const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
const ok = bcrypt.compareSync(norm('<ANSWER_AS_TYPED>'), '<answer_hash>');
console.log(ok ? 'MATCH' : 'NO MATCH');
"
```

**Important:** the `norm()` step (lowercasing and whitespace-collapsing) MUST mirror `app/lib/security/questions.ts → normaliseAnswer`. If you skip it, valid answers will fail.

---

## 2. Change the email

Once verification is complete, change the email via the Supabase Management API. Replace placeholders.

```bash
# Find the auth.users row for this user
curl -X POST "https://api.supabase.com/v1/projects/aaavvfttkesdzblttmby/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"SELECT id, email FROM auth.users WHERE email = ''<OLD_EMAIL>'';"}'
```

Then update the email AND mark it confirmed (so the user doesn't have to re-verify):

```bash
curl -X POST "https://api.supabase.com/v1/projects/aaavvfttkesdzblttmby/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"UPDATE auth.users SET email = ''<NEW_EMAIL>'', email_confirmed_at = NOW() WHERE id = ''<USER_ID>'';"}'
```

Then mirror it into `public.users` and stamp the cooldown so the user can't immediately change it again:

```bash
curl -X POST "https://api.supabase.com/v1/projects/aaavvfttkesdzblttmby/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"UPDATE public.users SET email = ''<NEW_EMAIL>'', last_email_change_at = NOW() WHERE id = ''<USER_ID>'';"}'
```

---

## 3. Force a password reset

Always do this. Even if the user "just" lost email access, we treat it as a credentials-compromise scenario and require a fresh password.

Send a password reset link via the Auth Admin API. The user can then click it from their NEW (working) email:

```bash
curl -X POST "https://aaavvfttkesdzblttmby.supabase.co/auth/v1/recover" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"<NEW_EMAIL>"}'
```

---

## 4. Manual notification

Send the user a personal email confirming the change has been made and that a password reset is on its way. This closes the loop and gives them a paper trail.

---

## 5. Logbook

Record the action in the support log:
- Date / time
- User ID
- Old email -> new email
- Verification method (questions / real-world / call)
- Who handled it (Shaun)

Keep this log. It's the only audit trail we have for manual email changes.

---

## What if the user has no security questions set?

This is the worst case. Options, in priority order:

1. **Real-world identity** is then the only verification — be very strict. Match against company details, customer lists, recent quote activity, anything they wouldn't know without account access.
2. If still in doubt, **refuse** and explain politely that without the recovery questions there's no way for us to verify it's really them. Suggest they create a fresh account.

Going forward, the onboarding flow nudges every new user to set them. Existing users (during the testing phase, all data is being wiped) will hit them on first login post-launch.
